-- Drop Redgifs reddit_id column and its unique index
DROP INDEX IF EXISTS "videos_reddit_id_key";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "reddit_id";

-- Add local-file metadata columns
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "file_path" TEXT NOT NULL DEFAULT '';
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "file_size" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "original_filename" TEXT NOT NULL DEFAULT '';

-- Index for feed pagination by created_at (idempotent; already declared in earlier schema)
CREATE INDEX IF NOT EXISTS "videos_created_at_idx" ON "videos"("created_at");
