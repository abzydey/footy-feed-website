-- AlterTable
ALTER TABLE "games" ADD COLUMN     "weatherFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weatherNote" TEXT;
