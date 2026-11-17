/**
 * site-qa-panel — what a site's build published with, shown on its QA pages.
 *
 * Owner, 2026-11-14: a publish no longer refuses over a shortfall (*"It
 * shouldn't fail if there is an issue it should be a QA report"*). Instead
 * `build-instance-site.ts` writes three reports into the built site, beside
 * each other:
 *
 * - `assets/site-qa/parity.json` (`site-parity-report/v1`): what the build
 *   lacks that the published root it replaced carries. It is written only on
 *   a root publish that had a published root to compare with;
 * - `assets/site-qa/build.json` (`site-build-qa/v1`): the findings it
 *   published with (coverage, inline scripts, chrome, required files);
 * - `assets/site-qa/links.json` (`site-link-report/v1`): unresolved links.
 *
 * Nothing read them. This module draws them: {@link withSiteQaPanel} adds a
 * panel to a QA page, and its script reads the three files IN THE BROWSER, by
 * a path relative to the page, so the panel never goes stale against the
 * build that wrote them. A file that is missing, unreachable or not the
 * schema it should be is SAID, never drawn as an empty table: unknown, not
 * zero (the rule `qa-live.ts` follows).
 *
 * @module scripts/site-qa-panel
 * @covers none — a page panel: it draws reports a build wrote and judges nothing
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";

/** Where a build leaves its QA reports, relative to the site root. */
export const SITE_QA_DIR = "assets/site-qa";

/** The attribute that marks the panel, so it is added to a page once. */
export const SITE_QA_MARK = "data-fa-site-qa";

/** The pages of a site that carry the panel: a QA visualiser's own page, and its page for the site's own layer. */
export function siteQaRoutes(
  expected: readonly { route: string; visualiser: string; instance?: string }[],
  qaVisualisers: ReadonlySet<string>,
  ownInstance: string | undefined,
): string[] {
  const routes = expected
    .filter((p) => qaVisualisers.has(p.visualiser) && (p.instance === undefined || p.instance === ownInstance))
    .map((p) => p.route);
  return [...new Set(routes)];
}

/** The path from a page at `route` (site-relative, `a/b/`) up to the site root, as a relative URL. */
export function toSiteRoot(route: string): string {
  const depth = route.split("/").filter(Boolean).length;
  return depth === 0 ? "." : posix.join(...Array<string>(depth).fill(".."));
}

const attr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The panel: a heading, a box the script fills, and the script. `toRoot` is the page's relative path to the site root. */
export function siteQaPanel(toRoot: string): string {
  const dir = `${toRoot.replace(/\/+$/, "")}/${SITE_QA_DIR}`;
  return (
    `<section ${SITE_QA_MARK}>` +
    `<h2 class="sv-h2" id="site-build-qa">This site's build</h2>` +
    `<div class="sv-site-qa" data-dir="${attr(dir)}">` +
    `<p class="sv-sub">Loading what this site's build published with…</p>` +
    `<noscript><p class="sv-sub">These reports are read in the browser. Without JavaScript, open ` +
    `<a href="${attr(dir)}/parity.json">parity.json</a>, <a href="${attr(dir)}/build.json">build.json</a> and ` +
    `<a href="${attr(dir)}/links.json">links.json</a>.</p></noscript>` +
    `</div>` +
    `<script>${SITE_QA_JS}</script>` +
    `</section>`
  );
}

/**
 * `html` with the panel added once, before `</body>` (else at the end). A page
 * that already carries it is returned unchanged, so a second build pass is a
 * no-op.
 */
export function withSiteQaPanel(html: string, route: string): string {
  if (html.includes(SITE_QA_MARK)) return html;
  const panel = siteQaPanel(toSiteRoot(route));
  const at = html.search(/<\/body>/i);
  return at < 0 ? html + panel : html.slice(0, at) + panel + html.slice(at);
}

/**
 * Add the panel to each page of `routes` the built `site` holds
 * (`<route>index.html`). Returns the routes it added it to; a route the site
 * does not hold is left out, never created.
 */
export function placeSiteQaPanel(site: string, routes: readonly string[]): string[] {
  const placed: string[] = [];
  for (const route of routes) {
    const file = join(site, route, "index.html");
    if (!existsSync(file)) continue;
    const before = readFileSync(file, "utf-8");
    const after = withSiteQaPanel(before, route);
    if (after !== before) writeFileSync(file, after);
    placed.push(route);
  }
  return placed;
}

/**
 * The page script. Plain ES5, no `{{` or `{%` (the page may go through
 * Liquid), every value written with `textContent`, never as HTML.
 */
export const SITE_QA_JS = String.raw`(function () {
  "use strict";
  var boxes = document.querySelectorAll(".sv-site-qa");
  for (var i = 0; i < boxes.length; i++) run(boxes[i]);

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = String(text);
    if (cls) e.className = cls;
    return e;
  }
  function list(items, max) {
    var ul = el("ul");
    for (var i = 0; i < items.length && i < max; i++) ul.appendChild(el("li", items[i]));
    if (items.length > max) ul.appendChild(el("li", "… and " + (items.length - max) + " more"));
    return ul;
  }
  function load(u) {
    return fetch(u).then(
      function (r) {
        if (!r.ok) return { status: r.status };
        return r.json().then(
          function (doc) {
            return { doc: doc };
          },
          function () {
            return { bad: "is not JSON" };
          },
        );
      },
      function (e) {
        return { error: String((e && e.message) || e) };
      },
    );
  }
  function unknown(box, name, r, absent) {
    var why = r.status === 404 ? absent : r.status ? "it answered HTTP " + r.status : r.error ? "it could not be reached (" + r.error + ")" : "it " + r.bad;
    box.appendChild(el("p", name + ": " + why + ". Unknown, not zero.", "sv-sub"));
  }

  function run(box) {
    var dir = box.getAttribute("data-dir");
    Promise.all([load(dir + "/parity.json"), load(dir + "/build.json"), load(dir + "/links.json")]).then(function (rs) {
      box.textContent = "";
      parity(box, dir, rs[0]);
      build(box, dir, rs[1]);
      links(box, dir, rs[2]);
    });
  }

  function parity(box, dir, r) {
    box.appendChild(el("h3", "Against the published site it replaced"));
    var d = r.doc;
    if (!d || d.$schema !== "site-parity-report/v1") {
      if (d) r = { bad: "is not a site-parity-report/v1" };
      return unknown(box, "parity.json", r, "no parity report: this build was a preview, or had no published site to compare with");
    }
    var short = Array.isArray(d.shortfall) ? d.shortfall : [];
    var dropped = Array.isArray(d.droppedByRuling) ? d.droppedByRuling : [];
    var head =
      d.outcome === "carries-everything"
        ? "It carries everything the published site carried."
        : d.outcome === "refused"
          ? "It was REFUSED: it lacks " + short.length + " thing(s) the published site carried."
          : "It was published lacking " + short.length + " thing(s) the published site carried:";
    box.appendChild(el("p", head));
    if (short.length) box.appendChild(list(short, 50));
    if (dropped.length) {
      box.appendChild(el("p", dropped.length + " thing(s) were dropped by the owner's ruling, not as a shortfall:", "sv-sub"));
      box.appendChild(
        list(
          dropped.map(function (x) {
            return x.what + " (" + x.ruling + ")";
          }),
          20,
        ),
      );
    }
  }

  function build(box, dir, r) {
    box.appendChild(el("h3", "What the build published with"));
    var d = r.doc;
    if (!d || d.$schema !== "site-build-qa/v1" || !Array.isArray(d.findings)) {
      if (d) r = { bad: "is not a site-build-qa/v1" };
      return unknown(box, "build.json", r, "no build report: this site was built before builds recorded one");
    }
    if (d.findings.length === 0) return box.appendChild(el("p", "No findings: the build published with nothing to report."));
    var by = {};
    var order = [];
    d.findings.forEach(function (f) {
      var k = (f && f.check) || "other";
      if (!by[k]) {
        by[k] = [];
        order.push(k);
      }
      by[k].push((f && f.detail) || JSON.stringify(f));
    });
    box.appendChild(el("p", d.findings.length + " finding(s), published rather than refused:"));
    order.forEach(function (k) {
      box.appendChild(el("h4", k + " (" + by[k].length + ")"));
      box.appendChild(list(by[k], 50));
    });
  }

  function links(box, dir, r) {
    box.appendChild(el("h3", "Links"));
    var d = r.doc;
    if (!d || d.$schema !== "site-link-report/v1") {
      if (d) r = { bad: "is not a site-link-report/v1" };
      return unknown(box, "links.json", r, "no link report: this site was built before builds recorded one");
    }
    var n = function (xs) {
      return Array.isArray(xs) ? xs.length : 0;
    };
    box.appendChild(
      el(
        "p",
        (d.pages || 0) + " page(s) checked: " + n(d.unresolved) + " unresolved, " + n(d.content) + " unresolved on pages the content supplies, " +
          n(d.selfAddress) + " absolute link(s) to this site that reach no page, " + n(d.inDiagrams) + " inside diagrams.",
      ),
    );
    var rows = (Array.isArray(d.unresolved) ? d.unresolved : []).map(function (x) {
      return x.page + ": " + x.href;
    });
    if (rows.length) box.appendChild(list(rows, 50));
  }
})();`;
