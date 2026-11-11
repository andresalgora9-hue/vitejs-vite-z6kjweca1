-- ============================================================
-- OficioYa · App del profesional: ventanas al entrar (11/11/2026)
--  1. «Falta actualizar este cliente»: los clientes que el profesional no ha movido de etapa.
--  2. «Activa los avisos» (solo necesita saber si tiene avisos guardados en algún dispositivo).
--  3. «Guarda tu tarjeta»: sin tarjeta, tarjeta caducada o un cobro que ha fallado.
-- Solo para profesionales de pago por lead (con precio por lead, activación o leads) que no estén de baja.
-- Las reglas de qué clientes hay que actualizar están aquí (no en la web), para poder cambiarlas sin publicar.
-- ============================================================

alter table public.pro_leads add column if not exists etapa_revisada_at timestamptz;
comment on column public.pro_leads.etapa_revisada_at is
  'Última vez que el profesional confirmó la etapa del cliente en la ventana «Falta actualizar este cliente» de su app.';

-- ── Qué tiene que ver el profesional al entrar ─────────────────────────────
create or replace function public.oy_pro_al_entrar(p_pro uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  u record;
  v_total int := 0;
  v_lista jsonb := '[]'::jsonb;
  v_cobro jsonb;
  v_tarjeta jsonb;
  v_falta text;
  v_anio int;
  v_mes int;
  v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
  if not public.oy_es_yo_o_admin(p_pro) then
    raise exception 'acceso denegado' using errcode = '42501';
  end if;

  select x.id, x.type, x.baja_at, coalesce(x.deleted, false) as borrado, coalesce(x.banned, false) as bloqueado,
         (x.precio_lead is not null or x.activacion_estado is not null
           or exists (select 1 from pro_leads pl where pl.pro_id = x.id)) as pago_lead
    into u
  from users x where x.id = p_pro;

  if u.id is null or u.type <> 'profesional' or u.borrado or u.bloqueado or u.baja_at is not null or not u.pago_lead then
    return jsonb_build_object('activo', false);
  end if;

  -- Clientes por actualizar (de más antiguo a más nuevo; la app enseña 5 cada vez que entra):
  --  · Nuevo desde hace más de 1 hora (si dice «Todavía no he hablado con él», se le vuelve a preguntar a las 3 horas)
  --  · Contactado sin cambios desde hace más de 3 días
  --  · Presupuesto enviado sin cambios desde hace más de 5 días
  --  · Ganado sin importe del trabajo
  with pend as (
    select l.id, l.created_at, l.estado, l.estado_at, l.canal, l.trade, l.client_name, l.client_phone,
           l.zona, l.descripcion, l.presupuesto_eur,
           case when l.estado = 'ganado' then 'importe' else 'etapa' end as falta
    from pro_leads l
    where l.pro_id = p_pro and not l.anulado
      and (
        (l.estado = 'nuevo' and l.created_at < now() - interval '1 hour'
          and (l.etapa_revisada_at is null or l.etapa_revisada_at < now() - interval '3 hours'))
        or (l.estado = 'contactado'
          and greatest(l.estado_at, coalesce(l.etapa_revisada_at, l.estado_at)) < now() - interval '3 days')
        or (l.estado = 'presupuesto'
          and greatest(l.estado_at, coalesce(l.etapa_revisada_at, l.estado_at)) < now() - interval '5 days')
        or (l.estado = 'ganado' and coalesce(l.presupuesto_eur, 0) <= 0)
      )
  )
  select count(*)::int,
         coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at)
                   from (select * from pend order by created_at limit 5) p), '[]'::jsonb)
    into v_total, v_lista
  from pend;

  -- Tarjeta para el cobro automático de sus facturas
  begin
    v_cobro := public.oy_cobro_estado_pro__interna(p_pro);
    v_tarjeta := v_cobro -> 'tarjeta';
    if jsonb_array_length(coalesce(v_cobro -> 'fallidas', '[]'::jsonb)) > 0 then
      v_falta := 'cobro_fallido';
    elsif v_tarjeta is null or jsonb_typeof(v_tarjeta) = 'null' then
      v_falta := 'sin_tarjeta';
    else
      v_anio := nullif(v_tarjeta ->> 'caduca_anio', '')::int;
      v_mes := nullif(v_tarjeta ->> 'caduca_mes', '')::int;
      if v_anio is not null and v_anio < 100 then v_anio := 2000 + v_anio; end if;
      if v_anio is not null and v_mes is not null
         and (v_anio < extract(year from v_hoy)::int
              or (v_anio = extract(year from v_hoy)::int and v_mes < extract(month from v_hoy)::int)) then
        v_falta := 'caducada';
      end if;
    end if;
  exception when others then
    v_cobro := null; v_tarjeta := null; v_falta := null;
  end;

  return jsonb_build_object(
    'activo', true,
    'leads', jsonb_build_object('total', v_total, 'lista', v_lista),
    'tarjeta', jsonb_build_object(
      'falta', v_falta,
      'enlace', v_cobro ->> 'enlace',
      'tarjeta', case when jsonb_typeof(v_tarjeta) = 'object' then v_tarjeta end,
      'fallidas', coalesce(v_cobro -> 'fallidas', '[]'::jsonb),
      'impago', coalesce(v_cobro -> 'impago', '{}'::jsonb)),
    'push_guardado', exists (select 1 from push_subscriptions s where s.user_id = p_pro)
  );
end $function$;

-- ── Guarda la etapa que elige el profesional en la ventana ─────────────────
-- p_estado: contactado · presupuesto · ganado (con p_importe, el importe aproximado) · perdido (con p_motivo)
--           · sin_hablar (solo si sigue en «Nuevo»: no cambia nada, se le vuelve a preguntar a las 3 horas)
create or replace function public.oy_lead_etapa(p_lead uuid, p_estado text, p_importe numeric default null, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare l record;
begin
  select id, pro_id, estado, anulado into l from pro_leads where id = p_lead for update;
  if l.id is null then
    raise exception 'Cliente no encontrado' using errcode = 'P0002';
  end if;
  if not public.oy_es_yo_o_admin(l.pro_id) then
    raise exception 'acceso denegado' using errcode = '42501';
  end if;
  if p_estado is null or p_estado not in ('contactado', 'presupuesto', 'ganado', 'perdido', 'sin_hablar') then
    raise exception 'Etapa no válida' using errcode = '22023';
  end if;
  if p_estado = 'sin_hablar' and l.estado <> 'nuevo' then
    raise exception 'Etapa no válida' using errcode = '22023';
  end if;
  if p_importe is not null and (p_importe < 0 or p_importe > 1000000) then
    raise exception 'Importe no válido' using errcode = '22023';
  end if;
  if p_estado = 'ganado' and coalesce(p_importe, 0) <= 0 then
    raise exception 'Falta el importe del trabajo' using errcode = '22023';
  end if;
  if p_estado = 'perdido' and (p_motivo is null or p_motivo not in
      ('no_contesta', 'caro', 'otro_profesional', 'ya_no_lo_necesita', 'fuera_de_zona', 'no_puedo_atenderlo', 'otros')) then
    raise exception 'Falta el motivo' using errcode = '22023';
  end if;

  update pro_leads set
    estado = case when p_estado = 'sin_hablar' then estado else p_estado end,
    motivo_perdido = case p_estado when 'perdido' then p_motivo when 'sin_hablar' then motivo_perdido else null end,
    presupuesto_eur = case when p_estado in ('ganado', 'presupuesto') and p_importe is not null
                           then round(p_importe, 2) else presupuesto_eur end,
    etapa_revisada_at = now()
  where id = p_lead;

  return jsonb_build_object('ok', true, 'estado', case when p_estado = 'sin_hablar' then l.estado else p_estado end);
end $function$;

-- Solo con sesión (el profesional, el admin) o desde el servidor
revoke all on function public.oy_pro_al_entrar(uuid) from public, anon;
grant execute on function public.oy_pro_al_entrar(uuid) to authenticated, service_role;
revoke all on function public.oy_lead_etapa(uuid, text, numeric, text) from public, anon;
grant execute on function public.oy_lead_etapa(uuid, text, numeric, text) to authenticated, service_role;
