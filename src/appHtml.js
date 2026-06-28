import { styles } from "./styles.js";
import { getClientScript } from "./clientScript.js";

export function renderAppHtml({ appVersion }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#020617" />
  <link rel="manifest" href="/manifest.json" />
  <title>GolfTracker</title>
  <style>${styles}</style>
</head>
<body>
  <main class="app">
    <section class="header">
      <div class="eyebrow">GolfTracker • LPGA</div>
      <h1 id="eventName">Loading leaderboard…</h1>
      <div class="meta" id="lastUpdated">Checking for current tournament</div>
      <details class="debug-details">
        <summary>Debug status</summary>
        <div id="debug-status" class="debug-panel">Loading status...</div>
      </details>
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

  <script>${getClientScript({ appVersion })}</script>
</body>
</html>`;
}
