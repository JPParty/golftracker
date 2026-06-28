# GolfTracker v0.3.2 — LPGA Population Debug

## Added
- Added `/debug/lpga-population-probe`.
- The debug endpoint resolves the current LPGA tournament, then fetches the LPGA leaderboard HTML multiple times with configurable delays.
- Each snapshot reports byte length, HTML hash, source updated text, parsed player count, parsed players, and key signals such as `leaderboardRows`, `currentLeaderboard`, `self.__next_f`, `THRU`, and `POS`.

## Purpose
- Determine whether waiting/refetching the LPGA page from the Worker causes more leaderboard rows to appear in the server HTML.
- If the player count grows, we can add a production retry/enrichment loop.
- If the player count does not grow but the browser page shows more rows after waiting, the missing data is probably client-side JavaScript/XHR that the Worker fetch cannot execute.

## No production behavior change
- This build intentionally does not change the main leaderboard merge requirement yet.
- It is a diagnostic build before deciding whether to add progressive LPGA live enrichment.
