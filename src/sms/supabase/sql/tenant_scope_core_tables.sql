-- Step 2: Add school_id to core tables + tenant-safe RLS
-- Run this AFTER schools_profiles_setup.sql
-- Safe to re-run.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.default_school_id()
returns uuid
language sql
stable
set search_path = public
as $$
  select case
    when (select count(*) from public.schools) = 1 then (select id from public.schools limit 1)
    else null
  end
$$;

create or replace function public.ensure_school_id_column(target_table text)
returns void
language plpgsql
set search_path = public
as $$
declare
  has_table boolean;
  has_fk boolean;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = target_table
  ) into has_table;

  if not has_table then
    return;
  end if;

  execute format('alter table public.%I add column if not exists school_id uuid default public.current_school_id()', target_table);
  execute format('alter table public.%I alter column school_id set default public.current_school_id()', target_table);

  select exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = target_table
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'school_id'
  ) into has_fk;

  if not has_fk then
    execute format(
      'alter table public.%I add constraint %I foreign key (school_id) references public.schools(id) on delete restrict',
      target_table,
      target_table || '_school_id_fkey'
    );
  end if;

  execute format('create index if not exists %I on public.%I (school_id)', target_table || '_school_id_idx', target_table);
end;
$$;

create or replace function public.reset_and_apply_tenant_rls(target_table text, legacy_prefixes text[] default '{}')
returns void
language plpgsql
set search_path = public
as $$
declare
  p text;
  prefixes text[];
begin
  execute format('alter table public.%I enable row level security', target_table);

  prefixes := array_append(coalesce(legacy_prefixes, '{}'), target_table);

  foreach p in array prefixes
  loop
    execute format('drop policy if exists %I on public.%I', p || '_select', target_table);
    execute format('drop policy if exists %I on public.%I', p || '_insert', target_table);
    execute format('drop policy if exists %I on public.%I', p || '_update', target_table);
    execute format('drop policy if exists %I on public.%I', p || '_delete', target_table);

    execute format('drop policy if exists %I on public.%I', p || '_select_authenticated', target_table);
    execute format('drop policy if exists %I on public.%I', p || '_insert_authenticated', target_table);
    execute format('drop policy if exists %I on public.%I', p || '_update_authenticated', target_table);
    execute format('drop policy if exists %I on public.%I', p || '_delete_authenticated', target_table);
  end loop;

  execute format('drop policy if exists %I on public.%I', target_table || '_tenant_select', target_table);
  execute format('drop policy if exists %I on public.%I', target_table || '_tenant_insert', target_table);
  execute format('drop policy if exists %I on public.%I', target_table || '_tenant_update', target_table);
  execute format('drop policy if exists %I on public.%I', target_table || '_tenant_delete', target_table);

  execute format(
    'create policy %I on public.%I for select to authenticated using (school_id = public.current_school_id())',
    target_table || '_tenant_select',
    target_table
  );

  execute format(
    'create policy %I on public.%I for insert to authenticated with check (school_id = public.current_school_id())',
    target_table || '_tenant_insert',
    target_table
  );

  execute format(
    'create policy %I on public.%I for update to authenticated using (school_id = public.current_school_id()) with check (school_id = public.current_school_id())',
    target_table || '_tenant_update',
    target_table
  );

  execute format(
    'create policy %I on public.%I for delete to authenticated using (school_id = public.current_school_id())',
    target_table || '_tenant_delete',
    target_table
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Ensure school_id exists on core tables
-- -----------------------------------------------------------------------------

select public.ensure_school_id_column('students');
select public.ensure_school_id_column('teachers');
select public.ensure_school_id_column('parents');
select public.ensure_school_id_column('classes');
select public.ensure_school_id_column('class_courses');
select public.ensure_school_id_column('class_course_students');
select public.ensure_school_id_column('student_courses');
select public.ensure_school_id_column('attendance_records');
select public.ensure_school_id_column('homework_assignments');
select public.ensure_school_id_column('live_calendar_events');
select public.ensure_school_id_column('notice_board');
select public.ensure_school_id_column('exams');
select public.ensure_school_id_column('exam_grades');
select public.ensure_school_id_column('report_cards');
select public.ensure_school_id_column('student_payments');

-- Optional table created manually in some setups.
select public.ensure_school_id_column('student_services');

-- -----------------------------------------------------------------------------
-- Backfill school_id for existing data
-- -----------------------------------------------------------------------------

-- users -> profiles mapping first
update public.students s
set school_id = coalesce(s.school_id, p.school_id, public.default_school_id())
from public.profiles p
where s.school_id is null
  and s.auth_user_id::text = p.id::text;

update public.teachers t
set school_id = coalesce(t.school_id, p.school_id, public.default_school_id())
from public.profiles p
where t.school_id is null
  and t.auth_user_id::text = p.id::text;

-- student_services (if table + auth_user_id exists)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_services'
      and column_name = 'auth_user_id'
  ) then
    execute '
      update public.student_services ss
      set school_id = coalesce(ss.school_id, p.school_id, public.default_school_id())
      from public.profiles p
      where ss.school_id is null
        and ss.auth_user_id::text = p.id::text
    ';
  end if;
end
$$;

-- hierarchical mapping via relationships
update public.parents p
set school_id = coalesce(p.school_id, s.school_id, public.default_school_id())
from public.students s
where p.school_id is null
  and p.student_id::text = s.id::text;

update public.class_courses cc
set school_id = coalesce(cc.school_id, c.school_id, public.default_school_id())
from public.classes c
where cc.school_id is null
  and cc.class_id::text = c.id::text;

update public.class_course_students ccs
set school_id = coalesce(
  ccs.school_id,
  (select cc.school_id from public.class_courses cc where cc.id::text = ccs.class_course_id::text limit 1),
  (select c.school_id from public.classes c where c.id::text = ccs.class_id::text limit 1),
  (select s.school_id from public.students s where s.id = ccs.student_id limit 1),
  public.default_school_id()
)
where ccs.school_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'student_courses'
  ) then
    update public.student_courses sc
    set school_id = coalesce(
      sc.school_id,
      (select cc.school_id from public.class_courses cc where cc.id::text = sc.course_id::text limit 1),
      (select s.school_id from public.students s where s.id::text = sc.student_id::text limit 1),
      public.default_school_id()
    )
    where sc.school_id is null;
  end if;
end
$$;

update public.attendance_records ar
set school_id = coalesce(ar.school_id, s.school_id, public.default_school_id())
from public.students s
where ar.school_id is null
  and ar.student_id::text = s.id::text;

update public.homework_assignments h
set school_id = coalesce(
  h.school_id,
  (select cc.school_id from public.class_courses cc where cc.id::text = h.class_course_id::text limit 1),
  (select c.school_id from public.classes c where c.id::text = h.class_id::text limit 1),
  public.default_school_id()
)
where h.school_id is null;

update public.exams e
set school_id = coalesce(
  e.school_id,
  (select p.school_id from public.profiles p where p.id = e.created_by limit 1),
  (select cc.school_id from public.class_courses cc where cc.id::text = e.class_course_id::text limit 1),
  (select c.school_id from public.classes c where c.id::text = e.class_id::text limit 1),
  public.default_school_id()
)
where e.school_id is null;

update public.exam_grades eg
set school_id = coalesce(
  eg.school_id,
  (select e.school_id from public.exams e where e.id::text = eg.exam_id::text limit 1),
  (select s.school_id from public.students s where s.id = eg.student_id limit 1),
  public.default_school_id()
)
where eg.school_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'report_cards'
      and column_name = 'class_id'
  ) then
    update public.report_cards rc
    set school_id = coalesce(
      rc.school_id,
      (select p.school_id from public.profiles p where p.id = rc.created_by limit 1),
      (select s.school_id from public.students s where s.id::text = rc.student_id::text limit 1),
      (select c.school_id from public.classes c where c.id::text = rc.class_id::text limit 1),
      public.default_school_id()
    )
    where rc.school_id is null;
  else
    update public.report_cards rc
    set school_id = coalesce(
      rc.school_id,
      (select p.school_id from public.profiles p where p.id = rc.created_by limit 1),
      (select s.school_id from public.students s where s.id::text = rc.student_id::text limit 1),
      public.default_school_id()
    )
    where rc.school_id is null;
  end if;
end
$$;

update public.student_payments sp
set school_id = coalesce(
  sp.school_id,
  (select p.school_id from public.profiles p where p.id = sp.created_by limit 1),
  (select s.school_id from public.students s where s.id::text = sp.student_id::text limit 1),
  public.default_school_id()
)
where sp.school_id is null;

update public.live_calendar_events l
set school_id = coalesce(
  l.school_id,
  (select p.school_id from public.profiles p where p.id = l.created_by limit 1),
  (select c.school_id from public.classes c where c.id::text = l.class_id::text limit 1),
  public.default_school_id()
)
where l.school_id is null;

update public.notice_board n
set school_id = coalesce(
  n.school_id,
  (select p.school_id from public.profiles p where p.id = n.created_by limit 1),
  public.default_school_id()
)
where n.school_id is null;

update public.classes set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.students set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.teachers set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.parents set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.class_courses set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.class_course_students set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'student_courses'
  ) then
    update public.student_courses
    set school_id = coalesce(school_id, public.default_school_id())
    where school_id is null;
  end if;
end
$$;
update public.attendance_records set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.homework_assignments set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.live_calendar_events set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.notice_board set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.exams set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.exam_grades set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.report_cards set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;
update public.student_payments set school_id = coalesce(school_id, public.default_school_id()) where school_id is null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'student_services'
  ) then
    execute 'update public.student_services set school_id = coalesce(school_id, public.default_school_id()) where school_id is null';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Tenant-safe RLS for core tables
-- -----------------------------------------------------------------------------

select public.reset_and_apply_tenant_rls('students');
select public.reset_and_apply_tenant_rls('teachers');
select public.reset_and_apply_tenant_rls('parents');
select public.reset_and_apply_tenant_rls('classes');
select public.reset_and_apply_tenant_rls('class_courses');
select public.reset_and_apply_tenant_rls('class_course_students');
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'student_courses'
  ) then
    perform public.reset_and_apply_tenant_rls('student_courses');
  end if;
end
$$;
select public.reset_and_apply_tenant_rls('attendance_records');
select public.reset_and_apply_tenant_rls('homework_assignments');
select public.reset_and_apply_tenant_rls('live_calendar_events', array['live_calendar']);
select public.reset_and_apply_tenant_rls('notice_board');
select public.reset_and_apply_tenant_rls('exams');
select public.reset_and_apply_tenant_rls('exam_grades');
select public.reset_and_apply_tenant_rls('report_cards');
select public.reset_and_apply_tenant_rls('student_payments');

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'student_services'
  ) then
    perform public.reset_and_apply_tenant_rls('student_services');
  end if;
end
$$;

-- Optional hardening for phase 3 (after app writes school_id on every insert):
-- alter table public.students alter column school_id set not null;
-- Repeat for other tables once verified.
