# GolfTracker

A lightweight Cloudflare Worker app for a fast, mobile-first LPGA leaderboard.

## Current release

v0.2.0

## Deployment

Cloudflare deploys this project from GitHub using:

```bash
npx wrangler deploy
```

The Worker entry point is:

```text
src/index.js
```

## File layout

```text
src/index.js              Worker entry point
src/appHtml.js            HTML shell
src/styles.js             CSS styles
src/clientScript.js       Browser/client JavaScript
src/leaderboardService.js Fetch/cache leaderboard service
src/lpgaParser.js         LPGA HTML parser
src/debug.js              Debug panel client code
src/utils.js              Shared parser utilities
```
