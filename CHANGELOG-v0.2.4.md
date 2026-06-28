# GolfTracker v0.2.4

## Added
- Added `/debug/lpga-source` diagnostic endpoint.
- Endpoint checks LPGA leaderboard, entries, and pairings pages.
- Endpoint reports script URLs, link URLs, API-looking URLs, inline hints, page-data markers, parsed player count, and source update text.

## Purpose
- Help identify whether LPGA exposes a hidden API/data feed for full-field live leaderboard data.

## Notes
- This release does not change the visible app UI.
- This release does not fix full-field leaderboard display yet. It gives us better diagnostics for finding the correct source.
