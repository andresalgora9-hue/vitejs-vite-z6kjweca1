-- ============================================================
-- OficioYa · Seguimiento automático de facturas vencidas (08/11/2026 · Claude)
-- Cron «recordatorio-facturas-pendientes» (todos los días a las 9:00 UTC = 10:00 en Madrid en invierno):
--  1) Facturas de leads vencidas y sin pagar (o en la lista manual mkt_config.recordatorio_facturas):
--     recordatorio diario al profesional y, si aún no la tenía, empieza sola la cuenta atrás de leads
--     (impago_leads_margen, 2) en pro_bloqueo_impago + aviso al admin. oy_route_pro deja de pasarle leads al llegar al límite.
--  2) Las que vencen mañana y hay que pagar a mano (sin tarjeta guardada o con el cobro fallido): aviso de «vence mañana».
--  No se avisa de las que el profesional dice que ya pagó (aviso_pago) ni de las que se están cobrando en la tarjeta,
--  ni a profesionales de prueba o borrados. La cuenta atrás se quita sola al pagarse (lead_invoices_quitar_bloqueo).
--  Excepciones: lead_invoices.prorroga_hasta (p. ej., Cándido OY2026-0002 hasta el miércoles 11/11/2026): hasta esa
--  fecha no se le recuerda la factura ni empieza la cuenta atrás; si después sigue sin pagar, todo vuelve a ir solo.
-- ============================================================
alter table public.lead_invoices add column if not exists prorroga_hasta timestamptz;
comment on column public.lead_invoices.prorroga_hasta is 'Excepción acordada con el profesional: hasta esta fecha no se le recuerda la factura ni empieza la cuenta atrás por impago.';

create or replace function public.oy_recordatorio_facturas()
returns integer language plpgsql security definer set search_path to 'public' as $function$
declare
  r record; n int := 0; lista text[]; e jsonb; v_quedan int; v_nuevo boolean; v_cuenta text; v_leads text;
  v_lim int := coalesce(oy_cfg('impago_leads_margen'), 2)::int;
  v_admin constant uuid := '00000000-0000-0000-0000-000000000002';
  v_manana date := (now() at time zone 'Europe/Madrid')::date + 1;
begin
  if coalesce((select valor from mkt_config where clave = 'avisos_pros_modo'), '') <> 'real' then
    return 0;
  end if;
  select string_to_array(replace(valor, ' ', ''), ',') into lista from mkt_config where clave = 'recordatorio_facturas';
  lista := coalesce(lista, '{}'::text[]);

  -- 1) Vencidas (o en la lista manual): recordatorio diario + cuenta atrás automática
  for r in
    select i.id, i.number, i.pro_id, i.total, i.issued_at, i.due_at, u.name
      from lead_invoices i
      join users u on u.id = i.pro_id
     where i.status = 'pendiente'
       and coalesce(i.tipo, 'leads') = 'leads'
       and coalesce(i.cobro_estado, '') not in ('aviso_pago', 'cobrando', 'procesando')
       and not coalesce(u.es_prueba, false) and not coalesce(u.deleted, false)
       and (i.due_at < now() or i.number = any(lista))
       and (i.prorroga_hasta is null or i.prorroga_hasta < now())  -- excepción acordada (prórroga)
     order by i.pro_id, i.issued_at
  loop
    v_nuevo := false;
    if r.due_at < now() then
      insert into pro_bloqueo_impago (pro_id, desde, limite, motivo)
      values (r.pro_id, now(), v_lim, r.number || ' vencida ' || to_char(r.due_at at time zone 'Europe/Madrid', 'DD/MM') || ' (automático)')
      on conflict (pro_id) do nothing;
      v_nuevo := found;
    end if;
    e := oy_impago_estado(r.pro_id);
    v_quedan := greatest(coalesce((e->>'limite')::int, v_lim) - coalesce((e->>'usados')::int, 0), 0);
    v_cuenta := case when not coalesce((e->>'activo')::boolean, false) then ''
                     when coalesce((e->>'bloqueado')::boolean, false) then ' La entrada de clientes está parada hasta que la pagues.'
                     else ' Te ' || case when v_quedan = 1 then 'queda 1 lead' else 'quedan ' || v_quedan || ' leads' end
                          || ' antes de que se pare la entrada de clientes.' end;
    -- Si la factura tiene pocos clientes, se nombran (así recuerda de qué es)
    select case when count(*) between 1 and 3 then
             string_agg(initcap(coalesce(nullif(btrim(l.client_name), ''), 'un cliente')) || ' el ' ||
                        to_char(l.created_at at time zone 'Europe/Madrid', 'DD/MM'), ', ' order by l.created_at) end
      into v_leads from pro_leads l where l.invoice_id = r.id;

    perform oy_push(r.pro_id,
      case when v_nuevo then '⚠️ Factura ' || r.number || ' vencida' else 'Factura ' || r.number || ' pendiente de pago' end,
      'Hola ' || split_part(coalesce(r.name, ''), ' ', 1) || ': ' ||
      coalesce('te llegó el cliente ' || v_leads || '. Va en tu factura ', 'tu factura ') || r.number || ' del ' ||
      to_char(r.issued_at at time zone 'Europe/Madrid', 'DD/MM') || ' (' || replace(to_char(r.total, 'FM999990.00'), '.', ',') || ' €)' ||
      case when r.due_at > now() then ', que vence el ' || to_char(r.due_at at time zone 'Europe/Madrid', 'DD/MM') || '.'
           else ', que venció el ' || to_char(r.due_at at time zone 'Europe/Madrid', 'DD/MM') || ' y sigue sin pagar.' end ||
      v_cuenta || ' Págala desde Facturas: transferencia, Bizum o tarjeta.',
      '/?ir=facturas');
    n := n + 1;

    if v_nuevo then
      perform oy_push(v_admin, '⏳ Cuenta atrás por impago — ' || coalesce(nullif(btrim(r.name), ''), 'Profesional'),
        r.number || ' · ' || replace(to_char(r.total, 'FM999990.00'), '.', ',') || ' € · venció el ' ||
        to_char(r.due_at at time zone 'Europe/Madrid', 'DD/MM') || ' · ' ||
        case when v_quedan = 1 then 'le queda 1 lead' when v_quedan > 1 then 'le quedan ' || v_quedan || ' leads' else 'ya no recibe leads' end,
        '/?panel=profesionales');
    end if;
  end loop;

  -- 2) Vencen mañana y hay que pagarlas a mano
  for r in
    select i.number, i.pro_id, i.total
      from lead_invoices i
      join users u on u.id = i.pro_id
     where i.status = 'pendiente'
       and coalesce(i.tipo, 'leads') = 'leads'
       and (i.due_at at time zone 'Europe/Madrid')::date = v_manana
       and not (i.number = any(lista))
       and (i.prorroga_hasta is null or i.prorroga_hasta < now())
       and not coalesce(u.es_prueba, false) and not coalesce(u.deleted, false)
       and coalesce(i.cobro_estado, '') not in ('aviso_pago', 'cobrando', 'procesando')
       and (coalesce(i.cobro_estado, '') in ('rechazada', 'error')
            or not exists (select 1 from pro_tarjetas t where t.pro_id = i.pro_id and t.activa and t.stripe_pm_id is not null))
  loop
    perform oy_push(r.pro_id, 'Tu factura ' || r.number || ' vence mañana',
      replace(to_char(r.total, 'FM999990.00'), '.', ',') || ' €. Págala desde Facturas por transferencia o Bizum, o guarda tu tarjeta y se pagará sola.',
      '/?ir=facturas');
    n := n + 1;
  end loop;
  return n;
end
$function$;

revoke all on function public.oy_recordatorio_facturas() from public, anon, authenticated;
grant execute on function public.oy_recordatorio_facturas() to service_role;
