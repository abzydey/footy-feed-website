-- CreateTable
CREATE TABLE "judiciary_charges" (
    "id" TEXT NOT NULL,
    "round" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "charge" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "matchesToServe" INTEGER,
    "financialPenalty" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "judiciary_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "judiciary_charges_round_idx" ON "judiciary_charges"("round");

-- AddForeignKey
ALTER TABLE "judiciary_charges" ADD CONSTRAINT "judiciary_charges_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
