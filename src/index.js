import { getLeaderboard } from "./leaderboardService.js";
import { renderAppHtml } from "./appHtml.js";
import { discoverLpgaSource, probeCandidateSources } from "./sourceDiscovery.js";

export const APP_VERSION = "0.2.6";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/leaderboard") {
      return json(await getLeaderboard({ appVersion: APP_VERSION }));
    }

    if (url.pathname === "/debug/lpga-source") {
      return json(await discoverLpgaSource({ requestUrl: url.toString(), appVersion: APP_VERSION }));
    }

    if (url.pathname === "/debug/source-probe") {
      return json(await probeCandidateSources({ requestUrl: url.toString(), appVersion: APP_VERSION }));
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

    return new Response(renderAppHtml({ appVersion: APP_VERSION }), {
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
