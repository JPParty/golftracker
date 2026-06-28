import { ESPN_PARSER_VERSION, parseEspnLeaderboard } from "./espnParser.js";
import { LPGA_ENTRIES_PARSER_VERSION, parseLpgaEntries } from "./lpgaEntriesParser.js";
import { LPGA_PARSER_VERSION, parseLpgaLeaderboard } from "./lpgaParser.js";
import { buildLpgaUrls, resolveCurrentTournament, TOURNAMENT_RESOLVER_VERSION } from "./tournamentResolver.js";
import { mergePlayers, sortLeaderboard } from "./utils.js";

const CACHE_SECONDS = 60;
const MIN_EXPECTED_FULL_FIELD = 50;
const ESPN_MAX_SOURCE_AGE_MS = 30 * 60 * 1000;
const ESPN_URLS = [
  "https://site.web.api.espn.com/apis/site/v2/sports/golf/lpga/scoreboard",
  "https://site.web.api.espn.com/apis/v2/sports/golf/lpga/scoreboard"
];

let memoryCache = {
  key: null,
  expiresAt: 0,
  fetchedAt: null,
  data: null
};

export async function getLeaderboard({ appVersion = "unknown", tournamentOverride = null, metadataOnly = false } = {}) {
  const now = Date.now();
  const cacheKey = tournamentOverride || "auto";

  if (!metadataOnly && memoryCache.data && memoryCache.key === cacheKey && memoryCache.expiresAt > now) {
    return {
      ...memoryCache.data,
      appVersion,
      cached: true,
      cacheAgeSeconds: memoryCache.fetchedAt ? Math.round((now - memoryCache.fetchedAt) / 1000) : null
    };
  }

  try {
    const tournament = await resolveCurrentTournament({ tournamentOverride });

    if (metadataOnly) {
      return {
        appVersion,
        tournament,
        updatedAt: new Date().toISOString()
      };
    }

    const lpgaResult = await fetchLpgaStack({ appVersion, tournament });

    if (lpgaResult.livePlayersLoaded < MIN_EXPECTED_FULL_FIELD) {
      const espnResult = await fetchEspnFallback(appVersion).catch(error => ({ error }));

      // Only allow ESPN scoring when it is fresh and improves what LPGA provided.
      if (espnResult?.players?.length > lpgaResult.livePlayersLoaded) {
        return cacheAndReturn({
          ...lpgaResult,
          source: "LPGA + ESPN fallback",
          sourceUrl: lpgaResult.sourceUrl,
          additionalSourceUrls: [...(lpgaResult.additionalSourceUrls || []), espnResult.sourceUrl],
          parser: `${lpgaResult.parser}; ESPN JSON ${ESPN_PARSER_VERSION}`,
          players: sortLeaderboard(mergePlayers(espnResult.players, lpgaResult.players)),
          livePlayersLoaded: Math.max(lpgaResult.livePlayersLoaded, espnResult.players.length),
          warning: makeWarning(lpgaResult, null, "Fresh ESPN fallback added full-field scoring.")
        }, now, cacheKey);
      }

      return cacheAndReturn({
        ...lpgaResult,
        warning: makeWarning(lpgaResult, espnResult?.error, null)
      }, now, cacheKey);
    }

    return cacheAndReturn(lpgaResult, now, cacheKey);
  } catch (error) {
    if (memoryCache.data && memoryCache.key === cacheKey) {
      return {
        ...memoryCache.data,
        appVersion,
        cached: true,
        cacheAgeSeconds: memoryCache.fetchedAt ? Math.round((now - memoryCache.fetchedAt) / 1000) : null,
        warning: `Live refresh failed. Showing cached data. ${error.message}`
      };
    }

    const fallbackUrls = buildLpgaUrls(tournamentOverride);
    return {
      appVersion,
      source: "LPGA Source Stack",
      sourceUrl: fallbackUrls.leaderboardUrl,
      additionalSourceUrls: [fallbackUrls.entriesUrl, fallbackUrls.resultsUrl],
      tournamentSlug: fallbackUrls.slug,
      eventName: "LPGA Leaderboard",
      sourceUpdated: null,
      updatedAt: null,
      parser: `LPGA HTML ${LPGA_PARSER_VERSION}; Entries HTML ${LPGA_ENTRIES_PARSER_VERSION}; Resolver ${TOURNAMENT_RESOLVER_VERSION}`,
      players: [],
      livePlayersLoaded: 0,
      rosterPlayersLoaded: 0,
      error: error.message,
      warning: "Could not retrieve leaderboard data."
    };
  }
}

async function fetchLpgaStack({ appVersion, tournament }) {
  const leaderboardResponse = await fetch(tournament.leaderboardUrl, {
    headers: htmlHeaders()
  });

  if (!leaderboardResponse.ok) {
    throw new Error(`LPGA leaderboard responded with ${leaderboardResponse.status}`);
  }

  const leaderboardHtml = await leaderboardResponse.text();
  const liveParsed = parseLpgaLeaderboard(leaderboardHtml);
  const livePlayers = (liveParsed.players || []).map(player => ({
    ...player,
    live: true,
    dataSource: "LPGA Leaderboard"
  }));

  let entriesParsed = { players: [], rawRowsSeen: 0 };
  let entriesError = null;

  try {
    const entriesResponse = await fetch(tournament.entriesUrl, {
      headers: htmlHeaders()
    });

    if (!entriesResponse.ok) {
      throw new Error(`LPGA entries responded with ${entriesResponse.status}`);
    }

    const entriesHtml = await entriesResponse.text();
    entriesParsed = parseLpgaEntries(entriesHtml);
  } catch (error) {
    entriesError = error;
  }

  const mergedPlayers = sortLeaderboard(mergePlayers(livePlayers, entriesParsed.players));

  return {
    appVersion,
    source: entriesParsed.players.length ? "LPGA live + entries" : (liveParsed.isPartial ? "LPGA (partial)" : "LPGA"),
    sourceUrl: tournament.leaderboardUrl,
    additionalSourceUrls: [tournament.entriesUrl, tournament.resultsUrl],
    tournamentSlug: tournament.slug,
    tournamentResolution: {
      method: tournament.method,
      reason: tournament.reason,
      cachedResolver: tournament.cachedResolver || false,
      dateText: tournament.resolvedEventDateText || null,
      dateStatus: tournament.resolvedDateStatus || null,
      candidatesTested: tournament.resolverCandidatesTested || []
    },
    resolvedEventDateText: tournament.resolvedEventDateText || null,
    eventName: liveParsed.eventName || "Current LPGA Tournament",
    sourceUpdated: liveParsed.sourceUpdated || null,
    updatedAt: new Date().toISOString(),
    parser: `LPGA HTML ${LPGA_PARSER_VERSION}; Entries HTML ${LPGA_ENTRIES_PARSER_VERSION}; Resolver ${TOURNAMENT_RESOLVER_VERSION}`,
    players: mergedPlayers,
    livePlayersLoaded: livePlayers.length,
    rosterPlayersLoaded: entriesParsed.players.length,
    entriesError: entriesError?.message || null,
    warning: entriesError ? `Entries source failed: ${entriesError.message}` : null
  };
}

async function fetchEspnFallback(appVersion) {
  let lastError = null;

  for (const url of ESPN_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 GolfTracker/0.3.2",
          "accept": "application/json,text/plain,*/*"
        }
      });

      if (!response.ok) {
        throw new Error(`ESPN responded with ${response.status}`);
      }

      const json = await response.json();
      const parsed = parseEspnLeaderboard(json);

      if (parsed.players.length) {
        const staleReason = getEspnStaleReason(parsed.sourceUpdated);
        if (staleReason) {
          lastError = new Error(`ESPN fallback rejected: ${staleReason}`);
          continue;
        }

        return {
          appVersion,
          source: "ESPN (fallback)",
          sourceUrl: url,
          eventName: parsed.eventName || "Current LPGA Tournament",
          sourceUpdated: parsed.sourceUpdated || null,
          updatedAt: new Date().toISOString(),
          parser: `ESPN JSON ${ESPN_PARSER_VERSION}`,
          players: parsed.players.map(player => ({ ...player, live: true, dataSource: "ESPN" })),
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

function getEspnStaleReason(sourceUpdated) {
  if (!sourceUpdated) return "sourceUpdated missing";

  const sourceTime = Date.parse(sourceUpdated);
  if (Number.isNaN(sourceTime)) return `sourceUpdated not parseable (${sourceUpdated})`;

  const ageMs = Date.now() - sourceTime;
  if (ageMs < 0) return null;

  if (ageMs > ESPN_MAX_SOURCE_AGE_MS) {
    const ageMinutes = Math.round(ageMs / 60000);
    return `sourceUpdated is ${ageMinutes} minutes old, exceeding 30-minute limit`;
  }

  return null;
}

function makeWarning(lpgaResult, espnError, extraMessage) {
  const messages = [];

  if (lpgaResult.livePlayersLoaded < MIN_EXPECTED_FULL_FIELD) {
    if (lpgaResult.rosterPlayersLoaded > lpgaResult.livePlayersLoaded) {
      messages.push(`LPGA live source currently exposes ${lpgaResult.livePlayersLoaded} scored rows; Entries added roster-only rows for a ${lpgaResult.players.length}-player view. Roster-only rows will not gain live scores unless a live source exposes those players.`);
    } else {
      messages.push(`Partial leaderboard: LPGA provided ${lpgaResult.livePlayersLoaded} live players.`);
    }
  }

  if (espnError) messages.push(espnError.message);
  if (lpgaResult.entriesError) messages.push(`Entries source failed: ${lpgaResult.entriesError}`);
  if (extraMessage) messages.push(extraMessage);

  return messages.length ? messages.join(" ") : null;
}

function cacheAndReturn(data, now, key) {
  if (data.players.length) {
    memoryCache = {
      key,
      expiresAt: now + CACHE_SECONDS * 1000,
      fetchedAt: now,
      data
    };
  }

  return data;
}

function htmlHeaders() {
  return {
    "user-agent": "Mozilla/5.0 GolfTracker/0.3.2",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
}
