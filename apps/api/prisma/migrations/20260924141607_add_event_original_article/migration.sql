-- AlterTable
ALTER TABLE "events" ADD COLUMN     "articleBody" TEXT,
ADD COLUMN     "isOriginalArticle" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "events_slug_key" ON "events"("slug");
