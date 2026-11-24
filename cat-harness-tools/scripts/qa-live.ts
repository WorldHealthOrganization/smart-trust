/**
 * qa-live — a layer's QA results, read by the BROWSER from the layer's own
 * `qa-reports` branch when its QA page is viewed, never fetched or copied at
 * publish (owner card, 2026-11-10: "Load in the browser").
 *
 * A site that mounts a layer holds none of its derived QA (it lives on the
 * layer's `qa-reports` branch, `qa-store.ts`), so the per-layer QA page used to
 * say "not available in this build" for every mounted layer. This page instead
 * carries where the results are — the layer's repository, the commit the
 * site's `index.lock.json` pins it at, the branch and the entry's root — and a
 * small script reads them:
 *
 * 1. `main/<pinned commit>/manifest.json` from `raw.githubusercontent.com`:
 *    the results for exactly the code this site runs;
 * 2. on a 404, `index.json`'s newest `main` entry, labelled as ANOTHER commit's
 *    results (`fetched-fallback` in `qa-site-assets.ts` terms);
 * 3. the entry's file list from the GitHub trees API (one call per page view),
 *    then each `kg-qa/v1` record from raw, rendered as one table;
 * 4. each `node-view-coverage/v1` report (`node-views/*.node-views.qa.json`,
 *    owner 2026-11-13, card A) from raw, as a second table: per folder and
 *    kind, how many nodes have an IRI, a `.jsonld`, a page and a row.
 *
 * Every miss is said: no branch, no entry or an unreachable GitHub reads
 * "unknown, not zero", never an empty table.
 *
 * @module scripts/qa-live
 */

import type { InstanceSubject } from "./state-visualizer.ts";

/** Where one layer's QA results are, for the browser to read. */
export interface QaLiveSource {
  /** `owner/name` of the layer's repository. */
  repository: string;
  /** The commit the site pins the layer at. */
  ref: string;
  /** The branch the layer keeps its QA records on. */
  branch: string;
  /** The entry-relative root of the layer's results (`<layer>/test/results`). */
  root: string;
}

const REPO = /^[\w.-]+\/[\w.-]+$/;
const SHA = /^[0-9a-f]{7,40}$/;
const BRANCH = /^[\w.-]+(\/[\w.-]+)*$/;
const ROOT = /^[\w.-]+(\/[\w.-]+)*$/;

/**
 * The live source of a layer's QA page: its declared storage branch and the
 * repository and commit the site pins it at. `undefined` when the directory
 * keeps no records on a branch, or the lock does not name the layer plainly:
 * the page then says what it said before, with nothing to load.
 */
export function qaLiveSourceOf(
  s: Pick<InstanceSubject, "name" | "path" | "storage">,
  mount: { repository: string; ref: string } | undefined,
): QaLiveSource | undefined {
  if (!s.storage || mount === undefined) return undefined;
  const root = `${s.name}/${s.path.replace(/^\.\//, "").replace(/\/+$/, "")}`;
  const src = { repository: mount.repository, ref: mount.ref, branch: s.storage, root };
  return REPO.test(src.repository) && SHA.test(src.ref) && BRANCH.test(src.branch) && ROOT.test(src.root) ? src : undefined;
}

const attr = (s: string): string => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The panel a QA page carries in place of "not available in this build", and the script that fills it. */
export function qaLivePanel(src: QaLiveSource): string {
  const branchUrl = `https://github.com/${src.repository}/tree/${src.branch}`;
  return (
    `<h2 class="sv-h2">Results</h2>` +
    `<div class="sv-qa-live" data-repo="${attr(src.repository)}" data-ref="${attr(src.ref)}" ` +
    `data-branch="${attr(src.branch)}" data-root="${attr(src.root)}">` +
    `<p class="sv-sub">Loading this layer's QA results from <a href="${attr(branchUrl)}">its <code>${attr(src.branch)}</code> branch</a>…</p>` +
    `<noscript><p class="sv-sub">These results are read in the browser. ` +
    `Without JavaScript, see <a href="${attr(branchUrl)}">the <code>${attr(src.branch)}</code> branch</a>.</p></noscript>` +
    `</div>` +
    `<style>${QA_LIVE_CSS}</style>` +
    `<script>${QA_LIVE_JS}</script>`
  );
}

/** Rows read as clickable; an open row's checks sit under it. */
const QA_LIVE_CSS =
  ".sv-qa-live-row{cursor:pointer}.sv-qa-live-row:hover,.sv-qa-live-row:focus{background:rgba(127,127,127,.12)}" +
  ".sv-qa-live-row[aria-expanded=true] td:nth-child(2)::before{content:'\\25BE  '}" +
  ".sv-qa-live-row[aria-expanded=false] td:nth-child(2)::before{content:'\\25B8  '}" +
  ".sv-qa-live-detail td{background:rgba(127,127,127,.06)}";

/**
 * The page script. Plain ES5, no Liquid-like `{{`/`{%` (the page is also
 * marked `render_with_liquid: false`), and every value written with
 * `textContent`, never as HTML.
 */
export const QA_LIVE_JS = String.raw`(function () {
  "use strict";
  var boxes = document.querySelectorAll(".sv-qa-live");
  for (var i = 0; i < boxes.length; i++) run(boxes[i]);

  function el(tag, text, cls) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = String(text);
    if (cls) e.className = cls;
    return e;
  }
  function link(href, text) {
    var a = el("a", text);
    a.href = href;
    return a;
  }
  function getJson(u) {
    return fetch(u).then(function (r) {
      if (!r.ok) {
        var e = new Error(u + " answered HTTP " + r.status);
        e.status = r.status;
        throw e;
      }
      return r.json();
    });
  }
  function say(box, text) {
    box.textContent = "";
    box.appendChild(el("p", text, "sv-sub"));
  }

  function run(box) {
    var repo = box.getAttribute("data-repo");
    var ref = box.getAttribute("data-ref");
    var branch = box.getAttribute("data-branch");
    var root = box.getAttribute("data-root");
    var raw = "https://raw.githubusercontent.com/" + repo + "/refs/heads/" + branch + "/";
    var api = "https://api.github.com/repos/" + repo + "/git/trees/";
    getJson(raw + "main/" + ref + "/manifest.json")
      .then(
        function (m) {
          return { key: "main/" + ref, manifest: m, exact: true };
        },
        function (e) {
          if (e.status !== 404) throw e;
          return getJson(raw + "index.json").then(
            function (ix) {
              if (!ix || !ix.main || !ix.main.sha) throw new Error(branch + " holds no main entry");
              var key = "main/" + ix.main.sha;
              return getJson(raw + key + "/manifest.json").then(function (m) {
                return { key: key, manifest: m, exact: false };
              });
            },
            function (e2) {
              if (e2.status === 404) {
                var none = new Error("no QA results are published for this layer yet: " + repo + " has no " + branch + " branch");
                none.quiet = true;
                throw none;
              }
              throw e2;
            },
          );
        },
      )
      .then(function (hit) {
        return getJson(api + encodeURIComponent(branch + ":" + hit.key + "/" + root) + "?recursive=1").then(function (t) {
          var files = (t.tree || []).filter(function (x) {
            return x.type === "blob" && /\.kg-qa\.json$/.test(x.path);
          });
          var views = (t.tree || []).filter(function (x) {
            return x.type === "blob" && /\.node-views\.qa\.json$/.test(x.path);
          });
          var others = (t.tree || []).filter(function (x) {
            return x.type === "blob" && !/\.kg-qa\.json$/.test(x.path) && !/\.node-views\.qa\.json$/.test(x.path);
          }).length;
          return Promise.all(
            files.map(function (f) {
              return getJson(raw + hit.key + "/" + root + "/" + f.path.split("/").map(encodeURIComponent).join("/")).catch(function () {
                return null;
              });
            }),
          ).then(function (docs) {
            render(box, { repo: repo, ref: ref, branch: branch, root: root }, hit, docs, files, others, t.truncated === true);
            return Promise.all(
              views.map(function (f) {
                return getJson(raw + hit.key + "/" + root + "/" + f.path.split("/").map(encodeURIComponent).join("/")).catch(function () {
                  return null;
                });
              }),
            ).then(function (vdocs) {
              renderViews(box, vdocs, views.length);
            });
          });
        });
      })
      .catch(function (e) {
        say(box, e.quiet ? "Not available: " + e.message + "." : "Could not load this layer's QA results (" + e.message + "). This is unknown, not zero.");
      });
  }

  function render(box, src, hit, docs, files, others, truncated) {
    box.textContent = "";
    var head = el("p", null, "sv-sub");
    head.appendChild(document.createTextNode("Entry "));
    head.appendChild(link("https://github.com/" + src.repo + "/tree/" + src.branch + "/" + hit.key + "/" + src.root, hit.key.slice(0, 12)));
    if (hit.manifest && hit.manifest.written_at) head.appendChild(document.createTextNode(", written " + hit.manifest.written_at));
    var run = hit.manifest && hit.manifest.producer && hit.manifest.producer.run;
    if (run && /^https:\/\/github\.com\//.test(run)) {
      head.appendChild(document.createTextNode(", by "));
      head.appendChild(link(run, "this run"));
    }
    head.appendChild(document.createTextNode("."));
    box.appendChild(head);
    if (!hit.exact) {
      box.appendChild(
        el(
          "p",
          "The commit this site pins (" + src.ref.slice(0, 7) + ") has no entry, so these are the newest main entry's results: ANOTHER commit's, not exactly the code this site runs.",
          "sv-sub",
        ),
      );
    }
    var rows = [];
    var sum = { pass: 0, fail: 0, "n/a": 0, unknown: 0 };
    var unreadable = 0;
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (!d || d.$schema !== "kg-qa/v1") {
        unreadable++;
        continue;
      }
      var t = d.totals || {};
      var failing = [];
      var crit = d.criteria || {};
      for (var k in crit) if (Object.prototype.hasOwnProperty.call(crit, k) && crit[k] && crit[k].result === "fail") failing.push(k);
      var row = {
        kind: (d.subject && d.subject.kind) || "",
        id: (d.subject && d.subject.id) || "",
        pass: t.pass || 0,
        fail: t.fail || 0,
        na: t["n/a"] || 0,
        unknown: t.unknown || 0,
        failing: failing,
        doc: d,
        record: "https://github.com/" + src.repo + "/blob/" + src.branch + "/" + hit.key + "/" + src.root + "/" + files[i].path.split("/").map(encodeURIComponent).join("/"),
      };
      sum.pass += row.pass;
      sum.fail += row.fail;
      sum["n/a"] += row.na;
      sum.unknown += row.unknown;
      rows.push(row);
    }
    rows.sort(function (a, b) {
      return b.fail - a.fail || b.unknown - a.unknown || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
    });
    var failed = rows.filter(function (r) {
      return r.fail > 0;
    }).length;
    box.appendChild(
      el(
        "p",
        rows.length + " subject(s) audited: " + failed + " with a failing check. Checks: " + sum.pass + " pass, " + sum.fail + " fail, " + sum["n/a"] + " n/a, " + sum.unknown + " unknown." +
          (unreadable ? " " + unreadable + " record(s) could not be read." : "") +
          (others ? " " + others + " other file(s) in the entry are not drawn here." : "") +
          (truncated ? " GitHub truncated the file list, so this is not every record." : ""),
      ),
    );
    if (rows.length === 0) return;
    var table = el("table", null, "sv-qa-live-table");
    var thead = el("thead");
    var hr = el("tr");
    ["kind", "subject", "pass", "fail", "n/a", "unknown", "failing checks"].forEach(function (h) {
      hr.appendChild(el("th", h));
    });
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr", null, "sv-qa-live-row");
      tr.setAttribute("tabindex", "0");
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-expanded", "false");
      tr.title = "Show this subject's checks";
      [r.kind, r.id, r.pass, r.fail, r.na, r.unknown, r.failing.join(", ")].forEach(function (v) {
        tr.appendChild(el("td", v));
      });
      tbody.appendChild(tr);
      var detail = null;
      function toggle() {
        if (detail) {
          tbody.removeChild(detail);
          detail = null;
          tr.setAttribute("aria-expanded", "false");
          return;
        }
        detail = details(src, r);
        tbody.insertBefore(detail, tr.nextSibling);
        tr.setAttribute("aria-expanded", "true");
      }
      tr.addEventListener("click", toggle);
      tr.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggle();
        }
      });
    });
    table.appendChild(tbody);
    box.appendChild(table);
  }

  /** The node-view coverage reports: one row per folder and kind; "unknown" stays a word, never 0. */
  function renderViews(box, vdocs, n) {
    if (n === 0) return;
    box.appendChild(el("h3", "Node-view coverage", "sv-h3"));
    var rows = [];
    var unreadable = 0;
    for (var i = 0; i < vdocs.length; i++) {
      var d = vdocs[i];
      if (!d || d.$schema !== "node-view-coverage/v1" || !Array.isArray(d.rows)) {
        unreadable++;
        continue;
      }
      for (var j = 0; j < d.rows.length; j++) rows.push(d.rows[j]);
    }
    box.appendChild(
      el(
        "p",
        "Per folder and kind: the nodes the directory holds, and how many have an IRI, a .jsonld, a page and a row on the folder page. A QA report, not a gate." +
          (unreadable ? " " + unreadable + " report(s) could not be read." : ""),
        "sv-sub",
      ),
    );
    if (rows.length === 0) return;
    var table = el("table", null, "sv-qa-live-table sv-node-views");
    var hr = el("tr");
    ["folder", "kind", "viewer", "nodes", "IRI", ".jsonld", "page", "listed", "dead links", "raw repo links"].forEach(function (h) {
      hr.appendChild(el("th", h));
    });
    var thead = el("thead");
    thead.appendChild(hr);
    table.appendChild(thead);
    var tbody = el("tbody");
    rows.forEach(function (r) {
      var tr = el("tr");
      var viewer = r.viewer && r.viewer.state === "declared" ? r.viewer.id : r.viewer ? r.viewer.state : "";
      [r.directory + " (" + r.path + ")", r.kind, viewer, r.declared, r.withIri, r.withJsonld, r.withPage, r.listed, (r.deadLinks || []).length, r.rawRepoLinks].forEach(function (v) {
        tr.appendChild(el("td", v));
      });
      if (r.reason) tr.title = r.reason;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(table);
  }

  var ORDER = { fail: 0, unknown: 1, pass: 2, "n/a": 3 };

  /** One subject's checks, drawn under its row: each result, then each finding's place and detail. */
  function details(src, r) {
    var tr = el("tr", null, "sv-qa-live-detail");
    var td = el("td");
    td.colSpan = 7;
    var p = el("p", null, "sv-sub");
    var path = r.doc.subject && r.doc.subject.path;
    if (typeof path === "string" && /^[\w.\/-]+$/.test(path)) {
      p.appendChild(document.createTextNode("Source: "));
      p.appendChild(link("https://github.com/" + src.repo + "/blob/" + src.ref + "/" + path, path));
      p.appendChild(document.createTextNode(". "));
    }
    p.appendChild(link(r.record, "Full record"));
    p.appendChild(document.createTextNode("."));
    td.appendChild(p);
    var crit = r.doc.criteria || {};
    var names = [];
    for (var k in crit) if (Object.prototype.hasOwnProperty.call(crit, k) && crit[k]) names.push(k);
    names.sort(function (a, b) {
      var oa = ORDER[crit[a].result], ob = ORDER[crit[b].result];
      return (oa == null ? 4 : oa) - (ob == null ? 4 : ob) || a.localeCompare(b);
    });
    var ul = el("ul");
    names.forEach(function (n) {
      var c = crit[n];
      var li = el("li");
      li.appendChild(el("strong", String(c.result || "?")));
      li.appendChild(document.createTextNode(" " + n));
      var fs = Array.isArray(c.findings) ? c.findings : [];
      if (fs.length) {
        var inner = el("ul");
        fs.forEach(function (f) {
          var where = f && f.where ? f.where + ": " : "";
          var what = f && f.detail != null ? f.detail : JSON.stringify(f);
          inner.appendChild(el("li", where + what));
        });
        li.appendChild(inner);
      }
      ul.appendChild(li);
    });
    td.appendChild(ul);
    tr.appendChild(td);
    return tr;
  }
})();`;
