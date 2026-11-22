/**
 * The diff renderers the review page runs in the reviewer's browser. Their
 * registry, what each needs and which block kinds each is the default for, is
 * `schemas/ui/diff-renderers.ts`.
 *
 * Every function here is SELF-CONTAINED: it closes over nothing in this
 * module and gets what it needs as arguments. `gen-review-page` embeds each
 * one with `toString()`, so the code the e2e test drives is the code the page
 * runs.
 *
 * ## Rendered HTML is the folio's own, and it is still cleaned
 *
 * The inline renderer shows a block AS RENDERED, so it must place HTML. That
 * HTML is `changeset-text.json`'s: the folio's own prose, rendered by the
 * platform in the folio's own staging job, the same trust as the preview page
 * beside it. It is parsed with `DOMParser` into a detached document, never
 * assigned to `innerHTML`, and {@link cleanRendered} removes what has no
 * business in a diff:
 * - scripts and anything that embeds another document;
 * - `on*` handler attributes;
 * - `javascript:` URLs.
 *
 * A block label, which is data rather than markup, still only ever goes
 * through `textContent`.
 */

/**
 * Parse rendered HTML into a detached, cleaned body.
 *
 * `base`, when given, is the directory of the page the HTML was rendered for.
 * A relative `src` or `href` (a figure's `media/fig.svg`) is resolved from
 * there, since the review page sits in another directory and would otherwise
 * show a broken image.
 */
export function cleanRendered(doc: Document, html: string, base?: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  if (base) {
    parsed.querySelectorAll("img[src],source[src],a[href]").forEach((el) => {
      const attr = el.hasAttribute("src") ? "src" : "href";
      const v = el.getAttribute(attr) || "";
      if (v && !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(v)) el.setAttribute(attr, base + v);
    });
  }
  parsed.querySelectorAll("script,iframe,object,embed,frame,frameset,link,meta,base,form").forEach((n) => n.remove());
  parsed.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.replace(/[\s\u0000-\u001f]/g, "").toLowerCase();
      if (/^on/i.test(a.name) || ((a.name === "href" || a.name === "src" || a.name === "xlink:href") && v.startsWith("javascript:"))) {
        el.removeAttribute(a.name);
      }
    }
  });
  return doc.importNode(parsed.body, true) as HTMLElement;
}

/**
 * A before/after pair when a block's pictures changed, else null.
 *
 * The text diffs compare words, so a figure swapped for a new one (same alt
 * text, new `src`) shows no mark at all. This puts the old and the new picture
 * side by side, labelled, so the change is visible. Each side is cleaned with
 * its own page's directory (`cleanBase`, `cleanHead`).
 */
export function imageChange(
  doc: Document,
  baseHtml: string | null,
  headHtml: string | null,
  cleanBase: (doc: Document, html: string) => HTMLElement,
  cleanHead: (doc: Document, html: string) => HTMLElement,
): HTMLElement | null {
  const srcs = (html: string | null) => (html === null ? [] : Array.from(new DOMParser().parseFromString(html, "text/html").querySelectorAll("img")).map((i) => i.getAttribute("src") || ""));
  const b = srcs(baseHtml);
  const h = srcs(headHtml);
  if (b.join("\n") === h.join("\n")) return null;
  const box = doc.createElement("div");
  box.className = "diff-figures";
  const side = (label: string, cls: string, html: string | null, clean: (doc: Document, html: string) => HTMLElement) => {
    const col = doc.createElement("figure");
    col.className = "diff-figure " + cls;
    const cap = doc.createElement("figcaption");
    cap.textContent = label;
    col.appendChild(cap);
    const imgs = html === null ? [] : Array.from(clean(doc, html).querySelectorAll("img"));
    if (!imgs.length) { const p = doc.createElement("p"); p.className = "muted"; p.textContent = "no picture"; col.appendChild(p); }
    imgs.forEach((i) => col.appendChild(i));
    box.appendChild(col);
  };
  side("Before", "diff-figure-base", baseHtml, cleanBase);
  side("After", "diff-figure-head", headHtml, cleanHead);
  return box;
}

/** The source-level word diff: `<del>` removed, `<ins>` added, the rest as typed. */
export function renderWordDiff(doc: Document, ops: Array<{ op: string; text: string }>): HTMLElement {
  const pre = doc.createElement("pre");
  pre.className = "diff diff-word";
  for (const o of ops) {
    const el = doc.createElement(o.op === "ins" ? "ins" : o.op === "del" ? "del" : "span");
    el.textContent = o.text;
    pre.appendChild(el);
  }
  return pre;
}

/**
 * The block as a reader sees it now, with the change marked in place.
 *
 * The word diff runs on the rendered TEXT of both sides. Its operations are
 * then mapped back onto the head's text nodes: an added run becomes `<ins>`
 * around exactly those characters, and a removed run is inserted as `<del>`
 * at the point where it was. The markup around the text (emphasis, links,
 * list items) is the head's own and is left intact, so the reader sees the
 * page, not the source.
 *
 * Returns a string, a reason, when the diff is too large to compute.
 */
export function renderInline(
  doc: Document,
  baseHtml: string | null,
  headHtml: string | null,
  diff: (a: string, b: string) => Array<{ op: string; text: string }> | null,
  clean: (doc: Document, html: string) => HTMLElement,
): HTMLElement | string {
  const box = doc.createElement("div");
  box.className = "diff diff-inline";
  if (headHtml === null) {
    const del = doc.createElement("del");
    if (baseHtml !== null) del.appendChild(clean(doc, baseHtml));
    box.appendChild(del);
    return box;
  }
  const head = clean(doc, headHtml);
  const baseText = baseHtml === null ? "" : clean(doc, baseHtml).textContent || "";
  const texts: Text[] = [];
  const walker = doc.createTreeWalker(head, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) texts.push(n as Text);
  const headText = texts.map((t) => t.data).join("");
  const ops = diff(baseText, headText);
  if (ops === null) return "This block is too long for an inline diff. Choose the word diff or side by side.";

  // Inserted character ranges, and removed text keyed by the head offset it sat at.
  const ins: Array<[number, number]> = [];
  const dels = new Map<number, string>();
  let off = 0;
  for (const o of ops) {
    if (o.op === "same") off += o.text.length;
    else if (o.op === "ins") { ins.push([off, off + o.text.length]); off += o.text.length; }
    else if (o.text.trim()) dels.set(off, (dels.get(off) || "") + o.text);
  }
  const inIns = (i: number) => ins.some(([s, e]) => i >= s && i < e);

  let start = 0;
  texts.forEach((t, k) => {
    const end = start + t.data.length;
    const frag = doc.createDocumentFragment();
    let run = "";
    let runIns = false;
    const flush = () => {
      if (!run) return;
      if (runIns) { const e = doc.createElement("ins"); e.textContent = run; frag.appendChild(e); }
      else frag.appendChild(doc.createTextNode(run));
      run = "";
    };
    // A deletion at the boundary between two text nodes goes at the END of the
    // earlier one. Placed at the start of the later one, it would land inside
    // whatever element that node opens, so a removed plain word would read as
    // part of the new bold phrase that replaced it.
    for (let i = start; i <= end; i++) {
      if (dels.has(i) && (i > start || k === 0)) {
        flush();
        const d = doc.createElement("del");
        d.textContent = dels.get(i)!;
        frag.appendChild(d);
        dels.delete(i);
      }
      if (i === end) break;
      const isIns = inIns(i);
      if (isIns !== runIns) { flush(); runIns = isIns; }
      run += t.data[i - start];
    }
    flush();
    t.replaceWith(frag);
    start = end;
  });
  // Removed text with no head text at all to sit beside.
  for (const [, text] of dels) { const d = doc.createElement("del"); d.textContent = text; head.appendChild(d); }
  // A link added around words that were already there changes no text, so the
  // text diff above cannot see it; the word diff of the source shows it green.
  // Mark such a link as added too (owner, 2026-10-31: "no green on first, but
  // is on second"). A link is new when main has no link with the same target
  // and the same words.
  const key = (a: Element) => (a.getAttribute("href") || "") + "\u0001" + (a.textContent || "").trim();
  const had = new Set(baseHtml === null ? [] : Array.from(clean(doc, baseHtml).querySelectorAll("a[href]")).map(key));
  head.querySelectorAll("a[href]").forEach((a) => {
    if (had.has(key(a)) || !(a.textContent || "").trim()) return;
    if (a.querySelector("ins") && (a.textContent || "") === Array.from(a.querySelectorAll("ins")).map((e) => e.textContent).join("")) return;
    const e = doc.createElement("ins");
    e.className = "diff-link-added";
    e.title = "link added";
    while (a.firstChild) e.appendChild(a.firstChild);
    a.appendChild(e);
  });
  while (head.firstChild) box.appendChild(head.firstChild);
  return box;
}

/**
 * Where each side's changes sit in its rendered text, for side by side.
 *
 * Each run is one changed stretch (`del` on main, `ins` on the preview) with
 * up to 40 characters of the text just before it on the same side. The
 * context is what finds the right "core" when the word also occurs earlier in
 * the block.
 */
export function changeRuns(ops: Array<{ op: string; text: string }>): {
  base: Array<{ before: string; text: string }>;
  head: Array<{ before: string; text: string }>;
} {
  const out = { base: [] as Array<{ before: string; text: string }>, head: [] as Array<{ before: string; text: string }> };
  let base = "";
  let head = "";
  for (const o of ops) {
    if (o.op === "same") { base += o.text; head += o.text; }
    else if (o.op === "del") { if (o.text.trim()) out.base.push({ before: base.slice(-40), text: o.text }); base += o.text; }
    else if (o.op === "ins") { if (o.text.trim()) out.head.push({ before: head.slice(-40), text: o.text }); head += o.text; }
  }
  return out;
}

/**
 * Inside one side's frame: hide the staging banner (the pane's own header
 * says which side it is), mark each changed run, and scroll the frame so the
 * first mark sits a third of the way down. Returns how many runs it marked.
 *
 * Text is matched on letters and digits only, lower-cased, so whitespace,
 * punctuation and table cell borders cannot make a rendered page and the
 * diff's text disagree. A run is looked for with its context first, then on
 * its own, and always after the previous run, inside the block's own element
 * when the page has it. A frame from another origin cannot be read: it stays
 * at the block's anchor, as before, and this returns 0.
 */
export function markInFrame(
  f: HTMLIFrameElement,
  runs: Array<{ before: string; text: string }>,
  cls: string,
): number {
  let d: Document | null = null;
  try { d = f.contentDocument; } catch { return 0; }
  if (!d || !d.body) return 0;
  const w = d.defaultView!;
  if (!d.getElementById("fa-review-frame-style")) {
    const st = d.createElement("style");
    st.id = "fa-review-frame-style";
    st.textContent =
      "[data-fa-staging-banner]{display:none!important}html{padding-top:0!important}" +
      ".side-bar,.fa-nav{top:0!important}" +
      "mark.fa-change-base{background:#fbdada;color:#5c0b0b;outline:2px solid #c0392b}" +
      "mark.fa-change-head{background:#d7f5dc;color:#0b3d17;outline:2px solid #2e7d32}";
    (d.head || d.body).appendChild(st);
  }
  const scrollTo = (m: Element) => {
    // On the frame's own window: scrollIntoView would scroll the review page too.
    const r = m.getBoundingClientRect();
    w.scrollTo(0, Math.max(0, r.top + w.scrollY - w.innerHeight / 3));
  };
  const had = d.querySelectorAll("mark." + cls);
  if (had.length) { scrollTo(had[0]!); return had.length; }
  if (!runs.length) return 0;
  const ok = /[\p{L}\p{N}]/u;
  const norm = (t: string) => Array.from(t).filter((c) => ok.test(c)).map((c) => c.toLowerCase()[0]).join("");
  let id = "";
  try { id = decodeURIComponent((w.location.hash || "").slice(1)); } catch { /* no anchor, then */ }
  const block = id ? d.getElementById(id) : null;
  const tryIn = (root: Element): Array<[Text, number, number]> => {
    const chars: string[] = [];
    const where: Array<[Text, number]> = [];
    const walker = d!.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const p = n.parentElement;
      if (!p || p.closest("script,style,noscript,[data-fa-staging-banner]")) continue;
      for (let i = 0; i < n.data.length; i++) {
        const c = n.data[i]!;
        if (ok.test(c)) { chars.push(c.toLowerCase()[0]!); where.push([n, i]); }
      }
    }
    const s = chars.join("");
    const segs: Array<[Text, number, number]> = [];
    let from = 0;
    for (const r of runs) {
      const t = norm(r.text);
      if (!t) continue;
      const ctx = norm(r.before);
      let at = ctx ? s.indexOf(ctx + t, from) : -1;
      if (at >= 0) at += ctx.length;
      else at = s.indexOf(t, from);
      if (at < 0) continue;
      from = at + t.length;
      // One segment per text node the run spans.
      for (let k = at; k < at + t.length; ) {
        const node = where[k]![0];
        const s0 = where[k]![1];
        let e = s0;
        while (k < at + t.length && where[k]![0] === node) { e = where[k]![1]; k++; }
        segs.push([node, s0, e + 1]);
      }
    }
    return segs;
  };
  let segs = block ? tryIn(block) : [];
  if (!segs.length) segs = tryIn(d.body);
  if (!segs.length) return 0;
  // Later offsets first within a node, so splitting keeps earlier ones valid.
  const marks: HTMLElement[] = [];
  segs.slice().reverse().forEach(([node, s0, e]) => {
    node.splitText(e);
    const mid = node.splitText(s0);
    const m = d!.createElement("mark");
    m.className = cls;
    mid.replaceWith(m);
    m.appendChild(mid);
    marks.unshift(m);
  });
  scrollTo(marks[0]!);
  return marks.length;
}

/**
 * The two published pages next to each other, each scrolled to the block,
 * and to its first change when the diff found one.
 *
 * Each pane has its own header: grey for the before side, green for this
 * preview with its branch, commit, PR and build log, so the green staging
 * banner inside the frame is hidden rather than repeated.
 */
/** What the side-by-side panes hide in each framed page: the staging banner and the left rails. */
export const FRAME_CHROME_CSS =
  "[data-fa-staging-banner]{display:none!important}:root{--fa-staging-offset:0px!important}html{padding-top:0!important}" +
  "nav.fa-nav,.fa-nav,.side-bar{display:none!important}body{padding-inline-start:0!important}.main{margin-left:0!important;max-width:none!important}";

export function renderSideBySide(
  doc: Document,
  before: string | null,
  after: string | null,
  opts?: {
    beforeName?: string;
    facts?: { branch?: string; sha?: string; pr?: string; prUrl?: string; branchUrl?: string; runUrl?: string; baseSha?: string } | null;
    runs?: { base: Array<{ before: string; text: string }>; head: Array<{ before: string; text: string }> } | null;
    mark?: ((f: HTMLIFrameElement, runs: Array<{ before: string; text: string }>, cls: string) => number) | null;
  },
): HTMLElement {
  const o = opts || {};
  const box = doc.createElement("div");
  box.className = "diff diff-sbs";
  const link = (text: string, href: string | undefined) => {
    if (!href || !/^https?:/i.test(href)) { const c = doc.createElement("code"); c.textContent = text; return c; }
    const a = doc.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    return a;
  };
  const header = (side: "base" | "head") => {
    const h = doc.createElement("div");
    h.className = "sbs-head sbs-side-" + side;
    const b = doc.createElement("b");
    b.textContent = side === "base" ? (o.beforeName && o.beforeName !== "main" ? o.beforeName : "Main") : "This preview";
    h.appendChild(b);
    const f = o.facts;
    if (side === "head" && f) {
      const add = (label: string, node: Node) => {
        h.appendChild(doc.createTextNode(" \u00b7 " + label));
        h.appendChild(node);
      };
      if (f.branch) add("", link(f.branch, f.branchUrl));
      if (f.sha) {
        const m = (f.branchUrl || "").match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\//);
        add("commit ", link(f.sha, m ? m[1] + "/commit/" + f.sha : undefined));
      }
      if (f.pr && f.pr !== "n/a") add("", link("PR #" + f.pr, f.prUrl));
      if (f.runUrl) add("", link("build log", f.runUrl));
    } else if (side === "base") {
      h.appendChild(doc.createTextNode(" \u00b7 published site"));
      // Main's commit, beside the preview's, as the staging bar would give it
      // (owner, 2026-10-31: "current sha of main and of feature branch").
      const sha = f && /^[0-9a-f]{7,40}$/i.test(f.baseSha || "") ? f.baseSha!.slice(0, 7) : "";
      const m = ((f && f.branchUrl) || "").match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\//);
      if (sha) { h.appendChild(doc.createTextNode(" \u00b7 commit ")); h.appendChild(link(sha, m ? m[1] + "/commit/" + f!.baseSha : undefined)); }
    }
    // One line; the whole of it on hover.
    h.title = h.textContent || "";
    return h;
  };
  const pane = (side: "base" | "head", href: string | null) => {
    const col = doc.createElement("div");
    col.className = "sbs-pane";
    col.appendChild(header(side));
    if (href === null) {
      const p = doc.createElement("p");
      p.className = "muted";
      p.textContent = side === "base" ? "Not on " + (o.beforeName || "main") + ": this block is new." : "Not on this preview: this block was removed.";
      col.appendChild(p);
    } else {
      const f = doc.createElement("iframe");
      f.src = href;
      f.title = (side === "base" ? o.beforeName || "Main" : "This preview") + ": " + href;
      f.loading = "lazy";
      // The heading above already says which page and which build (owner,
      // 2026-10-31): in both panes the framed page's green banner and its left
      // navigation rail are hidden, and the space they held is given back, so
      // the two pages sit level with nothing but the text. Same origin, so the
      // frame is ours to style.
      f.addEventListener("load", () => {
        try {
          const d = f.contentDocument;
          if (!d || !d.head) return;
          const st = d.createElement("style");
          st.textContent = FRAME_CHROME_CSS;
          d.head.appendChild(st);
        } catch { /* another origin: the page stays as it is */ }
      });
      const mark = o.mark;
      if (mark) {
        const runs = (o.runs && o.runs[side]) || [];
        const cls = "fa-change-" + side;
        // Pages finish laying out (the rail, figures) after load, and their
        // own anchor scroll runs then too: try again a little later.
        f.addEventListener("load", () => {
          let tries = 0;
          const go = () => { if (mark(f, runs, cls) === 0 && runs.length && ++tries < 4) setTimeout(go, 400 * tries); };
          go();
          setTimeout(() => mark(f, runs, cls), 1200);
        });
      }
      col.appendChild(f);
    }
    return col;
  };
  box.appendChild(pane("base", before));
  box.appendChild(pane("head", after));
  return box;
}

/**
 * The visual diff (bean `0rxe`): pictures of the block on each side, from the
 * `folio-block-screenshots` Tool. Four views, each ONE click on a native
 * radio button (arrow keys move between them): the changed pixels marked,
 * before, after, or both side by side. There is no slider, because a slider
 * is a drag, and the owner's rule is one key or one click.
 *
 * The share of changed pixels is stated in WORDS, so the marker colour is
 * never the only signal. A side that could not be pictured says why.
 * Self-contained: the page embeds it with `toString()`.
 */
export function renderVisual(
  doc: Document,
  v: {
    label: string;
    before: { png: string | null; missing?: string } | null;
    after: { png: string | null; missing?: string } | null;
    changed: number | null;
    diff: string | null;
  } | null,
  prefix: string,
  group: string,
): HTMLElement {
  const box = doc.createElement("div");
  box.className = "diff diff-visual";
  const note = (t: string) => {
    const p = doc.createElement("p");
    p.className = "muted";
    p.textContent = t;
    return p;
  };
  if (!v) {
    box.appendChild(note("No pictures of this block on this build."));
    return box;
  }
  const why = (s: { png: string | null; missing?: string } | null, side: string) =>
    s === null ? (side === "before" ? "Not on main: this block is new." : "Not on this preview: this block was removed.")
      : s.missing === "page" ? "Its page is not in the " + (side === "before" ? "published site" : "preview") + "."
      : s.missing === "anchor" ? "Its anchor is not on the " + (side === "before" ? "published" : "preview") + " page."
      : null;
  const pic = (src: string | null, alt: string, fallback: string | null) => {
    if (!src) return note(fallback || "No picture.");
    const i = doc.createElement("img");
    i.src = prefix + src;
    i.alt = alt;
    i.loading = "lazy";
    return i;
  };
  const summary = doc.createElement("p");
  summary.className = "kind";
  summary.textContent = v.changed === null
    ? "Only one side could be pictured, so nothing is compared."
    : v.changed === 0 ? "No pixel changed beyond anti-aliasing: the change is not visible."
    : (v.changed * 100).toFixed(1) + "% of the block's pixels changed.";
  box.appendChild(summary);
  const views: Array<[string, string, () => HTMLElement]> = [];
  if (v.diff) views.push(["diff", "Changed pixels", () => pic(v.diff, v.label + ": changed pixels marked", null)]);
  views.push(["before", "Before", () => pic(v.before && v.before.png, v.label + " on main", why(v.before, "before"))]);
  views.push(["after", "After", () => pic(v.after && v.after.png, v.label + " on this preview", why(v.after, "after"))]);
  views.push(["both", "Both", () => {
    const row = doc.createElement("div");
    row.className = "diff-sbs";
    row.appendChild(pic(v.before && v.before.png, v.label + " on main", why(v.before, "before")));
    row.appendChild(pic(v.after && v.after.png, v.label + " on this preview", why(v.after, "after")));
    return row;
  }]);
  const fs = doc.createElement("fieldset");
  fs.className = "visual-modes";
  const lg = doc.createElement("legend");
  lg.textContent = "Show";
  fs.appendChild(lg);
  const stage = doc.createElement("div");
  // Open on something to SEE: the marked diff when there is one, else the
  // side that was pictured (found by the ojcx run: a new block opened on
  // "Before", which can only say it is missing).
  const has = (s: { png: string | null } | null) => !!(s && s.png);
  const first = views.findIndex(([id]) => id === "diff" || (id === "after" && has(v.after)) || (id === "before" && has(v.before)));
  const start = first < 0 ? 0 : first;
  const show = (i: number) => {
    while (stage.firstChild) stage.removeChild(stage.firstChild);
    stage.appendChild(views[i]![2]());
  };
  views.forEach(([id, label], i) => {
    const l = doc.createElement("label");
    const r = doc.createElement("input");
    r.type = "radio";
    r.name = group;
    r.value = id;
    r.checked = i === start;
    r.addEventListener("change", () => show(i));
    l.appendChild(r);
    l.appendChild(doc.createTextNode(" " + label));
    fs.appendChild(l);
  });
  box.appendChild(fs);
  box.appendChild(stage);
  show(start);
  return box;
}

/**
 * The field diff (bean f327): a structured block's manifest fields on each
 * side (`changeset-structure.json`), one row per field. A changed, added or
 * removed field is named in WORDS in its own column, so no colour carries
 * meaning alone; the unchanged fields are folded under a count. Self-contained:
 * the page embeds it with `toString()`.
 */
export function renderFields(
  doc: Document,
  s: { kind: string; base?: Record<string, string>; head?: Record<string, string> },
): HTMLElement {
  const base = s.base || {};
  const head = s.head || {};
  const keys = Object.keys(base).concat(Object.keys(head).filter((k) => !(k in base))).sort();
  const box = doc.createElement("div");
  box.className = "diff diff-fields";
  const table = (rows: string[][], caption: string) => {
    const t = doc.createElement("table");
    const cap = doc.createElement("caption");
    cap.textContent = caption;
    t.appendChild(cap);
    const tr0 = doc.createElement("tr");
    ["field", "main", "this preview", "change"].forEach((h) => {
      const th = doc.createElement("th");
      th.scope = "col";
      th.textContent = h;
      tr0.appendChild(th);
    });
    t.appendChild(tr0);
    rows.forEach((r) => {
      const tr = doc.createElement("tr");
      tr.className = "f-" + r[3];
      r.forEach((c, i) => {
        const td = doc.createElement(i === 0 ? "th" : "td");
        if (i === 0) (td as HTMLTableCellElement).scope = "row";
        if (i === 0) {
          const code = doc.createElement("code");
          code.textContent = c;
          td.appendChild(code);
        } else td.textContent = c;
        tr.appendChild(td);
      });
      t.appendChild(tr);
    });
    return t;
  };
  const changed: string[][] = [];
  const same: string[][] = [];
  keys.forEach((k) => {
    const b = k in base ? base[k]! : null;
    const h = k in head ? head[k]! : null;
    if (b === h) same.push([k, b ?? "", h ?? "", "unchanged"]);
    else changed.push([k, b ?? "—", h ?? "—", b === null ? "added" : h === null ? "removed" : "changed"]);
  });
  const sideless = !s.base ? "This block is new: every field is added." : !s.head ? "This block was removed: every field is removed." : null;
  if (sideless) {
    const p = doc.createElement("p");
    p.className = "muted";
    p.textContent = sideless;
    box.appendChild(p);
  }
  if (changed.length) box.appendChild(table(changed, changed.length + " field" + (changed.length === 1 ? "" : "s") + " differ (" + s.kind + ")"));
  else {
    const p = doc.createElement("p");
    p.className = "muted";
    p.textContent = "No field differs: the change is to the manifest's form, not its values.";
    box.appendChild(p);
  }
  if (same.length) {
    const d = doc.createElement("details");
    const sum = doc.createElement("summary");
    sum.textContent = same.length + " unchanged field" + (same.length === 1 ? "" : "s");
    d.appendChild(sum);
    d.appendChild(table(same, "Unchanged fields"));
    box.appendChild(d);
  }
  return box;
}
