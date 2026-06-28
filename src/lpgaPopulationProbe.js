import { parseLpgaLeaderboard } from "./lpgaParser.js";
import { resolveCurrentTournament, TOURNAMENT_RESOLVER_VERSION } from "./tournamentResolver.js";

export const LPGA_POPULATION_PROBE_VERSION = "v0.3.2";

const DEFAULT_DELAYS_MS = [0, 3000, 8000];
const MAX_DELAY_MS = 15000;
const MAX_TOTAL_DELAY_MS = 25000;

export async function runLpgaPopulationProbe({ appVersion = "unknown", tournamentOverride = null, delaysParam = null } = {}) {
  const startedAt = new Date().toISOString();
  const tournament = await resolveCurrentTournament({ tournamentOverride });
  const delays = parseDelays(delaysParam);
  const snapshots = [];
  let elapsedDelay = 0;

  for (let i = 0; i < delays.length; i++) {
    const delayMs = delays[i];
    if (delayMs > 0) await sleep(delayMs);
    elapsedDelay += delayMs;

    const snapshotStartedAt = new Date().toISOString();
    const url = withCacheBuster(tournament.leaderboardUrl, i);
    let snapshot;

    try {
      const response = await fetch(url, {
        headers: {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "cache-control": "no-cache",
          "pragma": "no-cache",
          "user-agent": `Mozilla/5.0 GolfTracker/${appVersion} LPGA population probe`
        }
      });

      const html = await response.text();
      const parsed = parseLpgaLeaderboard(html);
      snapshot = buildSnapshot({
        index: i,
        delayMs,
        elapsedDelayMs: elapsedDelay,
        requestedUrl: url,
        response,
        html,
        parsed,
        snapshotStartedAt
      });
    } catch (error) {
      snapshot = {
        index: i,
        delayMs,
        elapsedDelayMs: elapsedDelay,
        requestedUrl: url,
        snapshotStartedAt,
        ok: false,
        error: error.message
      };
    }

    snapshots.push(snapshot);
  }

  const completedAt = new Date().toISOString();
  return {
    appVersion,
    tool: "LPGA Population Probe",
    toolVersion: LPGA_POPULATION_PROBE_VERSION,
    startedAt,
    completedAt,
    tournament: {
      slug: tournament.slug,
      name: tournament.name,
      method: tournament.method,
      reason: tournament.reason,
      leaderboardUrl: tournament.leaderboardUrl,
      entriesUrl: tournament.entriesUrl,
      resolvedEventDateText: tournament.resolvedEventDateText || null,
      resolvedDateStatus: tournament.resolvedDateStatus || null,
      resolverVersion: TOURNAMENT_RESOLVER_VERSION
    },
    summary: summarizeSnapshots(snapshots),
    snapshots,
    note: "This checks whether waiting and refetching the LPGA leaderboard HTML from the Worker produces more visible rows. If counts stay the same but the browser page later shows more data, the missing rows are likely populated by client-side JavaScript that the Worker fetch cannot execute."
  };
}

function parseDelays(delaysParam) {
  if (!delaysParam) return DEFAULT_DELAYS_MS;

  const parsed = String(delaysParam)
    .split(",")
    .map(value => Number(value.trim()))
    .filter(value => Number.isFinite(value) && value >= 0)
    .map(value => Math.min(Math.round(value), MAX_DELAY_MS));

  if (!parsed.length) return DEFAULT_DELAYS_MS;

  const result = [];
  let total = 0;
  for (const delay of parsed.slice(0, 6)) {
    if (total + delay > MAX_TOTAL_DELAY_MS) break;
    result.push(delay);
    total += delay;
  }

  return result.length ? result : DEFAULT_DELAYS_MS;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function withCacheBuster(rawUrl, index) {
  const url = new URL(rawUrl);
  url.searchParams.set("_golftrackerProbe", `${Date.now()}-${index}`);
  return url.toString();
}

function buildSnapshot({ index, delayMs, elapsedDelayMs, requestedUrl, response, html, parsed, snapshotStartedAt }) {
  const signalCounts = countSignals(html);
  const htmlHash = simpleHash(html);
  const playerNames = (parsed.players || []).map(player => player.name);

  return {
    index,
    delayMs,
    elapsedDelayMs,
    requestedUrl,
    snapshotStartedAt,
    fetchedAt: new Date().toISOString(),
    status: response.status,
    ok: response.ok,
    finalUrl: response.url,
    contentType: response.headers.get("content-type"),
    byteLength: html.length,
    htmlHash,
    sourceUpdated: parsed.sourceUpdated || null,
    eventName: parsed.eventName || null,
    playersParsed: playerNames.length,
    isPartial: parsed.isPartial,
    playerNames,
    playerSample: (parsed.players || []).slice(0, 20),
    signalCounts,
    snippets: {
      lastUpdated: snippetAround(html, "Last Updated"),
      leaderboardRows: snippetAround(html, "leaderboardRows"),
      currentLeaderboard: snippetAround(html, "currentLeaderboard"),
      nextFlight: snippetAround(html, "self.__next_f")
    }
  };
}

function countSignals(html) {
  const signals = [
    "Last Updated",
    "Full Leaderboard",
    "leaderboardRows",
    "LeaderboardReact",
    "self.__next_f",
    "__NEXT_DATA__",
    "currentLeaderboard",
    "livescoring",
    "fetch(",
    "TournamentLeaderboardScreen",
    "athlete",
    "players",
    "THRU",
    "TODAY",
    "POS"
  ];

  return Object.fromEntries(signals.map(signal => [signal, countOccurrences(html, signal)]));
}

function countOccurrences(haystack, needle) {
  if (!haystack || !needle) return 0;
  let count = 0;
  let index = 0;
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function snippetAround(html, needle) {
  const index = html.indexOf(needle);
  if (index === -1) return null;
  const start = Math.max(0, index - 350);
  const end = Math.min(html.length, index + 850);
  return html.slice(start, end).replace(/\s+/g, " ");
}

function simpleHash(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function summarizeSnapshots(snapshots) {
  const successful = snapshots.filter(snapshot => snapshot.ok);
  const playerCounts = successful.map(snapshot => snapshot.playersParsed);
  const uniquePlayerCounts = [...new Set(playerCounts)];
  const htmlHashes = successful.map(snapshot => snapshot.htmlHash).filter(Boolean);
  const uniqueHtmlHashes = [...new Set(htmlHashes)];
  const sourceUpdatedValues = successful.map(snapshot => snapshot.sourceUpdated).filter(Boolean);
  const uniqueSourceUpdatedValues = [...new Set(sourceUpdatedValues)];

  const first = successful[0] || null;
  const last = successful[successful.length - 1] || null;
  const playerCountChanged = uniquePlayerCounts.length > 1;
  const htmlChanged = uniqueHtmlHashes.length > 1;
  const sourceUpdatedChanged = uniqueSourceUpdatedValues.length > 1;

  let conclusion;
  if (!successful.length) {
    conclusion = "No successful LPGA leaderboard fetches completed.";
  } else if (playerCountChanged) {
    conclusion = "Delayed Worker refetches changed the parsed player count. A production retry/enrichment loop may add more live rows.";
  } else if (htmlChanged || sourceUpdatedChanged) {
    conclusion = "Delayed Worker refetches changed the HTML/source timestamp but not the parsed player count. Next debug step should inspect changed snippets and parser coverage.";
  } else {
    conclusion = "Delayed Worker refetches returned the same parsed player count. If a browser shows more rows after waiting, those rows are probably added by client-side JavaScript/XHR rather than the server HTML.";
  }

  return {
    probesRun: snapshots.length,
    successfulFetches: successful.length,
    firstPlayerCount: first?.playersParsed ?? null,
    lastPlayerCount: last?.playersParsed ?? null,
    maxPlayerCount: playerCounts.length ? Math.max(...playerCounts) : null,
    playerCountChanged,
    htmlChanged,
    sourceUpdatedChanged,
    uniquePlayerCounts,
    uniqueHtmlHashes,
    uniqueSourceUpdatedValues,
    conclusion
  };
}
