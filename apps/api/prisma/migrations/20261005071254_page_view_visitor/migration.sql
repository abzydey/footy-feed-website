-- AlterTable
ALTER TABLE "page_views" ADD COLUMN     "visitorId" TEXT;

-- CreateIndex
CREATE INDEX "page_views_createdAt_visitorId_idx" ON "page_views"("createdAt", "visitorId");

