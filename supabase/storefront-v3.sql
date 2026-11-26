-- Storefront cutover: the public storefront reads public.public_catalog instead of src/lib/store/products.ts.
-- Run once in the Supabase SQL editor, after product-catalog-v2.sql. Safe to re-run.
-- Additive: no table is dropped. Prices already set in Product Costing are never overwritten, and details you
-- have since edited in the Catalog page are left alone (seeded only while description is still empty).

-- 1. Products that offer the Sliced / Unsliced choice --------------------------------------------------------
alter table public.products add column if not exists has_slicing boolean not null default false;

-- 2. The view gains has_slicing (appended last, so create or replace is allowed) ---------------------------
create or replace view public.public_catalog as
select p.slug, p.name, p.description, p.price, p.image_path, p.unit_label, p.sort_order,
       c.slug as category_slug, c.name as category_name, c.sort_order as category_sort_order,
       p.has_slicing
from public.products p
join public.product_categories c on c.id = p.category_id
where p.is_published and p.is_active and c.is_public and c.is_active and p.price is not null;

revoke all on public.public_catalog from anon, authenticated;
grant select on public.public_catalog to anon, authenticated;
grant all on public.public_catalog to service_role;

-- 3. Storefront categories: Sourdough | Focaccia | Other ---------------------------------------------------------
insert into public.product_categories (name, slug)
select 'Sourdough', 'sourdough'
where not exists (select 1 from public.product_categories where lower(btrim(name)) = 'sourdough');

update public.product_categories set sort_order = 1 where lower(btrim(name)) = 'sourdough' and sort_order = 0;
update public.product_categories set sort_order = 2 where lower(btrim(name)) = 'focaccia'  and sort_order = 0;
update public.product_categories set sort_order = 3 where lower(btrim(name)) = 'other'     and sort_order = 0;

-- 4. Storefront details for the five recipe products ---------------------------------------------------------
-- Category moves only if the product is still in the category seeded earlier.
update public.products p
set description  = s.description,
    image_path   = s.image_path,
    price        = coalesce(p.price, s.price),
    has_slicing  = s.has_slicing,
    is_published = true,
    category_id  = case
      when p.category_id in (select id from public.product_categories where lower(btrim(name)) in ('bread', 'other', s.category))
        then (select id from public.product_categories where lower(btrim(name)) = s.category)
      else p.category_id
    end,
    name         = case
      when not exists (select 1 from public.products x where x.id <> p.id and lower(btrim(x.name)) = lower(btrim(s.new_name)))
        then s.new_name
      else p.name
    end,
    slug         = case
      when not exists (select 1 from public.products x where x.id <> p.id and x.slug = s.new_slug)
        then s.new_slug
      else p.slug
    end
from (values
  ('Plain Sourdough',       'Plain Sourdough',            'plain-sourdough',            'sourdough',
   'Our classic sourdough loaf with a tangy, chewy crumb.',  '/images/products/plain-sourdough.jpg',        250, true),
  ('Jalapeno Cheddar',      'Jalapeño Cheddar',           'jalapeno-cheddar',           'sourdough',
   'Sourdough with cheddar and a bit of a kick.',            '/images/products/jalapeno-cheddar.jpg',       350, true),
  ('Wheat Multi-seed',      'Multi-seed Sourdough',       'multi-seed-sourdough',       'sourdough',
   'A wholesome loaf with a blend of seeds and grains.',     '/images/products/multi-seed-sourdough.jpg',   250, true),
  ('Rosemary Focaccia',     'Rosemary Sea Salt Focaccia', 'rosemary-sea-salt-focaccia', 'focaccia',
   'Olive oil, fresh rosemary and flaky sea salt.',          '/images/products/rosemary-focaccia.jpg',      280, false),
  ('Tomato Pesto Focaccia', 'Tomato Pesto Focaccia',      'tomato-pesto-focaccia',      'focaccia',
   'Focaccia topped with tomatoes and house pesto.',         '/images/products/tomato-pesto-focaccia.jpg',  320, false)
) as s(cost_key, new_name, new_slug, category, description, image_path, price, has_slicing)
where p.cost_key = s.cost_key and p.description = '';

-- 5. Storefront-only products ----------------------------------------------------------------------------------
-- Each gets an empty recipe so it can be costed later; cost_key is its own id, like any custom product.
insert into public.products
  (id, cost_key, slug, name, description, category_id, price, image_path, unit_label,
   is_published, has_slicing, sort_order, created_by)
select g.id, g.id::text, g.slug, g.name, g.description, c.id, g.price, g.image_path, g.unit_label,
       true, g.has_slicing, g.sort_order, 'migration'
from (
  select gen_random_uuid() as id, v.*
  from (values
    ('cinnamon-raisin', 'Cinnamon Raisin', 'Soft, lightly sweet sourdough swirled with cinnamon.', 320,
     '/images/products/cinnamon-raisin.jpg', 'sourdough', true, 6, 'loaf'),
    ('olive-herb-focaccia', 'Olive & Herb Focaccia', 'Briny olives and Italian herbs on a pillowy base.', 300,
     '/images/products/olive-focaccia.jpg', 'focaccia', false, 7, 'piece'),
    ('banana-bread', 'Banana Bread', 'Moist, golden loaf made with ripe bananas.', 260,
     '/images/products/banana-bread.jpg', 'other', true, 8, 'loaf'),
    ('cinnamon-rolls', 'Cinnamon Rolls', 'Box of 4 rolls with cream cheese glaze.', 280,
     '/images/products/cinnamon-rolls.jpg', 'other', false, 9, 'box'),
    ('choc-chip-cookies', 'Chocolate Chip Cookies', 'Box of 6 chewy cookies with dark chocolate.', 240,
     '/images/products/choc-chip-cookies.jpg', 'other', false, 10, 'box')
  ) as v(slug, name, description, price, image_path, category, has_slicing, sort_order, unit_label)
) g
join public.product_categories c on lower(btrim(c.name)) = g.category
where not exists (
  select 1 from public.products x where x.slug = g.slug or lower(btrim(x.name)) = lower(btrim(g.name))
);

insert into public.recipes (product_id, unit_singular, unit_plural, updated_by)
select p.id, initcap(p.unit_label), initcap(p.unit_label) || 's', 'migration'
from public.products p
where p.cost_key = p.id::text
  and not exists (select 1 from public.recipes r where r.product_id = p.id);
