-- Costing & Expenses, phase 2: Product Costing.
-- Run once in the Supabase SQL editor, after costing-ingredients.sql. Safe to re-run.
-- Recipes stay in code (src/lib/recipes.ts); these tables only hold the costing layer on top of them.
-- Access is deny-by-default (RLS on, no policies); the existing costing_expenses module gates the app.

-- 1. Recipe ingredient -> Ingredient Library mapping --------------------------------------------
-- recipe_ingredient is the recipe's ingredient name, lower-cased and trimmed ("bread flour").
-- One mapping serves every product that uses that ingredient. density_g_per_ml only matters when the
-- library item is priced per ml (recipes are in grams); 1 = water-like.
create table if not exists public.recipe_ingredient_mappings (
  id uuid primary key default gen_random_uuid(),
  recipe_ingredient text not null check (recipe_ingredient = lower(btrim(recipe_ingredient)) and length(recipe_ingredient) > 0),
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  density_g_per_ml numeric(8,4) not null default 1 check (density_g_per_ml > 0),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_ingredient_mappings_name_key unique (recipe_ingredient)
);
create index if not exists recipe_ingredient_mappings_ingredient_idx
  on public.recipe_ingredient_mappings (ingredient_id);

-- 2. Per-product packaging and add-ons (e.g. toppings) -------------------------------------------
create table if not exists public.product_cost_items (
  id uuid primary key default gen_random_uuid(),
  product_id text not null check (length(product_id) between 1 and 100),
  ingredient_id uuid not null references public.ingredients (id) on delete restrict,
  kind text not null check (kind in ('packaging', 'addon')),
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null check (unit in ('g', 'kg', 'ml', 'L', 'pcs')),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_cost_items_unique unique (product_id, ingredient_id, kind)
);
create index if not exists product_cost_items_product_idx on public.product_cost_items (product_id);
create index if not exists product_cost_items_ingredient_idx on public.product_cost_items (ingredient_id);

-- 3. Selling price per product (set manually) -----------------------------------------------------
create table if not exists public.product_prices (
  product_id text primary key check (length(product_id) between 1 and 100),
  selling_price numeric(14,4) not null check (selling_price >= 0),
  updated_by text,
  updated_at timestamptz not null default now()
);

-- 4. Cleanup: the old cost-snapshot history and module-specific audit log are replaced by
-- the general public.audit_log (see supabase/audit-log.sql).
drop table if exists public.product_cost_snapshots;
drop table if exists public.costing_audit_log;
-- 5. Triggers and access ---------------------------------------------------------------------------
drop trigger if exists recipe_ingredient_mappings_touch on public.recipe_ingredient_mappings;
create trigger recipe_ingredient_mappings_touch before update on public.recipe_ingredient_mappings
  for each row execute function public.touch_updated_at();

drop trigger if exists product_cost_items_touch on public.product_cost_items;
create trigger product_cost_items_touch before update on public.product_cost_items
  for each row execute function public.touch_updated_at();

drop trigger if exists product_prices_touch on public.product_prices;
create trigger product_prices_touch before update on public.product_prices
  for each row execute function public.touch_updated_at();

alter table public.recipe_ingredient_mappings enable row level security;
alter table public.product_cost_items enable row level security;
alter table public.product_prices enable row level security;

revoke all on public.recipe_ingredient_mappings, public.product_cost_items,
  public.product_prices from anon, authenticated;
grant all on public.recipe_ingredient_mappings, public.product_cost_items,
  public.product_prices to service_role;

-- 6. Starter mappings for the obvious names (skipped if the library item doesn't exist) -------------
-- Olive oil is priced per ml but recipes use grams, so it gets a density of 0.91 g/ml.
insert into public.recipe_ingredient_mappings (recipe_ingredient, ingredient_id, density_g_per_ml, updated_by)
select m.recipe_ingredient, i.id, m.density, 'seed'
from (values
  ('bread flour',            'Bread flour',    1.0),
  ('wheat flour',            'Wheat flour',    1.0),
  ('salt',                   'Salt',           1.0),
  ('water',                  'Water',          1.0),
  ('extra virgin olive oil', 'Olive oil',      0.91),
  ('cheddar cheese',         'Cheddar cheese', 1.0),
  ('jalapeños',              'Jalapeno',       1.0)
) as m(recipe_ingredient, ingredient_name, density)
join public.ingredients i on lower(btrim(i.name)) = lower(m.ingredient_name)
on conflict (recipe_ingredient) do nothing;
