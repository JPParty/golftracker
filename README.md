# GolfTracker

A fast, mobile-first LPGA leaderboard app designed for Android Chrome and Cloudflare Pages.

## Version 1 Features

- Current LPGA leaderboard display
- Mobile-first dark interface
- Manual refresh
- Auto-refresh every 60 seconds
- Last successful update timestamp
- Cached data fallback in the browser
- Cloudflare Pages Function backend proxy

## Cloudflare Pages Setup

Build command: leave blank or use `echo "No build needed"`

Build output directory: `public`

Functions directory: Cloudflare auto-detects `/functions`

## Notes

The app uses `/api/leaderboard` to fetch leaderboard data through a Cloudflare Pages Function. If the LPGA site changes its page structure, the parser may need to be adjusted.
