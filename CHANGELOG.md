# GolfTracker Changelog

This file tracks the major GolfTracker checkpoints and user-facing changes. Smaller debug-only builds and temporary investigation files are intentionally omitted.

## v0.3.10 — Feedback Button

- Added a **Submit Feedback** button opposite the Refresh button on the main tournament page.
- Connected feedback submission to the GolfTracker Google Form.
- Added a `/feedback` page as a backup/info page for feedback submission.
- Feedback form opens in a new tab.

## v0.3.9 — Navigation Polish

- Renamed **Previous Results** to **Previous Tournaments**.
- Improved the placeholder page for `/results`.
- Improved the placeholder page for `/schedule`.
- Added clearer page status text for future archive/schedule work.
- Improved mobile spacing for top navigation buttons.
- Improved empty/error wording so the app feels less broken while data is loading or unavailable.

## v0.3.8 — Upcoming Tournament Result Labeling

- Added clearer labeling when the main page is showing **last year's results** for an upcoming tournament.
- Player rows now show the previous year, such as **2025 results**, instead of implying the data is from the current live round.
- Header status also indicates when previous-year results are being shown.

## v0.3.7 — Mobile and Performance Cleanup

- Removed the unnecessary normal status box from the main page.
- Kept technical debug information collapsed behind the Debug status dropdown.
- Added short leaderboard response caching to improve reload speed.
- Added cleaner loading and status messages.
- Added top-level navigation buttons for:
  - **Previous Tournaments** / archive area
  - **Future Tournaments** / schedule area
- Added starter routes/pages for `/results` and `/schedule`.

## v0.3.6 — Collapsed Debug Panel

- Changed the debug/status panel to be collapsed by default.
- Kept debug information available when needed without taking up normal screen space.
- No leaderboard source or parser logic changes in this version.

## v0.3.5 — LPGA Hydration Leaderboard Production

- Promoted the LPGA hidden hydration leaderboard parser into production use.
- Expanded leaderboard coverage from the limited visible LPGA page rows to the full hidden leaderboard data when available.
- Added filtering to remove non-player junk rows such as ads, footer links, privacy links, partner links, ticket links, and navigation text.
- Improved player deduplication and leaderboard cleanup.

## v0.3.4 — Hydration Parser Validation

- Confirmed the LPGA page contained hidden leaderboard data in `formattedLeaderboard.leaderboardRows`.
- Parsed roughly a full-field leaderboard from the hidden hydration data.
- Confirmed this approach was better than relying only on the visible leaderboard rows.

## v0.3.3 — Hydration Probe

- Added debug probing for LPGA hydration data.
- Confirmed the page included markers such as current leaderboard data, formatted leaderboard data, tournament ID, tournament code, current round, and tournament status.
- Identified that the first extraction attempt needed a better parser before production use.

## v0.3.2 — LPGA Population Probe

- Added debug tools to check whether the LPGA page populated more rows after delayed refetches.
- Confirmed the server-rendered visible page stayed limited and did not expand after repeated Worker refetches.
- Determined that fuller leaderboard data was likely coming from client-side JavaScript or hidden hydration data.

## v0.3.1 — Tournament Resolver Fix

- Improved date-aware tournament selection.
- Fixed the resolver so the app selected the correct active/recent LPGA tournament instead of jumping too far ahead.
- Improved roster-only labeling from entries data.

## v0.3.0 — Auto Source Stack

- Added an automatic LPGA tournament resolver.
- Began moving away from hard-coded tournament-specific logic.
- Added a more general LPGA source stack using tournament leaderboard, entries, pairings, and results pages.

## v0.2.3 — THRU Parsing Fix

- Fixed THRU parsing issues in the leaderboard display.
- Confirmed the app could show current LPGA leaderboard rows from the LPGA source.
- Identified that the visible LPGA leaderboard only exposed a limited number of rows.

## v0.2.2 — ESPN Stale Data Protection

- Added protections to avoid using stale ESPN leaderboard data.
- Rejected ESPN fallback data when `sourceUpdated` was missing, invalid, or older than the freshness threshold.
- Established ESPN as a fallback source only, not the preferred source.

## v0.2.1 — LPGA-First Source Strategy

- Shifted the app toward using LPGA as the preferred leaderboard source.
- Kept ESPN as a fallback when LPGA data was incomplete or unavailable.
- Began separating source quality and freshness concerns.

## Current Backlog Highlights

These are planned or potential future features, not completed changes.

- Previous Tournaments page with completed tournament standings.
- Future Tournaments page with date, location, and signature event status.
- Live tournament validation during the next active LPGA event.
- Player current-season finishes page.
- Favorites page.
- Player hole-by-hole scorecard.
- Player media/news page from favorites.
- Better source freshness and update status indicators.
- Fix potential dropped amateur players in previous-year results, such as Lottie Woad at the 2025 Amundi Evian Championship.
- Clearly label previous-year results when showing upcoming tournament data.
