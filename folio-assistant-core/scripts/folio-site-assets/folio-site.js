// folio-site: the loader every shell page shares (build-folio-site.ts).
// A shell names its paper, its path below the paper and, on a block page, its
// block. This fetches the paper's top-level outline and the ONE chapter
// outline the page is in (the paper page fetches each chapter's as the reader
// scrolls to it), lays out contents and breadcrumbs, and loads the scope's
// blocks (KG nodes with rendered HTML) a unit at a time as the reader scrolls.
// Math is rendered by KaTeX as it nears the viewport.
//
// Fetch failures are SAID on the page (kg-render.js's failureNote), and the
// page reports `data-fa-render` = ready / failed through kg-render's region,
// so print and PDF can wait for it. `?print` loads the whole scope first.
(async () => {
  const body = document.body;
  const root = body.dataset.root || "./";
  const paper = body.dataset.paper;
  const path = body.dataset.path || "";
  const blockRef = body.dataset.block || ""; // `<chapter>/<root>` on a block page
  const $ = (id) => document.getElementById(id);
  const content = $("content");
  const R = window.faRender;
  const region = R ? R.region("content") : null;
  const printMode = /[?&]print\b/.test(location.search);
  const el = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  // A title may carry `$…$`; it becomes a math node like a block's.
  const titled = (text) => {
    const f = document.createDocumentFragment();
    String(text).split(/(\$[^$]+\$)/).forEach((part) => {
      if (/^\$[^$]+\$$/.test(part)) f.append(Object.assign(document.createElement("code"), { className: "math-inline", textContent: part.slice(1, -1) }));
      else if (part) f.append(part);
    });
    return f;
  };
  const link = (h, text) => { const a = el("a", { href: h }); a.append(titled(text)); return a; };
  const cache = new Map();
  const getJSON = (u) => {
    if (!cache.has(u)) cache.set(u, fetch(u).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }));
    return cache.get(u);
  };
  const failed = (noun, url, e) => (R ? R.failureNote(noun, url, e && e.message) : el("p", { class: "fa-render-failed", role: "status" }, `This ${noun} could not be loaded from ${url}: ${e && e.message}.`));
  const fail = (noun, url, e) => { content.replaceChildren(failed(noun, url, e)); if (region) region.failed(); };

  if (!paper) {
    const u = root + "papers.json";
    let papers;
    try { ({ papers } = await getJSON(u)); } catch (e) { return fail("list of documents", u, e); }
    content.replaceChildren(...papers.map((p) => { const li = el("p"); li.append(el("a", { href: `${root}${p.slug}/` }, p.title)); return li; }));
    if (region) region.ready();
    return;
  }

  const pbase = `${root}${paper}/`;
  let outline;
  try { outline = await getJSON(pbase + "outline.json"); } catch (e) { return fail("outline", pbase + "outline.json", e); }
  const href = (p) => `${pbase}${p ? p + "/" : ""}`;
  const chapterOf = (slug) => getJSON(`${pbase}outline/${slug}.json`);
  const segs = path ? path.split("/") : [];
  const [blockCh, blockRoot] = blockRef ? [blockRef.slice(0, blockRef.indexOf("/")), blockRef.slice(blockRef.indexOf("/") + 1)] : [];
  const chSlug = blockCh || segs[0];
  let chOutline = null;
  if (chSlug) {
    try { chOutline = await chapterOf(chSlug); } catch (e) { return fail("chapter outline", `${pbase}outline/${chSlug}.json`, e); }
  }

  // ── Where this page sits: section trail, and on a block page the section holding it ──
  let node = null; const trail = []; let secPath = path;
  if (blockRef && chOutline) {
    const find = (secs, p) => { for (const s of secs) { const sp = `${p}/${s.slug}`; if (s.blocks.includes(blockRoot)) return sp; const r = find(s.sections, sp); if (r) return r; } return null; };
    secPath = find(chOutline.sections, chOutline.slug) || chOutline.slug;
  }
  const ssegs = secPath ? secPath.split("/") : [];
  if (chOutline) {
    node = chOutline; trail.push([chOutline.title, chOutline.slug]);
    for (let i = 1; node && i < ssegs.length; i++) {
      node = node.sections.find((s) => s.slug === ssegs[i]);
      if (node) trail.push([node.title, ssegs.slice(0, i + 1).join("/")]);
    }
    if (!node) { content.replaceChildren(el("p", {}, "This page is not in the outline.")); if (region) region.failed(); return; }
  }

  // ── Contents and breadcrumbs ──
  const leanBadge = (lean) => {
    if (!lean || !(lean.proved || lean.sorry || lean.absent)) return null;
    const b = el("span", { class: "lean-badge", title: `Lean: ${lean.proved} with no sorry, ${lean.sorry} with sorry, ${lean.absent || 0} expected but absent` });
    b.textContent = [lean.proved ? "✓" + lean.proved : "", lean.sorry ? "◐" + lean.sorry : "", lean.absent ? "∅" + lean.absent : ""].filter(Boolean).join(" ");
    return b;
  };
  const tocList = (items, prefix) => {
    const ul = el("ul");
    for (const it of items) {
      const p = prefix ? `${prefix}/${it.slug}` : it.slug;
      const li = el("li");
      const a = link(href(p), it.number ? `${it.number} ${it.title}` : it.title);
      if (p === secPath && !blockRef) a.setAttribute("aria-current", "page");
      const b = leanBadge(it.lean);
      if (b) a.append(" ", b); // inside the link: the harness navbar lays its links out as blocks
      li.append(a);
      // The current chapter is the only one whose tree this page holds.
      const kids = !prefix && chOutline && it.slug === chOutline.slug ? chOutline.sections : it.sections;
      if (kids && kids.length && (secPath === p || secPath.startsWith(p + "/"))) li.append(tocList(kids, p));
      ul.append(li);
    }
    return ul;
  };
  const tocHead = el("p"); tocHead.append(link(href(""), outline.title));
  $("toc").replaceChildren(tocHead, tocList(outline.chapters, ""));
  const crumbs = $("crumbs");
  crumbs.append(el("a", { href: href("") }, outline.title));
  for (const [t, p] of blockRef ? trail : trail.slice(0, -1)) { crumbs.append(" › "); crumbs.append(link(href(p), t)); }

  // ── The scope as a list of units, each one section's own blocks ──
  const units = [];
  const flatten = (sec, p, level, ch, into) => {
    into.push({ title: sec.title, number: sec.number, label: sec.label, path: p, level, blocks: sec.blocks, ch });
    for (const sub of sec.sections) flatten(sub, `${p}/${sub.slug}`, level + 1, ch, into);
  };
  if (blockRef) units.push({ title: "", path: secPath, level: 2, blocks: [blockRoot], self: true, ch: blockCh });
  else if (!chOutline) for (const ch of outline.chapters) units.push({ title: ch.title, number: ch.number, label: ch.label, path: ch.slug, level: 2, blocks: [], expand: ch.slug });
  else if (ssegs.length === 1) for (const s of chOutline.sections) flatten(s, `${chOutline.slug}/${s.slug}`, 2, chOutline.slug, units);
  else { units.push({ title: "", path: secPath, level: 2, blocks: node.blocks, self: true, ch: chOutline.slug }); for (const s of node.sections) flatten(s, `${secPath}/${s.slug}`, 3, chOutline.slug, units); }

  // ── Math, rendered lazily ──
  let katexReady = null;
  const loadKatex = () => katexReady ??= new Promise((ok) => {
    // The stylesheet is in the shell, BEFORE ours; appending it here again put it after ours and
    // restored KaTeX's 1.21em, so math stood taller than the text around it.
    const js = el("script", { src: "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" });
    js.onload = ok; js.onerror = ok; document.head.append(js);
  });
  const renderMath = (m) => {
    const display = m.classList.contains("math-display");
    const out = el(display ? "div" : "span");
    try { katex.render(m.textContent, out, { throwOnError: false, displayMode: display, macros: outline.macros }); } catch { return; }
    (display && m.parentElement && m.parentElement.tagName === "PRE" ? m.parentElement : m).replaceWith(out);
  };
  const mathIO = new IntersectionObserver((entries) => {
    for (const e of entries) { if (!e.isIntersecting) continue; mathIO.unobserve(e.target); renderMath(e.target); }
  }, { rootMargin: "1500px 0px" });
  const watchMath = async (scope) => {
    const nodes = scope.querySelectorAll("code.math-inline, code.math-display");
    if (!nodes.length || !outline.math) return;
    await loadKatex();
    if (!window.katex) return;
    nodes.forEach((n) => (printMode ? renderMath(n) : mathIO.observe(n)));
  };

  const h1 = document.querySelector("main h1");
  if (h1 && h1.textContent.includes("$")) { const t = h1.textContent; h1.replaceChildren(titled(t)); }
  for (const scope of [$("toc"), crumbs, h1]) if (scope) watchMath(scope);

  // With the harness chrome present, the contents live IN its navbar — a group
  // at the top of the scrollable middle — not in a second sidebar beside it.
  // Without it (a bare build), the page keeps its own.
  const adopt = () => {
    const graphs = document.querySelector("nav.fa-nav .fa-nav-graphs");
    if (!graphs) return false;
    const g = el("details", { class: "fa-nav-group folio-contents", open: "" });
    const s = el("summary"); s.append(el("span", { class: "fa-nav-glyph", "aria-hidden": "true" }, "§"));
    const lab = el("span", { class: "fa-nav-label" }); lab.append(titled(outline.title)); s.append(lab);
    const sub = el("div", { class: "fa-nav-sub" }); sub.append(tocList(outline.chapters, ""));
    g.append(s, sub);
    graphs.prepend(g);
    watchMath(g);
    $("toc").remove();
    body.classList.add("in-harness");
    return true;
  };
  if (!adopt() && document.querySelector("nav.fa-nav")) {
    const mo = new MutationObserver(() => { if (adopt()) mo.disconnect(); });
    mo.observe(document.querySelector("nav.fa-nav"), { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 10000);
  }

  // ── One block's row of actions: QA, Lean, edit, feedback, its own page ──
  const src = outline.source;
  // The ✍ suggest editor's profiles (their modules are relative to the route
  // base) and the KaTeX macros they are handed: the ones this page renders with.
  const suggest = outline.suggest
    ? { katexMacros: outline.macros || {}, profiles: outline.suggest.profiles.map((p) => ({ ...p, module: root + p.module })) }
    : undefined;
  if (src && window.faEditLinks) window.faEditLinks.configure({ repo: src.repository, branch: src.ref, ...(suggest ? { suggest } : {}) });
  let qaPanel = null;
  const openQa = async (n, ch, rootName, title) => {
    qaPanel ??= new Promise((ok, no) => { const s = el("script", { src: `${root}assets/qa-panel.js` }); s.onload = () => ok(window.folioSiteQa); s.onerror = no; document.head.append(s); });
    const url = `${pbase}qa/${ch}/${rootName}.json`;
    const panel = await qaPanel;
    let report = null, err = null;
    if (n.qa) { try { report = await getJSON(url); } catch (e) { err = e; } }
    panel.open({ report, error: err && failed("QA report", url, err), title, lean: n.lean, source: src, leanStatus: outline.leanStatus, previewUrl: `${root}preview-qa.json` });
  };
  const leanLink = (L) => {
    if (L.path) {
      const c = L.compiles || "unchecked";
      const build = { pass: "builds", fail: "build fails", unverifiable: "build unverifiable", unchecked: "build unchecked" }[c];
      const glyph = { pass: "✓", fail: "✗", unverifiable: "?", unchecked: "?" }[c];
      const a = el("a", { "data-src": L.path, "data-fa-link": "source", class: `lean lean-${L.sorry ? "sorry" : "proved"} build-${c}`, "aria-label": "Lean formalisation",
        title: `Lean: ${L.path}${L.via === "ref" ? ` (via lean.ref ${L.ref})` : ""} — ${L.sorry ? "has a sorry" : "no sorry"}${L.sorryBasis === "text" ? " (read from the text)" : ""}; ${build}${c === "unchecked" ? " (no measured compile status for this build)" : ""}${L.error ? "\n" + L.error : ""}` },
        `Lean ${L.sorry ? "◐" : "✓"} ${glyph}`);
      if (src) a.href = `https://github.com/${src.repository}/blob/${src.ref}/${L.path}`;
      return a;
    }
    if (!L.expected) return null;
    const why = L.ref ? (L.refState === "no-resolver" ? `its lean.ref ${L.ref} could not be resolved: the folio declares no Lean packages` : `its lean.ref ${L.ref} does not resolve to a file`) : "it has no lean.ref and no sibling .lean";
    return el("span", { class: "lean lean-absent", "aria-disabled": "true", title: `A block of this kind is expected to carry Lean; ${why}.` }, "Lean ∅");
  };
  const actions = (n, ch, rootName) => {
    const row = el("span", { class: "block-links" });
    const name = n.number ? `${n.heading} ${n.number}` : n.heading || "";
    const title = [name, n.title].filter(Boolean).join(" — ") || n.label || rootName;
    // QA: the counts ride in the payload; the full report is fetched when opened.
    const q = n.qa;
    const b = el("a", { href: "#", role: "button", class: "qa-badge" + (q ? (q.counts.fail || q.counts.warn ? " has-bad" : "") + (q.milnor && q.milnor.notPassing ? " milnor-bad" : "") : " none"),
      title: q ? `QA: ${q.counts.pass} pass, ${q.counts.fail} fail, ${q.counts.warn} warn, ${q.counts.na} n/a${q.counts.stale ? `, ${q.counts.stale} stale` : ""} — open the report` : "No QA verdict is recorded for this block" });
    b.textContent = q ? `QA ${q.counts.pass}✓${q.counts.fail + q.counts.warn ? ` ${q.counts.fail + q.counts.warn}✗` : ""}${q.milnor ? (q.milnor.notPassing ? ` · Milnor ${q.milnor.notPassing}✗` : " · Milnor ✓") : ""}${q.counts.stale ? " · stale" : ""}` : "QA —";
    b.addEventListener("click", (ev) => { ev.preventDefault(); openQa(n, ch, rootName, title); });
    row.append(b);
    if (n.lean) { const l = leanLink(n.lean); if (l) row.append(l); }
    // Edit the source and give feedback: the platform's one recipe, edit-links.js (bean v433);
    // the row carries the block's facts and the hrefs are built when a pointer or focus reaches them.
    if (src && n.source) {
      row.setAttribute("data-src", n.source);
      row.setAttribute("data-block", n.label || n.source);
      if (title) row.setAttribute("data-sec", title);
      row.append(el("a", { "data-fa-link": "edit", href: `https://github.com/${src.repository}/edit/${src.ref}/${n.source}`, title: "Edit the source on GitHub", "aria-label": "Edit the source" }, "✎ edit"));
      row.append(el("a", { "data-fa-link": "feedback", title: "Give feedback: open an issue on this block", "aria-label": "Give feedback" }, "\u{1F4E3} feedback"));
    }
    if (n.page && !blockRef) row.append(el("a", { href: pbase + n.page + "/", class: "permalink", title: "This block on its own page", "aria-label": "Block page" }, "¶"));
    return row;
  };

  // ── Incremental loading ──
  content.replaceChildren();
  let next = 0;
  const loadUnit = async () => {
    if (next >= units.length) return false;
    const u = units[next++];
    if (u.expand) {
      // A chapter on the paper page: its tree arrives when the reader reaches it.
      try {
        const co = await chapterOf(u.expand);
        const more = [];
        for (const s of co.sections) flatten(s, `${co.slug}/${s.slug}`, 3, co.slug, more);
        units.splice(next, 0, ...more);
      } catch (e) { content.append(failed("chapter outline", `${pbase}outline/${u.expand}.json`, e)); }
    }
    const box = el("section", { class: "unit" });
    if (u.label) box.id = u.label;
    if (!u.self) { const h = el(`h${Math.min(6, u.level)}`); h.append(link(href(u.path), u.number ? `${u.number} ${u.title}` : u.title)); box.append(h); }
    content.append(box);
    const nodes = await Promise.all(u.blocks.map((b) => { const url = `${pbase}blocks/${u.ch}/${b}.json`; return getJSON(url).catch((e) => ({ failed: failed("block", url, e) })); }));
    nodes.forEach((n, i) => {
      if (n.failed) { box.append(n.failed); return; }
      const d = el("div", { class: `block kind-${n.kind || "prose"}` });
      d.innerHTML = n.html || "";
      // The heading, typeset as a paper does: "Proposition 2.3.1 (Frobenius relation)." / "Proof."
      if (n.kind === "proof") {
        // "Proof of X" as a title only repeats the heading, so it is dropped.
        const t = n.title && !/^proof\b/i.test(n.title) ? `Proof (${n.title}).` : "Proof.";
        const h = el("span", { class: "thm-head" }); const it = el("i"); it.append(titled(t)); h.append(it);
        (d.querySelector("p") || d).prepend(h, " ");
        // One end-of-proof mark: the author's own (\square, \qed, □, ∎) if the proof has one, else ours.
        if (!/\\(square|blacksquare|qed|Box)\b|[□∎]/.test(n.html || "")) d.classList.add("qed");
      } else if (n.heading) {
        const h = el("span", { class: "thm-head" });
        h.append(el("b", {}, n.number ? `${n.heading} ${n.number}` : n.heading));
        if (n.title) { h.append(" ("); h.append(titled(n.title)); h.append(")"); }
        h.append(".");
        (d.querySelector("p") || d).prepend(h, " ");
      } else if (n.title) {
        const h = el("p", { class: "prose-title" }); const b = el("b"); b.append(titled(n.title)); h.append(b); d.prepend(h);
      }
      d.prepend(actions(n, u.ch, u.blocks[i]));
      // Pre-rendered figures name a path below the paper; resolve it here, since this block may sit at any depth.
      for (const img of d.querySelectorAll("img[data-src]")) {
        // dvisvgm draws at 1pt = 1px, smaller than the text around it; scale to the body's size.
        img.addEventListener("load", () => { if (img.naturalWidth) img.style.width = `${Math.round(img.naturalWidth * 1.6)}px`; }, { once: true });
        img.src = pbase + img.getAttribute("data-src");
      }
      box.append(d);
    });
    await watchMath(box);
    return true;
  };
  const sentinel = el("p", { class: "muted" }, "…");
  const fill = async () => { while ((printMode || sentinel.getBoundingClientRect().top < innerHeight * 3) && await loadUnit()) content.append(sentinel); if (next >= units.length) sentinel.remove(); };
  content.append(sentinel);
  new IntersectionObserver((e) => { if (e[0].isIntersecting) fill(); }, { rootMargin: "2000px 0px" }).observe(sentinel);

  // ── Cross-references ──
  // A reference in a block carries its target page (`data-at`, written at build
  // time), so following one needs no index. Only a `#label` with no `data-at` —
  // one that arrived in the URL — is looked up, in the per-chapter label shards:
  // this page's chapter first, the rest only if that misses.
  const lookup = async (label) => {
    const shard = (slug) => getJSON(`${pbase}labels/${slug}.json`).then((s) => s.labels[label]).catch(() => undefined);
    if (chSlug) { const w = await shard(chSlug); if (w !== undefined) return w; }
    const hits = await Promise.all(outline.chapters.filter((c) => c.slug !== chSlug).map((c) => shard(c.slug)));
    return hits.find((w) => w !== undefined);
  };
  // The paper page loads a chapter only when the reader scrolls to it, so a
  // target there is reached by going to its own page, not by loading the paper.
  const inScope = (where) => !blockRef && !!path && (where === path || where.startsWith(path + "/"));
  const goTo = async (label, where) => {
    if (document.getElementById(label)) { document.getElementById(label).scrollIntoView(); return true; }
    if (where === undefined) where = await lookup(label);
    if (where === undefined) return false;
    if (!inScope(where)) { location.href = `${href(where)}#${encodeURIComponent(label)}`; return true; }
    while (!document.getElementById(label) && await loadUnit()) content.append(sentinel);
    document.getElementById(label)?.scrollIntoView();
    return true;
  };
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a || a.getAttribute("role") === "button") return;
    const label = decodeURIComponent(a.getAttribute("href").slice(1));
    if (!label || document.getElementById(label)) return;
    ev.preventDefault();
    goTo(label, a.dataset.at).then((ok) => { if (ok) history.replaceState(null, "", `#${encodeURIComponent(label)}`); });
  });
  if (location.hash) await goTo(decodeURIComponent(location.hash.slice(1)));
  await fill();
  if (region) region.ready();
})();
