-- ############################################################
-- ANNOUNCEMENT SECTIONS SETUP
-- ############################################################
-- This script creates the tables and RLS policies for:
-- 1. Events
-- 2. Student Activities
-- 3. Parent Announcements
-- 4. Live Intel
-- ############################################################

-- ############################################################
-- 1. Events Table
-- ############################################################

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    type TEXT DEFAULT 'General', -- e.g., 'Holiday', 'Workshop', 'Exam'
    image_url TEXT,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to read school events' AND tablename = 'events' AND schemaname = 'public') THEN
        CREATE POLICY "Allow authenticated users to read school events"
            ON public.events FOR SELECT
            USING (auth.uid() IN (SELECT id FROM profiles WHERE school_id = events.school_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow school admins to manage events' AND tablename = 'events' AND schemaname = 'public') THEN
        CREATE POLICY "Allow school admins to manage events"
            ON public.events FOR ALL
            USING (auth.uid() IN (SELECT id FROM profiles WHERE school_id = events.school_id AND role IN ('admin', 'owner')));
    END IF;
END $$;

-- ############################################################
-- 2. Student Activities Table
-- ############################################################

CREATE TABLE IF NOT EXISTS public.student_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'fa-users', -- FontAwesome icon name
    activity_type TEXT, -- e.g., 'Club', 'Sports', 'Arts'
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.student_activities ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users to read school activities' AND tablename = 'student_activities' AND schemaname = 'public') THEN
        CREATE POLICY "Allow authenticated users to read school activities"
            ON public.student_activities FOR SELECT
            USING (auth.uid() IN (SELECT id FROM profiles WHERE school_id = student_activities.school_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow school admins to manage activities' AND tablename = 'student_activities' AND schemaname = 'public') THEN
        CREATE POLICY "Allow school admins to manage activities"
            ON public.student_activities FOR ALL
            USING (auth.uid() IN (SELECT id FROM profiles WHERE school_id = student_activities.school_id AND role IN ('admin', 'owner')));
    END IF;
END $$;

-- ############################################################
-- 3. Parent Announcements Table
-- ############################################################

CREATE TABLE IF NOT EXISTS public.parent_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    announcement_date TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    importance TEXT DEFAULT 'Medium', -- e.g., 'Low', 'Medium', 'High', 'Urgent'
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.parent_announcements ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow parents and admins to read school announcements' AND tablename = 'parent_announcements' AND schemaname = 'public') THEN
        CREATE POLICY "Allow parents and admins to read school announcements"
            ON public.parent_announcements FOR SELECT
            USING (auth.uid() IN (SELECT id FROM profiles WHERE school_id = parent_announcements.school_id));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow school admins to manage parent announcements' AND tablename = 'parent_announcements' AND schemaname = 'public') THEN
        CREATE POLICY "Allow school admins to manage parent announcements"
            ON public.parent_announcements FOR ALL
            USING (auth.uid() IN (SELECT id FROM profiles WHERE school_id = parent_announcements.school_id AND role IN ('admin', 'owner')));
    END IF;
END $$;

-- ############################################################
-- 4. Live Intel Table
-- ############################################################

CREATE TABLE IF NOT EXISTS public.live_intel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'Security', 'Login', 'Update'
    details JSONB DEFAULT '{}'::jsonb, -- Store dynamic event details
    severity TEXT DEFAULT 'Info', -- e.g., 'Info', 'Warning', 'Critical'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.live_intel ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy (Admins only for Intel)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow only school admins to read live intel' AND tablename = 'live_intel' AND schemaname = 'public') THEN
        CREATE POLICY "Allow only school admins to read live intel"
            ON public.live_intel FOR SELECT
            USING (auth.uid() IN (SELECT id FROM profiles WHERE school_id = live_intel.school_id AND role IN ('admin', 'owner', 'staff')));
    END IF;
END $$;
