-- Add school metadata columns to schools table
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS about TEXT,
ADD COLUMN IF NOT EXISTS logo_url TEXT,
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS address TEXT;

-- Example: Update initial data if needed
-- UPDATE public.schools SET about = 'Welcome to IEM Intelligence. We provide state-of-the-art educational management systems.' WHERE name = 'Magic Eye';
