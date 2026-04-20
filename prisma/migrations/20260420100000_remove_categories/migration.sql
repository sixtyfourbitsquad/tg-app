-- DropVideo foreign keys to categories, remove category column and indexes
ALTER TABLE "videos" DROP CONSTRAINT IF EXISTS "videos_category_id_fkey";
DROP INDEX IF EXISTS "videos_category_id_idx";
ALTER TABLE "videos" DROP COLUMN IF EXISTS "category_id";

-- DropCategoryTable
DROP TABLE IF EXISTS "categories";

-- DropTable
DROP TABLE IF EXISTS "pipeline_logs";
