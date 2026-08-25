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

  // A GENERAL_NEWS event demonstrates the league-wide category — no team or
  // player, fans opt in via the separate "General NRL News" follow.
  await prisma.event.create({
    data: {
      type: "GENERAL_NEWS",
      headline: "Welcome to Footy Feed",
      body: "This is a sample league-wide news item, not tied to any single team. Replace or delete it once real breaking news starts coming in.",
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
  await prisma.podcast.upsert({
    where: { slug: "sample-nrl-podcast" },
    create: {
      name: "Sample NRL Podcast",
      slug: "sample-nrl-podcast",
      rssUrl: "https://example.com/feed.xml",
      description: "Placeholder — replace with a real NRL podcast RSS feed URL.",
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
