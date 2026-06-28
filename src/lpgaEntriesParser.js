import {
  cleanName,
  decodeEntities,
  dedupePlayers,
  makePlayerId,
  sortLeaderboard,
  stripTags
} from "./utils.js";

export const LPGA_ENTRIES_PARSER_VERSION = "v0.2";

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

  let candidateRowsSeen = 0;
  let filteredRowsSeen = 0;

  for (let i = 0; i < usefulLines.length - 1; i++) {
    const current = usefulLines[i];
    if (!/^\d{1,3}$/.test(current)) continue;

    const entryNumber = Number(current);
    if (entryNumber < 1 || entryNumber > 200) continue;

    candidateRowsSeen += 1;

    const name = cleanName(usefulLines[i + 1]);
    const entryStatus = String(usefulLines[i + 2] || "").trim();
    const hasKnownStatus = ENTRY_STATUSES.has(entryStatus.toUpperCase());
    const exemptRank = hasKnownStatus ? usefulLines[i + 3] : entryStatus;
    const hasNumericExemptRank = /^\d{1,3}$/.test(String(exemptRank || "").trim());

    // Prevent numbered ad/link/footer blocks from being promoted into roster rows.
    if (!isLikelyEntryName(name) || (!hasKnownStatus && !hasNumericExemptRank)) {
      filteredRowsSeen += 1;
      continue;
    }

    if (seenNames.has(normalizeNameKey(name))) continue;

    const player = {
      id: "entry-" + makePlayerId({ pos: current, name }),
      pos: "-",
      entryNumber,
      name,
      today: "-",
      thru: "Pending",
      total: "-",
      status: hasKnownStatus && /^withdrawn$/i.test(entryStatus) ? "withdrawn" : "pending",
      entryStatus: hasKnownStatus ? entryStatus : "Entered",
      exemptRank: hasNumericExemptRank ? Number(exemptRank) : null,
      live: false,
      dataSource: "LPGA Entries"
    };

    seenNames.add(normalizeNameKey(name));
    players.push(player);
  }

  return {
    players: sortLeaderboard(dedupePlayers(players)),
    rawRowsSeen: candidateRowsSeen,
    filteredRowsSeen
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
  const normalized = normalizeNameKey(s);
  const words = s.split(/\s+/).filter(Boolean);

  if (s.length < 2 || s.length > 60) return false;
  if (/^\d+$/.test(s)) return false;
  if (ENTRY_STATUSES.has(s.toUpperCase())) return false;
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ' .()/-]+$/.test(s) || !/[A-Za-z]/.test(s)) return false;
  if (words.length < 2) return false;

  const blocked = [
    "no", "athlete", "entry status", "exempt rank", "sponsor tournament invite",
    "kpmg champions", "advertisement", "advertising", "official partner",
    "official partners", "privacy policy", "cookie settings", "do not sell",
    "terms of use", "california privacy notice", "newsletter", "subscribe",
    "leaderboard", "full leaderboard", "lpga professionals", "tickets", "volunteer",
    "hospitality", "watch now", "video", "view more", "learn more"
  ];

  if (blocked.some(item => normalized.includes(normalizeNameKey(item)))) return false;
  if (/https?:\/\//i.test(s) || /www\./i.test(s) || /\.com\b/i.test(s)) return false;

  return true;
}

function normalizeNameKey(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
