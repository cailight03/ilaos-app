-- Costing & Expenses, phase 3: Expense Tracking.
-- Run once in the Supabase SQL editor, after costing-ingredients.sql and audit-log.sql. Safe to re-run.
-- Access is deny-by-default (RLS on, no policies); the existing costing_expenses module gates the app.
-- Changes are recorded in the general public.audit_log by the app (logAudit).

-- 1. Categories (defaults plus user-managed) ------------------------------------------------------
-- expense_type decides how an expense is treated in totals and future profit calculations:
--   operating : day-to-day running costs (deducted from profit)
--   material  : ingredient and packaging purchases (consumption is already counted in Product Costing,
--               so these must NOT be deducted again)
--   capital   : equipment and other long-lived assets (kept apart from operating expenses)
create table if not exists public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 60),
  expense_type text not null default 'operating' check (expense_type in ('operating', 'material', 'capital')),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_categories_name_uidx
  on public.expense_categories (lower(btrim(name)));

insert into public.expense_categories (name, expense_type, is_default) values
  ('Ingredient Purchases',        'material',  true),
  ('Packaging Purchases',         'material',  true),
  ('Electricity',                 'operating', true),
  ('Water',                       'operating', true),
  ('Marketing and Advertising',   'operating', true),
  ('Transportation and Delivery', 'operating', true),
  ('Labor',                       'operating', true),
  ('Equipment',                   'capital',   true),
  ('Maintenance and Repairs',     'operating', true),
  ('Cleaning Supplies',           'operating', true),
  ('Subscriptions and Software',  'operating', true),
  ('Miscellaneous',               'operating', true)
on conflict do nothing;

-- 2. Expenses ----------------------------------------------------------------------------------------
-- expense_type is copied from the category when the expense is saved, so history stays correct even if
-- a category is later changed. Expenses are archived, never deleted.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 120),
  category_id uuid not null references public.expense_categories (id) on delete restrict,
  expense_type text not null check (expense_type in ('operating', 'material', 'capital')),
  amount numeric(14,2) not null check (amount > 0),
  expense_date date not null,
  description text check (description is null or length(description) <= 1000),
  receipt_path text check (receipt_path is null or length(receipt_path) <= 300),
  receipt_name text check (receipt_name is null or length(receipt_name) <= 200),
  receipt_type text check (receipt_type is null or length(receipt_type) <= 100),
  created_by text not null,
  updated_by text,
  is_archived boolean not null default false,
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (expense_date desc, created_at desc);
create index if not exists expenses_category_idx on public.expenses (category_id);

-- Earlier drafts had payee and bake_date columns; drop them if that version was already run.
drop index if exists public.expenses_bake_date_idx;
alter table public.expenses drop column if exists payee;
alter table public.expenses drop column if exists bake_date;

-- 3. Triggers ----------------------------------------------------------------------------------------
-- touch_updated_at() is created by costing-ingredients.sql.
drop trigger if exists expense_categories_touch_updated_at on public.expense_categories;
create trigger expense_categories_touch_updated_at before update on public.expense_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at before update on public.expenses
  for each row execute function public.touch_updated_at();

-- A category that already has expenses keeps its type, so past totals can't silently change meaning.
create or replace function public.guard_expense_category_type() returns trigger
language plpgsql as $$
begin
  if new.expense_type is distinct from old.expense_type
     and exists (select 1 from public.expenses where category_id = old.id) then
    raise exception 'CATEGORY_TYPE_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists expense_categories_guard_type on public.expense_categories;
create trigger expense_categories_guard_type before update on public.expense_categories
  for each row execute function public.guard_expense_category_type();

-- 4. Access: deny-by-default. No policies; only service_role (which bypasses RLS) may use these. ----
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;

revoke all on public.expense_categories, public.expenses from anon, authenticated;
grant all on public.expense_categories, public.expenses to service_role;

-- 5. Receipt storage: a PRIVATE bucket ------------------------------------------------------------
-- Not public, and storage.objects gets no policy for anon or authenticated, so nobody can read or
-- write receipts directly. The app uploads with the secret key after checking module access and hands
-- out short-lived signed links. Limit 5 MB; JPEG, PNG, WebP or PDF only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('expense-receipts', 'expense-receipts', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
