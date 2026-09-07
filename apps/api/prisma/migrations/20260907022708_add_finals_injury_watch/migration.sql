-- CreateEnum
CREATE TYPE "FinalsInjuryStatus" AS ENUM ('OUT', 'LIKELY', 'UNLIKELY', 'TBA', 'TBC');

-- CreateTable
CREATE TABLE "finals_injury_entries" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "injury" TEXT NOT NULL,
    "status" "FinalsInjuryStatus" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finals_injury_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finals_injury_entries_teamId_idx" ON "finals_injury_entries"("teamId");

-- AddForeignKey
ALTER TABLE "finals_injury_entries" ADD CONSTRAINT "finals_injury_entries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
