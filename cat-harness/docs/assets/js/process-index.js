/**
 * The process index — every BPMN process in the published knowledge graph,
 * read from the named-subgraph JSON-LD.
 *
 * Owner, 2026-10-02 (bean `ax6r`): the "Every workflow in the repo" table was
 * hand-maintained and drifted from the diagrams it described. Owner,
 * 2026-10-03: "Move to JSON-LD" — so there is no plain-JSON projection any
 * more. The page carries only a container, and this file fills it from the
 * same files every other consumer of the graph reads
 * (`skills/kg/kg-core/kg-export.md` §"Named subgraphs"):
 *
 *   1. `subgraph/index.jsonld` — the repository's level, whose `hasSubgraph`
 *      are the harness roots this site frames (`meta[name=fa-processes-src]`);
 *   2. each root's `index.jsonld`, whose `hasSubgraph` are its top-level
 *      directories, and each of THOSE `index.jsonld`, which says by
 *      `holdsGraph` whether it holds `processes`;
 *   3. for every top-level `processes` subgraph, its `index.hydrated.jsonld`
 *      — every Process inline, with the child subgraphs (the concern groups)
 *      nested inside it.
 *
 * A row is a `Process` node: its `name`, its `summary` (the first sentence of
 * the diagram's own `bpmn:documentation`), the concern group it sits in (the
 * subgraph below the top `processes` one), the instance whose tree it is in,
 * the processes its call activities name (`calledElement` on its
 * ProcessNodes), and its `depiction` (SVG) and `sourceUrl` (BPMN). To change
 * what a row says, change the diagram.
 *
 * Same shape as the library viewer and the work-plan dashboard: a thin page,
 * published data, a renderer that self-mounts on `[data-fa-process-index]`.
 * The pure half is on `window.faProcessIndex` so
 * `scripts/tests/process-index.test.ts` evaluates the shipped bytes.
 */
(function () {
  "use strict";

  var GROUP_NONE = "(top level)";
  var INDEX = "index.jsonld";
  var HYDRATED = "index.hydrated.jsonld";

  function compare(a, b) {
    a = String(a == null ? "" : a);
    b = String(b == null ? "" : b);
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function list(v) {
    return v == null ? [] : Array.isArray(v) ? v : [v];
  }

  /** The last segment of a compacted or expanded type — `bootstrap:Process` and `…/ns#Process` are both `Process`. */
  function localType(t) {
    return String(t == null ? "" : t).replace(/^.*[#:/]/, "");
  }

  function isProcess(node) {
    return !!node && list(node["@type"]).some(function (t) { return localType(t) === "Process"; });
  }

  /** Whether a subgraph node declares that it holds the `processes` graph typology. */
  function holdsProcesses(node) {
    return !!node && list(node.holdsGraph).some(function (k) { return /graphTypology\/processes$/.test(String(k)); });
  }

  /**
   * Where a subgraph IRI is served from HERE. The IRIs are canonical; the page
   * may be a preview or a local build, so an IRI under the repository's
   * subgraph IRI is re-rooted at the directory the repository index was read
   * from. An IRI anywhere else is not fetched — this page reads its own site.
   */
  function localUrl(iri, repoIri, srcDir, file) {
    iri = String(iri || "");
    repoIri = String(repoIri || "");
    if (!repoIri || iri.indexOf(repoIri) !== 0) return "";
    var rest = iri.slice(repoIri.length);
    if (/(^|\/)\.\.(\/|$)/.test(rest) || /^[a-z]+:/i.test(rest) || rest.charAt(0) === "/") return "";
    return String(srcDir).replace(/\/?$/, "/") + rest + (file || "");
  }

  /**
   * Every Process in one hydrated `processes` subgraph, as rows. The concern
   * group is the nesting: the path of the subgraph a process sits in, below
   * the top one the file is for. Calls come from the call-activity
   * ProcessNodes in the same tree, by `partOf`.
   */
  function rowsFromHydrated(doc, instance) {
    var rows = [];
    var calls = {};
    var top = String((doc && doc.path) || "");
    (function walk(node) {
      if (!node || typeof node !== "object") return;
      var path = String(node.path || "");
      var group = path.indexOf(top) === 0 ? path.slice(top.length).replace(/\/$/, "") : path.replace(/\/$/, "");
      list(node.hasMember).forEach(function (m) {
        if (!m || typeof m !== "object") return;
        if (isProcess(m)) {
          rows.push({
            id: String(m["@id"] || ""),
            localId: String(m["@id"] || "").replace(/^.*[#/]process\//, ""),
            name: String(m.name || m["@id"] || ""),
            summary: typeof m.summary === "string" && m.summary ? m.summary : "",
            group: group,
            instance: String(instance || ""),
            // bootstrap's subgraphs carry `source` (an absolute IRI) and no
            // `sourcePath` (bean `t8c4`); either identifies the diagram.
            path: String(m.sourcePath || m.source || ""),
            svg: typeof m.depiction === "string" ? m.depiction : "",
            source: typeof m.sourceUrl === "string" ? m.sourceUrl : typeof m.source === "string" ? m.source : "",
            calls: [],
          });
        } else if (m.calledElement != null && m.partOf != null) {
          var owner = String(list(m.partOf)[0]);
          (calls[owner] = calls[owner] || []);
          list(m.calledElement).forEach(function (c) {
            if (calls[owner].indexOf(String(c)) < 0) calls[owner].push(String(c));
          });
        }
      });
      list(node.hasSubgraph).forEach(walk);
    })(doc);
    rows.forEach(function (r) { r.calls = (calls[r.id] || []).slice().sort(); });
    return rows;
  }

  /**
   * Rows grouped by `key` ("group" — the concern group — or "instance"),
   * groups in name order, rows inside a group ordered by the OTHER key and
   * then by name. A row with no concern group is grouped under one label
   * rather than under an empty heading.
   */
  function groupRows(rows, key) {
    var by = key === "instance" ? "instance" : "group";
    var other = by === "group" ? "instance" : "group";
    var groups = {};
    (rows || []).forEach(function (r) {
      var k = r && r[by] ? String(r[by]) : GROUP_NONE;
      (groups[k] = groups[k] || []).push(r);
    });
    return Object.keys(groups).sort(function (a, b) {
      // The unlabelled group goes last: it is the remainder, not a concern.
      if (a === GROUP_NONE) return b === GROUP_NONE ? 0 : 1;
      if (b === GROUP_NONE) return -1;
      return compare(a, b);
    }).map(function (k) {
      return {
        label: k,
        rows: groups[k].slice().sort(function (x, y) {
          return compare(x[other], y[other]) || compare(x.name, y.name) || compare(x.path, y.path);
        }),
      };
    });
  }

  /**
   * Where a row links. Both links must be http(s); anything else is dropped
   * rather than linked, so a record cannot put a script URL in an href. An SVG
   * under the canonical site (`from`) is re-rooted at this one (`to`), so a
   * preview shows its own pictures.
   */
  function rowLinks(row, from, to) {
    var out = { svg: "", source: "" };
    var ok = function (u) { return typeof u === "string" && /^https?:\/\/[^/]/i.test(u); };
    if (row && ok(row.svg)) {
      out.svg = row.svg;
      if (from && to && row.svg.indexOf(from) === 0) out.svg = String(to).replace(/\/?$/, "/") + row.svg.slice(from.length).replace(/^\//, "");
    }
    if (row && ok(row.source)) out.source = row.source;
    return out;
  }

  window.faProcessIndex = {
    groupRows: groupRows,
    rowLinks: rowLinks,
    rowsFromHydrated: rowsFromHydrated,
    localUrl: localUrl,
    holdsProcesses: holdsProcesses,
    isProcess: isProcess,
    GROUP_NONE: GROUP_NONE,
  };

  var FA = window.faRender;
  if (typeof document === "undefined" || !document.querySelector) return;
  var host = document.querySelector("[data-fa-process-index]");
  if (!host) return;
  if (!FA) {
    if (window.console && console.warn) {
      console.warn("process-index: assets/js/kg-render.js did not load, so the process " +
                   "index was not drawn. The container keeps its fallback link.");
    }
    return;
  }
  var el = FA.el;

  /** Process IRI → name, so a call reads as the process it calls. An IRI nothing published stays its local id. */
  var NAMES = {};

  function renderTable(group, key, from, to) {
    var other = key === "instance" ? "Concern group" : "Instance";
    var table = el("table", { class: "fa-process-index-table" });
    table.appendChild(el("caption", null, group.label + " — " + group.rows.length));
    var head = el("tr");
    var labels = ["Process", other, "What it is for", "Diagram"];
    labels.forEach(function (h) {
      head.appendChild(el("th", { scope: "col" }, h));
    });
    table.appendChild(el("thead")).appendChild(head);
    var body = el("tbody");
    group.rows.forEach(function (r) {
      var links = rowLinks(r, from, to);
      var tr = el("tr", { "data-process-id": r.localId });
      var name = el("td");
      name.appendChild(el("strong", null, r.name));
      name.appendChild(el("br"));
      name.appendChild(el("code", null, r.localId));
      if (r.calls && r.calls.length) {
        name.appendChild(el("br"));
        name.appendChild(el("small", null, "Calls: " + r.calls.map(function (c) {
          return NAMES[c] || c.replace(/^.*[#/]process\//, "");
        }).join(" · ")));
      }
      tr.appendChild(name);
      tr.appendChild(el("td", null, key === "instance" ? (r.group || GROUP_NONE) : r.instance));
      tr.appendChild(r.summary
        ? el("td", null, r.summary)
        : el("td", { class: "fa-process-index-none" }, "This diagram carries no documentation of its own."));
      var links_td = el("td");
      if (links.svg) links_td.appendChild(el("a", { href: links.svg }, "SVG"));
      if (links.svg && links.source) links_td.appendChild(document.createTextNode(" · "));
      if (links.source) links_td.appendChild(el("a", { href: links.source }, "BPMN"));
      tr.appendChild(links_td);
      // Each cell carries its column's name, so the narrow-viewport layout can
      // stack a row into a labelled card instead of scrolling four columns.
      Array.prototype.forEach.call(tr.children, function (td, i) { td.setAttribute("data-label", labels[i]); });
      body.appendChild(tr);
    });
    table.appendChild(body);
    return table;
  }

  function render(rows, key, from, to) {
    var mount = host.querySelector(".fa-process-index-tables");
    if (!mount) {
      mount = el("div", { class: "fa-process-index-tables" });
      host.appendChild(mount);
    }
    while (mount.firstChild) mount.removeChild(mount.firstChild);
    groupRows(rows, key).forEach(function (g) {
      mount.appendChild(renderTable(g, key, from, to));
    });
  }

  function controls(rows, subgraphs, instances, from, to) {
    var bar = el("div", { class: "fa-process-index-controls", role: "group", "aria-label": "Group the processes" });
    var buttons = [["group", "By concern group"], ["instance", "By instance"]].map(function (pair) {
      var b = el("button", { type: "button", "data-key": pair[0], "aria-pressed": pair[0] === "group" ? "true" : "false" }, pair[1]);
      b.addEventListener("click", function () {
        buttons.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        render(rows, pair[0], from, to);
      });
      bar.appendChild(b);
      return b;
    });
    bar.appendChild(el("span", { class: "fa-process-index-count" },
      rows.length + " processes, read from " + subgraphs + " published processes subgraph(s) of " +
      instances + " instance(s)"));
    return bar;
  }

  var region = FA.region ? FA.region("process-index") : null;
  var meta = document.querySelector('meta[name="fa-processes-src"]');
  var src = meta ? meta.getAttribute("content") : "";
  if (!src) {
    if (region) region.empty();
    return;
  }
  var srcAbs = new URL(String(src), location.href);
  var srcDir = srcAbs.href.replace(/[^/]*$/, "");
  var failures = [];
  var rows = [];
  var subgraphs = 0;
  var instances = {};

  /** Fetch every url, then call `done` with the documents that were read, in order. A failure is recorded, not skipped. */
  function all(urls, done) {
    var out = new Array(urls.length);
    var left = urls.length;
    if (!left) return done([]);
    urls.forEach(function (u, i) {
      FA.fetchJson(u, function (doc, why) {
        if (!doc) failures.push({ url: u, why: why });
        out[i] = doc || null;
        if (--left === 0) done(out);
      });
    });
  }

  function finish(repoIri) {
    host.setAttribute("data-fa-process-index", "ready");
    rows.forEach(function (r) { NAMES[r.id] = r.name; });
    failures.forEach(function (f) { host.appendChild(FA.failureNote("process subgraph", f.url, f.why)); });
    if (!rows.length) {
      if (!failures.length) host.appendChild(FA.emptyNote("process index"));
      if (region) { if (failures.length) region.failed(); else region.empty(); }
      return;
    }
    // The canonical site root, and this one: an SVG link is re-rooted from the first to the second.
    var from = String(repoIri).replace(/subgraph\/$/, "");
    var to = srcDir.replace(/subgraph\/$/, "");
    host.appendChild(controls(rows, subgraphs, Object.keys(instances).length, from, to));
    render(rows, "group", from, to);
    if (region) { if (failures.length) region.failed(); else region.ready(); }
  }

  FA.fetchJson(srcAbs.href, function (repo, why) {
    if (!repo) {
      host.appendChild(FA.failureNote("process index", srcAbs.href, why));
      if (region) region.failed();
      return;
    }
    var repoIri = String(repo["@id"] || "");
    // Bean `t8c4`: an instance this graph does not frame (bootstrap, `pve3`)
    // publishes its own subgraphs at its own site, and the repository index
    // links each such site with `seeAlso`. Those are read where they are
    // published — an absolute IRI, so a preview reads the live dependency —
    // and their rows join this site's. A site that cannot be read is a
    // failure note beside the table, never a silently shorter one.
    var others = list(repo.seeAlso).map(String).filter(function (u) { return /^https:\/\/[^/]/i.test(u); });
    var left = 1 + others.length;
    var settle = function () { if (--left === 0) finish(repoIri); };
    walkRepo(repo, repoIri, srcDir, settle);
    others.forEach(function (iri) {
      FA.fetchJson(iri + INDEX, function (doc, why2) {
        if (!doc) { failures.push({ url: iri + INDEX, why: why2 }); return settle(); }
        walkRepo(doc, String(doc["@id"] || iri), String(doc["@id"] || iri), settle);
      });
    });
  });

  /**
   * One repository index down to its `processes` hydrated files, adding their
   * rows. `dir` is where that repository's files are read from: this site's
   * own directory for ours, the IRI itself for a `seeAlso` one.
   */
  function walkRepo(repo, repoIri, dir, done) {
    var roots = list(repo.hasSubgraph).map(function (iri) { return localUrl(iri, repoIri, dir, INDEX); }).filter(Boolean);
    all(roots, function (rootDocs) {
      var tops = [];
      rootDocs.forEach(function (r) {
        if (!r) return;
        list(r.hasSubgraph).forEach(function (iri) {
          var u = localUrl(iri, repoIri, dir, "");
          if (u) tops.push({ dir: u, instance: String(r.name || "") });
        });
      });
      all(tops.map(function (t) { return t.dir + INDEX; }), function (topDocs) {
        var wanted = [];
        topDocs.forEach(function (d, i) {
          if (d && holdsProcesses(d)) wanted.push(tops[i]);
        });
        all(wanted.map(function (t) { return t.dir + HYDRATED; }), function (hydrated) {
          hydrated.forEach(function (h, i) {
            if (!h) return;
            subgraphs += 1;
            instances[wanted[i].instance] = true;
            rows = rows.concat(rowsFromHydrated(h, wanted[i].instance));
          });
          done();
        });
      });
    });
  }
})();
