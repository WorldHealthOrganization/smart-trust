/**
 * Folio review sheet: the stub that stays in each sheet.
 *
 * The code itself lives once, in the Apps Script library "Folio Review
 * Library" (Script ID 1us7_ApIq_XvDG-V1XtqdcyHucF0hSlST0qracv1Tw9KTb4-lAFvK1bMQ),
 * added to this project under Libraries with the identifier Review and
 * version HEAD. Updating the library updates every sheet; this file never
 * changes. Each function hands the library this sheet's own services, so its
 * settings, lock and triggers stay this sheet's.
 *
 * First time: save, then pick installTriggers in the function list and press
 * Run (or, in the sheet, Folio Assistant > Install).
 * @OnlyCurrentDoc
 */
function installTriggers() { use_(); Review.installTriggers(); }
function onOpen() {
  // The library builds the menu, so every sheet shows the same one and a
  // rename needs no new stub. If the library cannot run yet (before the
  // script is allowed), this fallback menu still shows.
  const ui = SpreadsheetApp.getUi();
  try { Review.addMenu(ui); return; } catch (e) { /* fall back below */ }
  ui.createMenu('Folio Assistant')
    .addItem('Refresh now', 'refreshAll')
    .addItem('Install (first time)', 'installTriggers')
    .addItem('Which version is this?', 'showVersion')
    .addSeparator()
    .addItem('About Folio Assistant', 'showAbout')
    .addToUi();
}
function refreshAll() { use_(); Review.refreshAll(); }
function markDirty(e) { use_(); Review.markDirty(e); }
function refreshIfDirty() { use_(); Review.refreshIfDirty(); }
function showVersion() { use_(); Review.showVersion(); }
function showAbout() { Review.showAbout(); }
function use_() { Review.init({ PropertiesService: PropertiesService, LockService: LockService, ScriptApp: ScriptApp }); }
