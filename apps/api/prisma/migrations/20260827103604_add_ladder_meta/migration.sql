-- CreateTable
CREATE TABLE "ladder_meta" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "asOfRound" INTEGER NOT NULL,

    CONSTRAINT "ladder_meta_pkey" PRIMARY KEY ("id")
);
