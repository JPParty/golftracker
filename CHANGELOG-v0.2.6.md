# GolfTracker v0.2.6 — Candidate Source Probe

## Purpose
Adds a diagnostic endpoint to test the most promising LPGA/KPMG hidden-source candidates discovered in v0.2.5.

## Added
- New endpoint: `/debug/source-probe`
- Probes KPMG scoring GraphQL endpoint discovered on the KPMG leaderboard page.
- Probes KPMG leaderboard-react, RSS, and players pages.
- Probes LPGA live scoring endpoints with and without the public LPGA API headers discovered in the LPGA JavaScript.
- Probes LPGA page/json candidate endpoint.
- Ranks responses by usefulness: JSON, player-like objects, leaderboard/score/thru/position signals, and known player names.

## Files changed
- `src/index.js`
- `src/sourceDiscovery.js`

## What to do after deploy
Open:

`https://golftracker.jacobwpool.workers.dev/debug/source-probe`

Then copy/upload the output so we can identify whether any candidate endpoint returns full-field live scoring.
