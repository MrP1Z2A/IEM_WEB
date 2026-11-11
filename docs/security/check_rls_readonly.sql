-- READ-ONLY security check. Safe to run in the Supabase SQL Editor.
-- It reads only permission / policy settings. It never selects table rows,
-- so no names, emails or passwords are shown.

-- 1) Can the public "anon" role read or change the password columns?
--    true = anyone with the website's public key can do it (if RLS allows the row).
select
  t.table_name,
  has_column_privilege('anon', format('public.%I', t.table_name), 'temp_password', 'SELECT') as anon_can_read_temp_password,
  has_column_privilege('anon', format('public.%I', t.table_name), 'temp_password', 'UPDATE') as anon_can_update_temp_password
from information_schema.columns t
where t.table_schema = 'public'
  and t.column_name = 'temp_password'
order by t.table_name;

-- 2) Is Row Level Security switched on for the people tables?
select c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('students', 'teachers', 'student_services', 'parents', 'profiles')
order by c.relname;

-- 3) Which policies apply, and to whom?
--    A row with roles containing 'anon' (or 'public') and qual = 'true' means
--    every visitor can see/change every row of that table.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('students', 'teachers', 'student_services', 'parents', 'profiles')
order by tablename, cmd, policyname;

-- 4) Functions that anon may call which touch passwords.
select p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname ilike '%password%';
