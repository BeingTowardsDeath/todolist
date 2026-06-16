-- Add branch pinning support.
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false;
