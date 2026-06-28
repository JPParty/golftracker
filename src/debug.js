export const debugClientScript = `
function updateDebugStatus(data) {
  const debug = document.getElementById('debug-status');
  if (!debug) return;

  const players = Array.isArray(data.players) ? data.players : [];
  const cacheText = data.cached
    ? 'Cached' + (typeof data.cacheAgeSeconds === 'number' ? ' (' + data.cacheAgeSeconds + ' sec old)' : '')
    : 'Live';

  debug.innerHTML =
    '<b>Version:</b> ' + escapeHtml(data.appVersion || APP_VERSION || 'Unknown') + '<br>' +
    '<b>Source:</b> ' + escapeHtml(data.source || 'Unknown') + '<br>' +
    '<b>Source URL:</b> ' + escapeHtml(data.sourceUrl || 'Unknown') + '<br>' +
    '<b>Tournament:</b> ' + escapeHtml(data.eventName || 'Unknown') + '<br>' +
    '<b>Source Updated:</b> ' + escapeHtml(data.sourceUpdated || 'Unknown') + '<br>' +
    '<b>Worker Retrieved:</b> ' + escapeHtml(data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Unknown') + '<br>' +
    '<b>Cache:</b> ' + escapeHtml(cacheText) + '<br>' +
    '<b>Players Loaded:</b> ' + players.length + '<br>' +
    '<b>Parser:</b> ' + escapeHtml(data.parser || 'Unknown') +
    (data.warning || data.error ? '<br><b>Message:</b> ' + escapeHtml(data.warning || data.error) : '');
}
`;
