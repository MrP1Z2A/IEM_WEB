-- -----------------------------------------------------------------------------
-- Admin Security Settings: Multi-tenant & Synchronized with Schools
-- -----------------------------------------------------------------------------

-- 1. Create the new table
CREATE TABLE IF NOT EXISTS public.admin_security_settings (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  delete_password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Backfill from existing schools
INSERT INTO public.admin_security_settings (school_id, delete_password_hash)
SELECT id, password_hash 
FROM public.schools
WHERE password_hash IS NOT NULL
ON CONFLICT (school_id) DO UPDATE 
SET delete_password_hash = EXCLUDED.delete_password_hash;

-- 3. Update the verification RPC function
CREATE OR REPLACE FUNCTION public.verify_admin_delete_password(input_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  -- Get the hash for the current tenant school
  SELECT delete_password_hash
  INTO stored_hash
  FROM public.admin_security_settings
  WHERE school_id = public.current_school_id()
  LIMIT 1;

  IF stored_hash IS NULL THEN
    -- Fallback to school password if no specific security setting exists
    SELECT password_hash
    INTO stored_hash
    FROM public.schools
    WHERE id = public.current_school_id()
    LIMIT 1;
  END IF;

  RETURN stored_hash = input_password;
END;
$$;

-- 4. Add synchronization trigger (Optional but recommended)
CREATE OR REPLACE FUNCTION public.sync_school_password_to_security()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_security_settings (school_id, delete_password_hash)
  VALUES (NEW.id, NEW.password_hash)
  ON CONFLICT (school_id) DO UPDATE
  SET delete_password_hash = EXCLUDED.delete_password_hash,
      updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_school_password ON public.schools;
CREATE TRIGGER trg_sync_school_password
AFTER INSERT OR UPDATE OF password_hash ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.sync_school_password_to_security();

-- 5. Cleanup the old single-row table if it exists
-- DROP TABLE IF EXISTS public.app_admin_settings;
