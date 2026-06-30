export const styles = `
:root {
  color-scheme: dark;
  --bg: #020617;
  --card: #0f172a;
  --card2: #111827;
  --line: #1e293b;
  --text: #f8fafc;
  --muted: #94a3b8;
  --green: #34d399;
  --red: #fb7185;
  --blue: #60a5fa;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
}
.app { max-width: 760px; margin: 0 auto; padding: 16px; }
.header {
  background: linear-gradient(180deg, #0f172a, #020617);
  border: 1px solid var(--line);
  border-radius: 20px;
  padding: 18px;
  margin-bottom: 12px;
}
.page-header { margin-bottom: 14px; }
.top-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}
.top-nav.single { justify-content: flex-start; }
.nav-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 10px 12px;
  border-radius: 14px;
  background: #1d4ed8;
  color: #ffffff;
  text-decoration: none;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.1;
  text-align: center;
  box-shadow: 0 8px 18px rgba(37, 99, 235, .18);
}
.nav-button.secondary { background: #334155; }
.nav-button:active { transform: scale(.98); }
.eyebrow { color: var(--green); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
h1 { margin: 8px 0 6px; font-size: 22px; line-height: 1.15; }
h2 { margin: 0 0 8px; font-size: 18px; }
p { margin: 0; color: var(--muted); line-height: 1.5; }
.meta { color: var(--muted); font-size: 13px; line-height: 1.4; }
.page-status {
  display: inline-flex;
  align-items: center;
  margin-top: 12px;
  padding: 7px 10px;
  border-radius: 999px;
  background: rgba(52, 211, 153, .10);
  color: var(--green);
  border: 1px solid rgba(52, 211, 153, .24);
  font-size: 12px;
  font-weight: 900;
}
.debug-details {
  margin-top: 10px;
  border-radius: 12px;
  background: #111827;
  border: 1px solid var(--line);
  overflow: hidden;
}
.debug-details summary {
  list-style: none;
  cursor: pointer;
  color: #d1d5db;
  font-size: 12px;
  font-weight: 800;
  padding: 10px;
  user-select: none;
}
.debug-details summary::-webkit-details-marker { display: none; }
.debug-details summary::before {
  content: '▸';
  display: inline-block;
  margin-right: 7px;
  color: var(--green);
  transition: transform .15s ease;
}
.debug-details[open] summary::before { transform: rotate(90deg); }
.debug-panel {
  margin-top: 0;
  padding: 10px;
  border-top: 1px solid var(--line);
  color: #d1d5db;
  font-size: 12px;
  line-height: 1.5;
}
.debug-panel b { color: #f8fafc; }
.actions { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 14px; }
button, .button-link {
  appearance: none;
  border: 0;
  border-radius: 14px;
  background: #2563eb;
  color: white;
  font-weight: 800;
  padding: 12px 14px;
  min-height: 44px;
  cursor: pointer;
  flex: 0 0 auto;
  text-decoration: none;
  font-size: 13px;
  line-height: 1.1;
}
.button-link { display: inline-flex; align-items: center; justify-content: center; }
.feedback-button { background: #047857; }
.button-link.large { width: 100%; max-width: 280px; }
button:active, .button-link:active { transform: scale(.98); }
button:disabled { opacity: .65; cursor: wait; }
.feedback-actions { margin-top: 18px; }
.notice {
  display: none;
  border: 1px solid #7f1d1d;
  background: #1f0f12;
  color: #fecdd3;
  border-radius: 14px;
  padding: 10px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}
.leaderboard {
  border: 1px solid var(--line);
  background: var(--card);
  border-radius: 20px;
  overflow: hidden;
}
.row, .head {
  display: grid;
  grid-template-columns: 48px 1fr 54px 68px;
  gap: 8px;
  align-items: center;
  min-height: 58px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
}
.head {
  min-height: 40px;
  color: var(--muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .08em;
  font-weight: 800;
  background: #020617;
}
.row:last-child { border-bottom: 0; }
.pos { color: var(--muted); font-weight: 900; text-align: center; }
.name { font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sub { color: var(--muted); font-size: 12px; margin-top: 3px; }
.thru { text-align: center; color: var(--blue); font-weight: 800; }
.score { text-align: right; font-size: 20px; font-weight: 950; }
.under { color: var(--green); }
.over { color: var(--red); }
.even { color: var(--muted); }
.empty { color: var(--muted); text-align: center; padding: 32px 20px; line-height: 1.5; }
.placeholder-card {
  border: 1px solid var(--line);
  background: var(--card);
  border-radius: 20px;
  padding: 18px;
}
.sample-tournament,
.schedule-card {
  margin-top: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  overflow: hidden;
  background: #020617;
}
.sample-tournament summary {
  list-style: none;
  cursor: pointer;
  padding: 13px 12px;
  font-weight: 900;
  display: flex;
  align-items: center;
  gap: 10px;
}
.sample-tournament summary::-webkit-details-marker { display: none; }
.sample-tournament summary::before {
  content: '▾';
  color: var(--green);
  font-size: 13px;
}
.sample-tournament summary small {
  display: block;
  margin-top: 3px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}
.sample-standings {
  border-top: 1px solid var(--line);
}
.sample-row,
.schedule-details > div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding: 11px 12px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
}
.sample-row:last-child,
.schedule-details > div:last-child { border-bottom: 0; }
.sample-row strong,
.schedule-details strong { color: var(--text); }
.schedule-card { padding: 0; }
.schedule-card > div:first-child {
  padding: 13px 12px;
  border-bottom: 1px solid var(--line);
}
.schedule-title { font-weight: 900; }
.schedule-subtitle { color: var(--muted); font-size: 12px; margin-top: 3px; }
.schedule-details span { color: var(--muted); }
.version {
  max-width: 760px;
  margin: 12px auto 20px;
  padding: 0 16px;
  color: #64748b;
  font-size: 11px;
  text-align: right;
}
@media (max-width: 430px) {
  .app { padding: 12px; }
  .header { padding: 14px; }
  .top-nav { gap: 8px; align-items: stretch; }
  .nav-button { flex: 1 1 0; padding: 10px 8px; font-size: 12px; min-width: 0; }
  .top-nav.single .nav-button { flex: 0 1 auto; }
  .actions { align-items: stretch; }
  .actions button, .actions .button-link { flex: 0 0 auto; min-width: 0; }
  h1 { font-size: 20px; }
  .row, .head { grid-template-columns: 42px 1fr 48px 60px; padding-left: 8px; padding-right: 10px; }
  .score { font-size: 19px; }
}
`;
