-- Update attendance_records to support teacher attendance
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_context_type_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_context_type_check CHECK (context_type IN ('class', 'subject', 'teacher'));

-- Add teacher_id column
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS teacher_id TEXT REFERENCES teachers(id);

-- Make student_id optional
ALTER TABLE attendance_records ALTER COLUMN student_id DROP NOT NULL;

-- Add constraint to ensure either student_id or teacher_id is set
ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_participant_check;
ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_participant_check CHECK (
  (student_id IS NOT NULL AND teacher_id IS NULL) OR 
  (student_id IS NULL AND teacher_id IS NOT NULL)
);

-- Update unique index if exists (usually for upsert)
-- You may need to adjust this depending on your existing indexes
-- CREATE UNIQUE INDEX IF NOT EXISTS attendance_records_teacher_unique_idx ON attendance_records (context_type, context_id, attendance_date, teacher_id) WHERE teacher_id IS NOT NULL;
