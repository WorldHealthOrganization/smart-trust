/**
 * Receives reviewer feedback from the "Join the Network" game and appends it to the sheet.
 *
 * Setup (once): open the feedback sheet → Extensions → Apps Script → paste this file →
 * Deploy → New deployment → type "Web app", Execute as "Me", Who has access "Anyone" →
 * copy the /exec URL into the game's .env as VITE_FEEDBACK_URL and rebuild.
 */
const SHEET_ID = '170X9_25-5S-s1FZbN8kieRopElHTl72NMmo2o3YUr0Y';
const TAB = 'Feedback';
const MAX = { comment: 4000, short: 200 };

function doGet() {
  return json({ ok: true, service: 'gdhcn-game-feedback' });
}

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json({ ok: true }); // honeypot field: bots fill it, people never see it
    const comment = clip(d.comment, MAX.comment);
    if (!comment) return json({ ok: false, error: 'empty' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB).appendRow([
        new Date(),
        clip(d.type, MAX.short),
        comment,
        clip(d.name, MAX.short),
        clip(d.org, MAX.short),
        clip(d.email, MAX.short),
        clip(d.where, MAX.short),
        clip(d.phase, MAX.short),
        clip(d.moment, MAX.short),
        clip(d.steps, MAX.short),
        clip(d.mode, MAX.short),
        clip(d.country, MAX.short),
        num(d.days),
        num(d.detours),
        clip(d.page, MAX.short),
        clip(d.browser, MAX.short),
        'New',
      ]);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** Trim, cap length, and stop spreadsheet formula injection (=, +, -, @ at the start). */
function clip(v, n) {
  const s = String(v == null ? '' : v).trim().slice(0, n);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function num(v) {
  const n = Number(v);
  return isFinite(n) ? n : '';
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
