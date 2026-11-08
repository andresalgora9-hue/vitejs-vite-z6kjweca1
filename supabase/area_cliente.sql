-- ============================================================
-- OficioYa · Área del cliente (8 nov 2026)
--  1. client_quotes: presupuestos que el cliente apunta a mano para organizarlos y compararlos
--  2. Aviso «pon tu correo y contraseña»: columnas de control en users + push (máx. 2 por cliente)
--  3. oy_cliente_profesionales(): profesionales con perfil, solo datos públicos (sin teléfono ni email)
--  4. oy_cliente_solicitudes(): las solicitudes del cliente con su estado (profesional, contacto, presupuesto)
--  5. oy_lead_contacto(): si la cuenta se crea en ese momento devuelve «sesion» para que la landing
--     deje al cliente dentro de su área (clave aleatoria solo para ese navegador)
-- ============================================================

-- ── 1. PRESUPUESTOS DEL CLIENTE ─────────────────────────────
create table if not exists public.client_quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  trabajo text not null check (char_length(trabajo) between 1 and 120),
  oficio text,
  tipo text,                 -- clave del precio de referencia (p. ej. pintura.piso_completo.p2)
  empresa text not null check (char_length(empresa) between 1 and 120),
  telefono text,
  importe numeric(10,2) check (importe is null or (importe >= 0 and importe < 10000000)),
  iva text not null default 'incluido' check (iva in ('incluido','aparte','no_se')),
  fecha date not null default ((now() at time zone 'Europe/Madrid')::date),
  valido_hasta date,
  incluye text check (incluye is null or char_length(incluye) <= 2000),
  notas text check (notas is null or char_length(notas) <= 2000),
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptado','descartado')),
  archivo_url text,
  archivo_tipo text,
  origen text not null default 'manual' check (origen in ('manual','oficioya')),
  budget_request_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_quotes_cliente_idx on public.client_quotes (client_id, created_at desc);

create or replace function public.client_quotes_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists client_quotes_touch on public.client_quotes;
create trigger client_quotes_touch before update on public.client_quotes
  for each row execute function public.client_quotes_touch();

-- Mismo esquema de acceso que el resto de tablas de la app (sesión propia, sin Supabase Auth)
alter table public.client_quotes enable row level security;
drop policy if exists client_quotes_select on public.client_quotes;
drop policy if exists client_quotes_insert on public.client_quotes;
drop policy if exists client_quotes_update on public.client_quotes;
drop policy if exists client_quotes_delete on public.client_quotes;
create policy client_quotes_select on public.client_quotes for select using (true);
create policy client_quotes_insert on public.client_quotes for insert with check (true);
create policy client_quotes_update on public.client_quotes for update using (true) with check (true);
create policy client_quotes_delete on public.client_quotes for delete using (true);

-- ── 2. AVISO PARA CREAR EL ACCESO (correo + contraseña) ─────
alter table public.users add column if not exists acceso_aviso_n smallint not null default 0;
alter table public.users add column if not exists acceso_aviso_at timestamptz;
-- Correo puesto pero contraseña pendiente (se le envió el enlace): se apaga sola al guardar la contraseña
alter table public.users add column if not exists acceso_pendiente boolean not null default false;
create or replace function public.user_credentials_acceso_listo() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  update users set acceso_pendiente = false where id = new.user_id and acceso_pendiente;
  return new;
end $$;
drop trigger if exists user_credentials_acceso_listo on public.user_credentials;
create trigger user_credentials_acceso_listo after insert or update on public.user_credentials
  for each row execute function public.user_credentials_acceso_listo();

-- Push a los clientes con email provisional (de anuncio) que tienen los avisos activados.
-- Máximo 2 por cliente, con 3 días entre uno y otro, solo de 10:00 a 21:00 (hora de Madrid).
-- Al pulsarlo se abre su Perfil con la tarjeta «Crea tu acceso».
create or replace function public.oy_recordatorio_acceso_clientes()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare r record; n integer := 0; h integer; v_nombre text;
begin
  h := extract(hour from (now() at time zone 'Europe/Madrid'))::int;
  if h < 10 or h >= 21 then return 0; end if;
  for r in
    select u.id, coalesce(u.name, '') as name
      from users u
     where u.type = 'cliente'
       and coalesce(u.deleted, false) = false and coalesce(u.banned, false) = false
       and (u.email ilike '%@aficioya-lead.com' or u.email ilike '%@cliente.oficioya.com')
       and coalesce(u.acceso_aviso_n, 0) < 2
       and (u.acceso_aviso_at is null or u.acceso_aviso_at < now() - interval '3 days')
       and coalesce(u.created_at, now() at time zone 'UTC') < (now() at time zone 'UTC') - interval '2 hours'
       and exists (select 1 from push_subscriptions ps where ps.user_id = u.id)
     order by u.created_at desc nulls last
     limit 25
  loop
    v_nombre := split_part(btrim(r.name), ' ', 1);
    if v_nombre = '' or v_nombre ~* '^(cliente|lead)$' or v_nombre ~ '\d' then v_nombre := null; end if;
    perform oy_push(
      r.id,
      'Protege tu cuenta de OficioYa',
      case when v_nombre is null then 'Añade tu correo y una contraseña para seguir tu solicitud desde cualquier móvil.'
           else initcap(v_nombre) || ', añade tu correo y una contraseña para seguir tu solicitud desde cualquier móvil.' end,
      '/?app=1&perfil=1'
    );
    update users set acceso_aviso_n = coalesce(acceso_aviso_n, 0) + 1, acceso_aviso_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
-- Solo la lanza la tarea programada (nadie puede dispararla desde la web)
revoke execute on function public.oy_recordatorio_acceso_clientes() from public, anon, authenticated;

-- ── 3. PROFESIONALES PARA EL ÁREA DEL CLIENTE (solo datos públicos) ──
create or replace function public.oy_cliente_profesionales()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(x order by (x->>'orden')::int, x->>'nombre'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', u.id,
      'nombre', initcap(split_part(btrim(u.name), ' ', 1))
                || case when split_part(btrim(u.name), ' ', 2) <> '' then ' ' || upper(left(split_part(btrim(u.name), ' ', 2), 1)) || '.' else '' end,
      'empresa', nullif(btrim(coalesce(u.company_name, '')), ''),
      'oficio', u.trade,
      'zona', coalesce(nullif(btrim(coalesce(u.zone, '')), ''), initcap(replace(coalesce(u.city_slug, ''), '-', ' '))),
      'avatar', nullif(btrim(coalesce(u.avatar_url, '')), ''),
      'bio', nullif(btrim(coalesce(u.bio, '')), ''),
      'especialidades', coalesce(to_jsonb(u.specialties), '[]'::jsonb),
      'experiencia', u.experience_years,
      'contrato', exists (select 1 from lead_routing r where r.pro_id = u.id and r.active),
      'fotos', coalesce((select jsonb_agg(p.url order by p.created_at desc) from (select url, created_at from photos ph where ph.worker_id::text = u.id::text and coalesce(ph.url, '') <> '' order by ph.created_at desc limit 6) p), '[]'::jsonb),
      'orden', case
                 when exists (select 1 from lead_routing r where r.pro_id = u.id and r.active) then 0
                 when coalesce(u.avatar_url, '') <> '' and length(coalesce(u.bio, '')) > 20 then 1
                 when coalesce(u.avatar_url, '') <> '' or length(coalesce(u.bio, '')) > 20 then 2
                 else 3 end
    ) as x
    from users u
    where u.type = 'profesional'
      and coalesce(u.deleted, false) = false and coalesce(u.banned, false) = false
      and coalesce(u.es_prueba, false) = false and u.login_as is null
      and coalesce(u.available, true) = true
      and btrim(coalesce(u.trade, '')) <> '' and btrim(coalesce(u.name, '')) <> ''
      and coalesce(u.email, '') ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'
      and coalesce(u.email, '') !~ '\.\.'
      and coalesce(u.email, '') !~* 'algora'
  ) s;
$$;

-- ── 4. SOLICITUDES DEL CLIENTE CON SU ESTADO ────────────────
create or replace function public.oy_cliente_solicitudes(p_cliente uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', b.id,
      'created_at', b.created_at,
      'oficio', b.oficio,
      'zona', b.zona,
      'city_slug', b.city_slug,
      'descripcion', b.description,
      'estado', b.status,
      'canal', b.canal,
      'pro_solicitado', b.pro_solicitado,
      'lead_estado', pl.estado,
      'lead_estado_at', pl.estado_at,
      'presupuesto_eur', pl.presupuesto_eur,
      'contactado_at', coalesce(pl.primer_contacto_at, pl.llamada_at),
      'anulado', coalesce(pl.anulado, false),
      'pro', case when pu.id is null then null else jsonb_build_object(
               'id', pu.id,
               'nombre', initcap(split_part(btrim(coalesce(pu.name, '')), ' ', 1)),
               'empresa', nullif(btrim(coalesce(pu.company_name, '')), ''),
               'avatar', nullif(btrim(coalesce(pu.avatar_url, '')), ''),
               'oficio', pu.trade,
               'telefono', case
                 when length(regexp_replace(coalesce(nullif(pu.phone, ''), pu.whatsapp, ''), '\D', '', 'g')) = 9
                   then '+34' || regexp_replace(coalesce(nullif(pu.phone, ''), pu.whatsapp, ''), '\D', '', 'g')
                 when length(regexp_replace(coalesce(nullif(pu.phone, ''), pu.whatsapp, ''), '\D', '', 'g')) >= 11
                   then '+' || regexp_replace(coalesce(nullif(pu.phone, ''), pu.whatsapp, ''), '\D', '', 'g')
                 else null end
             ) end
    ) as x
    from budget_requests b
    left join pro_leads pl on pl.budget_request_id = b.id
    left join users pu on pu.id = pl.pro_id
    where b.client_id = p_cliente::text
    order by b.created_at desc
    limit 40
  ) s;
$$;

-- ── 5. LANDINGS: SESIÓN PARA CUENTAS NUEVAS ─────────────────
CREATE OR REPLACE FUNCTION public.oy_lead_contacto(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tel text; v_nombre text; v_oficio text; v_canal text; v_city text; v_zona text;
  v_user uuid; v_br uuid; v_nuevo boolean := false;
  v_pro uuid; v_pro_tel text; v_pro_wa text; v_pro_nombre text; v_d text;
  v_email text;
  v_creado boolean := false; v_clave text; v_sesion jsonb := null;
begin
  v_tel := right(regexp_replace(coalesce(p->>'telefono',''),'\D','','g'), 9);
  if v_tel !~ '^[6789][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'telefono');
  end if;
  v_nombre := left(nullif(btrim(coalesce(p->>'nombre','')),''), 80);
  if v_nombre is null or length(v_nombre) < 2 then
    return jsonb_build_object('ok', false, 'error', 'nombre');
  end if;
  v_oficio := left(coalesce(nullif(btrim(p->>'oficio'),''),'Sin oficio'), 60);
  v_canal  := case when p->>'canal' in ('llamada','whatsapp') then p->>'canal' else 'formulario' end;
  v_city   := coalesce(nullif(lower(btrim(p->>'city_slug')),''),'sevilla');
  v_zona   := left(coalesce(nullif(btrim(p->>'zona'),''), initcap(replace(v_city,'-',' '))), 80);

  -- Cliente: se busca por teléfono; si no existe se crea como hace la landing (email sintético)
  select u.id into v_user from users u
   where u.type = 'cliente' and coalesce(u.deleted,false) = false
     and right(regexp_replace(coalesce(u.phone,''),'\D','','g'),9) = v_tel
   order by u.created_at desc nulls last limit 1;
  if v_user is null then
    v_email := 'lead' || v_tel || '@aficioya-lead.com';
    select u.id into v_user from users u where u.email = v_email limit 1;
    if v_user is null then
      insert into users (name, email, type, phone) values (v_nombre, v_email, 'cliente', v_tel)
      returning id into v_user;
      v_creado := true;
    end if;
  end if;

  -- Mismo teléfono y mismo oficio en los últimos 7 días = mismo lead (no se cobra dos veces)
  select b.id into v_br from budget_requests b
   where b.client_id = v_user::text
     and lower(coalesce(b.oficio,'')) = lower(v_oficio)
     and b.created_at > (now() at time zone 'UTC') - interval '7 days'
   order by b.created_at desc limit 1;

  if v_br is null then
    insert into budget_requests (client_id, client_name, oficio, zona, description, status, notified_pros,
                                 city_slug, landing, utm_source, utm_campaign, utm_content, gclid, canal, ab_test, ab_variante, ab_origen)
    values (v_user::text, v_nombre, v_oficio, v_zona,
            left(coalesce(nullif(btrim(p->>'descripcion'),''),
                 case v_canal when 'llamada' then 'Quiere hablar por teléfono (dejó sus datos en la web antes de llamar).'
                              when 'whatsapp' then 'Quiere hablar por WhatsApp (dejó sus datos en la web antes de escribir).'
                              else 'Solicitud desde la web.' end), 1000),
            'open', '{}', v_city,
            left(nullif(p->>'landing',''),120), left(nullif(p->>'utm_source',''),120),
            left(nullif(p->>'utm_campaign',''),120), left(nullif(p->>'utm_content',''),120),
            left(nullif(p->>'gclid',''),300), v_canal, left(nullif(p->>'ab_test',''),40), left(nullif(p->>'ab_variante',''),10), left(nullif(p->>'ab_origen',''),40))
    returning id into v_br;
    v_nuevo := true;
  end if;

  -- A quién se llama: el profesional que recibe ese oficio; si no hay, OficioYa
  v_pro := oy_route_pro(v_oficio, v_city);
  if v_pro is not null then
    select split_part(coalesce(u.name,''),' ',1),
           regexp_replace(coalesce(nullif(u.phone,''),''),'\D','','g'),
           regexp_replace(coalesce(nullif(u.whatsapp,''), nullif(u.phone,''),''),'\D','','g')
      into v_pro_nombre, v_pro_tel, v_pro_wa
      from users u where u.id = v_pro;
  end if;
  if coalesce(length(v_pro_tel),0) < 9 then v_pro_tel := '656398014'; v_pro_nombre := null; end if;
  if coalesce(length(v_pro_wa),0) < 9 then v_pro_wa := v_pro_tel; end if;
  if length(v_pro_tel) = 9 then v_pro_tel := '34' || v_pro_tel; end if;
  if length(v_pro_wa) = 9 then v_pro_wa := '34' || v_pro_wa; end if;

  -- 08/11/2026: cuenta recién creada → sesión para que la landing deje al cliente dentro de su área.
  -- Solo cuentas nuevas. La clave es aleatoria y solo la tiene ese navegador: sirve para que después
  -- ponga su correo y su contraseña en Perfil sin pedirle nada más. Si algo falla, el lead no se pierde.
  if v_creado then
    begin
      v_clave := replace(gen_random_uuid()::text, '-', '');
      insert into user_credentials (user_id, password_hash, updated_at)
      values (v_user, extensions.crypt(v_clave, extensions.gen_salt('bf', 10)), now())
      on conflict (user_id) do nothing;
      v_sesion := jsonb_build_object('id', v_user, 'name', v_nombre, 'email', v_email, 'phone', v_tel,
                                     'type', 'cliente', 'plan', 'gratis', 'clave', v_clave);
    exception when others then
      v_sesion := null;
    end;
  end if;

  return jsonb_build_object('ok', true, 'nuevo', v_nuevo, 'solicitud', v_br,
                            'telefono', '+' || v_pro_tel, 'whatsapp', v_pro_wa, 'profesional', v_pro_nombre,
                            'sesion', v_sesion);
end $function$;

-- ── 6. TAREA PROGRAMADA DEL AVISO (cada hora; la función limita horario y frecuencia) ──
select cron.schedule('recordatorio-acceso-clientes', '23 * * * *', 'select public.oy_recordatorio_acceso_clientes()');
