import {
  cleanName,
  decodeEntities,
  dedupePlayers,
  isGolfScore,
  isThruValue,
  makePlayerId,
  normalizePosition,
  normalizeScore,
  normalizeStatus,
  normalizeThru,
  sortLeaderboard,
  stripTags
} from "./utils.js";

export const LPGA_PARSER_VERSION = "v1.3";

const COUNTRY_CODES = new Set([
  "USA", "KOR", "JPN", "AUS", "ENG", "SWE", "THA", "CAN", "CHN", "FRA", "GER", "ESP", "MEX", "NZL", "RSA", "NED", "SCO", "IRL", "ITA", "NOR", "DEN", "FIN", "TPE", "PHI", "MAS", "SIN", "COL", "BRA", "ARG", "IND"
]);

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
  const leaderboardLines = extractLeaderboardLines(lines);
  const parsedPlayers = parseVisibleRows(leaderboardLines);
  const players = sortLeaderboard(dedupePlayers(parsedPlayers));

  return {
    eventName,
    sourceUpdated,
    players,
    isPartial: players.length > 0 && players.length < 50,
    rawRowsSeen: players.length
  };
}

function extractLeaderboardLines(lines) {
  const start = lines.findIndex(line => /^POS$/i.test(line));
  if (start === -1) return lines;

  const endCandidates = [
    lines.findIndex((line, i) => i > start && /^About Us$/i.test(line)),
    lines.findIndex((line, i) => i > start && /^LPGA MOBILE APP$/i.test(line)),
    lines.findIndex((line, i) => i > start && /^Copyright/i.test(line))
  ].filter(index => index > start);

  const end = endCandidates.length ? Math.min(...endCandidates) : lines.length;
  return lines.slice(start, end);
}

function parseVisibleRows(lines) {
  const players = [];

  for (let i = 0; i < lines.length; i++) {
    const pos = normalizePosition(lines[i]);
    if (!pos) continue;

    // Avoid treating movement values as positions.
    if (isMovementLabel(lines[i - 1])) continue;

    let cursor = i + 1;

    if (isMovementLabel(lines[cursor])) {
      cursor += 1;
      if (/^\d+$/.test(String(lines[cursor] || "").trim())) cursor += 1;
    }

    while (cursor < lines.length && isNoise(lines[cursor])) cursor += 1;

    const name = cleanName(lines[cursor]);
    if (!isLikelyPlayerName(name)) continue;
    cursor += 1;

    const fields = [];
    while (cursor < lines.length && fields.length < 8) {
      const value = lines[cursor];
      if (isRowBoundary(lines, cursor)) break;
      if (!isNoise(value)) fields.push(value);
      cursor += 1;
    }

    const countryIndex = fields.findIndex(value => COUNTRY_CODES.has(String(value || "").trim().toUpperCase()));
    const afterCountry = countryIndex >= 0 ? fields.slice(countryIndex + 1) : fields;

    const scoring = parseScoringFields(afterCountry);
    const total = scoring.total;
    const today = scoring.today;
    const thru = scoring.thru;
    const statusValue = scoring.status;

    if (!name || total === "-") continue;

    const player = {
      pos,
      name,
      today,
      thru,
      total,
      status: normalizeStatus(statusValue)
    };

    player.id = makePlayerId(player);
    players.push(player);
  }

  return players;
}

function isRowBoundary(lines, index) {
  const current = lines[index];
  if (!normalizePosition(current)) return false;
  if (isMovementLabel(lines[index - 1])) return false;

  const next = lines[index + 1];
  if (isMovementLabel(next)) return true;
  if (isLikelyPlayerName(next)) return true;

  return false;
}

function parseScoringFields(values) {
  const cleaned = (values || [])
    .map(value => String(value || "").trim())
    .filter(value => value && !isNoise(value));

  const status = cleaned.find(isStatusValue) || null;
  const usable = cleaned.filter(value => !isStatusValue(value));

  let total = "-";
  let today = "-";
  let thru = "-";

  // LPGA visible row order is normally:
  // country, optional sponsor logo, TOT, TODAY, THRU.
  // THRU can be a hole number like 8 or 16*, which also looks like a score.
  // Therefore we must not simply filter all numeric values as scores.
  const totalIndex = usable.findIndex(isGolfScore);
  if (totalIndex === -1) return { total, today, thru, status };

  total = normalizeScore(usable[totalIndex]);

  for (let i = totalIndex + 1; i < usable.length; i++) {
    const value = usable[i];
    const normalized = String(value || "").trim().toUpperCase();

    if (today === "-" && isRoundScoreValue(normalized)) {
      today = normalizeRoundScore(normalized);
      continue;
    }

    if (isThruValue(normalized)) {
      thru = normalizeThru(normalized);
      break;
    }
  }

  return { total, today, thru, status };
}

function isRoundScoreValue(value) {
  const s = String(value || "").trim().toUpperCase();
  if (s === "-" || s === "E" || s === "EVEN") return true;

  // Round scores from LPGA are typically signed when over/under par.
  // Unsigned numbers after TODAY are much more likely to be THRU/hole values.
  return /^[+-]\d{1,2}$/.test(s);
}

function normalizeRoundScore(value) {
  const s = String(value || "").trim().toUpperCase();
  if (s === "EVEN" || s === "0") return "E";
  if (s === "-") return "-";
  return normalizeScore(s);
}

function findEventName(lines) {
  const ignored = new Set(["leaderboard", "schedule", "tournaments", "players", "news", "video", "full leaderboard"]);
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
  if (s.length < 2 || s.length > 45) return false;
  if (/^(no change|moved up|moved down|up|down|new)$/i.test(s)) return false;
  if (/^(today|total|tot|thru|round|score|pos|player|athlete|country|sponsor logo)$/i.test(s)) return false;
  if (COUNTRY_CODES.has(s.toUpperCase())) return false;
  if (isGolfScore(s) || isThruValue(s) || normalizePosition(s)) return false;
  return /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(s) && /[A-Za-z]/.test(s);
}

function isMovementLabel(value) {
  return /^(up|down|no change|moved up|moved down|new)$/i.test(String(value || "").trim());
}

function isStatusValue(value) {
  return /^(CUT|MC|MISSED CUT|MDF|WD|WITHDRAWN|DQ|DISQUALIFIED)$/i.test(String(value || "").trim());
}

function isNoise(value) {
  const s = String(value || "").trim();
  if (!s) return true;
  if (/^(Image|Sponsor Logo|Clear)$/i.test(s)) return true;
  if (/^Image:/i.test(s)) return true;
  if (COUNTRY_CODES.has(s.toUpperCase())) return false;
  return false;
}
