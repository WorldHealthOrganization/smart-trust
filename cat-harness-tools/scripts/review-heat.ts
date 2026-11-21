/**
 * The review heat map's numbers: one row per section, one column per metric.
 *
 * ## What each column MEANS, and what it must not be read as
 *
 * | column | counts | is NOT |
 * |---|---|---|
 * | changed | blocks in the section the ChangeSet lists | how much text changed; a one-word edit counts 1 |
 * | open | review comments not yet closed (`open` or `addressed`); defects counted apart | how bad the section is; one comment may cover a whole section |
 * | stale | open comments whose block changed AFTER the comment was made | wrong; it means "re-read before replying" |
 * | coverage | changed (added or changed) blocks with a reviewer VERDICT on their CURRENT hash, of those needing one | "every comment resolved": resolved comments are not a verdict. A verdict on an older version does not count |
 * | qa | the section's blocks whose latest QA verdicts FAIL, and those whose verdicts are STALE (older than the block), from `block-qa.json` | a pass when it is empty of failures: stale and unaudited blocks are counted and said, never read as passing. Nor is "passing" a full pass: a block whose agent-judged criteria have no verdict is said to pass on SCRIPTS ONLY, with the number of criteria that need an agent |
 *
 * A column with no data is SAID, per row, never shown as 0 or blank, which
 * would read as "measured, and nothing there".
 *
 * ## One self-contained function
 *
 * `gen-review-page` embeds {@link computeHeat} with `toString()`, as it does
 * the diff renderers, so the function tested here is the one the page runs.
 */
export interface HeatRow {
  /** `{manifest dir}::{section label}`, or `(listed in no section)`. */
  section: string;
  changed: number;
  open: number;
  defects: number;
  stale: number;
  /** Blocks whose fresh QA verdicts fail; the worst severity among them. */
  qaFailing: number;
  qaWorst: string | null;
  /** Blocks whose QA verdicts are older than the block, and blocks never audited. */
  qaStale: number;
  qaUnaudited: number;
  /** Passing blocks whose agent-judged criteria have no verdict (9791). */
  qaScriptsOnly: number;
  /** Criteria, summed over those blocks, that need an agent. */
  qaNeedsAgent: number;
  /** Passing blocks from a block-qa.json too old to say what was judged. */
  qaJudgedUnknown: number;
  /** Blocks in the section the QA summary covers. */
  qaBlocks: number;
  /** Added or changed blocks, which each need a verdict; and those that have one on their current hash. */
  needReview: number;
  reviewed: number;
}

export interface HeatInput {
  changes: Array<{ label: string; change?: string; head?: { section?: string }; base?: { section?: string } }>;
  /** `review-comments.json`'s comments, or null when there is no such file. */
  comments: Array<{ targetLabel: string; status: string; review: { kind: string; blockHash: string | null; orphaned?: boolean } }> | null;
  /** `blocks.json`: each head block's current hash and section, or null. */
  blocks: Record<string, { hash: string; section?: string }> | null;
  /** `block-qa.json`'s `blocks`, or null when the build published none. */
  qa?: Record<string, { state: string; worst: string | null; needsAgent?: number }> | null;
  /** `review-comments.json`'s `verdicts`, or null when there is no such file. */
  verdicts?: Array<{ targetLabel: string; blockHash: string }> | null;
}

export function computeHeat(input: HeatInput): { rows: HeatRow[]; hasComments: boolean; hasBlocks: boolean; hasQa: boolean; hasVerdicts: boolean } {
  const NONE = "(listed in no section)";
  const rows = new Map<string, HeatRow>();
  const row = (s: string | undefined) => {
    const k = s || NONE;
    let r = rows.get(k);
    if (!r) {
      r = { section: k, changed: 0, open: 0, defects: 0, stale: 0, qaFailing: 0, qaWorst: null, qaStale: 0, qaUnaudited: 0, qaScriptsOnly: 0, qaNeedsAgent: 0, qaJudgedUnknown: 0, qaBlocks: 0, needReview: 0, reviewed: 0 };
      rows.set(k, r);
    }
    return r;
  };
  // Coverage needs both the verdicts and each block's current hash: a
  // verdict counts only on the version it was given on.
  const hasVerdicts = !!input.verdicts && input.blocks !== null;
  const current: Record<string, boolean> = {};
  if (hasVerdicts) {
    for (const v of input.verdicts!) {
      const b = input.blocks![v.targetLabel];
      if (b && b.hash === v.blockHash) current[v.targetLabel] = true;
    }
  }
  const sectionOf = new Map<string, string | undefined>();
  for (const c of input.changes) {
    const s = (c.head || c.base || {}).section;
    sectionOf.set(c.label, s);
    const r = row(s);
    r.changed++;
    if (c.change === "added" || c.change === "changed") {
      r.needReview++;
      if (current[c.label]) r.reviewed++;
    }
  }
  for (const c of input.comments || []) {
    if (c.status !== "open" && c.status !== "addressed") continue;
    // Orphaned comments have no block and so no section: counted under NONE,
    // never dropped, since an open comment is still open.
    const b = input.blocks ? input.blocks[c.targetLabel] : undefined;
    const s = c.review.orphaned ? undefined : (b && b.section) || sectionOf.get(c.targetLabel);
    const r = row(s);
    r.open++;
    if (c.review.kind === "defect") r.defects++;
    if (b && c.review.blockHash !== null && b.hash !== c.review.blockHash) r.stale++;
  }
  // QA needs a section per block, which only blocks.json gives. A section
  // gets a row for QA alone only when something there FAILS or is STALE; a
  // clean section with no change and no comment is not a place to look first.
  const qa = input.blocks && input.qa ? input.qa : null;
  if (qa && input.blocks) {
    const RANK: Record<string, number> = { critical: 0, major: 1, minor: 2 };
    for (const [label, q] of Object.entries(qa)) {
      const s = (input.blocks[label] || {}).section;
      const k = s || NONE;
      const attention = q.state === "failing" || q.state === "stale";
      if (!rows.has(k) && !attention) continue;
      const r = row(s);
      r.qaBlocks++;
      if (q.state === "failing") {
        r.qaFailing++;
        if (q.worst && (r.qaWorst === null || RANK[q.worst]! < RANK[r.qaWorst]!)) r.qaWorst = q.worst;
      } else if (q.state === "stale") r.qaStale++;
      else if (q.state === "unaudited") r.qaUnaudited++;
      else if (q.state === "passing") {
        // A file published before 9791 has no field: "could not tell", never "all judged".
        if (typeof q.needsAgent !== "number") r.qaJudgedUnknown++;
        else if (q.needsAgent > 0) { r.qaScriptsOnly++; r.qaNeedsAgent += q.needsAgent; }
      }
    }
  }
  // Reading order: sections as the ChangeSet meets them, then any others by name, NONE last.
  const order = [...new Set(input.changes.map((c) => (c.head || c.base || {}).section || NONE))];
  const rest = [...rows.keys()].filter((k) => !order.includes(k)).sort();
  const all = [...order, ...rest].filter((k) => k !== NONE);
  if (rows.has(NONE)) all.push(NONE);
  return { rows: all.map((k) => rows.get(k)!), hasComments: input.comments !== null, hasBlocks: input.blocks !== null, hasQa: qa !== null, hasVerdicts };
}

/** 0 → no fill; otherwise the tertile of the column's maximum, 1–3. */
export function heatBucket(v: number, max: number): number {
  if (!v || !max) return 0;
  const f = v / max;
  return f <= 1 / 3 ? 1 : f <= 2 / 3 ? 2 : 3;
}

/**
 * The heat map as a real `<table>`, so the matrix IS its own table view: a
 * screen reader reads rows and columns, and every cell carries its number.
 * The tint only repeats what the number already says (dataviz: never colour
 * alone). Each row header is a button that moves focus to that section in
 * the list below.
 */
export function renderHeat(
  doc: Document,
  h: {
    rows: Array<{ section: string; changed: number; open: number; defects: number; stale: number; qaFailing: number; qaWorst: string | null; qaStale: number; qaUnaudited: number; qaScriptsOnly: number; qaNeedsAgent: number; qaJudgedUnknown: number; qaBlocks: number; needReview: number; reviewed: number }>;
    hasComments: boolean;
    hasBlocks: boolean;
    hasQa: boolean;
    hasVerdicts: boolean;
  },
  bucket: (v: number, max: number) => number,
  jump: (section: string) => void,
): HTMLElement {
  const t = doc.createElement("table");
  t.className = "heat";
  const cap = doc.createElement("caption");
  cap.textContent = "Where to look first: each section's changes and open review comments. Darker means more, and every cell shows its number.";
  t.appendChild(cap);
  const cols: Array<[string, string]> = [
    ["Section", ""],
    ["Changed blocks", "blocks the ChangeSet lists"],
    ["Open comments", "open or addressed; defects in brackets"],
    ["Stale comments", "the block changed after the comment was made: re-read before replying"],
    ["Review coverage", "changed blocks with a reviewer verdict on their current version; resolved comments do not count"],
    ["QA", "blocks whose latest QA verdicts fail; stale and unaudited blocks are counted, never read as passing, and a block whose agent-judged criteria have no verdict passes on scripts only"],
  ];
  const head = doc.createElement("thead");
  const hr = doc.createElement("tr");
  for (const [name, note] of cols) {
    const th = doc.createElement("th");
    th.scope = "col";
    th.textContent = name;
    if (note) th.title = note;
    hr.appendChild(th);
  }
  head.appendChild(hr);
  t.appendChild(head);
  const max = (k: "changed" | "open" | "stale" | "qaFailing") => Math.max(0, ...h.rows.map((r) => r[k]));
  const mx = { changed: max("changed"), open: max("open"), stale: max("stale"), qa: max("qaFailing"), unreviewed: Math.max(0, ...h.rows.map((r) => r.needReview - r.reviewed)) };
  const body = doc.createElement("tbody");
  const cell = (text: string, b: number, title: string, muted = false) => {
    const td = doc.createElement("td");
    td.textContent = text;
    td.title = title;
    td.className = (b ? "h" + b : "h0") + (muted ? " muted" : "");
    return td;
  };
  for (const r of h.rows) {
    const tr = doc.createElement("tr");
    const th = doc.createElement("th");
    th.scope = "row";
    const btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "linklike";
    btn.textContent = r.section.replace("::", " › ");
    btn.addEventListener("click", () => jump(r.section));
    th.appendChild(btn);
    tr.appendChild(th);
    tr.appendChild(cell(String(r.changed), bucket(r.changed, mx.changed), r.changed + " changed block(s) in " + r.section));
    if (h.hasComments) {
      tr.appendChild(cell(r.open + (r.defects ? " (" + r.defects + " defect" + (r.defects > 1 ? "s" : "") + ")" : ""), bucket(r.open, mx.open), r.open + " open comment(s), " + r.defects + " defect(s)"));
    } else {
      tr.appendChild(cell("no data", 0, "No review-comments.json on this build", true));
    }
    if (h.hasComments && h.hasBlocks) {
      tr.appendChild(cell(String(r.stale), bucket(r.stale, mx.stale), r.stale + " open comment(s) on a block that changed since"));
    } else {
      tr.appendChild(cell("no data", 0, "Needs review-comments.json and blocks.json", true));
    }
    if (!h.hasVerdicts) {
      tr.appendChild(cell("no data", 0, "Needs review-comments.json (with its verdicts) and blocks.json", true));
    } else if (!r.needReview) {
      tr.appendChild(cell("nothing to review", 0, "No block here was added or changed", true));
    } else {
      // Shaded by what is still UNREVIEWED: the darker, the more reading left.
      const left = r.needReview - r.reviewed;
      tr.appendChild(cell(r.reviewed + " of " + r.needReview + " reviewed", bucket(left, mx.unreviewed), left + " changed block(s) with no verdict on their current version"));
    }
    if (!h.hasQa) {
      tr.appendChild(cell("not published", 0, "This build published no block-qa.json (or no blocks.json to place it by section)", true));
    } else {
      const parts: string[] = [];
      if (r.qaFailing) parts.push(r.qaFailing + " failing" + (r.qaWorst ? " (" + r.qaWorst + ")" : ""));
      if (r.qaStale) parts.push(r.qaStale + " stale");
      if (r.qaUnaudited) parts.push(r.qaUnaudited + " unaudited");
      if (r.qaScriptsOnly) parts.push(r.qaScriptsOnly + " passing on scripts only (" + r.qaNeedsAgent + " criteria need an agent)");
      const judged = r.qaJudgedUnknown ? "passing (this build does not say whether agent-judged criteria were run)" : "passing, every applicable criterion judged";
      const text = parts.length ? parts.join(" \u00b7 ") : r.qaBlocks ? judged : "no blocks";
      tr.appendChild(cell(text, bucket(r.qaFailing, mx.qa), r.qaFailing + " block(s) failing, " + r.qaStale + " stale, " + r.qaUnaudited + " unaudited, of " + r.qaBlocks, !r.qaFailing && !r.qaStale && !r.qaUnaudited));
    }
    body.appendChild(tr);
  }
  t.appendChild(body);
  return t;
}
