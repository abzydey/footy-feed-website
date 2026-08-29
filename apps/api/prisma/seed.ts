import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";

// The 17 NRL teams. Real names/slugs so the app is usable immediately;
// logos/colors are left blank for the admin to fill in via the panel.
const NRL_TEAMS = [
  ["Brisbane Broncos", "Broncos", "broncos"],
  ["Canberra Raiders", "Raiders", "raiders"],
  ["Canterbury-Bankstown Bulldogs", "Bulldogs", "bulldogs"],
  ["Cronulla-Sutherland Sharks", "Sharks", "sharks"],
  ["The Dolphins", "Dolphins", "dolphins"],
  ["Gold Coast Titans", "Titans", "titans"],
  ["Manly-Warringah Sea Eagles", "Sea Eagles", "sea-eagles"],
  ["Melbourne Storm", "Storm", "storm"],
  ["Newcastle Knights", "Knights", "knights"],
  ["New Zealand Warriors", "Warriors", "warriors"],
  ["North Queensland Cowboys", "Cowboys", "cowboys"],
  ["Parramatta Eels", "Eels", "eels"],
  ["Penrith Panthers", "Panthers", "panthers"],
  ["South Sydney Rabbitohs", "Rabbitohs", "rabbitohs"],
  ["St George Illawarra Dragons", "Dragons", "dragons"],
  ["Sydney Roosters", "Roosters", "roosters"],
  ["Wests Tigers", "Tigers", "wests-tigers"],
] as const;

async function main() {
  console.log("Seeding teams...");
  for (const [name, shortName, slug] of NRL_TEAMS) {
    await prisma.team.upsert({
      where: { slug },
      create: { name, shortName, slug },
      update: { name, shortName },
    });
  }

  // A couple of sample players + an event, so the brief page templates have
  // something real to render against right away.
  const broncos = await prisma.team.findUniqueOrThrow({ where: { slug: "broncos" } });
  const player = await prisma.player.upsert({
    where: { teamId_slug: { teamId: broncos.id, slug: "sample-player" } },
    create: {
      teamId: broncos.id,
      name: "Sample Player",
      slug: "sample-player",
      position: "Fullback",
      jerseyNumber: 1,
    },
    update: {},
  });

  await prisma.event.create({
    data: {
      type: "NEWS",
      teamId: broncos.id,
      playerId: player.id,
      headline: "Sample team update",
      body: "This is a sample event tied to a team/player — replace or delete it once real updates start coming in via the admin panel.",
    },
  });

  // A GENERAL_NEWS event demonstrates the home feed's headline-aggregator
  // model — Full Set links out to the original article rather than
  // hosting it, so this carries a source name + "Read more" URL alongside
  // the headline/snippet, not just team/player fields left empty.
  await prisma.event.create({
    data: {
      type: "GENERAL_NEWS",
      headline: "NRL confirms 2027 draw released next month",
      body: "The league says next season's fixture list, including the return of a mid-season international window, will drop in the coming weeks.",
      sourceName: "Daily Telegraph",
      sourceUrl: "https://example.com/nrl/2027-draw-release",
    },
  });

  // Three SOCIAL_POST samples cover the three Social surfaces: untargeted
  // (shows on /social only), team-tied (also shows on that team's Social
  // section), and — once the game exists below — game-tied (also shows on
  // that game's Social section). Reuses headline as the "handle" and body
  // as the post text; no team/player/game required.
  await prisma.event.create({
    data: {
      type: "SOCIAL_POST",
      headline: "@FullSet",
      body: "Team lists are trickling in ahead of the weekend's action — follow your club for the moment they drop.",
    },
  });

  await prisma.event.create({
    data: {
      type: "SOCIAL_POST",
      teamId: broncos.id,
      headline: "@BroncosInsider",
      body: "Broncos fans buzzing after today's captain's run — this squad looks ready.",
    },
  });

  // One real upcoming game with one real update — seeded deliberately alone
  // (per the brief: test this before populating a full round). kickoffAt is
  // computed relative to "now" so it always shows up as upcoming in dev.
  console.log("Seeding a sample game...");
  const storm = await prisma.team.findUniqueOrThrow({ where: { slug: "storm" } });
  const kickoffAt = new Date();
  kickoffAt.setDate(kickoffAt.getDate() + 5);
  kickoffAt.setHours(19, 50, 0, 0);

  const game = await prisma.game.create({
    data: {
      homeTeamId: broncos.id,
      awayTeamId: storm.id,
      round: "Round 24",
      kickoffAt,
    },
  });

  await prisma.event.create({
    data: {
      type: "LINEUP_CHANGE",
      teamId: broncos.id,
      gameId: game.id,
      headline: "Broncos team list named",
      body: "This is a sample team-list update tied to a specific game — replace or delete it once real lineup news starts coming in via the admin panel.",
    },
  });

  // The game-tied SOCIAL_POST sample (see comment above) — deliberately has
  // no teamId, so it shows up only on /social and this game's Social
  // section, not on either team's.
  await prisma.event.create({
    data: {
      type: "SOCIAL_POST",
      gameId: game.id,
      headline: "@NRLMatchCentre",
      body: "Broncos vs Storm this weekend is shaping up to be a cracker — both sides at full strength.",
    },
  });

  // A default admin account. CHANGE THIS PASSWORD before deploying anywhere
  // real — it's here so the admin panel is usable immediately in dev.
  const adminEmail = "admin@example.com";
  const adminPassword = "change-me-now";
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      name: "Admin",
    },
    update: {},
  });
  console.log(`Seeded admin user: ${adminEmail} / ${adminPassword} (change this password!)`);

  // One sample podcast, ready to plug a real RSS feed URL into.
  const podcast = await prisma.podcast.upsert({
    where: { slug: "sample-nrl-podcast" },
    create: {
      name: "Sample NRL Podcast",
      slug: "sample-nrl-podcast",
      rssUrl: "https://example.com/feed.xml",
      description: "Placeholder — replace with a real NRL podcast RSS feed URL.",
    },
    update: {},
  });

  // One manually-added episode with a real YouTube URL in audioUrl, so the
  // Podcasts browse page has something real to render and test immediately
  // (see schema.prisma design notes on why audioUrl is reused for this).
  await prisma.episode.upsert({
    where: { podcastId_guid: { podcastId: podcast.id, guid: "sample-episode-1" } },
    create: {
      podcastId: podcast.id,
      guid: "sample-episode-1",
      title: "NRL Preview: Round 24",
      description: "A sample episode with a real YouTube link — replace or delete it once real episodes start coming in via the admin panel.",
      // A well-known, always-available public video — just here to prove the
      // embed renders and plays; swap for a real episode link via the admin panel.
      audioUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      publishedAt: new Date(),
    },
    update: {},
  });

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
