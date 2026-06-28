# GolfTracker v0.3.0 — Auto Tournament Resolver + LPGA Source Stack

## Added
- Automatically resolves the current LPGA tournament from the LPGA tournaments index instead of hardcoding one tournament every week.
- Builds weekly LPGA source URLs from the resolved tournament slug:
  - leaderboard
  - entries
  - pairings
  - results
- Adds LPGA Entries parsing to create a full-field roster view when the LPGA live leaderboard HTML only exposes a visible subset.
- Merges live LPGA leaderboard rows with LPGA Entries rows.
- Marks roster-only rows as `Pending live score` so the app does not imply those players have live scoring data.
- Adds `/api/leaderboard?tournament=<slug>` override for manual testing without changing source files.
- Adds `/api/tournament` for resolver/debug metadata.

## Changed
- Version updated to `0.3.0`.
- Source strategy changed from one hardcoded KPMG leaderboard URL to a generic LPGA source stack.
- ESPN remains a fallback only when its source timestamp passes the 30-minute freshness rule.
- Debug panel now shows tournament slug, resolver method, live scored player count, and roster player count.

## Notes
- This version is designed to test the weekly no-code-change workflow.
- The initial goal is sustainable weekly tournament detection and full-field roster display, not perfect full-field live scoring for every player.
