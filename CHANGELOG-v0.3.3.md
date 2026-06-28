# GolfTracker v0.3.3 — LPGA Hydration Probe

Debug-only build for investigating LPGA's hidden Next.js hydration data.

## Added
- `/debug/lpga-hydration-probe`
- `src/lpgaHydrationParser.js`
- `src/lpgaHydrationProbe.js`

## Purpose
v0.3.2 proved delayed Worker refetches return the same HTML and visible row count. However, the HTML contains a `currentLeaderboard` signal inside Next.js flight data. This build extracts that hidden object and reports whether it contains more usable live rows than the visible leaderboard parser.

## Expected test URL
`/debug/lpga-hydration-probe?tournament=kpmgwomenspgachampionship`

## What to check
- `summary.visiblePlayers`
- `summary.hydratedEntries`
- `summary.hydratedPlayersParsed`
- `summary.shouldPromoteHydrationParser`
- `hydrationParser.rawEntrySamples`
