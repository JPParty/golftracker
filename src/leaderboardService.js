import { ESPN_PARSER_VERSION, parseEspnLeaderboard } from "./espnParser.js";
import { LPGA_ENTRIES_PARSER_VERSION, parseLpgaEntries } from "./lpgaEntriesParser.js";
import { LPGA_HYDRATION_PARSER_VERSION, parseLpgaHydration } from "./lpgaHydrationParser.js";
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
      parser: `LPGA HTML ${LPGA_PARSER_VERSION}; LPGA Hydration ${LPGA_HYDRATION_PARSER_VERSION}; Entries HTML ${LPGA_ENTRIES_PARSER_VERSION}; Resolver ${TOURNAMENT_RESOLVER_VERSION}`,
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
  const hydrationParsed = parseLpgaHydration(leaderboardHtml);

  const visibleLivePlayers = (liveParsed.players || [])
    .map(player => ({
      ...player,
      live: true,
      dataSource: "LPGA visible leaderboard"
    }));

  const hydratedPlayers = sanitizePlayerList(hydrationParsed.players || [])
    .map(player => ({
      ...player,
      live: player.live !== false,
      dataSource: player.dataSource || "LPGA hydration leaderboard"
    }));

  const scoringPlayers = hydratedPlayers.length > visibleLivePlayers.length
    ? hydratedPlayers
    : visibleLivePlayers;

  let entriesParsed = { players: [], rawRowsSeen: 0, filteredRowsSeen: 0 };
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

  const rosterPlayers = sanitizePlayerList(entriesParsed.players || []);
  const mergedPlayers = sortLeaderboard(mergePlayers(scoringPlayers, rosterPlayers));
  const hydrationPromoted = hydratedPlayers.length > visibleLivePlayers.length;

  return {
    appVersion,
    source: hydrationPromoted
      ? "LPGA hydration leaderboard + entries"
      : entriesParsed.players.length
        ? "LPGA visible leaderboard + entries"
        : (liveParsed.isPartial ? "LPGA (partial)" : "LPGA"),
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
    parser: `LPGA HTML ${LPGA_PARSER_VERSION}; LPGA Hydration ${LPGA_HYDRATION_PARSER_VERSION}; Entries HTML ${LPGA_ENTRIES_PARSER_VERSION}; Resolver ${TOURNAMENT_RESOLVER_VERSION}`,
    players: mergedPlayers,
    livePlayersLoaded: scoringPlayers.length,
    visibleLivePlayersLoaded: visibleLivePlayers.length,
    hydratedPlayersLoaded: hydratedPlayers.length,
    hydratedRowsSeen: hydrationParsed.formattedRowsCount || null,
    hydrationParseSource: hydrationParsed.parseSource || null,
    rosterPlayersLoaded: rosterPlayers.length,
    entriesRowsSeen: entriesParsed.rawRowsSeen || entriesParsed.players?.length || 0,
    entriesRowsFiltered: entriesParsed.filteredRowsSeen || 0,
    entriesError: entriesError?.message || null,
    warning: entriesError ? `Entries source failed: ${entriesError.message}` : null
  };
}

function sanitizePlayerList(players) {
  return (players || []).filter(player => isRealPlayer(player));
}

function isRealPlayer(player) {
  const name = String(player?.name || "").trim();
  if (!name) return false;
  if (name.length < 2 || name.length > 70) return false;
  if (!/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(name)) return false;
  if (/https?:\/\//i.test(name) || /www\./i.test(name) || /\.com\b/i.test(name)) return false;
  if (/[{}<>]/.test(name)) return false;

  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
    "kpmg women s pga championship",
    "lpga professionals",
    "tickets",
    "volunteer",
    "hospitality",
    "watch now",
    "video",
    "view more",
    "learn more"
  ];

  if (blockedPhrases.some(phrase => normalized.includes(phrase))) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 && !/^[a-z]\s+[a-z]+\s+[a-z]+$/i.test(name)) return false;

  if (player.entryId !== null && player.entryId !== undefined && !Number.isFinite(Number(player.entryId))) return false;
  if (player.playerId !== null && player.playerId !== undefined && !Number.isFinite(Number(player.playerId))) return false;

  return true;
}

async function fetchEspnFallback(appVersion) {
  let lastError = null;

  for (const url of ESPN_URLS) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 GolfTracker/0.3.5",
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
      messages.push(`LPGA scoring source currently exposes ${lpgaResult.livePlayersLoaded} scored rows; Entries added roster-only rows for a ${lpgaResult.players.length}-player view. Roster-only rows will not gain live scores unless a live source exposes those players.`);
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
    "user-agent": "Mozilla/5.0 GolfTracker/0.3.5",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
  };
}
