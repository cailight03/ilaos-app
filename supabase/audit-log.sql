-- General audit log: who (actor) did what (action) to which module, and when.
-- e.g. Noveel | edit | Costing | 2026-11-24 17:30
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null check (length(action) between 1 and 100),
  module text not null check (length(module) between 1 and 100),
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant all on public.audit_log to service_role;
