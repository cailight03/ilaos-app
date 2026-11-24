-- Run once in the Supabase SQL editor. Operates on the existing authorized_users table.
--
-- 1. Serializes owner changes and refuses any UPDATE/DELETE that would leave the
--    system without an active owner. Enforced in the database so it also holds
--    for concurrent requests (the advisory lock makes competing changes queue up,
--    and each check sees the other's committed result).
-- 2. Keeps updated_at current.
-- 3. Enables RLS with no policies, so only the server-side secret key can access it.

create or replace function public.enforce_last_active_owner()
returns trigger
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(hashtext('authorized_users_owner_guard'));

  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or not (new.role = 'owner' and new.is_active)) then
    if not exists (
      select 1 from public.authorized_users
      where role = 'owner' and is_active and id <> old.id
    ) then
      raise exception 'LAST_ACTIVE_OWNER' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists authorized_users_last_owner_guard on public.authorized_users;
create trigger authorized_users_last_owner_guard
  before update or delete on public.authorized_users
  for each row execute function public.enforce_last_active_owner();

create or replace function public.touch_authorized_users_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists authorized_users_touch_updated_at on public.authorized_users;
create trigger authorized_users_touch_updated_at
  before update on public.authorized_users
  for each row execute function public.touch_authorized_users_updated_at();

create unique index if not exists authorized_users_email_lower_key
  on public.authorized_users (lower(email));

alter table public.authorized_users enable row level security;
