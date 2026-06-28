# GolfTracker v0.2.1

## Changed
- Improved LPGA row parsing to prevent movement numbers from being treated as player positions.
- Added server-side deduplication by player name.
- Added server-side leaderboard sorting: active players first, then lowest total score, then position.
- Added cut/withdrawn/disqualified status normalization so cut players sort below active players.
- Added ESPN JSON fallback attempt when LPGA HTML only exposes a partial leaderboard.
- Reduced server cache duration to 60 seconds while debugging live data.

## Notes
- If the app still shows a partial field, check the debug panel. It should say whether the app is using LPGA, LPGA partial, or ESPN fallback.
