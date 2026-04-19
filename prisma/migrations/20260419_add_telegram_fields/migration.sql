ALTER TABLE "users" ALTER COLUMN "ip_fingerprint" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telegram_id" BIGINT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_telegram_id_key" ON "users"("telegram_id");
CREATE INDEX IF NOT EXISTS "users_telegram_id_idx" ON "users"("telegram_id");
