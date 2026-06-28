import {
  dedupePlayers,
  makePlayerId,
  normalizePosition,
  normalizeScore,
  normalizeStatus,
  normalizeThru,
  sortLeaderboard
} from "./utils.js";

export const ESPN_PARSER_VERSION = "v0.1";

export function parseEspnLeaderboard(json) {
  const event = findBestEvent(json);
  const eventName = event?.name || event?.shortName || event?.displayName || "Current LPGA Tournament";
  const competitors = collectCompetitors(event || json);
  const players = sortLeaderboard(dedupePlayers(competitors.map(normalizeEspnCompetitor).filter(Boolean)));

  return {
    eventName,
    sourceUpdated: findSourceUpdated(json),
    players
  };
}

function findBestEvent(json) {
  const events = Array.isArray(json?.events) ? json.events : [];
  if (!events.length) return json?.event || null;

  return events.find(event => {
    const status = String(event?.status?.type?.state || event?.status?.type?.name || "").toLowerCase();
    return status && status !== "post";
  }) || events[0];
}

function collectCompetitors(root) {
  const found = [];
  const seen = new Set();

  function walk(value) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }

    if (looksLikeCompetitor(value)) {
      const key = value.id || value.uid || value.athlete?.id || value.athlete?.uid || JSON.stringify(value).slice(0, 200);
      if (!seen.has(key)) {
        seen.add(key);
        found.push(value);
      }
    }

    for (const child of Object.values(value)) walk(child);
  }

  walk(root);
  return found;
}

function looksLikeCompetitor(value) {
  const name = getPlayerName(value);
  if (!name) return false;

  const hasGolfScore = firstPresent(value, [
    "total", "toPar", "score", "displayScore", "today", "thru", "position", "rank", "curatedRank.current"
  ]) !== null;

  const hasStats = Array.isArray(value.statistics) || Array.isArray(value.stats) || Array.isArray(value.linescores);

  return Boolean(name && (hasGolfScore || hasStats));
}

function normalizeEspnCompetitor(value) {
  const name = getPlayerName(value);
  if (!name) return null;

  const stats = flattenStats(value);

  const pos = normalizePosition(
    firstPresent(value, ["position", "rank", "curatedRank.current", "order", "displayOrder"]) ??
    firstPresent(stats, ["position", "rank", "pos"])
  ) || "-";

  const total = normalizeScore(
    firstPresent(value, ["total", "toPar", "score", "displayScore", "scoreDisplay"]) ??
    firstPresent(stats, ["total", "toPar", "score", "scoreToPar", "totalToPar"])
  );

  const today = normalizeScore(
    firstPresent(value, ["today", "currentRoundScore", "roundScore"]) ??
    firstPresent(stats, ["today", "currentRound", "round", "roundScore"])
  );

  const thru = normalizeThru(
    firstPresent(value, ["thru", "through", "holesThrough", "status.displayValue"]) ??
    firstPresent(stats, ["thru", "through", "holesThrough"])
  );

  const status = normalizeStatus(
    firstPresent(value, ["status.type.name", "status.type.description", "status.displayValue", "status", "competitionStatus"]) ??
    firstPresent(stats, ["status"])
  );

  if (!name || total === "-") return null;

  const player = {
    pos,
    name,
    today: today || "-",
    thru: thru || "-",
    total,
    status
  };

  player.id = makePlayerId(player);
  return player;
}

function getPlayerName(value) {
  return firstPresent(value, [
    "athlete.displayName",
    "athlete.fullName",
    "athlete.shortName",
    "displayName",
    "fullName",
    "name",
    "shortName"
  ]);
}

function flattenStats(value) {
  const output = {};
  const statArrays = [value?.statistics, value?.stats, value?.linescores].filter(Array.isArray);

  for (const arr of statArrays) {
    for (const stat of arr) {
      const key = stat?.name || stat?.abbreviation || stat?.displayName || stat?.shortDisplayName;
      const val = stat?.displayValue ?? stat?.value;
      if (key && val !== undefined && val !== null) output[String(key)] = val;
    }
  }

  return output;
}

function firstPresent(obj, paths) {
  for (const path of paths) {
    const value = getPath(obj, path);
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function getPath(obj, path) {
  return String(path).split(".").reduce((current, part) => {
    if (current === undefined || current === null) return undefined;
    return current[part];
  }, obj);
}

function findSourceUpdated(json) {
  return json?.timestamp || json?.lastUpdated || json?.leagues?.[0]?.calendar?.[0]?.endDate || null;
}
