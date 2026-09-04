-- CreateTable
CREATE TABLE "judiciary_reports" (
    "round" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "judiciary_reports_pkey" PRIMARY KEY ("round")
);
