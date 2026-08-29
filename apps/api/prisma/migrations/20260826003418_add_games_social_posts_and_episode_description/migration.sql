-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'SOCIAL_POST';

-- AlterTable
ALTER TABLE "episodes" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "gameId" TEXT;

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "games_kickoffAt_idx" ON "games"("kickoffAt");

-- CreateIndex
CREATE INDEX "events_gameId_createdAt_idx" ON "events"("gameId", "createdAt");

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "games" ADD CONSTRAINT "games_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
