-- ============================================================
-- OficioYa · Condiciones de la web del profesional (11/11/2026, Claude; lo pide Andrés)
-- Al terminar la guía del Perfil, el profesional acepta las condiciones de su web:
-- 15 € + IVA por cada cliente que le llegue por ella (origen «web-pro»).
--
-- Se guarda todo como prueba, por si algún día hay un problema:
--   · pro_condiciones_modelo: el texto exacto de cada versión, con su huella SHA-256 (no se puede cambiar).
--   · pro_condiciones_aceptaciones: quién, cuándo (hora del servidor), IP, navegador, dispositivo, sesión,
--     sus datos en ese momento, la versión y la huella del texto, y una huella de todo el registro encadenada
--     con la anterior. No se puede cambiar ni borrar.
--   · Un PDF justificante con sello de tiempo RFC 3161 (DigiCert) en Admin → Archivos
--     (Profesionales/<Nombre · Empresa>/Contratos), con el texto, el registro y el sello dentro.
--     Lo hace la Edge Function «condiciones-web» (la llama la base al aceptar y el cron si falló),
--     que además le manda una copia al profesional por email.
--
-- Decisión de Andrés (11/11, tarde): sin aceptarlas, los clientes de su web le llegan igual, pero a su
-- precio normal. Eso ya lo hace pro_leads_precio_pro (migración web_pro_15_solo_con_condiciones), que pone
-- los 15 € solo si oy_condiciones_web_aceptadas(pro) da verdadero. Aquí no se toca nada de los leads.
-- Solo crea tablas y funciones nuevas: no cambia nada de lo que ya funciona.
-- ============================================================

-- 1) Textos de las condiciones (cada versión es fija; para cambiar algo se publica otra versión)
create table if not exists public.pro_condiciones_modelo (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo ~ '^[a-z_]+$'),
  version text not null,
  titulo text not null,
  resumen jsonb not null default '[]'::jsonb,   -- puntos clave que se enseñan en la app
  texto text not null,                           -- texto íntegro
  sha256 text not null,                          -- SHA-256 (hex) del texto en UTF-8
  precio numeric(10,2),                          -- base, sin IVA
  iva_pct numeric(5,2) not null default 21,
  vigente boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tipo, version)
);
create unique index if not exists pro_condiciones_modelo_vigente on public.pro_condiciones_modelo (tipo) where vigente;
alter table public.pro_condiciones_modelo enable row level security;

-- 2) Aceptaciones (la prueba)
create table if not exists public.pro_condiciones_aceptaciones (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null,                          -- sin FK: la prueba tiene que sobrevivir aunque se borre la cuenta
  modelo_id uuid not null references public.pro_condiciones_modelo(id),
  tipo text not null,
  version text not null,
  texto_sha256 text not null,
  precio numeric(10,2),
  iva_pct numeric(5,2),
  aceptado_at timestamptz not null default now(),  -- hora del servidor
  origen text not null,                          -- guia_perfil, guia_perfil_omitida, perfil, mi_web, contrato, falta
  ip text,
  user_agent text,
  dispositivo jsonb not null default '{}'::jsonb,  -- lo que manda la app: navegador, idioma, zona horaria, pantalla…
  sesion jsonb not null default '{}'::jsonb,       -- de su sesión: usuario de Auth, id de sesión, rol…
  cuenta jsonb not null,                           -- sus datos en ese momento (nombre, NIF, email, teléfono…)
  hash_anterior text,                              -- huella de la aceptación anterior (cadena)
  hash text not null,                              -- SHA-256 del registro (oy_condiciones_registro)
  -- Lo rellena el archivado (Edge Function condiciones-web). Es lo único que se puede cambiar.
  archivo_id uuid,
  pdf_sha256 text,
  sello jsonb,                                     -- {tsa, hash, fecha, token} como en la firma electrónica
  archivo_at timestamptz,
  archivo_intentos int not null default 0,
  archivo_error text,
  email_enviado_at timestamptz,
  email_intentos int not null default 0,
  email_error text,
  unique (pro_id, modelo_id)
);
create index if not exists pro_condiciones_aceptaciones_pro on public.pro_condiciones_aceptaciones (pro_id, aceptado_at desc);
create index if not exists pro_condiciones_aceptaciones_orden on public.pro_condiciones_aceptaciones (aceptado_at desc, id desc);
alter table public.pro_condiciones_aceptaciones enable row level security;
revoke all on public.pro_condiciones_modelo, public.pro_condiciones_aceptaciones from anon, authenticated;
grant select on public.pro_condiciones_modelo to service_role;                  -- la Edge Function lee el texto
grant select, update on public.pro_condiciones_aceptaciones to service_role;    -- y apunta el justificante

-- 3) Ni los textos publicados ni las aceptaciones se pueden cambiar o borrar.
--    (Solo a propósito desde el editor SQL: set local oy.condiciones_permitir = 'si';)
create or replace function public.pro_condiciones_inmutable()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if coalesce(current_setting('oy.condiciones_permitir', true), '') = 'si' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'No se puede borrar: es la prueba de lo que aceptó el profesional';
  end if;
  if tg_table_name = 'pro_condiciones_aceptaciones' then
    if (new.id, new.pro_id, new.modelo_id, new.tipo, new.version, new.texto_sha256, new.precio, new.iva_pct,
        new.aceptado_at, new.origen, new.ip, new.user_agent, new.dispositivo, new.sesion, new.cuenta,
        new.hash_anterior, new.hash)
       is distinct from
       (old.id, old.pro_id, old.modelo_id, old.tipo, old.version, old.texto_sha256, old.precio, old.iva_pct,
        old.aceptado_at, old.origen, old.ip, old.user_agent, old.dispositivo, old.sesion, old.cuenta,
        old.hash_anterior, old.hash) then
      raise exception 'Los datos de una aceptación no se pueden cambiar';
    end if;
  else
    if (new.id, new.tipo, new.version, new.titulo, new.resumen, new.texto, new.sha256, new.precio, new.iva_pct, new.created_at)
       is distinct from
       (old.id, old.tipo, old.version, old.titulo, old.resumen, old.texto, old.sha256, old.precio, old.iva_pct, old.created_at) then
      raise exception 'Unas condiciones publicadas no se pueden cambiar: publica una versión nueva';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists a_inmutable on public.pro_condiciones_modelo;
create trigger a_inmutable before update or delete on public.pro_condiciones_modelo
  for each row execute function public.pro_condiciones_inmutable();
drop trigger if exists a_inmutable on public.pro_condiciones_aceptaciones;
create trigger a_inmutable before update or delete on public.pro_condiciones_aceptaciones
  for each row execute function public.pro_condiciones_inmutable();

-- 4) Registro que se firma con la huella (el mismo texto va dentro del PDF como «registro.txt»)
create or replace function public.oy_condiciones_registro(
  p_id uuid, p_pro uuid, p_modelo uuid, p_version text, p_texto_sha text, p_precio numeric, p_iva numeric,
  p_at timestamptz, p_origen text, p_ip text, p_ua text, p_disp jsonb, p_sesion jsonb, p_cuenta jsonb, p_prev text)
returns text language sql stable set search_path to 'public' as $$
  select concat_ws(E'\n',
    'OficioYa - aceptacion de condiciones - registro v1',
    'id=' || p_id::text,
    'profesional=' || p_pro::text,
    'modelo=' || p_modelo::text,
    'version=' || coalesce(p_version, ''),
    'texto_sha256=' || coalesce(p_texto_sha, ''),
    'precio=' || coalesce(p_precio::text, ''),
    'iva_pct=' || coalesce(p_iva::text, ''),
    'aceptado_utc=' || to_char(p_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'origen=' || coalesce(p_origen, ''),
    'ip=' || coalesce(p_ip, ''),
    'user_agent=' || coalesce(p_ua, ''),
    'dispositivo=' || coalesce(p_disp::text, '{}'),
    'sesion=' || coalesce(p_sesion::text, '{}'),
    'cuenta=' || coalesce(p_cuenta::text, '{}'),
    'anterior=' || coalesce(p_prev, ''))
$$;
revoke all on function public.oy_condiciones_registro(uuid, uuid, uuid, text, text, numeric, numeric, timestamptz, text, text, text, jsonb, jsonb, jsonb, text) from public, anon, authenticated;

-- 5) ¿Tiene aceptadas las condiciones vigentes de su web, con el precio que se cobra ahora?
--    La usa pro_leads_precio_pro: solo con esto a verdadero el cliente de su web cuesta 15 €; si no, su precio normal.
--    Si alguien cambia oy_config.precio_lead_web_pro sin publicar otra versión, nadie cuenta como aceptado
--    (nunca se cobra un precio de la web que el profesional no haya aceptado): hay que publicar otra versión.
create or replace function public.oy_condiciones_web_aceptadas(p_pro uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select p_pro is not null and exists (
    select 1
      from public.pro_condiciones_aceptaciones a
      join public.pro_condiciones_modelo m on m.id = a.modelo_id
     where a.pro_id = p_pro and m.tipo = 'web_pro' and m.vigente
       and m.precio = coalesce(public.oy_cfg('precio_lead_web_pro'), 15))
$$;
revoke all on function public.oy_condiciones_web_aceptadas(uuid) from public, anon, authenticated;
grant execute on function public.oy_condiciones_web_aceptadas(uuid) to service_role;

-- 6) Para la app: condiciones vigentes y si ya las aceptó (solo el propio profesional o admin)
create or replace function public.oy_condiciones_web(p_pro uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
declare m public.pro_condiciones_modelo; a public.pro_condiciones_aceptaciones; ant record;
begin
  if not public.oy_es_yo_o_admin(p_pro) then
    raise exception 'acceso denegado' using errcode = '42501';
  end if;
  select * into m from public.pro_condiciones_modelo where tipo = 'web_pro' and vigente;
  if not found then
    return jsonb_build_object('vigente', null, 'aceptada', null, 'pendiente', false);
  end if;
  select * into a from public.pro_condiciones_aceptaciones where pro_id = p_pro and modelo_id = m.id;
  select x.version, x.aceptado_at into ant
    from public.pro_condiciones_aceptaciones x
   where x.pro_id = p_pro and x.tipo = 'web_pro' and x.modelo_id <> m.id
   order by x.aceptado_at desc limit 1;
  return jsonb_build_object(
    'vigente', jsonb_build_object(
      'version', m.version, 'titulo', m.titulo, 'resumen', m.resumen, 'texto', m.texto, 'sha256', m.sha256,
      'precio', m.precio, 'iva_pct', m.iva_pct, 'precio_iva', round(m.precio * (1 + m.iva_pct / 100), 2)),
    'aceptada', case when a.id is null then null else jsonb_build_object(
      'id', a.id, 'aceptado_at', a.aceptado_at, 'version', a.version, 'origen', a.origen,
      'email', a.email_enviado_at is not null, 'justificante', a.archivo_id is not null) end,
    'anterior', case when ant.version is null then null else jsonb_build_object('version', ant.version, 'aceptado_at', ant.aceptado_at) end,
    'pendiente', a.id is null);
end $$;
revoke all on function public.oy_condiciones_web(uuid) from public, anon;
grant execute on function public.oy_condiciones_web(uuid) to authenticated, service_role;

-- 7) Aceptar (solo el propio profesional, con su sesión). Guarda la prueba y avisa a admin.
create or replace function public.oy_condiciones_web_aceptar(p_pro uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare
  u public.users; m public.pro_condiciones_modelo; a public.pro_condiciones_aceptaciones;
  v_hdr json; v_ip text; v_ua text; v_disp jsonb; v_ses jsonb; v_cuenta jsonb; v_origen text;
  v_id uuid := gen_random_uuid(); v_ahora timestamptz := now(); v_prev text; v_reg text; v_hash text; v_sha text;
begin
  if coalesce(nullif(current_setting('role', true), ''), 'none') <> 'authenticated'
     or public.oy_uid() is distinct from p_pro then
    raise exception 'Solo puedes aceptar las condiciones desde tu propia cuenta' using errcode = '42501';
  end if;
  select * into u from public.users where id = p_pro;
  if not found or u.type <> 'profesional' or coalesce(u.deleted, false) then
    raise exception 'Cuenta no válida';
  end if;
  if lower(coalesce(p->>'acepto', '')) <> 'true' then
    raise exception 'Marca la casilla para aceptar las condiciones';
  end if;

  select * into m from public.pro_condiciones_modelo where tipo = 'web_pro' and vigente;
  if not found then raise exception 'Ahora mismo no hay condiciones que aceptar'; end if;
  v_sha := lower(btrim(coalesce(p->>'sha256', '')));
  if coalesce(p->>'version', '') <> m.version or v_sha <> m.sha256 then
    raise exception 'Las condiciones han cambiado. Ciérralas y vuelve a abrirlas para leer las nuevas.';
  end if;

  -- Una sola vez por versión (si pulsa dos veces, la segunda devuelve la primera)
  perform pg_advisory_xact_lock(hashtext('pro_condiciones_aceptaciones'));
  select * into a from public.pro_condiciones_aceptaciones where pro_id = p_pro and modelo_id = m.id;
  if found then
    return jsonb_build_object('ok', true, 'ya', true, 'id', a.id, 'aceptado_at', a.aceptado_at, 'version', a.version);
  end if;
  select x.hash into v_prev from public.pro_condiciones_aceptaciones x order by x.aceptado_at desc, x.id desc limit 1;

  begin v_hdr := nullif(current_setting('request.headers', true), '')::json; exception when others then v_hdr := null; end;
  v_ip := coalesce(nullif(btrim(v_hdr->>'cf-connecting-ip'), ''),
                   nullif(btrim(split_part(coalesce(v_hdr->>'x-forwarded-for', ''), ',', 1)), ''),
                   nullif(btrim(v_hdr->>'x-real-ip'), ''));
  v_ua := left(nullif(btrim(v_hdr->>'user-agent'), ''), 500);
  v_disp := jsonb_strip_nulls(jsonb_build_object(
    'navegador', left(nullif(btrim(p->>'ua'), ''), 500),
    'idioma', left(nullif(btrim(p->>'idioma'), ''), 60),
    'zona_horaria', left(nullif(btrim(p->>'zona_horaria'), ''), 60),
    'pantalla', left(nullif(btrim(p->>'pantalla'), ''), 40),
    'plataforma', left(nullif(btrim(p->>'plataforma'), ''), 60),
    'app_instalada', case when p->>'app_instalada' in ('true', 'false') then (p->>'app_instalada')::boolean end,
    'hora_dispositivo', left(nullif(btrim(p->>'hora'), ''), 40),
    'texto_sha256_en_pantalla', left(nullif(lower(btrim(p->>'sha256_pantalla')), ''), 64),
    'leyo_texto_completo', case when p->>'leyo' in ('true', 'false') then (p->>'leyo')::boolean end));
  v_ses := jsonb_strip_nulls(jsonb_build_object(
    'auth_uid', auth.jwt()->>'sub',
    'session_id', auth.jwt()->>'session_id',
    'rol', current_setting('role', true),
    'oy_uid', public.oy_uid(),
    'oy_tipo', public.oy_tipo(),
    'aal', auth.jwt()->>'aal',
    'emitida_utc', case when coalesce(auth.jwt()->>'iat', '') ~ '^[0-9]+$'
                        then to_char(to_timestamp((auth.jwt()->>'iat')::bigint) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end));
  v_cuenta := jsonb_strip_nulls(jsonb_build_object(
    'id', u.id,
    'nombre', nullif(btrim(u.name), ''),
    'empresa', nullif(btrim(u.company_name), ''),
    'nif', nullif(btrim(u.cif), ''),
    'email', nullif(btrim(u.email), ''),
    'email_facturas', nullif(btrim(u.billing_email), ''),
    'telefono', nullif(btrim(u.phone), ''),
    'oficio', nullif(btrim(u.trade), ''),
    'ciudad', nullif(btrim(u.city_slug), ''),
    'zona', nullif(btrim(u.zone), ''),
    'direccion_fiscal', nullif(concat_ws(', ', nullif(btrim(u.fiscal_address), ''),
                               nullif(btrim(concat_ws(' ', nullif(btrim(u.fiscal_zip), ''), nullif(btrim(u.fiscal_city), ''))), '')), ''),
    'web', 'https://aficioya.com/pro/' || public.oy_slug(coalesce(u.name, '') || ' ' || coalesce(u.trade, ''))));
  v_origen := case when p->>'origen' in ('guia_perfil', 'guia_perfil_omitida', 'perfil', 'mi_web', 'contrato', 'falta')
                   then p->>'origen' else 'perfil' end;

  v_reg := public.oy_condiciones_registro(v_id, u.id, m.id, m.version, m.sha256, m.precio, m.iva_pct, v_ahora,
                                          v_origen, v_ip, v_ua, v_disp, v_ses, v_cuenta, v_prev);
  v_hash := encode(extensions.digest(v_reg, 'sha256'), 'hex');

  insert into public.pro_condiciones_aceptaciones (id, pro_id, modelo_id, tipo, version, texto_sha256, precio, iva_pct,
    aceptado_at, origen, ip, user_agent, dispositivo, sesion, cuenta, hash_anterior, hash)
  values (v_id, u.id, m.id, m.tipo, m.version, m.sha256, m.precio, m.iva_pct,
    v_ahora, v_origen, v_ip, v_ua, v_disp, v_ses, v_cuenta, v_prev, v_hash);

  begin
    perform public.oy_push('00000000-0000-0000-0000-000000000002'::uuid,
      '✅ ' || coalesce(nullif(btrim(u.name), ''), 'Un profesional') || ' ha aceptado las condiciones de su web',
      replace(to_char(m.precio, 'FM9990.00'), '.', ',') || ' € + IVA por cada cliente de su web. El justificante va a Archivos.',
      '/?panel=profesionales');
  exception when others then
    raise warning 'oy_condiciones_web_aceptar push: %', sqlerrm;
  end;
  return jsonb_build_object('ok', true, 'id', v_id, 'aceptado_at', v_ahora, 'version', m.version);
end $$;
revoke all on function public.oy_condiciones_web_aceptar(uuid, jsonb) from public, anon;
grant execute on function public.oy_condiciones_web_aceptar(uuid, jsonb) to authenticated;

-- 8) Justificante en Archivos: la base llama a la Edge Function «condiciones-web» al aceptar
insert into public.oy_secretos (clave, valor)
values ('condiciones_web', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (clave) do nothing;

create or replace function public.oy_condiciones_web_archivar(p_id uuid)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_clave text; rid bigint;
begin
  if p_id is null then return null; end if;
  select valor into v_clave from public.oy_secretos where clave = 'condiciones_web';
  if v_clave is null then return null; end if;
  select net.http_post(
    url := 'https://rjwojxwrsbvwwshwwpvq.supabase.co/functions/v1/condiciones-web',
    body := jsonb_build_object('accion', 'archivar', 'id', p_id, 'clave', v_clave),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 60000) into rid;
  return rid;
exception when others then
  raise warning 'oy_condiciones_web_archivar: %', sqlerrm;
  return null;
end $$;
revoke all on function public.oy_condiciones_web_archivar(uuid) from public, anon, authenticated;
grant execute on function public.oy_condiciones_web_archivar(uuid) to service_role;

create or replace function public.pro_condiciones_aceptaciones_ai()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  perform public.oy_condiciones_web_archivar(new.id);
  return null;
exception when others then
  raise warning 'pro_condiciones_aceptaciones_ai: %', sqlerrm;
  return null;
end $$;
drop trigger if exists z_archivar on public.pro_condiciones_aceptaciones;
create trigger z_archivar after insert on public.pro_condiciones_aceptaciones
  for each row execute function public.pro_condiciones_aceptaciones_ai();

-- Lo que necesita la Edge Function (solo el servidor). Cuenta el intento.
create or replace function public.oy_condiciones_web_archivo(p_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a public.pro_condiciones_aceptaciones; m public.pro_condiciones_modelo; u public.users;
begin
  select * into a from public.pro_condiciones_aceptaciones where id = p_id;
  if not found then return null; end if;
  select * into m from public.pro_condiciones_modelo where id = a.modelo_id;
  select * into u from public.users where id = a.pro_id;
  if a.archivo_id is null then
    update public.pro_condiciones_aceptaciones set archivo_intentos = archivo_intentos + 1 where id = p_id;
  elsif a.email_enviado_at is null then
    update public.pro_condiciones_aceptaciones set email_intentos = email_intentos + 1 where id = p_id;
  end if;
  return jsonb_build_object(
    'aceptacion', to_jsonb(a),
    'modelo', jsonb_build_object('id', m.id, 'tipo', m.tipo, 'version', m.version, 'titulo', m.titulo,
                                 'texto', m.texto, 'sha256', m.sha256, 'precio', m.precio, 'iva_pct', m.iva_pct),
    'registro', public.oy_condiciones_registro(a.id, a.pro_id, a.modelo_id, a.version, a.texto_sha256, a.precio, a.iva_pct,
                  a.aceptado_at, a.origen, a.ip, a.user_agent, a.dispositivo, a.sesion, a.cuenta, a.hash_anterior),
    'carpeta', 'Profesionales/' || public.archivos_nombre_pro(coalesce(nullif(btrim(u.name), ''), a.cuenta->>'nombre'),
                                                              coalesce(u.company_name, a.cuenta->>'empresa')) || '/Contratos',
    'nombre', coalesce(nullif(btrim(u.name), ''), a.cuenta->>'nombre'),
    'email', case when coalesce(u.email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
                   and coalesce(u.email, '') !~* '@aficioya-lead\.com$' then lower(btrim(u.email)) end,
    'archivo', case when a.archivo_id is null then null else (
       select jsonb_build_object('id', x.id, 'storage_path', x.storage_path, 'nombre', x.nombre, 'sha256', x.sha256)
         from public.archivos x where x.id = a.archivo_id) end);
end $$;
revoke all on function public.oy_condiciones_web_archivo(uuid) from public, anon, authenticated;
grant execute on function public.oy_condiciones_web_archivo(uuid) to service_role;

-- Si el justificante o el email fallaron, se reintenta cada 10 minutos (como mucho 6 y 3 veces, durante 7 días)
create or replace function public.oy_condiciones_web_reintentar()
returns int language plpgsql security definer set search_path to 'public' as $$
declare r record; n int := 0;
begin
  for r in
    select id from public.pro_condiciones_aceptaciones
     where ((archivo_id is null and archivo_intentos < 6)
            or (archivo_id is not null and email_enviado_at is null and email_intentos < 3))
       and aceptado_at < now() - interval '3 minutes'
       and aceptado_at > now() - interval '7 days'
     order by aceptado_at
     limit 10
  loop
    perform public.oy_condiciones_web_archivar(r.id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.oy_condiciones_web_reintentar() from public, anon, authenticated;

select cron.unschedule('condiciones-web-archivar') where exists (select 1 from cron.job where jobname = 'condiciones-web-archivar');
select cron.schedule('condiciones-web-archivar', '*/10 * * * *', $$select public.oy_condiciones_web_reintentar()$$);

-- 9) Primera versión de las condiciones de la web (15 € + IVA)
insert into public.pro_condiciones_modelo (tipo, version, titulo, resumen, texto, sha256, precio, iva_pct, vigente)
select 'web_pro', '2026-11-11', 'Condiciones de tu web', r, t, encode(extensions.digest(t, 'sha256'), 'hex'), 15, 21, true
from (select
$r$[
  "Tu web es gratis: la hacemos y la mantenemos nosotros, y sale en Google.",
  "Solo pagas 15 € + IVA cuando un cliente te pide presupuesto desde tu web. Los de nuestras campañas siguen a tu precio de siempre.",
  "Las mismas reglas que con tus otros clientes: si no consigues hablar con él en 24 horas, no se paga.",
  "Van en tus facturas de OficioYa y se pagan igual que siempre."
]$r$::jsonb as r,
$t$CONDICIONES DE LA WEB DEL PROFESIONAL EN OFICIOYA
Versión 2026-11-11

Estas condiciones se suman a tu contrato con OficioYa (Andrés Algora Marín, NIF 77860535S, Calle Condes de Bustillo 5, bajo D, 41010 Sevilla). En todo lo que no digan, se aplica tu contrato.

1. Tu web
OficioYa te prepara, aloja y mantiene una página web propia dentro de aficioya.com (aficioya.com/pro/…), con tus datos, tus trabajos, tus fotos y las opiniones de tus clientes. Es pública: la puede ver cualquiera y puede salir en Google y en otros buscadores. Tenerla no te cuesta nada.

2. Precio por cliente
Cada cliente que te llegue a través de tu web cuesta 15,00 € + IVA (18,15 € con el 21 % de IVA). Es cliente de tu web quien deja sus datos en ella para pedirte presupuesto o para contactar contigo, por el formulario o para llamarte o escribirte por WhatsApp desde la web. Si deja sus datos y luego te llama o te escribe, cuenta como uno solo.

3. Los clientes de las campañas no cambian
Los clientes que te pasa OficioYa con sus campañas y anuncios siguen con el precio de tu contrato. Los 15,00 € + IVA son solo para los que llegan por tu web.

4. Qué clientes de tu web se pagan y cuáles no
Se aplican las mismas reglas de tu contrato que con el resto de tus clientes. Por ejemplo, no se paga si no consigues hablar con el cliente en 24 horas (OficioYa lo comprueba y, si consigue hablar con él, te lo devuelve y entonces sí se paga), si el teléfono no existe o es erróneo, si no pide un trabajo de tu oficio, si está fuera de tu zona, si repite (mismo cliente y mismo trabajo en los últimos 30 días) o si no es un cliente (publicidad, proveedores, ofertas de empleo…). Si crees que alguno no se debe pagar, avísanos en menos de 48 horas por WhatsApp (656 398 014) o por email (admin@algoracompound.com).

5. Factura y pago
Estos clientes se suman a tus facturas de OficioYa y se pagan igual que los demás, con la misma forma de pago.

6. Lo que publicas en tu web
Lo que subas para tu web (foto o logo, presentación, fotos de trabajos, títulos…) tiene que ser tuyo o tener permiso para usarlo, y ser cierto. Nos autorizas a publicarlo en tu web y en OficioYa mientras trabajes con nosotros. Podemos quitar lo que no cumpla estas condiciones o la ley.

7. Opiniones
Tus clientes pueden dejar su opinión con tu enlace y sale al momento en tu web. No puedes escribir opiniones tú mismo ni pedírselas a quien no haya sido cliente tuyo. OficioYa puede ocultar las opiniones falsas, ofensivas o que tengan datos personales.

8. Duración
Tu web está activa mientras tengas contrato con OficioYa. Si el contrato termina, la desactivamos.

9. Cambios
Si cambiamos estas condiciones o el precio, te avisaremos en la app y tendrás que aceptarlas otra vez. Hasta entonces se aplican estas.

10. Prueba de tu aceptación
Al aceptar guardamos la fecha y la hora, tu IP, los datos de tu dispositivo y de tu sesión y el texto exacto que aceptas, como prueba de este acuerdo, y te mandamos una copia a tu email. Usamos estos datos solo para eso, según la política de privacidad de OficioYa.$t$::text as t) x
on conflict (tipo, version) do nothing;
