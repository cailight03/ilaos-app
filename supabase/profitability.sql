-- Costing & Expenses, phase 4: Profitability Reporting.
-- Run once in the Supabase SQL editor, after product-costing.sql and expenses.sql. Safe to re-run.
-- Access is deny-by-default (RLS on, no policies); the existing costing_expenses module gates the app.

-- 1. Product cost history -------------------------------------------------------------------------
-- One row per product per day on which its unit cost changed. A bake date is costed with the row that
-- has the greatest effective_date on or before it, so later ingredient price, recipe or packaging
-- changes never alter reports for earlier bake dates.
--   unit_cost   : cost of one sold unit. NULL when the product could not be fully costed that day
--                 (unmapped ingredient, unit mismatch, ...). Reports label such days "incomplete";
--                 they never treat the cost as zero and never fall back to today's cost.
--   is_estimate : the row was back-filled rather than recorded when the cost was current.
--   source_hash : fingerprint of the cost breakdown, used by the app to skip unchanged products.
create table if not exists public.product_cost_history (
  id uuid primary key default gen_random_uuid(),
  product_id text not null check (length(product_id) between 1 and 100),
  effective_date date not null,
  unit_cost numeric(14,4) check (unit_cost is null or unit_cost >= 0),
  ingredient_cost numeric(14,4),
  packaging_cost numeric(14,4),
  is_complete boolean not null,
  is_estimate boolean not null default false,
  issue_count integer not null default 0,
  breakdown jsonb not null default '[]'::jsonb,
  source_hash text not null,
  reason text check (reason is null or length(reason) <= 200),
  created_by text not null,
  created_at timestamptz not null default now(),
  constraint product_cost_history_product_date_key unique (product_id, effective_date),
  constraint product_cost_history_complete_chk check (is_complete = (unit_cost is not null))
);

create index if not exists product_cost_history_lookup_idx
  on public.product_cost_history (product_id, effective_date desc);

-- 2. History is append-only for past days -----------------------------------------------------------
-- Today's row may be corrected (several edits in one day collapse into one row). Rows for earlier
-- dates can never be changed or deleted, so a finalized report cannot move.
create or replace function public.guard_product_cost_history() returns trigger
language plpgsql as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  if tg_op = 'DELETE' then
    raise exception 'COST_HISTORY_LOCKED';
  end if;
  if old.effective_date < today then
    raise exception 'COST_HISTORY_LOCKED';
  end if;
  if new.product_id is distinct from old.product_id or new.effective_date is distinct from old.effective_date then
    raise exception 'COST_HISTORY_LOCKED';
  end if;
  return new;
end;
$$;

drop trigger if exists product_cost_history_guard on public.product_cost_history;
create trigger product_cost_history_guard before update or delete on public.product_cost_history
  for each row execute function public.guard_product_cost_history();

-- 3. Access: deny-by-default. No policies; only service_role (which bypasses RLS) may use it. --------
alter table public.product_cost_history enable row level security;
revoke all on public.product_cost_history from anon, authenticated;
grant all on public.product_cost_history to service_role;

-- 4. Faster period totals for the profitability report ------------------------------------------------
create index if not exists expenses_type_date_idx
  on public.expenses (expense_type, expense_date) where not is_archived;

-- Orders live in Google Sheets. The app adds two columns the first time they are needed:
--   "Order Status"  (Active / Archived) : archived orders are left out of all sales and profit figures
--   "Refund Amount" (pesos)             : deducted from that order's revenue
-- No change to the sheet is required beforehand.
