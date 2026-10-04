-- AlterTable
ALTER TABLE "events" ADD COLUMN     "worldCup" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "world_cup_matches" (
    "id" TEXT NOT NULL,
    "roundName" TEXT NOT NULL,
    "pool" TEXT,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "homeName" TEXT NOT NULL,
    "homeAbbr" TEXT NOT NULL,
    "awayName" TEXT NOT NULL,
    "awayAbbr" TEXT NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "status" "GameStatus" NOT NULL DEFAULT 'SCHEDULED',
    "matchCentreUrl" TEXT,
    "ticketUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_cup_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "world_cup_matches_kickoffAt_idx" ON "world_cup_matches"("kickoffAt");

