-- Costing & Expenses, phase 1: Ingredient Library.
-- Run once in the Supabase SQL editor, after module-permissions.sql. Safe to re-run.
-- Access is deny-by-default (RLS on, no policies): only the server-side secret key can read or write.

-- 1. Categories (user managed) ---------------------------------------------------------------
create table if not exists public.ingredient_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ingredient_categories_name_uidx
  on public.ingredient_categories (lower(btrim(name)));

insert into public.ingredient_categories (name) values
  ('Flour'), ('Dairy'), ('Seeds'), ('Oils'), ('Seasonings'), ('Packaging'), ('Other')
on conflict do nothing;

-- 2. Ingredients ------------------------------------------------------------------------------
-- cost_per_base_unit is derived in the database so every code path gets the same answer:
-- price / (quantity * factor), where kg and L convert x1000 to g and ml. numeric keeps 10 decimals.
create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  category_id uuid not null references public.ingredient_categories (id) on delete restrict,
  purchase_quantity numeric(14,4) not null check (purchase_quantity > 0),
  purchase_unit text not null check (purchase_unit in ('g', 'kg', 'ml', 'L', 'pcs')),
  purchase_price numeric(14,4) not null check (purchase_price >= 0),
  base_unit text generated always as (
    case purchase_unit when 'g' then 'g' when 'kg' then 'g' when 'ml' then 'ml' when 'L' then 'ml' else 'pcs' end
  ) stored,
  cost_per_base_unit numeric(24,10) generated always as (
    (purchase_price / (purchase_quantity *
      case purchase_unit when 'kg' then 1000 when 'L' then 1000 else 1 end))::numeric(24,10)
  ) stored,
  supplier text check (supplier is null or length(supplier) <= 120),
  is_active boolean not null default true,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ingredients_name_uidx on public.ingredients (lower(btrim(name)));
create index if not exists ingredients_category_id_idx on public.ingredients (category_id);

-- 3. Price history was removed. Drop it if an earlier version of this script created it.
drop trigger if exists ingredients_log_price on public.ingredients;
drop function if exists public.log_ingredient_price();
drop table if exists public.ingredient_price_history;

-- 4. Triggers ---------------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ingredients_touch_updated_at on public.ingredients;
create trigger ingredients_touch_updated_at before update on public.ingredients
  for each row execute function public.touch_updated_at();

drop trigger if exists ingredient_categories_touch_updated_at on public.ingredient_categories;
create trigger ingredient_categories_touch_updated_at before update on public.ingredient_categories
  for each row execute function public.touch_updated_at();

-- 5. Access policies: deny-by-default. No policies; only service_role (which bypasses RLS) may use these.
alter table public.ingredient_categories enable row level security;
alter table public.ingredients enable row level security;

revoke all on public.ingredient_categories, public.ingredients
  from anon, authenticated;
grant all on public.ingredient_categories, public.ingredients
  to service_role;

-- 6. Register the module. Not granted to existing staff: an owner enables it under Users.
insert into public.modules (module_key, module_name, description) values
  ('costing_expenses', 'Costing & Expenses', 'Ingredient library and costing')
on conflict do nothing;
