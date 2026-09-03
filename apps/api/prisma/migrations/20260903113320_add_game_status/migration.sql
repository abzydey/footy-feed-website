-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FULL_TIME');

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED';
