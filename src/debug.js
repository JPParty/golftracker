export const debugClientScript = `
function updateDebugStatus(data) {
  const debug = document.getElementById('debug-status');
  if (!debug) return;

  const players = Array.isArray(data.players) ? data.players : [];
  const cacheText = data.cached
    ? 'Cached' + (typeof data.cacheAgeSeconds === 'number' ? ' (' + data.cacheAgeSeconds + ' sec old)' : '')
    : 'Live';

  const resolution = data.tournamentResolution || {};
  const extraSources = Array.isArray(data.additionalSourceUrls) && data.additionalSourceUrls.length
    ? '<br><b>Additional Sources:</b> ' + escapeHtml(data.additionalSourceUrls.join(', '))
    : '';

  debug.innerHTML =
    '<b>Version:</b> ' + escapeHtml(data.appVersion || APP_VERSION || 'Unknown') + '<br>' +
    '<b>Source:</b> ' + escapeHtml(data.source || 'Unknown') + '<br>' +
    '<b>Source URL:</b> ' + escapeHtml(data.sourceUrl || 'Unknown') + extraSources + '<br>' +
    '<b>Tournament:</b> ' + escapeHtml(data.eventName || 'Unknown') + '<br>' +
    '<b>Tournament Slug:</b> ' + escapeHtml(data.tournamentSlug || 'Unknown') + '<br>' +
    '<b>Resolver:</b> ' + escapeHtml(resolution.method || 'Unknown') + '<br>' +
    (resolution.dateText || data.resolvedEventDateText ? '<b>Resolved Dates:</b> ' + escapeHtml(resolution.dateText || data.resolvedEventDateText) + '<br>' : '') +
    '<b>Source Updated:</b> ' + escapeHtml(data.sourceUpdated || 'Unknown') + '<br>' +
    '<b>Worker Retrieved:</b> ' + escapeHtml(data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown') + '<br>' +
    '<b>Cache:</b> ' + escapeHtml(cacheText) + '<br>' +
    '<b>Players Loaded:</b> ' + players.length + '<br>' +
    '<b>Live Scored Players:</b> ' + escapeHtml(data.livePlayersLoaded ?? 'Unknown') + '<br>' +
    '<b>Roster Players:</b> ' + escapeHtml(data.rosterPlayersLoaded ?? 'Unknown') + '<br>' +
    '<b>Parser:</b> ' + escapeHtml(data.parser || 'Unknown') +
    (data.warning || data.error ? '<br><b>Message:</b> ' + escapeHtml(data.warning || data.error) : '');
}
`;
