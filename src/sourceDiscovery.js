import { parseLpgaLeaderboard } from "./lpgaParser.js";
import { decodeEntities, stripTags } from "./utils.js";

const TOOL_VERSION = "0.2.5";
const MAX_SCRIPT_FETCHES = 18;
const MAX_SCRIPT_BYTES = 900000;

const LPGA_DISCOVERY_TARGETS = [
  {
    label: "lpgaLeaderboard",
    url: "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/leaderboard",
    parseLeaderboard: true
  },
  {
    label: "lpgaEntries",
    url: "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/entries"
  },
  {
    label: "lpgaPairings",
    url: "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/pairings"
  },
  {
    label: "kpmgLeaderboardSite",
    url: "https://www.kpmgwomenspgachampionship.com/leaderboard"
  },
  {
    label: "genericLpgaLeaderboard",
    url: "https://www.lpga.com/leaderboard"
  }
];

const INTERESTING_URL_PATTERNS = [
  /api/i,
  /leaderboard/i,
  /leaderboards/i,
  /score/i,
  /scores/i,
  /scoring/i,
  /scoreboard/i,
  /tournament/i,
  /tournaments/i,
  /pairing/i,
  /pairings/i,
  /entries/i,
  /players/i,
  /athletes/i,
  /graphql/i,
  /json/i,
  /sitecore/i,
  /edge/i,
  /xmcloud/i,
  /umbraco/i,
  /content/i,
  /data/i,
  /route/i,
  /_next/i
];

const SIGNAL_TERMS = [
  "Api.init",
  "apiKey",
  "graphql",
  "sitecore",
  "edge",
  "leaderboardRows",
  "LeaderboardScreen",
  "TournamentLeaderboardScreen",
  "tournamentId",
  "TournamentId",
  "tournamentCode",
  "TournamentCode",
  "tournamentStatus",
  "tournamentAlert",
  "scoreboard",
  "scoring",
  "pairings",
  "entries",
  "athlete",
  "thru",
  "totalScore",
  "tot",
  "rank",
  "position"
];

export async function discoverLpgaSource({ appVersion = "unknown" } = {}) {
  const startedAt = new Date().toISOString();
  const pages = [];

  for (const target of LPGA_DISCOVERY_TARGETS) {
    pages.push(await inspectPage(target));
  }

  const allCandidateUrls = unique(
    pages.flatMap(page => page.candidateUrls || [])
  ).slice(0, 500);

  const allScriptUrls = unique(
    pages.flatMap(page => page.scriptUrls || [])
  );

  const scriptUrlsToInspect = chooseScriptsToInspect(allScriptUrls);
  const scriptInspections = [];
  for (const scriptUrl of scriptUrlsToInspect) {
    scriptInspections.push(await inspectScript(scriptUrl));
  }

  const scriptCandidateUrls = unique(
    scriptInspections.flatMap(script => script.candidateUrls || [])
  ).slice(0, 500);

  const allCandidates = unique([...allCandidateUrls, ...scriptCandidateUrls]).slice(0, 700);
  const strongestCandidates = allCandidates.filter(url =>
    /api|leaderboard|leaderboards|score|scores|scoring|scoreboard|graphql|sitecore|edge|tournament|pairing|entries|athlete|player/i.test(url)
  );

  const topSignals = summarizeSignals(pages, scriptInspections);

  return {
    appVersion,
    tool: "LPGA Source Discovery",
    toolVersion: TOOL_VERSION,
    startedAt,
    completedAt: new Date().toISOString(),
    summary: {
      pagesChecked: pages.length,
      scriptsDiscovered: allScriptUrls.length,
      scriptsInspected: scriptInspections.length,
      totalCandidateUrls: allCandidates.length,
      strongestCandidateUrls: strongestCandidates.length,
      strongestSignals: topSignals,
      note: "v0.2.5 fetches LPGA/KPMG pages and JS chunks, then searches for API, GraphQL, Sitecore, leaderboard, scoring, tournament, and player-data clues."
    },
    strongestCandidates: strongestCandidates.slice(0, 150),
    allCandidateUrls: allCandidates.slice(0, 250),
    scriptInspections,
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
        "user-agent": "Mozilla/5.0 GolfTracker/0.2.5 SourceDiscovery",
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
    result.visibleTextSample = lines.slice(0, 100);

    const parsed = target.parseLeaderboard ? parseLpgaLeaderboard(html) : null;
    result.parsedLeaderboard = parsed
      ? {
          eventName: parsed.eventName,
          sourceUpdated: parsed.sourceUpdated,
          playersParsed: parsed.players.length,
          isPartial: parsed.isPartial,
          playerSample: parsed.players.slice(0, 15)
        }
      : null;

    result.scriptUrls = extractTagUrls(html, "script", "src", result.finalUrl).slice(0, 100);
    result.linkUrls = extractTagUrls(html, "link", "href", result.finalUrl).slice(0, 100);
    result.formActions = extractTagUrls(html, "form", "action", result.finalUrl).slice(0, 40);
    result.candidateUrls = extractCandidateUrls(html, result.finalUrl).slice(0, 300);
    result.inlineHints = findInlineHints(html).slice(0, 140);
    result.termContexts = findTermContexts(html, SIGNAL_TERMS).slice(0, 80);

    return result;
  } catch (error) {
    result.ok = false;
    result.error = error.message;
    return result;
  }
}

async function inspectScript(scriptUrl) {
  const result = {
    url: scriptUrl,
    fetchedAt: new Date().toISOString()
  };

  try {
    const response = await fetch(scriptUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 GolfTracker/0.2.5 ScriptDiscovery",
        "accept": "application/javascript,text/javascript,*/*;q=0.8"
      }
    });

    result.status = response.status;
    result.ok = response.ok;
    result.contentType = response.headers.get("content-type") || null;

    let text = await response.text();
    result.byteLength = text.length;
    if (text.length > MAX_SCRIPT_BYTES) {
      text = text.slice(0, MAX_SCRIPT_BYTES);
      result.truncated = true;
    }

    result.signalCounts = countSignals(text, SIGNAL_TERMS);
    result.hasUsefulSignals = Object.values(result.signalCounts).some(count => count > 0);
    result.candidateUrls = extractCandidateUrls(text, scriptUrl).slice(0, 250);
    result.fetchLikeCalls = findFetchLikeCalls(text).slice(0, 80);
    result.graphqlContexts = findTermContexts(text, ["graphql", "query ", "mutation ", "sitecore", "edge"]).slice(0, 40);
    result.leaderboardContexts = findTermContexts(text, ["leaderboardRows", "LeaderboardScreen", "TournamentLeaderboardScreen", "leaderboard", "scoreboard", "scoring"]).slice(0, 70);
    result.tournamentContexts = findTermContexts(text, ["tournamentId", "TournamentId", "tournamentCode", "TournamentCode", "tournamentStatus", "tournamentAlert"]).slice(0, 60);
    result.apiKeyContexts = findTermContexts(text, ["apiKey", "sc_apikey", "Api.init"]).slice(0, 30);

    return result;
  } catch (error) {
    result.ok = false;
    result.error = error.message;
    return result;
  }
}

function chooseScriptsToInspect(scriptUrls) {
  const urls = unique(scriptUrls || []);

  const scored = urls.map(url => {
    let score = 0;
    if (/page-/i.test(url)) score += 100;
    if (/app\//i.test(url)) score += 70;
    if (/main-app/i.test(url)) score += 50;
    if (/chunks\/\d/i.test(url)) score += 40;
    if (/polyfills|webpack|gtm|analytics|ads|ezoic|up_loader/i.test(url)) score -= 100;
    if (/lpga\.com/i.test(url)) score += 20;
    return { url, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SCRIPT_FETCHES)
    .map(item => item.url);
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

function extractCandidateUrls(rawInput, baseUrl) {
  const raw = String(rawInput || "");
  const candidates = [];

  const quotedUrlPattern = new RegExp("[\\\"']((?:https?:\\/\\/|\\/)[^\\\"'<>\\\\s]+)[\\\"']", "g");
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

  const pathStringPattern = /["'`]((?:api|sitecore|graphql|leaderboard|scoreboard|scores?|scoring|tournaments?|entries|pairings|athletes?|players?)[A-Za-z0-9_./?&=%:+#-]{2,})["'`]/gi;
  while ((match = pathStringPattern.exec(raw)) !== null) {
    const url = decodeUrlish(match[1]);
    const maybePath = url.startsWith("/") ? url : "/" + url;
    if (isInterestingUrl(maybePath)) candidates.push(resolveUrl(maybePath, baseUrl));
  }

  return unique(candidates)
    .filter(url => !/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|css)(\?|$)/i.test(url))
    .slice(0, 500);
}

function findInlineHints(rawInput) {
  const raw = String(rawInput || "");
  const hints = [];
  const patterns = [
    /api[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /leaderboard[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /scoreboard[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /scores?[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /scoring[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /graphql[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /sitecore[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /tournament[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /pairings?[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /entries[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /athlete[A-Za-z0-9_./?&=%:+#-]{0,160}/gi,
    /player[A-Za-z0-9_./?&=%:+#-]{0,160}/gi
  ];

  for (const pattern of patterns) {
    for (const match of raw.matchAll(pattern)) {
      const hint = cleanSnippet(match[0]);
      if (hint.length > 3) hints.push(hint);
    }
  }

  return unique(hints);
}

function findTermContexts(rawInput, terms, contextSize = 140) {
  const raw = String(rawInput || "");
  const contexts = [];

  for (const term of terms) {
    const lowerRaw = raw.toLowerCase();
    const lowerTerm = term.toLowerCase();
    let start = 0;
    let count = 0;

    while (count < 8) {
      const idx = lowerRaw.indexOf(lowerTerm, start);
      if (idx === -1) break;
      const before = Math.max(0, idx - contextSize);
      const after = Math.min(raw.length, idx + term.length + contextSize);
      contexts.push({
        term,
        snippet: cleanSnippet(raw.slice(before, after))
      });
      start = idx + lowerTerm.length;
      count += 1;
    }
  }

  return uniqueBy(contexts, item => `${item.term}:${item.snippet}`);
}

function findFetchLikeCalls(rawInput) {
  const raw = String(rawInput || "");
  const calls = [];
  const patterns = [
    /fetch\((.{0,260})\)/gi,
    /axios\.(get|post)\((.{0,260})\)/gi,
    /\.get\((.{0,260})\)/gi,
    /\.post\((.{0,260})\)/gi,
    /request\((.{0,260})\)/gi
  ];

  for (const pattern of patterns) {
    for (const match of raw.matchAll(pattern)) {
      calls.push(cleanSnippet(match[0]));
    }
  }

  return unique(calls);
}

function countSignals(rawInput, terms) {
  const raw = String(rawInput || "").toLowerCase();
  const counts = {};

  for (const term of terms) {
    const normalized = term.toLowerCase();
    let count = 0;
    let start = 0;
    while (true) {
      const idx = raw.indexOf(normalized, start);
      if (idx === -1) break;
      count += 1;
      start = idx + normalized.length;
    }
    if (count) counts[term] = count;
  }

  return counts;
}

function summarizeSignals(pages, scripts) {
  const signals = [];

  for (const page of pages) {
    if (page.parsedLeaderboard) {
      signals.push(`${page.label}: parsed ${page.parsedLeaderboard.playersParsed} leaderboard rows`);
    }
    if (page.lastUpdatedText) {
      signals.push(`${page.label}: last updated ${page.lastUpdatedText}`);
    }
    if ((page.inlineHints || []).some(h => /apiKey|Api\.init/i.test(h))) {
      signals.push(`${page.label}: public API key / Api.init hint found`);
    }
    if ((page.inlineHints || []).some(h => /leaderboardRows|TournamentLeaderboardScreen|tournamentId|tournamentCode/i.test(h))) {
      signals.push(`${page.label}: leaderboard/tournament component hints found`);
    }
  }

  for (const script of scripts) {
    const count = Object.values(script.signalCounts || {}).reduce((a, b) => a + b, 0);
    if (count > 0) {
      const fileName = script.url.split("/").pop();
      signals.push(`${fileName}: ${count} signal terms found`);
    }
  }

  return signals.slice(0, 40);
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
    .replace(/&amp;/g, "&")
    .replace(/\\x2F/g, "/");
}

function cleanSnippet(value) {
  return decodeEntities(decodeUrlish(String(value || "")))
    .replace(/\s+/g, " ")
    .slice(0, 500);
}

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return String(value || "");
  }
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}
