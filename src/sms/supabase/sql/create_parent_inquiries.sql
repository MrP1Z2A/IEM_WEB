-- ============================================================
-- TABLE: parent_inquiries
-- Purpose: Stores inquiry messages submitted by parents
--          from the InstitutionHub in the Parent Portal.
-- Run this once in your Supabase SQL Editor.
-- ============================================================

create table if not exists public.parent_inquiries (
  id            uuid primary key default gen_random_uuid(),
  school_id     text not null,
  parent_email  text not null,
  department    text not null default 'Academic Affairs',
  urgency       text not null default 'Normal Inquiry',
  subject       text not null,
  message       text not null,
  status        text not null default 'unread',   -- 'unread' | 'read' | 'resolved'
  created_at    timestamptz not null default now()
);

-- Index for fast admin lookups per school
create index if not exists idx_parent_inquiries_school
  on public.parent_inquiries (school_id, created_at desc);

-- Enable Row-Level Security
alter table public.parent_inquiries enable row level security;

-- Policy: anyone can INSERT (parents don't have auth users) after checking school_id validity
drop policy if exists "Parents can submit inquiries" on public.parent_inquiries;
create policy "Parents can submit inquiries"
  on public.parent_inquiries
  for insert
  with check (exists (select 1 from public.schools where id::text = school_id));

-- Policy: authenticated users (admins/staff) can SELECT their school's inquiries
drop policy if exists "Authenticated users can view inquiries for their school" on public.parent_inquiries;
create policy "Authenticated users can view inquiries for their school"
  on public.parent_inquiries
  for select
  to authenticated
  using (school_id = public.current_school_id()::text);

-- Policy: authenticated users can update status (mark as read/resolved)
drop policy if exists "Authenticated users can update inquiry status" on public.parent_inquiries;
create policy "Authenticated users can update inquiry status"
  on public.parent_inquiries
  for update
  to authenticated
  using (school_id = public.current_school_id()::text)
  with check (school_id = public.current_school_id()::text);
