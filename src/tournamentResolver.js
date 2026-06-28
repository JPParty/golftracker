import { decodeEntities, stripTags } from "./utils.js";
import { parseLpgaLeaderboard } from "./lpgaParser.js";

export const TOURNAMENT_RESOLVER_VERSION = "v0.3.0";

const LPGA_BASE = "https://www.lpga.com";
const TOURNAMENTS_URL = `${LPGA_BASE}/tournaments`;
const DEFAULT_FALLBACK_SLUG = "kpmgwomenspgachampionship";
const RESOLVER_CACHE_SECONDS = 10 * 60;
const MAX_CANDIDATES_TO_TEST = 8;

let resolverCache = {
  expiresAt: 0,
  value: null
};

export function buildLpgaUrls(slug) {
  const cleanSlug = normalizeSlug(slug) || DEFAULT_FALLBACK_SLUG;
  const base = `${LPGA_BASE}/tournaments/${cleanSlug}`;

  return {
    slug: cleanSlug,
    overviewUrl: `${base}/overview`,
    leaderboardUrl: `${base}/leaderboard`,
    entriesUrl: `${base}/entries`,
    pairingsUrl: `${base}/pairings`,
    resultsUrl: `${base}/results`
  };
}

export async function resolveCurrentTournament({ tournamentOverride = null, fetchOptions = {} } = {}) {
  const overrideSlug = normalizeSlug(tournamentOverride);
  if (overrideSlug) {
    return {
      ...buildLpgaUrls(overrideSlug),
      method: "override",
      reason: "Tournament slug was provided in the request."
    };
  }

  const now = Date.now();
  if (resolverCache.value && resolverCache.expiresAt > now) {
    return {
      ...resolverCache.value,
      cachedResolver: true
    };
  }

  const resolved = await resolveFromLpgaTournamentIndex(fetchOptions).catch(error => ({
    ...buildLpgaUrls(DEFAULT_FALLBACK_SLUG),
    method: "fallback",
    reason: `Could not resolve current LPGA tournament from index: ${error.message}`
  }));

  resolverCache = {
    expiresAt: now + RESOLVER_CACHE_SECONDS * 1000,
    value: resolved
  };

  return resolved;
}

async function resolveFromLpgaTournamentIndex(fetchOptions) {
  const response = await fetch(TOURNAMENTS_URL, {
    ...fetchOptions,
    headers: {
      "user-agent": "Mozilla/5.0 GolfTracker/0.3.0",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(fetchOptions.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`LPGA tournaments index responded with ${response.status}`);
  }

  const html = await response.text();
  const candidates = extractTournamentCandidates(html);

  if (!candidates.length) {
    return {
      ...buildLpgaUrls(DEFAULT_FALLBACK_SLUG),
      method: "fallback",
      reason: "No tournament slugs were found on the LPGA tournaments index."
    };
  }

  const tested = [];
  for (const candidate of candidates.slice(0, MAX_CANDIDATES_TO_TEST)) {
    const urls = buildLpgaUrls(candidate.slug);
    const test = await testTournamentCandidate(urls).catch(error => ({
      slug: candidate.slug,
      ok: false,
      score: 0,
      error: error.message
    }));

    tested.push({ ...candidate, ...test });
  }

  const best = tested
    .filter(candidate => candidate.ok)
    .sort((a, b) => b.score - a.score)[0];

  if (best) {
    return {
      ...buildLpgaUrls(best.slug),
      method: "lpga-tournament-index",
      reason: `Selected ${best.slug} from LPGA tournament index after testing current leaderboard pages.`,
      resolverCandidatesTested: tested.map(summarizeTestedCandidate)
    };
  }

  // If the index gave us candidates but none currently parse as a leaderboard,
  // choose the strongest index candidate so the app still moves forward without a code change.
  const top = candidates[0];
  return {
    ...buildLpgaUrls(top.slug),
    method: "lpga-tournament-index-unverified",
    reason: `No candidate leaderboard parsed successfully; using top LPGA index candidate ${top.slug}.`,
    resolverCandidatesTested: tested.map(summarizeTestedCandidate)
  };
}

function extractTournamentCandidates(html) {
  const candidates = new Map();
  const text = decodeEntities(stripTags(html));
  const normalizedHtml = decodeEntities(String(html || ""));

  const regexes = [
    /href=["']([^"']*\/tournaments\/([a-z0-9-]+)\/(?:overview|leaderboard|results|entries|pairings)[^"']*)["']/gi,
    /["']([^"']*\/tournaments\/([a-z0-9-]+)\/(?:overview|leaderboard|results|entries|pairings)[^"']*)["']/gi,
    /\/tournaments\/([a-z0-9-]+)\/(?:overview|leaderboard|results|entries|pairings)/gi
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(normalizedHtml))) {
      const slug = normalizeSlug(match[2] || match[1]);
      if (!slug || shouldIgnoreSlug(slug)) continue;

      const index = match.index || 0;
      const window = normalizedHtml.slice(Math.max(0, index - 800), Math.min(normalizedHtml.length, index + 1200));
      const score = scoreCandidateWindow(window, text);
      const existing = candidates.get(slug);

      if (!existing || score > existing.indexScore) {
        candidates.set(slug, {
          slug,
          indexScore: score,
          hint: makeCandidateHint(window)
        });
      }
    }
  }

  return Array.from(candidates.values())
    .sort((a, b) => b.indexScore - a.indexScore || a.slug.localeCompare(b.slug));
}

async function testTournamentCandidate(urls) {
  const response = await fetch(urls.leaderboardUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 GolfTracker/0.3.0",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    return { slug: urls.slug, ok: false, score: 0, status: response.status };
  }

  const html = await response.text();
  const parsed = parseLpgaLeaderboard(html);
  const playersParsed = parsed.players?.length || 0;
  const sourceUpdatedTime = parsed.sourceUpdated ? Date.parse(parsed.sourceUpdated) : null;
  const sourceUpdatedScore = sourceUpdatedTime && !Number.isNaN(sourceUpdatedTime)
    ? Math.max(0, 30 - Math.round((Date.now() - sourceUpdatedTime) / 3600000))
    : 0;

  const score =
    playersParsed * 10 +
    sourceUpdatedScore +
    (parsed.sourceUpdated ? 25 : 0) +
    (parsed.eventName ? 5 : 0);

  return {
    slug: urls.slug,
    ok: playersParsed > 0,
    score,
    playersParsed,
    sourceUpdated: parsed.sourceUpdated || null,
    eventName: parsed.eventName || null,
    status: response.status
  };
}

function scoreCandidateWindow(window, fullText) {
  const s = String(window || "").toLowerCase();
  let score = 0;

  if (s.includes("live")) score += 100;
  if (s.includes("leaderboard")) score += 40;
  if (s.includes("current")) score += 25;
  if (s.includes("this week")) score += 20;
  if (s.includes("ongoing")) score += 20;
  if (s.includes("championship")) score += 6;
  if (s.includes("open")) score += 4;
  if (s.includes("classic")) score += 4;

  const year = new Date().getUTCFullYear();
  if (s.includes(String(year))) score += 8;

  // Keep page order as a weak signal: candidates appearing earlier on the tournament
  // index are usually more current or promoted.
  const pos = fullText.indexOf(stripTags(window).slice(0, 30));
  if (pos >= 0) score += Math.max(0, 20 - Math.floor(pos / 5000));

  return score;
}

function makeCandidateHint(window) {
  return decodeEntities(stripTags(window))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function summarizeTestedCandidate(candidate) {
  return {
    slug: candidate.slug,
    ok: candidate.ok,
    playersParsed: candidate.playersParsed || 0,
    sourceUpdated: candidate.sourceUpdated || null,
    eventName: candidate.eventName || null,
    score: candidate.score || 0,
    status: candidate.status || null,
    error: candidate.error || null
  };
}

function shouldIgnoreSlug(slug) {
  return new Set([
    "major-championship-records",
    "local-qualifying-information",
    "lpga-qualifying-series",
    "lpga-legends-championship"
  ]).has(slug);
}

function normalizeSlug(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  const fromPath = raw.match(/\/tournaments\/([a-z0-9-]+)/i);
  const slug = (fromPath ? fromPath[1] : raw)
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/tournaments\//i, "")
    .split(/[/?#]/)[0]
    .replace(/[^a-z0-9-]/g, "");

  return slug || null;
}
