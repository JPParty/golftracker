import { debugClientScript } from "./debug.js";

export function getClientScript({ appVersion }) {
  return `
const APP_VERSION = '${appVersion}';
const rows = document.getElementById('rows');
const eventName = document.getElementById('eventName');
const lastUpdated = document.getElementById('lastUpdated');
const refreshBtn = document.getElementById('refreshBtn');
const notice = document.getElementById('notice');

let loading = false;

function scoreClass(score) {
  const s = String(score || '').trim().toUpperCase();
  if (s === '-' || s === '') return 'even';
  if (s === 'E' || s === 'EVEN' || s === '0') return 'even';
  if (s.startsWith('+')) return 'over';
  if (/^-/.test(s)) return 'under';
  return 'even';
}

function formatTime(iso) {
  if (!iso) return 'No successful update yet';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function isUpcomingTournament(data) {
  const resolution = data && data.tournamentResolution ? data.tournamentResolution : {};
  const status = String(resolution.dateStatus || data.resolvedDateStatus || '').toLowerCase();
  return status === 'upcoming';
}

function getPriorResultsYear(data) {
  const sourceUpdatedYear = data && data.sourceUpdated ? new Date(data.sourceUpdated).getFullYear() : null;
  if (sourceUpdatedYear && !Number.isNaN(sourceUpdatedYear)) return sourceUpdatedYear;

  const resolution = data && data.tournamentResolution ? data.tournamentResolution : {};
  const dateText = String(resolution.dateText || data.resolvedEventDateText || '');
  const match = dateText.match(/\b(20\d{2})\b/);
  if (match) return Number(match[1]) - 1;

  return new Date().getFullYear() - 1;
}

function priorResultsLabel(data) {
  return getPriorResultsYear(data) + ' results';
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]);
  });
}

${debugClientScript}

function render(data) {
  updateDebugStatus(data);

  eventName.textContent = data.eventName || 'LPGA Leaderboard';
  const cacheText = data.cached ? ' • cached response' : '';
  const priorYearText = isUpcomingTournament(data) ? ' • showing ' + priorResultsLabel(data) : '';
  lastUpdated.textContent = 'Last successful update: ' + formatTime(data.updatedAt) + priorYearText + cacheText;

  if (data.error) {
    notice.style.display = 'block';
    notice.textContent = data.error || 'GolfTracker could not load the latest leaderboard. Try Refresh in a moment.';
  } else {
    notice.style.display = 'none';
  }

  const players = Array.isArray(data.players) ? data.players : [];
  if (!players.length) {
    rows.innerHTML = '<div class="empty">No leaderboard data is available yet. GolfTracker may be waiting on LPGA tournament data.</div>';
    return;
  }

  const showingPriorResults = isUpcomingTournament(data);
  const priorLabel = priorResultsLabel(data);

  rows.innerHTML = players.map(function(p) {
    const score = p.total || '-';
    const isPending = p.live === false || String(p.status || '').toLowerCase() === 'pending';
    const subText = isPending
      ? 'Roster-only from Entries' + (p.entryStatus ? ' • ' + p.entryStatus : '')
      : showingPriorResults
        ? priorLabel
        : 'Today: ' + (p.today || '-');
    const thruText = isPending ? 'Roster only' : (p.thru || '-');

    return '<div class="row ' + (isPending ? 'pending-row' : '') + '">' +
      '<div class="pos">' + escapeHtml(p.pos || '-') + '</div>' +
      '<div><div class="name">' + escapeHtml(p.name || 'Unknown') + '</div><div class="sub">' + escapeHtml(subText) + '</div></div>' +
      '<div class="thru">' + escapeHtml(thruText) + '</div>' +
      '<div class="score ' + scoreClass(score) + '">' + escapeHtml(score) + '</div>' +
    '</div>';
  }).join('');
}

async function loadLeaderboard() {
  if (loading) return;
  loading = true;
  refreshBtn.disabled = true;
  const originalButtonText = refreshBtn.textContent;
  refreshBtn.textContent = 'Refreshing…';

  try {
    const pageParams = new URLSearchParams(window.location.search);
    const tournamentParam = pageParams.get('tournament') || pageParams.get('slug');
    const apiParams = new URLSearchParams();
    if (tournamentParam) apiParams.set('tournament', tournamentParam);
    const apiUrl = apiParams.toString() ? '/api/leaderboard?' + apiParams.toString() : '/api/leaderboard';
    const response = await fetch(apiUrl);
    const data = await response.json();
    render(data);
  } catch (error) {
    notice.style.display = 'block';
    notice.textContent = 'Could not load leaderboard. Check your connection and try Refresh. Details: ' + error.message;
  } finally {
    loading = false;
    refreshBtn.disabled = false;
    refreshBtn.textContent = originalButtonText || 'Refresh';
  }
}

refreshBtn.addEventListener('click', loadLeaderboard);
loadLeaderboard();
setInterval(loadLeaderboard, 60000);
`;
}
