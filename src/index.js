import { getLeaderboard } from "./leaderboardService.js";
import { renderAppHtml, renderResultsHtml, renderScheduleHtml } from "./appHtml.js";

export const APP_VERSION = "0.3.7";
const LEADERBOARD_CACHE_SECONDS = 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/leaderboard") {
      return handleLeaderboardRequest(request, url, ctx);
    }

    if (url.pathname === "/api/tournament") {
      return json(await getLeaderboard({
        appVersion: APP_VERSION,
        tournamentOverride: url.searchParams.get("tournament") || url.searchParams.get("slug") || null,
        metadataOnly: true
      }));
    }

    if (url.pathname === "/results") {
      return html(renderResultsHtml({ appVersion: APP_VERSION }));
    }

    if (url.pathname === "/schedule") {
      return html(renderScheduleHtml({ appVersion: APP_VERSION }));
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

    return html(renderAppHtml({ appVersion: APP_VERSION }));
  }
};

async function handleLeaderboardRequest(request, url, ctx) {
  const tournamentOverride = url.searchParams.get("tournament") || url.searchParams.get("slug") || null;
  const cache = caches.default;
  const cacheUrl = new URL(url.toString());
  cacheUrl.searchParams.delete("ts");
  cacheUrl.searchParams.delete("refresh");
  const cacheKey = new Request(cacheUrl.toString(), { method: "GET" });

  if (request.method === "GET") {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const cachedData = await cachedResponse.json();
      return json({
        ...cachedData,
        cached: true,
        cacheSeconds: LEADERBOARD_CACHE_SECONDS
      }, 200, {
        "x-golftracker-cache": "hit"
      });
    }
  }

  const data = await getLeaderboard({
    appVersion: APP_VERSION,
    tournamentOverride
  });

  const response = json({
    ...data,
    cached: false,
    cacheSeconds: LEADERBOARD_CACHE_SECONDS
  }, 200, {
    "cache-control": `public, max-age=${LEADERBOARD_CACHE_SECONDS}`,
    "x-golftracker-cache": "miss"
  });

  if (request.method === "GET" && !data.error) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders
    }
  });
}
