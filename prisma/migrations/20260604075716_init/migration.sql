-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "impact" TEXT NOT NULL DEFAULT '',
    "base" TEXT NOT NULL DEFAULT 'master',
    "dev" BOOLEAN NOT NULL DEFAULT false,
    "qa" BOOLEAN NOT NULL DEFAULT false,
    "uat" BOOLEAN NOT NULL DEFAULT false,
    "pro" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "type" TEXT,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_history" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "branchId" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,

    CONSTRAINT "branch_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "branchId" TEXT,
    "dueDate" TEXT NOT NULL DEFAULT '',
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "console_logs" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "timestamp" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "console_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "branch_history_branchId_idx" ON "branch_history"("branchId");

-- CreateIndex
CREATE INDEX "todos_branchId_idx" ON "todos"("branchId");

-- AddForeignKey
ALTER TABLE "branch_history" ADD CONSTRAINT "branch_history_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
