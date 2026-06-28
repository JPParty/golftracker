import { parseLpgaLeaderboard } from "./lpgaParser.js";
import { decodeEntities, stripTags } from "./utils.js";

const LPGA_DISCOVERY_TARGETS = [
  {
    label: "leaderboard",
    url: "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/leaderboard"
  },
  {
    label: "entries",
    url: "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/entries"
  },
  {
    label: "pairings",
    url: "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/pairings"
  }
];

const INTERESTING_URL_PATTERNS = [
  /api/i,
  /leaderboard/i,
  /score/i,
  /scores/i,
  /scoreboard/i,
  /tournament/i,
  /tournaments/i,
  /pairing/i,
  /pairings/i,
  /entries/i,
  /graphql/i,
  /json/i,
  /_next/i,
  /static/i,
  /umbraco/i,
  /content/i
];

export async function discoverLpgaSource({ appVersion = "unknown" } = {}) {
  const startedAt = new Date().toISOString();
  const pages = [];

  for (const target of LPGA_DISCOVERY_TARGETS) {
    pages.push(await inspectPage(target));
  }

  const allCandidateUrls = unique(
    pages.flatMap(page => page.candidateUrls || [])
  ).slice(0, 250);

  const strongestCandidates = allCandidateUrls.filter(url =>
    /api|leaderboard|score|scoreboard|graphql|tournament|pairing|entries/i.test(url)
  );

  return {
    appVersion,
    tool: "LPGA Source Discovery",
    toolVersion: "0.2.4",
    startedAt,
    completedAt: new Date().toISOString(),
    summary: {
      pagesChecked: pages.length,
      totalCandidateUrls: allCandidateUrls.length,
      strongestCandidateUrls: strongestCandidates.length,
      note: "Use this endpoint to identify hidden LPGA script, JSON, API, or page-data URLs that might contain full-field live scoring."
    },
    strongestCandidates: strongestCandidates.slice(0, 100),
    allCandidateUrls: allCandidateUrls.slice(0, 150),
    pages
  };
}

async function inspectPage(target) {
  const result = {
    label: target.label,
    requestedUrl: target.url,
    fetchedAt: new Date().toISOString()
  };

  try {
    const response = await fetch(target.url, {
      headers: {
        "user-agent": "Mozilla/5.0 GolfTracker/0.2.4 SourceDiscovery",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    result.status = response.status;
    result.ok = response.ok;
    result.finalUrl = response.url || target.url;
    result.contentType = response.headers.get("content-type") || null;

    const html = await response.text();
    result.byteLength = html.length;

    const text = decodeEntities(stripTags(html));
    const lines = text
      .replace(/\r/g, "\n")
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    result.lineCount = lines.length;
    result.hasNextData = /__NEXT_DATA__/i.test(html);
    result.hasNuxtData = /__NUXT__/i.test(html);
    result.hasApolloData = /apollo/i.test(html);
    result.hasGraphqlText = /graphql/i.test(html);
    result.lastUpdatedText = findLastUpdated(lines);
    result.visibleTextSample = lines.slice(0, 80);

    const parsed = target.label === "leaderboard" ? parseLpgaLeaderboard(html) : null;
    result.parsedLeaderboard = parsed
      ? {
          eventName: parsed.eventName,
          sourceUpdated: parsed.sourceUpdated,
          playersParsed: parsed.players.length,
          isPartial: parsed.isPartial,
          playerSample: parsed.players.slice(0, 12)
        }
      : null;

    result.scriptUrls = extractTagUrls(html, "script", "src", result.finalUrl).slice(0, 80);
    result.linkUrls = extractTagUrls(html, "link", "href", result.finalUrl).slice(0, 80);
    result.formActions = extractTagUrls(html, "form", "action", result.finalUrl).slice(0, 40);
    result.candidateUrls = extractCandidateUrls(html, result.finalUrl);
    result.inlineHints = findInlineHints(html).slice(0, 80);

    return result;
  } catch (error) {
    result.ok = false;
    result.error = error.message;
    return result;
  }
}

function extractTagUrls(html, tagName, attrName, baseUrl) {
  const urls = [];
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  const attrPattern = new RegExp(`${attrName}=["']([^"']+)["']`, "i");
  const tags = String(html || "").match(tagPattern) || [];

  for (const tag of tags) {
    const match = tag.match(attrPattern);
    if (!match) continue;
    urls.push(resolveUrl(match[1], baseUrl));
  }

  return unique(urls);
}

function extractCandidateUrls(html, baseUrl) {
  const raw = String(html || "");
  const candidates = [];

  const quotedUrlPattern = new RegExp("[\"\']((?:https?:\\/\\/|\\/)[^\"\'<>\\\\s]+)[\"\']", "g");
  let match;
  while ((match = quotedUrlPattern.exec(raw)) !== null) {
    const url = decodeUrlish(match[1]);
    if (isInterestingUrl(url)) candidates.push(resolveUrl(url, baseUrl));
  }

  const unescapedPattern = /(?:https?:\/\/|\/)[A-Za-z0-9_./?&=%:+#-]{8,}/g;
  while ((match = unescapedPattern.exec(raw)) !== null) {
    const url = decodeUrlish(match[0]);
    if (isInterestingUrl(url)) candidates.push(resolveUrl(url, baseUrl));
  }

  return unique(candidates)
    .filter(url => !/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf)(\?|$)/i.test(url))
    .slice(0, 250);
}

function findInlineHints(html) {
  const raw = String(html || "");
  const hints = [];
  const patterns = [
    /api[A-Za-z0-9_./?&=%:+#-]{0,120}/gi,
    /leaderboard[A-Za-z0-9_./?&=%:+#-]{0,120}/gi,
    /scoreboard[A-Za-z0-9_./?&=%:+#-]{0,120}/gi,
    /graphql[A-Za-z0-9_./?&=%:+#-]{0,120}/gi,
    /tournament[A-Za-z0-9_./?&=%:+#-]{0,120}/gi,
    /pairings?[A-Za-z0-9_./?&=%:+#-]{0,120}/gi,
    /entries[A-Za-z0-9_./?&=%:+#-]{0,120}/gi
  ];

  for (const pattern of patterns) {
    for (const match of raw.matchAll(pattern)) {
      const hint = decodeEntities(decodeUrlish(match[0]))
        .replace(/\\u002F/g, "/")
        .replace(/\\\//g, "/")
        .slice(0, 180);
      if (hint.length > 3) hints.push(hint);
    }
  }

  return unique(hints);
}

function findLastUpdated(lines) {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/last updated/i.test(line)) {
      const inline = line.replace(/last updated:?/i, "").trim();
      if (inline && inline !== line) return inline;
      return lines[i + 1] || null;
    }
  }
  return null;
}

function isInterestingUrl(value) {
  const s = String(value || "");
  return INTERESTING_URL_PATTERNS.some(pattern => pattern.test(s));
}

function decodeUrlish(value) {
  return String(value || "")
    .replace(/\\u002F/g, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return String(value || "");
  }
}

function unique(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}
