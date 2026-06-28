# GolfTracker v0.2.5

## Purpose
Deepen LPGA source discovery to search JavaScript chunks and the KPMG tournament site for hidden leaderboard/API/data-feed clues.

## Changed Files
- `src/index.js`
- `src/sourceDiscovery.js`

## Changes
- Updates app version to `0.2.5`.
- Keeps `/debug/lpga-source` endpoint.
- Adds KPMG tournament site and generic LPGA leaderboard to discovery targets.
- Fetches and inspects LPGA Next.js script chunks.
- Searches JavaScript for:
  - API/fetch-style calls
  - GraphQL/Sitecore/Edge clues
  - leaderboard/scoring/tournament component references
  - tournament ID/code/status references
  - candidate API/data URLs
- Adds stronger signal summary to make the debug output easier to interpret.

## Notes
This release is diagnostic only. It does not change the user-facing leaderboard behavior.
