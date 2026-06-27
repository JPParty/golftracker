const leaderboardEl = document.getElementById("leaderboard");
const eventNameEl = document.getElementById("eventName");
const lastUpdatedEl = document.getElementById("lastUpdated");
const statusTextEl = document.getElementById("statusText");
const refreshButton = document.getElementById("refreshButton");

const CACHE_KEY = "golftracker:lastLeaderboard";
const REFRESH_MS = 60_000;
let refreshTimer = null;

function normalizeScoreValue(score) {
  const raw = String(score ?? "").trim();
  if (!raw || raw === "-") return "-";
  if (raw.toUpperCase() === "E" || raw === "0" || raw === "+0") return "E";
  return raw;
}

function scoreClass(score) {
  const normalized = normalizeScoreValue(score);
  if (normalized === "E" || normalized === "-") return "even";
  if (normalized.startsWith("+")) return "over";
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric < 0 ? "under" : "even";
}

function formatDateTime(value) {
  if (!value) return "Not updated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated yet";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function saveCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors.
  }
}

function loadCachedData() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function render(data, options = {}) {
  const players = Array.isArray(data?.players) ? data.players : [];
  eventNameEl.textContent = data?.eventName || "Current LPGA Tournament";

  const label = options.fromCache ? "Cached" : "Updated";
  lastUpdatedEl.textContent = `${label}: ${formatDateTime(data?.updatedAt)}`;

  if (!players.length) {
    leaderboardEl.innerHTML = `<div class="message">No leaderboard data available yet.</div>`;
    return;
  }

  leaderboardEl.innerHTML = players.map(player => {
    const score = normalizeScoreValue(player.total);
    const thru = player.thru || "-";
    const today = player.today ? `Today: ${player.today}` : "";

    return `
      <div class="player-row">
        <div class="pos">${player.position || "-"}</div>
        <div class="name">
          ${player.name || "Unknown Player"}
          <div class="subline">${today}</div>
        </div>
        <div class="thru">${thru}</div>
        <div class="score ${scoreClass(score)}">${score}</div>
      </div>
    `;
  }).join("");
}

async function fetchLeaderboard() {
  statusTextEl.textContent = "Refreshing…";
  refreshButton.disabled = true;

  try {
    const response = await fetch("/api/leaderboard", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    saveCachedData(data);
    render(data);
    statusTextEl.textContent = "Auto-refresh on";
  } catch (error) {
    const cached = loadCachedData();
    if (cached) {
      render(cached, { fromCache: true });
      statusTextEl.textContent = "Showing cached data";
    } else {
      leaderboardEl.innerHTML = `<div class="message error">Could not load leaderboard.</div>`;
      statusTextEl.textContent = "Refresh failed";
    }
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", fetchLeaderboard);

const cached = loadCachedData();
if (cached) render(cached, { fromCache: true });
fetchLeaderboard();
refreshTimer = setInterval(fetchLeaderboard, REFRESH_MS);
