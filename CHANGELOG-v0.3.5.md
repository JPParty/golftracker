# GolfTracker v0.3.5 — LPGA Hydration Leaderboard Promotion

## Changed

- Promoted the LPGA Next.js hydration parser into the production leaderboard flow.
- Uses `formattedLeaderboard.leaderboardRows` when it exposes more scoring rows than the visible HTML leaderboard.
- Keeps LPGA Entries as a roster backup, not the primary scoring source when hydration data is available.

## Fixed

- Added stricter player filtering so advertisement, footer, privacy, partner, ticket, and link text is not treated as roster/player data.
- Tightened LPGA Entries parsing so numbered ad/link blocks are filtered instead of promoted into player rows.
- Added debug counts for visible HTML players, hydration players, hydration rows seen, and filtered entry rows.

## Expected result

- For KPMG Women's PGA Championship, the app should use the hidden LPGA hydration leaderboard and show roughly the full scored field instead of the visible top-10 HTML subset.
- Roster-only rows should be reduced or eliminated when hydration scoring is available.
