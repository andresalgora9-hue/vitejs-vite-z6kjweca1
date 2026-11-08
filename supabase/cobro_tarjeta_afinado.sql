-- ============================================================
-- OficioYa · Cobro automático con tarjeta — afinado (07/11/2026 · Claude)
--  · «Ya he pagado»: el profesional avisa desde Facturas de que ha pagado por transferencia o Bizum
--    → la factura queda «aviso_pago», no se vuelve a intentar en la tarjeta (sin cobros dobles) y se avisa al admin.
--  · Los cobros que fallaron por un error nuestro o de Stripe («error») también se reintentan (máx. 3 intentos).
--  · No se reintentan los cobros que el banco quiere confirmar (authentication_required / requires_action).
--  · La cuenta atrás se quita cuando no queda ninguna factura vencida ni con cobro rechazado
--    (antes hacía falta no tener ninguna pendiente, aunque no hubiera vencido).
--  · Los avisos llevan directos a Facturas (/?ir=facturas) y los del admin a su sección (/?panel=...).
-- ============================================================

-- 1) Nuevo estado del cobro: aviso_pago
alter table public.lead_invoices drop constraint if exists lead_invoices_cobro_estado_chk;
alter table public.lead_invoices add constraint lead_invoices_cobro_estado_chk check (cobro_estado is null or cobro_estado = any (
  array['sin_tarjeta', 'pendiente_cobro', 'cobrando', 'cobrada', 'rechazada', 'procesando', 'error', 'aviso_pago']));

-- 2) Reclamar una factura para cobrarla
create or replace function public.oy_cobro_reclamar(p_factura uuid, p_origen text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare f record; t record; v_previo text; v_atascada boolean; v_intento int;
begin
  select * into f from lead_invoices where id = p_factura for update;
  if f.id is null or f.status <> 'pendiente' or coalesce(f.tipo, 'leads') <> 'leads' then return null; end if;
  v_previo := f.cobro_estado;
  v_atascada := v_previo = 'cobrando' and f.cobro_ultimo_at < now() - interval '15 minutes';
  -- aviso_pago: el profesional dice que ya la ha pagado a mano → nunca se cobra en la tarjeta
  if v_previo in ('cobrada', 'procesando', 'aviso_pago') or (v_previo = 'cobrando' and not v_atascada) then return null; end if;
  if not v_atascada then
    if p_origen = 'emision' and coalesce(v_previo, 'pendiente_cobro') <> 'pendiente_cobro' then return null; end if;
    if p_origen = 'reintento' and not (
         coalesce(v_previo, 'pendiente_cobro') = 'pendiente_cobro'
      or v_previo = 'sin_tarjeta'
      or (v_previo in ('rechazada', 'error') and coalesce(f.cobro_intentos, 0) < 3 and f.cobro_ultimo_at < now() - interval '20 hours')) then
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

-- 3) Resultado del cobro (igual que antes; los avisos llevan a Facturas)
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
      || '. No tienes que hacer nada más.', '/?ir=facturas');
    perform oy_push(v_admin, '💶 Cobrada con tarjeta — ' || v_nombre, f.number || ' · ' || v_total, '/?panel=facturas');
    return jsonb_build_object('estado', 'cobrada');
  end if;

  if p_estado = 'procesando' then
    update lead_invoices set cobro_estado = 'procesando', stripe_pi_id = coalesce(p_pi, stripe_pi_id) where id = f.id;
    return jsonb_build_object('estado', 'procesando');
  end if;

  if p_estado = 'error' then
    -- Error nuestro o de Stripe (no de la tarjeta): sin cuenta atrás; aviso solo al admin; se reintenta al día siguiente
    update lead_invoices set cobro_estado = 'error', cobro_error = left(coalesce(p_detalle, p_mensaje), 300),
           stripe_pi_id = coalesce(p_pi, stripe_pi_id) where id = f.id;
    perform oy_push(v_admin, '🛠 No se pudo intentar el cobro — ' || v_nombre,
      f.number || ' · ' || v_total || ' · ' || left(coalesce(p_detalle, p_mensaje, 'error desconocido'), 120), '/?panel=facturas');
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
  begin v_enlace := oy_enlace_tarjeta(f.pro_id); exception when others then v_enlace := '/?ir=facturas'; end;

  perform oy_push(f.pro_id, '⚠️ No hemos podido cobrar tu factura ' || f.number,
    'No se han podido cobrar ' || v_total || ' en tu tarjeta: ' || coalesce(p_mensaje, 'el banco lo ha rechazado') || '. '
    || 'Toca aquí para poner otra tarjeta, o págala por transferencia o Bizum desde Facturas. '
    || case when v_quedan > 0 then 'Te quedan ' || v_quedan || case when v_quedan = 1 then ' lead' else ' leads' end
            || ' antes de que se pare la entrada de clientes.'
            else 'La entrada de clientes está parada hasta que se pague.' end,
    v_enlace);
  perform oy_push(v_admin, '🔴 Cobro fallido — ' || v_nombre,
    f.number || ' · ' || v_total || ' · ' || coalesce(p_mensaje, p_codigo, 'rechazado') || ' · '
    || case when v_quedan = 1 then 'queda 1 lead para cortarle'
            when v_quedan > 1 then 'quedan ' || v_quedan || ' leads para cortarle' else 'ya no recibe leads' end, '/?panel=profesionales');
  return jsonb_build_object('estado', 'rechazada', 'quedan', v_quedan);
end $$;

-- 4) Tarjeta guardada: no se cobra lo que el profesional dice que ya ha pagado
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
     and coalesce(cobro_estado, '') not in ('cobrando', 'cobrada', 'procesando', 'aviso_pago');
  v_n := coalesce(array_length(v_pend, 1), 0);

  if v_previa is distinct from p_pm then
    select coalesce(nullif(btrim(name), ''), 'Profesional') into v_nombre from users where id = p_pro;
    perform oy_push('00000000-0000-0000-0000-000000000002', '💳 ' || v_nombre || ' ha guardado su tarjeta',
      coalesce(initcap(p_marca), 'Tarjeta') || ' •••• ' || coalesce(p_ultimos4, '????')
      || case when v_n = 1 then ' · tenía 1 factura pendiente: se cobra ahora'
              when v_n > 1 then ' · tenía ' || v_n || ' facturas pendientes: se cobran ahora' else '' end, '/?panel=profesionales');
    if v_n = 0 then
      perform oy_push(p_pro, '✅ Tarjeta guardada',
        'Desde ahora tus facturas se pagan solas con tu ' || coalesce(initcap(p_marca), 'tarjeta') || coalesce(' •••• ' || p_ultimos4, '')
        || '. Ya no tienes que hacer transferencias.', '/?ir=facturas');
    end if;
  end if;
  return jsonb_build_object('pendientes', coalesce(to_jsonb(v_pend), '[]'::jsonb));
end $$;

-- 5) Candidatas del reintento diario: también las que fallaron por un error nuestro o de Stripe
create or replace function public.oy_cobros_para_reintentar()
returns table (factura uuid, estado text, pi text) language sql security definer set search_path = public as $$
  select f.id, f.cobro_estado, f.stripe_pi_id
    from lead_invoices f
   where f.status = 'pendiente' and coalesce(f.tipo, 'leads') = 'leads'
     and (
          (coalesce(f.cobro_estado, 'pendiente_cobro') = 'pendiente_cobro' and f.issued_at < now() - interval '10 minutes')
       or (f.cobro_estado = 'sin_tarjeta'
           and exists (select 1 from pro_tarjetas t where t.pro_id = f.pro_id and t.activa and t.stripe_pm_id is not null))
       or (f.cobro_estado in ('rechazada', 'error') and coalesce(f.cobro_intentos, 0) < 3 and f.cobro_ultimo_at < now() - interval '20 hours'
           and coalesce((select c.codigo from cobros_intentos c where c.invoice_id = f.id order by c.created_at desc, c.id desc limit 1), '')
               not in ('authentication_required', 'requires_action'))
       or (f.cobro_estado = 'cobrando' and f.cobro_ultimo_at < now() - interval '15 minutes')
       or (f.cobro_estado = 'procesando' and f.stripe_pi_id is not null))
   order by f.issued_at
$$;

-- 6) «Ya he pagado»: el profesional avisa de que ha pagado por transferencia o Bizum
create or replace function public.oy_factura_aviso_pago(p_pro uuid, p_facturas uuid[], p_metodo text)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int; v_nums text; v_total numeric; v_nombre text; v_met text;
begin
  v_met := case when p_metodo = 'bizum' then 'Bizum' else 'transferencia' end;
  with u as (
    update lead_invoices
       set cobro_estado = 'aviso_pago', cobro_ultimo_at = now(),
           cobro_error = 'Dice que la ha pagado por ' || v_met
     where pro_id = p_pro and id = any(p_facturas) and status = 'pendiente'
       and coalesce(cobro_estado, '') not in ('cobrando', 'cobrada', 'procesando', 'aviso_pago')
    returning number, total)
  select count(*), string_agg(number, ', ' order by number), sum(total) into v_n, v_nums, v_total from u;
  if v_n > 0 then
    select coalesce(nullif(btrim(name), ''), 'Un profesional') into v_nombre from users where id = p_pro;
    perform oy_push('00000000-0000-0000-0000-000000000002', '📎 ' || v_nombre || ' dice que ha pagado',
      v_nums || ' · ' || replace(to_char(v_total, 'FM999990.00'), '.', ',') || ' € por ' || v_met
      || '. Cuando lo veas en el banco, márcala pagada en Facturas.', '/?panel=facturas');
  end if;
  return v_n;
end $$;

-- 7) Aviso de factura nueva con tarjeta: lleva a Facturas
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
      'Total ' || replace(to_char(v_base + v_iva, 'FM999990.00'), '.', ',') || ' €. Se cobra ahora en tu tarjeta; te avisamos en cuanto esté pagada.', '/?ir=facturas');
  else
    begin v_enlace := oy_enlace_tarjeta(p_pro); exception when others then v_enlace := '/?ir=facturas'; end;
    perform oy_push(p_pro, 'Nueva factura ' || v_num,
      'Total ' || replace(to_char(v_base + v_iva, 'FM999990.00'), '.', ',') || ' €. Pagar antes del ' ||
      to_char(v_due at time zone 'Europe/Madrid', 'DD/MM') || '. Toca aquí para pagarla con tarjeta: las próximas se pagarán solas.', v_enlace);
  end if;
  return v_id;
end $function$;

-- 8) Quitar la cuenta atrás cuando ya no queda nada vencido ni rechazado
create or replace function public.lead_invoices_quitar_bloqueo()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if new.status in ('pagada','anulada') and old.status is distinct from new.status
     and not exists (select 1 from lead_invoices
                      where pro_id = new.pro_id and status = 'pendiente'
                        and (due_at < now() or cobro_estado = 'rechazada')) then
    delete from pro_bloqueo_impago where pro_id = new.pro_id;
  end if;
  return new;
end $function$;

-- 9) Avisos de la cuenta atrás y recordatorio de facturas: que lleven directos a Facturas (solo cambia el enlace)
do $do$
declare d text; n text;
begin
  d := pg_get_functiondef('public.pro_leads_aviso_impago'::regproc);
  n := replace(d, ', ''/'');', ', ''/?ir=facturas'');');
  if n <> d then execute n; end if;
  d := pg_get_functiondef('public.oy_recordatorio_facturas'::regproc);
  n := replace(d, '''/'');', '''/?ir=facturas'');');
  if n <> d then execute n; end if;
end $do$;

-- 10) Permisos
revoke all on function public.oy_cobro_reclamar(uuid, text) from public, anon, authenticated;
revoke all on function public.oy_cobro_resultado(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.oy_tarjeta_guardar(uuid, text, text, text, text, int, int, text) from public, anon, authenticated;
revoke all on function public.oy_cobros_para_reintentar() from public, anon, authenticated;
revoke all on function public.oy_factura_aviso_pago(uuid, uuid[], text) from public;
grant execute on function public.oy_cobro_reclamar(uuid, text) to service_role;
grant execute on function public.oy_cobro_resultado(uuid, text, text, text, text, text, text) to service_role;
grant execute on function public.oy_tarjeta_guardar(uuid, text, text, text, text, int, int, text) to service_role;
grant execute on function public.oy_cobros_para_reintentar() to service_role;
grant execute on function public.oy_factura_aviso_pago(uuid, uuid[], text) to anon, authenticated, service_role;

-- 11) Enlace de la tarjeta con dominio propio (se aplicó después de comprobar el rewrite de vercel.json)
--     https://www.aficioya.com/tarjeta/TOKEN → función «cobros» (?t=TOKEN). Los enlaces antiguos de supabase.co siguen valiendo.
create or replace function public.oy_enlace_tarjeta(p_pro uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_tok text;
begin
  if not exists (select 1 from users where id = p_pro and type = 'profesional') then
    raise exception 'Profesional no encontrado';
  end if;
  -- Solo escribe si aún no tiene enlace (antes actualizaba la fila en cada consulta)
  select enlace_token into v_tok from pro_tarjetas where pro_id = p_pro;
  if v_tok is null then
    insert into pro_tarjetas (pro_id, enlace_token)
    values (p_pro, replace(gen_random_uuid()::text, '-', ''))
    on conflict (pro_id) do update set enlace_token = coalesce(pro_tarjetas.enlace_token, excluded.enlace_token)
    returning enlace_token into v_tok;
  end if;
  -- Enlace con dominio propio (vercel.json reenvía /tarjeta/TOKEN a la función «cobros»)
  return 'https://www.aficioya.com/tarjeta/' || v_tok;
end $$;
grant execute on function public.oy_enlace_tarjeta(uuid) to anon, authenticated, service_role;
