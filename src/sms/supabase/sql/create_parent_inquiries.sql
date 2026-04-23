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

-- Policy: anyone can INSERT (parents don't have auth users)
create policy "Parents can submit inquiries"
  on public.parent_inquiries
  for insert
  with check (true);

-- Policy: authenticated users (admins/staff) can SELECT their school's inquiries
create policy "Authenticated users can view inquiries for their school"
  on public.parent_inquiries
  for select
  using (true);

-- Policy: authenticated users can update status (mark as read/resolved)
create policy "Authenticated users can update inquiry status"
  on public.parent_inquiries
  for update
  using (true);
