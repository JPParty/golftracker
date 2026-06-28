import {
  cleanName,
  decodeEntities,
  dedupePlayers,
  isGolfScore,
  makePlayerId,
  normalizePosition,
  normalizeScore,
  normalizeStatus,
  normalizeThru,
  playerNameKey,
  sortLeaderboard
} from "./utils.js";

export const LPGA_HYDRATION_PARSER_VERSION = "v0.3";

const MAX_PATHS_PER_ENTRY = 80;

export function parseLpgaHydration(html) {
  const normalized = normalizeFlightText(html);
  const currentLeaderboard = extractObjectAfterMarker(normalized, '"currentLeaderboard":');
  const contextData = extractObjectAfterMarker(normalized, '"contextData":');
  const formattedLeaderboard = extractObjectAfterMarker(normalized, '"formattedLeaderboard":');

  const result = currentLeaderboard && !currentLeaderboard._parseError ? currentLeaderboard.result || null : null;
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const currentRound = Number(
    result?.currentRound ||
    result?.currentRoundNum ||
    result?.roundNum ||
    contextData?.currentRound ||
    contextData?.roundNum ||
    0
  ) || null;

  const entryPlayers = entries.map(entry => normalizeHydratedEntry(entry, { currentRound })).filter(Boolean);
  const formattedRows = Array.isArray(formattedLeaderboard?.leaderboardRows) ? formattedLeaderboard.leaderboardRows : [];
  const formattedPlayers = formattedRows.map(row => normalizeFormattedLeaderboardRow(row)).filter(Boolean);

  const bestPlayers = formattedPlayers.length >= entryPlayers.length ? formattedPlayers : entryPlayers;
  const players = sortLeaderboard(dedupePlayers(bestPlayers));
  const parseSource = formattedPlayers.length >= entryPlayers.length && formattedPlayers.length > 0
    ? "formattedLeaderboard.leaderboardRows"
    : entries.length > 0
      ? "currentLeaderboard.result.entries"
      : "none";

  return {
    parserVersion: LPGA_HYDRATION_PARSER_VERSION,
    foundCurrentLeaderboard: Boolean(currentLeaderboard),
    foundContextData: Boolean(contextData),
    foundFormattedLeaderboard: Boolean(formattedLeaderboard),
    currentRound,
    tournamentId: result?.tournament?.tournamentId || result?.tournamentId || contextData?.tournamentId || firstFormattedTournamentId(formattedRows) || null,
    tournamentCode: result?.tournament?.tournamentCode || result?.tournamentCode || contextData?.tournamenCode || contextData?.tournamentCode || null,
    tournamentStatus: result?.tournament?.tournamentStatus || contextData?.tournamentStatus || null,
    entriesCount: entries.length,
    formattedRowsCount: formattedRows.length,
    parsedEntriesCount: entryPlayers.length,
    parsedFormattedRowsCount: formattedPlayers.length,
    parsedPlayersCount: players.length,
    parseSource,
    players,
    playerSample: players.slice(0, 25),
    rawEntrySamples: entries.slice(0, 3).map(entry => summarizeEntry(entry)),
    formattedRowSamples: formattedRows.slice(0, 5).map(row => summarizeFormattedRow(row)),
    formattedLeaderboardSummary: summarizeFormattedLeaderboard(formattedLeaderboard),
    extractionNotes: buildExtractionNotes({ currentLeaderboard, entries, formattedLeaderboard, formattedRows, entryPlayers, formattedPlayers, players, parseSource })
  };
}

function normalizeFlightText(html) {
  return decodeEntities(String(html || ""))
    .replace(/\\u0022/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u002f/gi, "/")
    .replace(/\\\"/g, '"');
}

function extractObjectAfterMarker(text, marker) {
  const markerIndex = String(text || "").indexOf(marker);
  if (markerIndex === -1) return null;

  const objectStart = text.indexOf("{", markerIndex + marker.length);
  if (objectStart === -1) return null;

  const objectText = extractBalancedObject(text, objectStart);
  if (!objectText) return null;

  try {
    return JSON.parse(objectText);
  } catch (error) {
    return {
      _parseError: error.message,
      _sample: objectText.slice(0, 500)
    };
  }
}

function extractBalancedObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }

  return null;
}

function normalizeHydratedEntry(entry, { currentRound } = {}) {
  if (!entry || typeof entry !== "object") return null;

  const player = entry.player || entry.athlete || entry.players?.[0] || {};
  const name = cleanName(
    player.shortName ||
    player.displayName ||
    player.fullName ||
    [player.firstName, player.lastName].filter(Boolean).join(" ") ||
    entry.shortName ||
    entry.name ||
    entry.playerName
  );

  if (!isLikelyName(name)) return null;

  const round = findCurrentRound(entry, currentRound);
  const posRaw = firstValue(entry, ["position", "currentPosition", "rank", "startRank"]);
  const pos = normalizeDisplayPosition(posRaw);
  const total = scoreOrDash(
    firstDirect(entry, ["totalToPar", "totalToParScore", "overallToPar", "aggregateToPar", "toPar", "total", "scoreToPar"]) ??
    firstValue(entry, ["totalToPar", "totalToParScore", "overallToPar", "aggregateToPar", "total", "scoreToPar"])
  );
  const today = scoreOrDash(
    firstDirect(round, ["toPar", "roundToPar", "today", "todayToPar", "scoreToPar", "parRelativeScore", "parRelativeScoreDisplay"]) ??
    firstDirect(entry, ["today", "todayToPar", "currentRoundToPar", "roundToPar"])
  );
  const thru = normalizeThru(
    firstDirect(round, ["thru", "thruHole", "currentHole", "holesPlayed", "holesComplete", "roundThru"]) ??
    firstDirect(entry, ["thru", "thruHole", "currentHole", "holesPlayed", "holesComplete", "currentHoleNumber"])
  );

  const status = normalizeStatus(
    firstDirect(entry, ["status", "statusText", "statusName", "tournamentStatus", "entryStatus"]) ||
    firstDirect(round, ["status", "statusText", "statusName"]) ||
    statusFromPosition(posRaw)
  );

  const normalized = {
    pos,
    name,
    today,
    thru,
    total,
    status,
    live: true,
    dataSource: "LPGA Hydration",
    entryId: entry.entryId || player.entryId || null,
    playerId: player.playerId || entry.playerId || null
  };

  normalized.id = makePlayerId(normalized);
  return normalized;
}

function normalizeFormattedLeaderboardRow(row) {
  if (!Array.isArray(row) || row.length < 3) return null;

  const positionCell = row.find(cell => cell && typeof cell === "object" && (cell.type === "position" || Array.isArray(cell.positions)));
  const athleteIndex = row.findIndex(cell => cell && typeof cell === "object" && (cell.type === "athlete" || Array.isArray(cell.players)));
  const athleteCell = athleteIndex >= 0 ? row[athleteIndex] : null;
  const player = athleteCell?.players?.[0] || athleteCell?.player || {};
  const name = cleanName(
    player.name ||
    player.shortName ||
    player.displayName ||
    player.fullName ||
    [player.firstName, player.lastName].filter(Boolean).join(" ") ||
    athleteCell?.name ||
    athleteCell?.shortName
  );

  if (!isLikelyName(name)) return null;

  const entryId = athleteCell?.entryId || player.entryId || null;
  const playerId = athleteCell?.playerId || player.playerId || null;
  if (!entryId && !playerId) return null;

  const posRaw = positionCell?.positions?.[0]?.position ?? positionCell?.position ?? positionCell?.value ?? positionCell?.text ?? "-";
  const numericCells = row.slice(Math.max(athleteIndex + 1, 0)).filter(cell => cell && typeof cell === "object" && cell.value !== undefined);
  if (numericCells.length < 3) return null;

  const total = scoreOrDash(numericCells[0]?.value);
  const today = scoreOrDash(numericCells[1]?.value);
  const thru = normalizeThru(numericCells[2]?.value);
  const status = normalizeStatus(statusFromPosition(posRaw) || (thru === "Pending" ? "pending" : "active"));

  const normalized = {
    pos: normalizeDisplayPosition(posRaw),
    name,
    today,
    thru,
    total,
    status,
    live: status === "active" || status === "cut",
    dataSource: "LPGA Hydration formattedLeaderboard",
    entryId,
    playerId,
    tournamentId: athleteCell?.tournamentId || null,
    roundNum: athleteCell?.roundNum || null
  };

  normalized.id = makePlayerId(normalized);
  return normalized;
}

function normalizeDisplayPosition(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw || raw === "-") return "-";
  const normalized = normalizePosition(raw);
  if (normalized) return normalized;
  if (/^(CUT|MC|MDF|WD|DQ|DNS)$/.test(raw)) return raw;
  return raw.length <= 8 ? raw : "-";
}

function statusFromPosition(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (/^(CUT|MC|MDF)$/.test(raw)) return "cut";
  if (/^(WD|DNS)$/.test(raw)) return "withdrawn";
  if (/^DQ$/.test(raw)) return "disqualified";
  return null;
}

function findCurrentRound(entry, currentRound) {
  const rounds = Array.isArray(entry?.rounds) ? entry.rounds : [];
  if (!rounds.length) return {};

  if (currentRound) {
    const match = rounds.find(round => Number(round.roundNum || round.roundNumber || round.round) === Number(currentRound));
    if (match) return match;
  }

  return rounds[rounds.length - 1] || {};
}

function firstDirect(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  const lowerMap = new Map(Object.keys(obj).map(key => [key.toLowerCase(), key]));

  for (const key of keys) {
    const actualKey = lowerMap.get(String(key).toLowerCase());
    if (!actualKey) continue;
    const value = obj[actualKey];
    if (value !== null && value !== undefined && value !== "") return value;
  }

  return null;
}

function firstValue(obj, keys, maxDepth = 4) {
  const keySet = new Set(keys.map(key => String(key).toLowerCase()));
  const seen = new Set();

  function walk(value, depth) {
    if (!value || typeof value !== "object" || depth > maxDepth || seen.has(value)) return null;
    seen.add(value);

    if (!Array.isArray(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (keySet.has(key.toLowerCase()) && child !== null && child !== undefined && child !== "") return child;
      }
    }

    for (const child of Object.values(value)) {
      const found = walk(child, depth + 1);
      if (found !== null && found !== undefined && found !== "") return found;
    }

    return null;
  }

  return walk(obj, 0);
}

function scoreOrDash(value) {
  const s = String(value ?? "").trim().toUpperCase();
  if (!s) return "-";
  if (s === "EVEN") return "E";
  if (isGolfScore(s)) return normalizeScore(s);
  return "-";
}

function isLikelyName(value) {
  const s = cleanName(value);
  const key = playerNameKey(s);
  if (key.length < 3 || !/[a-z]/i.test(s)) return false;
  if (s.length > 70) return false;
  if (/https?:\/\//i.test(s) || /www\./i.test(s) || /\.com\b/i.test(s)) return false;
  if (/[{}<>]/.test(s)) return false;

  const normalized = s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const blockedPhrases = [
    "advertisement",
    "advertising",
    "sponsor logo",
    "official partner",
    "official partners",
    "privacy policy",
    "cookie settings",
    "do not sell",
    "terms of use",
    "california privacy notice",
    "newsletter",
    "subscribe",
    "leaderboard",
    "full leaderboard",
    "lpga professionals",
    "tickets",
    "volunteer",
    "hospitality",
    "watch now",
    "view more",
    "learn more"
  ];

  if (blockedPhrases.some(phrase => normalized.includes(phrase))) return false;
  return true;
}

function firstFormattedTournamentId(rows) {
  for (const row of rows || []) {
    if (!Array.isArray(row)) continue;
    const athleteCell = row.find(cell => cell && typeof cell === "object" && (cell.type === "athlete" || Array.isArray(cell.players)));
    if (athleteCell?.tournamentId) return athleteCell.tournamentId;
  }
  return null;
}

function summarizeEntry(entry) {
  return {
    shallowKeys: Object.keys(entry || {}).slice(0, 80),
    playerKeys: Object.keys(entry?.player || {}).slice(0, 80),
    roundKeys: Array.isArray(entry?.rounds) && entry.rounds[0] ? Object.keys(entry.rounds[0]).slice(0, 80) : [],
    scoreLikePaths: collectInterestingPaths(entry, /score|topar|total|today|thru|hole|position|rank|round|status|strokes|par/i).slice(0, MAX_PATHS_PER_ENTRY)
  };
}

function summarizeFormattedRow(row) {
  if (!Array.isArray(row)) return { kind: typeof row };

  return {
    cellTypes: row.map(cell => cell?.type || null).slice(0, 20),
    position: row.find(cell => cell?.type === "position")?.positions?.[0]?.position || null,
    athleteName: row.find(cell => cell?.type === "athlete")?.players?.[0]?.name || null,
    numericValues: row.filter(cell => cell && cell.value !== undefined).map(cell => cell.value).slice(0, 12),
    parsed: normalizeFormattedLeaderboardRow(row)
  };
}

function summarizeFormattedLeaderboard(formattedLeaderboard) {
  if (!formattedLeaderboard || formattedLeaderboard._parseError) {
    return {
      found: Boolean(formattedLeaderboard),
      parseError: formattedLeaderboard?._parseError || null
    };
  }

  const rows = formattedLeaderboard.leaderboardRows;
  return {
    found: true,
    headerCount: Array.isArray(formattedLeaderboard.leaderboardHeader) ? formattedLeaderboard.leaderboardHeader.length : null,
    leaderboardRowsCount: Array.isArray(rows) ? rows.length : null,
    tableName: formattedLeaderboard.tableName || null
  };
}

function collectInterestingPaths(obj, keyRegex, maxDepth = 5) {
  const paths = [];
  const seen = new Set();

  function walk(value, path, depth) {
    if (!value || typeof value !== "object" || depth > maxDepth || seen.has(value)) return;
    seen.add(value);

    const entries = Array.isArray(value) ? value.entries() : Object.entries(value);
    for (const [rawKey, child] of entries) {
      const key = String(rawKey);
      const childPath = path ? `${path}.${key}` : key;

      if (keyRegex.test(key) && (child === null || typeof child !== "object")) {
        paths.push({ path: childPath, value: child });
      }

      if (child && typeof child === "object" && paths.length < MAX_PATHS_PER_ENTRY) {
        walk(child, childPath, depth + 1);
      }
    }
  }

  walk(obj, "", 0);
  return paths;
}

function buildExtractionNotes({ currentLeaderboard, entries, formattedLeaderboard, formattedRows, entryPlayers, formattedPlayers, players, parseSource }) {
  const notes = [];

  if (!currentLeaderboard) notes.push("No currentLeaderboard object was extracted from the Next.js flight data.");
  else if (currentLeaderboard._parseError) notes.push(`Found currentLeaderboard marker but JSON extraction failed: ${currentLeaderboard._parseError}`);
  else if (!entries.length) notes.push("currentLeaderboard was extracted, but result.entries was not found or was empty.");
  else if (!entryPlayers.length) notes.push("currentLeaderboard.result.entries was found, but player normalization did not produce rows yet.");
  else notes.push(`currentLeaderboard.result.entries produced ${entryPlayers.length} player rows.`);

  if (!formattedLeaderboard) notes.push("No formattedLeaderboard object was extracted from the Next.js flight data.");
  else if (formattedLeaderboard._parseError) notes.push(`Found formattedLeaderboard marker but JSON extraction failed: ${formattedLeaderboard._parseError}`);
  else if (!formattedRows.length) notes.push("formattedLeaderboard was extracted, but leaderboardRows was empty.");
  else if (!formattedPlayers.length) notes.push(`formattedLeaderboard.leaderboardRows had ${formattedRows.length} rows, but row normalization did not produce players.`);
  else notes.push(`formattedLeaderboard.leaderboardRows produced ${formattedPlayers.length} player rows.`);

  notes.push(`Selected parse source: ${parseSource}; final deduped players: ${players.length}.`);
  return notes.join(" ");
}
