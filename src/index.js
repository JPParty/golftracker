const CACHE_SECONDS = 301;
const LPGA_LEADERBOARD_URL = "https://www.lpga.com/tournaments/kpmgwomenspgachampionship/leaderboard";
let memoryCache = {
  expiresAt: 0,
  data: null
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/leaderboard") {
      return json(await getLeaderboard());
    }

    if (url.pathname === "/manifest.json") {
      return json({
        name: "GolfTracker",
        short_name: "GolfTracker",
        start_url: "/",
        display: "standalone",
        background_color: "#020617",
        theme_color: "#020617",
        icons: []
      });
    }

    return new Response(APP_HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function getLeaderboard() {
  const now = Date.now();

  if (memoryCache.data && memoryCache.expiresAt > now) {
    return {
      ...memoryCache.data,
      cached: true
    };
  }

  try {
    const response = await fetch(LPGA_URL, {
      headers: {
        "user-agent": "Mozilla/5.0 GolfTracker/1.0",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(`LPGA responded with ${response.status}`);
    }

    const html = await response.text();
    const parsed = parseLpgaLeaderboard(html);

    const data = {
      source: "LPGA",
      sourceUrl: LPGA_URL,
      eventName: parsed.eventName || "Current LPGA Tournament",
      updatedAt: new Date().toISOString(),
      players: parsed.players,
      warning: parsed.players.length ? null : "No leaderboard rows could be parsed from the LPGA source."
    };

    memoryCache = {
      expiresAt: now + CACHE_SECONDS * 1000,
      data
    };

    return data;
  } catch (error) {
    if (memoryCache.data) {
      return {
        ...memoryCache.data,
        cached: true,
        warning: `Live refresh failed. Showing cached data. ${error.message}`
      };
    }

    return {
      source: "LPGA",
      sourceUrl: LPGA_URL,
      eventName: "LPGA Leaderboard",
      updatedAt: null,
      players: [],
      error: error.message,
      warning: "Could not retrieve leaderboard data."
    };
  }
}

function parseLpgaLeaderboard(html) {
  const text = decodeEntities(stripTags(html))
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ");

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const eventName = findEventName(lines);
  const players = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const pos = normalizePosition(lines[i]);
    if (!pos) continue;

    const window = lines.slice(i + 1, i + 14);
    const nameIndex = window.findIndex(isLikelyPlayerName);
    if (nameIndex === -1) continue;

    const name = cleanName(window[nameIndex]);
    const afterName = window.slice(nameIndex + 1);
    const scores = afterName.filter(isGolfScore).slice(0, 3);
    const thru = afterName.find(isThruValue) || "-";

    const total = scores[0] || "-";
    const today = scores[1] || "-";

    if (!name || total === "-") continue;

    const key = `${pos}-${name}`;
    if (seen.has(key)) continue;
    seen.add(key);

    players.push({
      id: key.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      pos,
      name,
      today,
      thru: normalizeThru(thru),
      total
    });
  }

  return { eventName, players: players.slice(0, 100) };
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function findEventName(lines) {
  const ignored = new Set(["leaderboard", "schedule", "tournaments", "players", "news", "video"]);
  const candidate = lines.find(line => {
    const lower = line.toLowerCase();
    return line.length > 8 &&
      line.length < 80 &&
      !ignored.has(lower) &&
      /(championship|classic|open|invitational|cup|tournament|women|lpga)/i.test(line);
  });
  return candidate || "Current LPGA Tournament";
}

function normalizePosition(value) {
  const cleaned = String(value).trim().replace(/^pos\.?\s*/i, "");
  return /^(T)?\d{1,3}$/i.test(cleaned) ? cleaned.toUpperCase() : null;
}

function cleanName(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\b(USA|KOR|JPN|AUS|ENG|SWE|THA|CAN|CHN|FRA|GER|ESP|MEX|NZL|RSA)\b/g, "")
    .trim();
}

function isLikelyPlayerName(value) {
  const s = cleanName(value);
  if (s.length < 4 || s.length > 45) return false;
  if (/^(no change|moved up|moved down|up|down|new)$/i.test(s)) return false;
  if (/^(today|total|thru|round|score|pos|player|country)$/i.test(s)) return false;
  if (isGolfScore(s) || isThruValue(s) || normalizePosition(s)) return false;
  return /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(s) && /[A-Za-z]/.test(s) && s.includes(" ");
}

function isGolfScore(value) {
  const s = String(value).trim().toUpperCase();
  return /^(E|EVEN|[+-]?\d{1,2})$/.test(s);
}

function isThruValue(value) {
  const s = String(value).trim().toUpperCase();
  return /^(F|FINAL|\d{1,2})$/.test(s);
}

function normalizeThru(value) {
  const s = String(value).trim().toUpperCase();
  if (s === "FINAL") return "F";
  return s || "-";
}

const APP_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#020617" />
  <link rel="manifest" href="/manifest.json" />
  <title>GolfTracker</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #020617;
      --card: #0f172a;
      --card2: #111827;
      --line: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --green: #34d399;
      --red: #fb7185;
      --blue: #60a5fa;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .app { max-width: 760px; margin: 0 auto; padding: 16px; }
    .header {
      background: linear-gradient(180deg, #0f172a, #020617);
      border: 1px solid var(--line);
      border-radius: 20px;
      padding: 18px;
      margin-bottom: 12px;
    }
    .eyebrow { color: var(--green); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
    h1 { margin: 8px 0 6px; font-size: 22px; line-height: 1.15; }
    .meta { color: var(--muted); font-size: 13px; }
    .actions { display: flex; gap: 10px; margin-top: 14px; }
    button {
      appearance: none;
      border: 0;
      border-radius: 14px;
      background: #2563eb;
      color: white;
      font-weight: 800;
      padding: 12px 14px;
      min-height: 44px;
      cursor: pointer;
      flex: 0 0 auto;
    }
    button:active { transform: scale(.98); }
    .status { color: var(--muted); font-size: 12px; align-self: center; }
    .notice {
      display: none;
      border: 1px solid #854d0e;
      background: #422006;
      color: #fde68a;
      border-radius: 14px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 13px;
    }
    .leaderboard {
      border: 1px solid var(--line);
      background: var(--card);
      border-radius: 20px;
      overflow: hidden;
    }
    .row, .head {
      display: grid;
      grid-template-columns: 48px 1fr 54px 68px;
      gap: 8px;
      align-items: center;
      min-height: 58px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
    }
    .head {
      min-height: 40px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 800;
      background: #020617;
    }
    .row:last-child { border-bottom: 0; }
    .pos { color: var(--muted); font-weight: 900; text-align: center; }
    .name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub { color: var(--muted); font-size: 12px; margin-top: 3px; }
    .thru { text-align: center; color: var(--blue); font-weight: 800; }
    .score { text-align: right; font-size: 20px; font-weight: 950; }
    .under { color: var(--green); }
    .over { color: var(--red); }
    .even { color: var(--muted); }
    .empty { color: var(--muted); text-align: center; padding: 32px 20px; }
    @media (max-width: 430px) {
      .app { padding: 12px; }
      h1 { font-size: 20px; }
      .row, .head { grid-template-columns: 42px 1fr 48px 60px; padding-left: 8px; padding-right: 10px; }
      .score { font-size: 19px; }
    }
  </style>
</head>
<body>
  <main class="app">
    <section class="header">
      <div class="eyebrow">GolfTracker • LPGA</div>
      <h1 id="eventName">Loading leaderboard…</h1>
      <div class="meta" id="lastUpdated">Checking for current tournament</div>
      <div class="actions">
        <button id="refreshBtn">Refresh</button>
        <div class="status" id="status">Auto-refresh: 60 sec</div>
      </div>
    </section>

    <div class="notice" id="notice"></div>

    <section class="leaderboard" aria-label="Leaderboard">
      <div class="head">
        <div>Pos</div><div>Player</div><div style="text-align:center">Thru</div><div style="text-align:right">Total</div>
      </div>
      <div id="rows"><div class="empty">Loading…</div></div>
    </section>
  </main>

  <script>
    const rows = document.getElementById('rows');
    const eventName = document.getElementById('eventName');
    const lastUpdated = document.getElementById('lastUpdated');
    const refreshBtn = document.getElementById('refreshBtn');
    const statusEl = document.getElementById('status');
    const notice = document.getElementById('notice');

    let loading = false;

    function scoreClass(score) {
      const s = String(score || '').trim().toUpperCase();
      if (s === 'E' || s === 'EVEN' || s === '0') return 'even';
      if (s.startsWith('+')) return 'over';
      if (/^-/.test(s)) return 'under';
      return 'even';
    }

    function formatTime(iso) {
      if (!iso) return 'No successful update yet';
      return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    function render(data) {
      eventName.textContent = data.eventName || 'LPGA Leaderboard';
      lastUpdated.textContent = 'Last successful update: ' + formatTime(data.updatedAt);

      if (data.warning || data.error) {
        notice.style.display = 'block';
        notice.textContent = data.warning || data.error;
      } else {
        notice.style.display = 'none';
      }

      const players = Array.isArray(data.players) ? data.players : [];
      if (!players.length) {
        rows.innerHTML = '<div class="empty">No leaderboard data available yet.</div>';
        return;
      }

      rows.innerHTML = players.map(p => {
        const score = p.total || '-';
        return '<div class="row">' +
          '<div class="pos">' + escapeHtml(p.pos || '-') + '</div>' +
          '<div><div class="name">' + escapeHtml(p.name || 'Unknown') + '</div><div class="sub">Today: ' + escapeHtml(p.today || '-') + '</div></div>' +
          '<div class="thru">' + escapeHtml(p.thru || '-') + '</div>' +
          '<div class="score ' + scoreClass(score) + '">' + escapeHtml(score) + '</div>' +
        '</div>';
      }).join('');
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    }

    async function loadLeaderboard() {
      if (loading) return;
      loading = true;
      refreshBtn.disabled = true;
      statusEl.textContent = 'Refreshing…';

      try {
        const response = await fetch('/api/leaderboard?ts=' + Date.now());
        const data = await response.json();
        render(data);
        statusEl.textContent = data.cached ? 'Showing cached data' : 'Auto-refresh: 60 sec';
      } catch (error) {
        notice.style.display = 'block';
        notice.textContent = 'Could not load leaderboard: ' + error.message;
        statusEl.textContent = 'Refresh failed';
      } finally {
        loading = false;
        refreshBtn.disabled = false;
      }
    }

    refreshBtn.addEventListener('click', loadLeaderboard);
    loadLeaderboard();
    setInterval(loadLeaderboard, 60000);
  </script>
</body>
</html>`;
