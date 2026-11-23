/**
 * The site's 404 page, and the English fallback it carries.
 *
 * Owner, 2026-11-13, on `https://litlfred.github.io/who-iris/fr/` returning
 * GitHub's own 404: *"if page not there, should redirect to en/ version"*.
 * GitHub Pages serves a project site's `/404.html` for every missing path
 * under it, previews included, so one page at the site root answers for all
 * of them. When the missing path has a locale segment (`/<base>/fr/<rest>`),
 * the page looks for the English page that exists, in order:
 *
 *   1. the same path with the segment replaced by `en` (`/<base>/en/<rest>`),
 *      for a site that keeps its source language under `en/`;
 *   2. the same path with the segment removed (`/<base>/<rest>`), for a site
 *      whose source language is unprefixed;
 *
 * and replaces itself with the first one that answers, saying for a moment
 * that the page is not translated yet.
 *
 * IT CANNOT LOOP. Every candidate is the missing path with its locale segment
 * changed or removed, so none is the path the reader asked for; each is
 * fetched first and only a page that answers 2xx is followed, so the page
 * never sends a reader to another 404; and it records the page it sent the
 * reader to (`sessionStorage["fa-locale-fallback"]`), which docs-ui.js's
 * remembered-language jump reads, so a stored French preference cannot send
 * the reader back to the French page that is missing.
 *
 * @module scripts/lib/locale-fallback-404
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** The marker that says the fallback script is in a page already. */
export const FALLBACK_MARK = "fa-locale-fallback-404";

/** Each locale named in its own language, as the language tabs name it. */
const NAMES: Record<string, string> = {
  ar: "العربية",
  zh: "中文",
  en: "English",
  fr: "Français",
  ru: "Русский",
  es: "Español",
};

/**
 * The rule the script runs, as the browser runs it: plain ES5, so the test
 * below and the 404 page execute the same text.
 */
const CANDIDATES_JS = `function (path, locales) {
    var segs = path.split("/");
    var i = -1;
    for (var k = 1; k < segs.length; k++) if (locales.indexOf(segs[k]) !== -1) { i = k; break; }
    if (i < 0) return [];
    var before = segs.slice(0, i), after = segs.slice(i + 1);
    var tries = [];
    if (segs[i] !== "en") tries.push(before.concat(["en"], after).join("/"));
    tries.push(before.concat(after).join("/") || "/");
    var out = [];
    for (var j = 0; j < tries.length; j++) if (tries[j] !== path && out.indexOf(tries[j]) === -1) out.push(tries[j]);
    return out;
  }`;

/** The candidates the script tries for `path`, in order: {@link CANDIDATES_JS}, run here. */
export const fallbackCandidates = new Function(`return ${CANDIDATES_JS};`)() as (path: string, locales: readonly string[]) => string[];

/** The inline script: {@link fallbackCandidates}, then fetch, notice and replace. */
export function fallbackScript(locales: readonly string[]): string {
  return `<script id="${FALLBACK_MARK}">
(function () {
  var LOCALES = ${JSON.stringify(locales)};
  var NAMES = ${JSON.stringify(NAMES)};
  var fallbackCandidates = ${CANDIDATES_JS};
  var path = window.location.pathname;
  var cands = fallbackCandidates(path, LOCALES);
  if (!cands.length || !window.fetch) return;
  var segs = path.split("/");
  var loc = "";
  for (var k = 1; k < segs.length; k++) if (LOCALES.indexOf(segs[k]) !== -1) { loc = segs[k]; break; }
  // An \`en/\` address on a site whose English is unprefixed is the same page,
  // not a missing translation: it is followed at once, with no notice.
  var source = loc === "en";
  function tryAt(i) {
    if (i >= cands.length) return;
    fetch(cands[i], { method: "GET", credentials: "same-origin", cache: "no-store" }).then(function (r) {
      if (!r.ok) return tryAt(i + 1);
      var dest = cands[i];
      try { sessionStorage.setItem("fa-locale-fallback", dest); } catch (_e) {}
      var note = document.getElementById("fa-locale-fallback-note");
      if (note && !source) {
        note.hidden = false;
        var name = NAMES[loc] || loc;
        note.querySelector("[data-fa-locale]").textContent = name;
        var a = note.querySelector("a");
        a.setAttribute("href", dest + window.location.search + window.location.hash);
      }
      setTimeout(function () { window.location.replace(dest + window.location.search + window.location.hash); }, source ? 0 : 1500);
    }, function () { tryAt(i + 1); });
  }
  tryAt(0);
})();
</script>`;
}

/** The notice the script reveals, hidden until it has somewhere to go. */
const NOTICE =
  '<p id="fa-locale-fallback-note" role="status" hidden>This page is not translated into <span data-fa-locale></span> yet. ' +
  'Taking you to <a href="">the English version</a>…</p>';

/** The page written when the site has no 404 page of its own. */
function page(locales: readonly string[], home: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Page not found</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#1f2937;background:#fff}a{color:#1d4ed8}@media (prefers-color-scheme:dark){body{color:#e5e7eb;background:#111827}a{color:#93c5fd}}</style>
</head>
<body>
<h1>Page not found</h1>
${NOTICE}
<p>There is no page at this address. <a href="${home}">Go to the home page</a>.</p>
${fallbackScript(locales)}
</body>
</html>
`;
}

/**
 * Give the built site its 404 page with the fallback: write one when the site
 * has none, or add the script and notice to the one it has, once. `base` is
 * the site's path prefix (`/repo/`), for the home link.
 */
export function writeLocaleFallback404(site: string, base: string, locales: readonly string[]): "written" | "added" | "present" {
  const file = join(site, "404.html");
  if (!existsSync(file)) {
    writeFileSync(file, page(locales, base));
    return "written";
  }
  const html = readFileSync(file, "utf-8");
  if (html.includes(FALLBACK_MARK)) return "present";
  // The notice, then the script, at the end of the body: the notice is in the
  // document before the script can look for it.
  const add = NOTICE + "\n" + fallbackScript(locales);
  const end = html.search(/<\/body>/i);
  writeFileSync(file, end < 0 ? html + add : html.slice(0, end) + add + html.slice(end));
  return "added";
}
