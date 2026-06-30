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
        <a class="nav-button" href="/results">Previous Tournaments</a>
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
    title: "Previous Tournaments • GolfTracker",
    body: `
  <main class="app">
    <section class="header page-header">
      <nav class="top-nav single" aria-label="Current tournament navigation">
        <a class="nav-button secondary" href="/">← Current Tournament</a>
      </nav>
      <div class="eyebrow">GolfTracker • Archive</div>
      <h1>Previous Tournaments</h1>
      <div class="meta">Return to completed LPGA tournament results after the main page has moved on to the next event.</div>
      <div class="page-status">Archive page coming soon</div>
    </section>

    <section class="placeholder-card" aria-label="Previous tournaments preview">
      <h2>Planned layout</h2>
      <p>Each previous tournament will be listed as a collapsible card. Opening a tournament will show final standings and each player's total score.</p>

      <details class="sample-tournament" open>
        <summary>
          <span>
            <strong>Tournament Name</strong>
            <small>Completed tournament • Final results</small>
          </span>
        </summary>
        <div class="sample-standings" aria-label="Example final standings">
          <div class="sample-row"><span>1. Player Name</span><strong>-12</strong></div>
          <div class="sample-row"><span>2. Player Name</span><strong>-10</strong></div>
          <div class="sample-row"><span>T3. Player Name</span><strong>-8</strong></div>
        </div>
      </details>
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
    <section class="header page-header">
      <nav class="top-nav single" aria-label="Current tournament navigation">
        <a class="nav-button secondary" href="/">← Current Tournament</a>
      </nav>
      <div class="eyebrow">GolfTracker • Schedule</div>
      <h1>Future Tournaments</h1>
      <div class="meta">Upcoming LPGA tournaments will be listed here with date, location, and event type.</div>
      <div class="page-status">Schedule page coming soon</div>
    </section>

    <section class="placeholder-card" aria-label="Future tournaments preview">
      <h2>Planned layout</h2>
      <p>Each future tournament will show the scheduled date, tournament location, and whether it is a signature event.</p>

      <div class="schedule-card">
        <div>
          <div class="schedule-title">Tournament Name</div>
          <div class="schedule-subtitle">Location TBD</div>
        </div>
        <div class="schedule-details">
          <div><span>Date</span><strong>TBD</strong></div>
          <div><span>Signature Event</span><strong>TBD</strong></div>
        </div>
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
