import { parseLpgaLeaderboard, LPGA_PARSER_VERSION } from "./lpgaParser.js";

const CACHE_SECONDS = 301;
const LPGA_URL = "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/leaderboard";

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
    const response = await fetch(LPGA_URL, {
      headers: {
        "user-agent": "Mozilla/5.0 GolfTracker/0.2.0",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`LPGA responded with ${response.status}`);
    }

    const html = await response.text();
    const parsed = parseLpgaLeaderboard(html);

    const data = {
      appVersion,
      source: "LPGA",
      sourceUrl: LPGA_URL,
      eventName: parsed.eventName || "Current LPGA Tournament",
      sourceUpdated: parsed.sourceUpdated || null,
      updatedAt: new Date().toISOString(),
      parser: `LPGA HTML ${LPGA_PARSER_VERSION}`,
      players: parsed.players,
      warning: parsed.players.length ? null : "No leaderboard rows could be parsed from the LPGA source."
    };

    // Only replace cache if we parsed at least one player. This prevents a bad/empty
    // source response from wiping out the last known good leaderboard.
    if (data.players.length) {
      memoryCache = {
        expiresAt: now + CACHE_SECONDS * 1000,
        fetchedAt: now,
        data
      };
    }

    return data;
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
