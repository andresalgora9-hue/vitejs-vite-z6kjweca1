-- ============================================================
-- OficioYa · Cobro automático de las facturas de leads con tarjeta (Stripe)
-- 07/11/2026 · Claude
--  · El profesional guarda su tarjeta con un enlace (función «cobros» → Stripe Checkout, modo setup).
--  · Al emitirse una factura de leads se cobra sola en su tarjeta.
--  · Si el cobro falla: aviso al profesional y al admin, y cuenta atrás de N leads (impago_leads_margen)
--    hasta cortarle la entrada de clientes (oy_route_pro ya salta a los bloqueados).
-- ============================================================

-- 1) pro_tarjetas: la fila existe desde que se genera el enlace (antes de guardar la tarjeta)
alter table public.pro_tarjetas alter column stripe_customer_id drop not null;
alter table public.pro_tarjetas add column if not exists enlace_token text;
alter table public.pro_tarjetas add column if not exists checkout_session_id text;
alter table public.pro_tarjetas add column if not exists created_at timestamptz not null default now();
create unique index if not exists pro_tarjetas_enlace_token_key on public.pro_tarjetas (enlace_token);

-- 1b) Estados del cobro: los que ya había (sin_tarjeta, pendiente_cobro, cobrando, cobrada, rechazada) + procesando y error
alter table public.lead_invoices drop constraint if exists lead_invoices_cobro_estado_chk;
alter table public.lead_invoices add constraint lead_invoices_cobro_estado_chk check (cobro_estado is null or cobro_estado = any (
  array['sin_tarjeta', 'pendiente_cobro', 'cobrando', 'cobrada', 'rechazada', 'procesando', 'error']));

-- 2) Enlace para guardar la tarjeta (no caduca: cada vez abre una sesión nueva de Stripe)
create or replace function public.oy_enlace_tarjeta(p_pro uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_tok text;
begin
  if not exists (select 1 from users where id = p_pro and type = 'profesional') then
    raise exception 'Profesional no encontrado';
  end if;
  insert into pro_tarjetas (pro_id, enlace_token)
  values (p_pro, replace(gen_random_uuid()::text, '-', ''))
  on conflict (pro_id) do update set enlace_token = coalesce(pro_tarjetas.enlace_token, excluded.enlace_token)
  returning enlace_token into v_tok;
  return 'https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/cobros?t=' || v_tok;
end $$;

-- 3) Estado del cobro de un profesional (su panel de Facturas y su ficha en admin)
create or replace function public.oy_cobro_estado_pro(p_pro uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t record; v_enlace text;
begin
  v_enlace := oy_enlace_tarjeta(p_pro);
  select * into t from pro_tarjetas where pro_id = p_pro;
  return jsonb_build_object(
    'enlace', v_enlace,
    'tarjeta', case when t.activa and t.stripe_pm_id is not null then jsonb_build_object(
        'marca', t.marca, 'ultimos4', t.ultimos4, 'caduca_mes', t.caduca_mes, 'caduca_anio', t.caduca_anio, 'guardada_at', t.guardada_at)
      end,
    'impago', oy_impago_estado(p_pro),
    'fallidas', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'number', f.number, 'total', f.total,
        'error', f.cobro_error, 'at', f.cobro_ultimo_at) order by f.issued_at)
      from lead_invoices f where f.pro_id = p_pro and f.status = 'pendiente' and f.cobro_estado = 'rechazada'), '[]'::jsonb));
end $$;

-- 4) Resumen para la lista de profesionales del admin
create or replace function public.oy_cobro_resumen(p_admin text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform oy_admin_ok(p_admin);
  return coalesce((
    select jsonb_object_agg(u.id, jsonb_build_object(
      'tarjeta', case when t.activa and t.stripe_pm_id is not null then jsonb_build_object(
          'marca', t.marca, 'ultimos4', t.ultimos4, 'caduca_mes', t.caduca_mes, 'caduca_anio', t.caduca_anio) end,
      'impago', oy_impago_estado(u.id),
      'fallidas', (select count(*) from lead_invoices f where f.pro_id = u.id and f.status = 'pendiente' and f.cobro_estado in ('rechazada', 'error'))))
    from users u left join pro_tarjetas t on t.pro_id = u.id
    where u.type = 'profesional'
      and (t.stripe_pm_id is not null
        or exists (select 1 from pro_bloqueo_impago b where b.pro_id = u.id)
        or exists (select 1 from lead_invoices f where f.pro_id = u.id and f.status = 'pendiente' and f.cobro_estado in ('rechazada', 'error')))
  ), '{}'::jsonb);
end $$;

-- 5) Reclamar una factura para cobrarla (bloqueo de fila: nunca dos cobros a la vez)
--    p_origen: 'emision' (solo facturas sin intentar), 'tarjeta_guardada' (todo lo pendiente), 'reintento' (cron diario)
create or replace function public.oy_cobro_reclamar(p_factura uuid, p_origen text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f record; t record; v_previo text; v_atascada boolean; v_intento int;
begin
  select * into f from lead_invoices where id = p_factura for update;
  if f.id is null or f.status <> 'pendiente' or coalesce(f.tipo, 'leads') <> 'leads' then return null; end if;
  v_previo := f.cobro_estado;
  v_atascada := v_previo = 'cobrando' and f.cobro_ultimo_at < now() - interval '15 minutes';
  if v_previo in ('cobrada', 'procesando') or (v_previo = 'cobrando' and not v_atascada) then return null; end if;
  if not v_atascada then
    if p_origen = 'emision' and coalesce(v_previo, 'pendiente_cobro') <> 'pendiente_cobro' then return null; end if;
    if p_origen = 'reintento' and not (
         coalesce(v_previo, 'pendiente_cobro') = 'pendiente_cobro'
      or v_previo = 'sin_tarjeta'
      or (v_previo = 'rechazada' and coalesce(f.cobro_intentos, 0) < 3 and f.cobro_ultimo_at < now() - interval '20 hours')) then
      return null;
    end if;
  end if;

  select * into t from pro_tarjetas where pro_id = f.pro_id and activa and stripe_pm_id is not null and stripe_customer_id is not null;
  if t.pro_id is null then
    if v_previo is distinct from 'sin_tarjeta' then
      update lead_invoices set cobro_estado = 'sin_tarjeta', cobro_ultimo_at = now() where id = f.id;
    end if;
    return jsonb_build_object('factura', f.id, 'sin_tarjeta', true);
  end if;

  update lead_invoices
     set cobro_estado = 'cobrando', cobro_ultimo_at = now(),
         -- si el intento anterior se quedó a medias se repite con el mismo número (misma clave de idempotencia en Stripe)
         cobro_intentos = case when v_atascada then greatest(coalesce(cobro_intentos, 0), 1) else coalesce(cobro_intentos, 0) + 1 end
   where id = f.id
  returning cobro_intentos into v_intento;

  return jsonb_build_object('factura', f.id, 'number', f.number, 'pro_id', f.pro_id, 'total', f.total,
    'customer', t.stripe_customer_id, 'pm', t.stripe_pm_id, 'intento', v_intento, 'revisar', v_atascada);
end $$;

-- 6) Resultado del cobro: factura, historial, cuenta atrás y avisos
create or replace function public.oy_cobro_resultado(p_factura uuid, p_estado text, p_pi text, p_codigo text,
                                                     p_mensaje text, p_detalle text, p_origen text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f record; t record; e jsonb; v_lim int; v_quedan int; v_nombre text; v_total text; v_enlace text;
  v_admin constant uuid := '00000000-0000-0000-0000-000000000002';
begin
  select * into f from lead_invoices where id = p_factura;
  if f.id is null then return null; end if;
  select * into t from pro_tarjetas where pro_id = f.pro_id;
  select coalesce(nullif(btrim(name), ''), 'Profesional') into v_nombre from users where id = f.pro_id;
  v_total := replace(to_char(f.total, 'FM999990.00'), '.', ',') || ' €';

  insert into cobros_intentos (invoice_id, pro_id, origen, resultado, importe, stripe_pi_id, codigo, mensaje)
  values (f.id, f.pro_id, p_origen, p_estado, f.total, p_pi, p_codigo, left(coalesce(p_detalle, p_mensaje), 500));

  if p_estado = 'cobrada' then
    update lead_invoices
       set status = 'pagada', paid_at = coalesce(paid_at, now()), metodo_pago = 'tarjeta',
           cobro_estado = 'cobrada', cobro_error = null, stripe_pi_id = coalesce(p_pi, stripe_pi_id)
     where id = f.id;
    perform oy_push(f.pro_id, '✅ Factura ' || f.number || ' pagada',
      'Hemos cobrado ' || v_total || ' en tu tarjeta' || coalesce(' ' || initcap(t.marca), '') || coalesce(' •••• ' || t.ultimos4, '')
      || '. No tienes que hacer nada más.', '/');
    perform oy_push(v_admin, '💶 Cobrada con tarjeta — ' || v_nombre, f.number || ' · ' || v_total, '/');
    return jsonb_build_object('estado', 'cobrada');
  end if;

  if p_estado = 'procesando' then
    update lead_invoices set cobro_estado = 'procesando', stripe_pi_id = coalesce(p_pi, stripe_pi_id) where id = f.id;
    return jsonb_build_object('estado', 'procesando');
  end if;

  if p_estado = 'error' then
    -- Error nuestro o de Stripe (no de la tarjeta): sin cuenta atrás; aviso solo al admin
    update lead_invoices set cobro_estado = 'error', cobro_error = left(coalesce(p_detalle, p_mensaje), 300),
           stripe_pi_id = coalesce(p_pi, stripe_pi_id) where id = f.id;
    perform oy_push(v_admin, '🛠 No se pudo intentar el cobro — ' || v_nombre,
      f.number || ' · ' || v_total || ' · ' || left(coalesce(p_detalle, p_mensaje, 'error desconocido'), 120), '/');
    return jsonb_build_object('estado', 'error');
  end if;

  -- Cobro rechazado por la tarjeta o el banco
  update lead_invoices set cobro_estado = 'rechazada', cobro_error = p_mensaje, stripe_pi_id = coalesce(p_pi, stripe_pi_id)
   where id = f.id;
  v_lim := coalesce(oy_cfg('impago_leads_margen'), 2)::int;
  insert into pro_bloqueo_impago (pro_id, desde, limite, motivo)
  values (f.pro_id, now(), v_lim, 'Cobro con tarjeta fallido ' || f.number || coalesce(' (' || p_codigo || ')', ''))
  on conflict (pro_id) do nothing;
  e := oy_impago_estado(f.pro_id);
  v_quedan := greatest(coalesce((e->>'limite')::int, v_lim) - coalesce((e->>'usados')::int, 0), 0);
  begin v_enlace := oy_enlace_tarjeta(f.pro_id); exception when others then v_enlace := '/'; end;

  perform oy_push(f.pro_id, '⚠️ No hemos podido cobrar tu factura ' || f.number,
    'No se han podido cobrar ' || v_total || ' en tu tarjeta: ' || coalesce(p_mensaje, 'el banco lo ha rechazado') || '. '
    || 'Toca aquí para poner otra tarjeta, o págala por transferencia o Bizum desde Facturas. '
    || case when v_quedan > 0 then 'Te quedan ' || v_quedan || case when v_quedan = 1 then ' lead' else ' leads' end
            || ' antes de que se pare la entrada de clientes.'
            else 'La entrada de clientes está parada hasta que se pague.' end,
    v_enlace);
  perform oy_push(v_admin, '🔴 Cobro fallido — ' || v_nombre,
    f.number || ' · ' || v_total || ' · ' || coalesce(p_mensaje, p_codigo, 'rechazado') || ' · '
    || case when v_quedan > 0 then 'quedan ' || v_quedan || ' leads para cortarle' else 'ya no recibe leads' end, '/');
  return jsonb_build_object('estado', 'rechazada', 'quedan', v_quedan);
end $$;

-- 7) Tarjeta guardada (vuelta de Stripe): guarda los datos y devuelve lo pendiente de cobrar
create or replace function public.oy_tarjeta_guardar(p_pro uuid, p_customer text, p_pm text, p_marca text, p_ultimos4 text,
                                                     p_mes int, p_anio int, p_session text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_previa text; v_nombre text; v_pend uuid[]; v_n int;
begin
  select stripe_pm_id into v_previa from pro_tarjetas where pro_id = p_pro and activa;
  insert into pro_tarjetas (pro_id, enlace_token, stripe_customer_id, stripe_pm_id, marca, ultimos4, caduca_mes, caduca_anio,
                            activa, guardada_at, actualizada_at, checkout_session_id)
  values (p_pro, replace(gen_random_uuid()::text, '-', ''), p_customer, p_pm, p_marca, p_ultimos4, p_mes, p_anio,
          true, now(), now(), p_session)
  on conflict (pro_id) do update set
    stripe_customer_id = excluded.stripe_customer_id, stripe_pm_id = excluded.stripe_pm_id, marca = excluded.marca,
    ultimos4 = excluded.ultimos4, caduca_mes = excluded.caduca_mes, caduca_anio = excluded.caduca_anio, activa = true,
    guardada_at = case when pro_tarjetas.stripe_pm_id is distinct from excluded.stripe_pm_id then now()
                       else coalesce(pro_tarjetas.guardada_at, now()) end,
    actualizada_at = now(), checkout_session_id = excluded.checkout_session_id;

  select array_agg(id order by issued_at) into v_pend from lead_invoices
   where pro_id = p_pro and status = 'pendiente' and coalesce(tipo, 'leads') = 'leads'
     and coalesce(cobro_estado, '') not in ('cobrando', 'cobrada', 'procesando');
  v_n := coalesce(array_length(v_pend, 1), 0);

  if v_previa is distinct from p_pm then
    select coalesce(nullif(btrim(name), ''), 'Profesional') into v_nombre from users where id = p_pro;
    perform oy_push('00000000-0000-0000-0000-000000000002', '💳 ' || v_nombre || ' ha guardado su tarjeta',
      coalesce(initcap(p_marca), 'Tarjeta') || ' •••• ' || coalesce(p_ultimos4, '????')
      || case when v_n = 1 then ' · tenía 1 factura pendiente: se cobra ahora'
              when v_n > 1 then ' · tenía ' || v_n || ' facturas pendientes: se cobran ahora' else '' end, '/');
    if v_n = 0 then
      perform oy_push(p_pro, '✅ Tarjeta guardada',
        'Desde ahora tus facturas se pagan solas con tu ' || coalesce(initcap(p_marca), 'tarjeta') || coalesce(' •••• ' || p_ultimos4, '')
        || '. Ya no tienes que hacer transferencias.', '/');
    end if;
  end if;
  return jsonb_build_object('pendientes', coalesce(to_jsonb(v_pend), '[]'::jsonb));
end $$;

-- 8) Candidatas del reintento diario
create or replace function public.oy_cobros_para_reintentar()
returns table (factura uuid, estado text, pi text) language sql security definer set search_path = public as $$
  select f.id, f.cobro_estado, f.stripe_pi_id
    from lead_invoices f
   where f.status = 'pendiente' and coalesce(f.tipo, 'leads') = 'leads'
     and (
          (coalesce(f.cobro_estado, 'pendiente_cobro') = 'pendiente_cobro' and f.issued_at < now() - interval '10 minutes')
       or (f.cobro_estado = 'sin_tarjeta'
           and exists (select 1 from pro_tarjetas t where t.pro_id = f.pro_id and t.activa and t.stripe_pm_id is not null))
       or (f.cobro_estado = 'rechazada' and coalesce(f.cobro_intentos, 0) < 3 and f.cobro_ultimo_at < now() - interval '20 hours'
           and coalesce((select c.codigo from cobros_intentos c where c.invoice_id = f.id order by c.created_at desc limit 1), '')
               <> 'authentication_required')
       or (f.cobro_estado = 'cobrando' and f.cobro_ultimo_at < now() - interval '15 minutes')
       or (f.cobro_estado = 'procesando' and f.stripe_pi_id is not null))
   order by f.issued_at
$$;

-- 9) Clave para que la base de datos llame a «cobros» (se guarda en Vault como cobros_clave)
create or replace function public.oy_cobros_clave()
returns text language sql security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'cobros_clave' limit 1
$$;

create or replace function public.oy_cobros_llamar(p jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare rid bigint;
begin
  select net.http_post(
    url := 'https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/cobros',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cobros-clave', coalesce(oy_cobros_clave(), '')),
    body := p,
    timeout_milliseconds := 30000) into rid;
  return rid;
end $$;

-- 10) Al emitir una factura de leads, se cobra sola
create or replace function public.lead_invoices_cobro_automatico()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform oy_cobros_llamar(jsonb_build_object('accion', 'cobrar', 'factura', new.id));
  return new;
exception when others then
  raise warning 'lead_invoices_cobro_automatico: %', sqlerrm;
  return new;
end $$;

drop trigger if exists lead_invoices_cobro_automatico on public.lead_invoices;
create trigger lead_invoices_cobro_automatico
  after insert on public.lead_invoices
  for each row when (new.status = 'pendiente' and coalesce(new.tipo, 'leads') = 'leads')
  execute function public.lead_invoices_cobro_automatico();

-- 11) Aviso de factura nueva: si tiene tarjeta, dice que se cobra sola; si no, el aviso lleva al enlace de la tarjeta
create or replace function public.oy_emitir_factura(p_pro uuid, p_motivo text, p_hasta timestamp with time zone)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_ids uuid[]; v_base numeric; v_n int; v_ini timestamptz; v_fin timestamptz;
  v_id uuid; v_num text; v_year text; v_iva numeric; u record; v_due timestamptz;
  v_pct numeric := coalesce(oy_cfg('iva_pct'), 21);
  v_dias int := coalesce(oy_cfg('dias_pago'), 5)::int;
  v_enlace text;
begin
  perform pg_advisory_xact_lock(hashtext('lead_invoices'));

  select array_agg(id), coalesce(sum(price),0), count(*), min(created_at), max(created_at)
    into v_ids, v_base, v_n, v_ini, v_fin
  from pro_leads
  where pro_id = p_pro and not anulado and invoice_id is null and created_at < p_hasta;
  if v_n = 0 then return null; end if;

  select * into u from users where id = p_pro;
  v_year := to_char(now() at time zone 'Europe/Madrid', 'YYYY');
  select 'OY' || v_year || '-' || lpad((count(*) + 1)::text, 4, '0') into v_num
  from lead_invoices where number like 'OY' || v_year || '-%';

  v_base := round(v_base, 2);
  v_iva := round(v_base * v_pct / 100, 2);
  v_due := now() + make_interval(days => v_dias);

  insert into lead_invoices (number, pro_id, issued_at, due_at, period_start, period_end, motivo, tipo, concepto, n_leads,
                             base, iva_pct, iva, total,
                             cliente_nombre, cliente_nif, cliente_direccion, cliente_email, cliente_telefono)
  values (v_num, p_pro, now(), v_due, v_ini, v_fin, p_motivo, 'leads', 'Captación de clientes (leads)', v_n,
          v_base, v_pct, v_iva, v_base + v_iva,
          coalesce(nullif(u.company_name,''), u.name), nullif(u.cif,''),
          nullif(concat_ws(', ', nullif(u.fiscal_address,''), nullif(trim(concat_ws(' ', nullif(u.fiscal_zip,''), nullif(u.fiscal_city,''))),'')),''),
          coalesce(nullif(u.billing_email,''), u.email), coalesce(nullif(u.phone,''), nullif(u.whatsapp,'')))
  returning id into v_id;

  update pro_leads set invoice_id = v_id where id = any(v_ids);

  if exists (select 1 from pro_tarjetas t where t.pro_id = p_pro and t.activa and t.stripe_pm_id is not null) then
    perform oy_push(p_pro, 'Nueva factura ' || v_num,
      'Total ' || replace(to_char(v_base + v_iva, 'FM999990.00'), '.', ',') || ' €. Se cobra ahora en tu tarjeta; te avisamos en cuanto esté pagada.', '/');
  else
    begin v_enlace := oy_enlace_tarjeta(p_pro); exception when others then v_enlace := '/'; end;
    perform oy_push(p_pro, 'Nueva factura ' || v_num,
      'Total ' || replace(to_char(v_base + v_iva, 'FM999990.00'), '.', ',') || ' €. Pagar antes del ' ||
      to_char(v_due at time zone 'Europe/Madrid', 'DD/MM') || '. Toca aquí para pagarla con tarjeta: las próximas se pagarán solas.', v_enlace);
  end if;
  return v_id;
end $function$;

-- 12) Permisos: lo interno solo lo usa la función «cobros» (service_role) o la propia base de datos
revoke all on function public.oy_cobro_reclamar(uuid, text) from public, anon, authenticated;
revoke all on function public.oy_cobro_resultado(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.oy_tarjeta_guardar(uuid, text, text, text, text, int, int, text) from public, anon, authenticated;
revoke all on function public.oy_cobros_para_reintentar() from public, anon, authenticated;
revoke all on function public.oy_cobros_clave() from public, anon, authenticated;
revoke all on function public.oy_cobros_llamar(jsonb) from public, anon, authenticated;
revoke all on function public.lead_invoices_cobro_automatico() from public, anon, authenticated;
grant execute on function public.oy_cobro_reclamar(uuid, text) to service_role;
grant execute on function public.oy_cobro_resultado(uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.oy_tarjeta_guardar(uuid, text, text, text, text, int, int, text) to service_role;
grant execute on function public.oy_cobros_para_reintentar() to service_role;
grant execute on function public.oy_cobros_clave() to service_role;
grant execute on function public.oy_cobros_llamar(jsonb) to service_role;
grant execute on function public.oy_enlace_tarjeta(uuid) to anon, authenticated, service_role;
grant execute on function public.oy_cobro_estado_pro(uuid) to anon, authenticated, service_role;
grant execute on function public.oy_cobro_resumen(text) to anon, authenticated, service_role;

-- 13) Reintento diario (10:07 en Madrid, horario de invierno)
select cron.schedule('cobros-reintentar', '7 9 * * *', $$select public.oy_cobros_llamar('{"accion":"reintentar"}'::jsonb)$$);

-- 14) Clave en Vault para que la base de datos pueda llamar a «cobros» (solo se crea si no existe)
select vault.create_secret(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
                           'cobros_clave', 'OficioYa: clave para que la base de datos llame a la función cobros')
where not exists (select 1 from vault.secrets where name = 'cobros_clave');
