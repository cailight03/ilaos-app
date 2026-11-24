-- Seed: initial ingredient list imported from the spreadsheet.
-- Run in the Supabase SQL editor AFTER costing-ingredients.sql. Safe to re-run:
-- existing ingredients (matched by name, ignoring case) are skipped, never overwritten.
-- Skipped because the sheet has no price/quantity yet: Parmesan Cheese, Panettone Flour.
-- Add them in the app once priced. cost_per_base_unit is calculated by the database.

insert into public.ingredient_categories (name) values ('Produce')
on conflict do nothing;

insert into public.ingredients
  (name, category_id, purchase_quantity, purchase_unit, purchase_price, supplier, updated_by)
select v.name, c.id, v.qty, v.unit, v.price, null, 'spreadsheet import'
from (values
  ('Bread flour',          'Flour',      25000,  'g',   1563.00),
  ('Wheat flour',          'Flour',       1000,  'g',    108.00),
  ('Salt',                 'Seasonings',  1000,  'g',     20.00),
  ('Water',                'Other',       3785.41, 'ml',  25.00),
  ('Olive oil',            'Oils',        2000,  'ml',   879.00),
  ('Jalapeno',             'Produce',     1800,  'g',    368.00),
  ('Cheddar cheese',       'Dairy',       1800,  'g',   1469.00),
  ('Packaging Focaccia',   'Packaging',    100,  'pcs',  128.00),
  ('Headcap',              'Packaging',    100,  'pcs',   62.00),
  ('Black sesame',         'Seeds',        250,  'g',    130.00),
  ('White sesame',         'Seeds',        250,  'g',     99.00),
  ('Sunflower seeds',      'Seeds',        250,  'g',    130.00),
  ('Pumpkin seeds',        'Seeds',        250,  'g',    124.00),
  ('Flax seeds',           'Seeds',        250,  'g',     89.00),
  ('Oats',                 'Other',        250,  'g',     79.00),
  ('Seeds Mix',            'Seeds',        275,  'g',    114.20),
  ('Pesto',                'Other',       2000,  'g',   1115.00),
  ('Cherry tomato',        'Produce',      100,  'g',     50.00),
  ('Packaging Sourdough',  'Packaging',     50,  'pcs',  341.00)
) as v(name, category, qty, unit, price)
join public.ingredient_categories c on lower(btrim(c.name)) = lower(v.category)
on conflict (lower(btrim(name))) do nothing;

-- Check: should list 19 rows (or fewer if some already existed) with costs matching the sheet.
select name, purchase_quantity, purchase_unit, purchase_price, cost_per_base_unit, base_unit
from public.ingredients
order by name;
