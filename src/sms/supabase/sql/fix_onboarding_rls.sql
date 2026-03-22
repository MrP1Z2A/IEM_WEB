-- Fix circular RLS lock on profiles for onboarding (school creation bootstrap)
-- Run this in Supabase SQL Editor AFTER schools_profiles_setup.sql.
-- Safe to re-run.

-- The original profiles_update_self policy blocked the initial school_id assignment
-- because it required school_id = current_school_id(), but current_school_id() returns
-- NULL when the user has no school yet — making it impossible to set school_id at all.
--
-- This patched version allows unrestricted self-update when the user has no school
-- (the bootstrap / onboarding case), and keeps the strict check otherwise.

alter table public.schools add column if not exists password_hash text;

-- Also fix schools SELECT policy so the creator can read their newly-created school
-- before their profile.school_id is set.
-- Without this, insert().select() on the schools table fails with an RLS error because
-- current_school_id() is still null at insert time.
drop policy if exists "schools_select_own" on public.schools;
create policy "schools_select_own"
  on public.schools
  for select
  to authenticated
  using (
    id = public.current_school_id()
    or created_by = auth.uid()
  );

drop policy if exists "profiles_update_self" on public.profiles;

create policy "profiles_update_self"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and (
      -- Bootstrap: user has no school yet — allow setting school_id and role freely.
      public.current_school_id() is null
      -- Normal self-update: can't change school or role unilaterally.
      or (
        school_id = public.current_school_id()
        and role = public.current_profile_role()
      )
    )
  );

create or replace function public.school_access_status(p_name text, p_slug text)
returns table (
  school_id uuid,
  password_set boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    s.id,
    coalesce(nullif(trim(s.password_hash), ''), '') <> '' as password_set
  from public.schools s
  where lower(trim(s.name)) = lower(trim(p_name))
    and s.slug = lower(trim(p_slug))
  limit 1;
end;
$$;

create or replace function public.school_access_enter(
  p_name text,
  p_slug text,
  p_password_hash text
)
returns table (
  school_id uuid,
  password_initialized boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_school public.schools%rowtype;
  v_user_id uuid;
  v_password_hash text;
  v_password_initialized boolean := false;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'You must be signed in to access a school.';
  end if;

  v_password_hash := trim(coalesce(p_password_hash, ''));

  if trim(coalesce(p_name, '')) = '' or trim(coalesce(p_slug, '')) = '' then
    raise exception 'School name and slug are required.';
  end if;

  if v_password_hash = '' then
    raise exception 'School password is required.';
  end if;

  select *
  into v_school
  from public.schools s
  where lower(trim(s.name)) = lower(trim(p_name))
    and s.slug = lower(trim(p_slug))
  limit 1;

  if v_school.id is null then
    raise exception 'School not found.';
  end if;

  if coalesce(nullif(trim(v_school.password_hash), ''), '') = '' then
    update public.schools
    set password_hash = v_password_hash
    where id = v_school.id;

    insert into public.profiles (id, school_id, role)
    values (v_user_id, v_school.id, 'owner')
    on conflict (id) do update
    set school_id = excluded.school_id,
        role = 'owner';

    v_password_initialized := true;
  elsif v_school.password_hash = v_password_hash then
    insert into public.profiles (id, school_id)
    values (v_user_id, v_school.id)
    on conflict (id) do update
    set school_id = excluded.school_id;
  else
    raise exception 'Invalid school password.';
  end if;

  return query select v_school.id, v_password_initialized;
end;
$$;

grant execute on function public.school_access_status(text, text) to authenticated;
grant execute on function public.school_access_enter(text, text, text) to authenticated;
