// Shared by adminPlayers.ts (player slugs) and routes/events.ts (original
// article slugs) — pulled out here once a second caller needed the exact
// same logic, rather than duplicating it again.
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
