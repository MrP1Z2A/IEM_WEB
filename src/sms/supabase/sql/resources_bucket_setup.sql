-- 1. Create the storage bucket for course resources
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'resources',
    'resources',
    true,
    52428800, -- 50MB (adjust as needed based on the 50MB limit in the frontend)
    null
)
ON CONFLICT (id) DO NOTHING;

-- 2. Setup RLS Policies for the storage bucket (allowing all authenticated users to read/write)
-- For a strict setup, replace true with more restricted checks based on school_id or class_user enrollments
CREATE POLICY "Public Access to resources Storage" 
ON storage.objects FOR SELECT 
TO public 
USING ( bucket_id = 'resources' );

CREATE POLICY "Authenticated users can upload to resources Storage" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'resources' );

CREATE POLICY "Authenticated users can update resources Storage" 
ON storage.objects FOR UPDATE 
TO authenticated 
WITH CHECK ( bucket_id = 'resources' );

CREATE POLICY "Authenticated users can delete resources Storage" 
ON storage.objects FOR DELETE 
TO authenticated 
USING ( bucket_id = 'resources' );

-- 3. Create the resources_buckets table
CREATE TABLE IF NOT EXISTS public.resources_buckets (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    school_id uuid,
    class_id uuid,
    class_course_id uuid,
    name text,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    image_url text
);

-- 4. Set up the updated_at trigger for resources_buckets
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'set_resources_buckets_updated_at' 
        AND tgrelid = 'public.resources_buckets'::regclass
    ) THEN
        CREATE TRIGGER set_resources_buckets_updated_at
        BEFORE UPDATE ON public.resources_buckets
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- 5. Enable RLS and setup policies for public.resources_buckets
ALTER TABLE public.resources_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users - resources_buckets" 
ON public.resources_buckets FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Enable insert for authenticated users - resources_buckets" 
ON public.resources_buckets FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users - resources_buckets" 
ON public.resources_buckets FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users - resources_buckets" 
ON public.resources_buckets FOR DELETE 
TO authenticated 
USING (true);
