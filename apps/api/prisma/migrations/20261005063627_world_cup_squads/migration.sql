-- CreateTable
CREATE TABLE "world_cup_squads" (
    "abbr" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "players" JSONB NOT NULL,
    "shadows" JSONB,
    "announcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_cup_squads_pkey" PRIMARY KEY ("abbr")
);

