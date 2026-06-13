-- Remove legacy shared/default workspace rows before making ownership mandatory.
DELETE FROM "todos" WHERE "userId" IS NULL;
DELETE FROM "console_logs" WHERE "userId" IS NULL;
DELETE FROM "branches" WHERE "userId" IS NULL;

ALTER TABLE "branches" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "todos" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "console_logs" ALTER COLUMN "userId" SET NOT NULL;
