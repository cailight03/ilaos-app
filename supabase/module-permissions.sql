-- Module-level access control, adapted to the EXISTING modules and user_module_permissions tables
-- (modules.module_key / module_name / is_active, user_module_permissions.can_access).
-- Run once in the Supabase SQL editor, after authorized-users-guards.sql. Safe to re-run.
-- No tables are created or dropped; existing rows are kept.

-- Allow the 'admin' role (full module access, no User Management). The old check only allowed owner/staff.
alter table public.authorized_users drop constraint if exists authorized_users_role_check;
alter table public.authorized_users
  add constraint authorized_users_role_check check (role in ('owner', 'admin', 'staff'));

-- Profile picture captured at sign-in.
alter table public.authorized_users add column if not exists avatar_url text;

-- Make sure the existing application modules are registered (existing rows are left untouched).
-- 'user_management' is owner-only and is never granted to staff.
insert into public.modules (module_key, module_name, description) values
  ('dashboard', 'Dashboard', 'View bakery performance and overview'),
  ('orders', 'View Orders', 'View and manage customer orders'),
  ('sales_reports', 'Sales Reports', 'View sales and revenue analytics'),
  ('recipe_calculator', 'Recipe Calculator', 'Calculate product ingredients'),
  ('user_management', 'User Management', 'Manage users and module permissions')
on conflict do nothing;

-- Constraints and indexes (added only if missing).
create unique index if not exists modules_module_key_uidx
  on public.modules (module_key);
create unique index if not exists user_module_permissions_user_module_uidx
  on public.user_module_permissions (user_id, module_id);
create index if not exists user_module_permissions_user_id_idx
  on public.user_module_permissions (user_id);
create index if not exists user_module_permissions_module_id_idx
  on public.user_module_permissions (module_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_module_permissions'::regclass
      and contype = 'f' and confrelid = 'public.authorized_users'::regclass
  ) then
    alter table public.user_module_permissions
      add constraint user_module_permissions_user_id_fkey
      foreign key (user_id) references public.authorized_users (id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_module_permissions'::regclass
      and contype = 'f' and confrelid = 'public.modules'::regclass
  ) then
    alter table public.user_module_permissions
      add constraint user_module_permissions_module_id_fkey
      foreign key (module_id) references public.modules (id) on delete cascade;
  end if;
end $$;

-- Deny-by-default: no policies, so only the server-side secret key (which bypasses RLS) can access these.
alter table public.modules enable row level security;
alter table public.user_module_permissions enable row level security;

-- Staff could use every module before this migration. Keep that for any staff member who has
-- no permission rows yet. Owners need no rows: they always have full access.
insert into public.user_module_permissions (user_id, module_id, can_access)
select u.id, m.id, true
from public.authorized_users u
cross join public.modules m
where u.role = 'staff'
  and m.module_key in ('dashboard', 'orders', 'sales_reports', 'recipe_calculator')
  and not exists (select 1 from public.user_module_permissions p where p.user_id = u.id)
on conflict (user_id, module_id) do nothing;

-- Creates or updates an account and its module grants in ONE transaction.
-- p_id null = create. p_modules null = leave existing grants unchanged (used for owners and admins).
-- The last-active-owner trigger still applies to the update inside.
drop function if exists public.save_authorized_user(uuid, text, text, text, boolean, text[], uuid);

create or replace function public.save_authorized_user(
  p_id uuid,
  p_email text,
  p_name text,
  p_role text,
  p_is_active boolean,
  p_modules text[]
) returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  if p_role not in ('owner', 'admin', 'staff') then
    raise exception 'INVALID_ROLE';
  end if;

  if p_modules is not null and exists (
    select 1 from unnest(p_modules) as k
    where not exists (
      select 1 from public.modules m
      where m.module_key = k and m.is_active and m.module_key <> 'user_management'
    )
  ) then
    raise exception 'INVALID_MODULE';
  end if;

  if p_id is null then
    insert into public.authorized_users (email, name, role, is_active)
    values (lower(trim(p_email)), nullif(trim(p_name), ''), p_role, p_is_active)
    returning id into v_id;
  else
    update public.authorized_users
       set email = lower(trim(p_email)),
           name = nullif(trim(p_name), ''),
           role = p_role,
           is_active = p_is_active
     where id = p_id
     returning id into v_id;
    if v_id is null then
      raise exception 'USER_NOT_FOUND';
    end if;
  end if;

  if p_modules is not null then
    insert into public.user_module_permissions (user_id, module_id, can_access, updated_at)
    select v_id, m.id, (m.module_key = any (p_modules)), now()
    from public.modules m
    where m.module_key <> 'user_management'
    on conflict (user_id, module_id)
      do update set can_access = excluded.can_access, updated_at = now();
  end if;

  return v_id;
end;
$$;

revoke all on function public.save_authorized_user(uuid, text, text, text, boolean, text[])
  from public, anon, authenticated;
grant execute on function public.save_authorized_user(uuid, text, text, text, boolean, text[])
  to service_role;
