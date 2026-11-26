-- Adds the S3 object key for a todo's image (one image per todo).
-- Run once against the database (Neon). Safe to re-run.
ALTER TABLE todos ADD COLUMN IF NOT EXISTS image_key text;
