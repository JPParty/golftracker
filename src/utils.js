export function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");
}

export function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function cleanName(value) {
  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\b(USA|KOR|JPN|AUS|ENG|SWE|THA|CAN|CHN|FRA|GER|ESP|MEX|NZL|RSA)\b/g, "")
    .trim();
}

export function normalizePosition(value) {
  const cleaned = String(value).trim().replace(/^pos\.?\s*/i, "");
  return /^(T)?\d{1,3}$/i.test(cleaned) ? cleaned.toUpperCase() : null;
}

export function isGolfScore(value) {
  const s = String(value).trim().toUpperCase();
  return /^(E|EVEN|[+-]?\d{1,2})$/.test(s);
}

export function isThruValue(value) {
  const s = String(value).trim().toUpperCase();

  // Tee time, example: 9:25 AM
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/.test(s)) return true;

  // Finished round
  if (/^(F|FINAL)$/.test(s)) return true;

  // Current hole only, 1 through 18
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= 18;
  }

  return false;
}

export function normalizeThru(value) {
  const s = String(value).trim().toUpperCase();

  if (s === "FINAL") return "F";
  if (s === "F") return "F";

  // Keep tee times readable for now. Local conversion is a later priority.
  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/.test(s)) return s;

  // Only show valid hole numbers
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    if (n >= 1 && n <= 18) return String(n);
  }

  return "-";
}
