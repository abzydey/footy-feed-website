-- AlterTable
ALTER TABLE "events" ADD COLUMN     "worldCupMatchId" TEXT,
ADD COLUMN     "worldCupSide" TEXT;

-- CreateIndex
CREATE INDEX "events_worldCupMatchId_idx" ON "events"("worldCupMatchId");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_worldCupMatchId_fkey" FOREIGN KEY ("worldCupMatchId") REFERENCES "world_cup_matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

