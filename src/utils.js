export function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");
}

export function decodeEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function cleanName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\b(USA|KOR|JPN|AUS|ENG|SWE|THA|CAN|CHN|FRA|GER|ESP|MEX|NZL|RSA|NED|SCO|IRL|ITA|NOR|DEN|FIN|TPE|PHI|MAS|SIN|COL|BRA|ARG|IND)\b/g, "")
    .trim();
}

export function normalizePosition(value) {
  const cleaned = String(value || "").trim().replace(/^pos\.?\s*/i, "");
  return /^(T)?\d{1,3}$/i.test(cleaned) ? cleaned.toUpperCase() : null;
}

export function positionNumber(pos) {
  const normalized = normalizePosition(pos);
  if (!normalized) return Number.POSITIVE_INFINITY;
  return Number(normalized.replace(/^T/i, ""));
}

export function isGolfScore(value) {
  const s = String(value || "").trim().toUpperCase();
  return /^(E|EVEN|[+-]?\d{1,2})$/.test(s);
}

export function normalizeScore(value) {
  const s = String(value || "").trim().toUpperCase();
  if (!s || s === "-") return "-";
  if (s === "EVEN") return "E";
  if (s === "0") return "E";
  if (s === "E") return "E";
  if (/^-\d{1,2}$/.test(s)) return s;
  if (/^\+\d{1,2}$/.test(s)) return s;
  if (/^\d{1,2}$/.test(s)) return `+${s}`;
  return s;
}

export function scoreToNumber(score) {
  const s = normalizeScore(score);
  if (s === "E") return 0;
  if (/^[+-]\d+$/.test(s)) return Number(s);
  return Number.POSITIVE_INFINITY;
}

export function isThruValue(value) {
  const s = String(value || "").trim().toUpperCase();

  // Tee time, example: 9:25 AM
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/.test(s)) return true;

  // Finished round
  if (/^(F|FINAL)$/.test(s)) return true;

  // Current hole only, 1 through 18. Allow a trailing asterisk.
  if (/^\d{1,2}\*?$/.test(s)) {
    const n = Number(s.replace("*", ""));
    return n >= 1 && n <= 18;
  }

  return false;
}

export function normalizeThru(value) {
  const s = String(value || "").trim().toUpperCase();

  if (s === "PENDING") return "Pending";
  if (s === "FINAL") return "F";
  if (s === "F") return "F";

  // Keep tee times readable for now. Local conversion is a later priority.
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/.test(s)) return s;

  // Only show valid hole numbers, preserving an LPGA trailing asterisk if present.
  if (/^\d{1,2}\*?$/.test(s)) {
    const n = Number(s.replace("*", ""));
    if (n >= 1 && n <= 18) return s;
  }

  return "-";
}

export function normalizeStatus(value) {
  const s = String(value || "").trim().toUpperCase();
  if (!s) return "active";
  if (/^(PENDING|ROSTER|ENTRY|ENTERED|NO LIVE DATA)$/.test(s)) return "pending";
  if (/^(CUT|MC|MISSED CUT|MDF)$/.test(s)) return "cut";
  if (/^(WD|WITHDRAWN)$/.test(s)) return "withdrawn";
  if (/^(DQ|DISQUALIFIED)$/.test(s)) return "disqualified";
  return "active";
}

export function statusSortRank(player) {
  const status = normalizeStatus(player?.status);
  if (status === "active") return 0;
  if (status === "pending") return 1;
  if (status === "cut") return 2;
  return 3;
}

export function playerQualityScore(player) {
  let score = 0;
  if (player?.live) score += 20;
  if (player?.pos && player.pos !== "-") score += 2;
  if (player?.name && player.name !== "Unknown") score += 4;
  if (player?.total && player.total !== "-") score += 4;
  if (player?.today && player.today !== "-") score += 2;
  if (player?.thru && player.thru !== "-") score += 2;
  if (normalizeStatus(player?.status) === "active") score += 1;
  return score;
}

export function dedupePlayers(players) {
  const map = new Map();

  for (const player of players || []) {
    const key = playerNameKey(player?.name);
    if (!key) continue;

    const existing = map.get(key);
    if (!existing || playerQualityScore(player) > playerQualityScore(existing)) {
      map.set(key, player);
    }
  }

  return Array.from(map.values());
}

export function mergePlayers(primaryPlayers, secondaryPlayers) {
  const map = new Map();

  for (const player of secondaryPlayers || []) {
    const key = playerNameKey(player?.name);
    if (key) map.set(key, player);
  }

  for (const player of primaryPlayers || []) {
    const key = playerNameKey(player?.name);
    if (!key) continue;

    const existing = map.get(key);
    map.set(key, {
      ...(existing || {}),
      ...player,
      live: true,
      dataSource: player.dataSource || "LPGA Leaderboard",
      entryStatus: existing?.entryStatus || player.entryStatus || null,
      entryNumber: existing?.entryNumber || player.entryNumber || null
    });
  }

  return Array.from(map.values());
}

export function sortLeaderboard(players) {
  return [...(players || [])].sort((a, b) => {
    const statusDiff = statusSortRank(a) - statusSortRank(b);
    if (statusDiff) return statusDiff;

    const scoreDiff = scoreToNumber(a.total) - scoreToNumber(b.total);
    if (scoreDiff) return scoreDiff;

    const posDiff = positionNumber(a.pos) - positionNumber(b.pos);
    if (posDiff) return posDiff;

    const entryDiff = (a.entryNumber || Number.POSITIVE_INFINITY) - (b.entryNumber || Number.POSITIVE_INFINITY);
    if (entryDiff) return entryDiff;

    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

export function makePlayerId(player) {
  return `${player?.pos || ""}-${player?.name || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function playerNameKey(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}
