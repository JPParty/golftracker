import { parseLpgaHydration, LPGA_HYDRATION_PARSER_VERSION } from "./lpgaHydrationParser.js";
import { parseLpgaLeaderboard, LPGA_PARSER_VERSION } from "./lpgaParser.js";
import { resolveCurrentTournament, TOURNAMENT_RESOLVER_VERSION } from "./tournamentResolver.js";

export const LPGA_HYDRATION_PROBE_VERSION = "v0.3.3";

export async function runLpgaHydrationProbe({ appVersion = "unknown", tournamentOverride = null } = {}) {
  const startedAt = new Date().toISOString();
  const tournament = await resolveCurrentTournament({ tournamentOverride });
  const response = await fetch(withCacheBuster(tournament.leaderboardUrl), {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "user-agent": `Mozilla/5.0 GolfTracker/${appVersion} LPGA hydration probe`
    }
  });

  const html = await response.text();
  const visible = parseLpgaLeaderboard(html);
  const hydration = parseLpgaHydration(html);
  const completedAt = new Date().toISOString();

  return {
    appVersion,
    tool: "LPGA Hydration Probe",
    toolVersion: LPGA_HYDRATION_PROBE_VERSION,
    startedAt,
    completedAt,
    tournament: {
      slug: tournament.slug,
      name: tournament.name,
      method: tournament.method,
      reason: tournament.reason,
      leaderboardUrl: tournament.leaderboardUrl,
      resolverVersion: TOURNAMENT_RESOLVER_VERSION
    },
    fetch: {
      status: response.status,
      ok: response.ok,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      byteLength: html.length
    },
    visibleParser: {
      parserVersion: LPGA_PARSER_VERSION,
      eventName: visible.eventName,
      sourceUpdated: visible.sourceUpdated,
      playersParsed: visible.players.length,
      playerSample: visible.players.slice(0, 20)
    },
    hydrationParser: hydration,
    summary: {
      visiblePlayers: visible.players.length,
      hydratedEntries: hydration.entriesCount,
      hydratedPlayersParsed: hydration.parsedPlayersCount,
      improvement: hydration.parsedPlayersCount - visible.players.length,
      shouldPromoteHydrationParser: hydration.parsedPlayersCount > visible.players.length,
      conclusion: buildConclusion(visible, hydration)
    },
    note: "This checks whether the full LPGA leaderboard is already embedded in the Next.js hydration/flight data. If hydratedPlayersParsed exceeds visiblePlayers, the next build should promote the hydration parser into the main leaderboard flow."
  };
}

function buildConclusion(visible, hydration) {
  if (!hydration.foundCurrentLeaderboard) {
    return "No currentLeaderboard object was found in the page hydration data.";
  }

  if (hydration.parsedPlayersCount > visible.players.length) {
    return "Hydration data contains more live rows than the visible HTML parser. Promote this parser into production.";
  }

  if (hydration.entriesCount > visible.players.length) {
    return "Hydration data contains more raw entries, but the normalizer needs adjustment before production use.";
  }

  if (hydration.entriesCount === visible.players.length && hydration.entriesCount > 0) {
    return "Hydration data was extracted but currently matches the visible row count.";
  }

  return hydration.extractionNotes || "Hydration extraction did not produce additional rows.";
}

function withCacheBuster(rawUrl) {
  const url = new URL(rawUrl);
  url.searchParams.set("_golftrackerHydrationProbe", String(Date.now()));
  return url.toString();
}
