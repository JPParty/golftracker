# GolfTracker v0.3.1 — Resolver Fix + Roster-Only Wording

## Fixed
- Corrects the auto tournament resolver so it prioritizes the LPGA tournament whose date range includes today, instead of selecting a future event from the LPGA tournament index.
- Adds date-aware resolver debug fields so we can see which candidate events were tested and why one was selected.
- Improves LPGA event-name parsing so the app title/debug panel uses the actual tournament name instead of `LPGA Professionals`.
- Clarifies roster-only rows. They now say `Roster-only from Entries` instead of `Pending live score`, because the LPGA Entries page does not update those rows into live scoring.
- Carries `?tournament=` or `?slug=` from the page URL into the client API request for easier manual testing without source-code changes.

## Notes
- This does not claim full-field live scoring. It fixes the weekly tournament selection and makes the roster-only limitation clearer.
- Full-field live scoring still requires a generic live scoring feed that exposes every player, not just the LPGA visible leaderboard rows.
