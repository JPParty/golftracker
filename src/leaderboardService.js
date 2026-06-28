import { ESPN_PARSER_VERSION, parseEspnLeaderboard } from "./espnParser.js";
import { LPGA_PARSER_VERSION, parseLpgaLeaderboard } from "./lpgaParser.js";

const CACHE_SECONDS = 60;
const MIN_EXPECTED_FULL_FIELD = 50;
const LPGA_URL = "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/leaderboard";
const ESPN_URLS = [
  "https://site.web.api.espn.com/apis/site/v2/sports/golf/lpga/scoreboard",
  "https://site.web.api.espn.com/apis/v2/sports/golf/lpga/scoreboard"
];

let memoryCache = {
  expiresAt: 0,
  fetchedAt: null,
  data: null
};

export async function getLeaderboard({ appVersion = "unknown" } = {}) {
  const now = Date.now();

  if (memoryCache.data && memoryCache.expiresAt > now) {
    return {
      ...memoryCache.data,
      appVersion,
      cached: true,
      cacheAgeSeconds: memoryCache.fetchedAt ? Math.round((now - memoryCache.fetchedAt) / 1000) : null
    };
  }

  try {
    const lpgaResult = await fetchLpga(appVersion);

    // The current LPGA HTML often exposes only a partial visible leaderboard.
    // If that happens, try ESPN as a full-field fallback.
    if (lpgaResult.players.length < MIN_EXPECTED_FULL_FIELD) {
      const espnResult = await fetchEspnFallback(appVersion).catch(error => ({ error }));

      if (espnResult?.players?.length > lpgaResult.players.length) {
        return cacheAndReturn({
          ...espnResult,
          warning: null
        }, now);
      }

      return cacheAndReturn({
        ...lpgaResult,
        warning: `Partial leaderboard: LPGA provided ${lpgaResult.players.length} players and ESPN fallback did not provide a larger field${espnResult?.error ? ` (${espnResult.error.message})` : ""}.`
      }, now);
    }

    return cacheAndReturn(lpgaResult, now);
  } catch (error) {
    if (memoryCache.data) {
      return {
        ...memoryCache.data,
        appVersion,
        cached: true,
        cacheAgeSeconds: memoryCache.fetchedAt ? Math.round((now - memoryCache.fetchedAt) / 1000) : null,
        warning: `Live refresh failed. Showing cached data. ${error.message}`
      };
    }

    return {
      appVersion,
      source: "LPGA",
      sourceUrl: LPGA_URL,
      eventName: "LPGA Leaderboard",
      sourceUpdated: null,
      updatedAt: null,
      parser: `LPGA HTML ${LPGA_PARSER_VERSION}`,
      players: [],
      error: error.message,
      warning: "Could not retrieve leaderboard data."
    };
  }
}

async function fetchLpga(appVersion) {
  const response = await fetch(LPGA_URL, {
    headers: {
      "user-agent": "Mozilla/5.0 GolfTracker/0.2.1",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`LPGA responded with ${response.status}`);
  }

  const html = await response.text();
  const parsed = parseLpgaLeaderboard(html);

  return {
    appVersion,
    source: parsed.isPartial ? "LPGA (partial)" : "LPGA",
    sourceUrl: LPGA_URL,
    eventName: parsed.eventName || "Current LPGA Tournament",
    sourceUpdated: parsed.sourceUpdated || null,
    updatedAt: new Date().toISOString(),
    parser: `LPGA HTML ${LPGA_PARSER_VERSION}`,
    players: parsed.players,
    warning: parsed.players.length ? null : "No leaderboard rows could be parsed from the LPGA source."
  };
}

async function fetchEspnFallback(appVersion) {
  let lastError = null;

  for (const url of ESPN_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 GolfTracker/0.2.1",
          "accept": "application/json,text/plain,*/*"
        }
      });

      if (!response.ok) {
        throw new Error(`ESPN responded with ${response.status}`);
      }

      const json = await response.json();
      const parsed = parseEspnLeaderboard(json);

      if (parsed.players.length) {
        return {
          appVersion,
          source: "ESPN (fallback)",
          sourceUrl: url,
          eventName: parsed.eventName || "Current LPGA Tournament",
          sourceUpdated: parsed.sourceUpdated || null,
          updatedAt: new Date().toISOString(),
          parser: `ESPN JSON ${ESPN_PARSER_VERSION}`,
          players: parsed.players,
          warning: null
        };
      }

      lastError = new Error("ESPN JSON returned no parsed players");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("ESPN fallback failed");
}

function cacheAndReturn(data, now) {
  if (data.players.length) {
    memoryCache = {
      expiresAt: now + CACHE_SECONDS * 1000,
      fetchedAt: now,
      data
    };
  }

  return data;
}
