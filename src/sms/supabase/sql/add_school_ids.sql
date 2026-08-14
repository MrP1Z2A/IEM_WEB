-- SQL Migration: Add Custom School-Defined ID System

-- Add studentschool_id to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS studentschool_id TEXT;

-- Add teacherschool_id to teachers table
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS teacherschool_id TEXT;

-- Add staffschool_id to student_services table
ALTER TABLE student_services ADD COLUMN IF NOT EXISTS staffschool_id TEXT;

-- Update RLS if necessary (usually not required as they are just new columns)
-- but ensure they are included in existing policies if they explicitly list columns.
-- For this project, policies usually allow all columns.
