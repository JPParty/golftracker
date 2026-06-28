import { decodeEntities, stripTags } from "./utils.js";
import { parseLpgaLeaderboard } from "./lpgaParser.js";

export const TOURNAMENT_RESOLVER_VERSION = "v0.3.1";

const LPGA_BASE = "https://www.lpga.com";
const TOURNAMENTS_URL = `${LPGA_BASE}/tournaments`;
const DEFAULT_FALLBACK_SLUG = "kpmgwomenspgachampionship";
const RESOLVER_CACHE_SECONDS = 10 * 60;
const MAX_CANDIDATES_TO_TEST = 12;
const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11
};

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
      "user-agent": "Mozilla/5.0 GolfTracker/0.3.1",
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

  const today = startOfUtcDay(new Date());
  const tested = [];

  for (const candidate of candidates.slice(0, MAX_CANDIDATES_TO_TEST)) {
    const urls = buildLpgaUrls(candidate.slug);
    const test = await testTournamentCandidate(urls, candidate, today).catch(error => ({
      slug: candidate.slug,
      ok: false,
      score: 0,
      error: error.message
    }));

    tested.push({ ...candidate, ...test });
  }

  const best = tested
    .filter(candidate => candidate.ok)
    .sort((a, b) => b.score - a.score || b.indexScore - a.indexScore || a.slug.localeCompare(b.slug))[0];

  if (best) {
    return {
      ...buildLpgaUrls(best.slug),
      method: "lpga-tournament-index-date-aware",
      reason: `Selected ${best.slug} using LPGA schedule date matching plus live leaderboard validation.`,
      resolvedEventDateText: best.dateText || best.pageDateText || null,
      resolvedDateStatus: best.dateStatus || best.pageDateStatus || null,
      resolverCandidatesTested: tested.map(summarizeTestedCandidate)
    };
  }

  const top = candidates[0];
  return {
    ...buildLpgaUrls(top.slug),
    method: "lpga-tournament-index-unverified",
    reason: `No candidate leaderboard parsed successfully; using top LPGA index candidate ${top.slug}.`,
    resolvedEventDateText: top.dateText || null,
    resolvedDateStatus: top.dateStatus || null,
    resolverCandidatesTested: tested.map(summarizeTestedCandidate)
  };
}

function extractTournamentCandidates(html) {
  const candidates = new Map();
  const fullText = decodeEntities(stripTags(html));
  const normalizedHtml = decodeEntities(String(html || ""));
  const today = startOfUtcDay(new Date());

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
      const window = normalizedHtml.slice(Math.max(0, index - 1400), Math.min(normalizedHtml.length, index + 1000));
      const textWindow = decodeEntities(stripTags(window)).replace(/\s+/g, " ").trim();
      const dateInfo = extractDateInfo(textWindow, today);
      const score = scoreCandidateWindow(textWindow, fullText, dateInfo);
      const existing = candidates.get(slug);

      if (!existing || score > existing.indexScore) {
        candidates.set(slug, {
          slug,
          indexScore: score,
          hint: makeCandidateHint(textWindow),
          dateText: dateInfo?.dateText || null,
          dateStatus: dateInfo?.status || null,
          daysFromToday: typeof dateInfo?.daysFromToday === "number" ? dateInfo.daysFromToday : null
        });
      }
    }
  }

  return Array.from(candidates.values())
    .sort((a, b) => b.indexScore - a.indexScore || a.slug.localeCompare(b.slug));
}

async function testTournamentCandidate(urls, candidate, today) {
  const response = await fetch(urls.leaderboardUrl, {
    headers: {
      "user-agent": "Mozilla/5.0 GolfTracker/0.3.1",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    return { slug: urls.slug, ok: false, score: 0, status: response.status };
  }

  const html = await response.text();
  const parsed = parseLpgaLeaderboard(html);
  const playersParsed = parsed.players?.length || 0;
  const pageText = decodeEntities(stripTags(html)).replace(/\s+/g, " ").trim();
  const pageDateInfo = extractDateInfo(pageText, today);
  const sourceFreshScore = scoreSourceUpdated(parsed.sourceUpdated, today);
  const dateScore = Math.max(
    scoreDateInfo(candidate, today),
    scoreDateInfo(pageDateInfo, today)
  );

  const score =
    dateScore +
    sourceFreshScore +
    playersParsed * 10 +
    (parsed.sourceUpdated ? 40 : 0) +
    (parsed.eventName && !/^LPGA Professionals$/i.test(parsed.eventName) ? 15 : 0);

  return {
    slug: urls.slug,
    ok: playersParsed > 0 || dateScore >= 1000,
    score,
    playersParsed,
    sourceUpdated: parsed.sourceUpdated || null,
    eventName: parsed.eventName || null,
    pageDateText: pageDateInfo?.dateText || null,
    pageDateStatus: pageDateInfo?.status || null,
    status: response.status
  };
}

function scoreCandidateWindow(textWindow, fullText, dateInfo) {
  const s = String(textWindow || "").toLowerCase();
  let score = 0;

  score += scoreDateInfo(dateInfo, startOfUtcDay(new Date()));

  if (s.includes("live")) score += 25;
  if (s.includes("leaderboard")) score += 20;
  if (s.includes("up next")) score += 15;
  if (s.includes("championship")) score += 6;
  if (s.includes("open")) score += 4;
  if (s.includes("classic")) score += 4;

  const year = new Date().getUTCFullYear();
  if (s.includes(String(year))) score += 8;

  const pos = fullText.indexOf(textWindow.slice(0, 30));
  if (pos >= 0) score += Math.max(0, 20 - Math.floor(pos / 5000));

  return score;
}

function scoreDateInfo(dateInfo, today) {
  if (!dateInfo) return 0;
  if (dateInfo.status === "active") return 10000;
  if (dateInfo.status === "upcoming") return Math.max(0, 1000 - Math.abs(dateInfo.daysFromToday || 0) * 20);
  if (dateInfo.status === "recent") return Math.max(0, 500 - Math.abs(dateInfo.daysFromToday || 0) * 30);
  if (dateInfo.status === "past") return Math.max(0, 100 - Math.abs(dateInfo.daysFromToday || 0));
  return 0;
}

function scoreSourceUpdated(sourceUpdated, today) {
  if (!sourceUpdated) return 0;
  const sourceTime = Date.parse(sourceUpdated);
  if (Number.isNaN(sourceTime)) return 0;

  const sourceDay = startOfUtcDay(new Date(sourceTime));
  const days = Math.round((sourceDay.getTime() - today.getTime()) / 86400000);
  if (days === 0) return 1000;
  if (days < 0 && days >= -2) return 250;
  return 0;
}

function extractDateInfo(text, today) {
  const s = String(text || "").replace(/\s+/g, " ");
  const currentYear = today.getUTCFullYear();
  const matches = [];

  // Full page header: June 25-28, 2026
  const fullMonthRegex = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*-\s*(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+)?(\d{1,2}),\s*(\d{4})\b/gi;
  collectDateMatches(matches, s, fullMonthRegex, today, match => ({
    startMonth: monthIndex(match[1]),
    startDay: Number(match[2]),
    endMonth: monthIndex(match[3] || match[1]),
    endDay: Number(match[4]),
    year: Number(match[5]),
    dateText: match[0]
  }));

  // Schedule cards: Jun 25 - 28, Jul 30 - Aug 2
  const shortMonthRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})\s*-\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+)?(\d{1,2})\b/gi;
  collectDateMatches(matches, s, shortMonthRegex, today, match => ({
    startMonth: monthIndex(match[1]),
    startDay: Number(match[2]),
    endMonth: monthIndex(match[3] || match[1]),
    endDay: Number(match[4]),
    year: inferYearFromContext(s, match.index, currentYear),
    dateText: match[0]
  }));

  matches.sort((a, b) => Math.abs(a.daysFromToday) - Math.abs(b.daysFromToday));
  return matches[0] || null;
}

function collectDateMatches(matches, source, regex, today, mapper) {
  let match;
  while ((match = regex.exec(source))) {
    const parsed = mapper(match);
    if (parsed.startMonth === null || parsed.endMonth === null || !parsed.year || !parsed.startDay || !parsed.endDay) continue;

    const start = new Date(Date.UTC(parsed.year, parsed.startMonth, parsed.startDay));
    let endYear = parsed.year;
    if (parsed.endMonth < parsed.startMonth) endYear += 1;
    const end = new Date(Date.UTC(endYear, parsed.endMonth, parsed.endDay));

    let status;
    let daysFromToday = 0;
    if (today >= start && today <= end) {
      status = "active";
      daysFromToday = 0;
    } else if (today < start) {
      status = "upcoming";
      daysFromToday = Math.round((start.getTime() - today.getTime()) / 86400000);
    } else {
      const daysSince = Math.round((today.getTime() - end.getTime()) / 86400000);
      status = daysSince <= 7 ? "recent" : "past";
      daysFromToday = -daysSince;
    }

    matches.push({
      dateText: parsed.dateText,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
      status,
      daysFromToday
    });
  }
}

function inferYearFromContext(source, matchIndex, fallbackYear) {
  const before = source.slice(Math.max(0, matchIndex - 120), matchIndex + 80);
  const yearMatches = before.match(/\b20\d{2}\b/g);
  if (yearMatches?.length) return Number(yearMatches[yearMatches.length - 1]);
  return fallbackYear;
}

function monthIndex(value) {
  const key = String(value || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(MONTHS, key) ? MONTHS[key] : null;
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function makeCandidateHint(window) {
  return String(window || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function summarizeTestedCandidate(candidate) {
  return {
    slug: candidate.slug,
    ok: candidate.ok,
    playersParsed: candidate.playersParsed || 0,
    sourceUpdated: candidate.sourceUpdated || null,
    eventName: candidate.eventName || null,
    dateText: candidate.dateText || candidate.pageDateText || null,
    dateStatus: candidate.dateStatus || candidate.pageDateStatus || null,
    daysFromToday: typeof candidate.daysFromToday === "number" ? candidate.daysFromToday : null,
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
