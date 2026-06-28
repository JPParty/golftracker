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

export const LPGA_HYDRATION_PARSER_VERSION = "v0.1-debug";

const MAX_PATHS_PER_ENTRY = 80;

export function parseLpgaHydration(html) {
  const normalized = normalizeFlightText(html);
  const currentLeaderboard = extractObjectAfterMarker(normalized, '"currentLeaderboard":');
  const contextData = extractObjectAfterMarker(normalized, '"contextData":');
  const formattedLeaderboard = extractObjectAfterMarker(normalized, '"formattedLeaderboard":');

  const result = currentLeaderboard?.result || null;
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const currentRound = Number(
    result?.currentRound ||
    result?.currentRoundNum ||
    result?.roundNum ||
    contextData?.currentRound ||
    contextData?.roundNum ||
    0
  ) || null;

  const players = sortLeaderboard(dedupePlayers(
    entries.map(entry => normalizeHydratedEntry(entry, { currentRound })).filter(Boolean)
  ));

  return {
    parserVersion: LPGA_HYDRATION_PARSER_VERSION,
    foundCurrentLeaderboard: Boolean(currentLeaderboard),
    foundContextData: Boolean(contextData),
    foundFormattedLeaderboard: Boolean(formattedLeaderboard),
    currentRound,
    tournamentId: result?.tournament?.tournamentId || result?.tournamentId || contextData?.tournamentId || null,
    tournamentCode: result?.tournament?.tournamentCode || result?.tournamentCode || contextData?.tournamenCode || contextData?.tournamentCode || null,
    tournamentStatus: result?.tournament?.tournamentStatus || contextData?.tournamentStatus || null,
    entriesCount: entries.length,
    parsedPlayersCount: players.length,
    players,
    playerSample: players.slice(0, 20),
    rawEntrySamples: entries.slice(0, 3).map(entry => summarizeEntry(entry)),
    formattedLeaderboardSummary: summarizeFormattedLeaderboard(formattedLeaderboard),
    extractionNotes: buildExtractionNotes({ currentLeaderboard, entries, players })
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
  const pos = normalizePosition(firstValue(entry, ["position", "currentPosition", "rank", "startRank"])) || "-";
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
    firstDirect(round, ["status", "statusText", "statusName"])
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
  const key = playerNameKey(value);
  return key.length >= 3 && /[a-z]/i.test(value);
}

function summarizeEntry(entry) {
  return {
    shallowKeys: Object.keys(entry || {}).slice(0, 80),
    playerKeys: Object.keys(entry?.player || {}).slice(0, 80),
    roundKeys: Array.isArray(entry?.rounds) && entry.rounds[0] ? Object.keys(entry.rounds[0]).slice(0, 80) : [],
    scoreLikePaths: collectInterestingPaths(entry, /score|topar|total|today|thru|hole|position|rank|round|status|strokes|par/i).slice(0, MAX_PATHS_PER_ENTRY)
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

function buildExtractionNotes({ currentLeaderboard, entries, players }) {
  if (!currentLeaderboard) return "No currentLeaderboard object was extracted from the Next.js flight data.";
  if (currentLeaderboard._parseError) return `Found currentLeaderboard marker but JSON extraction failed: ${currentLeaderboard._parseError}`;
  if (!entries.length) return "currentLeaderboard was extracted, but result.entries was not found or was empty.";
  if (!players.length) return "currentLeaderboard.result.entries was found, but player normalization did not produce rows yet. Inspect rawEntrySamples.";
  return "currentLeaderboard.result.entries was extracted and normalized into candidate live rows.";
}
