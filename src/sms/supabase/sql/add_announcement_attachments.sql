-- ############################################################
-- ADD ATTACHMENT COLUMNS TO ANNOUNCEMENT TABLES
-- ############################################################

-- 1. Student Activities
ALTER TABLE public.student_activities 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Parent Announcements
ALTER TABLE public.parent_announcements 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 3. Live Intel
ALTER TABLE public.live_intel 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Note: public.events already has image_url, which we will use for attachments.

-- ############################################################
-- CREATE STORAGE BUCKET FOR ANNOUNCEMENTS (Manual step in Supabase UI)
-- ############################################################
-- 1. Go to Storage in Supabase Console
-- 2. Create a new bucket named 'announcements'
-- 3. Set it to 'Public' if you want easy access, or keep Private and set RLS
-- ############################################################
