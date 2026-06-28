import {
  cleanName,
  decodeEntities,
  dedupePlayers,
  makePlayerId,
  sortLeaderboard,
  stripTags
} from "./utils.js";

export const LPGA_ENTRIES_PARSER_VERSION = "v0.1";

const ENTRY_STATUSES = new Set([
  "ENTERED",
  "ALTERNATE",
  "WITHDRAWN",
  "EXEMPT",
  "QUALIFIED",
  "INVITED"
]);

export function parseLpgaEntries(html) {
  const text = decodeEntities(stripTags(html))
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ");

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const start = findEntriesStart(lines);
  const usefulLines = start >= 0 ? lines.slice(start) : lines;
  const players = [];
  const seenNames = new Set();

  for (let i = 0; i < usefulLines.length - 1; i++) {
    const current = usefulLines[i];
    if (!/^\d{1,3}$/.test(current)) continue;

    const name = cleanName(usefulLines[i + 1]);
    const entryStatus = String(usefulLines[i + 2] || "").trim();
    if (!isLikelyEntryName(name)) continue;
    if (seenNames.has(normalizeNameKey(name))) continue;

    const hasKnownStatus = ENTRY_STATUSES.has(entryStatus.toUpperCase());
    const exemptRank = hasKnownStatus ? usefulLines[i + 3] : entryStatus;

    const player = {
      id: "entry-" + makePlayerId({ pos: current, name }),
      pos: "-",
      entryNumber: Number(current),
      name,
      today: "-",
      thru: "Pending",
      total: "-",
      status: hasKnownStatus && /^withdrawn$/i.test(entryStatus) ? "withdrawn" : "pending",
      entryStatus: hasKnownStatus ? entryStatus : "Entered",
      exemptRank: /^\d{1,3}$/.test(String(exemptRank || "")) ? Number(exemptRank) : null,
      live: false,
      dataSource: "LPGA Entries"
    };

    seenNames.add(normalizeNameKey(name));
    players.push(player);
  }

  return {
    players: sortLeaderboard(dedupePlayers(players)),
    rawRowsSeen: players.length
  };
}

function findEntriesStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/^ENTRY STATUS$/i.test(lines[i])) return i + 1;
  }
  return -1;
}

function isLikelyEntryName(value) {
  const s = cleanName(value);
  if (s.length < 2 || s.length > 50) return false;
  if (/^(no|athlete|entry status|exempt rank|sponsor tournament invite|kpmg champions)$/i.test(s)) return false;
  if (/^\d+$/.test(s)) return false;
  if (ENTRY_STATUSES.has(s.toUpperCase())) return false;
  return /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(s) && /[A-Za-z]/.test(s);
}

function normalizeNameKey(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
