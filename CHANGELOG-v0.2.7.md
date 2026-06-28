# GolfTracker v0.2.7 — KPMG GraphQL GET Probe

## Purpose
Focuses on the KPMG scoring endpoint discovered in v0.2.5 and confirmed in v0.2.6.

## Added
- New endpoint: `/debug/kpmg-graphql-probe`
- Extracts the full `<leaderboard-react>` tag and its data attributes from the KPMG leaderboard page.
- Probes the KPMG GraphQL scoring endpoint using GET query parameters.
- Checks whether GraphQL schema introspection is available.
- Probes Brightspot leaderboard React asset candidates.
- Reports root GraphQL fields and score-related field names when available.

## Files changed
- `src/index.js`
- `src/sourceDiscovery.js`

## What to do after deploy
Open:

`https://golftracker.jacobwpool.workers.dev/debug/kpmg-graphql-probe`

Then copy/upload the JSON output so we can determine the exact query needed for the full-field live scoring feed.
