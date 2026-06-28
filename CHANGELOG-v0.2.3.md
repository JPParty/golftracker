# GolfTracker v0.2.3

## Fixed
- Restored LPGA THRU values when the THRU value is a hole number such as `8`, `10`, or `16*`.
- Updated LPGA parser from `v1.2` to `v1.3`.
- Prevented numeric THRU values from being mistaken for the next leaderboard position.

## Notes
- This release does not solve the full-field issue yet. LPGA's visible HTML still exposes only a partial leaderboard.
- ESPN fallback remains rejected if stale or unavailable.
