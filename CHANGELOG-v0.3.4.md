# GolfTracker v0.3.4 — Formatted Hydration Probe

Debug-only build for parsing LPGA's embedded `formattedLeaderboard.leaderboardRows` data.

## Added
- Improves `src/lpgaHydrationParser.js` so it can parse `formattedLeaderboard.leaderboardRows`, not only `currentLeaderboard.result.entries`.
- Adds `parsedFormattedRowsCount`, `formattedRowsCount`, `parseSource`, and `formattedRowSamples` to `/debug/lpga-hydration-probe`.

## Purpose
v0.3.3 proved LPGA's hidden hydration data contains a `formattedLeaderboard` object with many rows, but the initial parser only tried to normalize `currentLeaderboard.result.entries`. This build checks whether the formatted rows can become the main full-field live scoring source.

## Expected test URL
`/debug/lpga-hydration-probe?tournament=kpmgwomenspgachampionship`

## What to check
- `summary.visiblePlayers`
- `summary.hydratedPlayersParsed`
- `hydrationParser.formattedRowsCount`
- `hydrationParser.parsedFormattedRowsCount`
- `hydrationParser.parseSource`
- `hydrationParser.formattedRowSamples`
