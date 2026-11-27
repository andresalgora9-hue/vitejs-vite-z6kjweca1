-- ============================================================
-- OficioYa · Presupuestos de pintura del profesional (27/11/2026)
-- pro_presupuestos: cada presupuesto que hace el profesional desde la tarjeta de un cliente
-- pro_presupuesto_marca: su logo, color y datos para la cabecera (y sus últimos precios)
-- Solo el propio profesional (y admin) los ve y los toca. Sin acceso anónimo.
-- ============================================================

create table if not exists public.pro_presupuestos (
  id uuid primary key default gen_random_uuid(),
  pro_id uuid not null references public.users(id) on delete cascade,
  lead_id uuid references public.pro_leads(id) on delete set null,
  numero text not null default '',
  datos jsonb not null default '{}'::jsonb,
  base numeric(12,2),
  iva numeric(12,2),
  total numeric(12,2),
  enviado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists pro_presupuestos_numero on public.pro_presupuestos (pro_id, numero);
create index if not exists pro_presupuestos_lead on public.pro_presupuestos (pro_id, lead_id, created_at desc);

create table if not exists public.pro_presupuesto_marca (
  pro_id uuid primary key references public.users(id) on delete cascade,
  datos jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Número correlativo por profesional y año: P-2026-001, P-2026-002…
create or replace function public.oy_presupuesto_numero()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  anio text := to_char(now() at time zone 'Europe/Madrid', 'YYYY');
  n int;
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('oy_presupuesto_' || new.pro_id::text));
    select coalesce(max(nullif(split_part(numero, '-', 3), '')::int), 0) + 1 into n
      from public.pro_presupuestos
     where pro_id = new.pro_id and numero like 'P-' || anio || '-%' and split_part(numero, '-', 3) ~ '^[0-9]+$';
    new.numero := 'P-' || anio || '-' || lpad(n::text, 3, '0');
    new.datos := jsonb_set(coalesce(new.datos, '{}'::jsonb), '{numero}', to_jsonb(new.numero));
  else
    new.numero := old.numero;              -- el número no se cambia
    new.pro_id := old.pro_id;
    new.created_at := old.created_at;
    new.datos := jsonb_set(coalesce(new.datos, '{}'::jsonb), '{numero}', to_jsonb(old.numero));
    new.updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists a_oy_presupuesto_numero on public.pro_presupuestos;
create trigger a_oy_presupuesto_numero before insert or update on public.pro_presupuestos
  for each row execute function public.oy_presupuesto_numero();

-- El lead tiene que ser del mismo profesional
create or replace function public.oy_presupuesto_lead_ok(p_lead uuid, p_pro uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_lead is null or exists (select 1 from public.pro_leads l where l.id = p_lead and l.pro_id = p_pro)
$$;

alter table public.pro_presupuestos enable row level security;
alter table public.pro_presupuesto_marca enable row level security;

drop policy if exists oy_admin on public.pro_presupuestos;
create policy oy_admin on public.pro_presupuestos for all to authenticated
  using ((select oy_es_admin())) with check ((select oy_es_admin()));
drop policy if exists oy_pro_ver on public.pro_presupuestos;
create policy oy_pro_ver on public.pro_presupuestos for select to authenticated
  using (pro_id = (select oy_uid()));
drop policy if exists oy_pro_crear on public.pro_presupuestos;
create policy oy_pro_crear on public.pro_presupuestos for insert to authenticated
  with check (pro_id = (select oy_uid()) and public.oy_presupuesto_lead_ok(lead_id, pro_id));
drop policy if exists oy_pro_editar on public.pro_presupuestos;
create policy oy_pro_editar on public.pro_presupuestos for update to authenticated
  using (pro_id = (select oy_uid()))
  with check (pro_id = (select oy_uid()) and public.oy_presupuesto_lead_ok(lead_id, pro_id));
drop policy if exists oy_pro_borrar on public.pro_presupuestos;
create policy oy_pro_borrar on public.pro_presupuestos for delete to authenticated
  using (pro_id = (select oy_uid()));

drop policy if exists oy_admin on public.pro_presupuesto_marca;
create policy oy_admin on public.pro_presupuesto_marca for all to authenticated
  using ((select oy_es_admin())) with check ((select oy_es_admin()));
drop policy if exists oy_pro_ver on public.pro_presupuesto_marca;
create policy oy_pro_ver on public.pro_presupuesto_marca for select to authenticated
  using (pro_id = (select oy_uid()));
drop policy if exists oy_pro_crear on public.pro_presupuesto_marca;
create policy oy_pro_crear on public.pro_presupuesto_marca for insert to authenticated
  with check (pro_id = (select oy_uid()));
drop policy if exists oy_pro_editar on public.pro_presupuesto_marca;
create policy oy_pro_editar on public.pro_presupuesto_marca for update to authenticated
  using (pro_id = (select oy_uid())) with check (pro_id = (select oy_uid()));

revoke all on public.pro_presupuestos, public.pro_presupuesto_marca from anon;
grant select, insert, update, delete on public.pro_presupuestos to authenticated;
grant select, insert, update on public.pro_presupuesto_marca to authenticated;
revoke all on function public.oy_presupuesto_numero() from public, anon, authenticated;
revoke all on function public.oy_presupuesto_lead_ok(uuid, uuid) from public, anon;
grant execute on function public.oy_presupuesto_lead_ok(uuid, uuid) to authenticated;

-- Vuelta atrás:
-- drop table if exists public.pro_presupuestos;
-- drop table if exists public.pro_presupuesto_marca;
-- drop function if exists public.oy_presupuesto_numero();
-- drop function if exists public.oy_presupuesto_lead_ok(uuid, uuid);
