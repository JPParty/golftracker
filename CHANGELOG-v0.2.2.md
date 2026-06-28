# GolfTracker v0.2.2

## Changed

- ESPN fallback is now rejected when `sourceUpdated` is older than 30 minutes.
- ESPN fallback is also rejected when `sourceUpdated` is missing or cannot be parsed.
- This prevents the app from showing a stale full-field ESPN leaderboard over a current-but-partial LPGA leaderboard.

## Remaining open issue

- Need to find LPGA hidden/full-field data source so the app can display the full tournament field with current scores.
