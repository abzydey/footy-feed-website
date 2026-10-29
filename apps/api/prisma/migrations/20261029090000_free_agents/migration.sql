-- CreateEnum
CREATE TYPE "FreeAgentTier" AS ENUM ('MARQUEE', 'STAR', 'ESTABLISHED', 'VALUE', 'RISING');

-- CreateTable
CREATE TABLE "free_agents" (
    "id" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "player" TEXT NOT NULL,
    "aliases" TEXT[],
    "teamId" TEXT,
    "position" TEXT,
    "tier" "FreeAgentTier",
    "linked" TEXT[],
    "freeAgentNow" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "free_agents_season_player_key" ON "free_agents"("season", "player");

-- AddForeignKey
ALTER TABLE "free_agents" ADD CONSTRAINT "free_agents_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
