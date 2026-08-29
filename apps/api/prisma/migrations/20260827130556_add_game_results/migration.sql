-- AlterTable
ALTER TABLE "games" ADD COLUMN     "awayScore" INTEGER,
ADD COLUMN     "homeScore" INTEGER;

-- CreateTable
CREATE TABLE "tries" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "scorer" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tries_gameId_idx" ON "tries"("gameId");

-- AddForeignKey
ALTER TABLE "tries" ADD CONSTRAINT "tries_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tries" ADD CONSTRAINT "tries_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
