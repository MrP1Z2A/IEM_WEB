-- Report Cards setup for IEM Intelligence
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  class_id text,
  report_date date not null default current_date,
  report_type text not null default 'uploaded' check (report_type in ('uploaded', 'generated')),
  title text,
  content text,
  file_path text,
  file_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.report_cards add column if not exists report_type text default 'uploaded';
alter table public.report_cards add column if not exists class_id text;
alter table public.report_cards add column if not exists title text;
alter table public.report_cards add column if not exists content text;
alter table public.report_cards add column if not exists file_path text;
alter table public.report_cards add column if not exists file_name text;
alter table public.report_cards alter column report_type set default 'uploaded';
alter table public.report_cards alter column report_type set not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'report_cards' and column_name = 'class_id'
  ) then
    alter table public.report_cards alter column class_id drop not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'report_cards' and column_name = 'class_course_id'
  ) then
    alter table public.report_cards alter column class_course_id drop not null;
  end if;
end
$$;

create index if not exists report_cards_student_id_idx
  on public.report_cards (student_id);

create index if not exists report_cards_class_id_idx
  on public.report_cards (class_id);

create index if not exists report_cards_report_date_idx
  on public.report_cards (report_date desc);

create index if not exists report_cards_report_type_idx
  on public.report_cards (report_type);

create index if not exists report_cards_file_path_idx
  on public.report_cards (file_path);

create or replace function public.set_report_cards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_report_cards_updated_at on public.report_cards;

create trigger trg_report_cards_updated_at
before update on public.report_cards
for each row
execute function public.set_report_cards_updated_at();

alter table public.report_cards enable row level security;

drop policy if exists "report_cards_select_authenticated" on public.report_cards;
create policy "report_cards_select_authenticated"
  on public.report_cards
  for select
  to anon, authenticated
  using (true);

drop policy if exists "report_cards_insert_authenticated" on public.report_cards;
create policy "report_cards_insert_authenticated"
  on public.report_cards
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "report_cards_update_authenticated" on public.report_cards;
create policy "report_cards_update_authenticated"
  on public.report_cards
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "report_cards_delete_authenticated" on public.report_cards;
create policy "report_cards_delete_authenticated"
  on public.report_cards
  for delete
  to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public)
values ('report_cards', 'report_cards', false)
on conflict (id) do nothing;

drop policy if exists "report_cards_storage_select" on storage.objects;
create policy "report_cards_storage_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'report_cards');

drop policy if exists "report_cards_storage_insert" on storage.objects;
create policy "report_cards_storage_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'report_cards');

drop policy if exists "report_cards_storage_update" on storage.objects;
create policy "report_cards_storage_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'report_cards')
  with check (bucket_id = 'report_cards');

drop policy if exists "report_cards_storage_delete" on storage.objects;
create policy "report_cards_storage_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'report_cards');
