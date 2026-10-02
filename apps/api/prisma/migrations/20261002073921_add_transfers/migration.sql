-- CreateEnum
CREATE TYPE "TransferKind" AS ENUM ('SIGNED', 'RE_SIGNED', 'RELEASED', 'RETIRED');

-- CreateTable
CREATE TABLE "transfers" (
    "id" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "kind" "TransferKind" NOT NULL,
    "fromTeamId" TEXT,
    "toTeamId" TEXT,
    "fromLabel" TEXT,
    "toLabel" TEXT,
    "contractUntil" INTEGER,
    "eventId" TEXT,
    "announcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transfers_toTeamId_announcedAt_idx" ON "transfers"("toTeamId", "announcedAt");

-- CreateIndex
CREATE INDEX "transfers_fromTeamId_announcedAt_idx" ON "transfers"("fromTeamId", "announcedAt");

-- CreateIndex
CREATE INDEX "transfers_announcedAt_idx" ON "transfers"("announcedAt");

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fromTeamId_fkey" FOREIGN KEY ("fromTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_toTeamId_fkey" FOREIGN KEY ("toTeamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

