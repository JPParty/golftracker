import { getLeaderboard } from "./leaderboardService.js";
import { renderAppHtml } from "./appHtml.js";

export const APP_VERSION = "0.2.1";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/leaderboard") {
      return json(await getLeaderboard({ appVersion: APP_VERSION }));
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
