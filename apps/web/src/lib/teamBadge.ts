// Real NRL broadcast/draw abbreviations — replaces the old naive
// shortName.slice(0, 3) (e.g. "Sharks" -> "SHA" instead of the real "CRO").
export const TEAM_ABBREVIATIONS: Record<string, string> = {
  broncos: "BRI",
  raiders: "CBR",
  bulldogs: "CBY",
  sharks: "CRO",
  titans: "GLD",
  "sea-eagles": "MAN",
  storm: "MEL",
  knights: "NEW",
  cowboys: "NQL",
  eels: "PAR",
  panthers: "PEN",
  rabbitohs: "SOU",
  dragons: "STG",
  roosters: "SYD",
  "wests-tigers": "WST",
  warriors: "WAR",
  dolphins: "DOL",
};

export function teamAbbreviation(team: { slug: string; shortName: string }): string {
  return TEAM_ABBREVIATIONS[team.slug] ?? team.shortName.slice(0, 3).toUpperCase();
}
