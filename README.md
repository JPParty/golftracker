# GolfTracker v1

A simple Cloudflare Worker app for a fast mobile LPGA leaderboard.

## Deploy command

Cloudflare should use:

```bash
npx wrangler deploy
```

## Project type

This is a single Cloudflare Worker. It serves both:

- `/` - the mobile web app
- `/api/leaderboard` - leaderboard JSON

