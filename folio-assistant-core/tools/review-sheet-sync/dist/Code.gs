/**
 * @OnlyCurrentDoc
 *
 * Review sheet: keeps its links and joins current. Two modes, set by the
 * sheet's Config tab: public-comment (Review Public Comments, Review Change
 * Sets, Agent) and drafting (Contributor Feedback, Agent; one row is one
 * change set).
 *
 * ONE SCRIPT FOR EVERY DOCUMENT. Nothing in this file is about one document:
 * the document's URLs, tab and column names and table of contents are read
 * from the sheet's Config tab, which the agent writes from the folio's
 * sheet-sync.json (folio-assistant-core tools/review-sheet-sync, skill
 * review-sheet-script). The Config tab is visible and locked to the sheet's
 * owner. A copy of the template therefore works for any document once its
 * Config tab is filled.
 *
 * Install once: Extensions > Apps Script, paste this file as Code.gs (the
 * only file to paste), save, pick installTriggers in the function
 * list, press Run and allow access, then reload the sheet. A "Folio Assistant"
 * menu appears. In a drafting sheet an edit rebuilds at once; in a
 * public-comment sheet it marks the sheet dirty and a 1-minute trigger
 * rebuilds. "Refresh now" rebuilds at once. Columns are found by their header
 * text, so they may be moved freely.
 *
 * Trust: @OnlyCurrentDoc limits the script to this spreadsheet. It reads and
 * writes this sheet and its document properties only; it fetches no URL and
 * sends nothing anywhere. The same file is published once with its SHA-256,
 * so a pasted copy can be checked (skill review-sheet-script, "Trusting the
 * script").
 */
// folio-assistant-core tools/review-sheet-sync at template sha256 a6f49f795b895460.

/**
 * Run this one, once, from the editor (or Folio Assistant, then Install automatic
 * refresh): it is first in the file so the editor's Run button picks it by
 * default (owner, 2026-10-31: Run picked loadConfig and failed). Every other
 * function here is called by it, the menu or a trigger, never run by hand.
 */
function installTriggers() {
  const ss = SpreadsheetApp.getActive();
  loadConfig(ss);
  checkSheet(ss);
  host_().ScriptApp.getProjectTriggers()
    .filter(t => ['markDirty', 'refreshIfDirty'].includes(t.getHandlerFunction()))
    .forEach(t => host_().ScriptApp.deleteTrigger(t));
  host_().ScriptApp.newTrigger('markDirty').forSpreadsheet(ss).onEdit().create();
  host_().ScriptApp.newTrigger('refreshIfDirty').timeBased().everyMinutes(TIMER_MINUTES).create();
  docProps_().setProperty('timerMinutes', String(TIMER_MINUTES));
  refreshAll(); // also takes the setup line off each tab: timerMinutes marks it installed
  applyEditors(ss);
  if (DRAFTING) checkDropdown(ss);
}

/**
 * Library use (owner, 2026-10-31: "this is annoying. lets move to library
 * script"). The same file serves as a library: each sheet holds a short stub
 * (dist/Stub.gs) that calls init(...) with its own services, so the document
 * properties, the lock and the triggers are the sheet's, not the library's.
 * Pasted straight into a sheet, init is never called and the sheet's own
 * services are used.
 */
let HOST_ = null;
function init(services) { HOST_ = services || null; }
function host_() {
  return HOST_ || {
    PropertiesService: typeof PropertiesService === 'undefined' ? undefined : PropertiesService,
    LockService: typeof LockService === 'undefined' ? undefined : LockService,
    ScriptApp: typeof ScriptApp === 'undefined' ? undefined : ScriptApp,
  };
}
function docProps_() { return host_().PropertiesService.getDocumentProperties(); }
function docLock_() { return host_().LockService.getDocumentLock(); }

const CONFIG_TAB = 'Config';
// Which build this is, and where the latest is published (owner, 2026-10-31:
// "sheets likely to drift anyways ... they need to know where to see latest
// published"). The build stamps SCRIPT_VERSION; the script never fetches.
const SCRIPT_VERSION = 'template sha256 a6f49f795b895460';
const LIBRARY_URL = 'https://script.google.com/home/projects/1us7_ApIq_XvDG-V1XtqdcyHucF0hSlST0qracv1Tw9KTb4-lAFvK1bMQ/edit';
const COPY_PAGE_URL = 'https://claude.ai/artifact/MXNQcLMzLYqq5us5x6phGd';
// The menu's name and the page it points to for more (owner, 2026-11-01:
// "instead of Review links ... Folio Assistant ... link to the folio asst page").
const MENU_NAME = 'Folio Assistant';
const ABOUT_URL = 'https://litlfred.github.io/folio-assistant/';
const ABOUT_LINE = 'More about Folio Assistant: ' + ABOUT_URL;
const RUN_THIS = 'This function is not meant to be run by hand. In the toolbar, pick installTriggers ' +
  'in the function list (next to Run and Debug), then press Run.';
let CFG = null, COLS = null, DATA = null, DRAFTING = false, WATCHED = [], EDITORS = null, EDITORS_SKIPPED = [];

/**
 * Read CFG, COLS and DATA from the Config tab: column A a key, column B its
 * JSON. A long value continues on the next rows under the same key. Every
 * value starts with "|" so a sheet never reads it as a number or formula.
 */
function loadConfig(ss) {
  if (CFG) return;
  if (!ss) throw new Error(RUN_THIS);
  const sh = ss.getSheetByName(CONFIG_TAB);
  if (!sh) {
    throw new Error('This sheet has no "' + CONFIG_TAB + '" tab, so the script does not know which document it reviews. ' +
      'The agent writes it from the folio\'s sheet-sync.json (skill review-sheet-script).');
  }
  const parts = {};
  sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 2).getDisplayValues().slice(1).forEach(([k, v]) => {
    k = String(k).trim();
    if (k) parts[k] = (parts[k] || '') + String(v).replace(/^\|/, '');
  });
  if (!parts.CFG) throw new Error(notLinked(ss));
  const json = k => {
    if (!parts[k]) throw new Error('The "' + CONFIG_TAB + '" tab has no ' + k + ' row. Ask the agent to write it again.');
    return JSON.parse(parts[k]);
  };
  CFG = json('CFG');
  COLS = json('COLS');
  DATA = json('DATA');
  // Old short names, from a Config written before 2026-10-31.
  [['K', 'SECTIONS'], ['ABBR', 'ABBREVIATIONS'], ['LP', 'PAGE_LINES'], ['OFFSET', 'PAGE_OFFSET'], ['MAX', 'LAST_PAGE']]
    .forEach(([o, n]) => { if (DATA[n] === undefined && DATA[o] !== undefined) DATA[n] = DATA[o]; });
  // EDITORS: plain emails, kept by a person. No row: leave the Ready columns alone.
  // Anything else in the cell (a name, a typo) is left out and reported by
  // applyEditors, never silently dropped.
  const words = parts.EDITORS === undefined ? [] : parts.EDITORS.split(/[\s,;]+/).filter(Boolean);
  EDITORS = parts.EDITORS === undefined ? null : words.filter(x => /^[^@\s]+@[^@\s]+$/.test(x));
  EDITORS_SKIPPED = words.filter(x => !/^[^@\s]+@[^@\s]+$/.test(x));
  DRAFTING = CFG.MODE === 'drafting';
  // Public comment: the agent's per-comment rows on CFG.AGENT and, since
  // 2026-10-31 (owner), its per-change-set rows on their own tab, CFG.AGENT_CS.
  // Without AGENT_CS both halves sit side by side on CFG.AGENT, as before.
  WATCHED = DRAFTING ? [CFG.FEEDBACK, CFG.AGENT] : [CFG.RPC, CFG.AGENT, CFG.RCS].concat(CFG.AGENT_CS ? [CFG.AGENT_CS] : []);
}

/**
 * A copy of a template is not linked to a repository until the agent writes
 * its Config from the folio's sheet-sync.json. The message leads with what to
 * do and stays short enough for a toast (owner, 2026-11-01: the toast "was
 * cut off ... User wont know what to do").
 */
function notLinked(ss) {
  return 'Ask the agent to link this sheet to its document: give it this sheet\'s link (ID ' + ss.getId() +
    '). Until then the Config tab and the Selected Sections dropdown are empty.';
}
/**
 * The setup steps a person still has to take, as the first line of each
 * tab's Instructions, so the sheet itself says what to do next (owner,
 * 2026-11-01: "put instructions on sheet ... Warning icon on first line";
 * "should be in the google sheet template so clearer what to do"). The
 * templates carry the first step from the start; the script moves it on.
 */
const SETUP_MARK = '\u26a0 ';
const SETUP_STEPS = {
  unlinked: SETUP_MARK + 'Not set up yet. Step 1 of 2: ask the agent to link this sheet to its document, and give it this sheet\'s link. ' +
    'Step 2: choose ' + MENU_NAME + ', then Install.',
  uninstalled: SETUP_MARK + 'Almost set up. Step 2 of 2: choose ' + MENU_NAME + ', then Install (once), and allow it. The script then keeps this sheet current.',
};
/** Where the sheet's setup is: 'unlinked' (no Config), 'uninstalled' (no timer yet) or 'ready'. */
function setupState(linked) {
  if (!linked) return 'unlinked';
  try { return docProps_().getProperty('timerMinutes') ? 'ready' : 'uninstalled'; } catch (e) { return 'uninstalled'; }
}
/**
 * Keep each visible tab's first Instructions cell in step with the setup:
 * a \u26a0 first line with the next step until the sheet is linked and
 * installed; once linked, a last line with the document's site and
 * repository (owner, 2026-11-01). A plain text write; colourInstructions
 * puts the colours back on the next refresh.
 */
function markSetup(ss, state) {
  if (!ss) throw new Error(RUN_THIS);
  const parts = state !== 'unlinked' && CFG ? [CFG.SITE_URL, CFG.REPO_URL && 'Repository: ' + CFG.REPO_URL].filter(Boolean) : [];
  const where = parts.length ? 'Document: ' + parts.join('   ') : '';
  ss.getSheets().forEach(sh => {
    if (sh.isSheetHidden() || sh.getName() === CONFIG_TAB || sh.getLastRow() < 1 || sh.getLastColumn() < 2) return;
    if (!LEGEND_RE.test(String(sh.getRange(1, 1).getDisplayValue()).trim())) return;
    const cell = sh.getRange(1, 2);
    const before = String(cell.getDisplayValue());
    let lines = before.split('\n').filter(l => l.indexOf(SETUP_MARK) !== 0 && l.indexOf('Document: ') !== 0 &&
      l.indexOf('More about ') !== 0);
    if (SETUP_STEPS[state]) lines.unshift(SETUP_STEPS[state]);
    if (where) lines.push(where);
    lines.push(ABOUT_LINE);
    const text = lines.join('\n');
    if (text !== before) cell.setValue(text);
  });
  // A plain write drops the colours; put them back now, linked or not.
  try { colourInstructions(ss); } catch (e) { /* cosmetic only */ }
}

function showVersion() {
  // Short, one fact per line (owner, 2026-11-01: "not pretty as requested").
  // The copy page is the one place the newest build is published, and the
  // Config tab's LATEST_BUILD (written by the agent with each build) says
  // whether this sheet has it, so the script still never fetches. An alert
  // cannot hold a link, and HtmlService stays out (see the security tests).
  const short = v => String(v || '').replace(/^template sha256 /, '').slice(0, 8);
  const build = short(SCRIPT_VERSION);
  let latest = '';
  try { loadConfig(SpreadsheetApp.getActive()); latest = short(CFG && CFG.LATEST_BUILD); } catch (e) { /* not linked yet */ }
  const status = !latest ? '' : latest === build ? '\u2713 Up to date.\n\n' : 'New build available: ' + latest + '\n\n';
  SpreadsheetApp.getUi().alert('Code.gs build ' + build,
    status +
    'Newest build: top of the copy page\n' + COPY_PAGE_URL.replace(/^https:\/\//, '') + '\n\n' +
    'Different? Paste that page over Code.gs in the Folio Review Library, then save.\n\n' + ABOUT_LINE,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

function showAbout() {
  SpreadsheetApp.getUi().alert('About ' + MENU_NAME,
    MENU_NAME + ' keeps this review sheet linked to its document and its agents.\n\n' + ABOUT_LINE,
    SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * The sheet's menu. The stub calls this too (ui handed in), so the library
 * sets the menu's name and items and a rename needs no new stub.
 */
function addMenu(ui) {
  (ui || SpreadsheetApp.getUi()).createMenu(MENU_NAME)
    .addItem('Refresh now', 'refreshAll')
    .addItem('Install (first time, or after pasting a new Code.gs)', 'installTriggers')
    .addItem('Which version is this?', 'showVersion')
    .addSeparator()
    .addItem('About ' + MENU_NAME, 'showAbout')
    .addToUi();
}

function onOpen() {
  addMenu();
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(CONFIG_TAB);
    const keys = sh ? sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getDisplayValues().map(r => String(r[0]).trim()) : [];
    const linked = keys.includes('CFG');
    if (!linked) ss.toast('Ask the agent to link this sheet. The \u26a0 line at the top of the tab says how.', '\u26a0 Not set up yet', 30);
    else if (setupState(true) === 'uninstalled') ss.toast('Choose ' + MENU_NAME + ', then Install, to start the script.', '\u26a0 Almost set up', 30);
    if (linked) loadConfig(ss);
    markSetup(ss, setupState(linked));
  } catch (e) { /* a toast is a courtesy; never block the menu */ }
}


const READY_DESC = 'Ready columns: who may set them is the Config tab\'s EDITORS row (the script keeps this).';

/**
 * Lock the "Ready for ..." columns to the owner and the Config tab's EDITORS,
 * so the owner can delegate who decides without touching protections. The
 * script's own protection is rebuilt each time; others are left alone. An
 * empty EDITORS row locks them to the owner alone; no row leaves them as
 * they are.
 */
function applyEditors(ss) {
  if (!ss) throw new Error(RUN_THIS);
  if (EDITORS === null) return;
  const sh = ss.getSheetByName(DRAFTING ? CFG.FEEDBACK : CFG.RCS);
  const s = readSheet(sh);
  const cols = s.header.map((h, i) => /^Ready for /.test(h) ? i : -1).filter(i => i >= 0);
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE)
    .filter(p => p.getDescription() === READY_DESC).forEach(p => p.remove());
  // An empty row means the owner alone (owner, 2026-10-31: "should start w/
  // empty list (owner is default editor)").
  cols.forEach(c => {
    const p = sh.getRange(s.top, c + 1, sh.getMaxRows() - s.top + 1, 1).protect().setDescription(READY_DESC);
    p.removeEditors(p.getEditors());
    if (EDITORS.length) p.addEditors(EDITORS);
  });
  if (EDITORS_SKIPPED.length) {
    try {
      ss.toast('Not an email, so left out: ' + EDITORS_SKIPPED.join(', ') +
        '. Write each editor as a plain email, one per line (e.g. ana@example.org).', 'Config EDITORS', 20);
    } catch (e) { /* a toast is a courtesy */ }
  }
}

/**
 * Drafting: make sure Selected Sections is a dropdown of the hidden TOC tab,
 * and tell the person the step a script cannot take. A missing dropdown is
 * added; an existing one is left alone, since writing it again would clear
 * its "Allow multiple selections" tick. Apps Script cannot read or set that
 * tick, and the Sheets API refuses to set it on a range rule, so the reminder
 * is given at every Install. A cell holding two sections is no proof the tick
 * is on: the rule may still mark it Invalid (core#472, the DTH-PHC and DTH-PC
 * logs), so such rows are named in the reminder instead. The reminder goes
 * to the execution log as well as a toast, since a toast is missed when
 * Install runs from the editor. A sheet installed before 2026-10-31 whose
 * person said it is done stays quiet. The same steps are in the Config tab's
 * Instructions row.
 */
function checkDropdown(ss) {
  if (!ss) throw new Error(RUN_THIS);
  const sh = ss.getSheetByName(CFG.FEEDBACK);
  const s = readSheet(sh);
  const at = s.header.indexOf(COLS.draft.sections);
  if (at < 0) return;
  const cells = sh.getRange(s.top, at + 1, sh.getMaxRows() - s.top + 1, 1);
  const had = cells.getDataValidation();
  if (!had) {
    cells.setDataValidation(SpreadsheetApp.newDataValidation()
      .requireValueInRange(ss.getSheetByName(CFG.TOC).getRange('A2:A'), true)
      .setAllowInvalid(true).build());
  }
  const props = docProps_();
  if (had && props.getProperty('dropdownDone')) return;
  const multi = had ? multiPicked(cells, s.top) : [];
  const msg = 'Selected Sections is ' + (had ? 'a dropdown' : 'now a dropdown of the document\'s sections') +
    '. One step only a person can take: select the "' + COLS.draft.sections +
    '" column, choose Data, then Data validation, open its rule, set Advanced options > Display style to Chip, then tick Allow multiple selections (greyed out until the style is Chip), and press Done. ' +
    (multi.length ? 'Until it is ticked, rows with two sections (row ' + multi.slice(0, 5).join(', ') + (multi.length > 5 ? ', ...' : '') + ') show Invalid. ' : '') +
    'If it is already ticked, there is nothing to do. The same steps are on the Config tab.';
  // The execution log, for an Install run from the editor, where no toast shows.
  console.log(msg);
  // A toast, never a dialog: a dialog waits for an answer in the sheet, and
  // when Install is run from the Apps Script editor nobody sees it, so the
  // run hangs until Apps Script stops it after 6 minutes (owner, 2026-10-31:
  // "Exceeded maximum execution time" on the DTH-SC log).
  try {
    ss.toast(msg, 'Finish the dropdown', 30);
  } catch (e) { /* a toast is a courtesy */ }
}

/**
 * Data rows look like data rows (owner, 2026-10-31: "why row 3 bold", "review
 * styling on PR Feedback and apply to Contrib Feedback"). A row inserted just
 * under the header takes the header's look (bold, dark fill, centred), so the
 * first change set of a new log read as a second header. Any data row whose
 * cells are bold or centred at cell level gets its format back from the last
 * row of the tab, which nobody types in, before the script writes its own
 * rich text (which carries its own bold spans).
 */
function normalizeRows(sh) {
  if (!sh) return 0;
  const s = readSheet(sh), n = sh.getLastRow() - s.top + 1;
  if (n <= 0) return 0;
  const width = sh.getLastColumn(), last = sh.getMaxRows();
  if (last < s.top + n) return 0;
  const range = sh.getRange(s.top, 1, n, width);
  const weights = range.getFontWeights(), valign = range.getVerticalAlignments();
  let fixed = 0;
  for (let k = 0; k < n; k++) {
    // Column A (the id, always plain) and the alignment: the script's own rich
    // text has bold spans, which must not read as a header row.
    const off = weights[k][0] === 'bold' || valign[k].some(v => /middle|center/i.test(String(v)));
    if (!off) continue;
    sh.getRange(last, 1, 1, width).copyTo(sh.getRange(s.top + k, 1, 1, width), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    fixed++;
  }
  return fixed;
}

/**
 * Move column `name` to sit immediately left of column `before`, by header.
 * Only ever called inside the locked run (memory: never move columns
 * mid-refresh). Returns true when it moved something.
 */
function placeBefore(sh, name, before) {
  if (!sh) return false;
  const s = readSheet(sh), a = s.header.indexOf(name), b = s.header.indexOf(before);
  if (a < 0 || b < 0 || a === b - 1) return false;
  // Sheets refuses to move part of a merged cell, and the title row's B1 is
  // merged across the header (owner, 2026-11-01: the move silently failed on
  // the Contributor Log and template). Unmerge the rows above the header,
  // move, then merge the same cells again with their text kept.
  const above = s.top - 2;
  const merged = above > 0 && sh.getRange(1, 1, above, sh.getLastColumn()).getMergedRanges
    ? sh.getRange(1, 1, above, sh.getLastColumn()).getMergedRanges() : [];
  const kept = merged.map(m => ({ a1: m.getA1Notation(), rich: m.getCell(1, 1).getRichTextValue() }));
  merged.forEach(m => m.breakApart());
  // moveColumns' destination is the index BEFORE the move, 1-based.
  sh.moveColumns(sh.getRange(1, a + 1, 1, 1), b + 1);
  kept.forEach(k => {
    const r = sh.getRange(k.a1);
    r.merge();
    if (k.rich) r.getCell(1, 1).setRichTextValue(k.rich);
  });
  return true;
}

/** Row numbers of the cells holding two or more sections from the list: a single-pick rule marks them Invalid. */
function multiPicked(cells, top) {
  const names = new Set(DATA.TOC.map(t => bareName(t[0])));
  const rows = [];
  cells.getDisplayValues().forEach(([v], k) => {
    const parts = String(v).split(',').map(x => x.trim()).filter(Boolean);
    if (parts.length > 1 && parts.every(x => names.has(bareName(x)))) rows.push(top + k);
  });
  return rows;
}

/**
 * Stop with a plain message when the Config tab was written for another
 * sheet, or names tabs this sheet does not have: otherwise the refresh would
 * fail deep inside, on a missing tab.
 */
function checkSheet(ss) {
  if (!ss) throw new Error(RUN_THIS);
  const built = 'The Config tab was written from ' + CFG.SOURCE + ' for a ' + CFG.MODE + ' sheet';
  if (CFG.SHEET && ss.getId() !== CFG.SHEET) {
    throw new Error(built + ' (spreadsheet ' + CFG.SHEET + '), not this one. Ask the agent to write this sheet\'s Config.');
  }
  const need = DRAFTING ? [CFG.FEEDBACK] : [CFG.RPC, CFG.AGENT, CFG.RCS].concat(CFG.AGENT_CS ? [CFG.AGENT_CS] : []);
  const missing = need.filter(n => !ss.getSheetByName(n));
  if (missing.length) {
    throw new Error(built + ', which needs the tab(s) ' + need.map(n => '"' + n + '"').join(', ') +
      '. This spreadsheet has no ' + missing.map(n => '"' + n + '"').join(', ') +
      '. Ask the agent to write this sheet\'s Config, or rename the tab.');
  }
}

function markDirty(e) {
  const name = e && e.range && e.range.getSheet().getName();
  if (!name || name === CONFIG_TAB) return;
  try { loadConfig(SpreadsheetApp.getActive()); } catch (err) { return; }
  if (!WATCHED.includes(name)) return;
  const props = docProps_();
  // An Editor's Ready for agent edit is timed now, not on the next refresh,
  // so the agent's feedback says "Ready for agent set" at once (owner,
  // 2026-10-31: "i expected to see change to Change Set Feedback (agent) b/c
  // i said ready for agent").
  let readyNow = {};
  if (name === (DRAFTING ? CFG.FEEDBACK : CFG.RCS)) {
    try { readyNow = noteReady_(e, props, DRAFTING ? COLS.draft.cs : 'Change-set'); } catch (err) { /* the refresh still runs */ }
  }
  if (DRAFTING) {
    // Incremental: remember which Contributor Feedback rows the edit touched
    // and rebuild only those, at once. An edit of the header row, or of the
    // Agent tab by hand, rebuilds everything.
    const r0 = e.range.getRow ? e.range.getRow() : 1;
    const top = name === CFG.FEEDBACK ? topRow(e.range.getSheet()) : 2;
    if (name === CFG.FEEDBACK && r0 >= top) {
      const rows = (props.getProperty('rows') || '').split(',').filter(Boolean);
      const n = e.range.getNumRows();
      for (let r = r0; r < r0 + Math.min(n, MAX_ROWS + 1); r++) rows.push(String(r - top));
      const uniq = rows.filter((x, i) => rows.indexOf(x) === i);
      // A large paste rebuilds everything: a long row list would overflow a
      // document property (9 kB) and stop the refresh (finding F4).
      if (uniq.length > MAX_ROWS) props.setProperty('dirty', '1');
      else props.setProperty('rows', uniq.join(','));
    } else {
      props.setProperty('dirty', '1');
    }
    return refreshIfDirty();
  }
  props.setProperty('dirty', '1');
  // The watch hash is written at once, before any rebuild, so a review-log
  // watcher sees the edit even while a slow sheet waits for the timer
  // (owner, 2026-11-05: "make the hash update on edit, not just refresh").
  writeWatchHash(SpreadsheetApp.getActive());
  // Public-comment mode rebuilds the whole sheet, since a comment's row feeds
  // its change sets' rows. It does so at once while that is quick; once a
  // rebuild takes longer than FAST_MS (an 800-row log takes about 20 s),
  // edits are gathered and the timer rebuilds, so runs do not
  // pile up.
  if (+(props.getProperty('lastMs') || 0) <= FAST_MS) return refreshIfDirty();
  // A slow sheet waits for the timer, but a proposal an edit makes stale is
  // flagged at once: it reads only two tabs (owner, 2026-10-31: "made
  // feedback change in RefArch Log but no warning on stale").
  if (name === CFG.RCS) { try { staleNow(readyNow); } catch (err) { /* the timer still runs */ } }
}

/**
 * Record when an edit set Ready for agent to Yes ("ready:CS-001" = now), or
 * clear it on No. Returns { cs: time } for the rows turned Yes.
 */
function noteReady_(e, props, csHeader) {
  const r = e.range;
  if (!r.getColumn) return {};
  const s = readSheet(r.getSheet());
  const rc = col(s, 'Ready for agent'), cc = col(s, csHeader);
  const c0 = r.getColumn(), nc = r.getNumColumns ? r.getNumColumns() : 1;
  if (rc < 0 || cc < 0 || rc + 1 < c0 || rc + 1 >= c0 + nc) return {};
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z', out = {};
  const r0 = r.getRow(), n = Math.min(r.getNumRows(), MAX_ROWS);
  for (let row = r0; row < r0 + n; row++) {
    const v = s.rows[row - s.top];
    if (!v) continue;
    const cs = String(v[cc]).trim();
    if (!cs) continue;
    if (/^yes$/i.test(String(v[rc]).trim())) { props.setProperty('ready:' + cs, now); out[cs] = now; }
    else props.deleteProperty('ready:' + cs);
  }
  return out;
}

/** Public comment: flag stale proposals on Review Change Sets, without a full rebuild. */
function staleNow(readyNow) {
  const ss = SpreadsheetApp.getActive();
  const agentCs = readSheet(ss.getSheetByName(CFG.AGENT_CS || CFG.AGENT));
  const rcs = readSheet(ss.getSheetByName(CFG.RCS));
  const aId = col(agentCs, COLS.agent.csId), aBasis = COLS.agent.basis ? col(agentCs, COLS.agent.basis) : -1;
  if (aId < 0 || aBasis < 0) return;
  const basisOfCs = {};
  agentCs.rows.forEach(r => { const id = String(r[aId]).trim(); if (id) basisOfCs[id] = String(r[aBasis]).trim(); });
  // Only the rows an Editor just set to Yes get their progress line here;
  // the rest keep theirs until the timer's full refresh.
  const lineOf = {};
  Object.keys(readyNow || {}).forEach(cs => { lineOf[cs] = progressLine({ readyAt: readyNow[cs] }); });
  markStale(rcs, col(rcs, 'Change-set'), basisOfCs, ['Title', 'TWG (CS)'], 'Committee Feedback', COLS.rcs.agentFeedback || 'Change Set Feedback (agent)', lineOf);
}

const FAST_MS = 5000;
// How often the timer runs (owner, 2026-10-31: "make it every minute"; it was
// 5). A sheet installed with another interval moves to this one on its next
// tick, so nobody has to run Install again.
const TIMER_MINUTES = 1;
function upgradeTimer_(props) {
  if (props.getProperty('timerMinutes') === String(TIMER_MINUTES)) return;
  try {
    const app = host_().ScriptApp;
    app.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshIfDirty').forEach(t => app.deleteTrigger(t));
    app.newTrigger('refreshIfDirty').timeBased().everyMinutes(TIMER_MINUTES).create();
    props.setProperty('timerMinutes', String(TIMER_MINUTES));
  } catch (err) { /* run by someone who cannot manage triggers: leave it */ }
}
const MAX_ROWS = 200;

/**
 * The timer (every minute), and each edit. Drafting: rebuild the rows edited
 * since the last run and the rows whose change set's Agent row changed (the
 * agent writes Agent through the API, which fires no edit, so this is how
 * its writes reach the sheet). Public comment: rebuild all, if dirty.
 */
function refreshIfDirty() {
  const props = docProps_();
  upgradeTimer_(props);
  try { loadConfig(SpreadsheetApp.getActive()); } catch (err) { return; }
  try { colourInstructions(SpreadsheetApp.getActive()); } catch (err) { /* cosmetic only */ }
  try { headerNotes(SpreadsheetApp.getActive()); } catch (err) { /* cosmetic only */ }
  if (!DRAFTING) {
    // The agent writes Agent through the API, which fires no edit, so the
    // timer also rebuilds when the Agent tab's contents have changed.
    const seen = hashOf(JSON.stringify([CFG.AGENT, CFG.AGENT_CS].filter(Boolean).map(n => {
      const a = SpreadsheetApp.getActive().getSheetByName(n);
      return a ? a.getRange(1, 1, Math.max(a.getLastRow(), 1), Math.max(a.getLastColumn(), 1)).getDisplayValues() : [];
    }).concat([agentColumnText()])));
    const moved = seen !== (props.getProperty('agentHash') || '');
    if (props.getProperty('dirty') !== '1' && !moved) {
      // Nothing to rebuild: still rewrite the watch hash, so Checked (UTC) is
      // a heartbeat and an edit no trigger saw still changes the hash.
      writeWatchHash(SpreadsheetApp.getActive());
      return;
    }
    // Cleared before the run, so an edit made during it marks it dirty
    // again; put back when the run could not start or failed, so the edit is
    // not lost but retried on the next tick.
    props.deleteProperty('dirty');
    let ok = false;
    try { ok = refreshAll() === true; } finally {
      if (ok) props.setProperty('agentHash', seen);
      else props.setProperty('dirty', '1');
    }
    return;
  }
  const lock = docLock_();
  if (!lock.tryLock(10000)) return;
  const t0 = Date.now();
  try {
    const full = props.getProperty('dirty') === '1';
    const rows = (props.getProperty('rows') || '').split(',').filter(Boolean).map(Number);
    props.deleteProperty('dirty');
    props.deleteProperty('rows');
    checkSheet(SpreadsheetApp.getActive());
    refreshDraft(full ? null : rows);
    try { capRows(SpreadsheetApp.getActive(), [CFG.FEEDBACK]); } catch (err) { /* cosmetic only */ }
    writeWatchHash(SpreadsheetApp.getActive());
  } finally {
    props.setProperty('lastMs', String(Date.now() - t0));
    lock.releaseLock();
  }
}

/** Rebuild everything. True when it ran; false when another run held the lock. */
function refreshAll() {
  const lock = docLock_();
  if (!lock.tryLock(1000)) {
    // Refresh now pressed while a timer refresh runs: say so rather than do
    // nothing in silence (owner, 2026-10-31: "what does Refresh now do exactly?").
    try { SpreadsheetApp.getActive().toast('Another refresh is running. Try again in a minute.', MENU_NAME, 5); } catch (err) { /* no UI on a timer */ }
    return false;
  }
  const t0 = Date.now();
  try {
    refreshLocked();
    applyEditors(SpreadsheetApp.getActive());
    try { markSetup(SpreadsheetApp.getActive(), setupState(true)); } catch (err) { /* cosmetic only */ }
    try { colourInstructions(SpreadsheetApp.getActive()); } catch (err) { /* cosmetic only */ }
    try { styleConfig(SpreadsheetApp.getActive()); } catch (err) { /* cosmetic only */ }
    return true;
  } finally {
    docProps_().setProperty('lastMs', String(Date.now() - t0));
    lock.releaseLock();
  }
}

function refreshLocked() {
  {
    loadConfig(SpreadsheetApp.getActive());
    checkSheet(SpreadsheetApp.getActive());
    if (DRAFTING) {
      const out = refreshDraft();
      writeWatchHash(SpreadsheetApp.getActive());
      return out;
    }
    const ss = SpreadsheetApp.getActive();
    // Added inside the run, under its lock, so no other refresh writes by a
    // column position this changes (memory: never move columns mid-refresh).
    try { ensureConfirmedColumn(ss); } catch (err) { /* the refresh still runs */ }
    try { ensureAgentStepColumn(ss.getSheetByName(CFG.AGENT_CS || CFG.AGENT)); } catch (err) { /* the refresh still runs */ }
    [CFG.RPC, CFG.RCS].forEach(n => { try { normalizeRows(ss.getSheetByName(n)); } catch (err) { /* cosmetic only */ } });
    const rpc = readSheet(ss.getSheetByName(CFG.RPC));
    const agent = readSheet(ss.getSheetByName(CFG.AGENT));
    const agentCs = CFG.AGENT_CS ? readSheet(ss.getSheetByName(CFG.AGENT_CS)) : agent;
    // People own Title and the change sets themselves (Q-CS-1 C): done
    // before Review Change Sets is read, so this run sees the new rows.
    try { peopleColumns(ss); } catch (err) { /* the refresh still runs */ }
    try { ownChangeSets(ss, agentCs); } catch (err) { /* the refresh still runs */ }
    const rcs = readSheet(ss.getSheetByName(CFG.RCS));
    const pcOf = {}, csOf = {}, csOfNo = {}, stOf = {}, prOf = {};
    const aNo = col(agent, COLS.agent.no), aPc = col(agent, COLS.agent.pc), aCs = col(agent, COLS.agent.cs);
    const aSt = col(agent, COLS.agent.agentic);
    const aId = col(agentCs, COLS.agent.csId), aPrs = col(agentCs, COLS.agent.prs), aCh = col(agentCs, COLS.agent.changes);
    const aDone = col(agentCs, COLS.agent.done);
    const aBasis = COLS.agent.basis ? col(agentCs, COLS.agent.basis) : -1;
    const basisOfCs = {}, stagingOf = {}, builtOf = {};
    const aStaging = COLS.agent.staging ? col(agentCs, COLS.agent.staging) : -1;
    const aBuilt = COLS.agent.built ? col(agentCs, COLS.agent.built) : -1;
    const aHead = col(agentCs, COLS.agent.head || 'PR head (change set)');
    const aFrom = col(agentCs, COLS.agent.builtFrom || 'Staging built from (change set)');
    const aDeploy = col(agentCs, COLS.agent.deploy || 'Staging deploy (change set)');
    const aDisp = col(agentCs, COLS.agent.dispositions || DISPOSITIONS_CS), dispOf = {};
    const aGate = col(agentCs, COLS.agent.gate || QA_GATE), aQa = col(agentCs, COLS.agent.qa || QA_REPORT), aStep = col(agentCs, AGENT_STEP);
    agent.rows.forEach(r => {
      const n = String(r[aNo]).trim();
      if (n) {
        if (aPc >= 0 && r[aPc]) pcOf[n] = String(r[aPc]).trim();
        if (aSt >= 0) stOf[n] = String(r[aSt]).trim();
        if (aCs >= 0 && r[aCs]) String(r[aCs]).split(/[,\s]+/).filter(Boolean).forEach(cs => {
          (csOf[cs] = csOf[cs] || []).push(n);
          (csOfNo[n] = csOfNo[n] || []).push(cs);
        });
      }
    });
    agentCs.rows.forEach(r => {
      // A change-set's pull requests: any number of URLs, one per line, and
      // on the same lines of the next column what each one changed.
      const id = aId >= 0 ? String(r[aId]).trim() : '';
      if (id && aBasis >= 0) basisOfCs[id] = String(r[aBasis]).trim();
      if (id && aStaging >= 0) stagingOf[id] = (String(r[aStaging]).match(/https:\/\/\S+/) || [''])[0];
      if (id) builtOf[id] = builtInfo(r, aBuilt, aFrom, aDeploy, aGate, aQa, aStep);
      if (id && aDisp >= 0) dispOf[id] = String(r[aDisp]);
      if (id && aPrs >= 0) {
        const descs = aCh >= 0 ? prDescs(r[aCh]) : [];
        const dones = aDone >= 0 ? String(r[aDone]).split('\n').map(x => x.trim()) : [];
        const heads = aHead >= 0 ? String(r[aHead]).split('\n').map(x => x.trim()) : [];
        prOf[id] = String(r[aPrs]).split('\n').map(x => x.trim()).filter(Boolean)
          .map((line, i) => ({ url: prUrl(line), desc: descs[i] || '', done: dones[i] || '', head: heads[i] || '' }))
          .filter(x => x.url);
      }
    });
    // A person's Change Set (human) wins over the agent's (like TWG (human)):
    // the comment moves at once here, and the watcher then records the move
    // on Agent - Comments.
    const hCs = col(rpc, CS_HUMAN), hNo0 = col(rpc, COLS.rpc.no), csKnown = {};
    rcs.rows.forEach(r => { const id = String(r[col(rcs, 'Change-set')]).trim(); if (id) csKnown[id] = 1; });
    if (hCs >= 0 && hNo0 >= 0) rpc.rows.forEach(r => {
      const n = String(r[hNo0]).trim(), h = n ? humanCs(r[hCs], csKnown) : null;
      if (!h || (!h.ids.length && !/^new/.test(h.note))) return;
      (csOfNo[n] || []).forEach(cs => { csOf[cs] = (csOf[cs] || []).filter(x => x !== n); });
      csOfNo[n] = h.ids.slice();
      h.ids.forEach(cs => (csOf[cs] = csOf[cs] || []).push(n));
    });
    refreshRpc(rpc, pcOf, csOfNo, stOf, prOf);
    const csCol = col(rcs, 'Change-set'), all = () => true;
    const humanDisp = {}, hNo = col(rpc, COLS.rpc.no), hD = col(rpc, COLS.rpc.disposition || 'Disposition');
    if (hNo >= 0 && hD >= 0) rpc.rows.forEach(r => { const n = String(r[hNo]).trim(); if (n) humanDisp[n] = String(r[hD]).trim(); });
    const readyAt = readyTimes(rcs, csCol, prOf, all, docProps_()), lineOf = {};
    refreshRcs(rcs, rpc, csOf, stOf, prOf, readyAt, builtOf);
    const cCol = col(rcs, CONFIRMED), confirmedOf = {};
    if (cCol >= 0) rcs.rows.forEach(r => { const cs = String(r[csCol]).trim(); if (cs) confirmedOf[cs] = confirmedNos(r[cCol], csOf[cs] || []); });
    writeRows(rcs, col(rcs, COLS.rcs.dispositionsAgent || DISPOSITIONS_AGENT), null, r => {
      const cs = String(r[csCol]).trim();
      return dispositionCell(dispOf[cs], csOf[cs], humanDisp, confirmedOf[cs]);
    });
    // No Agentic status column: the status sits on top of the agent's
    // feedback instead (owner, 2026-10-31, option A: "One column, status on top").
    const mergedRcs = col(rcs, COLS.rcs.agentic || 'Agentic status') < 0;
    const dispBlock = {};
    rcs.rows.forEach(r => {
      const cs = String(r[csCol]).trim();
      if (cs && (prOf[cs] || []).length && dispositionProblems(dispOf[cs] || '', csOf[cs] || [], humanDisp, confirmedOf[cs]))
        dispBlock[cs] = 'dispositions not complete or not confirmed';
    });
    rcs.rows.forEach(r => {
      const cs = String(r[csCol]).trim();
      const st = csStatus((csOf[cs] || []).map(n => stOf[n]).filter(Boolean));
      if (cs && mergedRcs) lineOf[cs] = statusBlock(progressLine({ readyAt: readyAt[cs], merge: isYes(rcs, r, 'Ready for merge'), status: st, prs: prOf[cs] || [], staging: stagingOf[cs], built: builtOf[cs], disp: dispBlock[cs] }), st, prOf[cs] || []);
      else if (cs) lineOf[cs] = progressLine({ readyAt: readyAt[cs], merge: isYes(rcs, r, 'Ready for merge'), status: csStatus((csOf[cs] || []).map(n => stOf[n]).filter(Boolean)), prs: prOf[cs] || [], staging: stagingOf[cs], built: builtOf[cs], disp: dispBlock[cs] });
    });
    markStale(rcs, csCol, basisOfCs, ['Title', 'TWG (CS)'], 'Committee Feedback', COLS.rcs.agentFeedback || 'Change Set Feedback (agent)', lineOf);
    completeReady(rcs, csCol, prOf, stagingOf, builtOf, readyAt);
    const csSt = {};
    rcs.rows.forEach(r => { const cs = String(r[csCol]).trim(); if (cs) csSt[cs] = csStatus((csOf[cs] || []).map(n => stOf[n]).filter(Boolean)); });
    finishDoneRows(rcs, csCol, csSt, docProps_());
    try { capRows(ss, [CFG.RPC, CFG.RCS]); } catch (err) { /* cosmetic only */ }
    // Staging review page, from Agent: only where Agent names a preview, so a
    // sheet whose agent writes the cell directly keeps it.
    const rSt = COLS.rcs.staging ? col(rcs, COLS.rcs.staging) : -1, rCs = col(rcs, COLS.rcs.cs);
    if (rSt >= 0 && rCs >= 0) rcs.rows.forEach((r, k) => {
      const id = String(r[rCs]).trim();
      if (stagingOf[id] || awaitsPreview(prOf[id])) rcs.sh.getRange(k + rcs.top, rSt + 1, 1, 1).setRichTextValues([[stagingCell(stagingOf[id], builtOf[id], prOf[id], readyAt[id], dispBlock[id])]]);
    });
     writeWatchHash(ss);
  }
}
// ---------- sheet helpers ----------

/**
 * Rows above the header whose first cell starts "Instructions" (or, before
 * 2026-10-31 09:30Z, "Colour key") are for people: the header is the first row
 * after them, and `top` is the sheet row of the first data row (2 with none).
 * Every write goes through `top`.
 */
const LEGEND_RE = /^(instructions|colou?r key)\b/i;
function legendCount(firstCells) {
  let h = 0;
  while (h < firstCells.length - 1 && LEGEND_RE.test(String(firstCells[h]).trim())) h++;
  return h;
}
/**
 * The colour words in each tab's Instructions text are shown in their own
 * colour (owner, 2026-10-31: "no color coded instructions"). The key on the
 * first line ("Blue = your input ...") is coloured segment by segment, and
 * every later Blue, Green, Orange or Grey word by itself, bold. A cell is
 * only rewritten when its first colour word is not yet coloured, so this is
 * cheap enough to run on every refresh; the agent rewrites the text through
 * the API, which drops the colours, and the next refresh puts them back.
 * Links in the text are kept as links.
 */
/**
 * Hover text on every column head (owner, 2026-10-31: "can we add hover text
 * to the column heads that describes what it is", all columns in the sheets;
 * "don't need to name the color in the tooltip"). Each note says what the
 * column holds and who fills it in. Matched by header, first on
 * "<tab kind>|<header>", then on the header alone; a header ending in "(...)"
 * (a person's initials) also matches its "Name (*)" entry. The script owns
 * every head note on these tabs; a head with no entry is left alone.
 */
const HEADER_NOTES = {
  // Review Public Comments
  'rpc|No.': 'The public comment number, as received. Cite a comment by it, e.g. "No. 132". Kept by the script.',
  'rpc|Sections': 'The sections of the document the comment is about, linked to the draft. Kept by the script.',
  'Page': 'The page of the review draft the comment cites, linked to that page. Kept by the script.',
  'Line no(s) / Table / Figure': 'The lines, table or figure of the review draft the comment cites. From the submission.',
  'Comment / issue': 'The comment, as the submitter wrote it. Never edited.',
  'Suggested revision': 'The change the submitter proposed, as written. Never edited.',
  'Change Set': 'The change set this comment is in, linked to its row on Review Change Sets: the agent\'s suggestion, or the one you set in Change Set (human). Kept by the script.',
  'Change Set (human)': 'Move this comment: type the id of another change set (CS-004), several ids, or "new" for a change set of its own. Wins over the agent\'s suggestion. You fill this in.',
  'TWG (agent)': 'The technical working group the agent suggests for this comment.',
  'TWG (human)': 'The technical working group you assign. Wins over the agent\'s suggestion. You fill this in.',
  'Comment type': 'The kind of comment, e.g. editorial or technical. You fill this in.',
  'Committee Feedback (*)': 'One reviewer\'s feedback. Put your initials in the column head; one column per reviewer. You fill this in.',
  'rpc|Disposition': 'The committee\'s decision on this comment: Accepted, Partially accepted, Not accepted, Noted, Deferred, Duplicate, Out of scope or Withdrawn. You fill this in; the agent starts from it and never overrides it.',
  'rpc|Status': 'Where the comment is in review, e.g. Open, In review, Closed. You fill this in.',
  'rpc|Agentic status': 'Where the agent is with this comment\'s change set: Working, PR open, Needs you, Completed. Kept by the script.',
  'rpc|Staging review': 'Opens the preview of this comment\'s change set, with a warning when it is stale or still building. Kept by the script.',
  // Review Change Sets
  'Change-set': 'The change set id (CS-001, ...). A change set groups related comments into one pull request. Kept by the script.',
  'rcs|Title': 'A short name for the change set. You fill this in. To make a change set, type a Title on an empty row: the script gives it the next id. To split one, add rows and move its comments with Change Set (human) on Review Public Comments.',
  'rcs|Sections': 'The sections of the document the change set touches, linked to the draft. Kept by the script.',
  'Pages': 'The review-draft pages its comments cite. Kept by the script.',
  'Public Comments': 'The public comments in this change set, each linked to its row on Review Public Comments. Kept by the script.',
  'Suggested Revisions': 'The submitters\' suggested revisions for these comments. Kept by the script.',
  'PC Committee Feedback': 'The committee\'s feedback on each of these comments, from Review Public Comments. Kept by the script.',
  'Dispositions': 'The dispositions people set on each of these comments, from Review Public Comments. Kept by the script.',
  'TWG (PCs)': 'The working groups of these comments. Kept by the script.',
  'TWG (CS)': 'The working group that owns this change set. You fill this in.',
  'Ready for agent': 'Yes: the direction is agreed and the agent may edit. No: wait. Completed: the agent has finished and the preview is current (set by the script). Any change in feedback sets it back to No. Set by an Editor.',
  'Dispositions confirmed': 'Yes: the committee confirms every disposition the agent gave in this change set. To differ on one comment, set that comment\'s own Disposition on Review Public Comments. The agent will not merge until every comment is confirmed or has its own Disposition. Set by an Editor.',
  'Ready for merge': 'Yes: merge the pull request. The agent merges only once the QA gate has passed for the current version. Set by an Editor.',
  'Disposition (agent)': 'The decisions made so far (oldest first, never removed), then one disposition per comment number. "No disposition yet" lists the numbers still missing one. From the agent, read only.',
  'Change Set Feedback (agent)': 'The status on top, then the agent\'s current proposal and any question it needs answered, with options and a recommendation.',
  'Feedback (agent)': 'The status on top, then the agent\'s current proposal and any question it needs answered, with options and a recommendation.',
  'Agentic status': 'Where the agent is: Working, PR open, Needs you (a question for you), Completed, with each pull request and what it changed. Kept by the script.',
  'Staging review': 'Opens the preview of the change, and its QA report. Shows the QA gate, and a warning while the preview is stale or being rebuilt. Kept by the script.',
  'Agentic status (filter)': 'A one-word copy of Agentic status, for filter views. Kept by the script.',
  // Contributor Feedback (drafting)
  'draft|Title': 'A short name for this row\'s change. You fill this in.',
  'Selected Sections': 'The sections this row is about. Pick from the dropdown; several are allowed. You fill this in.',
  'Section links': 'Links to the selected sections in the current draft. Kept by the script.',
  'Contributor Feedback (*)': 'One contributor\'s feedback. Put your initials or name in the column head; one column per contributor. You fill this in.',
  'draft|Disposition': 'The decision on this row. You fill this in.',
  'Issue': 'The GitHub issue that tracks this change set. Set by the agent.',
  // Agent tabs (written only by the agent)
  'agent|No.': 'The public comment number. Written by the agent.',
  'agent|Title': 'A short name for the change set. Written by the agent.',
  'Comment ref': 'The comment\'s id in the repository (PC-0001, ...). Written by the agent.',
  'Agentic action taken': 'What the agent did for this comment. Written by the agent.',
  'Agentic applied in (section / version)': 'Where the change landed: section and version. Written by the agent.',
  'Agentic handled by': 'Which agent session handled it. Written by the agent.',
  'Agentic date actioned': 'When the agent acted (UTC). Written by the agent.',
  'Change-sets': 'The change set(s) this comment belongs to. Written by the agent.',
  'Pull request (change set)': 'The pull request(s) with the change set\'s edits. Written by the agent.',
  'Staging review page (change set)': 'The preview page for the change set. Written by the agent.',
  'What the PRs changed (change set)': 'What the pull requests changed, one item per line with the comment numbers. Written by the agent.',
  'Agent completed (UTC, change set)': 'When the agent last finished work on this change set, from the clock. Written by the agent.',
  'Feedback basis (change set)': 'A fingerprint of the feedback the agent worked from. When the feedback changes, the proposal is marked stale. Written by the agent.',
  'Staging built (UTC, change set)': 'When the preview was built. Written by the agent.',
  'PR head (change set)': 'The pull request\'s current commit. Written by the agent.',
  'Staging built from (change set)': 'The commit the preview was built from. If it differs from PR head, the preview is stale. Written by the agent.',
  'Staging deploy (change set)': 'Where the preview deploy is: building, pushed, deploying, deployed or failed, with the expected live time. Written by the agent.',
  'Disposition (change set)': 'The decisions so far, then one disposition per comment. Shown on the review tab as Disposition (agent). Written by the agent with its record tool.',
  'QA gate (change set)': '"Passed" or "Failed" for one version of the pull request. No merge until it passed for the current one. Written only by an independent reviewer, never the authoring agent.',
  'Agent step (change set)': 'What the agent is doing now and since when, e.g. "editing 2026-10-31 17:20Z": reading, proposing, editing, pushing, staging, deploying, qa-review, merging or idle. Shown on the status line. Written by the agent with its record tool.',
  'QA report (change set)': 'The QA results for the current version of the pull request. Written by the agent.',
  'Agent conversation (change set)': 'The agent session working on this change set. Written by the agent.',
};
/** The head notes the script wrote before 2026-10-31 16:05Z ended in this. */
const NOTE_MARK = '\n\n(Column note kept by the review sheet script.)';
/**
 * Rows on the people's tabs are at most about 10 lines high (owner,
 * 2026-10-31: "make rows of human input tabs no more than 10 lines high on a
 * laptop", "so scroll overflow"). Sheets has no scrolling inside a cell, so a
 * longer row is fixed at 10 lines and the rest is clipped: clicking the cell
 * shows the whole text in the formula bar, and double-clicking opens it
 * scrollable. A row that fits is left to size itself. Lines are estimated
 * from each column's width, the same way for every run, so a row is only
 * rewritten when its estimate crosses the cap.
 */
const ROW_CAP_LINES = 10, LINE_PX = 17, CHAR_PX = 7;
function rowLines(values, widths) {
  return values.reduce((most, v, c) => {
    const per = Math.max(1, Math.floor((widths[c] - 8) / CHAR_PX));
    const n = String(v).split('\n').reduce((k, line) => k + Math.max(1, Math.ceil(line.length / per)), 0);
    return Math.max(most, n);
  }, 1);
}
function capRows(ss, names) {
  const cap = ROW_CAP_LINES * LINE_PX + 4;
  names.filter(Boolean).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 3) return;
    const s = readSheet(sh);
    const widths = s.header.map((_, c) => sh.getColumnWidth(c + 1));
    const props = docProps_(), key = 'capped:' + sh.getSheetId();
    const was = JSON.parse(props.getProperty(key) || '[]');
    const now = [];
    s.rows.forEach((r, k) => { if (rowLines(r, widths) > ROW_CAP_LINES) now.push(k + s.top); });
    const add = now.filter(x => was.indexOf(x) < 0), drop = was.filter(x => now.indexOf(x) < 0);
    runs(add).forEach(([a, n]) => sh.setRowHeightsForced(a, n, cap));
    runs(drop).forEach(([a, n]) => sh.autoResizeRows(a, n));
    if (add.length || drop.length) props.setProperty(key, JSON.stringify(now));
  });
}
/** [3,4,5,9] -> [[3,3],[9,1]]: start row and count. */
function runs(rows) {
  const out = [];
  rows.slice().sort((x, y) => x - y).forEach(r => {
    const last = out[out.length - 1];
    if (last && last[0] + last[1] === r) last[1]++;
    else out.push([r, 1]);
  });
  return out;
}
/**
 * The agent also writes its proposal straight into Change Set Feedback (agent)
 * on Review Change Sets, which fires no edit either, and that rewrite drops
 * the script's \u23f3 status line (owner, 2026-10-31: "i dont see status"). So the
 * timer watches that column too, with the script's own lines taken out, so
 * putting the status line back does not itself count as a change.
 */
function agentColumnText() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CFG.RCS);
  if (!sh) return '';
  const s = readSheet(sh), c = col(s, COLS.rcs.agentFeedback || 'Change Set Feedback (agent)');
  if (c < 0) return '';
  return s.rows.map(r => ownText(r[c])).join('\u0001');
}
/** The agent's own text: without the script's status, PR and stale lines. */
function ownText(v) {
  return String(v).split('\n').filter(l => !/^(\u23f3|\u21b3 |\u26a0 Stale)/.test(l)).join('\n');
}
function headerNoteFor(kind, h) {
  const own = HEADER_NOTES[kind + '|' + h] || HEADER_NOTES[h];
  if (own) return own;
  const m = /^(.+?) \([^)]*\)$/.exec(h);
  if (m && HEADER_NOTES[m[1] + ' (*)']) return HEADER_NOTES[m[1] + ' (*)'];
  const a = aliasOf(h);
  return a ? headerNoteFor(kind, a) : '';
}
function tabKind(name) {
  if (!CFG) return '';
  if (name === CFG.RPC) return 'rpc';
  if (name === CFG.RCS) return 'rcs';
  if (name === CFG.FEEDBACK) return 'draft';
  if (name === CFG.AGENT || name === CFG.AGENT_CS) return 'agent';
  return '';
}
/** Set the head notes of every known tab. Cheap: only changed notes are written. */
function headerNotes(ss) {
  ss.getSheets().forEach(sh => {
    const kind = tabKind(sh.getName());
    if (!kind) return;
    const width = sh.getLastColumn();
    if (width < 1) return;
    const row = topRow(sh) - 1;
    const r = sh.getRange(row, 1, 1, width);
    const heads = r.getDisplayValues()[0], notes = r.getNotes()[0];
    let changed = false;
    const out = heads.map((h, i) => {
      const was = notes[i] || '';
      const want = headerNoteFor(kind, String(h).trim());
      const next = want || (was.slice(-NOTE_MARK.length) === NOTE_MARK ? '' : was);
      if (next !== was) changed = true;
      return next;
    });
    if (changed) r.setNotes([out]);
  });
}
const KEY_COLOURS = { blue: '#1f5fa8', green: '#2e7d32', orange: '#c25e00', grey: '#666666' };
const KEY_ORDER = ['blue', 'green', 'orange', 'grey'];
const KEY_LEAD_RE = /^Column colou?rs:\s*/;
const KEY_WORD_RE = /\b(blue|green|orange|grey)\b/gi;
/**
 * Which key colour a header's fill is: grey when its channels are close,
 * otherwise the strongest channel (blue, green, or red for orange). A white
 * or unfilled head has no colour.
 */
function fillGroup(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map(x => parseInt(x, 16) / 255);
  if (Math.min(r, g, b) > 0.95) return null;
  if (Math.max(r, g, b) - Math.min(r, g, b) < 0.08) return 'grey';
  return b >= r && b >= g ? 'blue' : g >= r ? 'green' : 'orange';
}
/**
 * Column names to colour in the Instructions text, each with its header's
 * key colour (owner, 2026-11-01: "make use of colors match the column
 * headers"). A people's column with initials in its head ("Contributor
 * Feedback (CL)") is also found by its bare name.
 */
function headerColours(ss) {
  const out = {};
  ss.getSheets().forEach(sh => {
    if (sh.isSheetHidden() || sh.getName() === CONFIG_TAB || sh.getLastColumn() < 1) return;
    const n = Math.min(5, sh.getLastRow());
    if (n < 1) return;
    const row = legendCount(sh.getRange(1, 1, n, 1).getDisplayValues().map(r => r[0])) + 1;
    const r = sh.getRange(row, 1, 1, sh.getLastColumn());
    const heads = r.getDisplayValues()[0], fills = r.getBackgrounds()[0];
    heads.forEach((h, i) => {
      const name = String(h).trim(), grp = fillGroup(fills[i]);
      if (!name || !grp) return;
      if (!out[name]) out[name] = grp;
      const bare = /^(.*Feedback) \((?!agent\)).*\)$/.exec(name);
      if (bare && !out[bare[1]]) out[bare[1]] = grp;
    });
  });
  return out;
}
/** [start, end, colour] runs for one Instructions text. */
function keyRuns(text, heads) {
  const runs = [];
  // A setup line (markSetup) may sit above the key: the key is then the second line.
  const at = text.indexOf(SETUP_MARK) === 0 && text.indexOf('\n') >= 0 ? text.indexOf('\n') + 1 : 0;
  const nl = text.indexOf('\n', at);
  const first = nl < 0 ? text.slice(at) : text.slice(at, nl);
  let keyEnd = 0;
  const lead = KEY_LEAD_RE.exec(first);
  if (lead) {
    // "Column colours:     your input ...     written by the agent ...": the
    // phrases in key order, no colour named.
    let p = at + lead[0].length, k = 0;
    first.slice(lead[0].length).split(/(\s{3,})/).forEach(part => {
      if (/^\s+$/.test(part)) { p += part.length; return; }
      if (part && k < KEY_ORDER.length) runs.push([p, p + part.length, KEY_COLOURS[KEY_ORDER[k++]]]);
      p += part.length;
    });
    keyEnd = at + first.length;
  } else if (/^(blue|green|orange|grey) = /i.test(first)) {
    const seg = /(blue|green|orange|grey) = .*?(?=\s{3,}|$)/gi;
    let m;
    while ((m = seg.exec(first))) runs.push([at + m.index, at + m.index + m[0].length, KEY_COLOURS[m[1].toLowerCase()]]);
    keyEnd = at + first.length;
  }
  let m;
  KEY_WORD_RE.lastIndex = keyEnd;
  while ((m = KEY_WORD_RE.exec(text))) runs.push([m.index, m.index + m[0].length, KEY_COLOURS[m[1].toLowerCase()]]);
  // Column names, longest first, whole words only, never inside a run already taken.
  const names = Object.keys(heads || {}).sort((a, b) => b.length - a.length);
  const taken = (a, z) => runs.some(([x, y]) => a < y && z > x);
  const word = ch => /[A-Za-z0-9]/.test(ch || '');
  names.forEach(name => {
    let at = text.indexOf(name, keyEnd);
    while (at >= 0) {
      const z = at + name.length;
      if (!word(text[at - 1]) && !word(text[z]) && !taken(at, z)) runs.push([at, z, KEY_COLOURS[heads[name]]]);
      at = text.indexOf(name, z);
    }
  });
  return runs.sort((a, b) => a[0] - b[0]);
}
/**
 * The Config tab's colours, kept by every refresh so a row the agent wrote
 * with the Sheets connector (which writes values, not colours) still reads
 * right (owner, 2026-10-31: "key cfg and COLS need to be grey"). The Key
 * row is a Grey header; EDITORS, the one row a person keeps, is Orange; every
 * other row below the Instructions (CFG, COLS, DATA and their continuation
 * rows) is Grey, written by the agent. The Instructions rows are left as
 * they are.
 */
const CONFIG_COLOURS = { header: '#b7b7b7', person: '#f4b26b', agent: '#efefef' };
function styleConfig(ss) {
  if (!ss) throw new Error(RUN_THIS);
  const sh = ss.getSheetByName(CONFIG_TAB);
  if (!sh) return;
  const n = sh.getLastRow();
  if (n < 1) return;
  const keys = sh.getRange(1, 1, n, 1).getDisplayValues().map(r => String(r[0]).trim());
  const start = keys.indexOf('Key');
  if (start < 0) return;
  // The Instructions rows fit their text: a row inserted next to a tall one
  // inherits its height (owner, 2026-10-31: "row too high").
  try { if (start > 0) sh.autoResizeRows(1, start); } catch (e) { /* cosmetic */ }
  keys.forEach((k, i) => {
    if (i < start || /^Instructions/.test(k)) return;
    const bg = k === 'Key' ? CONFIG_COLOURS.header : k === 'EDITORS' ? CONFIG_COLOURS.person : CONFIG_COLOURS.agent;
    const row = sh.getRange(i + 1, 1, 1, 2).setBackground(bg).setVerticalAlignment('top');
    if (k === 'Key' || k === 'EDITORS') row.setFontWeight('bold');
  });
}

function colourInstructions(ss) {
  if (!ss) throw new Error(RUN_THIS);
  const heads = headerColours(ss);
  ss.getSheets().forEach(sh => {
    const n = Math.min(5, sh.getLastRow());
    if (n < 2 || sh.getLastColumn() < 2) return;
    const h = legendCount(sh.getRange(1, 1, n, 1).getDisplayValues().map(r => r[0]));
    for (let r = 1; r <= h; r++) {
      const cell = sh.getRange(r, 2);
      const now = cell.getRichTextValue();
      const text = now ? now.getText() : '';
      const runs = keyRuns(text, heads);
      // Rewritten only when some run lacks its colour, so a refresh is cheap.
      if (!runs.length || runs.every(([a, z, c]) => {
        const st = now.getTextStyle(a, z);
        return (st.getForegroundColor() || '').toLowerCase() === c && st.isBold();
      })) continue;
      const b = SpreadsheetApp.newRichTextValue().setText(text);
      runs.forEach(([a, z, c]) => b.setTextStyle(a, z, SpreadsheetApp.newTextStyle().setForegroundColor(c).setBold(true).build()));
      const url = /https?:\/\/\S+/g;
      let u;
      while ((u = url.exec(text))) b.setLinkUrl(u.index, u.index + u[0].length, u[0]);
      cell.setRichTextValue(b.build());
    }
  });
}
/** The sheet row of the first data row, reading only column A's top cells. */
function topRow(sh) {
  const a = sh.getRange(1, 1, Math.min(5, Math.max(sh.getLastRow(), 1)), 1).getDisplayValues();
  return legendCount(a.map(r => r[0])) + 2;
}
function readSheet(sh) {
  const last = sh.getLastRow();
  const width = sh.getLastColumn();
  const values = sh.getRange(1, 1, Math.max(last, 1), width).getDisplayValues();
  const h = legendCount(values.map(r => r[0]));
  return { sh, top: h + 2, header: values[h].map(x => String(x).trim()), rows: values.slice(h + 1) };
}
/**
 * Public comment's people's columns were "Architect Feedback ..." until
 * 2026-10-31, when the owner had them named for the process role, "Committee
 * Feedback ..." (the Feedback Review Committee). A header is found under
 * either name, so a sheet works before and after its columns are renamed.
 */
const RENAMED = [['Committee Feedback', 'Architect Feedback']];
function aliasOf(name) {
  for (const [now, was] of RENAMED) {
    if (String(name).indexOf(now) >= 0) return String(name).replace(now, was);
    if (String(name).indexOf(was) >= 0) return String(name).replace(was, now);
  }
  return null;
}
/**
 * The agent's proposal columns, renamed by the owner on 2026-10-31:
 * "Contributor Feedback (agent)" is "Feedback (agent)", and the public-comment
 * "Architect Feedback (agent)" (briefly "Committee Feedback (agent)") is
 * "Change Set Feedback (agent)". Each is found under any of its names.
 */
const SAME_COLUMN = [
  ['Feedback (agent)', 'Contributor Feedback (agent)'],
  ['Change Set Feedback (agent)', 'Committee Feedback (agent)', 'Architect Feedback (agent)'],
];
function col(s, name) {
  const i = s.header.indexOf(name);
  if (i >= 0) return i;
  const same = SAME_COLUMN.filter(g => g.indexOf(name) >= 0)[0];
  if (same) {
    for (const n of same) { const j = s.header.indexOf(n); if (j >= 0) return j; }
    return -1;
  }
  const a = aliasOf(name);
  return a === null ? -1 : s.header.indexOf(a);
}
function cols(s, name) {
  const a = aliasOf(name);
  return s.header.map((h, i) => (h === name || (a !== null && h === a) ? i : -1)).filter(i => i >= 0);
}
/**
 * Columns whose header is `name` or `name (...)`, e.g. "Contributor Feedback
 * (CL)": the people's. `name (agent)` is the agent's proposal, not a
 * person's feedback, so it is left out.
 */
function colsLike(s, name) {
  const like = n => s.header.map((h, i) => ((h === n || String(h).indexOf(n + ' (') === 0) &&
    h !== n + ' (agent)' ? i : -1)).filter(i => i >= 0);
  const a = aliasOf(name);
  return like(name).concat(a === null ? [] : like(a)).sort((x, y) => x - y);
}

/** Write f(row, k) into column c: every row, or only the rows in `only`. */
function writeRows(s, c, only, f) {
  if (c < 0) return;
  if (!only) return writeRich(s, c, s.rows.map(f));
  only.forEach(k => s.sh.getRange(k + s.top, c + 1, 1, 1).setRichTextValues([[f(s.rows[k], k)]]));
}

/**
 * Text as a cell value that Sheets can never read as a formula: a leading
 * =, +, - or @ gets an apostrophe, which Sheets keeps out of the shown text.
 * Every value the script writes with setValues that a person or the agent
 * typed goes through it (security review 2026-10-31, finding F1).
 */
function asText(v) {
  const t = String(v == null ? '' : v);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

// ---------- Watch hash: one cell a watcher reads instead of the log ----------

/**
 * The headers people set on Contributor Feedback (Blue and Orange). Tool
 * review-log-watch watches the same ones (watch.ts watchedHeader).
 */
function watchedHeader_(h) {
  return h === 'Title' || h === 'Selected Sections' || h === 'Disposition' || h === CS_HUMAN ||
    h === 'Ready for agent' || h === 'Ready for merge' || h === 'Dispositions confirmed' ||
    (h.indexOf('Contributor Feedback') === 0 && h !== 'Contributor Feedback (agent)');
}

/**
 * Public comment's person-set cells, one line each (owner, 2026-11-04): on
 * Review Change Sets Title, TWG (CS), every Committee Feedback column, Ready
 * for agent, Dispositions confirmed, Ready for merge and Change Set (human);
 * on Review Public Comments every Committee Feedback column, Disposition,
 * Change Set (human) and TWG (human). A line is keyed by its row's
 * Change-set id or comment No., and the lines are sorted, so a row someone
 * inserts changes nothing; a row with neither is keyed by its place.
 */
function pcWatchLines_(ss) {
  const lines = [];
  [[CFG.RCS, 'Change-set', ['Title', 'TWG (CS)', 'Ready for agent', CONFIRMED, 'Ready for merge', CS_HUMAN]],
    [CFG.RPC, COLS.rpc.no, [COLS.rpc.disposition || 'Disposition', CS_HUMAN, 'TWG (human)']]].forEach(([name, key, heads]) => {
    const s = readSheet(ss.getSheetByName(name));
    const kc = col(s, key);
    const cs = heads.map(h => col(s, h)).concat(colsLike(s, 'Committee Feedback')).filter((c, i, a) => c >= 0 && a.indexOf(c) === i);
    s.rows.forEach((r, k) => {
      const id = kc >= 0 ? String(r[kc]).trim() : '';
      cs.forEach(c => {
        const v = String(r[c] == null ? '' : r[c]).trim();
        if (v) lines.push(name + '|' + (id || '#' + k) + ':' + s.header[c] + '=' + v);
      });
    });
  });
  return lines.sort();
}

/**
 * Write a hash of every non-empty person-set cell to the hidden Watch tab, F1
 * "Cells hash" and G1 the hash, H1 "Checked (UTC)" and I1 when: Contributor
 * Feedback's on a drafting sheet, Review Change Sets' and Review Public
 * Comments' on a public-comment one (pcWatchLines_). A review-log watcher
 * reads Watch!F1:I1 and the Issue column on each poll, instead of the whole
 * log, and passes the hash to Tool review-log-watch (`--sheet-hash`); a
 * different hash means a person changed something (owner, 2026-11-01,
 * Q-WATCH4 A). Columns A to D are left to any other Watch writer. Never stops
 * the refresh.
 */
function writeWatchHash(ss) {
  try {
    const lines = DRAFTING ? [] : pcWatchLines_(ss);
    if (DRAFTING) {
      const s = readSheet(ss.getSheetByName(CFG.FEEDBACK));
      s.rows.forEach((r, k) => s.header.forEach((h, c) => {
        const v = String(r[c] == null ? '' : r[c]).trim();
        if (v && watchedHeader_(String(h).trim())) lines.push(k + ':' + String(h).trim() + '=' + v);
      }));
    }
    let sh = ss.getSheetByName('Watch');
    if (!sh) { sh = ss.insertSheet('Watch'); sh.hideSheet(); }
    const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z';
    sh.getRange(1, 6, 1, 4).setValues([['Cells hash', hashOf(lines.join('\n')), 'Checked (UTC)', now]]);
  } catch (err) {
    // A Watch tab that cannot be written must never stop the refresh.
  }
}

/** A string inside a formula's double quotes: each " doubled (finding F2). */
function q(v) { return String(v).replace(/"/g, '""'); }

/** A short hash of a string (djb2), to notice a change without keeping the text. */
function hashOf(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (Math.imul(h, 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * What an agent proposal was written against: a hash of the row's blue
 * (people's) cells, by header: those in `exact`, and every `prefix` or
 * `prefix (...)` column but `prefix (agent)`. Picks are compared bare, so a
 * tree mark the script adds is no change. feedback-issue.ts feedbackBasis
 * computes the same hash for the agent, which keeps it in the Agent tab's
 * Feedback basis (change set).
 *
 * Empty cells are left out, so adding an empty column (a new reviewer's
 * initials) changes no row's basis. Returns that hash first, then the older
 * one that kept empty cells, so a basis an agent wrote before the change still
 * matches until it next writes one.
 *
 * A basis written as "2:<hash>" also covers the row's grey content columns
 * (basisGrey), so a change to the comments a change set joins marks its
 * proposal stale too (owner, 2026-10-31: "changed blue human (or mechanical
 * grey) content"). `written` is the stored basis: its form says which hash
 * to compare with, so old bases keep matching until the agent rewrites them.
 */
function basisOf(header, row, exact, prefix, written) {
  const v2 = /^2:/.test(String(written || ''));
  if (v2) exact = exact.concat(basisGrey());
  const parts = [], legacy = [];
  header.forEach((h, i) => {
    let v = String(row[i] == null ? '' : row[i]).trim();
    if (h === 'Selected Sections') v = v.split(',').map(bareName).filter(Boolean).join(',');
    const alt = aliasOf(prefix);
    const isFb = p => p !== null && (h === p || h.indexOf(p + ' (') === 0) && h !== p + ' (agent)';
    if (exact.indexOf(h) >= 0 || isFb(prefix) || isFb(alt)) {
      legacy.push(h + '=' + v);
      if (v) parts.push(h + '=' + v);
    }
  });
  const pfx = v2 ? '2:' : '';
  // A basis written before a rename (RENAMED) names the columns the old way.
  const was = t => t.map(x => { const a = aliasOf(x.split('=')[0]); return a === null || x.indexOf('Committee') !== 0 ? x : a + x.slice(x.indexOf('=')); });
  return [pfx + hashOf(parts.join('\n')), pfx + hashOf(legacy.join('\n')), pfx + hashOf(was(parts).join('\n')), pfx + hashOf(was(legacy).join('\n'))];
}

/**
 * The grey (mechanical) content columns a proposal also rests on: in a
 * public-comment sheet, what Review Change Sets joins from its comments.
 * Not the agent's own columns (Agentic status, Staging review page), so the
 * agent's writes never make its proposals stale.
 */
function basisGrey() {
  if (DRAFTING) return [];
  const c = COLS.rcs;
  return [c.sections, c.pages, c.comments, c.revisions, c.feedback, c.dispositions, 'TWG (PCs)'].filter(Boolean);
}

/** "2026-10-30 22:30Z" (or ISO) -> ms, or NaN. */
function utcMs(t) {
  return Date.parse(String(t).trim().replace(' ', 'T').replace(/(\d)$/, '$1Z'));
}

/**
 * The Staging review page cell: a "review" link to the change set's preview,
 * marked stale when a PR of the change set was completed after the preview
 * was built (Agent: Agent completed vs Staging built). Without a build time
 * nothing is claimed either way.
 */
function stagingCell(url, built, prs, readyAt, disp) {
  const w = stagingWarning(url, built, prs, readyAt);
  const dl = disp ? [{ t: '\n\u26a0 ' + disp + ': not ready for merge', bold: true }] : [];
  if (!url) return rich((w ? [{ t: w, bold: true }] : []).concat(w ? dl : []));
  // No link until Pages has deployed it (owner, 2026-11-01: a review link
  // that answered 404 "so user is confused"). The agent reads the Pages
  // deployment through the GitHub API and writes Staging deploy; the script
  // needs no internet access, so it trusts that value: building, on gh-pages
  // or deploying shows the stage with no link, deployed shows the link.
  const stage = deployStage((built || {}).deploy);
  if (stage) return rich([{ t: '\u23f3 Preview not live yet: ' + stage + '. The link appears when Pages has deployed it.', bold: true }].concat(dl));
  // The staging QA report beside the preview (owner, 2026-10-31: "sheets
  // should link to QA reports for the staging"), then the QA gate.
  // "QA report" opens the viewer: the preview's review page, at its
  // per-section QA table (owner, 2026-10-31: "i thought there was a viewer
  // page"); "files" is the raw qa-reports entry the QA gate reads.
  const view = /\/review\/?$/.test(url) ? url.replace(/\/?$/, '/') + '#heat' : '';
  const qa = built && built.qa ? (view ? [{ t: ' \u00b7 ' }, { t: 'QA report', url: view }, { t: ' (' }, { t: 'files', url: built.qa }, { t: ')' }]
    : [{ t: ' \u00b7 ' }, { t: 'QA report', url: built.qa }]) : [];
  const gate = qaGate(built, prs).text;
  return rich([{ t: 'review', url: url }].concat(qa, w ? [{ t: ' ' + w, bold: true }] : [],
    gate ? [{ t: '\n' + gate, bold: !/^\u2713/.test(gate) }] : [], dl));
}

/**
 * Why the preview cannot be trusted, or '' (owner, 2026-10-31: "Staging
 * Review column should show warning when stale"). The agent checks GitHub and
 * writes what it found on the Agent tab; the script only compares, so it
 * needs no internet access:
 *   - PR head (change set): each PR's latest commit, one per line;
 *   - Staging built from (change set): the commit the preview was built from,
 *     as its gh-pages commit records it ("staging(slug): from <sha>");
 *   - Staging deploy (change set): the Pages deploy of that commit, deployed,
 *     pending or failed.
 * The active PR is the last one listed (one branch, one active PR per row).
 * Without those columns it falls back to times: Agent completed later than
 * Staging built.
 */
function stagingWarning(url, built, prs, readyAt) {
  const b = built || {};
  const active = (prs || []).filter(p => p.head).slice(-1)[0];
  if (!url) return active ? '\u26a0 no preview yet: not ready for merge' : '';
  const deploy = String(b.deploy || '').toLowerCase();
  if (/fail|error/.test(deploy)) return '\u26a0 deploy failed';
  const stage = deployStage(deploy);
  if (active && b.from) {
    const n = Math.min(active.head.length, b.from.length, 40);
    if (n >= 7 && active.head.slice(0, n).toLowerCase() !== b.from.slice(0, n).toLowerCase())
      return '\u26a0 stale: built from ' + b.from.slice(0, 7) + ', PR now at ' + active.head.slice(0, 7) +
        (stage ? '; restaging: ' + stage : '');
  }
  if (stage) return '\u26a0 stale, restaging: ' + stage;
  const at = utcMs(b.at);
  // An Editor sent the row back to the agent after this preview was built:
  // the PR is about to change, so the preview no longer shows the agreed text.
  if (readyAt && !isNaN(at) && utcMs(readyAt) > at)
    return '\u26a0 missing feedback from ' + readyAt;
  const done = (prs || []).map(p => utcMs(p.done)).filter(x => !isNaN(x));
  if (!isNaN(at) && !(active && b.from) && done.some(x => x > at))
    return '\u26a0 stale: built ' + String(b.at).trim() + ', PR changed since';
  return '';
}
/**
 * Where a restage is, from the agent's Staging deploy value (owner,
 * 2026-10-31: "update stages of gh-pages deployment (merge to gh-pages,
 * waiting for deploy, deployed)"). The agent records each stage as it
 * happens: building, pushed (on gh-pages), deploying, deployed or failed;
 * "pending" is read as deploying. '' when deployed or unknown.
 */
function deployStage(deploy) {
  const d = String(deploy || '').toLowerCase();
  // The agent may add when it expects the preview live, from recent runs
  // (owner, 2026-10-31: "also expected time of gh-page deployment"):
  // "building, expected 2026-10-31 15:20Z".
  const e = String(deploy || '').match(/expected[^0-9]*((?:\d{4}-\d\d-\d\d )?\d\d:\d\dZ)/i);
  const by = e ? ', expected live ' + e[1].toUpperCase() : '';
  if (/build/.test(d)) return 'building the preview' + by;
  if (/push|gh-pages|merged|queue|wait/.test(d)) return 'on gh-pages, waiting for Pages to deploy' + by;
  if (/pend|progress|deploying/.test(d)) return 'Pages is deploying it' + by;
  return '';
}
/** A change set with a PR whose head the agent recorded, and so owes a preview. */
function awaitsPreview(prs) { return (prs || []).some(p => p.head); }
function builtInfo(r, at, from, deploy, gate, qa, step) {
  const v = c => (c >= 0 && c !== undefined ? String(r[c]).trim() : '');
  return { at: v(at), from: v(from), deploy: v(deploy), gate: v(gate), qa: (v(qa).match(/https:\/\/\S+/) || [''])[0], step: v(step) };
}

/**
 * Where the agent is, kept on the \u23f3 line for as long as it is there (owner,
 * 2026-10-31: "i dont see a state change indication on where agent is in
 * process (thinking? writing PR? trying to render? what?)"). The agent writes
 * "Agent step (change set)" at every move, with `agent-record.ts step <name>`
 * so the time comes from the clock: "<step> <YYYY-MM-DD HH:MMZ>". The steps
 * are a fixed list, one per task of contributor-feedback.bpmn and
 * public-comment.bpmn the agent performs.
 */
const AGENT_STEP = 'Agent step (change set)';
const AGENT_STEPS = {
  reading: 'reading the feedback',
  proposing: 'writing its proposal',
  editing: 'editing the document',
  pushing: 'pushing the pull request',
  staging: 'building the preview',
  deploying: 'waiting for the preview to go live',
  'qa-review': 'waiting for the independent QA review',
  merging: 'merging the pull request',
  proposed: 'proposal ready',
  idle: '',
};
/**
 * When the agent last finished a pass: its latest Agent completed, or a later
 * "idle" or "proposed" step, which also says it stopped (owner, 2026-10-31:
 * "make sure process works \u2026 so it doesnt fail again"). NaN when neither.
 */
function lastFinished(prs, stepCell) {
  const t = (prs || []).map(p => utcMs(p.done)).filter(x => !isNaN(x));
  const m = String(stepCell || '').trim().match(/^(idle|proposed)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z)$/i);
  if (m) t.push(utcMs(m[2]));
  return t.length ? Math.max.apply(null, t) : NaN;
}
/** Minutes after Ready for agent with no step before the row warns that no agent has it. */
const PICKUP_MIN = 20;
function unpicked(readyAt, now) {
  const age = Math.round(((now || Date.now()) - utcMs(readyAt)) / 60000);
  return age > PICKUP_MIN ? '; \u26a0 no agent has picked this up for ' + age + ' min: ask in the project chat' : '';
}
/** "editing 2026-10-31 17:20Z" -> { name, text, at }, or null. */
function agentStep(cell) {
  const m = String(cell || '').trim().match(/^([a-z-]+)\s+(\d{4}-\d{2}-\d{2} \d{2}:\d{2}Z)$/i);
  if (!m || !(m[1].toLowerCase() in AGENT_STEPS) || !AGENT_STEPS[m[1].toLowerCase()]) return null;
  return { name: m[1].toLowerCase(), text: AGENT_STEPS[m[1].toLowerCase()], at: m[2] };
}
/**
 * "today 17:47Z", "yesterday 17:47Z", or "3 days ago, 2026-10-28 17:47Z"
 * (owner, 2026-10-31: "today/yesterday > 1 days ago"). Days are UTC days.
 */
function whenLabel(at, now) {
  const day = ms => Math.floor(ms / 86400000);
  const n = day(now || Date.now()) - day(utcMs(at)), hm = String(at).slice(11);
  return n <= 0 ? 'today ' + hm : n === 1 ? 'yesterday ' + hm : n + ' days ago, ' + at;
}
/** The step line: "Agent: editing the document (since 17:20Z)", with a warning once it has gone quiet. */
function stepLine(step, now) {
  if (step.name === 'proposed')
    return PROGRESS + 'Proposal ready (' + whenLabel(step.at, now) + '): set Ready for agent to Yes to start, or answer in your feedback.';
  const age = Math.round(((now || Date.now()) - utcMs(step.at)) / 60000);
  return PROGRESS + 'Agent: ' + step.text + ' (since ' + whenLabel(step.at, now) +
    (age > 30 ? '; \u26a0 no update for ' + age + ' min' : '') + ').';
}
/** Add the Agent step column at the END of the agent's change-set tab, inside the locked run. */
function ensureAgentStepColumn(sh) {
  if (!sh) return;
  const s = readSheet(sh);
  if (s.header.indexOf(AGENT_STEP) >= 0) return;
  const c = s.header.length + 1;
  if (sh.getMaxColumns() < c) sh.insertColumnAfter(c - 1);
  sh.getRange(s.top - 1, c - 1).copyTo(sh.getRange(s.top - 1, c), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  sh.getRange(s.top - 1, c).setValue(AGENT_STEP);
}

/**
 * The QA gate: an independent review of the change set before Ready for merge
 * (owner, 2026-10-31: "agent should make sure all dispositions are consistent
 * with human and feature branch changes. add review (agent-independent)
 * before ready for merge", then "QA gate"). A reviewer that did not write the
 * pull request (another agent session, or a person) checks every disposition
 * line against the people's Blue Disposition and against the PR's diff, and
 * reads the staging QA report, then writes QA gate (change set) on the Agent
 * tab, first line "Passed <PR head sha>: \u2026" or "Failed <PR head sha>: <why>".
 * The script only compares: a pass for an older commit than the PR's head is
 * stale. Returns { ok, text }; text is '' when there is no PR to gate.
 */
function qaGate(built, prs) {
  const g = String((built || {}).gate || '').trim();
  const active = (prs || []).filter(p => p.head).slice(-1)[0];
  if (!active) return { ok: false, text: '' };
  const not = ': not ready for merge';
  if (!g) return { ok: false, text: '\u26a0 QA gate: no independent review yet' + not };
  const first = g.split('\n')[0].trim();
  const m = /^(pass|fail)\w*\s*:?\s*([0-9a-f]{7,40})?\b\s*:?\s*(.*)$/i.exec(first);
  if (!m) return { ok: false, text: '\u26a0 QA gate unreadable ("' + first.slice(0, 40) + '")' + not };
  const sha = (m[2] || '').toLowerCase(), head = active.head.toLowerCase();
  if (/^fail/i.test(m[1])) return { ok: false, text: '\u26a0 QA gate failed' + (m[3] ? ': ' + m[3] : '') };
  if (!sha) return { ok: false, text: '\u26a0 QA gate passed but names no commit' + not };
  const n = Math.min(sha.length, head.length);
  if (sha.slice(0, n) !== head.slice(0, n))
    return { ok: false, text: '\u26a0 QA gate stale: reviewed ' + sha.slice(0, 7) + ', PR now at ' + head.slice(0, 7) + not };
  return { ok: true, text: '\u2713 QA gate passed (' + sha.slice(0, 7) + ')' };
}

/** Flag the agent's proposal (column `agentName`) of each row whose basis moved on. */
function markStale(s, csCol, basisOfCs, exact, prefix, agentName, lineOf, want) {
  const ag = col(s, agentName);
  if (ag < 0 || csCol < 0) return;
  s.rows.forEach((r, k) => {
    if (want && !want(k)) return;
    const cs = String(r[csCol]).trim();
    const w = basisOfCs[cs];
    const t = staleText(r[ag], basisOf(s.header, r, exact, prefix, w), w);
    const cur = t === null ? String(r[ag]) : t;
    const L0 = lineOf && Object.prototype.hasOwnProperty.call(lineOf, cs) ? lineOf[cs] : undefined;
    const L = L0 === undefined ? L0 : askChecked(L0, cur);
    const fin = L !== undefined ? withProgress(cur, L) : cur;
    // Read the cell's links before a plain write wipes them (owner, 2026-11-01: "Dont know where link is").
    const kept = keptLinks(linkRuns(s.sh.getRange(k + s.top, ag + 1, 1, 1)), fin);
    if (fin !== String(r[ag])) s.sh.getRange(k + s.top, ag + 1, 1, 1).setValues([[asText(fin)]]);
    unready(s, r, k, r[ag], t);
    // Where the status block landed: after a stale mark, and after a review ask askFirst may put first.
    const off = L && typeof L === 'object' && L.text ? Math.max(0, fin.indexOf(L.text)) : 0;
    const own = L && typeof L === 'object' ? L.links.map(x => [x[0] + off, x[1] + off, x[2]]) : [];
    const links = own.concat(kept.filter(([a, z]) => !own.some(([b, y]) => a < y && b < z)));
    markDecision(s.sh.getRange(k + s.top, ag + 1, 1, 1), fin, links.concat(autoLinks(fin, links)));
  });
}

/**
 * Where the change set is, as one line the script keeps at the top of the
 * agent's feedback (below a stale mark), starting with PROGRESS (owner,
 * 2026-10-31: "agent feedback should also try to say where it is in
 * producing PR / staging", and an Editor's Orange change adds a note rather
 * than marking the proposal stale). The agent never writes this line.
 */
const PROGRESS = '\u23f3 ';
/**
 * The change set's Dispositions: one blurb, written by the agent on the Agent
 * tab before the preview is staged, describing every disposition in the
 * change set. It is the summary used once Ready for merge is Yes: in the
 * merge and when the change set's issue is closed (owner, 2026-10-31). The
 * script shows it, read-only, wherever the people's tab has the column.
 */
const QA_GATE = 'QA gate (change set)', QA_REPORT = 'QA report (change set)';
const DISPOSITIONS_CS = 'Disposition (change set)', DISPOSITIONS_AGENT = 'Disposition (agent)';
/**
 * The record's structure (owner, 2026-10-31: "enforce more structured
 * Disposition (change set), so each PC is given a disposition"; "can also
 * be an overall disposition statement without reference to a PC"). Lines:
 *   Decided (Q1, 2026-10-31): A, by the Editor; <what it means>
 *   Overall: <a statement for the whole change set>        (optional)
 *   No. 136: Accepted. <what was done>
 *   Nos. 127 to 135, 138 and 139: Not accepted. <why>
 * Each comment of the change set needs exactly one disposition, from
 * DISPOSITION_WORDS. Returns the problems, one line each ('' when none).
 */
const DISPOSITION_WORDS = ['Accepted', 'Partially accepted', 'Not accepted', 'Noted', 'Deferred', 'Duplicate', 'Out of scope', 'Withdrawn'];
/**
 * "Dispositions confirmed" on Review Change Sets (owner, 2026-10-31: "make
 * orange column ... of the PCs", "put to left of ready for merge"). Multi-select
 * over every comment number was greyed out (the list is too long), so the
 * owner chose option A: Yes or No per change set. Yes confirms every agent
 * disposition in the set; to differ on one comment, the committee sets that
 * comment's own Disposition, and a mismatch is flagged. Numbers typed in the
 * cell ("No. 327") still confirm just those comments.
 */
const CONFIRMED = 'Dispositions confirmed', CONFIRM_CHOICES = ['Yes', 'No'];
function confirmedNos(value, nos) {
  const v = String(value || '').trim();
  if (/^(yes|all)$/i.test(v) || /(^|,)\s*all\s*(,|$)/i.test(v)) return (nos || []).map(String);
  return (v.match(/\d+/g) || []).map(String);
}
function ensureConfirmedColumn(ss) {
  const sh = ss.getSheetByName(CFG.RCS);
  if (!sh) return;
  // The first version kept a long list on a hidden Lists tab: no longer used.
  const old = ss.getSheetByName('Lists');
  if (old && old.isSheetHidden()) ss.deleteSheet(old);
  const s = readSheet(sh);
  let c = s.header.indexOf(CONFIRMED);
  const rows = sh.getMaxRows() - s.top + 1;
  if (c < 0) {
    const m = s.header.indexOf('Ready for merge');
    if (m < 0) return;
    sh.insertColumnBefore(m + 1);
    sh.getRange(s.top - 1, m + 2, rows + 1, 1).copyTo(sh.getRange(s.top - 1, m + 1, rows + 1, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sh.getRange(s.top - 1, m + 1).setValue(CONFIRMED);
    sh.setColumnWidth(m + 1, 120);
    c = m;
  }
  const cells = sh.getRange(s.top, c + 1, rows, 1);
  const rule = cells.getCell(1, 1).getDataValidation();
  const vals = rule ? rule.getCriteriaValues() : [];
  if (!rule || rule.getCriteriaType() !== SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST || String(vals[0]) !== String(CONFIRM_CHOICES))
    cells.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(CONFIRM_CHOICES, true).setAllowInvalid(true).build());
}
function dispositionProblems(text, nos, human, confirmed) {
  const want = (nos || []).map(String), seen = {}, out = [];
  const words = new RegExp('^(' + DISPOSITION_WORDS.join('|') + ')\\b', 'i');
  String(text || '').split('\n').forEach(line => {
    const m = line.match(/^\s*Nos?\.\s*([^:]+):\s*(.*)$/);
    if (!m) return;
    const got = [];
    m[1].replace(/(\d+)\s*(?:to|-|\u2013)\s*(\d+)|(\d+)/g, (_, a, z, one) => {
      if (one) got.push(one);
      else for (let n = +a; n <= +z && n - +a < 1000; n++) got.push(String(n));
      return '';
    });
    const w = m[2].match(words);
    if (!w) out.push('\u26a0 No. ' + got.join(', ') + ': start with one of ' + DISPOSITION_WORDS.join(', '));
    got.forEach(n => {
      // The agent drafts from the people's Blue Disposition (owner,
      // 2026-10-31: "agent should draw from human blue dispositions"); a
      // different word is shown, never corrected.
      const h = String((human || {})[n] || '').trim();
      if (w && h && !/^pending$/i.test(h) && h.toLowerCase() !== w[1].toLowerCase())
        out.push('\u26a0 No. ' + n + ': ' + w[1] + ' here, ' + h + ' in the people\'s Disposition');
      if (want.length && want.indexOf(n) < 0) out.push('\u26a0 No. ' + n + ' is not in this change set');
      else if (seen[n]) out.push('\u26a0 No. ' + n + ' has two dispositions');
      seen[n] = true;
    });
  });
  const missing = want.filter(n => !seen[n]).sort((x, y) => x - y);
  // The agent's word is a proposal until the committee records its own
  // (owner, 2026-10-31, option A: "Flag and block merge").
  const hasHuman = human && Object.keys(human).length > 0;
  // An Editor may confirm the agent's word in bulk in "Dispositions
  // confirmed" (owner, 2026-10-31: "make orange column that contains list
  // multiselect of the PCs").
  const ok = (confirmed || []).map(String);
  ok.filter(n => want.length && want.indexOf(n) < 0).forEach(n => out.push('\u26a0 No. ' + n + ' is confirmed but is not in this change set'));
  const unconfirmed = hasHuman ? want.filter(n => ok.indexOf(n) < 0 && !/\S/.test(String(human[n] || '').replace(/^pending$/i, ''))) : [];
  if (unconfirmed.length) out.unshift('\u26a0 Not confirmed by the committee (Disposition still Pending): ' + nosText(unconfirmed));
  if (missing.length) out.unshift('\u26a0 No disposition yet for ' + nosText(missing));
  return out.join('\n');
}
/** The Disposition (agent) cell: the problems in bold above the agent's record. */
/** "No. 136" or "Nos. 127 to 131, 134 and 135": the form the agent writes, too. */
function nosText(nos) {
  const n = nos.map(Number).filter(x => !isNaN(x)).sort((a, b) => a - b).filter((x, i, a) => !i || x !== a[i - 1]);
  const parts = [];
  for (let i = 0; i < n.length;) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    if (j - i >= 2) parts.push(n[i] + ' to ' + n[j]);
    else for (let k = i; k <= j; k++) parts.push(String(n[k]));
    i = j + 1;
  }
  return (n.length > 1 ? 'Nos. ' : 'No. ') + (parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || '');
}
function dispositionCell(text, nos, human, confirmed) {
  // An empty cell still says which comments have no disposition (owner,
  // 2026-10-31: "make sure ... mechanical 'this PC has no disposition' is shown").
  if (!String(text || '').trim())
    return rich((nos || []).length ? [{ t: '\u26a0 No disposition yet for ' + nosText(nos), bold: true }] : [{ t: '' }]);
  const p = dispositionProblems(text, nos, human, confirmed);
  // Comment numbers in bold, as elsewhere on the sheet (owner, 2026-10-31:
  // "Nos of PCs should be bolded like in other parts of sheet").
  const body = [];
  String(text).split('\n').forEach((line, i) => {
    if (i) body.push({ t: '\n' });
    // The structure stands out: the label, then the disposition word.
    const m = line.match(/^(\s*(?:Nos?\.\s*[^:]+|Overall|Decided\s*\([^)]*\)):)(.*)$/);
    if (!m) { body.push({ t: line }); return; }
    body.push({ t: m[1], bold: true });
    const w = m[2].match(new RegExp('^(\\s*)(' + DISPOSITION_WORDS.join('|') + ')\\b(.*)$', 'i'));
    if (w && !/^\s*Decided/.test(m[1])) body.push({ t: w[1] }, { t: w[2], bold: true }, { t: w[3] });
    else body.push({ t: m[2] });
  });
  return rich(p ? [{ t: p, bold: true }, { t: '\n' }].concat(body) : body);
}
function progressLine(o) {
  const prs = o.prs || [];
  const active = prs.slice(-1)[0];
  const label = active ? prLabel(active.url) : '';
  if (/merged/i.test(o.status || '')) return '';
  // A question for a person comes first: nothing moves until it is answered.
  if (/needs/i.test(o.status || '')) return PROGRESS + 'Needs you: answer the Decision needed below, then set Ready for agent to Yes.';
  // A revert, a split or a committee review is said as it is, not as "open".
  if (/revert|split|committee/i.test(o.status || '')) return PROGRESS + String(o.status).trim() + '.';
  const step = agentStep(o.built && o.built.step);
  if (step && (step.name === 'merging' || !o.merge)) {
    const dones = prs.map(p => utcMs(p.done)).filter(x => !isNaN(x));
    const lastDone = dones.length ? Math.max.apply(null, dones) : -Infinity;
    if (utcMs(step.at) >= lastDone && (!o.readyAt || utcMs(step.at) >= utcMs(o.readyAt))) return stepLine(step);
  }
  if (o.merge && active) {
    const g = qaGate(o.built, prs);
    const wait = [g.ok || !g.text ? '' : 'the QA gate passes (' + g.text.replace(/^\u26a0\s*/, '') + ')',
      o.disp ? 'every disposition is complete and confirmed by the committee' : ''].filter(Boolean);
    return PROGRESS + 'Ready for merge set: ' + (!wait.length ? 'the agent will merge ' + label + '.'
      : 'the agent will not merge ' + label + ' until ' + wait.join(' and ') + '.');
  }
  const last = lastFinished(prs, o.built && o.built.step);
  if (o.readyAt && !/working/i.test(o.status || '') && (isNaN(last) || utcMs(o.readyAt) > last))
    return PROGRESS + 'Ready for agent set ' + o.readyAt + ': the agent will act on this and rewrite it' + unpicked(o.readyAt, o.now) + '.';
  if (/working/i.test(o.status || '')) return PROGRESS + 'The agent is working on ' + (label || 'the pull request') + '.';
  if (!active) return '';
  const w = stagingWarning(o.staging, o.built, prs, o.readyAt);
  const preview = !o.staging ? 'no preview yet' : w ? 'preview ' + w.replace(/^\u26a0\s*/, '') : 'preview current' + (o.built && o.built.at ? ' (built ' + o.built.at + ')' : '');
  return PROGRESS + label + ' open' + (active.done ? ', updated ' + active.done : '') + '; ' + preview + '.';
}

/**
 * The status block on top of the agent's feedback when the sheet has no
 * Agentic status column (owner, 2026-10-31: "One column, status on top"):
 * the \u23f3 line, then one "\u21b3 " line per pull request, linked, and the ask when
 * people must answer. Returns { text, links } with links relative to it.
 */
const STATUS_SUB = '\u21b3 ';
function statusBlock(line, status, prs) {
  const parts = [];
  if (line) parts.push({ t: line });
  if (/needs human/i.test(status || '')) parts.push({ t: STATUS_SUB + NEEDS_YOU + ': under "Decision needed" below. Write your answer (the letter) in your feedback column, then an Editor sets Ready for agent to Yes.' });
  (prs || []).forEach(p => {
    parts.push({ t: STATUS_SUB }, { t: prLabel(p.url), url: p.url },
      { t: ' (' + [status, p.done].filter(Boolean).join(', ') + ')' + (p.desc ? descText(p.desc) : '') });
  });
  let text = '';
  const links = [];
  parts.forEach((p, i) => {
    if (i && p.t.indexOf(STATUS_SUB) === 0 || i && p.t === STATUS_SUB) text += '\n';
    if (p.url) links.push([text.length, text.length + p.t.length, p.url]);
    text += p.t;
  });
  return { text: text, links: links };
}
/**
 * "Needs you" only when there is a question to answer (owner, 2026-11-01:
 * "these feedback are not at all clear what agent asking contributors to
 * respond about"; Q-FBK-1 A). Without a Decision needed block in the cell,
 * the Needs you status line and the "\u21b3 Needs you" line go, the PR lines stay
 * with their links, and askFirst adds the review ask. The watcher's lint
 * (tools/review-log-watch/lint.ts) flags the row so the agent writes the
 * question or clears the status.
 */
function hasAsk(text) {
  return /(^|\n)Decision needed\b[^\n]*:/.test(String(text || ''));
}
function askChecked(line, text) {
  const t = line && typeof line === 'object' ? line.text : String(line || '');
  if (t.indexOf('Needs you') < 0 || hasAsk(text)) return line;
  const kept = t.split('\n')
    .filter((l, i) => !(i === 0 && l.indexOf(PROGRESS + 'Needs you') === 0))
    .filter(l => l.indexOf(STATUS_SUB + NEEDS_YOU) !== 0);
  return line && typeof line === 'object' ? reLink(t, kept.join('\n'), line.links) : kept.join('\n');
}
/** Move each link [a, z, url] of `from` to where its text sits in `to` (links are on PR labels, which stay). */
function reLink(from, to, links) {
  let at = 0;
  const moved = [];
  links.forEach(([a, z, u]) => {
    const i = to.indexOf(from.slice(a, z), at);
    if (i >= 0) { moved.push([i, i + (z - a), u]); at = i + (z - a); }
  });
  return { text: to, links: moved };
}
/**
 * Where to review (owner, 2026-11-01: "google sheet feedback from agent needs
 * links ... hard to see where to review. agents did not make use of selected
 * sections"; Q-FBK-3). One "\u21b3 Where to review:" line under the status, each
 * Selected Section linked to its place on the change set's preview while
 * there is one, else on the published draft. With no section picked it says
 * so, and the agent asks which (skill review-sheet-script).
 */
function previewSection(url, staging) {
  const st = /^(.*\/STAGING\/[^/]+\/)/.exec(String(staging || ''));
  const se = /^(https?:\/\/[^/]+\/[^/]+\/)(.*)$/.exec(String(url || ''));
  return st && se && st[1].indexOf(se[1]) === 0 ? st[1] + se[2] : url;
}
function whereLine(picked, tocUrl, staging) {
  const names = picked.filter(n => tocUrl[n]);
  if (!names.length) return { text: STATUS_SUB + '\u26a0 No section selected: pick them in Selected Sections so the agent knows where to work.', links: [] };
  let text = STATUS_SUB + 'Where to review' + (staging ? ' (preview)' : '') + ': ';
  const links = [];
  names.forEach((n, i) => {
    if (i) text += ' \u00b7 ';
    links.push([text.length, text.length + n.length, previewSection(tocUrl[n], staging)]);
    text += n;
  });
  return { text: text, links: links };
}
/**
 * The Where to review line for a row, or null. A finished row (closed,
 * merged, reverted, withdrawn) with no section picked gets none: nothing is
 * left to review there, and the warning was noise on the DTH-HRH log's
 * closed re-pin rows (owner, 2026-11-02: after pasting the new Code.gs).
 */
function whereFor(picked, tocUrl, staging, status) {
  const finished = /closed|merged|reverted|withdrawn/i.test(String(status || ''));
  if (finished && !picked.some(n => tocUrl[n])) return null;
  return whereLine(picked, tocUrl, staging);
}
function withWhere(line, where) {
  const l = line && typeof line === 'object' ? line : { text: String(line || ''), links: [] };
  if (!l.text) return where;
  const off = l.text.length + 1;
  return { text: l.text + '\n' + where.text, links: l.links.concat(where.links.map(([a, z, u]) => [a + off, z + off, u])) };
}
/**
 * Every "repo#n" in the agent's feedback becomes a link (owner, 2026-11-01:
 * "needs links"). The owner comes from REPO_URL; GitHub sends /issues/n on
 * to the pull request when n is one.
 */
function autoLinks(text, taken) {
  const m0 = /github\.com\/([^/\s]+)\//.exec(String((typeof CFG !== 'undefined' && CFG && CFG.REPO_URL) || ''));
  if (!m0) return [];
  const out = [], re = /\b([a-z0-9][\w.-]*)#(\d+)\b/gi;
  let m;
  while ((m = re.exec(String(text)))) {
    const a = m.index, z = a + m[0].length;
    if ((taken || []).some(([x, y]) => a < y && z > x)) continue;
    out.push([a, z, 'https://github.com/' + m0[1] + '/' + m[1] + '/issues/' + m[2]]);
  }
  return out;
}
/** The text with its status (progress line, or block) replaced, or removed when line is ''. */
function withProgress(text, line) {
  const t = String(text);
  const l = line && typeof line === 'object' ? line.text : line;
  if (!t.trim()) return l && typeof line === 'object' ? l : t;
  const lines = t.split('\n');
  const stale = lines[0] === STALE ? [lines.shift()] : [];
  while (lines.length && (lines[0].indexOf(PROGRESS) === 0 || lines[0].indexOf(STATUS_SUB) === 0)) lines.shift();
  return stale.concat(askFirst(l, lines), lines).join('\n');
}

/**
 * The ask comes first, and says exactly what to answer (owner, 2026-11-01:
 * "these feedback are not at all clear what agent asking contributors to
 * respond about"). A "Decision needed" status line stays only when the cell
 * has a Decision needed block; a bare proposal gets the review ask.
 */
const ASK_PROPOSAL = 'Please review: do you agree with the proposed direction below? Write yes, or what to change, in your feedback column. Then an Editor sets Ready for agent to Yes.';
function askFirst(l, lines) {
  const body = lines.join('\n');
  const asksDecision = /Decision needed/.test(String(l || ''));
  if (asksDecision && !/Decision needed/.test(body)) l = '';
  const ask = /^Proposed direction/.test(body) && !/Decision needed/.test(body);
  // With no status line of its own (only "\u21b3" lines, such as Where to review), the review ask goes first.
  if (ask && (!l || String(l).indexOf(PROGRESS) !== 0)) return [PROGRESS + ASK_PROPOSAL].concat(l ? [l] : []);
  return l ? [l] : [];
}

/**
 * When each row's Ready for agent turned Yes (owner, 2026-10-31: "i just set
 * Ready for agent to Y ... expected Staging review to get a stale warning").
 * Kept per change set as "ready:CS-001" = the time, cleared on No. A Yes the
 * script first sees on a row the agent has already worked (the script was
 * just installed or re-pasted) counts from the agent's last completion.
 */
function readyTimes(s, csCol, prOf, want, props) {
  const readyCol = col(s, 'Ready for agent'), readyAt = {};
  if (readyCol < 0 || csCol < 0) return readyAt;
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + 'Z';
  s.rows.forEach((r, k) => {
    const cs = String(r[csCol]).trim();
    if (!cs) return;
    const key = 'ready:' + cs, was = props.getProperty(key);
    if (/^yes$/i.test(String(r[readyCol]).trim())) {
      const done = (prOf[cs] || []).map(p => utcMs(p.done)).filter(x => !isNaN(x));
      const first = done.length ? new Date(Math.max.apply(null, done)).toISOString().slice(0, 16).replace('T', ' ') + 'Z' : now;
      if (!was && want(k)) props.setProperty(key, first);
      readyAt[cs] = was || (want(k) ? first : '');
    } else if (was && want(k)) props.deleteProperty(key);
  });
  return readyAt;
}
const isYes = (s, r, h) => { const c = col(s, h); return c >= 0 && /^yes$/i.test(String(r[c]).trim()); };

/**
 * The tags in the agent's feedback in bold ("Decision needed:", "Status:",
 * "Next:"), and the rest plain, so a reader sees at once what the row asks
 * of them. Cells without a tag or link are left as they are.
 */
const DECISION_INK = '#000000';
function decisionSpans(text) {
  // Only the tags are bold, never whole blocks or lines (owner, 2026-11-01:
  // "all text is bold which is ugly. only a tag like \"Decisions Needed:\"
  // should be bold"). A tag is a short label ending in a colon: at the start
  // of a line ("Decision needed (No. 1):", "Status:", "Next:"), or right
  // after the script's \u23f3 mark ("Needs you:"). Option lines ("A. ...") are not tags.
  // Comment numbers stay bold.
  const t = String(text), spans = [];
  let m;
  const lab = /(^|\n)(\u26a0 |\u23f3 )?([A-Z][a-z][A-Za-z0-9 ()\-.]{0,40}:)(?=\s|$)/g;
  while ((m = lab.exec(t))) {
    const a = m.index + m[1].length + (m[2] || '').length;
    spans.push([a, a + m[3].length]);
  }
  const ref = /\bNos?\.\s*\d+(?:(?:,\s*|\s+and\s+|\s+to\s+)\d+)*/g;
  while ((m = ref.exec(t))) spans.push([m.index, m.index + m[0].length]);
  return spans;
}
/** The linked runs of a cell, as [{ text, url }]; [] when the cell has none or cannot say. */
function linkRuns(range) {
  let rt = null;
  try { rt = range.getRichTextValue ? range.getRichTextValue() : null; } catch (e) { rt = null; }
  if (!rt || !rt.getRuns) return [];
  return rt.getRuns().map(x => ({ text: x.getText(), url: x.getLinkUrl ? x.getLinkUrl() : null })).filter(x => x.url && String(x.text).trim());
}

/**
 * Where the links someone (an agent, through the Sheets API) put in a cell land
 * in its new text, as [start, end, url]: each linked label is found again, in
 * order, so a refresh that adds a status line keeps every link it can place.
 */
function keptLinks(runs, text) {
  const t = String(text), from = {}, out = [];
  (runs || []).forEach(x => {
    const w = String(x.text), at = t.indexOf(w, from[w] || 0);
    if (at < 0) return;
    from[w] = at + w.length;
    out.push([at, at + w.length, x.url]);
  });
  return out;
}

function markDecision(range, text, links) {
  const spans = decisionSpans(text);
  if (!spans.length && !(links || []).length) return;
  const b = SpreadsheetApp.newRichTextValue().setText(String(text));
  const st = SpreadsheetApp.newTextStyle().setBold(true).setForegroundColor(DECISION_INK).build();
  // The cell's own format must not make everything bold under the tags.
  if (String(text).length) b.setTextStyle(0, String(text).length, SpreadsheetApp.newTextStyle().setBold(false).build());
  if (range.setFontWeight) range.setFontWeight('normal');
  spans.forEach(([a, z]) => b.setTextStyle(a, z, st));
  (links || []).forEach(([a, z, u]) => b.setLinkUrl(a, z, u));
  range.setRichTextValue(b.build());
}

/**
 * When a proposal turns stale, set the row's Ready for agent back to No, so
 * an Editor decides again: setting it to Yes tells the agent to update the
 * row's PR (owner, 2026-10-31). Only on the turn, so a Yes set while the row
 * is stale stays.
 */
function unready(s, r, k, before, after) {
  const ready = col(s, 'Ready for agent');
  if (ready < 0 || after === null || String(after).indexOf(STALE + '\n') !== 0) return;
  if (String(before).indexOf(STALE + '\n') === 0) return;
  if (/^(yes|completed)$/i.test(String(r[ready]).trim())) s.sh.getRange(k + s.top, ready + 1, 1, 1).setValues([['No']]);
}
/**
 * Ready for agent goes from Yes to Completed once the agent has finished what
 * it was asked (its last push is after the Ready time) and the preview of it
 * is live and current (owner, 2026-10-31: "preview is now live, so nothing
 * more for agent to do ... like Yes, No, Completed"). Only the script sets
 * Completed; an Editor sets Yes again to send the row back to the agent.
 */
function completeReady(s, csCol, prOf, stagingOf, builtOf, readyAt) {
  const ready = col(s, 'Ready for agent');
  if (ready < 0 || csCol < 0) return;
  s.rows.forEach((r, k) => {
    const cs = String(r[csCol]).trim();
    if (!cs || !readyAt[cs] || !/^yes$/i.test(String(r[ready]).trim())) return;
    const prs = prOf[cs] || [];
    const last = lastFinished(prs, (builtOf[cs] || {}).step);
    if (isNaN(last) || last <= utcMs(readyAt[cs])) return;
    if (!stagingOf[cs] || stagingWarning(stagingOf[cs], builtOf[cs], prs, '')) return;
    s.sh.getRange(k + s.top, ready + 1, 1, 1).setValues([['Completed']]);
    r[ready] = 'Completed';
  });
}

const STALE = '\u26a0 Stale: the row changed since this proposal; the agent will propose again.';

/**
 * Flag or unflag an agent proposal: its first line is STALE while the row's
 * basis differs from the one the agent wrote it against. Returns the new
 * text, or null when nothing changes.
 */
function staleText(text, basis, written) {
  // basis: the row's hash, or the list basisOf gives (current, then legacy).
  const ok = [].concat(basis).indexOf(written) >= 0;
  const bare = String(text).indexOf(STALE + '\n') === 0 ? String(text).slice(STALE.length + 1) : String(text);
  if (!bare.trim() || !written) return bare === String(text) ? null : bare;
  const want = ok ? bare : STALE + '\n' + bare;
  return want === String(text) ? null : want;
}

function writeRich(s, c, rich) {
  if (c < 0 || !rich.length) return;
  s.sh.getRange(s.top, c + 1, rich.length, 1).setRichTextValues(rich.map(v => [v]));
}

/** parts: [{t, url?, bold?}] -> RichTextValue */
function rich(parts) {
  let text = '';
  const spans = [];
  parts.forEach(p => {
    const a = text.length;
    text += p.t;
    if ((p.url || p.bold) && text.length > a) spans.push([a, text.length, p]);
  });
  const b = SpreadsheetApp.newRichTextValue().setText(text);
  const bold = SpreadsheetApp.newTextStyle().setBold(true).build();
  // Text that is not a link is drawn plain: a cell that held a link before
  // keeps its blue underline on the following text otherwise (owner,
  // 2026-10-31: the QA gate line looked like a link).
  const plain = w => SpreadsheetApp.newTextStyle().setUnderline(false).setForegroundColor('#000000').setBold(!!w).build();
  if (text) b.setTextStyle(0, text.length, plain(false));
  spans.forEach(([a, z, p]) => {
    if (p.url) b.setLinkUrl(a, z, p.url).setTextStyle(a, z, SpreadsheetApp.newTextStyle().setUnderline(true).setForegroundColor('#1155cc').setBold(!!p.bold).build());
    else if (p.bold) b.setTextStyle(a, z, plain(true));
  });
  return b.build();
}

/** text + [{a, z, url}] -> RichTextValue */
function linked(text, links) {
  const b = SpreadsheetApp.newRichTextValue().setText(text);
  links.forEach(l => b.setLinkUrl(l.a, l.z, l.url));
  return b.build();
}

const prUrl = line => (line.match(/https:\/\/github\.com\/[^\s,;]+\/pull\/\d+/) || [''])[0];

/**
 * Agentic status with its pull requests, one line per PR, like the joined
 * Public Comments column: "smart-ra#97 (PR open, 2026-10-30 22:30Z) \u00b7 what it
 * changed", the PR linked and the status and the agent's completion time
 * bold. With no PR, the status alone.
 */
/**
 * Agentic status: the agent's status and its PRs, preceded by who has the
 * row now (owner, 2026-10-31: "agentic status to update saying that an agent
 * has it (w/ link to discussion/conversation)"). Ready for agent set after
 * the agent's last completion reads "Queued for the agent" until the agent
 * records Working; Working links its conversation when the agent gave one.
 */
function agenticCell(status, prs, o) {
  o = o || {};
  const last = lastFinished(prs, o.step);
  const queued = o.readyAt && !/working/i.test(status) && (isNaN(last) || utcMs(o.readyAt) > last);
  // Once the agent records a step after Ready for agent, say what it is doing
  // rather than that it is waited on (owner, 2026-10-31: "not sure what agent is doing").
  const step = agentStep(o.step);
  const stepped = step && step.name !== 'proposed' && (isNaN(last) || utcMs(step.at) >= last) && (!o.readyAt || utcMs(step.at) >= utcMs(o.readyAt));
  const head = stepped ? [{ t: stepLine(step).replace(PROGRESS, ''), bold: true }]
    : queued ? [{ t: 'Waiting on the agent since ' + o.readyAt + ' (Ready for agent set); it has not recorded a step yet' + unpicked(o.readyAt, o.now), bold: true }]
    : /working/i.test(status) && o.talk ? [{ t: 'An agent is working on it: ', bold: true }, { t: 'conversation', url: o.talk }]
    : /needs human/i.test(status) ? [{ t: NEEDS_YOU + ': it is under "Decision needed" in the agent\'s feedback column. Write your answer (the letter) in your feedback column, then an Editor sets Ready for agent to Yes.', bold: true }] : [];
  const body = agenticParts(status, prs);
  return rich(head.length ? head.concat(body.length && body[0].t ? [{ t: '\n' }].concat(body) : []) : body);
}
function agenticParts(status, prs) {
  if (!prs.length) return [{ t: status }];
  return prs.flatMap((p, i) => (i ? [{ t: '\n' }] : []).concat(
    [{ t: prLabel(p.url), url: p.url }],
    status || p.done ? [{ t: ' ' }, { t: '(' + [status, p.done].filter(Boolean).join(', ') + ')', bold: true }] : [],
    p.desc ? [{ t: descText(p.desc) }] : []));
}
/**
 * What a PR changed, as the agent wrote it: one item reads inline after
 * " \u00b7 "; several ("a; b; c", or one per line) read one bullet per line
 * (owner, 2026-10-31: "several of the cols could be a bit more structured").
 */
/**
 * "What the PRs changed" holds one entry per pull request, in the order of
 * the Pull request column. An entry may run over several lines (owner,
 * 2026-10-31, "more structured"): a line that starts with a bullet, or
 * follows a label line ending in ":", continues the entry above it. With one
 * pull request the whole cell is its entry.
 */
function prDescs(text) {
  const out = [];
  String(text).split('\n').map(x => x.trim()).forEach(line => {
    const prev = out.length ? out[out.length - 1] : null;
    if (prev !== null && line && (/^[\u2022*-]\s/.test(line) || /:$/.test(prev.split('\n').pop()))) out[out.length - 1] = prev + '\n' + line;
    else if (line || prev === null || out[out.length - 1] !== '') out.push(line);
  });
  return out.filter((x, i) => x || i < out.length - 1);
}
function descText(desc) {
  const items = String(desc).split(/;\s+|\n+/).map(x => x.replace(/^[\u2022*-]\s*/, '').trim()).filter(Boolean);
  // A label line ("What the PRs changed:") heads the list rather than being an item.
  const label = items.length > 1 && /:$/.test(items[0]) ? ' \u00b7 ' + items.shift() : '';
  return items.length > 1 ? label + items.map(x => '\n  \u2022 ' + x).join('') : (label || ' \u00b7') + ' ' + (items[0] || '');
}

/** "smart-ra#97": the repository and number, since Sheets' link popup cuts the URL short. */
const prLabel = url => { const m = url.match(/\/([^/]+)\/pull\/(\d+)$/); return m[1] + '#' + m[2]; };

/** The PRs of some change-sets, each once, in order. */
function prsOfAll(css, prOf) {
  const seen = {};
  return css.flatMap(cs => prOf[cs] || []).filter(p => !seen[p.url] && (seen[p.url] = 1));
}

const pdfUrl = printed => CFG.DRAFT + (printed + DATA.PAGE_OFFSET);

// ---------- parsing ----------

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const keysWith = p => Object.keys(DATA.SECTIONS || {}).filter(k => k.startsWith(p)).map(k => k.slice(2)).sort((a, b) => b.length - a.length);
const alt = xs => (xs.length ? xs.map(esc).join('|') : '(?!)');
const SEC_RE = () => new RegExp(
  'Appendix\\s+([A-Z])\\b|\\b([A-Z]\\.\\d+(?:\\.\\d+)*)\\b|\\b(\\d+(?:\\.\\d+)+)\\b|(' + alt(keysWith('c:')) +
  ')|\\b(' + alt(Object.keys(DATA.ABBREVIATIONS || {})) + ')\\b|(' + alt(keysWith('f:')) + ')|\\b(?:Chapter|Ch\\.?)\\s*(\\d+)\\b', 'gi');

function sectionKey(m) {
  if (m[1]) return DATA.SECTIONS[m[1].toUpperCase()] ? m[1].toUpperCase() : null;
  const num = m[2] || m[3];
  if (num) {
    const parts = num.toUpperCase().split('.');
    while (parts.length) {
      const k = parts.length === 1 && /^\d+$/.test(parts[0]) ? 'ch' + parts[0] : parts.join('.');
      if (DATA.SECTIONS[k]) return k;
      parts.pop();
    }
    return null;
  }
  if (m[4]) return DATA.SECTIONS['c:' + m[4].toLowerCase()] ? 'c:' + m[4].toLowerCase() : null;
  if (m[5]) return m[5] === m[5].toUpperCase() && DATA.ABBREVIATIONS[m[5]] ? 'c:' + DATA.ABBREVIATIONS[m[5]] : null;
  if (m[6]) {
    const k = 'f:' + m[6].toLowerCase();
    return DATA.SECTIONS[k] ? k : null;
  }
  if (m[7]) return DATA.SECTIONS['ch' + m[7]] ? 'ch' + m[7] : null;
  return null;
}

/** [{a, z, key}] for each section reference in text */
function sections(text) {
  const out = [];
  const re = SEC_RE();
  let m;
  while ((m = re.exec(text))) {
    const key = sectionKey(m);
    if (key) out.push({ a: m.index, z: m.index + m[0].length, key });
  }
  return out;
}

const PAGE_RE = () => /(?<![\w.])(\d{1,3})(?:\s*[-\u2013\u2014]\s*(\d{1,3}))?(?![\w.])/g;

/** [{a, z, from, to}] printed-page tokens */
function pageTokens(text) {
  const out = [];
  const re = PAGE_RE();
  let m;
  while ((m = re.exec(text))) {
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a >= 1 && a <= DATA.LAST_PAGE && b >= a && b <= DATA.LAST_PAGE && b - a < 30) out.push({ a: m.index, z: m.index + m[0].length, from: a, to: b });
  }
  return out;
}

/** PDF page holding draft line `line`, preferring pages near the printed candidates */
function pageOfLine(line, printedCands) {
  const holds = DATA.PAGE_LINES.filter(([, lo, hi]) => line >= lo && line <= hi).map(([p]) => p);
  for (const q of printedCands) {
    const pdf = q + DATA.PAGE_OFFSET;
    for (const d of [0, 1, -1, 2]) if (holds.includes(pdf + d)) return pdf + d;
  }
  if (holds.length === 1) return holds[0];
  return printedCands.length ? printedCands[0] + DATA.PAGE_OFFSET : null;
}

/** links for the Line no(s) column: p.N and line references */
function lineLinks(text, rowPrinted) {
  const links = [];
  const pRe = /\bp(?:p|age)?\.\s*(\d{1,3})\b/gi;
  const ctx = []; // [index, printed page] from p.N tokens in this cell
  let m;
  while ((m = pRe.exec(text))) {
    const n = +m[1];
    if (n >= 1 && n <= DATA.LAST_PAGE) {
      links.push({ a: m.index, z: m.index + m[0].length, url: pdfUrl(n) });
      ctx.push([m.index, n]);
    }
  }
  const lRe = /\b(?:[Ll]ines?|ll\.?|L)\s*(\d{1,4})(?:\s*[-\u2013\u2014]\s*(\d{1,4}))?/g;
  while ((m = lRe.exec(text))) {
    const before = ctx.filter(([i]) => i < m.index).map(([, n]) => n);
    const cands = before.length ? [before[before.length - 1]] : rowPrinted;
    const pdf = pageOfLine(+m[1], cands);
    if (pdf) links.push({ a: m.index, z: m.index + m[0].length, url: CFG.DRAFT + pdf });
  }
  return links.sort((x, y) => x.a - y.a).filter((l, i, arr) => !i || l.a >= arr[i - 1].z);
}

function compact(pages) {
  const ps = [...new Set(pages)].sort((a, b) => a - b), out = [];
  ps.forEach(p => (out.length && p === out[out.length - 1][1] + 1 ? (out[out.length - 1][1] = p) : out.push([p, p])));
  return out;
}

// ---------- Review Public Comments ----------

function refreshRpc(s, pcOf, csOfNo, stOf, prOf) {
  const c = {};
  Object.entries(COLS.rpc).forEach(([k, h]) => (c[k] = col(s, h)));
  // No. -> link to the comment on the smart-ra review page
  if (c.no >= 0) {
    const f = s.rows.map(r => {
      const n = String(r[c.no]).trim();
      const pc = pcOf[n];
      return [pc ? '=HYPERLINK("' + q(CFG.PC_PAGE + pc) + '",' + (isNaN(+n) ? '"' + q(n) + '"' : +n) + ')' : (n === '' ? '' : isNaN(+n) ? asText(n) : +n)];
    });
    if (f.length) s.sh.getRange(s.top, c.no + 1, f.length, 1).setValues(f);
  }
  const printedOf = r => (c.page >= 0 ? pageTokens(String(r[c.page])).map(t => t.from) : []);
  writeRich(s, c.sections, s.rows.map(r => {
    const t = String(r[c.sections]);
    return linked(t, sections(t).map(x => ({ a: x.a, z: x.z, url: CFG.DRAFT + DATA.SECTIONS[x.key][1] })));
  }));
  writeRich(s, c.page, s.rows.map(r => {
    const t = String(r[c.page]);
    return linked(t, pageTokens(t).map(x => ({ a: x.a, z: x.z, url: pdfUrl(x.from) })));
  }));
  writeRich(s, c.lines, s.rows.map(r => {
    const t = String(r[c.lines]);
    return linked(t, lineLinks(t, printedOf(r)));
  }));
  // Agentic status -> the comment's status and every PR of its change-sets
  writeRich(s, c.agentic, s.rows.map(r => {
    const n = String(r[c.no]).trim();
    return agenticCell(stOf[n] || '', prsOfAll(csOfNo[n] || [], prOf));
  }));
}

// ---------- Review Change Sets ----------

/**
 * People make change sets (owner, 2026-11-02 07:07Z: "the making of CS is
 * human controlled. keep process similar to how Author/Contributors can make
 * new issues"; Q-CS-1 C, a sheet row or an issue form). How a change set came
 * about does not matter: people adjudicate it.
 *
 * - Title on Review Change Sets is people's (Blue). The agent's title is
 *   only the first value of a row it adds.
 * - A row a person starts with only a Title is a new change set: it gets the
 *   next id, never reused, from both tabs.
 * - A change set the agent records on Agent - Change Sets (from an issue
 *   form, a split an Editor agreed, or triage of a new comment) that is not
 *   yet on Review Change Sets is added at the end, with the agent's title.
 *
 * `rows` and `agent` are [id, title] pairs, in sheet order. Returns the ids
 * to give (row index -> id) and the rows to append.
 */
const CS_HUMAN = 'Change Set (human)';
function csRowsPlan(rows, agent) {
  const num = id => { const m = /^CS-(\d+)$/.exec(String(id).trim()); return m ? +m[1] : 0; };
  let next = 1 + Math.max(0, ...rows.map(r => num(r[0])), ...agent.map(r => num(r[0])));
  const have = {};
  rows.forEach(r => { if (String(r[0]).trim()) have[String(r[0]).trim()] = 1; });
  const give = {};
  rows.forEach((r, k) => {
    if (!String(r[0]).trim() && String(r[1] || '').trim()) give[k] = 'CS-' + String(next++).padStart(3, '0');
  });
  const append = agent.filter(r => { const id = String(r[0]).trim(); return id && !have[id] && (have[id] = 1); })
    .map(r => [String(r[0]).trim(), String(r[1] || '').trim()]);
  return { give, append };
}

/**
 * A comment's change sets: what a person typed in Change Set (human), else
 * the agent's. A person may type an id, several ids, or "new" (the agent
 * then makes a change set for it and fills in the id). Returns the ids, and
 * a note for anything that is not an id of a change set on the sheet.
 */
function humanCs(value, known) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (/^new\b/i.test(v)) return { ids: [], note: 'new: the agent makes a change set for this comment' };
  const ids = (v.toUpperCase().match(/CS-\d+/g) || []).map(x => 'CS-' + x.slice(3).padStart(3, '0'));
  const unknown = ids.filter(x => !known[x]);
  return { ids: ids.filter(x => known[x]), note: unknown.length ? unknown.join(', ') + ' is not a change set on ' + CFG.RCS : '' };
}

/**
 * Review Change Sets' Change-set and Title were a spill of
 * FILTER('Agent - Change Sets'!A3:B ...), so nobody could type a Title or a
 * row. The spill becomes plain values once, in place, and from then on the
 * script keeps the ids and adds the agent's new change sets (csRowsPlan).
 */
function ownChangeSets(ss, agentCs) {
  const sh = ss.getSheetByName(CFG.RCS);
  if (!sh) return;
  let s = readSheet(sh);
  const cId = col(s, 'Change-set'), cT = col(s, 'Title');
  if (cId < 0 || cT < 0) return;
  try {
    const f = sh.getRange(s.top, cId + 1, 1, 1).getFormula ? String(sh.getRange(s.top, cId + 1, 1, 1).getFormula()) : '';
    if (/^=\s*FILTER\(/i.test(f) && s.rows.length) {
      const vals = s.rows.map(r => [asText(String(r[cId]).trim()), asText(String(r[cT]).trim())]);
      sh.getRange(s.top, cId + 1, 1, 1).setValue('');
      sh.getRange(s.top, cId + 1, vals.length, 1).setValues(vals.map(v => [v[0]]));
      sh.getRange(s.top, cT + 1, vals.length, 1).setValues(vals.map(v => [v[1]]));
      s = readSheet(sh);
    }
  } catch (err) { /* left as it is: the next run tries again */ }
  const aId = col(agentCs, COLS.agent.csId), aT = col(agentCs, 'Title');
  const agent = aId < 0 ? [] : agentCs.rows.map(r => [r[aId], aT >= 0 ? r[aT] : '']);
  const plan = csRowsPlan(s.rows.map(r => [r[cId], r[cT]]), agent);
  Object.keys(plan.give).forEach(k => sh.getRange(+k + s.top, cId + 1, 1, 1).setValues([[plan.give[k]]]));
  if (plan.append.length) {
    let last = s.rows.length;
    while (last > 0 && !String(s.rows[last - 1][cId]).trim() && !String(s.rows[last - 1][cT]).trim()) last--;
    const at = last + Object.keys(plan.give).filter(k => +k >= last).length;
    sh.getRange(at + s.top, cId + 1, plan.append.length, 1).setValues(plan.append.map(r => [r[0]]));
    sh.getRange(at + s.top, cT + 1, plan.append.length, 1).setValues(plan.append.map(r => [asText(r[1])]));
  }
}

/**
 * Columns people now own (Title on Review Change Sets, Change Set (human) on
 * Review Public Comments): add the column when missing, give its head and
 * cells the tab's Blue fill, and take it out of the script-era locks on
 * the agent's columns, so an editor can type in it. Done once per column.
 */
function peopleColumns(ss) {
  const props = docProps_();
  const want = [[CFG.RCS, 'Title', null], [CFG.RPC, CS_HUMAN, 'Change Set']];
  want.forEach(([tab, head, after]) => {
    const key = 'people:' + tab + '|' + head;
    const sh = ss.getSheetByName(tab);
    if (!sh) return;
    if (props.getProperty(key)) {
      // A copy of a template keeps the template's whole-tab lock, so this
      // check runs on every refresh, not once.
      try { const s = readSheet(sh), c = s.header.indexOf(head); if (c >= 0) openInSheetLock(sh, c, s.top); } catch (err) { /* next run */ }
      return;
    }
    try {
      let s = readSheet(sh);
      let c = s.header.indexOf(head);
      if (c < 0 && after) {
        const a = s.header.indexOf(after);
        if (a < 0) return;
        sh.insertColumnAfter(a + 1);
        sh.getRange(s.top - 1, a + 2).setValue(head);
        sh.setColumnWidth(a + 2, 110);
        s = readSheet(sh);
        c = a + 1;
      }
      if (c < 0) return;
      const rows = sh.getMaxRows() - s.top + 1;
      const heads = sh.getRange(s.top - 1, 1, 1, s.header.length).getBackgrounds()[0];
      const blue = heads.findIndex((x, i) => i !== c && fillGroup(x) === 'blue');
      if (blue >= 0) {
        sh.getRange(s.top - 1, c + 1).setBackground(heads[blue]);
        sh.getRange(s.top, c + 1, rows, 1).setBackground(sh.getRange(s.top, blue + 1).getBackground());
      }
      unlockColumn(sh, c);
      openInSheetLock(sh, c, s.top);
      props.setProperty(key, '1');
    } catch (err) { /* tried again on the next run */ }
  });
}

/**
 * Take column c (0-based) out of every range lock on the tab except the
 * Ready columns' own: a lock that spans it is replaced by the parts left and
 * right of it, with the same description and editors.
 */
/**
 * The templates lock a whole tab to the owner and leave the people's
 * columns open as its exceptions (owner, 2026-11-08, Q-TBL-1 A: Title stayed
 * locked on the Public Comment template). Add column c (0-based), from the
 * first data row down, to the exceptions of every whole-tab lock that does
 * not already leave it open. Range locks are unlockColumn's job.
 */
function openInSheetLock(sh, c, top) {
  const type = SpreadsheetApp.ProtectionType && SpreadsheetApp.ProtectionType.SHEET;
  if (!type) return;
  sh.getProtections(type).forEach(p => {
    if (typeof p.getUnprotectedRanges !== 'function') return;
    const open = p.getUnprotectedRanges();
    const covered = open.some(r => r.getColumn() - 1 <= c && c <= r.getColumn() - 2 + r.getNumColumns() && r.getRow() <= top);
    if (covered) return;
    p.setUnprotectedRanges(open.concat([sh.getRange(top, c + 1, sh.getMaxRows() - top + 1, 1)]));
  });
}

function unlockColumn(sh, c) {
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(p => {
    if (p.getDescription() === READY_DESC) return;
    const r = p.getRange(), c0 = r.getColumn() - 1, c1 = c0 + r.getNumColumns() - 1;
    if (c < c0 || c > c1) return;
    const desc = p.getDescription(), eds = p.getEditors(), row = r.getRow(), n = r.getNumRows();
    p.remove();
    [[c0, c - 1], [c + 1, c1]].forEach(([a, z]) => {
      if (a > z) return;
      const q2 = sh.getRange(row, a + 1, n, z - a + 1).protect().setDescription(desc);
      q2.removeEditors(q2.getEditors());
      if (eds.length) q2.addEditors(eds);
    });
  });
}

function refreshRcs(s, rpc, csOf, stOf, prOf, readyAt, builtOf) {
  const c = {};
  Object.entries(COLS.rcs).forEach(([k, h]) => (c[k] = col(s, h)));
  const p = {};
  Object.entries(COLS.rpc).forEach(([k, h]) => (p[k] = col(rpc, h)));
  const fb = cols(rpc, COLS.rpc.feedback);
  const gid = rpc.sh.getSheetId();
  const rowOf = {};
  rpc.rows.forEach((r, i) => (rowOf[String(r[p.no]).trim()] = { r, at: i + rpc.top }));
  const ref = n => ({ t: 'No. ' + n, url: '#gid=' + gid + '&range=A' + rowOf[n].at });
  const get = (n, k) => (p[k] >= 0 ? String(rowOf[n].r[p[k]]).trim() : '');

  const join = (nos, sep, body) => {
    const parts = [];
    nos.forEach(n => {
      const b = body(n);
      if (!b) return;
      if (parts.length) parts.push({ t: sep });
      parts.push(...b);
    });
    return rich(parts);
  };

  const out = { sections: [], pages: [], comments: [], revisions: [], feedback: [], dispositions: [], agentic: [] };
  const status = [];
  s.rows.forEach(r => {
    const cs = String(r[c.cs]).trim();
    const sts = [...new Set((csOf[cs] || []).map(n => stOf[n]).filter(Boolean))].join(', ');
    out.agentic.push(agenticCell(sts, prOf[cs] || [], { readyAt: (readyAt || {})[cs], step: ((builtOf || {})[cs] || {}).step }));
    status.push([asText(csStatus((csOf[cs] || []).map(n => stOf[n]).filter(Boolean)))]);
    const nos = (csOf[cs] || []).filter(n => rowOf[n]).sort((a, b) => a - b);

    const keys = {}, raw = [];
    nos.forEach(n => {
      const t = get(n, 'sections');
      const found = sections(t);
      found.forEach(x => (keys[x.key] = 1));
      if (!found.length && t && !raw.some(x => x.toLowerCase() === t.toLowerCase())) raw.push(t);
    });
    const secParts = Object.keys(keys)
      .sort((a, b) => DATA.SECTIONS[a][1] - DATA.SECTIONS[b][1] || a.localeCompare(b))
      .map(k => ({ t: DATA.SECTIONS[k][0], url: CFG.DRAFT + DATA.SECTIONS[k][1] }))
      .concat(raw.map(t => ({ t })));
    out.sections.push(rich(secParts.flatMap((x, i) => (i ? [{ t: ', ' }, x] : [x]))));

    const printed = [];
    nos.forEach(n => pageTokens(get(n, 'page')).forEach(t => { for (let q = t.from; q <= t.to; q++) printed.push(q); }));
    const pageParts = compact(printed).map(([a, b]) => ({ t: a === b ? String(a) : a + '\u2013' + b, url: pdfUrl(a) }));
    out.pages.push(rich(pageParts.flatMap((x, i) => (i ? [{ t: ', ' }, x] : [x]))));

    // One line per comment, no blank line between (owner, 2026-11-01 18:24Z: "condense line spacing").
    out.comments.push(join(nos, '\n', n => {
      const v = get(n, 'comment');
      if (!v) return null;
      const st = get(n, 'status');
      return [ref(n)].concat(st ? [{ t: ' ' }, { t: '(' + st + ')', bold: true }] : [], [{ t: ' \u00b7 ' + v }]);
    }));
    out.revisions.push(join(nos, '\n', n => {
      const v = get(n, 'revision');
      return v ? [ref(n), { t: ' \u00b7 ' + v }] : null;
    }));
    out.feedback.push(join(nos, '\n', n => {
      const v = fb.map(i => String(rowOf[n].r[i]).trim()).filter(Boolean).join(' | ');
      return v ? [ref(n), { t: ' \u00b7 ' + v }] : null;
    }));
    out.dispositions.push(join(nos, '\n', n => {
      const v = get(n, 'disposition');
      return v ? [ref(n), { t: ' \u00b7 ' + v }] : null;
    }));
  });
  Object.keys(out).forEach(k => writeRich(s, c[k], out[k]));
  // One plain status per change set, for filtering (owner, 2026-10-31).
  const st = COLS.rcs.status ? col(s, COLS.rcs.status) : -1;
  if (st >= 0 && status.length) s.sh.getRange(s.top, st + 1, status.length, 1).setValues(status);
}

/**
 * The Agent tab's Agentic status values, in the order work moves through
 * them. A change set's one status for filtering: "Needs human" if any of its
 * comments needs a person, else the least advanced of them; "Not in comment
 * record" only when every one is. A value not in the list is kept as is.
 */
// What a person must do, said in the sheet instead of the agent's own
// "Needs human" (owner, 2026-10-31: "unclear: needs human to do what?").
const NEEDS_YOU = "Needs you: answer the agent's question";
const shownStatus = st => (/^needs human$/i.test(String(st).trim()) ? NEEDS_YOU : st);
const STATUS_ORDER = ['Not started', 'Working', 'PR open', 'Ready for review', 'Change merged'];
function csStatus(sts) {
  if (!sts.length) return '';
  if (sts.indexOf('Needs human') >= 0) return NEEDS_YOU;
  const known = sts.filter(x => x !== 'Not in comment record');
  if (!known.length) return 'Not in comment record';
  const odd = known.filter(x => STATUS_ORDER.indexOf(x) < 0);
  if (odd.length) return odd[0];
  return STATUS_ORDER[Math.min.apply(null, known.map(x => STATUS_ORDER.indexOf(x)))];
}

// ---------- Drafting: Contributor Feedback ----------

/**
 * One row of Contributor Feedback is one change set. The script:
 * - gives any row a person has filled in (other than "No") but with no
 *   Change-set the next id (CS-001, CS-002, ...), once; it stays with the row;
 * - keeps Selected Sections valid when the document changes: a pick is
 *   rewritten to the section's current name (found by its anchor, so a
 *   renamed or renumbered section follows), and a pick whose section is gone
 *   is kept and flagged in Section links, for a person to pick again;
 * - writes Section links: each picked section, linked to its anchor on the
 *   document page, one per line (Sections itself stays the plain dropdown);
 * - fills Issue, Agentic status and Staging review page from the Agent tab,
 *   by change set;
 * - keeps the hidden TOC tab, the Sections dropdown's list, current.
 */
function refreshDraft(rows) {
  const ss = SpreadsheetApp.getActive();
  try { ensureAgentStepColumn(ss.getSheetByName(CFG.AGENT)); } catch (err) { /* the refresh still runs */ }
  const props = docProps_();
  try { normalizeRows(ss.getSheetByName(CFG.FEEDBACK)); } catch (err) { /* cosmetic only */ }
  // Agentic status sits just left of its filter column (owner, 2026-10-31).
  // Moved here, inside the locked run, before any column is read by position.
  try { placeBefore(ss.getSheetByName(CFG.FEEDBACK), COLS.draft.agentic || 'Agentic status', COLS.draft.status || 'Agentic status (filter)'); } catch (err) { /* the refresh still runs */ }
  // Issue sits just left of Disposition (agent) (owner, 2026-11-01).
  try { placeBefore(ss.getSheetByName(CFG.FEEDBACK), COLS.draft.issue || 'Issue', 'Disposition (agent)'); } catch (err) { /* the refresh still runs */ }
  const fb = readSheet(ss.getSheetByName(CFG.FEEDBACK));
  const agentSh = ss.getSheetByName(CFG.AGENT);
  const agent = agentSh ? readSheet(agentSh) : { header: [], rows: [] };
  // A changed table of contents (the agent rewrote Config) rebuilds all rows,
  // since any pick may need repair; otherwise only the rows asked for.
  const tocKey = hashOf(JSON.stringify(DATA.TOC));
  let only = rows ? rows.filter(k => k >= 0 && k < fb.rows.length) : null;
  if (props.getProperty('tocKey') !== tocKey) only = null;
  const prev = only ? {} : writeToc(ss);
  props.setProperty('tocKey', tocKey);

  const c = {};
  Object.entries(COLS.draft).forEach(([k, h]) => (c[k] = col(fb, h)));
  const fbCols = colsLike(fb, COLS.draft.feedback);
  const a = {};
  Object.entries(COLS.draftAgent).forEach(([k, h]) => (a[k] = col(agent, h)));
  // Columns added after a sheet's Config was written are found by their default names.
  [['head', 'PR head (change set)'], ['builtFrom', 'Staging built from (change set)'], ['deploy', 'Staging deploy (change set)'],
    ['conversation', 'Agent conversation (change set)'], ['dispositions', DISPOSITIONS_CS],
    ['gate', QA_GATE], ['qa', QA_REPORT]]
    .forEach(([k, h]) => { if (a[k] === undefined) a[k] = col(agent, h); });

  // Rows whose change set's Agent row changed since the last run.
  // One property per change set ("a:CS-001"), never one large JSON value,
  // which would pass the 9 kB property limit near 450 change sets (F4).
  const all = props.getProperties ? props.getProperties() : {}, keys = {}, put = {};
  agent.rows.forEach(r => {
    const id = a.csId >= 0 ? String(r[a.csId]).trim() : '';
    if (id) keys[id] = hashOf(r.join('\u0001'));
  });
  const seen = {};
  Object.keys(keys).forEach(id => {
    seen[id] = all['a:' + id] !== undefined ? all['a:' + id] : props.getProperty('a:' + id);
    if (seen[id] !== keys[id]) put['a:' + id] = keys[id];
  });
  if (Object.keys(put).length) props.setProperties ? props.setProperties(put) : Object.keys(put).forEach(k => props.setProperty(k, put[k]));
  if (only) {
    fb.rows.forEach((r, k) => {
      const id = String(r[c.cs]).trim();
      if (id && keys[id] !== seen[id] && only.indexOf(k) < 0) only.push(k);
    });
    if (!only.length) return;
  }
  const want = k => !only || only.indexOf(k) >= 0;

  // Change-set ids: mechanical, assigned once, never reused.
  // A row is used once any cell a person fills holds something; "No" (a
  // Yes/No dropdown's default) and the script's own columns do not count.
  const mech = [c.cs, c.sectionLinks, c.issue, c.agentic, c.staging, c.status,
    col(fb, COLS.draft.agentFeedback || 'Feedback (agent)')];
  if (c.cs >= 0) {
    let next = 1 + fb.rows.reduce((m, r) => {
      const x = /^CS-(\d+)$/.exec(String(r[c.cs]).trim());
      return x ? Math.max(m, +x[1]) : m;
    }, 0);
    const given = [];
    fb.rows.forEach((r, k) => {
      const cur = String(r[c.cs]).trim();
      const used = r.some((v, i) => !mech.includes(i) && !/^(no)?$/i.test(String(v).trim()));
      if (cur || !used || !want(k)) return;
      r[c.cs] = 'CS-' + String(next++).padStart(3, '0');
      given.push(k);
    });
    if (given.length && !only) {
      fb.sh.getRange(fb.top, c.cs + 1, fb.rows.length, 1).setValues(fb.rows.map(r => [asText(String(r[c.cs]).trim())]));
    } else {
      given.forEach(k => fb.sh.getRange(k + fb.top, c.cs + 1, 1, 1).setValues([[fb.rows[k][c.cs]]]));
    }
  }

  const prOf = {}, stOf = {}, issuesOf = {}, stagingOf = {}, basisOfCs = {}, builtOf = {}, talkOf = {}, dispOf = {};
  agent.rows.forEach(r => {
    const id = a.csId >= 0 ? String(r[a.csId]).trim() : '';
    if (!id) return;
    if (a.dispositions >= 0) dispOf[id] = String(r[a.dispositions]);
    if (a.conversation >= 0) talkOf[id] = (String(r[a.conversation]).match(/https:\/\/\S+/) || [''])[0];
    if (a.agentic >= 0) stOf[id] = String(r[a.agentic]).trim();
    if (a.issue >= 0) issuesOf[id] = String(r[a.issue]).split('\n').map(issueUrl).filter(Boolean);
    if (a.staging >= 0) stagingOf[id] = (String(r[a.staging]).match(/https:\/\/\S+/) || [''])[0];
    builtOf[id] = builtInfo(r, a.built, a.builtFrom, a.deploy, a.gate, a.qa, col(agent, AGENT_STEP));
    if (a.basis >= 0) basisOfCs[id] = String(r[a.basis]).trim();
    if (a.prs >= 0) {
      const descs = a.changes >= 0 ? prDescs(r[a.changes]) : [];
      const dones = a.done >= 0 ? String(r[a.done]).split('\n').map(x => x.trim()) : [];
      const heads = a.head >= 0 ? String(r[a.head]).split('\n').map(x => x.trim()) : [];
      prOf[id] = String(r[a.prs]).split('\n').map(x => x.trim()).filter(Boolean)
        .map((line, i) => ({ url: prUrl(line), desc: descs[i] || '', done: dones[i] || '', head: heads[i] || '' }))
        .filter(x => x.url);
    }
  });


  const tocUrl = {}, marked = {}, nameOf = {};
  // Names are compared bare: the dropdown marks sections under their chapter.
  DATA.TOC.forEach(([name, anchor]) => {
    tocUrl[bareName(name)] = CFG.SECTION_URL + anchor;
    marked[bareName(name)] = name;
    nameOf[anchor] = name;
  });
  // Keep every pick valid: its current dropdown name (with its tree mark),
  // or, for a section renamed since, the new name of the same anchor. A pick
  // whose section is gone stays, and Section links flags it.
  const gone = [];
  if (c.sections >= 0) {
    const fixed = [];
    fb.rows.forEach((r, k) => {
      if (!want(k)) return;
      const was = String(r[c.sections]).split(',').map(x => x.trim()).filter(Boolean);
      const now = [];
      gone[k] = [];
      was.forEach(p => {
        const b = bareName(p);
        const n = marked[b] || nameOf[prev[b]] || p;
        if (!marked[bareName(n)]) gone[k].push(b);
        if (!now.includes(n)) now.push(n);
      });
      if (now.join('\n') !== was.join('\n')) {
        fixed.push(k);
        r[c.sections] = now.join(', ');
      }
    });
    fixed.forEach(k => fb.sh.getRange(k + fb.top, c.sections + 1, 1, 1).setValues([[asText(fb.rows[k][c.sections])]]));
  }
  // Selected Sections is the people's multi-select dropdown, so it stays plain
  // text (a dropdown chip cannot carry a link). Section links is grey: one
  // linked line per picked section, then a flag for each pick no longer in
  // the document.
  writeRows(fb, c.sectionLinks, only, (r, k) => {
    const names = String(r[c.sections]).split(',').map(bareName).filter(x => tocUrl[x]);
    const parts = names.map(n => [{ t: n, url: tocUrl[n] }])
      .concat((gone[k] || []).map(n => [{ t: '\u26a0 "' + n + '" is not in the document now: pick its section again' }]));
    return rich(parts.flatMap((p, i) => (i ? [{ t: '\n' }] : []).concat(p)));
  });
  writeRows(fb, c.issue, only, r => {
    const urls = issuesOf[String(r[c.cs]).trim()] || [];
    return rich(urls.flatMap((u, i) => (i ? [{ t: '\n' }] : []).concat([{ t: issueLabel(u), url: u }])));
  });
  const readyAt = readyTimes(fb, c.cs, prOf, want, props);
  writeRows(fb, c.agentic, only, r => {
    const cs = String(r[c.cs]).trim();
    return agenticCell(stOf[cs] || '', prOf[cs] || [], { readyAt: readyAt[cs], talk: talkOf[cs], step: (builtOf[cs] || {}).step });
  });
  // The same status as one plain value, for a filter (owner, 2026-10-31).
  if (c.status >= 0) writeRows(fb, c.status, only, r => rich([{ t: shownStatus(stOf[String(r[c.cs]).trim()] || '') }]));
  writeRows(fb, col(fb, DISPOSITIONS_AGENT), only, r => dispositionCell(dispOf[String(r[c.cs]).trim()] || '', [], {}));
  // Staging review page: the change set's preview while its PR is open.
  writeRows(fb, c.staging, only, r => {
    const cs = String(r[c.cs]).trim();
    return stagingCell(stagingOf[cs], builtOf[cs], prOf[cs], readyAt[cs]);
  });
  // Feedback (agent): flagged stale while the row's blue cells differ from
  // what the proposal was written against.
  const lineOf = {};
  fb.rows.forEach(r => {
    const cs = String(r[c.cs]).trim();
    const line = cs ? progressLine({ readyAt: readyAt[cs], merge: isYes(fb, r, 'Ready for merge'), status: stOf[cs] || '', prs: prOf[cs] || [], staging: stagingOf[cs], built: builtOf[cs] }) : '';
    if (!cs) return;
    const base = c.agentic < 0 ? statusBlock(line, stOf[cs] || '', prOf[cs] || []) : line;
    const picked = c.sections >= 0 ? String(r[c.sections]).split(',').map(bareName).filter(Boolean) : null;
    const where = picked ? whereFor(picked, tocUrl, stagingOf[cs], stOf[cs] || '') : null;
    lineOf[cs] = where ? withWhere(base, where) : base;
  });
  markStale(fb, c.cs, basisOfCs, [COLS.draft.title, COLS.draft.sections], COLS.draft.feedback, COLS.draft.agentFeedback || 'Feedback (agent)', lineOf, want);
  completeReady(fb, c.cs, prOf, stagingOf, builtOf, readyAt);
  finishDoneRows(fb, c.cs, stOf, props);
}
/**
 * A finished change set's row is hidden, and its whole row struck through, so
 * open work is not cluttered (owner, 2026-11-01 21:50Z: "make sure complete
 * changeset rows are hidden so not cluttered and that text of that whole row
 * is crossed out"). Finished means its Agentic status (Agent tab) is Change
 * merged or Closed; closing a change set writes Closed there when it closes
 * the issue. A row that is reopened is shown again and the line removed.
 * Only formatting changes: no value is written, so a watcher, which compares
 * values, never reads it as new feedback. One property per change set
 * ("d:CS-001") records what was applied, so an unchanged row is not touched.
 */
const DONE_STATUS = /^(change merged|closed)\b/i;
function isDoneStatus(st) { return DONE_STATUS.test(String(st || '').trim()); }
function finishDoneRows(s, csCol, stOf, props) {
  if (csCol < 0 || !s.sh || typeof s.sh.hideRows !== 'function') return;
  const width = Math.max(s.sh.getLastColumn(), 1);
  s.rows.forEach((r, k) => {
    const cs = String(r[csCol]).trim();
    if (!cs) return;
    const done = isDoneStatus(stOf[cs]);
    const was = props.getProperty('d:' + cs) === '1';
    if (done === was) return;
    const row = k + s.top;
    try {
      s.sh.getRange(row, 1, 1, width).setFontLine(done ? 'line-through' : 'none');
      if (done) s.sh.hideRows(row); else s.sh.showRows(row);
      props.setProperty('d:' + cs, done ? '1' : '0');
    } catch (err) { /* cosmetic only: tried again on the next run */ }
  });
}
/** A dropdown name without its indent (U+2800 blanks; old "\u2514 "/"\u2502 " marks) or spaces. */
const bareName = n => String(n).replace(/^[\s\u2800\u2502\u2514]+/, '').trim();
const issueUrl = line => (String(line).match(/https:\/\/github\.com\/[^\s,;]+\/issues\/\d+/) || [''])[0];
const issueLabel = url => { const m = url.match(/\/([^/]+)\/issues\/(\d+)$/); return m[1] + '#' + m[2]; };

/** The hidden TOC tab: column A the dropdown names, column B each linked. */
function writeToc(ss) {
  if (!ss) throw new Error(RUN_THIS);
  let sh = ss.getSheetByName(CFG.TOC);
  if (!sh) {
    sh = ss.insertSheet(CFG.TOC);
    sh.hideSheet();
  }
  // The names the dropdown offered until now, by anchor (column C), so a pick
  // of a section since renamed can follow it.
  const prev = {};
  const last = sh.getLastRow();
  if (last > 1 && sh.getLastColumn() >= 3) {
    sh.getRange(2, 1, last - 1, 3).getDisplayValues()
      .forEach(([name, , anchor]) => { if (name && anchor) prev[bareName(name)] = anchor; });
  }
  const rows = [['Section', 'Link', 'Anchor']].concat(DATA.TOC.map(([name, anchor]) =>
    [asText(name), '=HYPERLINK("' + q(CFG.SECTION_URL + anchor) + '","open")', asText(anchor)]));
  sh.getRange(1, 1, rows.length, 3).setValues(rows);
  const extra = last - rows.length;
  if (extra > 0) sh.getRange(rows.length + 1, 1, extra, 3).clearContent();
  return prev;
}
