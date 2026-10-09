// The season switches. Flip them at the season's turning points; the
// menus, Home and the ladder follow.

// Next season's Round 1: Games, Team Lists and Injuries go back in the
// computer menu bar (Signings and World Cup move to More), and the ladder
// stops calling itself the final ladder.
export const IN_SEASON = false;

// When next season's finals start (September): Finals goes back in the
// phone tab bar and the computer menu bar, in place of Signings/Ladder. The
// /finals page itself always works by direct link.
export const FINALS_IN_MENU = false;

// While the Rugby League World Cup is on: World Cup gets its own tab in the
// phone tab bar. Turn off after the final (15 Nov 2026); the page stays in
// More and the computer menu bar either way.
export const WORLD_CUP_IN_MENU = true;
