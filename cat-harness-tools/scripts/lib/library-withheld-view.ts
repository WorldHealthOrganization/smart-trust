/**
 * How the library viewer shows a block row, and a WITHHELD entry's banner.
 *
 * @module scripts/lib/library-withheld-view
 *
 * Issue #1794, owner ruling 2026-10-01 (option 1 of 4, "fix the viewer now"):
 * each row shows the section's summary when one exists; otherwise
 * "Withheld — copyright not granted" with a link to the catalogue record; and
 * a banner at the top of a withheld entry says why.
 *
 * Measured before (PR #1799): both withheld IRIS replica entries — 121 and 250
 * blocks — rendered every row "(no content carried)". That sentence is TRUE of
 * a page-scan with no text and FALSE of a refused work, whose text is held
 * here and deliberately not published. A reader could not tell "nothing was
 * extracted" from "not ours to show", which is the distinction bean `cw35`
 * kept the entry listed in order to make.
 *
 * ## Three row outcomes, in this order
 *
 * 1. **A summary with text** — shown, labelled as a summary and never as the
 *    source text. Our writing about the work stays published for a withheld
 *    entry (owner, 2026-09-24: "Fix, keep summaries").
 * 2. **A withheld entry** — the gate's own words ("copyright and restrictions
 *    not granted"), read from the entry's `withheldBy.gates`, and a link to the
 *    catalogue record: its published page when there is one, else its upstream
 *    URI, else no link rather than a guess.
 * 3. **Anything else with no content** — the neutral "(no content carried)",
 *    unchanged, because for those it is the truth.
 *
 * **Withheld is READ, never inferred from emptiness.** The flag comes from
 * `withheld.json` through `library-graph.ts`; an entry whose rows happen to be
 * empty is case 3.
 *
 * ## Why a string of browser code rather than TypeScript
 *
 * The viewer is a single static page with an inline script (see
 * `viewerHtml`). These functions are that script's, embedded verbatim, and
 * kept here so a unit test can evaluate the SAME text the page runs — with
 * `esc`, `summaryPanel` and `SITE_ROOT` supplied — instead of a re-typed copy
 * free to disagree with it. `String.raw`, so a `—` reaches the browser as
 * the escape it is. No `${` inside: it is not interpolated, and must not be.
 */
export const WITHHELD_VIEW_JS = String.raw`
/* WITHHELD ENTRIES -- issue #1794. See scripts/lib/library-withheld-view.ts. */
var GATE_VERDICT_WORDS = { refused: "not granted" };
function joinAnd(xs){
  return xs.length > 1 ? xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1] : (xs[0] || "");
}
/* "copyright and restrictions not granted", from the recorded gates; "" when
   the list carried none, and the caller then says the recorded sentence. */
function withheldGateText(e){
  var gs = e && e.withheldBy && e.withheldBy.gates;
  if (!gs || !gs.length) return "";
  var by = {}, order = [];
  gs.forEach(function(g){
    var v = GATE_VERDICT_WORDS[g.verdict] || g.verdict;
    if (!by[v]) { by[v] = []; order.push(v); }
    by[v].push(g.gate);
  });
  return order.map(function(v){ return joinAnd(by[v]) + " " + v; }).join("; ");
}
function withheldLine(e){
  return "Withheld — " + (withheldGateText(e) || (e && e.withheld) || "not published");
}
/* The catalogue record: its published page first (a SITE-ROOT path, resolved
   the way an avatar is), its upstream URI second, nothing rather than a guess. */
function withheldRecord(e){
  var r = e && e.withheldBy && e.withheldBy.record;
  if (!r) return null;
  if (typeof r.page === "string" && r.page.charAt(0) === "/")
    return { href: SITE_ROOT + r.page.slice(1), label: "catalogue record" };
  if (typeof r.uri === "string" && r.uri) return { href: r.uri, label: "catalogue record (" + r.uri + ")" };
  return null;
}
function hasSummaryText(b){ return !!(b && b.summary && b.summary.text); }
/* ONE ROW'S CONTENT CELL. e is the entry the row belongs to. */
function blockBody(b, e){
  var title = esc(b.title || "—");
  if (b.content) {
    var extract = "<pre>" + esc(b.content) + "</pre>" +
      (b.truncated ? '<p class="note">Excerpt — the first 600 characters. The section file holds the rest.</p>' : "");
    return "<details><summary>" + title + '</summary><div class="block-body">' +
      (b.summary
        ? '<div class="pair"><div><p class="lbl">Extract</p>' + extract + "</div>" +
          '<div><p class="lbl">Agent summary</p>' + summaryPanel(b.summary) + "</div></div>"
        : extract) +
      "</div></details>";
  }
  if (hasSummaryText(b)) {
    return "<details><summary>" + title + '</summary><div class="block-body">' +
      '<p class="lbl">Summary — an account of this section, not its text</p>' +
      summaryPanel(b.summary) + "</div></details>";
  }
  if (e && e.withheld) {
    var rec = withheldRecord(e);
    return title + ' <span class="wh-line">' + esc(withheldLine(e)) +
      (rec ? ' — <a href="' + esc(rec.href) + '">' + esc(rec.label) + "</a>" : "") + "</span>";
  }
  /* No content is a DETERMINED answer for a page-scan or an image with no
     description, and is said plainly rather than left blank. */
  return title + ' <span class="note">(no content carried)</span>';
}
/* THE BANNER over a withheld entry's rows, or "" for any other entry. */
function withheldBanner(e, bs){
  if (!e || !e.withheld) return "";
  var n = bs.filter(hasSummaryText).length;
  var gates = withheldGateText(e);
  var rec = withheldRecord(e);
  return '<div class="wh-banner" role="note" title="' + esc(e.withheld) + '">' +
    "<p><b>" + esc(withheldLine(e)) + ".</b> This work's text is held here but is not published: " +
    (gates ? "the publication gates named above did not grant it." : esc(e.withheld) + ".") +
    " Each section is listed by page and title only. Where a section has a summary — an account of it, not its words — the summary is shown instead.</p>" +
    "<p>" + (rec ? 'What the work is, and who holds it: <a href="' + esc(rec.href) + '">' + esc(rec.label) + "</a>. " : "") +
    "<b>" + n + "</b> of " + bs.length + " section" + (bs.length === 1 ? "" : "s") + " summarised.</p></div>";
}
`;
