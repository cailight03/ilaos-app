-- Cleanup after the catalog migration: removes the tables and rows the app no longer reads or writes.
-- Run once in the Supabase SQL editor, only after confirming the app works on the new tables.
-- DESTRUCTIVE: take a backup first (Supabase dashboard > Database > Backups). Safe to re-run.
-- Kept: product_cost_items rows of kind packaging/addon (still used by Product Costing) and product_cost_history.

begin;

-- Custom-product ingredients now live in recipe_ingredients.
delete from public.product_cost_items where kind = 'ingredient';

drop table if exists public.recipe_ingredient_mappings;
drop table if exists public.recipe_product_categories;
drop table if exists public.product_prices;
drop table if exists public.custom_products;

commit;
