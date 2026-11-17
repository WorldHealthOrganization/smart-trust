/**
 * Folio Review Library: the updater. Lives only in the library project,
 * beside Code.gs, so nobody pastes Code.gs again (owner, 2026-10-31: "can
 * you have a copy icon for code.gs so i dont need to open tab").
 *
 * updateFromGitHub() fetches the published Code.gs from this repository's
 * main branch and, when it differs, writes it over the library's Code.gs
 * through the Apps Script API. Every sheet's stub uses the library at HEAD,
 * so every sheet runs the new code on its next refresh. It runs when somebody
 * runs it (owner, 2026-10-31, option B: one click, no timer).
 *
 * One-time setup, in the library project:
 *   1. Turn on the Apps Script API: https://script.google.com/home/usersettings
 *   2. Add this file (+ next to Files, Script, name it Updater) and paste it.
 *   3. Project Settings (gear), tick "Show appsscript.json", and replace that
 *      file with dist/library-appsscript.json.
 *   4. Pick updateFromGitHub in the function list, press Run, and allow it.
 * After that, an update is step 4 alone. The log says "Updated to <version>"
 * or "Already current".
 */
const UPDATE_FROM = 'https://raw.githubusercontent.com/litlfred/folio-assistant-core/main/tools/review-sheet-sync/dist/Code.gs';

/** Is this text the review-sheet Code.gs (and not, say, an error page)? */
function isReviewSheetCode_(text) {
  return /^function installTriggers\(/m.test(text) && /^const SCRIPT_VERSION = '[^']+';$/m.test(text);
}

function updateFromGitHub() {
  const got = UrlFetchApp.fetch(UPDATE_FROM, { muteHttpExceptions: true });
  if (got.getResponseCode() !== 200) throw new Error('GitHub answered ' + got.getResponseCode() + ' for ' + UPDATE_FROM);
  const code = got.getContentText();
  if (!isReviewSheetCode_(code)) throw new Error('What GitHub sent is not the review-sheet Code.gs; nothing changed.');
  const api = 'https://script.googleapis.com/v1/projects/' + ScriptApp.getScriptId() + '/content';
  const headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  const now = UrlFetchApp.fetch(api, { headers: headers, muteHttpExceptions: true });
  if (now.getResponseCode() !== 200) {
    throw new Error('The Apps Script API answered ' + now.getResponseCode() +
      '. Is it turned on at https://script.google.com/home/usersettings ? ' + now.getContentText().slice(0, 300));
  }
  const files = JSON.parse(now.getContentText()).files || [];
  const mine = files.filter(f => f.type === 'SERVER_JS' && isReviewSheetCode_(f.source || ''))[0];
  const version = (code.match(/^const SCRIPT_VERSION = '([^']+)';$/m) || [])[1];
  if (mine && mine.source === code) { console.log('Already current: ' + version); return 'current'; }
  if (mine) mine.source = code; else files.push({ name: 'Code', type: 'SERVER_JS', source: code });
  const put = UrlFetchApp.fetch(api, {
    method: 'put', contentType: 'application/json', headers: headers,
    payload: JSON.stringify({ files: files }), muteHttpExceptions: true,
  });
  if (put.getResponseCode() !== 200) throw new Error('Saving failed (' + put.getResponseCode() + '): ' + put.getContentText().slice(0, 300));
  console.log('Updated to ' + version);
  return 'updated';
}
