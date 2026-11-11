-- =============================================================================
-- Student deletion policy: delete everything EXCEPT financial records
-- Run this once in the Supabase SQL Editor (safe to run again).
--
-- What it does when an admin deletes a student:
--   KEPT     student_payments rows (amount, dates, status, receipts) and the
--            payment_receipts storage files. The student's name/email are
--            copied onto each payment first, so the finance pages and receipts
--            still show who paid. cash_records are not student-linked: untouched.
--   DELETED  the student row, class/course enrolments, attendance, exam grades,
--            report cards, homework submissions, achievements, registrations,
--            parent rows, direct messages, group memberships, the student's
--            profile and login account (auth user).
--   FILES    the function returns the profile photo and report-card file paths;
--            the app removes those files from Storage afterwards.
--
-- Everything happens in one transaction: if any step fails, nothing is deleted.
-- Only signed-in owners/admins of the student's own school may call it.
-- =============================================================================

-- 1) Snapshot columns on payments so history survives the student row.
alter table public.student_payments add column if not exists student_name text;
alter table public.student_payments add column if not exists student_email text;
alter table public.student_payments add column if not exists student_deleted_at timestamptz;

-- Back-fill names for existing payments (only where empty).
update public.student_payments p
set student_name  = coalesce(p.student_name, s.name),
    student_email = coalesce(p.student_email, s.email)
from public.students s
where s.id::text = p.student_id
  and (p.student_name is null or p.student_email is null);

-- Keep the snapshot fresh when a student is renamed.
create or replace function public.sync_payment_student_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name or new.email is distinct from old.email then
    update public.student_payments
    set student_name = new.name, student_email = new.email
    where student_id = new.id::text;
  end if;
  return new;
end
$$;

drop trigger if exists trg_students_payment_snapshot on public.students;
create trigger trg_students_payment_snapshot
after update of name, email on public.students
for each row execute function public.sync_payment_student_snapshot();

-- New payments get the name automatically.
create or replace function public.fill_payment_student_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.student_name is null or new.student_email is null then
    select coalesce(new.student_name, s.name), coalesce(new.student_email, s.email)
    into new.student_name, new.student_email
    from public.students s
    where s.id::text = new.student_id;
  end if;
  return new;
end
$$;

drop trigger if exists trg_student_payments_snapshot on public.student_payments;
create trigger trg_student_payments_snapshot
before insert on public.student_payments
for each row execute function public.fill_payment_student_snapshot();

-- 2) Internal helper: delete rows only if that table/column exists.
create or replace function public._delete_rows_if_exists(p_table text, p_column text, p_value text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
begin
  if p_value is null or p_value = '' then
    return 0;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = p_column
  ) then
    execute format('delete from public.%I where %I::text = $1', p_table, p_column) using p_value;
    get diagnostics n = row_count;
  end if;
  return n;
end
$$;

revoke all on function public._delete_rows_if_exists(text, text, text) from public, anon, authenticated;

-- 3) The deletion function the app calls.
create or replace function public.delete_student_keep_finance(p_student_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student jsonb;
  v_auth_id text;
  v_counts jsonb := '{}'::jsonb;
  v_report_files text[] := '{}';
  v_auth_deleted boolean := false;
  v_n integer;
  t record;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to delete students.' using errcode = '42501';
  end if;

  if coalesce(public.current_profile_role(), '') not in ('owner', 'admin') then
    raise exception 'Only school owners or admins can delete students.' using errcode = '42501';
  end if;

  select to_jsonb(s) into v_student
  from public.students s
  where s.id::text = p_student_id
  for update;

  if v_student is null then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  if (v_student ->> 'school_id') is distinct from public.current_school_id()::text then
    raise exception 'This student belongs to another school.' using errcode = '42501';
  end if;

  v_auth_id := nullif(v_student ->> 'auth_user_id', '');

  -- KEEP finance: stamp who the payments belonged to.
  if to_regclass('public.student_payments') is not null then
    update public.student_payments
    set student_name = v_student ->> 'name',
        student_email = v_student ->> 'email',
        student_deleted_at = now()
    where student_id = p_student_id;
    get diagnostics v_n = row_count;
    v_counts := v_counts || jsonb_build_object('student_payments_kept', v_n);
  end if;

  -- Remember report-card files so the app can remove them from Storage.
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'report_cards' and column_name = 'file_path') then
    execute 'select coalesce(array_agg(file_path), ''{}'') from public.report_cards where student_id::text = $1 and file_path is not null'
      into v_report_files using p_student_id;
  end if;

  -- DELETE everything else linked to the student.
  for t in
    select * from (values
      ('class_course_students', 'student_id'),
      ('student_courses',       'student_id'),
      ('attendance_records',    'student_id'),
      ('attendance_records',    'context_id'),
      ('exam_grades',           'student_id'),
      ('report_cards',          'student_id'),
      ('homework_submissions',  'student_id'),
      ('student_achievements',  'student_id'),
      ('student_registrations', 'student_id'),
      ('student_registrations', 'id'),
      ('parents',               'student_id'),
      ('message_group_members', 'user_id'),
      ('messages',              'sender_id'),
      ('messages',              'receiver_id')
    ) as x(tbl, col)
  loop
    v_n := public._delete_rows_if_exists(t.tbl, t.col, p_student_id);
    if v_n > 0 then
      v_counts := v_counts || jsonb_build_object(t.tbl || '.' || t.col, v_n);
    end if;
  end loop;

  -- Messages / memberships may have been stored under the login id instead.
  if v_auth_id is not null then
    perform public._delete_rows_if_exists('message_group_members', 'user_id', v_auth_id);
    perform public._delete_rows_if_exists('messages', 'sender_id', v_auth_id);
    perform public._delete_rows_if_exists('messages', 'receiver_id', v_auth_id);
  end if;

  delete from public.students where id::text = p_student_id;

  -- Remove the student's login, but only if it is not also used by a
  -- teacher/staff record or a non-student profile (never delete an admin).
  if v_auth_id is not null
     and v_auth_id <> auth.uid()::text
     and not exists (select 1 from public.teachers where auth_user_id::text = v_auth_id)
     and not exists (select 1 from public.profiles where id::text = v_auth_id and role <> 'student')
  then
    begin
      delete from public.profiles where id::text = v_auth_id;
      delete from auth.users where id::text = v_auth_id;
      v_auth_deleted := true;
    exception when others then
      -- e.g. another table still references the user; keep the login rather
      -- than failing the whole deletion. It can be removed in Auth → Users.
      v_auth_deleted := false;
    end;
  end if;

  return jsonb_build_object(
    'student_id', p_student_id,
    'name', v_student ->> 'name',
    'avatar', v_student ->> 'avatar',
    'report_card_files', to_jsonb(v_report_files),
    'auth_user_deleted', v_auth_deleted,
    'counts', v_counts
  );
end
$$;

revoke all on function public.delete_student_keep_finance(text) from public, anon;
grant execute on function public.delete_student_keep_finance(text) to authenticated;

-- 4) Optional extra safety: stop anonymous visitors from deleting finance rows
--    directly. (Admins sign in, so they are "authenticated", not "anon".)
--    Uncomment after checking the Payments page still works on a deploy preview.
-- drop policy if exists student_payments_delete on public.student_payments;
