-- CreateEnum
CREATE TYPE "TeamListStage" AS ENUM ('INITIAL', 'TWENTY_FOUR_HOUR', 'FINAL');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "teamListStage" "TeamListStage";
