# Changelog

## v0.3.8
- Removed the unnecessary red/yellow status box
- Kept debug info collapsed
- Added 60-second leaderboard caching
- Added cleaner loading behavior
- Added top navigation buttons
- Added placeholder pages for previous and future tournaments
- Added labeling when upcoming tournament page is showing last year’s results

## v0.2.0

- Split the original single `src/index.js` file into multiple modules.
- Preserved the existing Cloudflare Worker deployment model.
- Added app version metadata.
- Added a basic developer/debug status panel in the UI.
- No intended functional change to leaderboard parsing yet.

## Next priorities

1. Verify split-file deployment works.
2. Verify debug panel works.
3. Fix full-field leaderboard loading.
