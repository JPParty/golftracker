import { styles } from "./styles.js";
import { getClientScript } from "./clientScript.js";

export function renderAppHtml({ appVersion }) {
  return baseHtml({
    appVersion,
    title: "GolfTracker",
    body: `
  <main class="app">
    <section class="header">
      <nav class="top-nav" aria-label="Tournament navigation">
        <a class="nav-button" href="/results">Previous Results</a>
        <a class="nav-button" href="/schedule">Future Tournaments</a>
      </nav>
      <div class="eyebrow">GolfTracker • LPGA</div>
      <h1 id="eventName">Loading GolfTracker…</h1>
      <div class="meta" id="lastUpdated">Finding the current LPGA tournament and latest leaderboard.</div>
      <details class="debug-details">
        <summary>Debug status</summary>
        <div id="debug-status" class="debug-panel">Loading status...</div>
      </details>
      <div class="actions">
        <button id="refreshBtn">Refresh</button>
      </div>
    </section>

    <div class="notice" id="notice"></div>

    <section class="leaderboard" aria-label="Leaderboard">
      <div class="head">
        <div>Pos</div><div>Player</div><div style="text-align:center">Thru</div><div style="text-align:right">Total</div>
      </div>
      <div id="rows"><div class="empty">Loading leaderboard. First load may take a few seconds.</div></div>
    </section>
  </main>

  <script>${getClientScript({ appVersion })}</script>`
  });
}

export function renderResultsHtml({ appVersion }) {
  return baseHtml({
    appVersion,
    title: "Previous Results • GolfTracker",
    body: `
  <main class="app">
    <section class="header">
      <nav class="top-nav single" aria-label="Current tournament navigation">
        <a class="nav-button" href="/">← Current Tournament</a>
      </nav>
      <div class="eyebrow">GolfTracker • Archive</div>
      <h1>Previous Tournament Results</h1>
      <div class="meta">Completed tournament leaderboards will be listed here.</div>
    </section>

    <section class="placeholder-card" aria-label="Previous tournament results">
      <h2>Coming soon</h2>
      <p>Each previous tournament will have a dropdown showing the final player standings and total tournament score.</p>
      <div class="placeholder-example">
        <div class="placeholder-title">Tournament Name</div>
        <div class="placeholder-row"><span>1. Player Name</span><strong>-12</strong></div>
        <div class="placeholder-row"><span>2. Player Name</span><strong>-10</strong></div>
        <div class="placeholder-row"><span>T3. Player Name</span><strong>-8</strong></div>
      </div>
    </section>
  </main>`
  });
}

export function renderScheduleHtml({ appVersion }) {
  return baseHtml({
    appVersion,
    title: "Future Tournaments • GolfTracker",
    body: `
  <main class="app">
    <section class="header">
      <nav class="top-nav single" aria-label="Current tournament navigation">
        <a class="nav-button" href="/">← Current Tournament</a>
      </nav>
      <div class="eyebrow">GolfTracker • Schedule</div>
      <h1>Future Tournaments</h1>
      <div class="meta">Upcoming tournament schedule details will be listed here.</div>
    </section>

    <section class="placeholder-card" aria-label="Future tournament schedule">
      <h2>Coming soon</h2>
      <p>Each future tournament will show the date, location, and whether it is a signature event.</p>
      <div class="placeholder-example">
        <div class="placeholder-title">Tournament Name</div>
        <div class="placeholder-row"><span>Date</span><strong>TBD</strong></div>
        <div class="placeholder-row"><span>Location</span><strong>TBD</strong></div>
        <div class="placeholder-row"><span>Signature Event</span><strong>TBD</strong></div>
      </div>
    </section>
  </main>`
  });
}

function baseHtml({ appVersion, title, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#020617" />
  <link rel="manifest" href="/manifest.json" />
  <title>${title}</title>
  <style>${styles}</style>
</head>
<body>
${body}
  <div class="version">v${appVersion}</div>
</body>
</html>`;
}
