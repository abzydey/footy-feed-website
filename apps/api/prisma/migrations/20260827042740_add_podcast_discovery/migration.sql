-- CreateEnum
CREATE TYPE "ExternalEpisodeSource" AS ENUM ('YOUTUBE', 'SPOTIFY');

-- CreateTable
CREATE TABLE "tracked_shows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "youtubeChannelId" TEXT,
    "spotifyShowId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_shows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_episodes" (
    "id" TEXT NOT NULL,
    "trackedShowId" TEXT NOT NULL,
    "source" "ExternalEpisodeSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_episode_chapters" (
    "id" TEXT NOT NULL,
    "externalEpisodeId" TEXT NOT NULL,
    "timestampSeconds" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "external_episode_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracked_shows_youtubeChannelId_key" ON "tracked_shows"("youtubeChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_shows_spotifyShowId_key" ON "tracked_shows"("spotifyShowId");

-- CreateIndex
CREATE INDEX "external_episodes_trackedShowId_idx" ON "external_episodes"("trackedShowId");

-- CreateIndex
CREATE UNIQUE INDEX "external_episodes_source_externalId_key" ON "external_episodes"("source", "externalId");

-- CreateIndex
CREATE INDEX "external_episode_chapters_externalEpisodeId_idx" ON "external_episode_chapters"("externalEpisodeId");

-- AddForeignKey
ALTER TABLE "external_episodes" ADD CONSTRAINT "external_episodes_trackedShowId_fkey" FOREIGN KEY ("trackedShowId") REFERENCES "tracked_shows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_episode_chapters" ADD CONSTRAINT "external_episode_chapters_externalEpisodeId_fkey" FOREIGN KEY ("externalEpisodeId") REFERENCES "external_episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
