-- ############################################################
-- CREATE STORAGE BUCKETS FOR THE ENTIRE PORTAL
-- ############################################################

-- 1. Create 'announcements' bucket for school-wide updates
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Create 'class_image' bucket for classroom avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('class_image', 'class_image', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Create 'profiles' bucket for student and teacher photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('profiles', 'profiles', true)
ON CONFLICT (id) DO NOTHING;

-- ############################################################
-- STORAGE ACCESS POLICIES (Allow Public Read & Auth Upload)
-- ############################################################

-- Policy: Allow public access to read files from all buckets
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (true);

-- Policy: Allow authenticated users to upload files to these specific buckets
CREATE POLICY "Auth Upload" ON storage.objects
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  (bucket_id = 'announcements' OR bucket_id = 'class_image' OR bucket_id = 'profiles')
);

-- Policy: Allow creators to update/delete their own uploads
CREATE POLICY "Owner Manage" ON storage.objects
FOR ALL USING (
  auth.uid() = owner AND
  (bucket_id = 'announcements' OR bucket_id = 'class_image' OR bucket_id = 'profiles')
);
