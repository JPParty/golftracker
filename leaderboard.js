export async function onRequestGet({ request }) {
  try {
    const cache = caches.default;
    const cacheKey = new Request(new URL(request.url).origin + "/api/leaderboard-cache");
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const sourceUrl = "https://www.lpga.com/leaderboard";
    const sourceResponse = await fetch(sourceUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; GolfTracker/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!sourceResponse.ok) {
      return json({ error: "Official source unavailable", status: sourceResponse.status }, 502);
    }

    const html = await sourceResponse.text();
    const data = parseLpgaLeaderboard(html);

    const response = json(data, 200, {
      "Cache-Control": "public, max-age=60"
    });

    await cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    return json({ error: "Failed to retrieve leaderboard", details: String(error?.message || error) }, 500);
  }
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    }
  });
}

function parseLpgaLeaderboard(html) {
  const plainText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');

  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const eventName = clean(titleMatch?.[1]) || "Current LPGA Tournament";

  const lines = plainText
    .split(/\n+/)
    .map(clean)
    .filter(Boolean);

  const players = extractPlayersFromLines(lines);

  return {
    source: "LPGA",
    eventName,
    updatedAt: new Date().toISOString(),
    players
  };
}

function clean(value = "") {
  return String(value)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPlayersFromLines(lines) {
  const players = [];

  for (let i = 0; i < lines.length; i++) {
    const position = lines[i];
    if (!/^T?\d{1,3}$/.test(position)) continue;

    const window = lines.slice(i + 1, i + 10);
    const scoreIndex = window.findIndex(isScore);
    if (scoreIndex <= 0) continue;

    const nameCandidates = window.slice(0, scoreIndex).filter(isLikelyName);
    const name = nameCandidates[nameCandidates.length - 1];
    if (!name) continue;

    const total = normalizeScore(window[scoreIndex]);
    const today = normalizeScore(window[scoreIndex + 1] || "");
    const thru = normalizeThru(window[scoreIndex + 2] || "");

    if (players.some(p => p.position === position && p.name === name)) continue;

    players.push({
      id: `${position}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      position,
      name,
      total,
      today,
      thru
    });
  }

  return players.slice(0, 100);
}

function isScore(value) {
  return /^(E|[+-]?\d{1,2})$/i.test(String(value).trim());
}

function normalizeScore(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "0" || raw === "+0" || raw.toUpperCase() === "E") return "E";
  if (/^\d+$/.test(raw)) return `+${raw}`;
  return raw;
}

function normalizeThru(value) {
  const raw = String(value || "").trim();
  if (/^(F|FINAL|FINISHED)$/i.test(raw)) return "F";
  if (/^\d{1,2}$/.test(raw)) return raw;
  return raw || "-";
}

function isLikelyName(value) {
  const raw = String(value || "").trim();
  if (raw.length < 4 || raw.length > 48) return false;
  if (isScore(raw)) return false;
  if (/^(pos|position|player|total|today|thru|round|score|rank)$/i.test(raw)) return false;
  if (/^T?\d+$/.test(raw)) return false;
  return /[A-Za-z]/.test(raw);
}
