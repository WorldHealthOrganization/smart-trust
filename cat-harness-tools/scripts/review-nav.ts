/**
 * The review page's navigation: an outline, a breadcrumb, and a minimap.
 *
 * - **Outline on the review page only.** It lists a DOCUMENT folio's chapters
 *   and sections in manifest order, from `outline.json`, which the folio's
 *   own site build writes. Normal pages have no table of contents.
 * - **One key or one click; never a drag or a hover**, for users with very
 *   limited hand function.
 *
 * ## The minimap is ONE tab stop
 *
 * A long document has thousands of blocks, and a tab stop per cell would trap
 * a keyboard or switch user. So the minimap is a roving-tabindex list:
 * - one cell is reachable with Tab;
 * - Up/Down (and Left/Right) move between cells in reading order, and Home
 *   and End go to either end;
 * - Enter or Space (the cell is a native button) jumps to the block.
 * Every cell is labelled in words ("prose:dose: changed, 2 open comments, QA
 * failing"), and its visible glyphs repeat that, so colour is never the only
 * signal.
 *
 * Every function here is self-contained, and `gen-review-page` embeds each
 * one with `toString()`.
 */

export interface NavOutline {
  documents: Array<{
    slug: string;
    title: string;
    page: string;
    chapters: Array<{ title: string; sections: Array<{ key: string; title: string; blocks: string[] }> }>;
  }>;
}

/** Where a section sits: `document › chapter › section`, or null when the outline does not know it. */
export function crumbFor(outline: NavOutline | null, sectionKey: string): string | null {
  if (!outline) return null;
  for (const d of outline.documents)
    for (const ch of d.chapters)
      for (const s of ch.sections) if (s.key === sectionKey) return d.title + " › " + ch.title + " › " + s.title;
  return null;
}

/** Per-section badges, in words. */
export interface SectionBadges {
  changed: number;
  open: number;
  qaFailing: number;
}

/**
 * The outline as a `<nav>` of nested lists. A section with something to
 * review is a button that moves focus to it in the list below; any other
 * section is a link to it on the preview. `root` is the site root as seen
 * from the review page (`reviewSiteRoot`); a document's `page` is relative to it.
 */
export function renderOutline(
  doc: Document,
  outline: NavOutline,
  badges: (key: string) => SectionBadges | null,
  jump: (key: string) => void,
  root = "../",
): HTMLElement {
  const nav = doc.createElement("nav");
  nav.setAttribute("aria-label", "Outline");
  nav.className = "outline";
  const h = doc.createElement("h2");
  h.textContent = "Outline";
  nav.appendChild(h);
  for (const d of outline.documents) {
    const dt = doc.createElement("div");
    dt.className = "ol-doc";
    dt.textContent = d.title;
    nav.appendChild(dt);
    const chs = doc.createElement("ol");
    for (const ch of d.chapters) {
      const cli = doc.createElement("li");
      const ct = doc.createElement("div");
      ct.className = "ol-ch";
      ct.textContent = ch.title;
      cli.appendChild(ct);
      const secs = doc.createElement("ol");
      for (const s of ch.sections) {
        const sli = doc.createElement("li");
        const b = badges(s.key);
        const words: string[] = [];
        if (b && b.changed) words.push(b.changed + " changed");
        if (b && b.open) words.push(b.open + " comment" + (b.open > 1 ? "s" : ""));
        if (b && b.qaFailing) words.push("QA failing");
        let target: HTMLElement;
        if (words.length) {
          const btn = doc.createElement("button");
          btn.type = "button";
          btn.className = "linklike";
          btn.addEventListener("click", () => jump(s.key));
          target = btn;
        } else {
          const a = doc.createElement("a");
          a.href = root + d.page;
          target = a;
        }
        target.textContent = s.title;
        sli.appendChild(target);
        if (words.length) {
          const w = doc.createElement("span");
          w.className = "badges";
          w.textContent = " " + words.join(", ");
          sli.appendChild(w);
        }
        secs.appendChild(sli);
      }
      cli.appendChild(secs);
      chs.appendChild(cli);
    }
    nav.appendChild(chs);
  }
  return nav;
}

/**
 * The outline as a section of the harness RAIL, not a column of the page
 * (owner, 2026-10-07: *"i wanted the TOC in the LHS navbar, not LHS of
 * displayed content"*). The same rows as {@link renderOutline}, in the rail's
 * own markup — an open `details.fa-nav-group` whose rows are `.fa-nav-sub`
 * links — so the rail's stylesheet draws it and its open/close is the rail's.
 *
 * A chapter is a label row (`fa-nav-dead fa-nav-kind`), not a link: the rail
 * gives one level of rows under a section, and a chapter is where its sections
 * are, not a place to go. A section with something to review jumps to it in
 * the list; any other links to its anchor on the document page, which the
 * section key carries after `::` when it is a label (`sec:1-1`). `root` is
 * as for {@link renderOutline}.
 */
export function railOutline(
  doc: Document,
  outline: NavOutline,
  badges: (key: string) => SectionBadges | null,
  jump: (key: string) => void,
  root = "../",
): HTMLElement {
  const group = doc.createElement("details");
  group.className = "fa-nav-group";
  group.open = true;
  const sum = doc.createElement("summary");
  const glyph = doc.createElement("span");
  glyph.className = "fa-nav-glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = "\u00a7";
  const lab = doc.createElement("span");
  lab.className = "fa-nav-label";
  lab.textContent = "Outline";
  sum.appendChild(glyph);
  sum.appendChild(lab);
  group.appendChild(sum);
  const sub = doc.createElement("div");
  sub.className = "fa-nav-sub";
  const label = (text: string) => {
    const l = doc.createElement("span");
    l.className = "fa-nav-label";
    l.textContent = text;
    return l;
  };
  for (const d of outline.documents) {
    for (const ch of d.chapters) {
      const row = doc.createElement("span");
      row.className = "fa-nav-dead fa-nav-kind";
      row.appendChild(label(outline.documents.length > 1 ? d.title + " \u203a " + ch.title : ch.title));
      sub.appendChild(row);
      for (const s of ch.sections) {
        const b = badges(s.key);
        const words: string[] = [];
        if (b && b.changed) words.push(b.changed + " changed");
        if (b && b.open) words.push(b.open + " comment" + (b.open > 1 ? "s" : ""));
        if (b && b.qaFailing) words.push("QA failing");
        const a = doc.createElement("a");
        const anchor = s.key.indexOf("::") >= 0 ? s.key.slice(s.key.indexOf("::") + 2) : "";
        a.href = root + d.page + (anchor.indexOf(":") > 0 ? "#" + encodeURIComponent(anchor) : "");
        a.appendChild(label(s.title));
        if (words.length) {
          const q = doc.createElement("span");
          q.className = "fa-nav-qualifier";
          q.textContent = " \u00b7 " + words.join(", ");
          a.lastChild!.appendChild(q);
          a.addEventListener("click", (ev) => {
            ev.preventDefault();
            jump(s.key);
          });
        }
        sub.appendChild(a);
      }
    }
  }
  group.appendChild(sub);
  return group;
}

/** What the minimap knows about one block. */
export interface BlockMark {
  change: "added" | "changed" | null;
  open: number;
  qaFailing: boolean;
}

/**
 * The whole document as small wrapping squares, in outline order. Darker means
 * more reasons to look (a change, open comments, a QA failure); glyphs and
 * the label say which.
 */
export function renderMinimap(
  doc: Document,
  outline: NavOutline,
  mark: (label: string) => BlockMark,
  jumpBlock: (label: string, page: string) => void,
): HTMLElement {
  const box = doc.createElement("div");
  box.className = "minimap";
  const h = doc.createElement("h2");
  h.id = "minimap-h";
  h.textContent = "Minimap";
  box.appendChild(h);
  const help = doc.createElement("p");
  help.className = "muted";
  help.textContent = "One square per block, one row of squares per chapter, in reading order. Arrow keys move, Enter jumps. Filled squares need a look: Δ changed, + added, ● open comments, ! QA failing.";
  box.appendChild(help);
  // One labelled row per chapter, so a reader sees WHICH chapter a change is
  // in, not only that there is one (owner, 2026-10-30, option A). The cells
  // stay one roving list across chapters: one tab stop for the whole map.
  const cells: HTMLButtonElement[] = [];
  const many = outline.documents.length > 1;
  let n = 0;
  for (const d of outline.documents)
    for (const ch of d.chapters) {
      const id = "minimap-ch-" + n++;
      const cap = doc.createElement("p");
      cap.className = "mm-ch";
      cap.id = id;
      cap.textContent = many ? d.title + " \u203A " + ch.title : ch.title;
      const ol = doc.createElement("ol");
      ol.setAttribute("aria-labelledby", id);
      let flagged = 0;
      for (const s of ch.sections)
        for (const label of s.blocks) {
          const m = mark(label);
          const reasons = (m.change ? 1 : 0) + (m.open ? 1 : 0) + (m.qaFailing ? 1 : 0);
          if (reasons) flagged++;
          const li = doc.createElement("li");
          const b = doc.createElement("button");
          b.type = "button";
          b.className = "cell h" + reasons;
          b.tabIndex = -1;
          const glyphs = (m.change === "added" ? "+" : m.change ? "Δ" : "") + (m.open ? "●" : "") + (m.qaFailing ? "!" : "");
          b.textContent = glyphs;
          const words = [m.change === "added" ? "added" : m.change ? "changed" : "unchanged"];
          if (m.open) words.push(m.open + " open comment" + (m.open > 1 ? "s" : ""));
          if (m.qaFailing) words.push("QA failing");
          b.setAttribute("aria-label", label + ": " + words.join(", "));
          b.title = label + ": " + words.join(", ") + " (" + s.title + ")";
          b.addEventListener("click", () => jumpBlock(label, d.page));
          li.appendChild(b);
          ol.appendChild(li);
          cells.push(b);
        }
      if (!ol.childNodes.length) continue;
      if (flagged) {
        const q = doc.createElement("span");
        q.className = "mm-count";
        q.textContent = " \u00B7 " + flagged + " to look at";
        cap.appendChild(q);
      }
      box.appendChild(cap);
      box.appendChild(ol);
    }
  // One tab stop: the first cell with something to look at, else the first.
  const first = cells.find((c) => !/\bh0\b/.test(c.className)) || cells[0];
  if (first) first.tabIndex = 0;
  box.addEventListener("keydown", (e) => {
    const i = cells.indexOf(e.target as HTMLButtonElement);
    if (i < 0) return;
    let j = -1;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") j = Math.min(cells.length - 1, i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") j = Math.max(0, i - 1);
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = cells.length - 1;
    if (j < 0) return;
    e.preventDefault();
    e.stopPropagation();
    cells[i]!.tabIndex = -1;
    cells[j]!.tabIndex = 0;
    cells[j]!.focus();
  });
  return box;
}
