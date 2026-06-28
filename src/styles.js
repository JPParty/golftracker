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
.eyebrow { color: var(--green); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
h1 { margin: 8px 0 6px; font-size: 22px; line-height: 1.15; }
.meta { color: var(--muted); font-size: 13px; }
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
.actions { display: flex; gap: 10px; margin-top: 14px; }
button {
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
}
button:active { transform: scale(.98); }
button:disabled { opacity: .65; cursor: wait; }
.status { color: var(--muted); font-size: 12px; align-self: center; }
.notice {
  display: none;
  border: 1px solid #854d0e;
  background: #422006;
  color: #fde68a;
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
.empty { color: var(--muted); text-align: center; padding: 32px 20px; }
@media (max-width: 430px) {
  .app { padding: 12px; }
  h1 { font-size: 20px; }
  .row, .head { grid-template-columns: 42px 1fr 48px 60px; padding-left: 8px; padding-right: 10px; }
  .score { font-size: 19px; }
}
`;
