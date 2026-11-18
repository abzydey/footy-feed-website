-- AlterTable
ALTER TABLE "transfers" ADD COLUMN "reported" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "free_agents" ADD COLUMN "reportedTo" TEXT;
