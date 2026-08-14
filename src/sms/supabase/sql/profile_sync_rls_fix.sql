-- Keep public.profiles aligned with auth.users and school-member tables.
-- Run this after schools_profiles_setup.sql and tenant_scope_core_tables.sql.
-- Safe to re-run.

create or replace function public.normalize_profile_role(input_role text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(input_role, '')))
    when 'owner' then 'owner'
    when 'admin' then 'admin'
    when 'teacher' then 'teacher'
    when 'staff' then 'staff'
    when 'student_service' then 'staff'
    when 'student-service' then 'staff'
    when 'studentservice' then 'staff'
    when 'service_staff' then 'staff'
    when 'servicestaff' then 'staff'
    when 'parent' then 'parent'
    else 'student'
  end
$$;

create or replace function public.try_parse_uuid(input_value text)
returns uuid
language plpgsql
immutable
as $$
begin
  if nullif(trim(coalesce(input_value, '')), '') is null then
    return null;
  end if;

  return trim(input_value)::uuid;
exception
  when others then
    return null;
end;
$$;

create or replace function public.ensure_existing_school_id(input_school_id uuid)
returns uuid
language sql
stable
set search_path = public
as $$
  select s.id
  from public.schools s
  where s.id = input_school_id
  limit 1
$$;

alter table public.profiles add column if not exists school_id uuid;
create index if not exists profiles_school_id_idx on public.profiles (school_id);

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
end $$;

update public.profiles
set role = public.normalize_profile_role(role)
where role is distinct from public.normalize_profile_role(role);

alter table public.profiles drop constraint if exists profiles_role_chk;
alter table public.profiles
  add constraint profiles_role_chk
  check (role in ('owner', 'admin', 'teacher', 'staff', 'student', 'parent'));

create or replace function public.sync_profile_row(
  p_user_id uuid,
  p_email text default null,
  p_full_name text default null,
  p_school_id uuid default null,
  p_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(trim(coalesce(p_email, '')), '');
  v_full_name text := nullif(trim(coalesce(p_full_name, '')), '');
  v_school_id uuid := public.ensure_existing_school_id(p_school_id);
  v_role text := case
    when nullif(trim(coalesce(p_role, '')), '') is null then null
    else public.normalize_profile_role(p_role)
  end;
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.profiles (id, email, full_name, school_id, role)
  values (
    p_user_id,
    v_email,
    v_full_name,
    v_school_id,
    coalesce(v_role, 'student')
  )
  on conflict (id) do update
  set email = coalesce(excluded.email, public.profiles.email),
      full_name = coalesce(excluded.full_name, public.profiles.full_name),
      school_id = coalesce(v_school_id, public.profiles.school_id),
      role = case
        when v_role is null then public.profiles.role
        when public.profiles.role in ('owner', 'admin') and v_role not in ('owner', 'admin') then public.profiles.role
        else v_role
      end,
      updated_at = now();
end;
$$;

create or replace function public.sync_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_name text;
  v_school_id uuid;
  v_role text;
begin
  v_full_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name'
  );
  v_school_id := public.try_parse_uuid(coalesce(
    new.raw_user_meta_data ->> 'school_id',
    new.raw_app_meta_data ->> 'school_id'
  ));
  v_role := coalesce(
    new.raw_user_meta_data ->> 'app_role',
    new.raw_user_meta_data ->> 'role'
  );

  perform public.sync_profile_row(new.id, new.email, v_full_name, v_school_id, v_role);
  return new;
end;
$$;

drop trigger if exists trg_sync_profile_from_auth_user on auth.users;
create trigger trg_sync_profile_from_auth_user
after insert or update of email, raw_user_meta_data, raw_app_meta_data
on auth.users
for each row execute function public.sync_profile_from_auth_user();

create or replace function public.sync_profile_from_school_member_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
begin
  perform public.sync_profile_row(
    public.try_parse_uuid(v_row ->> 'auth_user_id'),
    v_row ->> 'email',
    coalesce(v_row ->> 'name', v_row ->> 'full_name'),
    public.try_parse_uuid(v_row ->> 'school_id'),
    v_row ->> 'role'
  );

  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'auth_user_id'
  ) then
    execute 'drop trigger if exists trg_students_sync_profile on public.students';
    execute 'create trigger trg_students_sync_profile after insert or update of auth_user_id, school_id, email, name, role on public.students for each row execute function public.sync_profile_from_school_member_record()';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teachers'
      and column_name = 'auth_user_id'
  ) then
    execute 'drop trigger if exists trg_teachers_sync_profile on public.teachers';
    execute 'create trigger trg_teachers_sync_profile after insert or update of auth_user_id, school_id, email, name, role on public.teachers for each row execute function public.sync_profile_from_school_member_record()';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_services'
      and column_name = 'auth_user_id'
  ) then
    execute 'drop trigger if exists trg_student_services_sync_profile on public.student_services';
    execute 'create trigger trg_student_services_sync_profile after insert or update of auth_user_id, school_id, email, name, role on public.student_services for each row execute function public.sync_profile_from_school_member_record()';
  end if;
end $$;

do $$
declare
  auth_row record;
  member_row record;
begin
  for auth_row in
    select
      u.id as user_id,
      u.email as email,
      coalesce(
        u.raw_user_meta_data ->> 'full_name',
        u.raw_user_meta_data ->> 'name'
      ) as full_name,
      public.try_parse_uuid(coalesce(
        u.raw_user_meta_data ->> 'school_id',
        u.raw_app_meta_data ->> 'school_id'
      )) as school_id,
      coalesce(
        u.raw_user_meta_data ->> 'app_role',
        u.raw_user_meta_data ->> 'role'
      ) as role
    from auth.users u
  loop
    perform public.sync_profile_row(
      auth_row.user_id,
      auth_row.email,
      auth_row.full_name,
      auth_row.school_id,
      auth_row.role
    );
  end loop;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'auth_user_id'
  ) then
    for member_row in
      select auth_user_id as user_id, email, name as full_name, school_id, role
      from public.students
      where auth_user_id is not null
    loop
      perform public.sync_profile_row(
        member_row.user_id,
        member_row.email,
        member_row.full_name,
        public.try_parse_uuid(member_row.school_id::text),
        member_row.role
      );
    end loop;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'teachers'
      and column_name = 'auth_user_id'
  ) then
    for member_row in
      select auth_user_id as user_id, email, name as full_name, school_id, role
      from public.teachers
      where auth_user_id is not null
    loop
      perform public.sync_profile_row(
        member_row.user_id,
        member_row.email,
        member_row.full_name,
        public.try_parse_uuid(member_row.school_id::text),
        member_row.role
      );
    end loop;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_services'
      and column_name = 'auth_user_id'
  ) then
    for member_row in
      select auth_user_id as user_id, email, name as full_name, school_id, role
      from public.student_services
      where auth_user_id is not null
    loop
      perform public.sync_profile_row(
        member_row.user_id,
        member_row.email,
        member_row.full_name,
        public.try_parse_uuid(member_row.school_id::text),
        member_row.role
      );
    end loop;
  end if;
end $$;
