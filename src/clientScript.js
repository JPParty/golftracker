import { debugClientScript } from "./debug.js";

export function getClientScript({ appVersion }) {
  return `
const APP_VERSION = '${appVersion}';
const rows = document.getElementById('rows');
const eventName = document.getElementById('eventName');
const lastUpdated = document.getElementById('lastUpdated');
const refreshBtn = document.getElementById('refreshBtn');
const statusEl = document.getElementById('status');
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

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function(c) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]);
  });
}

${debugClientScript}

function render(data) {
  updateDebugStatus(data);

  eventName.textContent = data.eventName || 'LPGA Leaderboard';
  lastUpdated.textContent = 'Last successful update: ' + formatTime(data.updatedAt);

  if (data.warning || data.error) {
    notice.style.display = 'block';
    notice.textContent = data.warning || data.error;
  } else {
    notice.style.display = 'none';
  }

  const players = Array.isArray(data.players) ? data.players : [];
  if (!players.length) {
    rows.innerHTML = '<div class="empty">No leaderboard data available yet.</div>';
    return;
  }

  rows.innerHTML = players.map(function(p) {
    const score = p.total || '-';
    const isPending = p.live === false || String(p.status || '').toLowerCase() === 'pending';
    const subText = isPending
      ? 'Roster-only from Entries' + (p.entryStatus ? ' • ' + p.entryStatus : '')
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
  statusEl.textContent = 'Refreshing…';

  try {
    const pageParams = new URLSearchParams(window.location.search);
    const tournamentParam = pageParams.get('tournament') || pageParams.get('slug');
    const apiParams = new URLSearchParams({ ts: String(Date.now()) });
    if (tournamentParam) apiParams.set('tournament', tournamentParam);
    const response = await fetch('/api/leaderboard?' + apiParams.toString());
    const data = await response.json();
    render(data);
    statusEl.textContent = data.cached ? 'Showing cached data' : 'Auto-refresh: 60 sec';
  } catch (error) {
    notice.style.display = 'block';
    notice.textContent = 'Could not load leaderboard: ' + error.message;
    statusEl.textContent = 'Refresh failed';
  } finally {
    loading = false;
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener('click', loadLeaderboard);
loadLeaderboard();
setInterval(loadLeaderboard, 60000);
`;
}
