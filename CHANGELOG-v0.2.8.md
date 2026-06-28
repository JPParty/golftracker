# GolfTracker v0.2.8 — KPMG Event-Aware Probe

## Purpose
Uses the `data-event-id` discovered on the KPMG leaderboard page to probe the scoring endpoint more accurately.

## Added
- New endpoint: `/debug/kpmg-event-probe`
- Reads the KPMG `<leaderboard-react>` tag and extracts:
  - `data-endpoint-url`
  - `data-event-id`
  - `data-refresh-interval`
  - `data-offline-mode`
- Tests the scoring endpoint with common event id query parameters.
- Tests event id header variants.
- Tests GraphQL GET variants with `variables` containing the event id.
- Tests path-style event id variants and a few KPMG API guesses.
- Ranks results by JSON usefulness, player-like objects, and leaderboard-like paths.

## Files changed
- `src/index.js`
- `src/sourceDiscovery.js`

## What to do after deploy
Open:

`https://golftracker.jacobwpool.workers.dev/debug/kpmg-event-probe`

Then copy/upload the JSON output.
