-- ============================================================
-- OficioYa · Anexo «Clientes que no contestan» para los que ya firmaron (11/11/2026; Andrés: «adelante»)
-- Para quien tiene un contrato anterior a la versión 2026-11-11.2 (que ya lo lleva dentro): hoy Cándido,
-- Christian, Marcos y Miguel Ángel. Los anexos salen en la app de uno en uno: primero el de cobro con
-- tarjeta y después este.
-- La app nueva usa oy_anexo_siguiente(p_pro) y oy_anexo_aceptar(p_pro, p_version, p_anexo). Las funciones de
-- antes, oy_anexo_pendiente(p_pro) y oy_anexo_aceptar(p_pro, p_version), se quedan igual para la app que alguien
-- tenga aún cargada: solo conocen el de la tarjeta, así nadie ve este con los textos de la tarjeta.
-- El anexo se activa aparte (anexo_no_contesta_activar), cuando la app nueva y firma-contrato v13 están publicadas.
-- ============================================================

-- 1) ¿Le falta el anexo «no contesta»? Profesional real con precio por lead, sin baja y sin un contrato
--    firmado en una versión que ya lo lleve (2026-11-11.2 o posterior).
create or replace function public.oy_anexo_no_contesta_pendiente(p_pro uuid)
returns public.contrato_anexos_modelo language sql stable security definer set search_path to 'public' as $$
  select am.*
    from public.contrato_anexos_modelo am, public.users u
   where am.anexo = 'no_contesta' and am.activo and u.id = p_pro
     and not coalesce(u.es_prueba, false) and not coalesce(u.deleted, false) and u.baja_at is null
     and coalesce(u.precio_lead, 0) > 0
     and not exists (select 1 from public.pro_contrato_anexos a
                      where a.pro_id = u.id and a.anexo = am.anexo and a.version = am.version)
     and not exists (select 1 from public.firma_solicitudes s
                      where u.captacion_lead_id is not null and s.lead_id = u.captacion_lead_id and s.estado = 'firmado'
                        and coalesce(s.condiciones->>'modelo_version', '') >= '2026-11-11.2')
$$;
revoke all on function public.oy_anexo_no_contesta_pendiente(uuid) from public, anon, authenticated;

-- 2) El siguiente anexo que le toca aceptar (de uno en uno: primero la tarjeta, luego este)
create or replace function public.oy_anexo_siguiente(p_pro uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare am public.contrato_anexos_modelo; v_nombre text;
begin
  if not public.oy_es_yo_o_admin(p_pro) then
    raise exception 'acceso denegado' using errcode = '42501';
  end if;
  select * into am from public.oy_anexo_cobro_tarjeta_pendiente(p_pro);
  if am.anexo is null then
    select * into am from public.oy_anexo_no_contesta_pendiente(p_pro);
  end if;
  if am.anexo is null then return jsonb_build_object('mostrar', false); end if;
  select split_part(btrim(coalesce(u.name, '')), ' ', 1) into v_nombre from public.users u where u.id = p_pro;
  return jsonb_build_object('mostrar', true, 'anexo', am.anexo, 'version', am.version, 'titulo', am.titulo, 'texto', am.texto,
    'nombre', nullif(v_nombre, ''));
end $$;
revoke all on function public.oy_anexo_siguiente(uuid) from public, anon;
grant execute on function public.oy_anexo_siguiente(uuid) to authenticated, service_role;

-- 3) Aceptar el anexo que se le enseña. El tipo va en p_anexo: nunca se acepta uno distinto del que ha leído.
create or replace function public.oy_anexo_aceptar(p_pro uuid, p_version text, p_anexo text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  am public.contrato_anexos_modelo; u public.users; v_hdr json; v_ip text; v_ua text; v_id uuid;
  v_at timestamptz := now(); v_contrato jsonb; v_ficha jsonb; v_clave text; v_que text;
begin
  if auth.uid() is null or auth.uid() <> p_pro then
    raise exception 'acceso denegado' using errcode = '42501';
  end if;
  if p_anexo = 'cobro_tarjeta' then
    select * into am from public.oy_anexo_cobro_tarjeta_pendiente(p_pro);
  elsif p_anexo = 'no_contesta' then
    select * into am from public.oy_anexo_no_contesta_pendiente(p_pro);
  else
    raise exception 'Ese anexo no existe';
  end if;
  if am.anexo is null then
    if exists (select 1 from public.pro_contrato_anexos a where a.pro_id = p_pro and a.anexo = p_anexo and a.version = p_version) then
      return jsonb_build_object('ok', true, 'ya', true, 'anexo', p_anexo);
    end if;
    raise exception 'No tienes ese anexo pendiente';
  end if;
  if am.version is distinct from p_version then raise exception 'El anexo ha cambiado: cierra y vuelve a abrir la app'; end if;
  select * into u from public.users where id = p_pro;

  begin v_hdr := nullif(current_setting('request.headers', true), '')::json; exception when others then v_hdr := null; end;
  v_ip := nullif(coalesce(v_hdr->>'cf-connecting-ip', btrim(split_part(coalesce(v_hdr->>'x-forwarded-for', ''), ',', 1))), '');
  v_ua := left(v_hdr->>'user-agent', 500);

  -- Su contrato: lo firmado con el enlace y los contratos firmados guardados en su ficha de captación
  v_contrato := jsonb_build_object(
    'firmas', coalesce((select jsonb_agg(jsonb_build_object('solicitud', s.id, 'firmado_at', s.firmado_at,
                 'version', s.condiciones->>'modelo_version', 'documento_firmado', s.documento_firmado_id, 'sha256', s.firmado_sha256)
                 order by s.firmado_at)
               from public.firma_solicitudes s where u.captacion_lead_id is not null and s.lead_id = u.captacion_lead_id and s.estado = 'firmado'), '[]'::jsonb),
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'nombre', d.nombre_archivo, 'guardado_at', d.created_at) order by d.created_at)
               from public.captacion_documentos d where u.captacion_lead_id is not null and d.lead_id = u.captacion_lead_id and d.tipo = 'contrato_firmado'), '[]'::jsonb));
  -- Su ficha: cuándo la aceptó y su última aceptación guardada
  v_ficha := jsonb_build_object('aceptada_at', u.ficha_aceptada_at,
    'aceptacion', (select jsonb_build_object('id', a.id, 'at', a.created_at, 'version', a.version)
                     from public.pro_ficha_aceptaciones a where a.pro_id = u.id order by a.created_at desc limit 1));

  begin
    insert into public.pro_contrato_anexos (pro_id, anexo, version, titulo, texto, texto_sha256, aceptado_at, ip, user_agent, contrato, ficha)
    values (u.id, am.anexo, am.version, am.titulo, am.texto, encode(extensions.digest(convert_to(am.texto, 'UTF8'), 'sha256'), 'hex'),
            v_at, v_ip, v_ua, v_contrato, v_ficha)
    returning id into v_id;
  exception when unique_violation then
    return jsonb_build_object('ok', true, 'ya', true, 'anexo', am.anexo);  -- doble pulsación: ya estaba guardado
  end;

  v_que := case am.anexo when 'cobro_tarjeta' then 'el anexo de cobro con tarjeta'
                         when 'no_contesta' then 'el anexo de clientes que no contestan'
                         else 'el anexo «' || am.titulo || '»' end;
  if u.captacion_lead_id is not null then
    insert into public.captacion_eventos (lead_id, autor, tipo, texto)
    values (u.captacion_lead_id, 'sistema', 'documento', 'Ha aceptado en la app ' || v_que || ' (versión ' || am.version || ').');
  end if;

  -- El PDF del anexo aceptado va a Archivos, junto con sus contratos
  select valor into v_clave from public.oy_secretos where clave = 'firma_contrato';
  if v_clave is not null then
    perform net.http_post(
      url := 'https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/firma-contrato',
      body := jsonb_build_object('accion', 'anexo_pdf', 'clave', v_clave, 'id', v_id),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 60000);
  end if;
  return jsonb_build_object('ok', true, 'aceptado_at', v_at, 'anexo', am.anexo);
end $$;
revoke all on function public.oy_anexo_aceptar(uuid, text, text) from public, anon;
grant execute on function public.oy_anexo_aceptar(uuid, text, text) to authenticated;

-- 4) El nombre del PDF en Archivos según el anexo (antes siempre «Anexo cobro con tarjeta»)
create or replace function public.anexo_archivo_registrar(p_id uuid, p_path text, p_tamano bigint, p_sha text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare a public.pro_contrato_anexos; u public.users; v_carpeta text; v_arch uuid; v_nombre text;
begin
  select * into a from public.pro_contrato_anexos where id = p_id for update;
  if not found then raise exception 'No existe ese anexo aceptado'; end if;
  if a.archivo_id is not null then return a.archivo_id; end if;
  select * into u from public.users where id = a.pro_id;
  v_carpeta := 'Profesionales/' || public.archivos_nombre_pro(u.name, u.company_name) || '/Contratos';
  perform public.archivos_carpeta_registrar(v_carpeta);
  v_nombre := case a.anexo when 'cobro_tarjeta' then 'Anexo cobro con tarjeta'
                           when 'no_contesta' then 'Anexo clientes que no contestan'
                           else 'Anexo ' || coalesce(nullif(btrim(replace(split_part(a.titulo, '·', 2), '/', '-')), ''), a.anexo) end;
  insert into public.archivos (carpeta, nombre, storage_path, mime, tamano, sha256, tipo, fecha_doc, notas, pro_id, estado, origen, subido_por, ref)
  values (v_carpeta,
          v_nombre || ' · aceptado el ' || to_char(a.aceptado_at at time zone 'Europe/Madrid', 'DD-MM-YYYY') || '.pdf',
          p_path, 'application/pdf', p_tamano, p_sha, 'contrato', (a.aceptado_at at time zone 'Europe/Madrid')::date,
          'Anexo al contrato aceptado con un clic en la app (versión ' || a.version || '). Las evidencias están en pro_contrato_anexos.',
          a.pro_id, 'ok', 'sistema', 'sistema', 'anexo:' || a.id)
  returning id into v_arch;
  update public.pro_contrato_anexos set archivo_id = v_arch where id = p_id;
  return v_arch;
end $$;

-- 5) Texto del anexo «no contesta»: se añade cómo queda aceptado, igual que en el de la tarjeta.
--    Solo mientras no esté activo ni lo haya aceptado nadie (el texto aceptado se guarda en cada aceptación).
update public.contrato_anexos_modelo
   set texto = texto || E'\n\n5. Aceptación. Este anexo forma parte del contrato desde que el Profesional lo acepta pulsando «Acepto el anexo» en la app de OficioYa. La aceptación queda registrada (fecha y hora, cuenta, IP y navegador) y se guarda junto con su contrato y su ficha.'
 where anexo = 'no_contesta' and version = '2026-11-11' and not activo
   and position('5. Aceptación.' in texto) = 0
   and not exists (select 1 from public.pro_contrato_anexos where anexo = 'no_contesta');
