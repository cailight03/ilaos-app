-- Product catalog v2: Categories -> Products -> Recipes -> Recipe Ingredients -> Ingredient Library.
-- Run once in the Supabase SQL editor, after product-catalog.sql and profitability.sql. Safe to re-run.
-- Additive only: nothing existing is altered destructively or dropped. The old tables
-- (recipe_product_categories, recipe_ingredient_mappings, custom_products, product_prices and the
-- ingredient-kind rows of product_cost_items) stay until the app has been cut over and verified with
-- scripts/verify-recipe-parity.ts; a later cleanup script removes them.
-- Access is deny-by-default (RLS on, no policies). The storefront reads only public.public_catalog.

-- 1. Categories gain a slug, an order and a public flag -------------------------------------------
alter table public.product_categories add column if not exists slug text;
alter table public.product_categories add column if not exists sort_order integer not null default 0;
alter table public.product_categories add column if not exists is_public boolean not null default true;

update public.product_categories
set slug = trim(both '-' from regexp_replace(lower(btrim(name)), '[^a-z0-9]+', '-', 'g'))
where slug is null;

create unique index if not exists product_categories_slug_key on public.product_categories (slug);

-- 2. Products: the storefront catalog ---------------------------------------------------------------
-- cost_key is the stable text key already used by product_cost_history (append-only, never re-keyed),
-- product_cost_items, product_prices and the order sheet: the recipe name for former recipe products
-- ("Plain Sourdough") and the id as text for former custom products.
-- price is both the storefront price and the costing selling price (replaces product_prices).
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  cost_key text not null unique check (length(cost_key) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text not null default '' check (length(description) <= 500),
  category_id uuid not null references public.product_categories (id) on delete restrict,
  price numeric(14,4) check (price is null or price >= 0),
  image_path text check (image_path is null or length(image_path) <= 200),
  unit_label text not null default 'piece' check (length(btrim(unit_label)) between 1 and 30),
  is_published boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists products_name_key on public.products (lower(btrim(name)));
create index if not exists products_category_idx on public.products (category_id);

-- 3. Recipes: exactly one per product, internal only ------------------------------------------------
-- group_key makes products that share a dough one card in the Recipe Calculator ("focaccia").
create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products (id) on delete cascade,
  unit_singular text not null default 'Piece' check (length(btrim(unit_singular)) between 1 and 30),
  unit_plural text not null default 'Pieces' check (length(btrim(unit_plural)) between 1 and 30),
  group_key text check (group_key is null or group_key = lower(btrim(group_key))),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Recipe ingredients -------------------------------------------------------------------------------
-- Starter is a normal editable row (is_starter) with no library ingredient. Any other row points at the
-- Ingredient Library; ingredient_id may be null only for a not-yet-mapped row, which costing reports as
-- an issue exactly as an unmapped recipe ingredient is reported today.
-- density_g_per_ml only matters when the library item is priced per ml; 1 = water-like.
create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  ingredient_id uuid references public.ingredients (id) on delete restrict,
  name text not null check (length(btrim(name)) between 1 and 120),
  is_starter boolean not null default false,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null default 'g' check (unit in ('g', 'kg', 'ml', 'L', 'pcs')),
  density_g_per_ml numeric(8,4) not null default 1 check (density_g_per_ml > 0),
  sort_order integer not null default 0,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipe_ingredients_starter_chk check (not is_starter or ingredient_id is null)
);
create index if not exists recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id, sort_order);
create index if not exists recipe_ingredients_ingredient_idx on public.recipe_ingredients (ingredient_id);
create unique index if not exists recipe_ingredients_one_starter_key
  on public.recipe_ingredients (recipe_id) where is_starter;
-- A recipe lists each ingredient name once. Two names may still map to the same library item.
drop index if exists public.recipe_ingredients_library_key;
create unique index if not exists recipe_ingredients_name_key
  on public.recipe_ingredients (recipe_id, lower(btrim(name)));

-- 5. Triggers and access ---------------------------------------------------------------------------------
drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists recipes_touch on public.recipes;
create trigger recipes_touch before update on public.recipes
  for each row execute function public.touch_updated_at();
drop trigger if exists recipe_ingredients_touch on public.recipe_ingredients;
create trigger recipe_ingredients_touch before update on public.recipe_ingredients
  for each row execute function public.touch_updated_at();

alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

revoke all on public.products, public.recipes, public.recipe_ingredients from anon, authenticated;
grant all on public.products, public.recipes, public.recipe_ingredients to service_role;

-- 6. Public storefront view -------------------------------------------------------------------------------
-- The only object anon may read. It runs with its owner's rights, so the tables above stay locked, and it
-- lists no recipe, ingredient, cost or margin column.
create or replace view public.public_catalog as
select p.slug, p.name, p.description, p.price, p.image_path, p.unit_label, p.sort_order,
       c.slug as category_slug, c.name as category_name, c.sort_order as category_sort_order
from public.products p
join public.product_categories c on c.id = p.category_id
where p.is_published and p.is_active and c.is_public and c.is_active and p.price is not null;

revoke all on public.public_catalog from anon, authenticated;
grant select on public.public_catalog to anon, authenticated;
grant all on public.public_catalog to service_role;

-- 7. Seed: the five recipes that live in src/lib/recipes.ts ----------------------------------------------
-- Products start unpublished; publish them from the app once the storefront is cut over.
insert into public.product_categories (name, slug)
select 'Other', 'other'
where not exists (select 1 from public.product_categories where lower(btrim(name)) = 'other');

insert into public.products (cost_key, slug, name, category_id, price, unit_label, sort_order, created_by)
select s.cost_key, s.slug, s.name,
       coalesce(rpc.category_id, (select id from public.product_categories where lower(btrim(name)) = 'other')),
       pp.selling_price, s.unit_label, s.sort_order, 'migration'
from (values
  ('Plain Sourdough',       'plain-sourdough',       'Plain Sourdough',           'loaf',  1),
  ('Jalapeno Cheddar',      'jalapeno-cheddar',      'Jalapeño Cheddar Sourdough','loaf',  2),
  ('Wheat Multi-seed',      'wheat-multi-seed',      'Wheat Multiseed Sourdough', 'loaf',  3),
  ('Rosemary Focaccia',     'rosemary-focaccia',     'Rosemary Focaccia',         'piece', 4),
  ('Tomato Pesto Focaccia', 'tomato-pesto-focaccia', 'Tomato Pesto Focaccia',     'piece', 5)
) as s(cost_key, slug, name, unit_label, sort_order)
left join public.recipe_product_categories rpc on rpc.product_id = s.cost_key
left join public.product_prices pp on pp.product_id = s.cost_key
on conflict (cost_key) do nothing;

-- Calculator order for databases seeded before sort_order was set here.
update public.products p
set sort_order = s.sort_order
from (values
  ('Plain Sourdough', 1), ('Jalapeno Cheddar', 2), ('Wheat Multi-seed', 3),
  ('Rosemary Focaccia', 4), ('Tomato Pesto Focaccia', 5)
) as s(cost_key, sort_order)
where p.cost_key = s.cost_key and p.sort_order = 0;

insert into public.recipes (product_id, unit_singular, unit_plural, group_key, updated_by)
select p.id, s.unit_singular, s.unit_plural, s.group_key, 'migration'
from (values
  ('Plain Sourdough',       'Loaf',  'Loaves', null),
  ('Jalapeno Cheddar',      'Loaf',  'Loaves', null),
  ('Wheat Multi-seed',      'Loaf',  'Loaves', null),
  ('Rosemary Focaccia',     'Piece', 'Pieces', 'focaccia'),
  ('Tomato Pesto Focaccia', 'Piece', 'Pieces', 'focaccia')
) as s(cost_key, unit_singular, unit_plural, group_key)
join public.products p on p.cost_key = s.cost_key
on conflict (product_id) do nothing;

-- Quantities are grams per piece. Library ingredient and density come from the existing name mappings, so
-- costs stay identical. Rows are only inserted for recipes that have none yet, which keeps re-runs from
-- overwriting later edits.
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, name, is_starter, quantity, density_g_per_ml, sort_order, updated_by)
select r.id, m.ingredient_id, i.name, i.is_starter, i.grams, coalesce(m.density_g_per_ml, 1), i.sort_order, 'migration'
from (
  select * from (values
    ('Plain Sourdough', 1, 'Bread Flour', 400, false), ('Plain Sourdough', 2, 'Water', 272, false),
    ('Plain Sourdough', 3, 'Starter', 68, true),       ('Plain Sourdough', 4, 'Salt', 8, false),
    ('Jalapeno Cheddar', 1, 'Bread Flour', 400, false), ('Jalapeno Cheddar', 2, 'Water', 272, false),
    ('Jalapeno Cheddar', 3, 'Starter', 68, true),       ('Jalapeno Cheddar', 4, 'Salt', 8, false),
    ('Jalapeno Cheddar', 5, 'Cheddar Cheese', 50, false), ('Jalapeno Cheddar', 6, 'Jalapeños', 25, false),
    ('Wheat Multi-seed', 1, 'Bread Flour', 350, false), ('Wheat Multi-seed', 2, 'Wheat Flour', 50, false),
    ('Wheat Multi-seed', 3, 'Water', 272, false),       ('Wheat Multi-seed', 4, 'Starter', 64, true),
    ('Wheat Multi-seed', 5, 'Salt', 8, false)
  ) as t(cost_key, sort_order, name, grams, is_starter)
  union all
  select f.cost_key, d.sort_order, d.name, d.grams, d.is_starter
  from (values ('Rosemary Focaccia'), ('Tomato Pesto Focaccia')) as f(cost_key)
  cross join (values
    (1, 'Bread Flour', 300, false), (2, 'Water', 234, false), (3, 'Starter', 60, true),
    (4, 'Salt', 6, false), (5, 'Extra Virgin Olive Oil', 9, false)
  ) as d(sort_order, name, grams, is_starter)
) as i
join public.products p on p.cost_key = i.cost_key
join public.recipes r on r.product_id = p.id
left join public.recipe_ingredient_mappings m
  on m.recipe_ingredient = lower(btrim(i.name)) and not i.is_starter
where not exists (select 1 from public.recipe_ingredients x where x.recipe_id = r.id);

-- 8. Migrate custom products (same id, so product_cost_items.product_id keeps pointing at them) -----------
insert into public.products (id, cost_key, slug, name, category_id, price, unit_label, is_active, created_by, created_at)
select cp.id, cp.id::text,
       coalesce(nullif(trim(both '-' from regexp_replace(lower(cp.name), '[^a-z0-9]+', '-', 'g')), ''), 'product')
         || '-' || left(cp.id::text, 4),
       cp.name, cp.category_id, pp.selling_price, cp.unit_label, cp.is_active, cp.created_by, cp.created_at
from public.custom_products cp
left join public.product_prices pp on pp.product_id = cp.id::text
on conflict (cost_key) do nothing;

insert into public.recipes (product_id, unit_singular, unit_plural, updated_by)
select p.id, initcap(cp.unit_label), initcap(cp.unit_label) || 's', 'migration'
from public.custom_products cp
join public.products p on p.id = cp.id
on conflict (product_id) do nothing;

-- Their ingredient-kind cost items become recipe ingredients. The originals stay until cleanup.
insert into public.recipe_ingredients
  (recipe_id, ingredient_id, name, quantity, unit, sort_order, updated_by)
select r.id, pci.ingredient_id, ing.name, pci.quantity, pci.unit,
       row_number() over (partition by r.id order by pci.created_at, pci.id), 'migration'
from public.product_cost_items pci
join public.products p on p.cost_key = pci.product_id
join public.recipes r on r.product_id = p.id
join public.ingredients ing on ing.id = pci.ingredient_id
where pci.kind = 'ingredient'
  and not exists (select 1 from public.recipe_ingredients x where x.recipe_id = r.id);
