/**
 * qa-page — the ONE integrated QA page of a harness instance, drawn by the
 * platform for every harness (owner, 2026-11-24: *"build integrated page into
 * platform"*). Grown from `qa-live.ts`, which drew the knowledge-graph table
 * and the node-view coverage table and nothing else.
 *
 * The page carries WHERE the instance's results are and a small script reads
 * them in the browser (owner card, 2026-11-10: "Load in the browser"), so a
 * publish never fetches or copies results:
 *
 * 1. `main/<pinned commit>/manifest.json` from the forge's raw host: the
 *    results for exactly the code this site runs; on a 404, `index.json`'s
 *    newest `main` entry, labelled as ANOTHER commit's.
 * 2. The manifest's `listing` (`qa-store.ts`, written at publish): every record
 *    with its axis and its counts in the shared vocabulary
 *    (`schemas/sdlc/qa-axis.ts`). That is the whole summary: one fetch, and no
 *    call to the forge's tree API, whose unauthenticated rate limit made the
 *    old page read "HTTP 403" for every visitor after the first few.
 * 3. One summary tile per axis — rendering, Lean, compute, the knowledge graph,
 *    translations, block QA, bibliography, site build, domain — and one section
 *    each. A section's table is drawn when it is opened, and a record's checks
 *    are fetched (raw) when its row is opened.
 *
 * What the instance DECLARES shapes the page (`<instance>.json` `qa`): an axis
 * it lists with nothing published is drawn as "nothing published — unknown",
 * never left out, and its writers' `writes` globs put their files on their axis.
 * The visualiser's `sections` (the harness's own declaration) are linked as
 * further sections: translation status, health, attestations.
 *
 * Every count is in one vocabulary — pass, fail, warn, unknown, n/a — and a
 * count nobody took is not drawn as zero. An entry that predates the listing
 * falls back to the forge's tree API, when the forge has one, and says so.
 *
 * Nothing here names an owner, a repository or a forge host: the source and
 * the forge's URL patterns are the caller's inputs ({@link QaForge}).
 *
 * @module scripts/qa-page
 */

import { QA_AXES, QA_AXIS_TITLES, QA_FORMAT_RULES, type QaDeclaration } from "../schemas/sdlc/qa-axis.ts";
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

/**
 * How a forge serves a repository, as URL templates over `{repo}`, `{branch}`,
 * `{ref}` and `{path}`. GitHub's is {@link GITHUB_FORGE}; another forge is
 * another value, never an edit to the page script.
 */
export interface QaForge {
  /** A file on a branch, unauthenticated: `{repo}`, `{branch}`, `{path}`. */
  raw: string;
  /** A directory on a branch, for a person: `{repo}`, `{branch}`, `{path}`. */
  tree: string;
  /** A file at a commit, for a person: `{repo}`, `{ref}`, `{path}`. */
  blob: string;
  /** Optional: a recursive tree listing, used only for an entry with no `listing`. */
  treeApi?: string;
}

export const GITHUB_FORGE: QaForge = {
  raw: "https://raw.githubusercontent.com/{repo}/refs/heads/{branch}/{path}",
  tree: "https://github.com/{repo}/tree/{branch}/{path}",
  blob: "https://github.com/{repo}/blob/{ref}/{path}",
  treeApi: "https://api.github.com/repos/{repo}/git/trees/{branch}:{path}?recursive=1",
};

/** A further section linked from the page: another visualiser's page for this instance. */
export interface QaSectionLink {
  id: string;
  title: string;
  href: string;
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
const fill = (t: string, v: Record<string, string>): string => t.replace(/\{(\w+)\}/g, (m, k: string) => (k in v ? v[k]! : m));

/** The page's inputs beyond the source: the instance's own declaration, its forge, its further sections. */
export interface QaPageOptions {
  /** The instance's `qa` declaration, if it makes one. */
  decl?: QaDeclaration;
  forge?: QaForge;
  sections?: readonly QaSectionLink[];
}

/**
 * The integrated panel and the script that fills it. Everything the script
 * needs is in data attributes; its values are written with `textContent`,
 * never as HTML.
 */
export function qaIntegratedPanel(src: QaLiveSource, opts: QaPageOptions = {}): string {
  const forge = opts.forge ?? GITHUB_FORGE;
  const branchUrl = fill(forge.tree, { repo: src.repository, branch: src.branch, path: "" }).replace(/\/$/, "");
  const writers = (opts.decl?.writers ?? []).map((w) => ({ id: w.id, axis: w.axis, writes: w.writes, ...(w.title ? { title: w.title } : {}) }));
  const config = {
    axes: opts.decl?.axes ?? [],
    writers,
    order: QA_AXES,
    titles: QA_AXIS_TITLES,
    rules: QA_FORMAT_RULES,
    forge,
  };
  const sections = (opts.sections ?? []).length
    ? `<h2 class="sv-h2">Further QA of this instance</h2><ul class="sv-qa-links">` +
      (opts.sections ?? []).map((x) => `<li><a href="${attr(x.href)}">${attr(x.title)}</a></li>`).join("") +
      `</ul>`
    : "";
  return (
    `<h2 class="sv-h2">Results</h2>` +
    `<div class="sv-qa-live" data-repo="${attr(src.repository)}" data-ref="${attr(src.ref)}" ` +
    `data-branch="${attr(src.branch)}" data-root="${attr(src.root)}" data-config="${attr(JSON.stringify(config))}">` +
    `<p class="sv-sub">Loading this instance's QA results from <a href="${attr(branchUrl)}">its <code>${attr(src.branch)}</code> branch</a>…</p>` +
    `<noscript><p class="sv-sub">These results are read in the browser. ` +
    `Without JavaScript, see <a href="${attr(branchUrl)}">the <code>${attr(src.branch)}</code> branch</a>.</p></noscript>` +
    `</div>` +
    sections +
    `<style>${QA_PAGE_CSS}</style>` +
    `<script>${QA_PAGE_JS}</script>`
  );
}

/** @deprecated the integrated panel with no declaration; kept for callers of `qa-live.ts`. */
export const qaLivePanel = (src: QaLiveSource): string => qaIntegratedPanel(src);

/**
 * Tiles and sections. Colourless, as the dashboards are: a state is told by
 * its WORD and a border weight, never by hue, so it survives forced colours.
 */
export const QA_PAGE_CSS =
  ".sv-qa-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(11rem,1fr));gap:.6rem;margin:.8rem 0 1.4rem;padding:0;list-style:none}" +
  ".sv-qa-tiles>li::before,.sv-qa-links>li::before{content:none}" +
  ".sv-qa-tile{border:1px solid rgba(127,127,127,.45);border-radius:8px;padding:.6rem .8rem}" +
  ".sv-qa-tile a{display:block;text-decoration:none!important}" +
  ".sv-qa-tile.is-fail{border-width:3px;border-color:currentColor}" +
  ".sv-qa-tile.is-warn,.sv-qa-tile.is-unknown{border-style:dashed;border-width:2px}" +
  ".sv-qa-tile-t{display:block;font-weight:600;font-size:.95rem}" +
  ".sv-qa-tile-s{display:block;font-size:.72rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;margin:.15rem 0}" +
  ".sv-qa-tile-c{display:block;font-size:.8rem;opacity:.85}" +
  ".sv-qa-sec{border:1px solid rgba(127,127,127,.35);border-radius:8px;margin:.6rem 0;padding:.4rem .8rem}" +
  ".sv-qa-sec>summary{cursor:pointer;font-weight:600;padding:.3rem 0}" +
  ".sv-qa-sec>summary .sv-qa-tile-s{display:inline;margin-left:.6rem}" +
  ".sv-qa-sec>summary .sv-qa-tile-c{display:inline;margin-left:.6rem;font-weight:400}" +
  ".sv-qa-sec table{width:100%;font-size:.85rem}" +
  ".sv-qa-live-row{cursor:pointer}.sv-qa-live-row:hover,.sv-qa-live-row:focus{background:rgba(127,127,127,.12)}" +
  ".sv-qa-live-row[aria-expanded=true] td:first-child::before{content:'\\25BE  '}" +
  ".sv-qa-live-row[aria-expanded=false] td:first-child::before{content:'\\25B8  '}" +
  ".sv-qa-live-detail td{background:rgba(127,127,127,.06)}" +
  ".sv-qa-links{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:.5rem 1.2rem}";

/**
 * The page script. Plain ES5, no Liquid-like `{{`/`{%` (the page is also
 * marked `render_with_liquid: false`), every value written with
 * `textContent`.
 */
export const QA_PAGE_JS = String.raw`(function () {
  "use strict";
  var boxes = document.querySelectorAll(".sv-qa-live");
  for (var i = 0; i < boxes.length; i++) run(boxes[i]);

  var KEYS = ["fail", "warn", "unknown", "pass", "na"];
  var WORDS = { fail: "fail", warn: "warn", unknown: "unknown", pass: "pass", na: "n/a" };

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
  function fill(t, v) {
    return t.replace(/\{(\w+)\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(v, k) ? v[k] : m;
    });
  }
  function enc(p) {
    return p.split("/").map(encodeURIComponent).join("/");
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
  function glob(g, p) {
    var re = "";
    for (var i = 0; i < g.length; i++) {
      var c = g.charAt(i);
      if (c === "*" && g.charAt(i + 1) === "*") {
        re += ".*";
        i++;
        if (g.charAt(i + 1) === "/") i++;
      } else if (c === "*") re += "[^/]*";
      else re += c.replace(/[.+?^$(){}|[\]\\]/g, "\\$&");
    }
    return new RegExp("^" + re + "$").test(p);
  }
  /** The record's axis: a declared writer's glob, then the publisher's, then the format rules. */
  function axisOf(cfg, path, schema, given) {
    for (var i = 0; i < cfg.writers.length; i++) {
      var w = cfg.writers[i];
      for (var j = 0; j < w.writes.length; j++) if (glob(w.writes[j], path)) return w.axis;
    }
    if (given) return given;
    var r, k;
    if (schema) for (k = 0; k < cfg.rules.length; k++) if ((cfg.rules[k].schemas || []).indexOf(schema) >= 0) return cfg.rules[k].axis;
    var p = "/" + path;
    for (k = 0; k < cfg.rules.length; k++) {
      r = cfg.rules[k].paths || [];
      for (var m = 0; m < r.length; m++) {
        var s = r[m];
        if (s.charAt(s.length - 1) === "/" ? p.indexOf(s) >= 0 : p.slice(-s.length) === s) return cfg.rules[k].axis;
      }
    }
    return "unclassified";
  }
  function add(a, b) {
    if (!b) return;
    for (var i = 0; i < KEYS.length; i++) if (typeof b[KEYS[i]] === "number") a[KEYS[i]] = (a[KEYS[i]] || 0) + b[KEYS[i]];
  }
  /** The word a tile carries: the worst result; uncounted or empty is unknown, never pass. */
  function stateOf(c, n, uncounted) {
    if (n === 0) return "unknown";
    if (c.fail) return "fail";
    if (c.warn) return "warn";
    if (c.unknown || uncounted) return "unknown";
    if (c.pass) return "pass";
    if (c.na) return "na";
    return "unknown";
  }
  function countsText(c, n, uncounted) {
    if (n === 0) return "nothing published";
    var parts = [];
    for (var i = 0; i < KEYS.length; i++) if (typeof c[KEYS[i]] === "number") parts.push(c[KEYS[i]] + " " + WORDS[KEYS[i]]);
    var s = n + " record" + (n === 1 ? "" : "s");
    if (parts.length) s += ": " + parts.join(" · ");
    if (uncounted) s += (parts.length ? "; " : ": ") + uncounted + " not counted";
    return s;
  }

  function run(box) {
    var src = {
      repo: box.getAttribute("data-repo"),
      ref: box.getAttribute("data-ref"),
      branch: box.getAttribute("data-branch"),
      root: box.getAttribute("data-root"),
    };
    var cfg = JSON.parse(box.getAttribute("data-config") || "{}");
    cfg.writers = cfg.writers || [];
    cfg.rules = cfg.rules || [];
    cfg.axes = cfg.axes || [];
    cfg.order = cfg.order || [];
    cfg.titles = cfg.titles || {};
    var forge = cfg.forge;
    src.raw = function (path) {
      return fill(forge.raw, { repo: src.repo, branch: src.branch, path: enc(path) });
    };
    src.blobOf = function (path) {
      return fill(forge.blob, { repo: src.repo, ref: src.ref, path: enc(path) });
    };
    src.tree = function (path) {
      return fill(forge.tree, { repo: src.repo, branch: src.branch, path: enc(path) });
    };
    getJson(src.raw("main/" + src.ref + "/manifest.json"))
      .then(
        function (m) {
          return { key: "main/" + src.ref, manifest: m, exact: true };
        },
        function (e) {
          if (e.status !== 404) throw e;
          return getJson(src.raw("index.json")).then(
            function (ix) {
              if (!ix || !ix.main || !ix.main.sha) throw new Error(src.branch + " holds no main entry");
              var key = "main/" + ix.main.sha;
              return getJson(src.raw(key + "/manifest.json")).then(function (m) {
                return { key: key, manifest: m, exact: false };
              });
            },
            function (e2) {
              if (e2.status === 404) {
                var none = new Error("no QA results are published for this instance yet: " + src.repo + " has no " + src.branch + " branch");
                none.quiet = true;
                throw none;
              }
              throw e2;
            },
          );
        },
      )
      .then(function (hit) {
        var pre = src.root + "/";
        var m = hit.manifest || {};
        if (Array.isArray(m.listing)) {
          var recs = [];
          for (var i = 0; i < m.listing.length; i++) {
            var x = m.listing[i];
            if (!x || typeof x.path !== "string" || x.path.indexOf(pre) !== 0) continue;
            var rel = x.path.slice(pre.length);
            recs.push({ path: rel, schema: x.schema, subject: x.subject, counts: x.counts, axis: axisOf(cfg, rel, x.schema, x.axis) });
          }
          return { hit: hit, recs: recs, via: "listing" };
        }
        if (!forge.treeApi) throw new Error("this entry carries no listing and the forge has no tree listing to fall back to");
        var api = fill(forge.treeApi, { repo: src.repo, branch: encodeURIComponent(src.branch), path: encodeURIComponent(hit.key + "/" + src.root) });
        return getJson(api).then(function (t) {
          var recs = (t.tree || [])
            .filter(function (x) {
              return x.type === "blob" && /\.json$/.test(x.path);
            })
            .map(function (x) {
              return { path: x.path, axis: axisOf(cfg, x.path) };
            });
          return { hit: hit, recs: recs, via: "tree", truncated: t.truncated === true };
        });
      })
      .then(function (r) {
        render(box, src, cfg, r);
      })
      .catch(function (e) {
        say(box, e.quiet ? "Not available: " + e.message + "." : "Could not load this instance's QA results (" + e.message + "). This is unknown, not zero.");
      });
  }

  function render(box, src, cfg, r) {
    var hit = r.hit;
    box.textContent = "";
    var head = el("p", null, "sv-sub");
    head.appendChild(document.createTextNode("Entry "));
    head.appendChild(link(src.tree(hit.key + "/" + src.root), hit.key.slice(0, 12)));
    if (hit.manifest && hit.manifest.written_at) head.appendChild(document.createTextNode(", written " + hit.manifest.written_at));
    var runUrl = hit.manifest && hit.manifest.producer && hit.manifest.producer.run;
    if (runUrl && /^https:\/\//.test(runUrl)) {
      head.appendChild(document.createTextNode(", by "));
      head.appendChild(link(runUrl, "this run"));
    }
    head.appendChild(document.createTextNode("."));
    box.appendChild(head);
    if (!hit.exact) {
      box.appendChild(el("p", "The commit this site pins (" + src.ref.slice(0, 7) + ") has no entry, so these are the newest main entry's results: ANOTHER commit's, not exactly the code this site runs.", "sv-sub"));
    }
    if (r.via === "tree") {
      box.appendChild(el("p", "This entry predates the published listing, so its files were listed from the forge and are counted only when a section is opened." + (r.truncated ? " The forge truncated the list, so this is not every record." : ""), "sv-sub"));
    }
    // Group by axis: declared axes always, then any axis a record is on, in page order.
    var groups = {};
    var names = [];
    function group(a) {
      if (!groups[a]) {
        groups[a] = { axis: a, recs: [], counts: {}, uncounted: 0 };
        names.push(a);
      }
      return groups[a];
    }
    var i;
    for (i = 0; i < cfg.axes.length; i++) group(cfg.axes[i]);
    for (i = 0; i < r.recs.length; i++) {
      var g = group(r.recs[i].axis);
      g.recs.push(r.recs[i]);
      if (r.recs[i].counts) add(g.counts, r.recs[i].counts);
      else g.uncounted++;
    }
    names.sort(function (a, b) {
      var oa = cfg.order.indexOf(a), ob = cfg.order.indexOf(b);
      return (oa < 0 ? 99 : oa) - (ob < 0 ? 99 : ob) || a.localeCompare(b);
    });
    if (names.length === 0) {
      box.appendChild(el("p", "The entry holds no QA record and this instance declares no QA axis."));
      return;
    }
    var tiles = el("ul", null, "sv-qa-tiles");
    box.appendChild(tiles);
    var secs = [];
    for (i = 0; i < names.length; i++) {
      var gr = groups[names[i]];
      var t = cfg.titles[gr.axis] || { title: gr.axis === "unclassified" ? "Unclassified" : gr.axis, about: gr.axis === "unclassified" ? "Records no writer, format or path places on an axis." : "" };
      gr.title = t.title;
      gr.about = t.about;
      gr.state = stateOf(gr.counts, gr.recs.length, gr.uncounted);
      var li = el("li", null, "sv-qa-tile is-" + gr.state);
      var a = link("#qa-axis-" + gr.axis, null);
      a.appendChild(el("span", t.title, "sv-qa-tile-t"));
      a.appendChild(el("span", WORDS[gr.state], "sv-qa-tile-s"));
      a.appendChild(el("span", countsText(gr.counts, gr.recs.length, gr.uncounted), "sv-qa-tile-c"));
      li.appendChild(a);
      tiles.appendChild(li);
      // A tile opens its section as well as jumping to it; the browser fires "toggle".
      secs.push(section(src, hit, gr));
      a.addEventListener("click", opener(secs[secs.length - 1]));
    }
    for (i = 0; i < secs.length; i++) box.appendChild(secs[i]);
  }

  function opener(d) {
    return function () {
      d.open = true;
    };
  }

  /** One axis: a summary line, and its table drawn on first open. */
  function section(src, hit, g) {
    var d = el("details", null, "sv-qa-sec");
    d.id = "qa-axis-" + g.axis;
    var s = el("summary");
    s.appendChild(document.createTextNode(g.title));
    s.appendChild(el("span", WORDS[g.state], "sv-qa-tile-s"));
    s.appendChild(el("span", countsText(g.counts, g.recs.length, g.uncounted), "sv-qa-tile-c"));
    d.appendChild(s);
    var drawn = false;
    d.addEventListener("toggle", function () {
      if (drawn || !d.open) return;
      drawn = true;
      if (g.about) d.appendChild(el("p", g.about, "sv-sub"));
      if (g.recs.length === 0) {
        d.appendChild(el("p", "Nothing is published for this axis at this commit. That is unknown, not zero: no writer ran, or its record was not kept."));
        return;
      }
      d.appendChild(table(src, hit, g.recs));
    });
    return d;
  }

  function rank(x) {
    var c = x.counts;
    if (!c) return 2;
    return c.fail ? 0 : c.warn ? 1 : c.unknown ? 2 : 3;
  }

  function table(src, hit, recs) {
    recs = recs.slice().sort(function (a, b) {
      return rank(a) - rank(b) || a.path.localeCompare(b.path);
    });
    var tbl = el("table", null, "sv-qa-live-table");
    var thead = el("thead");
    var hr = el("tr");
    ["record", "pass", "fail", "warn", "unknown", "n/a"].forEach(function (h) {
      hr.appendChild(el("th", h));
    });
    thead.appendChild(hr);
    tbl.appendChild(thead);
    var tbody = el("tbody");
    recs.forEach(function (x) {
      var tr = el("tr", null, "sv-qa-live-row");
      tr.setAttribute("tabindex", "0");
      tr.setAttribute("role", "button");
      tr.setAttribute("aria-expanded", "false");
      tr.title = "Show this record's checks";
      var c = x.counts;
      [x.subject || x.path].concat(
        ["pass", "fail", "warn", "unknown", "na"].map(function (k) {
          return !c ? "not counted" : typeof c[k] === "number" ? c[k] : "";
        }),
      ).forEach(function (v) {
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
        detail = el("tr", null, "sv-qa-live-detail");
        var td = el("td");
        td.colSpan = 6;
        detail.appendChild(td);
        td.appendChild(el("p", "Loading…", "sv-sub"));
        tbody.insertBefore(detail, tr.nextSibling);
        tr.setAttribute("aria-expanded", "true");
        var url = src.raw(hit.key + "/" + src.root + "/" + x.path);
        getJson(url).then(
          function (doc) {
            td.textContent = "";
            details(td, src, x, doc, url);
          },
          function (e) {
            td.textContent = "";
            td.appendChild(el("p", "Could not read this record (" + e.message + "). Unknown, not zero.", "sv-sub"));
          },
        );
      }
      tr.addEventListener("click", toggle);
      tr.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggle();
        }
      });
    });
    tbl.appendChild(tbody);
    return tbl;
  }

  var ORDER = { fail: 0, warn: 1, unknown: 2, pass: 3, "n/a": 4 };

  /** A record's checks, by the shape it has: criteria, families, findings or rows. */
  function details(td, src, x, doc, url) {
    var p = el("p", null, "sv-sub");
    var path = doc && doc.subject && doc.subject.path;
    if (typeof path === "string" && /^[\w.\/-]+$/.test(path) && src.blobOf) {
      p.appendChild(link(src.blobOf(path), path));
      p.appendChild(document.createTextNode(". "));
    }
    p.appendChild(document.createTextNode((x.schema ? x.schema + " · " : "") + x.path + " · "));
    p.appendChild(link(url, "full record"));
    td.appendChild(p);
    var ul = el("ul");
    var crit = doc && doc.criteria;
    if (crit && typeof crit === "object") {
      var names = [];
      for (var k in crit) if (Object.prototype.hasOwnProperty.call(crit, k) && crit[k]) names.push(k);
      var res = function (n) {
        var v = crit[n];
        if (Array.isArray(v)) v = v[v.length - 1] || {};
        return v;
      };
      names.sort(function (a, b) {
        var oa = ORDER[res(a).result], ob = ORDER[res(b).result];
        return (oa == null ? 5 : oa) - (ob == null ? 5 : ob) || a.localeCompare(b);
      });
      names.forEach(function (n) {
        var c = res(n);
        var li = el("li");
        li.appendChild(el("strong", String(c.result || "?")));
        li.appendChild(document.createTextNode(" " + n));
        var fs = Array.isArray(c.findings) ? c.findings : Array.isArray(c.evidence) ? c.evidence : [];
        if (fs.length) {
          var inner = el("ul");
          fs.slice(0, 50).forEach(function (f) {
            var where = f && f.where ? f.where + ": " : "";
            var what = f && f.detail != null ? f.detail : typeof f === "string" ? f : JSON.stringify(f);
            inner.appendChild(el("li", where + what));
          });
          li.appendChild(inner);
        }
        ul.appendChild(li);
      });
    } else if (doc && doc.families && typeof doc.families === "object") {
      for (var f in doc.families) {
        if (!Object.prototype.hasOwnProperty.call(doc.families, f)) continue;
        var fam = doc.families[f] || {};
        ul.appendChild(el("li", f + ": " + fam.count + (fam.summary ? " — " + fam.summary : "")));
      }
    } else if (doc && Array.isArray(doc.findings)) {
      doc.findings.slice(0, 100).forEach(function (fd) {
        ul.appendChild(el("li", typeof fd === "string" ? fd : (fd.severity ? fd.severity + " " : "") + (fd.where ? fd.where + ": " : "") + (fd.detail || fd.message || JSON.stringify(fd))));
      });
    } else if (doc && Array.isArray(doc.rows)) {
      doc.rows.slice(0, 100).forEach(function (rw) {
        ul.appendChild(el("li", JSON.stringify(rw)));
      });
    } else if (doc && typeof doc === "object") {
      // A format the page has no reader for: its list-valued fields, by size.
      for (var key in doc) {
        if (!Object.prototype.hasOwnProperty.call(doc, key)) continue;
        if (Array.isArray(doc[key])) ul.appendChild(el("li", key + ": " + doc[key].length));
      }
      if (!ul.firstChild) ul.appendChild(el("li", "No reader for this format here; open the full record."));
    }
    td.appendChild(ul);
  }
})();`;

/** @deprecated the old name; the script is the integrated page's. */
export const QA_LIVE_JS = QA_PAGE_JS;
