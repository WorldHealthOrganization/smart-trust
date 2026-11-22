/**
 * The work-plan dashboard — what a harness instance's state graphs HOLD.
 *
 * ## One file, two surfaces, and that is the point
 *
 * This renderer is served two ways and exists once:
 *
 *   - the docs site loads it as a `<script>` beside `docs-ui.js`, and it
 *     mounts into the `beans-and-todos` page's container;
 *   - `scripts/state-visualizer.ts` INLINES these exact bytes into every
 *     generated visualiser page, so `<base>/<stub>/state-visualizer/` needs no
 *     network fetch for its own code.
 *
 * It lived inside `docs-ui.js` for one commit. Moving it out is what stops the
 * second surface becoming a second copy — and a second copy of a renderer is
 * two answers to "what does the work plan look like", free to disagree while
 * both look right in review.
 *
 * ## It self-mounts, so neither surface has to remember to call it
 *
 * Any page carrying `[data-fa-workplan]` gets a dashboard. A page without one
 * pays a single failed `querySelector`. `docs-ui.js` does not call in here and
 * does not need to know it exists.
 *
 * ## No dependencies, no CDN, no build step
 *
 * The same rule `kg-viewer.ts` states for its own page: a view of this
 * repository's data must be openable from a file, reviewable offline, and must
 * not add a third party to its own trust boundary.
 */
(function () {
  "use strict";

  /**
   * The shared renderer, from `kg-render.js`.
   *
   * `el` and `fetchIndex` were defined in this file and were the first two
   * things any other converted region needed, so they moved out rather than
   * being copied: two `el` helpers is two answers to how this site escapes,
   * and two three-state fetches is two answers to what a failed load means.
   * `failureNote` came the OTHER way — this file had only a `console.warn`,
   * which `skills/ui/ui-core/ui-accessibility.md` names as not saying so.
   *
   * REQUIRED, not optional. `head_custom.html` loads `kg-render.js` before
   * this file and `scripts/state-visualizer.ts` inlines both, in that order.
   * A missing dependency says so here rather than failing on the first call
   * with a `TypeError` in a stack frame that does not name it.
   */
  var FA = window.faRender;
  if (!FA) {
    if (window.console && console.warn) {
      console.warn("work-plan: assets/js/kg-render.js did not load, so the work-plan " +
                   "dashboard was not mounted. Its container keeps the authored prose " +
                   "and the link to the projection.");
    }
    return;
  }
  var el = FA.el;

  /** Untouched for this long, an `in-progress` bean is worth a second look. */
  var BEAN_STALE_DAYS = 14;

  /**
   * Status roles, and the reason these four are the only coloured things here.
   *
   * `good` / `warning` / `serious` are reserved for state and are never reused
   * as series colours. The bean STATUSES deliberately take none of them: a
   * bean being `todo` is not a warning, and painting a work plan's ordinary
   * resting state amber teaches a reader to ignore amber.
   */
  var WORKPLAN_FINDING = {
    "blocker-closed": { role: "serious", label: "Block never lifted" },
    "blocked-without-expiry": { role: "warning", label: "No expiry" },
    "blocking-unknown": { role: "critical", label: "Unknown work item" },
    "stale-in-progress": { role: "warning", label: "Untouched" }
  };

  var WORKPLAN_GLYPH = {
    // A filled ring: state, not decoration. One shape per role would be
    // better still; one shape plus a LABEL is the floor, and the label is
    // always present beside it.
    good:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="fa-workplan-icon">' +
      '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M5 8.4l2.1 2.1L11 6.6" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warning:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="fa-workplan-icon">' +
      '<path d="M8 2l6 11H2z" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linejoin="round"/><path d="M8 6.5v3" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round"/><circle cx="8" cy="11.6" r="0.9" fill="currentColor"/></svg>',
    serious:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="fa-workplan-icon">' +
      '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M8 4.8v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="8" cy="11.3" r="0.9" fill="currentColor"/></svg>',
    critical:
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="fa-workplan-icon">' +
      '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2"/>' +
      '<path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round"/></svg>'
  };

  /* OPEN is `draft`, `todo` and `in-progress` — `OPEN_STATUSES` in
   * `scripts/bean-store-read.ts`, the definition the navbar's Beans badge and
   * the Beans tile count by (bean `v215`). `draft` was missing here, so the
   * board's "open" could read lower than the badge that opened it. */
  var WORKPLAN_OPEN = { "draft": true, "todo": true, "in-progress": true };

  /**
   * How a bean TYPE is named on this page. The store's `task` is shown as
   * "story": "task" is a BPMN Task in this repository, and a work-plan row
   * reading "task" beside a process diagram reads as one (owner, 2026-10-16).
   * Display only — the front matter keeps `type: task`.
   */
  var TYPE_LABEL = { task: "story", plan: "work plan" };
  function typeLabel(t) { return TYPE_LABEL[t] || t; }

  /**
   * The forge this data came from, or `""`.
   *
   * Read off the projection (`repoWeb`), never composed here. A literal
   * repository URL in this file would be one instance's address inside code
   * three instances share — the rule `editHref` already follows on the
   * generator side. Empty is a real answer: a checkout with no `origin` still
   * renders every panel, and its identifiers stay as text.
   */
  var repoWeb = "";

  /**
   * The repository and BRANCH every bean `file` is a path on — read off the
   * projection (`fileWeb`, `fileRef`), never assumed. Since the state cutover
   * the bean store is kept on `cat/cat-harness/beans` and untracked on
   * `main`, and a hard-coded `/blob/main/` sent every bean link to a 404.
   * A projection older than these keys falls back to the old answer.
   */
  var fileWeb = "";
  var fileRef = "main";

  function forgePath(file) {
    return encodeURI(fileRef) + "/" + String(file).split("/").map(encodeURIComponent).join("/");
  }

  /** `<repo>/blob/<ref>/<file>`, or `null` when either half is missing. */
  function viewHref(file) {
    return fileWeb && file ? fileWeb + "/blob/" + forgePath(file) : null;
  }

  /** `<repo>/edit/<ref>/<file>` — where writing actually happens. */
  function editHrefFor(file) {
    return fileWeb && file ? fileWeb + "/edit/" + forgePath(file) : null;
  }

  /**
   * A bean id looks like `<instance>-<four>`, and only IDS IN THE STORE link.
   *
   * Checking the shape alone would link any hyphenated token of the right
   * length; checking membership means a token becomes a link exactly when
   * there is something to open. A reference to a bean nobody has on disk stays
   * as text, which is the third state `todoRelations` already reports as
   * `dangling` against `not-checked` — "this points somewhere I could not
   * reach" is not the same as "this points nowhere".
   */
  var BEAN_TOKEN = /`?\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*-[a-z0-9]{4})\b`?/g;

  /** `#123` — an issue or a PR. GitHub redirects `/issues/N` to whichever. */
  var FORGE_REF = /#(\d+)\b/g;

  /**
   * Append `text` to `node`, turning bean ids and `#123` into links.
   *
   * Built with `createTextNode` and `createElement` throughout: a bean's title
   * and a finding's detail are authored, travel through a JSON file and land
   * here, so no input ever reaches `innerHTML`. That is the same rule the
   * sticky board follows, and the reason is that the string which closes a tag
   * is exactly the string somebody eventually writes.
   */
  function linkify(node, text, byId) {
    var i = 0;
    // One pass over both patterns, so a `#12` inside a bean id cannot be
    // matched twice and the offsets never disagree.
    var hits = [];
    var m;
    BEAN_TOKEN.lastIndex = 0;
    while ((m = BEAN_TOKEN.exec(text)) !== null) {
      if (byId[m[1]]) hits.push({ at: m.index, len: m[0].length, label: m[1], bean: byId[m[1]] });
    }
    FORGE_REF.lastIndex = 0;
    while ((m = FORGE_REF.exec(text)) !== null) {
      hits.push({ at: m.index, len: m[0].length, label: m[0], issue: m[1] });
    }
    hits.sort(function (a, b) { return a.at - b.at; });

    for (var k = 0; k < hits.length; k++) {
      var h = hits[k];
      if (h.at < i) continue;                       // overlapped a previous hit
      if (h.at > i) node.appendChild(document.createTextNode(text.slice(i, h.at)));
      var href = h.bean ? viewHref(h.bean.file)
                        : (repoWeb ? repoWeb + "/issues/" + h.issue : null);
      var label = h.bean ? (h.bean.title || h.label) : h.label;
      if (href) {
        var a = el("a", { class: "fa-workplan-ref", href: href }, label);
        node.appendChild(a);
      } else {
        node.appendChild(document.createTextNode(label));
      }
      i = h.at + h.len;
    }
    if (i < text.length) node.appendChild(document.createTextNode(text.slice(i)));
    return node;
  }

  /** Whole days since an ISO timestamp, or `null` when there is no usable one. */
  function daysSince(iso) {
    if (!iso) return null;
    var t = Date.parse(iso);
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
  }

  /**
   * Fetch a published index by its `<meta>` name.
   *
   * THREE answers, and keeping them apart is the whole of this function:
   *
   *   - `undefined` — the page carries no such meta, so it never meant to show
   *     this graph. A per-graph visualiser page carries exactly one of the two.
   *   - `null` — the meta is there and the fetch failed. Something is wrong.
   *   - the document — it was read.
   *
   * Collapsing the first two is how a page that deliberately shows only beans
   * comes to report "the todo index could not be read", which is an error
   * message about a decision.
   */
  function fetchIndex(metaName, done) {
    var src = document.querySelector('meta[name="' + metaName + '"]');
    var url = src && src.getAttribute("content");
    FA.fetchIndex(metaName, function (doc, failure) {
      // `undefined` passes straight through: the page never asked for this
      // graph, and that is not a failure to report.
      if (doc === undefined) return done(undefined, undefined, url);
      // A document with no `items` array is not this projection, whatever it
      // is. Reported as unreadable rather than rendered as empty.
      if (doc !== null && !Array.isArray(doc.items)) {
        return done(null, "the document carries no `items` array", url);
      }
      if (doc === null) {
        // Third state, reported and never rendered as "nothing outstanding".
        // A dashboard that opens at zero is indistinguishable from a store
        // with no work in it, and those are opposite facts. The console is
        // half of saying so; `renderFailure` below is the half a reader sees.
        console.warn("work-plan: could not read " + url + " (" + (failure || "no reason " +
                     "reported") + "); that half of the work-plan dashboard was not mounted.");
      }
      done(doc, failure, url);
    });
  }

  /** One `<dt>/<dd>` pair in a count row. */
  function countItem(label, value, hero) {
    var item = el("div", { class: "fa-workplan-count" + (hero ? " is-hero" : "") });
    item.appendChild(el("dd", { class: "fa-workplan-count-value" }, String(value)));
    item.appendChild(el("dt", { class: "fa-workplan-count-label" }, label));
    return item;
  }

  /**
   * The epic the dashboard is currently scoped to, or "" for everything.
   *
   * Module state rather than a parameter threaded through six functions,
   * because every panel has to agree on it: the dataviz rule is that filters
   * scope EVERYTHING below them, so a panel that kept its own copy is a panel
   * free to disagree with the chart above it.
   */
  var SCOPE = "";
  /**
   * The bean type the dashboard is filtered to, or "" for all types.
   *
   * Same pattern as SCOPE: module state, because every panel must agree.
   * Composable with SCOPE — you can filter by epic AND by type.
   */
  var TYPE_SCOPE = "";
  /**
   * The search text the board is narrowed to, or "" for none (#2418).
   *
   * Owner, 2026-10-07: *"on beans/ visualizer no way to search within
   * beans.... (separate search like public comments)"*. Same pattern as the
   * two scopes above and composable with both; kept in the URL as `?q=`, the
   * way the public-comment dashboard keeps its own, so a search can be linked.
   */
  var QUERY = "";
  /**
   * Whether the tree lists closed beans too. Off by default: 860 completed
   * beans beside 180 open ones bury the work that is still to do.
   */
  var SHOW_CLOSED = false;
  /** Every bean, so a blocker outside the scope still resolves to its title. */
  var ALL_BEANS = [];
  /** Re-render inputs, kept so a scope change does not refetch. */
  var BOARD = null;

  /** Parent id → its child beans, over the whole store. */
  function childrenOf(beans) {
    var kids = Object.create(null);
    for (var i = 0; i < beans.length; i++) {
      var p = beans[i].parent;
      if (!p) continue;
      (kids[p] || (kids[p] = [])).push(beans[i]);
    }
    return kids;
  }

  function hasOpenChild(kids, id) {
    var ks = kids[id] || [];
    for (var i = 0; i < ks.length; i++) if (WORKPLAN_OPEN[ks[i].status]) return true;
    return false;
  }

  /**
   * The ids in `rootId`'s subtree, itself included — every depth, not only
   * direct children. "Show only this epic" used to keep the epic and its
   * direct children, so a goal or an epic whose work sits under features
   * scoped to a fraction of itself. A visited set guards a parent cycle.
   */
  function subtreeIds(beans, rootId) {
    var kids = childrenOf(beans);
    var seen = Object.create(null);
    var stack = [rootId];
    while (stack.length) {
      var id = stack.pop();
      if (seen[id]) continue;
      seen[id] = true;
      var ks = kids[id] || [];
      for (var i = 0; i < ks.length; i++) stack.push(ks[i].id);
    }
    return seen;
  }

  /**
   * The beans a scoped view is about: the scoped bean and its whole subtree.
   *
   * The scoped bean is INCLUDED, so the counts under a scope add up to
   * something a reader can reconcile with the tree row they chose.
   */
  function inScope(beans) {
    if (!SCOPE && !TYPE_SCOPE && !QUERY) return beans;
    var under = SCOPE ? subtreeIds(beans, SCOPE) : null;
    var out = [];
    for (var i = 0; i < beans.length; i++) {
      var b = beans[i];
      if (under && !under[b.id]) continue;
      // Type scope: only beans of the selected type
      if (!typeOk(b)) continue;
      if (QUERY && !matchesQuery(b)) continue;
      out.push(b);
    }
    return out;
  }

  var cachedTerms = null;
  var cachedQuery = null;
  function getQueryTerms() {
    if (QUERY === cachedQuery && cachedTerms !== null) return cachedTerms;
    cachedQuery = QUERY;
    cachedTerms = QUERY.toLowerCase().split(/\s+/).filter(Boolean);
    return cachedTerms;
  }

  /**
   * Does a bean match the search? Every whitespace-separated term must occur,
   * case-insensitively, in its id, title, status, type or body preview — the
   * fields the projection carries. An AND of terms, because a reader adding a
   * word means "narrower", never "also these".
   */
  function matchesQuery(b) {
    if (b._hay === undefined) {
      b._hay = [b.id, b.title, b.status, b.type, b.preview || "", planHay(b)].join(" ").toLowerCase();
    }
    var terms = getQueryTerms();
    for (var i = 0; i < terms.length; i++) {
      if (b._hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  /**
   * The plan a work item sits under: itself if it is one, else its nearest
   * ancestor that is. Searching for a proposal therefore finds the plan it
   * seeded AND every work item under that plan (owner, 2026-11-05: epics are
   * tied to proposals, so a proposal finds the work done for it).
   */
  var BY_ID = null;
  function planOf(b) {
    if (!BY_ID) {
      BY_ID = Object.create(null);
      for (var i = 0; i < ALL_BEANS.length; i++) BY_ID[ALL_BEANS[i].id] = ALL_BEANS[i];
    }
    for (var c = b, guard = 0; c && guard < 64; c = BY_ID[c.parent], guard++) {
      if (c.plan) return c;
    }
    return null;
  }

  /** The words of a work item's plan a search may match: proposal and processes. */
  function planHay(b) {
    var p = planOf(b);
    if (!p) return "";
    return [p.plan.proposal || ""].concat(p.plan.processes || []).join(" ");
  }

  /** Does `b` pass the type filter? "plan" is the work-plan filter, not a type. */
  function typeOk(b) {
    if (!TYPE_SCOPE) return true;
    return TYPE_SCOPE === "plan" ? !!b.plan : b.type === TYPE_SCOPE;
  }

  /**
   * A work plan's marker: the process it runs, the proposal it came from, and
   * how many instances are running under it (work item folio-assistant-exrp,
   * owner 2026-11-05: "Epic is the plan"). Read off the projection's `plan`,
   * which only a plan carries. `runs: null` means the instance store could not
   * be read, which is said rather than shown as "0 running".
   */
  function planMarker(plan, id, hasItems) {
    var box = el("span", { class: "fa-workplan-plan" });
    box.appendChild(el("span", { class: "fa-workplan-plan-label" }, "work plan"));
    box.appendChild(document.createTextNode(" runs "));
    for (var i = 0; i < plan.processes.length; i++) {
      if (i > 0) box.appendChild(document.createTextNode(", "));
      box.appendChild(el("code", { class: "fa-workplan-plan-process" }, plan.processes[i]));
    }
    if (plan.proposal) {
      box.appendChild(document.createTextNode(" · from "));
      var prop = el("code", { class: "fa-workplan-plan-proposal" }, plan.proposal);
      // The projection resolves the link to the repository that holds the
      // proposal; `viewHref` (the store's own repository) is the fallback
      // for an index written before it did.
      var propHref = plan.proposalHref || viewHref(plan.proposal);
      if (propHref) {
        var a = el("a", { href: propHref, class: "fa-workplan-plan-proposal-link",
                          title: "Open the proposal this plan came from" });
        a.appendChild(prop);
        box.appendChild(a);
      } else {
        box.appendChild(prop);
      }
    }
    var runs = plan.runs;
    var running = 0;
    var where = [];
    if (runs) {
      for (var r = 0; r < runs.length; r++) {
        if (runs[r].status === "running") {
          running++;
          where.push(runs[r].id + (runs[r].at && runs[r].at.length ? " at " + runs[r].at.join(", ") : ""));
        }
      }
    }
    var text = runs === null || runs === undefined
      ? " · runs not read in this build"
      : " · " + running + " running" + (runs.length > running ? ", " + (runs.length - running) + " finished" : "");
    var count = el("span", { class: "fa-workplan-plan-runs" }, text);
    if (where.length) count.setAttribute("title", where.join("\n"));
    box.appendChild(count);
    if (hasItems && SCOPE !== id) {
      var items = el("button", { type: "button", class: "fa-workplan-action fa-workplan-plan-items",
                                 title: "Show only the work items of this plan" }, "Its work items");
      items.setAttribute("data-scope", id);
      box.appendChild(items);
    }
    return box;
  }

  /** One bean, as a row inside an expanded epic — or a search result, with its id. */
  function beanRow(b, withId) {
    var li = el("li", { class: "fa-workplan-bean-row" });
    var href = viewHref(b.file);
    var name = href
      ? el("a", { class: "fa-workplan-bean-link", href: href }, b.title)
      : el("span", { class: "fa-workplan-bean-link" }, b.title);
    li.appendChild(el("span", {
      class: "fa-workplan-bean-status is-" + b.status,
    }, b.status === "in-progress" ? "in progress" : b.status));
    if (withId) li.appendChild(el("code", { class: "fa-workplan-bean-id" }, b.id.replace(/^.*-/, "")));
    li.appendChild(name);
    // A blocked bean says so here rather than only in the findings panel: the
    // reader who opened this epic is asking what is in it, and "blocked" is
    // the first thing that changes what they do about it.
    //
    // And it names WHAT holds it (bean `vhqq`): `blockedBy` is now the union
    // of both front-matter declarations, so each blocker is listed as its own
    // link. One that names no bean in the store is shown as plain text rather
    // than dropped — the generator reports it as a finding too.
    if (b.blockedBy && b.blockedBy.length) {
      var badge = el("span", { class: "fa-workplan-bean-blocked" }, "blocked by ");
      for (var i = 0; i < b.blockedBy.length; i++) {
        if (i > 0) badge.appendChild(document.createTextNode(", "));
        badge.appendChild(blockerRef(b.blockedBy[i]));
      }
      li.appendChild(badge);
    }
    return li;
  }

  /** One blocker inside a "blocked by" badge: its short id, linked. */
  function blockerRef(id) {
    var short = id.replace(/^.*-/, "");
    var blocker = null;
    for (var i = 0; i < ALL_BEANS.length; i++) {
      if (ALL_BEANS[i].id === id) { blocker = ALL_BEANS[i]; break; }
    }
    var href = blocker ? viewHref(blocker.file) : null;
    if (!blocker) {
      return el("span", { class: "fa-workplan-block-edge is-dangling", title: id + " — not a work item in this store" },
                short + " (unknown)");
    }
    return href
      ? el("a", { class: "fa-workplan-block-edge", href: href, title: id + " — " + blocker.title }, short)
      : el("span", { class: "fa-workplan-block-edge", title: id + " — " + blocker.title }, short);
  }

  /* ── The work-plan tree ──────────────────────────────────────────────
   *
   * goal (milestone) → epic → feature → story/bug, by `parent:`. It replaced
   * the "open beans by epic" bars (owner, 2026-10-16: *"3 epics, but lots of
   * beans listed... how do you actually see the 3 epics? clicking on feature,
   * where are features? ... can we have an expandable tree view?"*), because
   * the bars counted beans and listed only one level of them, so a type
   * filter narrowed a number and showed nothing.
   *
   * A disclosure button per branch, no library. Not `<details>`: a branch
   * row holds the bean's link and its "Only this" button, and a `<summary>`
   * may not contain controls (axe `nested-interactive`). A branch's children are built the first
   * time it is opened, so 1,000 beans cost one level of DOM until someone
   * looks deeper. Under a type filter or a search the tree is PRUNED to the
   * matches and their ancestors and opened down to them, so the filter
   * answers "where are they" rather than "how many".
   */

  var STATUS_RANK = { "in-progress": 0, "todo": 1, "draft": 2, "completed": 3, "scrapped": 4 };
  var TYPE_RANK = { milestone: 0, epic: 1, feature: 2, task: 3, bug: 3 };

  function byPlanOrder(a, b) {
    // Goals read in their own numbering ("GOAL 2" before "GOAL 10"); below
    // them, live work first, then the bigger containers, then a stable id.
    if (a.type === "milestone" && b.type === "milestone") {
      return String(a.title || "").localeCompare(String(b.title || ""), "en", { numeric: true }) ||
             (a.id < b.id ? -1 : 1);
    }
    var s = (STATUS_RANK[a.status] !== undefined ? STATUS_RANK[a.status] : 5) -
            (STATUS_RANK[b.status] !== undefined ? STATUS_RANK[b.status] : 5);
    if (s) return s;
    var t = (TYPE_RANK[a.type] !== undefined ? TYPE_RANK[a.type] : 4) -
            (TYPE_RANK[b.type] !== undefined ? TYPE_RANK[b.type] : 4);
    if (t) return t;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  /** Does `b` pass the type filter, the search, and the open/closed switch? */
  function treeMatch(b) {
    if (!SHOW_CLOSED && !WORKPLAN_OPEN[b.status]) return false;
    if (!typeOk(b)) return false;
    if (QUERY && !matchesQuery(b)) return false;
    return true;
  }

  function treePanel(beans) {
    var byId = Object.create(null);
    var i;
    for (i = 0; i < beans.length; i++) byId[beans[i].id] = beans[i];
    var kids = childrenOf(beans);
    var filtering = !!(TYPE_SCOPE || QUERY);

    // SHOWN = every match plus its ancestors, so a match is never orphaned
    // from the path that explains where it sits.
    var shown = Object.create(null);
    var matched = Object.create(null);
    for (i = 0; i < beans.length; i++) {
      var b = beans[i];
      if (!treeMatch(b)) continue;
      matched[b.id] = true;
      var guard = 0;
      for (var c = b; c && !shown[c.id] && guard < 64; c = byId[c.parent], guard++) shown[c.id] = true;
    }

    // Subtree totals, over EVERY bean regardless of filter: a row's count says
    // how big the branch is, which a filter does not change.
    var totals = Object.create(null);
    function total(id, depth) {
      if (totals[id]) return totals[id];
      var t = { open: 0, closed: 0 };
      totals[id] = t;                                   // set first: a cycle stops here
      var ks = kids[id] || [];
      for (var k = 0; k < ks.length && depth < 64; k++) {
        if (WORKPLAN_OPEN[ks[k].status]) t.open++; else t.closed++;
        var sub = total(ks[k].id, depth + 1);
        t.open += sub.open;
        t.closed += sub.closed;
      }
      return t;
    }

    function shownKids(id) {
      var out = [];
      var ks = kids[id] || [];
      for (var k = 0; k < ks.length; k++) if (shown[ks[k].id]) out.push(ks[k]);
      return out.sort(byPlanOrder);
    }

    function rowParts(target, b) {
      var row = beanRow(b, true);
      if (filtering && matched[b.id]) row.className += " is-match";
      var type = el("span", { class: "fa-workplan-tree-type is-" + b.type }, typeLabel(b.type));
      row.insertBefore(type, row.firstChild);
      if (b.plan) row.appendChild(planMarker(b.plan, b.id, (kids[b.id] || []).length > 0));
      while (row.firstChild) target.appendChild(row.firstChild);
      if (filtering && matched[b.id]) target.className += " is-match";
    }

    function node(b, depth) {
      var ks = shownKids(b.id);
      var li = el("li", { class: "fa-workplan-tree-item", "data-bean": b.id });
      if (!ks.length) {
        var leaf = el("div", { class: "fa-workplan-tree-row is-leaf" });
        rowParts(leaf, b);
        li.appendChild(leaf);
        return li;
      }
      var row = el("div", { class: "fa-workplan-tree-row is-branch" });
      var ulId = "fa-workplan-tree-" + b.id;
      var tog = el("button", { type: "button", class: "fa-workplan-tree-toggle",
                               "aria-expanded": "false", "aria-controls": ulId,
                               "aria-label": "Show what is under " + (b.title || b.id) });
      row.appendChild(tog);
      rowParts(row, b);
      var t = total(b.id, 0);
      row.appendChild(el("span", { class: "fa-workplan-tree-count" },
                         t.open + " open · " + t.closed + " closed"));
      if (SCOPE !== b.id && !b.plan) {
        var focus = el("button", { type: "button", class: "fa-workplan-action fa-workplan-tree-focus",
                                   title: "Show only this branch" }, "Only this");
        focus.setAttribute("data-scope", b.id);
        row.appendChild(focus);
      }
      li.appendChild(row);
      var ul = el("ul", { class: "fa-workplan-tree", id: ulId });
      ul.hidden = true;
      li.appendChild(ul);
      var built = false;
      function setOpen(open) {
        if (open && !built) {
          built = true;
          for (var k = 0; k < ks.length; k++) ul.appendChild(node(ks[k], depth + 1));
        }
        ul.hidden = !open;
        tog.setAttribute("aria-expanded", open ? "true" : "false");
      }
      // The milestone panel's goal titles open a branch through this.
      li.faOpen = function () { setOpen(true); };
      // Opened down to the matches under a filter, the top level otherwise,
      // and a scoped branch itself.
      if (filtering || depth === 0 || SCOPE === b.id) setOpen(true);
      tog.addEventListener("click", function () { setOpen(ul.hidden); });
      return li;
    }

    var sec = el("section", { class: "fa-workplan-panel fa-workplan-panel--wide" });
    var head = el("div", { class: "fa-workplan-tree-head" });
    head.appendChild(el("h2", { class: "fa-workplan-chart-title", id: "fa-workplan-tree-title" },
                        "Plans and work — goal → epic → feature → story"));
    var lab = el("label", { class: "fa-workplan-tree-closed" });
    var box = el("input", { type: "checkbox", "data-fa-workplan-closed": "" });
    box.checked = SHOW_CLOSED;
    lab.appendChild(box);
    lab.appendChild(document.createTextNode(" Show closed work items"));
    head.appendChild(lab);
    sec.appendChild(head);

    // Roots: the scoped bean, or every goal, then whatever reaches no goal.
    var roots = [];
    var loose = [];
    if (SCOPE && byId[SCOPE]) {
      shown[SCOPE] = true;
      roots.push(byId[SCOPE]);
    } else {
      for (i = 0; i < beans.length; i++) {
        var r = beans[i];
        if (!shown[r.id]) continue;
        if (r.type === "milestone") roots.push(r);
        else if (!r.parent || !byId[r.parent]) loose.push(r);
      }
      roots.sort(byPlanOrder);
      loose.sort(byPlanOrder);
    }

    var list = el("ul", { class: "fa-workplan-tree is-root", "aria-labelledby": "fa-workplan-tree-title" });
    for (i = 0; i < roots.length; i++) list.appendChild(node(roots[i], 0));
    if (loose.length) {
      // Said, not hidden: work under no goal is a finding about the plan.
      var li = el("li", { class: "fa-workplan-tree-item" });
      var det = el("details", { class: "fa-workplan-tree-branch is-loose" });
      det.appendChild(el("summary", { class: "fa-workplan-tree-row" },
                         "Under no goal — " + loose.length + (loose.length === 1 ? " work item" : " work items")));
      var ul = el("ul", { class: "fa-workplan-tree" });
      for (i = 0; i < loose.length; i++) ul.appendChild(node(loose[i], 1));
      det.appendChild(ul);
      det.open = filtering;
      li.appendChild(det);
      list.appendChild(li);
    }
    if (!list.childNodes.length) {
      sec.appendChild(el("p", { class: "fa-workplan-empty" },
                         filtering ? "No work item matches this filter." : "No open work items."));
    } else {
      sec.appendChild(list);
    }
    return sec;
  }

  var EDIT_GLYPH =
    '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="fa-workplan-icon">' +
    '<path d="M11.2 2.4l2.4 2.4L5.6 12.8 2.4 13.6l0.8-3.2z" fill="none" stroke="currentColor" ' +
    'stroke-width="1.6" stroke-linejoin="round"/></svg>';

  /**
   * One finding row: icon, role word, the sentence, then a pencil.
   *
   * The sentence is LINKIFIED rather than wrapped in a single anchor. A
   * finding names two beans — the one holding the block and the one held — and
   * making the whole row one link to one of them sends half the readers to the
   * wrong bean. Each identifier is its own link to its own subject.
   *
   * The pencil is `.fa-node-edit`'s argument applied here: a published page
   * cannot write back to the repository, so the honest control is the one that
   * takes you where writing happens.
   */
  function findingRow(role, label, text, byId, editFile) {
    var li = el("li", { class: "fa-workplan-finding is-" + role });
    var badge = el("span", { class: "fa-workplan-finding-badge" });
    badge.innerHTML = WORKPLAN_GLYPH[role] || WORKPLAN_GLYPH.warning;  // static constant
    badge.appendChild(el("span", { class: "fa-workplan-finding-role" }, label));
    li.appendChild(badge);

    var body = el("span", { class: "fa-workplan-finding-text" });
    linkify(body, text, byId || {});
    var edit = editHrefFor(editFile);
    if (edit) {
      var a = el("a", {
        class: "fa-workplan-edit",
        // Rebuilt from the platform's one recipe when edit-links.js is on the page (bean v433).
        "data-fa-link": "edit",
        href: edit,
        title: "Edit " + editFile,
        "aria-label": "Edit " + editFile,
      });
      a.innerHTML = EDIT_GLYPH;                                        // static constant
      body.appendChild(document.createTextNode(" "));
      body.appendChild(a);
    }
    li.appendChild(body);
    return li;
  }

  /**
   * The findings panel — the generator's structural findings, plus the
   * time-relative one this page is the only place that can compute.
   */
  function findingsPanel(beans, findings, scoped) {
    var byId = {};
    var i;
    for (i = 0; i < beans.length; i++) byId[beans[i].id] = beans[i];
    var kids = childrenOf(beans);

    var section = el("section", { class: "fa-workplan-panel" });
    section.appendChild(el("h2", { class: "fa-workplan-panel-title" }, "What is stuck"));
    var list = el("ul", { class: "fa-workplan-findings" });

    for (i = 0; i < findings.length; i++) {
      var f = findings[i];
      var spec = WORKPLAN_FINDING[f.kind] || { role: "warning", label: f.kind };
      var subject = byId[f.bean];
      // The blocker's id is left IN the sentence rather than resolved to a
      // title here, so `linkify` turns both ends into their own links.
      var text = f.bean + " — " + f.detail;
      list.appendChild(findingRow(spec.role, spec.label, text, byId,
                                  subject ? subject.file : null));
    }

    // Computed here rather than in the projection. See the module note.
    //
    // Over the SCOPED set, like every other number on the board: it used to
    // walk every bean, so a Milestone filter still listed every untouched
    // task beneath the counts it had narrowed.
    //
    // And a CONTAINER with an open child is not untouched: nobody edits an
    // epic when a child moves, so its `updatedAt` measures editing, not
    // liveness. `check-bean-rollup.ts` skips them for the same reason, and
    // the owner chose the same here (2026-10-16).
    var stale = [];
    for (i = 0; i < scoped.length; i++) {
      var b = scoped[i];
      if (b.status !== "in-progress") continue;
      if (hasOpenChild(kids, b.id)) continue;
      var age = daysSince(b.updatedAt);
      if (age !== null && age > BEAN_STALE_DAYS) stale.push({ bean: b, age: age });
    }
    stale.sort(function (a, c) { return c.age - a.age; });
    for (i = 0; i < stale.length; i++) {
      list.appendChild(findingRow(
        "warning", WORKPLAN_FINDING["stale-in-progress"].label,
        stale[i].bean.id + " — claimed in-progress and untouched for " +
          stale[i].age + " days",
        byId, stale[i].bean.file));
    }

    if (list.childNodes.length === 0) {
      list.appendChild(findingRow(
        "good", "Clear",
        "No unlifted blocks, no block without an expiry, and nothing claimed " +
        "and left for more than " + BEAN_STALE_DAYS + " days.", byId, null));
    }
    section.appendChild(list);
    return section;
  }

  /** The counts panel, both stores side by side. */
  function countsPanel(beans, todos) {
    var status = {};
    var i;
    for (i = 0; i < beans.length; i++) {
      status[beans[i].status] = (status[beans[i].status] || 0) + 1;
    }
    var open = 0;
    for (var st in status) {
      if (Object.prototype.hasOwnProperty.call(status, st) && WORKPLAN_OPEN[st] === true) open += status[st];
    }

    var section = el("section", { class: "fa-workplan-panel" });
    section.appendChild(el("h2", { class: "fa-workplan-panel-title" },
                            "Work items — the agent work plan"));
    var row = el("dl", { class: "fa-workplan-counts" });
    row.appendChild(countItem("open", open, true));
    row.appendChild(countItem("draft", status["draft"] || 0));
    row.appendChild(countItem("todo", status["todo"] || 0));
    row.appendChild(countItem("in progress", status["in-progress"] || 0));
    row.appendChild(countItem("completed", status["completed"] || 0));
    row.appendChild(countItem("scrapped", status["scrapped"] || 0));
    section.appendChild(row);

    // The human half. Absent is NOT zero: a failed fetch and an empty store
    // are opposite facts and the panel says which one it is looking at.
    var todoHead = el("h3", { class: "fa-workplan-panel-title" },
                       "Todos — the human half");
    section.appendChild(todoHead);
    // Absent by design — this page was not asked to show todos — so the
    // heading comes off with it rather than standing over an apology.
    if (todos === undefined) {
      section.removeChild(todoHead);
      return section;
    }
    if (todos === null) {
      section.appendChild(el("p", { class: "fa-workplan-empty" },
                              "The todo index could not be read."));
      return section;
    }
    var todoOpen = 0;
    for (i = 0; i < todos.length; i++) if (todos[i].status === "open") todoOpen++;
    var todoRow = el("dl", { class: "fa-workplan-counts" });
    todoRow.appendChild(countItem("open", todoOpen, true));
    todoRow.appendChild(countItem("total", todos.length));
    section.appendChild(todoRow);
    return section;
  }

  /**
   * The todos panel on its own, for a page whose only graph is `todos/`.
   *
   * Separate from `countsPanel` rather than a flag on it: that function's job
   * is "both stores side by side", and a boolean turning half of it off is how
   * one function comes to mean two things.
   */
  function todoOnlyPanel(todos) {
    var section = el("section", { class: "fa-workplan-panel" });
    section.appendChild(el("h2", { class: "fa-workplan-panel-title" },
                            "Todos — the human half"));
    if (!todos) {
      section.appendChild(el("p", { class: "fa-workplan-empty" },
                              "The todo index could not be read."));
      return section;
    }
    var open = 0;
    for (var i = 0; i < todos.length; i++) if (todos[i].status === "open") open++;
    var row = el("dl", { class: "fa-workplan-counts" });
    row.appendChild(countItem("open", open, true));
    row.appendChild(countItem("total", todos.length));
    section.appendChild(row);
    return section;
  }

  /**
   * Mount the dashboard into the container the page declares.
   *
   * The page carries `<div data-fa-workplan>` with prose inside it saying
   * where the data lives. That fallback is REPLACED on success and LEFT ALONE
   * on failure, so a reader with no JavaScript, or on a build where the
   * projection is missing, still gets a working link to the file rather than
   * an empty box.
   */
  /**
   * The filter row: what the board is scoped to, and the way out of it.
   *
   * ONE ROW, ABOVE THE PANELS — `interaction.md`: filters sit above the
   * content they scope, never inside a chart card. Absent entirely when
   * nothing is scoped, because a control reading "all" is a permanent row of
   * chrome saying nothing happened.
   */
  function filterRow(epic) {
    var row = el("div", { class: "fa-workplan-filter" });
    var labels = [];
    if (SCOPE) {
      labels.push(epic ? epic.title : SCOPE);
    }
    if (TYPE_SCOPE) {
      labels.push("type: " + typeLabel(TYPE_SCOPE));
    }
    row.appendChild(el("span", { class: "fa-workplan-filter-label" }, "Showing only"));
    row.appendChild(el("span", { class: "fa-workplan-filter-value" },
                       labels.join(" · ")));
    var clear = el("button", { type: "button", class: "fa-workplan-action" },
                   "Show everything");
    clear.setAttribute("data-scope", "");
    clear.setAttribute("data-type-scope", "");
    row.appendChild(clear);
    return row;
  }

  /**
   * Type filter buttons — always visible above the board.
   *
   * Unlike the epic filter row (which appears only when scoped), this bar is
   * always shown because the user asked for type filtering as a primary
   * interaction. The active type is highlighted.
   */
  function typeFilterBar(beans) {
    // Collect the types that actually appear in the (possibly epic-scoped) set
    var typeCounts = {};
    var totalOpen = 0;
    var plans = 0;
    var under = SCOPE ? subtreeIds(beans, SCOPE) : null;
    for (var i = 0; i < beans.length; i++) {
      var b = beans[i];
      if (!WORKPLAN_OPEN[b.status]) continue;
      // When scoped, only count beans in that subtree
      if (under && !under[b.id]) continue;
      var t = b.type || "other";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
      if (b.plan) plans++;
      totalOpen++;
    }
    // Stable order: the types we know, then anything else
    var ORDER = ["task", "feature", "bug", "epic", "milestone"];
    var types = [];
    for (var j = 0; j < ORDER.length; j++) {
      if (typeCounts[ORDER[j]]) types.push(ORDER[j]);
    }
    // Any types not in ORDER
    var seen = {};
    for (j = 0; j < ORDER.length; j++) seen[ORDER[j]] = true;
    var allTypes = Object.keys(typeCounts);
    for (j = 0; j < allTypes.length; j++) {
      if (!seen[allTypes[j]]) types.push(allTypes[j]);
    }

    var bar = el("div", { class: "fa-workplan-type-bar" });

    // "All" button
    var allBtn = el("button", {
      type: "button",
      class: "fa-workplan-type-btn" + (!TYPE_SCOPE ? " is-active" : "")
    });
    allBtn.setAttribute("data-type-scope", "");
    allBtn.textContent = "All (" + totalOpen + ")";
    bar.appendChild(allBtn);

    // One button per type
    for (var k = 0; k < types.length; k++) {
      var t = types[k];
      var btn = el("button", {
        type: "button",
        class: "fa-workplan-type-btn" + (TYPE_SCOPE === t ? " is-active" : "")
      });
      btn.setAttribute("data-type-scope", t);
      btn.textContent = typeLabel(t) + " (" + typeCounts[t] + ")";
      bar.appendChild(btn);
    }
    // Work plans: not a type but a role an epic or milestone takes on by
    // naming its process. Shown only when some open item is one.
    if (plans) {
      var planBtn = el("button", {
        type: "button",
        class: "fa-workplan-type-btn" + (TYPE_SCOPE === "plan" ? " is-active" : "")
      });
      planBtn.setAttribute("data-type-scope", "plan");
      planBtn.textContent = "Work plans (" + plans + ")";
      bar.appendChild(planBtn);
    }
    return bar;
  }

  /**
   * Build the board for the current SCOPE. Re-entrant: a scope change calls
   * this again over the same data rather than refetching.
   */
  /**
   * The burn-down feed (bean `hf2q` slice 4), `assets/beans/burndown.json`.
   *
   * Written only by a publish build (`gen-docs-pages.ts --burndown-history`,
   * cat-harness-tools `bean-burndown-feed.ts`), so three states, never two:
   * `undefined` is not yet asked or still loading, `null` is "this build
   * carries no history" (the file is absent or unreadable), and an object is
   * the feed itself, which may say `available: false` with its reason.
   * The board DRAWS the series and computes nothing from them.
   */
  var BURNDOWN = undefined;

  var SVG_NS = "http://www.w3.org/2000/svg";

  function svgEl(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, String(attrs[k]));
    return n;
  }

  /** The series for bean `id`, or null when the feed has none for it. */
  function burndownSeries(id) {
    if (!BURNDOWN || BURNDOWN.available !== true || !Array.isArray(BURNDOWN.series)) return null;
    for (var i = 0; i < BURNDOWN.series.length; i++) {
      if (BURNDOWN.series[i].id === id) return BURNDOWN.series[i];
    }
    return null;
  }

  /**
   * One milestone's open count over the feed's days, as a small line.
   *
   * A day before the bean existed is `null` in the feed, and is a GAP here,
   * never a point at zero: no data is not zero. The line's scale is its own
   * (0 to its own peak), so a reader compares shapes between rows, and the
   * label gives the figures.
   */
  function sparkline(series, days) {
    var open = series.open || [];
    var W = 160, H = 28, PAD = 2;
    var max = 0, first = null, last = null, firstDay = "", lastDay = "";
    for (var i = 0; i < open.length; i++) {
      var v = open[i];
      if (typeof v !== "number") continue;
      if (v > max) max = v;
      if (first === null) { first = v; firstDay = days[i] || ""; }
      last = v; lastDay = days[i] || "";
    }
    if (first === null) return null;
    var n = Math.max(1, open.length - 1);
    var x = function (j) { return PAD + (W - 2 * PAD) * (open.length === 1 ? 1 : j / n); };
    var y = function (v) { return H - PAD - (H - 2 * PAD) * (max === 0 ? 0 : v / max); };
    var label = "Open work items under " + series.title + ": " + first + " on " + firstDay
      + ", " + last + " on " + lastDay + " (peak " + max + ").";
    var svg = svgEl("svg", { class: "fa-workplan-burndown", viewBox: "0 0 " + W + " " + H,
                             width: W, height: H, role: "img", "aria-label": label, focusable: "false" });
    var t = svgEl("title", {});
    t.textContent = label;
    svg.appendChild(t);
    var pts = [];
    var flush = function () {
      if (pts.length === 1) {
        svg.appendChild(svgEl("circle", { cx: pts[0][0], cy: pts[0][1], r: 1.5, class: "fa-workplan-burndown-dot" }));
      } else if (pts.length > 1) {
        svg.appendChild(svgEl("polyline", { points: pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" "),
                                            class: "fa-workplan-burndown-line" }));
      }
      pts = [];
    };
    for (var j = 0; j < open.length; j++) {
      if (typeof open[j] !== "number") { flush(); continue; }
      pts.push([x(j), y(open[j])]);
    }
    flush();
    return svg;
  }

  /** The line under the bars that says what the burn-down column is, or why it is empty. */
  function burndownNote() {
    if (BURNDOWN === undefined) return null;
    if (BURNDOWN === null) {
      return el("p", { class: "fa-workplan-chart-note" },
                "No burn-down history in this build: only a publish build reads the work plan's past.");
    }
    if (BURNDOWN.available !== true) {
      return el("p", { class: "fa-workplan-chart-note" },
                "No burn-down history in this build: " + (BURNDOWN.reason || "the feed gave no reason") + ".");
    }
    var days = BURNDOWN.days || [];
    return el("p", { class: "fa-workplan-chart-note" },
              "Each line is the count of open work items beneath that goal, on each of the "
              + days.length + " day(s) the store changed"
              + (days.length ? " from " + days[0] + " to " + days[days.length - 1] : "")
              + ", read from " + (BURNDOWN.branch || "the work plan's branch") + ". Each line has its own scale.");
  }

  /**
   * The declared milestones, as a part-to-whole bar each.
   *
   * It RENDERS `plan` and computes nothing. The page holds every bean's
   * `parent`, `type` and `status`, so it could walk the closure itself — and
   * that is the reason not to: `milestone:status` prints the same figures from
   * `milestone-rollup.ts`, and a second walk here would be a second answer
   * free to disagree with the terminal. `gen-docs-pages.ts` computes it once.
   *
   * It sits ABOVE the filter bar deliberately. The rule on this board is that
   * a filter scopes everything below it; the milestone frame is not scoped by
   * an epic selection, because it is the thing the epics sit inside.
   */
  function milestonePanel(plan) {
    var sec = el("section", { class: "fa-workplan-panel fa-workplan-panel--wide" });
    sec.setAttribute("data-fa-milestones", "");
    var fig = el("figure", { class: "fa-workplan-chart" });
    fig.appendChild(el("figcaption", { class: "fa-workplan-chart-title" },
                       "Declared milestones — share of the work items beneath each that are closed"));
    if (!plan || !plan.milestones) {
      // Never zero bars: "this projection carries no plan" and "no milestone
      // has progress" are different answers.
      fig.appendChild(el("p", { class: "fa-workplan-empty" },
                          "This projection carries no milestone rollup, so the share could not be determined."));
      sec.appendChild(fig);
      return sec;
    }
    if (plan.milestones.length === 0) {
      fig.appendChild(el("p", { class: "fa-workplan-empty" },
                          "No work item in this store is typed milestone."));
      sec.appendChild(fig);
      return sec;
    }
    var list = el("ol", { class: "fa-workplan-bars" });
    for (var i = 0; i < plan.milestones.length; i++) {
      var m = plan.milestones[i];
      // A modifier rather than the bare row class: the epic bars below wrap
      // label/track/value in a <button> that owns their layout, and these
      // rows have no control to wrap. Restyling the shared classes to suit
      // this shape would move the chart underneath it.
      var li = el("li", { class: "fa-workplan-bar-row fa-workplan-bar-row--progress" });
      // The title OPENS THE GOAL in the tree below (owner, 2026-10-16: it
      // looked openable and only went to the source file). The file is the
      // small link beside it, under its own name.
      var href = viewHref(m.file);
      var label = el("button", { type: "button", class: "fa-workplan-bar-label", title: "Show this goal's epics in the tree" }, m.title);
      label.setAttribute("data-goto", m.id);
      var head = el("span", { class: "fa-workplan-bar-label-wrap" });
      head.appendChild(label);
      if (href) {
        head.appendChild(document.createTextNode(" "));
        head.appendChild(el("a", { class: "fa-workplan-bar-file", href: href }, "source"));
      }
      li.appendChild(head);
      var track = el("span", { class: "fa-workplan-bar-track" });
      var fill = el("span", { class: "fa-workplan-bar-fill" });
      // PART-TO-WHOLE: 100% means done, so the width IS the share. A
      // zero-share milestone still gets a sliver, so the row reads as a bar
      // at 0 rather than as a missing bar.
      var pct = m.share === null ? 0 : Math.round(m.share * 100);
      fill.style.width = Math.max(2, pct) + "%";
      track.appendChild(fill);
      li.appendChild(track);
      li.appendChild(el("span", { class: "fa-workplan-bar-value" },
                        m.share === null ? "n/a" : pct + "%"));
      // The counts, because the share is bean-weighted and the counts are what
      // a reader can reconcile against the bar. `in progress` is called out:
      // it is the part somebody is holding.
      li.appendChild(el("span", { class: "fa-workplan-bar-note" },
                        m.closed + " of " + (m.closed + m.open) + " closed · "
                        + m.inProgress + " in progress · " + m.todo + " todo · "
                        + m.epics + (m.epics === 1 ? " epic" : " epics")));
      if (m.unclassified > 0) {
        li.appendChild(el("span", { class: "fa-workplan-bean-blocked" },
                          m.unclassified + " in neither status set"));
      }
      var series = burndownSeries(m.id);
      var spark = series ? sparkline(series, BURNDOWN.days || []) : null;
      if (spark) {
        var cell = el("span", { class: "fa-workplan-bar-burndown" });
        cell.appendChild(spark);
        li.appendChild(cell);
      }
      list.appendChild(li);
    }
    fig.appendChild(list);
    // The denominator, beside the bars rather than in a footnote: percentages
    // with no coverage figure invite the reading that they describe the
    // whole work plan.
    if (typeof plan.coveredOpen === "number" && typeof plan.openTotal === "number") {
      // `coveredOpen` as GIVEN, never `openTotal - orphanOpen`. Those two
      // differ whenever a bean id is held by more than one file, and this
      // board showed both numbers before the rollup reconciled them.
      fig.appendChild(el("p", { class: "fa-workplan-chart-note" },
                          "These bars cover " + plan.coveredOpen + " of " + plan.openTotal
                          + " open work items. The other " + plan.orphanOpen
                          + " sit under no milestone, so the shares above are not a figure for the whole work plan."));
    }
    var bnote = burndownNote();
    if (bnote) fig.appendChild(bnote);
    if (plan.duplicateIds > 0) {
      fig.appendChild(el("p", { class: "fa-workplan-chart-note" },
                          plan.duplicateIds + " work item id(s) are held by more than one file, and are counted once each here."));
    }
    sec.appendChild(fig);
    return sec;
  }

  /**
   * The search field (#2418). A labelled `type=search` input, so it has a
   * name for assistive technology and the browser's own clear control.
   */
  function searchBar() {
    var wrap = el("div", { class: "fa-workplan-search", role: "search" });
    wrap.appendChild(el("label", { for: "fa-workplan-q" }, "Search work items"));
    var input = el("input", {
      type: "search",
      id: "fa-workplan-q",
      class: "fa-workplan-search-input",
      placeholder: "id, title, status, type, text or proposal",
      autocomplete: "off",
      "data-fa-workplan-q": "",
    });
    input.value = QUERY;
    wrap.appendChild(input);
    return wrap;
  }

  /**
   * The beans a search found, listed — because the panels below only COUNT,
   * and a search whose answer is a number is not an answer. Capped, and the
   * cap is said: a silent cut reads as "that is all of them".
   */
  var RESULT_CAP = 200;
  function resultsPanel(found) {
    var sec = el("section", { class: "fa-workplan-panel fa-workplan-panel--wide fa-workplan-results" });
    var n = found.length;
    sec.appendChild(el("h2", { class: "fa-workplan-chart-title", id: "fa-workplan-results-title" },
      n === 0 ? "No work item matches “" + QUERY + "”"
        : n + (n === 1 ? " work item matches" : " work items match") + " “" + QUERY + "”"
          + (n > RESULT_CAP ? " — the first " + RESULT_CAP + " are listed" : "")));
    if (n === 0) return sec;
    var list = el("ul", { class: "fa-workplan-bean-list", "aria-labelledby": "fa-workplan-results-title" });
    for (var i = 0; i < n && i < RESULT_CAP; i++) list.appendChild(beanRow(found[i], true));
    sec.appendChild(list);
    return sec;
  }

  function buildBoard() {
    var beans = BOARD.beans;
    var board = el("div", { class: "fa-workplan-board" });

    if (beans) {
      // The milestone frame FIRST, and outside the scoped region — see
      // `milestonePanel`'s note on why a filter does not scope it.
      board.appendChild(milestonePanel(BOARD.plan));
      // Type filter bar — always visible so the user can filter by type
      board.appendChild(typeFilterBar(beans));
      // Search — ABOVE what it narrows, like the filters beside it.
      board.appendChild(searchBar());
      var scoped = inScope(beans);
      if (QUERY) board.appendChild(resultsPanel(scoped));
      if (SCOPE || TYPE_SCOPE) {
        var epic = null;
        if (SCOPE) {
          for (var i = 0; i < beans.length; i++) if (beans[i].id === SCOPE) epic = beans[i];
        }
        board.appendChild(filterRow(epic));
      }
      // Counts and findings take the SCOPED set so every number on the page
      // answers the same question. `findingsPanel` still gets the full bean
      // array for its id lookup — `linkify` has to resolve a blocker that
      // lives outside the scope, or the sentence loses its link.
      board.appendChild(countsPanel(scoped, SCOPE ? undefined : BOARD.todos));
      var findings = BOARD.findings;
      if (SCOPE || TYPE_SCOPE || QUERY) {
        var scopedMap = Object.create(null);
        for (var s = 0; s < scoped.length; s++) scopedMap[scoped[s].id] = true;
        findings = findings.filter(function (f) {
          return !!scopedMap[f.bean];
        });
      }
      board.appendChild(findingsPanel(beans, findings, scoped));
      board.appendChild(treePanel(beans));
    } else {
      board.appendChild(todoOnlyPanel(BOARD.todos));
    }
    return board;
  }

  /* ── When was this built, and how far behind main is it? ─────────────
   *
   * A reviewer reading counts needs to know WHICH moment they describe. The
   * stamp is not written into the committed page or its projection: bean
   * `y7b3` measured a timestamp in a committed generated file as a merge
   * conflict on every pair of concurrent changes, and the owner ruled them
   * out. So the deploy writes it — `build.json` at the root of the main site
   * (`docs-site.yml`), `staging.json` at the root of a preview
   * (`staging-banner.ts`) — and the page reads it at load time.
   *
   * The distance from main is asked of GitHub at load time too, because it
   * changes with every merge and no build can know it in advance. Every
   * failure renders as "could not determine", never as "up to date": a
   * stamp that cannot say how stale it is must not claim to be fresh.
   */
  var STAMP = null;

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /** The deploy's facts, normalised over the two stamp files' spellings. */
  function readBuildStamp(src) {
    var dir = src.replace(/[^/]*$/, "");
    return fetchJson(src)
      .catch(function () { return fetchJson(dir + "staging.json"); })
      .then(function (f) {
        var sha = f && typeof f.sha === "string" ? f.sha : "";
        if (!sha) throw new Error("no sha");
        return { sha: sha, built: f.built || f.builtAt || "", runUrl: f.runUrl || "" };
      });
  }

  function ageText(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return "";
    var mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 48) return hrs + " h ago";
    return Math.round(hrs / 24) + " days ago";
  }

  /** `https://github.com/<owner>/<repo>` → the API's compare URL, or null. */
  function compareUrl(sha) {
    var m = /^https:\/\/github\.com\/([^/]+)\/([^/]+?)\/?$/.exec(repoWeb);
    return m ? "https://api.github.com/repos/" + m[1] + "/" + m[2] +
      "/compare/" + encodeURIComponent(sha) + "...main" : null;
  }

  function behindText(cmp) {
    if (!cmp || typeof cmp.ahead_by !== "number") return "commits behind main: could not determine";
    if (cmp.ahead_by === 0) return "up to date with main";
    return cmp.ahead_by + (cmp.ahead_by === 1 ? " commit" : " commits") + " behind main";
  }

  function mountStamp(host) {
    var meta = document.querySelector('meta[name="fa-build-src"]');
    var src = meta && meta.getAttribute("content");
    if (!src) return;
    STAMP = el("p", { class: "fa-workplan-stamp", role: "status" },
      "Generated: reading the build stamp\u2026");
    host.insertBefore(STAMP, host.firstChild);
    readBuildStamp(src).then(function (b) {
      STAMP.textContent = "Generated ";
      if (b.built) {
        var time = el("time", { datetime: b.built }, b.built.replace("T", " ").replace("Z", " UTC"));
        STAMP.appendChild(time);
        var age = ageText(b.built);
        if (age) STAMP.appendChild(document.createTextNode(" (" + age + ")"));
        STAMP.appendChild(document.createTextNode(" "));
      }
      STAMP.appendChild(document.createTextNode("from "));
      var code = el("code", null, b.sha.slice(0, 7));
      var commit = repoWeb ? el("a", { href: repoWeb + "/commit/" + b.sha }) : null;
      if (commit) { commit.appendChild(code); STAMP.appendChild(commit); } else STAMP.appendChild(code);
      var behind = document.createTextNode(" \u00b7 checking how far main has moved\u2026");
      STAMP.appendChild(behind);
      var url = compareUrl(b.sha);
      (url ? fetchJson(url) : Promise.reject(new Error("no repo")))
        .then(function (cmp) { behind.textContent = " \u00b7 " + behindText(cmp); })
        .catch(function () { behind.textContent = " \u00b7 " + behindText(null); });
    }).catch(function () {
      // Absent on a local build; a third state, said rather than hidden.
      STAMP.textContent = "Generated: no build stamp on this deploy, so its age could not be determined.";
    });
  }

  /** Swap the board in place, preserving nothing but the scope and stamp. */
  function renderBoard(host) {
    host.textContent = "";
    if (STAMP) host.appendChild(STAMP);
    host.appendChild(buildBoard());
  }

  /**
   * One delegated listener for the whole board, because the board is replaced
   * wholesale on every scope change and per-node listeners would be re-bound
   * each time — or, worse, leak against nodes that are gone.
   */
  function wireBoard(host) {
    // The search field. Debounced, and the board is rebuilt under the reader's
    // cursor — so focus and caret are put back on the NEW field, or every
    // keystroke would drop a keyboard user to <body>.
    var pending = null;
    host.addEventListener("input", function (ev) {
      var q = ev.target && ev.target.closest ? ev.target.closest("[data-fa-workplan-q]") : null;
      if (!q) return;
      clearTimeout(pending);
      pending = setTimeout(function () {
        var val = q.value.trim();
        if (val === QUERY) return;
        QUERY = val;
        saveQuery();
        renderBoard(host);
        var again = host.querySelector("[data-fa-workplan-q]");
        if (again) {
          again.focus();
          var end = again.value.length;
          try { again.setSelectionRange(end, end); } catch (_e) { /* not a text field */ }
        }
      }, 100);
    });
    host.addEventListener("change", function (ev) {
      if (!ev.target || !ev.target.hasAttribute || !ev.target.hasAttribute("data-fa-workplan-closed")) return;
      SHOW_CLOSED = !!ev.target.checked;
      renderBoard(host);
      var again = host.querySelector("[data-fa-workplan-closed]");
      if (again) again.focus();
    });
    host.addEventListener("click", function (ev) {
      // A goal's title in the milestone panel: open that goal in the tree.
      var goto = ev.target.closest ? ev.target.closest("[data-goto]") : null;
      if (goto) {
        var id = goto.getAttribute("data-goto");
        var sel = '.fa-workplan-tree [data-bean="' + id.replace(/["\\]/g, "") + '"]';
        var det = host.querySelector(sel);
        if (!det) {
          // Filtered or scoped out of the tree: clear, so the goal is there.
          SCOPE = ""; TYPE_SCOPE = ""; QUERY = "";
          saveQuery();
          renderBoard(host);
          det = host.querySelector(sel);
        }
        if (det) {
          // A goal with nothing shown under it is a leaf: no branch to open,
          // but it is still scrolled to and focused.
          if (det.faOpen) det.faOpen();
          var tog = det.querySelector(".fa-workplan-tree-toggle, .fa-workplan-bean-link[href]");
          det.scrollIntoView({ block: "start" });
          if (tog) tog.focus();
        }
        return;
      }
      // Type filter buttons — check FIRST because the "Show everything"
      // button carries BOTH data-scope and data-type-scope
      var typer = ev.target.closest ? ev.target.closest("[data-type-scope]") : null;
      if (typer) {
        var newType = typer.getAttribute("data-type-scope");
        // "Show everything" also has data-scope="" to clear the epic scope
        if (typer.hasAttribute("data-scope")) {
          SCOPE = typer.getAttribute("data-scope");
        }
        TYPE_SCOPE = newType;
        renderBoard(host);
        // Focus the clicked button's new position
        var focus = host.querySelector(".fa-workplan-type-btn.is-active");
        if (focus) focus.focus();
        return;
      }
      var scoper = ev.target.closest ? ev.target.closest("[data-scope]") : null;
      if (scoper) {
        SCOPE = scoper.getAttribute("data-scope");
        renderBoard(host);
        // Focus lands where the reader was looking. Without this, replacing
        // the board drops focus to <body> and a keyboard user restarts at the
        // top of the document.
        var back = host.querySelector(SCOPE
          ? ".fa-workplan-tree-toggle"
          : ".fa-workplan-type-btn.is-active");
        if (back) back.focus();
        return;
      }
    });
  }

  /**
   * Say in the DOM that a projection could not be read.
   *
   * `skills/ui/ui-core/ui-accessibility.md` §"A rendering built client-side
   * owes two things the static one gave for free": *"a `console.warn` is not
   * saying so: it reaches a developer with the console open and no reader
   * ever."* Until 2026-10-02 this file's only failure path was that warning,
   * which made it the live instance of the defect that rule names.
   *
   * APPENDED beside the authored fallback rather than replacing it. The rule
   * `mountWorkPlan` already follows is that the fallback is replaced on
   * success and LEFT ALONE on failure, because it links the data file and an
   * empty box would not. Both hold: the reader keeps the working link AND is
   * told that what they are looking at is a failure rather than an empty work
   * plan. `aria-live` is not used — the message is present at first render of
   * the failure, so there is nothing for a live region to announce.
   *
   * Idempotent on the id, so two failed halves say so once rather than twice.
   */
  function renderFailure(host, noun, url, message) {
    if (host.querySelector('[data-fa-workplan-failed="' + noun + '"]')) return;
    var note = FA.failureNote(noun, url, message, "fa-workplan-failed");
    note.setAttribute("data-fa-workplan-failed", noun);
    host.appendChild(note);
  }

  /** The search in the URL as `?q=`, so a search can be linked and survives reload. */
  function saveQuery() {
    try {
      var url = new URL(window.location.href);
      if (QUERY) url.searchParams.set("q", QUERY); else url.searchParams.delete("q");
      window.history.replaceState(null, "", url.toString());
    } catch (_e) { /* a file:// page or no history API — the search still works */ }
  }

  /**
   * Fetch the burn-down feed beside the bean index and redraw ONLY the
   * milestone panel, so a late answer never resets the tree a reader has
   * already opened. Absent or unreadable is `null`: "no history in this
   * build", which is what an ordinary (non-publish) build is.
   */
  function loadBurndown(host, beanUrl) {
    var url;
    try { url = new URL("burndown.json", new URL(beanUrl, document.baseURI)).href; } catch (_e) { return; }
    fetchJson(url)
      .then(function (doc) { BURNDOWN = doc && typeof doc === "object" ? doc : null; })
      .catch(function () { BURNDOWN = null; })
      .then(function () {
        var old = host.querySelector("[data-fa-milestones]");
        if (old && BOARD) old.replaceWith(milestonePanel(BOARD.plan));
      });
  }

  function mountWorkPlan() {
    var host = document.querySelector("[data-fa-workplan]");
    if (!host) return;
    var region = FA.region ? FA.region("work-plan") : null;
    try { QUERY = (new URL(window.location.href).searchParams.get("q") || "").trim(); } catch (_e) { QUERY = ""; }
    // A page about ONE graph says so on its container (#2418): the themed
    // `/beans/` page sits under a layout whose head carries `fa-todo-src` for
    // every page, and asking for it would quietly turn the beans view into the
    // combined one. Not asked is `undefined` — "never asked", not "failed".
    var only = host.getAttribute("data-fa-workplan-only");
    var askTodos = only === "beans"
      ? function (_meta, done) { done(undefined, undefined, undefined); }
      : fetchIndex;
    fetchIndex("fa-beans-src", function (beanDoc, beanWhy, beanUrl) {
      askTodos("fa-todo-src", function (todoDoc, todoWhy, todoUrl) {
        // SAID IN THE PAGE, per half, before anything is decided about
        // rendering. `null` is "asked and could not read"; `undefined` is
        // "never asked", and a page that deliberately shows only one graph
        // must not report the other as broken.
        if (beanDoc === null) renderFailure(host, "work plan", beanUrl, beanWhy);
        if (todoDoc === null) renderFailure(host, "todo index", todoUrl, todoWhy);
        if (region) {
          if (beanDoc === null || todoDoc === null) region.failed();
          else region.ready();
        }
        // Nothing to show at all — a fetch that failed, or a page carrying
        // neither meta. The container's fallback prose stays put, because it
        // links the data directly and an empty box would not; the note above
        // is what distinguishes the two cases for the reader.
        if (!beanDoc && !todoDoc) return;

        // Either projection carries it and both agree, because one generator
        // detects it once. Taking the first that has it means a todos-only
        // page still gets its links.
        repoWeb = (beanDoc && beanDoc.repoWeb) || (todoDoc && todoDoc.repoWeb) || "";
        fileWeb = (beanDoc && beanDoc.fileWeb) || repoWeb;
        fileRef = (beanDoc && beanDoc.fileRef) || "main";

        var todoItems = todoDoc === undefined ? undefined : (todoDoc ? todoDoc.items : null);

        // A todos-only page keeps `beans` null, and `buildBoard` renders the
        // todo panel alone. The bean panels are NOT stubbed out with zeros:
        // this page was never asked about beans, and a zero is an answer.
        ALL_BEANS = beanDoc ? beanDoc.items : [];
        BY_ID = null;
        BOARD = {
          beans: beanDoc ? beanDoc.items : null,
          todos: todoItems,
          findings: beanDoc && Array.isArray(beanDoc.findings) ? beanDoc.findings : [],
          // `undefined` when the projection carries no `plan` at all — an
          // older index, or a store with no milestone bean. That is NOT the
          // same as a plan with nothing done, so `milestonePanel` says which
          // it got rather than drawing empty bars.
          plan: beanDoc ? beanDoc.plan : undefined,
        };

        renderBoard(host);
        mountStamp(host);
        wireBoard(host);
        if (beanDoc && beanUrl) loadBurndown(host, beanUrl);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWorkPlan);
  } else {
    mountWorkPlan();
  }
})();
