-- Guard and backfill school_id on class_course_students.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create or replace function public.class_course_students_resolve_school_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.school_id := coalesce(
    new.school_id,
    (select cc.school_id from public.class_courses cc where cc.id::text = new.class_course_id::text limit 1),
    (select c.school_id from public.classes c where c.id::text = new.class_id::text limit 1),
    (select s.school_id from public.students s where s.id::text = new.student_id::text limit 1),
    public.current_school_id(),
    public.default_school_id()
  );

  if new.school_id is null then
    raise exception 'class_course_students.school_id could not be resolved for row';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_class_course_students_resolve_school_id on public.class_course_students;
create trigger trg_class_course_students_resolve_school_id
before insert or update of class_id, class_course_id, student_id, school_id
on public.class_course_students
for each row
execute function public.class_course_students_resolve_school_id();

update public.class_course_students ccs
set school_id = coalesce(
  ccs.school_id,
  (select cc.school_id from public.class_courses cc where cc.id::text = ccs.class_course_id::text limit 1),
  (select c.school_id from public.classes c where c.id::text = ccs.class_id::text limit 1),
  (select s.school_id from public.students s where s.id::text = ccs.student_id::text limit 1),
  public.current_school_id(),
  public.default_school_id()
)
where ccs.school_id is null;

-- Verification query
select count(*) as null_school_id_rows
from public.class_course_students
where school_id is null;
