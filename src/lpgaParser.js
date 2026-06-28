import {
  cleanName,
  decodeEntities,
  isGolfScore,
  isThruValue,
  normalizePosition,
  normalizeThru,
  stripTags
} from "./utils.js";

export const LPGA_PARSER_VERSION = "v1.1";

export function parseLpgaLeaderboard(html) {
  const text = decodeEntities(stripTags(html))
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ");

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const eventName = findEventName(lines);
  const sourceUpdated = findSourceUpdated(lines);
  const players = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const pos = normalizePosition(lines[i]);
    if (!pos) continue;

    const window = lines.slice(i + 1, i + 14);
    const nameIndex = window.findIndex(isLikelyPlayerName);
    if (nameIndex === -1) continue;

    const name = cleanName(window[nameIndex]);
    const afterName = window.slice(nameIndex + 1);
    const scores = afterName.filter(isGolfScore).slice(0, 3);
    const thru = afterName.find(isThruValue) || "-";

    const total = scores[0] || "-";
    const today = scores[1] || "-";

    if (!name || total === "-") continue;

    const key = `${pos}-${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    players.push({
      id: key.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      pos,
      name,
      today,
      thru: normalizeThru(thru),
      total
    });
  }

  return {
    eventName,
    sourceUpdated,
    players
  };
}

function findEventName(lines) {
  const ignored = new Set(["leaderboard", "schedule", "tournaments", "players", "news", "video"]);
  const candidate = lines.find(line => {
    const lower = line.toLowerCase();
    return line.length > 8 &&
      line.length < 80 &&
      !ignored.has(lower) &&
      /(championship|classic|open|invitational|cup|tournament|women|lpga)/i.test(line);
  });
  return candidate || "Current LPGA Tournament";
}

function findSourceUpdated(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/last updated/i.test(line)) {
      const inline = line.replace(/last updated:?/i, "").trim();
      if (inline && inline !== line) return inline;
      return lines[i + 1] || null;
    }
  }
  return null;
}

function isLikelyPlayerName(value) {
  const s = cleanName(value);
  if (s.length < 4 || s.length > 45) return false;
  if (/^(no change|moved up|moved down|up|down|new)$/i.test(s)) return false;
  if (/^(today|total|thru|round|score|pos|player|country)$/i.test(s)) return false;
  if (isGolfScore(s) || isThruValue(s) || normalizePosition(s)) return false;
  return /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(s) && /[A-Za-z]/.test(s) && s.includes(" ");
}
