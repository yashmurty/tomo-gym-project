// Where an entry came from (constitution rule 12).
export enum ENTRY_SOURCE {
  // The tomo app's own forms (REST).
  APP = 'app',
  // tomo's in-app chat agent (via the MCP server, Step 4).
  CHAT = 'chat',
  // An external MCP client such as Claude Code (Step 4).
  MCP = 'mcp',
}

export const LIMITS = {
  setsPerEntry: 50,
  reps: 1000,
  setWeightKg: 1000,
  durationMin: 600,
  distanceKm: 300,
  speedKmh: 40,
  inclinePctMin: -15,
  inclinePctMax: 40,
  noteLength: 500,
  entriesPerMove: 100,
  daysPerPage: 60,
} as const;
