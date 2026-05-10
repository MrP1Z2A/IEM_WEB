-- Cash records setup for IEM Intelligence
-- Money in is derived from public.student_payments.
-- This table stores manual money-out entries for the Cash Records page.

create extension if not exists pgcrypto;

create table if not exists public.cash_records (
  id uuid primary key default gen_random_uuid(),
  school_id text not null,
  amount_mmk numeric(14, 0) not null default 0,
  record_date date not null default current_date,
  category text not null,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cash_records add column if not exists school_id text;
alter table public.cash_records add column if not exists amount_mmk numeric(14, 0) default 0;
alter table public.cash_records add column if not exists record_date date default current_date;
alter table public.cash_records add column if not exists category text;
alter table public.cash_records add column if not exists note text;
alter table public.cash_records add column if not exists created_by uuid references auth.users(id);
alter table public.cash_records add column if not exists created_at timestamptz default now();
alter table public.cash_records add column if not exists updated_at timestamptz default now();

update public.cash_records
set
  school_id = coalesce(school_id, ''),
  amount_mmk = coalesce(amount_mmk, 0),
  record_date = coalesce(record_date, current_date),
  category = coalesce(nullif(trim(category), ''), 'General')
where school_id is null
   or amount_mmk is null
   or record_date is null
   or category is null
   or trim(category) = '';

alter table public.cash_records alter column school_id set not null;
alter table public.cash_records alter column amount_mmk set not null;
alter table public.cash_records alter column record_date set not null;
alter table public.cash_records alter column category set not null;
alter table public.cash_records alter column created_at set default now();
alter table public.cash_records alter column created_at set not null;
alter table public.cash_records alter column updated_at set default now();
alter table public.cash_records alter column updated_at set not null;

create index if not exists cash_records_school_id_idx
  on public.cash_records (school_id);

create index if not exists cash_records_record_date_idx
  on public.cash_records (record_date desc);

create index if not exists cash_records_category_idx
  on public.cash_records (category);

create or replace function public.set_cash_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cash_records_updated_at on public.cash_records;

create trigger trg_cash_records_updated_at
before update on public.cash_records
for each row
execute function public.set_cash_records_updated_at();

alter table public.cash_records enable row level security;

drop policy if exists "cash_records_select_authenticated" on public.cash_records;
create policy "cash_records_select_authenticated"
  on public.cash_records
  for select
  to anon, authenticated
  using (true);

drop policy if exists "cash_records_insert_authenticated" on public.cash_records;
create policy "cash_records_insert_authenticated"
  on public.cash_records
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "cash_records_update_authenticated" on public.cash_records;
create policy "cash_records_update_authenticated"
  on public.cash_records
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "cash_records_delete_authenticated" on public.cash_records;
create policy "cash_records_delete_authenticated"
  on public.cash_records
  for delete
  to anon, authenticated
  using (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'cash_records'
  ) then
    alter publication supabase_realtime add table public.cash_records;
  end if;
end
$$;
