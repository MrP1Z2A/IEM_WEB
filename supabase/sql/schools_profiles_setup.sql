-- Multi-tenant foundation: schools + profiles
-- Run this in Supabase SQL Editor.
-- Safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Shared helper for updated_at triggers
-- -----------------------------------------------------------------------------

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Schools table (one row per tenant/school)
-- -----------------------------------------------------------------------------

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  password_hash text,
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'suspended', 'trial')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_slug_lowercase_chk check (slug = lower(slug))
);

alter table public.schools add column if not exists name text;
alter table public.schools add column if not exists slug text;
alter table public.schools add column if not exists password_hash text;
alter table public.schools add column if not exists plan text default 'starter';
alter table public.schools add column if not exists status text default 'active';
alter table public.schools add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.schools add column if not exists created_at timestamptz default now();
alter table public.schools add column if not exists updated_at timestamptz default now();

update public.schools
set
  name = coalesce(nullif(trim(name), ''), 'School-' || substr(id::text, 1, 8)),
  slug = lower(trim(slug)),
  plan = case when coalesce(plan, '') in ('starter', 'pro', 'enterprise') then plan else 'starter' end,
  status = case when coalesce(status, '') in ('active', 'suspended', 'trial') then status else 'active' end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where slug is not null;

update public.schools
set
  name = coalesce(nullif(trim(name), ''), 'School-' || substr(id::text, 1, 8)),
  slug = lower(regexp_replace(coalesce(nullif(trim(slug), ''), 'school-' || substr(id::text, 1, 8)), '[^a-z0-9-]+', '-', 'g')),
  plan = case when coalesce(plan, '') in ('starter', 'pro', 'enterprise') then plan else 'starter' end,
  status = case when coalesce(status, '') in ('active', 'suspended', 'trial') then status else 'active' end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where name is null
   or trim(name) = ''
   or slug is null
   or trim(slug) = ''
   or plan is null
   or status is null
   or created_at is null
   or updated_at is null;

create unique index if not exists schools_slug_uidx on public.schools (slug);
create index if not exists schools_created_by_idx on public.schools (created_by);
create index if not exists schools_status_idx on public.schools (status);

alter table public.schools alter column name set not null;
alter table public.schools alter column slug set not null;
alter table public.schools alter column plan set not null;
alter table public.schools alter column status set not null;
alter table public.schools alter column created_at set default now();
alter table public.schools alter column updated_at set default now();

alter table public.schools drop constraint if exists schools_slug_lowercase_chk;
alter table public.schools
  add constraint schools_slug_lowercase_chk check (slug = lower(slug));

alter table public.schools drop constraint if exists schools_plan_chk;
alter table public.schools
  add constraint schools_plan_chk check (plan in ('starter', 'pro', 'enterprise'));

alter table public.schools drop constraint if exists schools_status_chk;
alter table public.schools
  add constraint schools_status_chk check (status in ('active', 'suspended', 'trial'));

drop trigger if exists trg_schools_updated_at on public.schools;
create trigger trg_schools_updated_at
before update on public.schools
for each row execute function public.set_row_updated_at();

-- -----------------------------------------------------------------------------
-- Profiles table upgrades for tenancy and role
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id) on delete set null,
  full_name text,
  email text,
  role text not null default 'student',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists school_id uuid;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists role text default 'student';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists updated_at timestamptz default now();

-- Add FK to schools only if missing.
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'profiles'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'school_id'
  ) then
    alter table public.profiles
      add constraint profiles_school_id_fkey
      foreign key (school_id) references public.schools(id) on delete set null;
  end if;
end
$$;

update public.profiles
set
  role = case
    when coalesce(role, '') in ('owner', 'admin', 'teacher', 'staff', 'student') then role
    else 'student'
  end,
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

create index if not exists profiles_school_id_idx on public.profiles (school_id);
create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);

alter table public.profiles alter column role set not null;
alter table public.profiles alter column created_at set default now();
alter table public.profiles alter column updated_at set default now();

alter table public.profiles drop constraint if exists profiles_role_chk;
alter table public.profiles
  add constraint profiles_role_chk check (role in ('owner', 'admin', 'teacher', 'staff', 'student'));

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_row_updated_at();

-- -----------------------------------------------------------------------------
-- Helper functions used in RLS
-- -----------------------------------------------------------------------------

create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.school_id
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

-- -----------------------------------------------------------------------------
-- RLS for schools and profiles (tenant-safe baseline)
-- -----------------------------------------------------------------------------

alter table public.schools enable row level security;
alter table public.profiles enable row level security;

-- Remove old open-access policies from previous setup styles if present.
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_insert" on public.profiles;
drop policy if exists "profiles_update" on public.profiles;
drop policy if exists "profiles_delete" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_authenticated" on public.profiles;
drop policy if exists "profiles_update_authenticated" on public.profiles;
drop policy if exists "profiles_delete_authenticated" on public.profiles;

-- schools policies
-- Users can only read their own school.
drop policy if exists "schools_select_own" on public.schools;
create policy "schools_select_own"
  on public.schools
  for select
  to authenticated
  using (id = public.current_school_id());

-- Any authenticated user can create one school for onboarding.
-- School owner profile is set in a second step (or helper function later).
drop policy if exists "schools_insert_authenticated" on public.schools;
create policy "schools_insert_authenticated"
  on public.schools
  for insert
  to authenticated
  with check (created_by = auth.uid());

-- Only owner/admin from that school can update school metadata.
drop policy if exists "schools_update_owner_admin" on public.schools;
create policy "schools_update_owner_admin"
  on public.schools
  for update
  to authenticated
  using (
    id = public.current_school_id()
    and public.current_profile_role() in ('owner', 'admin')
  )
  with check (id = public.current_school_id());

-- Only owner can delete a school.
drop policy if exists "schools_delete_owner" on public.schools;
create policy "schools_delete_owner"
  on public.schools
  for delete
  to authenticated
  using (
    id = public.current_school_id()
    and public.current_profile_role() = 'owner'
  );

-- profiles policies
-- Users can read their own profile and other profiles in the same school.
drop policy if exists "profiles_select_same_school" on public.profiles;
create policy "profiles_select_same_school"
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or school_id = public.current_school_id()
  );

-- Users can create their own profile row only.
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- Self update: only non-privilege fields for own row (role/school cannot change here).
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and school_id = public.current_school_id()
    and role = public.current_profile_role()
  );

-- Owner/admin can manage profiles in their own school.
drop policy if exists "profiles_update_owner_admin" on public.profiles;
create policy "profiles_update_owner_admin"
  on public.profiles
  for update
  to authenticated
  using (
    school_id = public.current_school_id()
    and public.current_profile_role() in ('owner', 'admin')
  )
  with check (school_id = public.current_school_id());

-- Owner/admin can delete profiles in their own school.
drop policy if exists "profiles_delete_owner_admin" on public.profiles;
create policy "profiles_delete_owner_admin"
  on public.profiles
  for delete
  to authenticated
  using (
    school_id = public.current_school_id()
    and public.current_profile_role() in ('owner', 'admin')
  );
