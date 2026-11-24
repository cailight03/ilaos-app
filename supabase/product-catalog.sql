-- Costing & Expenses: user-managed products and product categories.
-- Run once in the Supabase SQL editor, after product-costing.sql. Safe to re-run.
-- Recipe-driven products stay in code (src/lib/recipes.ts); this adds categories for them and lets
-- you create extra products whose ingredients are picked straight from the Ingredient Library.

-- 1. Product categories -----------------------------------------------------------------------------
create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_categories_name_key
  on public.product_categories (lower(btrim(name)));

-- 2. Custom products ---------------------------------------------------------------------------------
-- Archived instead of deleted. unit_label is what one costed unit is called ("piece", "loaf", "box").
create table if not exists public.custom_products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  category_id uuid not null references public.product_categories (id) on delete restrict,
  unit_label text not null default 'piece' check (length(btrim(unit_label)) between 1 and 30),
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists custom_products_name_key
  on public.custom_products (lower(btrim(name)));
create index if not exists custom_products_category_idx on public.custom_products (category_id);

-- 3. Category for each recipe-driven product (keyed by the recipe id in code) -----------------------
create table if not exists public.recipe_product_categories (
  product_id text primary key check (length(product_id) between 1 and 100),
  category_id uuid not null references public.product_categories (id) on delete restrict,
  updated_by text,
  updated_at timestamptz not null default now()
);
create index if not exists recipe_product_categories_category_idx
  on public.recipe_product_categories (category_id);

-- 4. Custom products list their ingredients as cost items of kind 'ingredient' ------------------------
alter table public.product_cost_items drop constraint if exists product_cost_items_kind_check;
alter table public.product_cost_items
  add constraint product_cost_items_kind_check check (kind in ('ingredient', 'packaging', 'addon'));

-- 5. Triggers and access ------------------------------------------------------------------------------
drop trigger if exists product_categories_touch on public.product_categories;
create trigger product_categories_touch before update on public.product_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists custom_products_touch on public.custom_products;
create trigger custom_products_touch before update on public.custom_products
  for each row execute function public.touch_updated_at();

drop trigger if exists recipe_product_categories_touch on public.recipe_product_categories;
create trigger recipe_product_categories_touch before update on public.recipe_product_categories
  for each row execute function public.touch_updated_at();

alter table public.product_categories enable row level security;
alter table public.custom_products enable row level security;
alter table public.recipe_product_categories enable row level security;

revoke all on public.product_categories, public.custom_products, public.recipe_product_categories
  from anon, authenticated;
grant all on public.product_categories, public.custom_products, public.recipe_product_categories
  to service_role;

-- 6. Starter categories (rename or archive them in the app) --------------------------------------------
insert into public.product_categories (name)
select v.name from (values ('Bread'), ('Focaccia'), ('Pastry'), ('Other')) as v(name)
where not exists (
  select 1 from public.product_categories c where lower(btrim(c.name)) = lower(v.name)
);
