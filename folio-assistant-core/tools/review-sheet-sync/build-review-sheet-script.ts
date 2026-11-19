/**
 * The review sheet's Apps Script, and one document's Config tab for it.
 *
 * Owner, 2026-10-31 (option C): ONE generic script for every document. It is
 * `review-sheet.gs` as is, stamped with its commit and made plain ASCII
 * (`--script`). What differs per document is written into the sheet's Config
 * tab, visible and locked to the owner, as rows of JSON (`--config`), read
 * here from the folio:
 *
 * - `review/public-comment/sheet-sync.json`, the folio's settings (tab and
 *   column names, the draft-PDF and comment-page link prefixes, the named
 *   sections a reviewer cites by name or abbreviation);
 * - the review anchors (`review-anchors.json`): each section's number, title
 *   and page in the frozen review draft;
 * - the review draft's `pdf-line-map.json`: which draft lines sit on which PDF
 *   page, and the printed-to-PDF page offset.
 *
 *   bun run folio-assistant-core/tools/review-sheet-sync/build-review-sheet-script.ts \
 *     [--script Code.gs] [--repo . --config review/public-comment/sheet-sync.json --out config-rows.json [--toc-out toc-rows.json]]
 *
 * Skill: `review-sheet-script`.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

/** The folio-assistant-core commit this template comes from, for the header stamp. */
function templateCommit(dir: string): string {
  try {
    const sha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["-C", dir, "status", "--porcelain", "--", "."], { encoding: "utf8" }).trim();
    return sha + (dirty ? " (with local changes)" : "");
  } catch {
    return "unknown";
  }
}

type Section = { label: string; title?: string; number?: string; page?: number };
type Chapter = { dir: string; title: string; number?: number };
type Block = { page?: number; printedPage?: string; sections: string[] };
type Anchors = { chapters: Chapter[]; sections: Section[]; blocks: Block[] };
type DraftSection = Section & { chapter?: string };
type LineMap = { pages: Record<string, { printed: string | null; lines?: Record<string, string> }> };

export type SheetSyncConfig = {
  /**
   * `public-comment` (default): the RPC/RCS/Agent tabs over a frozen review
   * PDF. `drafting`: one Contributor Feedback tab, each row one change set,
   * whose Sections pick from the live document's table of contents.
   */
  mode?: "public-comment" | "drafting";
  /** The Google Sheet's id. When set, the script refuses to run in any other spreadsheet. */
  sheet?: string;
  /** Review anchors, repository-relative. */
  anchors: string;
  /** The frozen review draft's pdf-line-map.json, repository-relative (public-comment). */
  lineMap?: string;
  /** Prefix a PDF page number is appended to, e.g. `draft/#page=` (public-comment). Relative URLs resolve against the folio's iriBase. */
  draftUrl?: string;
  /** Prefix a comment ref (`PC-0002`) is appended to (public-comment). */
  commentUrl?: string;
  /** Prefix a section's anchor (`sec:1-1`, `chap:<dir>`) is appended to, e.g. `en/<doc>/#` (drafting), relative to the folio's iriBase. */
  sectionUrl?: string;
  /** Sections cited by name: abbreviation -> section title. */
  namedSections?: Record<string, string>;
  /** Other names for front-matter chapters: alias -> chapter title. */
  aliases?: Record<string, string>;
  tabs?: Partial<{ RPC: string; RCS: string; AGENT: string; AGENT_CS: string; FEEDBACK: string; TOC: string }>;
  /** The document's GitHub repository, e.g. `https://github.com/litlfred/dth-phc`. Default: read from the folio's iriBase. */
  repository?: string;
  columns?: Partial<{ rpc: Record<string, string>; rcs: Record<string, string>; agent: Record<string, string>; draft: Record<string, string>; draftAgent: Record<string, string> }>;
};

/** Drafting mode's tabs and headers. */
export const DRAFT_TABS = { FEEDBACK: "Contributor Feedback", AGENT: "Agent", TOC: "TOC" };
export const DRAFT_COLUMNS = {
  draft: {
    cs: "Change-set", title: "Title", sections: "Selected Sections", sectionLinks: "Section links", feedback: "Contributor Feedback",
    agentFeedback: "Feedback (agent)",
    issue: "Issue", agentic: "Agentic status", staging: "Staging review", status: "Agentic status (filter)",
  },
  draftAgent: {
    csId: "Change-set", issue: "Issue", agentic: "Agentic status", prs: "Pull request (change set)",
    changes: "What the PRs changed (change set)", done: "Agent completed (UTC, change set)",
    staging: "Staging review page (change set)", basis: "Feedback basis (change set)",
    built: "Staging built (UTC, change set)",
    head: "PR head (change set)", builtFrom: "Staging built from (change set)", deploy: "Staging deploy (change set)",
    conversation: "Agent conversation (change set)",
    dispositions: "Disposition (change set)",
    gate: "QA gate (change set)", qa: "QA report (change set)",
  },
};

/**
 * The document's table of contents as dropdown entries: [name, anchor].
 * Names carry no commas, because a multi-select dropdown cell joins its
 * choices with ", ".
 */
/**
 * The dropdown is a flat list, so a section is indented under its chapter
 * (owner, 2026-10-31, "Indent sub-sections"; the "└ " mark tried first was
 * "too cluttered", so plain indent). The indent is three U+2800 (Braille
 * pattern blank) per level, which shows as blank space but is not whitespace:
 * Sheets stores a multi-select cell trimmed, so a first chip that began with
 * real spaces lost them and no longer matched the list ("Invalid"). The
 * script and the feedback-issue reader compare names with the indent
 * stripped (`bareName`), also the old "└ "/"│ " marks, so a value picked
 * before still links and the script rewrites it to the current name.
 */
export const INDENT = "\u2800\u2800\u2800";
export const treeMark = (depth: number) => (depth > 0 ? INDENT.repeat(depth) : "");
export const bareName = (n: string) => n.replace(/^[\s\u2800\u2502\u2514]+/, "").trim();

export function buildToc(a: { chapters: Chapter[]; sections: DraftSection[] }): [string, string][] {
  const clean = (s: string) => s.replace(/,/g, ";").replace(/\s+/g, " ").trim();
  const out: [string, string][] = [];
  const seen = new Set<string>();
  const add = (name: string, anchor: string, depth = 0) => {
    name = clean(name);
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push([treeMark(depth) + name, anchor]);
  };
  for (const c of a.chapters) {
    const bare = c.title.replace(/^Chapter\s+\d+\.?\s*/i, "");
    const head = c.number != null ? `Ch ${c.number}` : c.title;
    add(c.number != null ? `${head} ${bare}` : c.title, `chap:${c.dir}`);
    for (const s of a.sections.filter((x) => x.chapter === c.dir)) {
      const t = s.title ?? s.label;
      if (s.number) add(t, s.label, String(s.number).split(".").length - 1 || 1);
      else if (t.toLowerCase() !== c.title.toLowerCase()) add(`${head} · ${t}`, s.label, 1);
    }
  }
  return out;
}

/**
 * Public comment keeps the agent's rows on two tabs (owner, 2026-10-31): one
 * row per comment on AGENT, one row per change set on AGENT_CS. They were one
 * "Agent" tab with the two tables side by side, which made a comment's change
 * set and the unrelated change set on the same row look connected. A sheet
 * still laid out that way sets `tabs: { AGENT: "Agent", AGENT_CS: "" }`.
 */
export const DEFAULT_TABS = { RPC: "Review Public Comments", RCS: "Review Change Sets", AGENT: "Agent - Comments", AGENT_CS: "Agent - Change Sets" };
export const DEFAULT_COLUMNS = {
  rpc: {
    no: "No.", sections: "Sections", page: "Page", lines: "Line no(s) / Table / Figure",
    comment: "Comment / issue", revision: "Suggested revision",
    feedback: "Committee Feedback (initials)", disposition: "Disposition", status: "Status",
    agentic: "Agentic status",
  },
  rcs: {
    cs: "Change-set", sections: "Sections", pages: "Pages", comments: "Public Comments",
    revisions: "Suggested Revisions", feedback: "PC Committee Feedback", dispositions: "Dispositions",
    agentFeedback: "Change Set Feedback (agent)",
    agentic: "Agentic status", staging: "Staging review", status: "Agentic status (filter)",
  },
  agent: {
    no: "No.", pc: "Comment ref", agentic: "Agentic status", cs: "Change-sets",
    csId: "Change-set", prs: "Pull request (change set)", changes: "What the PRs changed (change set)",
    done: "Agent completed (UTC, change set)", basis: "Feedback basis (change set)",
    staging: "Staging review page (change set)", built: "Staging built (UTC, change set)",
    head: "PR head (change set)", builtFrom: "Staging built from (change set)", deploy: "Staging deploy (change set)",
    dispositions: "Disposition (change set)",
    gate: "QA gate (change set)", qa: "QA report (change set)",
  },
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "");

/** The data the template reads: section keys, abbreviations, line pages, offset. */
export function buildData(a: Anchors, m: LineMap, cfg: SheetSyncConfig) {
  // Printed -> PDF offset: the most common difference over numbered pages.
  const diffs = new Map<number, number>();
  let max = 0;
  for (const [p, d] of Object.entries(m.pages)) {
    if (d.printed && /^\d+$/.test(d.printed)) {
      const k = +p - +d.printed;
      diffs.set(k, (diffs.get(k) ?? 0) + 1);
      max = Math.max(max, +d.printed);
    }
  }
  const offset = [...diffs].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0;

  // Each section's first page: its earliest block on a page whose printed number agrees with the offset.
  const first = new Map<string, [number, number]>();
  for (const b of a.blocks) {
    if (b.page == null) continue;
    const good = /^\d+$/.test(b.printedPage ?? "") && b.page - +(b.printedPage as string) === offset ? 0 : 1;
    for (const s of b.sections) {
      const cur = first.get(s);
      if (!cur || good < cur[0] || (good === cur[0] && b.page < cur[1])) first.set(s, [good, b.page]);
    }
  }
  const secs = new Map(a.sections.map((s) => [s.label, s]));
  const lines: [number, string][] = [];
  for (const [p, d] of Object.entries(m.pages)) for (const t of Object.values(d.lines ?? {})) lines.push([+p, t.trim()]);

  // An unnumbered section's own `page` can be an estimate, so its heading is looked up in the draft itself.
  const appendixPage = (label: string) => {
    const ap = /^sec:([a-z])-/.exec(label);
    return ap ? (secs.get(`sec:${ap[1]}`)?.page ?? first.get(`sec:${ap[1]}`)?.[1] ?? 0) : 0;
  };
  const page = (label: string): number | undefined => {
    const s = secs.get(label);
    if (s && !s.number && s.title && /^sec:[a-z]-/.test(label)) {
      const t = norm(s.title).slice(0, 25);
      const from = appendixPage(label);
      const hits = lines.filter(([p, l]) => p >= from && norm(l).startsWith(t) && norm(l).length < t.length + 40).map(([p]) => p);
      if (hits.length) return Math.min(...hits);
    }
    return s?.page ?? first.get(label)?.[1];
  };

  const K: Record<string, [string, number]> = {};
  const put = (k: string, name: string, label: string) => {
    const p = page(label);
    if (p != null && first.has(label) && !(k in K)) K[k] = [name, p];
  };
  for (const s of a.sections) {
    let r = /^sec:(\d+(?:-\d+)+)$/.exec(s.label);
    if (r) { const k = r[1].replace(/-/g, "."); put(k, k, s.label); continue; }
    r = /^sec:([a-z])$/.exec(s.label);
    if (r) { put(r[1].toUpperCase(), `Appendix ${r[1].toUpperCase()}`, s.label); continue; }
    r = /^sec:([a-z](?:-\d+)+)$/.exec(s.label);
    if (r) { const k = r[1].toUpperCase().replace(/-/g, "."); put(k, k, s.label); }
  }
  const front: Record<string, [string, string]> = {};
  for (const c of a.chapters) {
    const lead = `sec:${c.dir}-lead`;
    if (c.number != null) put(`ch${c.number}`, String(c.number), lead);
    else { put(`f:${c.title.toLowerCase()}`, c.title, lead); front[c.title.toLowerCase()] = [lead, c.title]; }
  }
  for (const [alias, title] of Object.entries(cfg.aliases ?? {})) {
    const f = front[title.toLowerCase()];
    if (!f) throw new Error(`aliases: no front-matter chapter titled "${title}"`);
    put(`f:${alias.toLowerCase()}`, f[1], f[0]);
  }
  const ABBR: Record<string, string> = {};
  for (const [abbr, title] of Object.entries(cfg.namedSections ?? {})) {
    const s = a.sections.find((x) => !x.number && x.title?.toLowerCase() === title.toLowerCase());
    if (!s) throw new Error(`namedSections: no unnumbered section titled "${title}"`);
    const ap = /^sec:([a-z])-/.exec(s.label);
    put(`c:${title.toLowerCase()}`, `${ap ? ap[1].toUpperCase() + ": " : ""}${s.title}`, s.label);
    ABBR[abbr] = title.toLowerCase();
  }

  const LP: [number, number, number][] = [];
  for (const [p, d] of Object.entries(m.pages).sort((x, y) => +x[0] - +y[0])) {
    const ls = Object.keys(d.lines ?? {}).filter((x) => /^\d+$/.test(x)).map(Number);
    if (ls.length) LP.push([+p, Math.min(...ls), Math.max(...ls)]);
  }
  // Readable names (owner, 2026-10-31: "explain 'K'"). The script also reads
  // the old short names, so a Config written before this still works.
  return {
    ABOUT: {
      SECTIONS: "each section the comments can name: key -> [name shown, PDF page]",
      ABBREVIATIONS: "short names reviewers use (e.g. HWR) -> the section key they stand for",
      PAGE_LINES: "for each PDF page with numbered lines: [page, first line, last line]",
      PAGE_OFFSET: "PDF page = printed page + this",
      LAST_PAGE: "the last printed page, so a larger number is not read as a page",
    },
    SECTIONS: K, ABBREVIATIONS: ABBR, PAGE_LINES: LP, PAGE_OFFSET: offset, LAST_PAGE: max,
  };
}

/** One document's settings for the generic script: what its Config tab holds. */
export type SheetConfig = { CFG: Record<string, string>; COLS: Record<string, Record<string, string>>; DATA: unknown };

/**
 * The folio's own site address: `iriBase` of the layer declaration at the
 * repository root (`<instance>.json`), e.g. `https://litlfred.github.io/dth-hrh/`.
 */
export function siteBase(repo: string): string | undefined {
  for (const f of readdirSync(repo).filter((x) => x.endsWith(".json")).sort()) {
    try {
      const j = JSON.parse(readFileSync(join(repo, f), "utf8"));
      if (typeof j?.iriBase === "string" && /^https:\/\//.test(j.iriBase)) return j.iriBase.replace(/\/?$/, "/");
    } catch { /* not JSON we read */ }
  }
  return undefined;
}

/**
 * A sheet-sync URL: absolute as written, or relative to the folio's site
 * (owner, 2026-10-31: a folio moving org, e.g. to WHO, changes one iriBase,
 * not every sheet-sync.json). `draft/#page=` -> `<iriBase>draft/#page=`.
 */
export function siteUrl(u: string, base: string | undefined, what: string): string {
  if (/^https?:\/\//.test(u)) return u;
  if (!base) throw new Error(`${what} "${u}" is relative, but the folio declares no iriBase in its <instance>.json`);
  return base + u.replace(/^\.?\//, "");
}

/**
 * The GitHub repository behind a GitHub Pages site: `https://<owner>.github.io/<repo>/`
 * is `https://github.com/<owner>/<repo>`. Undefined for any other host.
 */
export function repoOfSite(base: string | undefined): string | undefined {
  const m = base?.match(/^https:\/\/([A-Za-z0-9-]+)\.github\.io\/([A-Za-z0-9._-]+)\/?/);
  return m ? `https://github.com/${m[1]}/${m[2]}` : undefined;
}

/** A spreadsheet id from its id or any of its URLs (`.../spreadsheets/d/<id>/edit?gid=0`). */
export function sheetIdOf(s: string): string {
  const m = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/) ?? s.match(/^([A-Za-z0-9_-]{20,})$/);
  if (!m) throw new Error(`"${s}" is neither a Google Sheets link nor a spreadsheet id`);
  return m[1];
}

/**
 * A new drafting sheet's sheet-sync.json, from the folio alone: the anchors
 * file and the section URL follow from the document's name. `--link` writes
 * it, so linking a copied template is one command (owner, 2026-11-01: "make
 * as much mechanical as possible").
 */
export function draftingSheetSync(document: string, sheet: string): SheetSyncConfig {
  return { mode: "drafting", anchors: `folio/${document}/review-anchors.json`, sectionUrl: `en/${document}/#`, sheet: sheetIdOf(sheet) };
}

export function buildConfig(repo: string, cfgPath: string): SheetConfig {
  const cfg: SheetSyncConfig = JSON.parse(readFileSync(join(repo, cfgPath), "utf8"));
  const base = siteBase(repo);
  for (const k of ["draftUrl", "commentUrl", "sectionUrl"] as const) if (cfg[k]) cfg[k] = siteUrl(cfg[k] as string, base, `${cfgPath}: ${k}`);
  const a: Anchors = JSON.parse(readFileSync(join(repo, cfg.anchors), "utf8"));
  let CFG: Record<string, string>, COLS: Record<string, Record<string, string>>, data: unknown;
  if (cfg.mode === "drafting") {
    if (!cfg.sectionUrl) throw new Error(`${cfgPath}: drafting mode needs sectionUrl`);
    CFG = { MODE: "drafting", ...DRAFT_TABS, ...cfg.tabs, SECTION_URL: cfg.sectionUrl };
    COLS = {
      draft: { ...DRAFT_COLUMNS.draft, ...cfg.columns?.draft },
      draftAgent: { ...DRAFT_COLUMNS.draftAgent, ...cfg.columns?.draftAgent },
    };
    data = {
      ABOUT: { TOC: "the Selected Sections dropdown: [name shown, anchor on the document page]" },
      TOC: buildToc(a as Anchors & { sections: DraftSection[] }),
    };
  } else {
    for (const k of ["lineMap", "draftUrl", "commentUrl"] as const) if (!cfg[k]) throw new Error(`${cfgPath}: needs ${k}`);
    const m: LineMap = JSON.parse(readFileSync(join(repo, cfg.lineMap as string), "utf8"));
    data = buildData(a, m, cfg);
    CFG = { MODE: "public-comment", ...DEFAULT_TABS, ...cfg.tabs, DRAFT: cfg.draftUrl as string, PC_PAGE: cfg.commentUrl as string };
    COLS = {
      rpc: { ...DEFAULT_COLUMNS.rpc, ...cfg.columns?.rpc },
      rcs: { ...DEFAULT_COLUMNS.rcs, ...cfg.columns?.rcs },
      agent: { ...DEFAULT_COLUMNS.agent, ...cfg.columns?.agent },
    };
  }
  // Where the document lives, shown on the sheet once it is linked (owner,
  // 2026-11-01: "a link to the github repo and gh-pages ... so user can link").
  const repoUrl = cfg.repository ?? repoOfSite(base);
  CFG = {
    SOURCE: cfgPath, ...(cfg.sheet ? { SHEET: cfg.sheet } : {}),
    ...(base ? { SITE_URL: base } : {}), ...(repoUrl ? { REPO_URL: repoUrl } : {}),
    LATEST_BUILD: latestBuild(),
    ...CFG,
  };
  return { CFG, COLS, DATA: data };
}

/** A Sheets cell holds at most 50,000 characters; stay well under. */
const CHUNK = 40_000;

/**
 * The setup steps a person takes, written in one cell at the top of the Config tab so
 * they stay with the sheet (owner, 2026-10-31: "so people don't lose the
 * info"). The skill review-sheet-script says the same; the drafting script's
 * installTriggers box shows the dropdown steps with the exact range.
 */
/**
 * The colour key, one line per colour, worded for the sheet's mode. The
 * Instructions row above each tab's header carries the same words; the script
 * skips that row (owner, 2026-10-31).
 */
/** How the colour key line starts; the script finds the key by it. */
export const COLOUR_KEY_LEAD = "Column colours:     ";

export function colourKey(c: SheetConfig): { blue: string; green: string; orange: string; grey: string } {
  // Process roles, not job titles: who sits on the committee is the sheet's business (owner, 2026-10-31).
  const people = c.CFG.MODE === "drafting" ? "the Authoring Committee" : "the Feedback Review Committee";
  return {
    blue: `Blue: ${people}`,
    green: "Green: the agent",
    orange: "Orange: an Editor",
    grey: "Grey: the script",
  };
}

/**
 * The harness's page for the process a sheet runs, where every step and role
 * is set out in full (owner, 2026-10-31: "instructions should link back to the
 * process page in the harness"). Public comment runs public-comment.bpmn; a
 * drafting sheet runs contributor-feedback.bpmn. CFG.PROCESS overrides it.
 */
export const PROCESS_PAGES = {
  "public-comment": "https://litlfred.github.io/folio-assistant/en/cat-harness/processes/public-comment.html",
  drafting: "https://litlfred.github.io/folio-assistant/en/cat-harness/processes/contributor-feedback.html",
} as const;

export function processPage(c: SheetConfig): string {
  return c.CFG.PROCESS || (c.CFG.MODE === "drafting" ? PROCESS_PAGES.drafting : PROCESS_PAGES["public-comment"]);
}

export const CONFIG_TAB = "Config";

/**
 * The Instructions text at the top of every visible tab: what the tab is for
 * and how it works, in that tab's own terms (owner, 2026-10-31: "each tab
 * should have an Instructions header with the purpose of the tab, even if to
 * say don't do anything"; "make 'how this sheet works' specific to each
 * tab"). A people's tab opens with the colour line, one line per step after
 * it, and ends with the filter views and the harness's process page. Hidden
 * helper tabs carry none, since the script writes them whole.
 */
export function tabInstructions(c: SheetConfig): Record<string, string> {
  const drafting = c.CFG.MODE === "drafting";
  const t = { ...(drafting ? DRAFT_TABS : DEFAULT_TABS), ...c.CFG } as Record<string, string>;
  const k = colourKey(c);
  // The key names no colour: each phrase is shown in its colour by the
  // script (owner, 2026-11-01: "make the text colored not have the word").
  const colours = COLOUR_KEY_LEAD + [k.blue, k.green, k.orange, k.grey].map((x) => x.replace(/^\w+: /, "")).join("     ");
  const staging = (drafting ? c.COLS.draft?.staging : c.COLS.rcs?.staging) ?? "Staging review";
  const fb = c.COLS.draft?.feedback ?? "Contributor Feedback";
  // Column names in the steps are shown bold in their column's colour by the
  // script, so the text never says the colour (owner, 2026-11-01).
  const pcFb = (c.COLS.rpc?.feedback ?? "Committee Feedback (initials)").replace(/ \(.*\)$/, "");
  const reviewersFb = drafting ? fb : pcFb;
  const people = drafting ? t.FEEDBACK : `${t.RPC} and ${t.RCS}`;
  const footer = [
    "Your rows: Data, then Filter views (changes nothing for others). No edit rights? Insert, then Comment.",
    `Full process: ${processPage(c)}`,
  ];
  // Column names carry their colour in the sheet, so the steps name no colours
  // (owner, 2026-11-01 18:22Z: "you dont need to say (Orange) or (Blue)"; 18:26Z: too wordy).
  const ask = "Agentic status says \"Needs you\" when it has a question.";
  const disp = drafting ? "Disposition" : "Dispositions";
  const changeSet = [
    "   3. An Editor sets Ready for agent to Yes once the direction is agreed.",
    `   4. The agent makes one pull request. Agentic status tracks it; ${staging} opens the changes. When the preview is live, Ready for agent becomes Completed.`,
    `   5. New ${reviewersFb} marks the proposal stale and resets Ready for agent to No. An Editor sets Yes again to update the pull request.`,
    `   6. A second reviewer checks the ${disp} against the pull request and reads the QA report. Then an Editor sets Ready for merge to Yes, and the agent merges.`,
  ];
  const out: Record<string, string> = {
    [CONFIG_TAB]: `The script's settings. Work happens on ${people}. Do not edit, except EDITORS (owner only).`,
    [t.AGENT]: drafting || !t.AGENT_CS
      ? `Written by the agent: one row per ${drafting ? "change set" : "comment or change set"}. Do not edit. The script copies it into ${people}.`
      : `Written by the agent: one row per public comment. Do not edit. The script copies it into ${t.RPC}.`,
    ...(!drafting && t.AGENT_CS ? { [t.AGENT_CS]: `Written by the agent: one row per change set. Do not edit. The script copies it into ${t.RCS} and ${t.RPC}.` } : {}),
    Watch: "Kept by the agent's watcher. Do not edit.",
  };
  if (drafting) {
    out[t.FEEDBACK] = [
      colours,
      "One row per change set:",
      `   1. The Authoring Committee starts a row: Title, Selected Sections and ${fb}. The script adds the Change-set id.`,
      `   2. The agent proposes a direction in ${c.COLS.draft?.agentFeedback || "Feedback (agent)"}. ${ask}`,
      ...changeSet,
      ...footer,
    ].join("\n");
  } else {
    out["Public Comment Source"] = `The public comments as received. Do not edit: correct them on ${t.RPC}.`;
    out[t.RPC] = [
      colours,
      "One row per public comment, as received:",
      `   1. The Feedback Review Committee adds ${pcFb}, TWG (human), Comment type, Disposition and Status.`,
      `   2. The agent suggests a Change Set (linked to ${t.RCS}) and a TWG (agent). To move a comment, type another change set's id, or "new", in Change Set (human).`,
      `   3. Edits are decided per change set, on ${t.RCS}. Agentic status and ${staging} here follow the change set.`,
      ...footer,
    ].join("\n");
    out[t.RCS] = [
      colours,
      `One row per change set, joining its comments from ${t.RPC}:`,
      `   1. The Feedback Review Committee gives ${pcFb} on the change set and picks its TWG (CS). To make a change set, type a Title on an empty row (the script adds the Change-set id) or open a change-set issue. To split or merge one, say so in ${pcFb}: the agent proposes how.`,
      `   2. The agent proposes a direction in ${c.COLS.rcs?.agentFeedback || "Change Set Feedback (agent)"}. ${ask}`,
      ...changeSet,
      ...footer,
    ].join("\n");
  }
  return out;
}

export function setupSteps(_c: SheetConfig): string[] {
  const steps = [
    `Once per sheet, by the sheet's owner. Made with File, then Make a copy, of the template? It is already set up: choose Folio Assistant, then Install, allow it (step 5), and you are done. Otherwise (details: ${INSTALL_GUIDE_URL}):`,
    `1. Get the short stub: open ${STUB_GS_URL} and press "Copy raw file" (the two-squares button at the top right of the code)`,
    "2. Here, choose Extensions, then Apps Script. Name the project after this sheet (click \"Untitled project\"). \"Unable to open the file\"? Use a private window signed in to the owner's account only",
    "3. Click Code.gs, select all, delete, paste the stub and save (Ctrl+S or Cmd+S)",
    `4. Next to Libraries, press +, paste the Script ID ${LIBRARY_ID}, press Look up, choose Version HEAD (Development mode), set Identifier to Review, and press Add`,
    "5. Reload the sheet and choose Folio Assistant, then Install. Google asks to allow it, then says \"Google hasn't verified this app. The app is requesting access to sensitive info in your Google Account.\" That is expected for a sheet's own script. Choose Advanced, then Go to <project name> (unsafe), then Allow. Why: https://support.google.com/cloud/answer/7454865",
    "6. Folio Assistant, then Refresh now, checks it",
    `   • Updates need nothing here: the code lives once in the Folio Review Library (${LIBRARY_URL}), and every sheet runs its latest version`,
  ];
  return steps;
}

/** Drafting only: the dropdown settings a person sets (the agent sets the Chip style through the Sheets API; the tick only a person can set on a range rule). */
export function dropdownSteps(c: SheetConfig): string[] | undefined {
  if (c.CFG.MODE !== "drafting") return undefined;
  const col = c.COLS.draft?.sections ?? "Selected Sections";
  return [
    `Once per sheet, after installing the script: allow several sections in the ${col} dropdown (the script cannot):`,
    `   • Click the column letter above "${col}", then Data, then Data validation`,
    `   • Open the rule (it says "Dropdown (from a range)"), open Advanced options and set Display style to Chip`,
    "   • Then tick Allow multiple selections (it is greyed out until the style is Chip) and press Done",
  ];
}

/** Who may set the Ready columns, and how the owner names them in the EDITORS row. */
export function editorSteps(): string[] {
  return [
    "Who may set Ready for agent and Ready for merge: the emails in the EDITORS cell below (column B).",
    "   • Share each of them as Editor first (Share button, pick Editor)",
    "   • Type their emails in the EDITORS cell; only the owner can change it",
    "   • Format: plain emails only, no names; one per line (Ctrl+Enter, or Cmd+Enter on a Mac, starts a new line in a cell). Commas or semicolons also work",
    "   • Example, for two editors:\n        ana@example.org\n        ben@example.org",
    "   • Anything that is not an email is left out, and Refresh now says which",
    "   • Choose Folio Assistant, then Refresh now: the two Ready columns are locked to the owner plus them",
    "   • Leave it empty and only the owner can set them (the default)",
  ];
}

/**
 * A drafting sheet's TOC tab, as the script's own refresh writes it: the
 * Selected Sections dropdown reads column A. The agent writes these with the
 * Config rows when it links a sheet, so the dropdown works before anyone has
 * pasted the script (owner, 2026-10-31: a new copy showed an empty dropdown).
 * `undefined` for a public-comment sheet, which has no TOC.
 */
export function tocRows(c: SheetConfig): string[][] | undefined {
  const toc = (c.DATA as { TOC?: [string, string][] }).TOC;
  if (!c.CFG.TOC || !toc) return undefined;
  const q = (x: string) => x.replace(/"/g, '""');
  return [["Section", "Link", "Anchor"]].concat(
    toc.map(([name, anchor]) => [name, `=HYPERLINK("${q(c.CFG.SECTION_URL + anchor)}","open")`, anchor]),
  );
}

/**
 * The Config tab's rows: a header, then CFG, COLS and DATA, each as JSON with
 * a leading "|" so a sheet never reads it as a number or formula, a long
 * value continued on the next rows under the same key.
 */
export function configRows(c: SheetConfig): string[][] {
  // EDITORS is the one row a person keeps: the agent writes it empty here
  // and keeps the sheet's value when it rewrites the tab. Emails never go
  // into sheet-sync.json, which is committed.
  const rows: string[][] = [
    // Short Instructions rows, one per subject, so no row is taller than the
    // window (owner, 2026-10-31). The script reads keys by name and ignores these.
    ["Instructions", tabInstructions(c)[CONFIG_TAB]],
    ["Instructions - Install script", setupSteps(c).join("\n")],
    ...(dropdownSteps(c) ? [["Instructions - Dropdown", dropdownSteps(c)!.join("\n")]] : []),
    ["Instructions - Editors", editorSteps().join("\n")],
    ...(linkLines(c).length ? [["Instructions - Links", linkLines(c).join("\n")]] : []),
    ["Key", "Value (written by the agent from sheet-sync.json; do not edit, except EDITORS)"],
    ["EDITORS", ""],
  ];
  for (const key of ["CFG", "COLS", "DATA"] as const) {
    // Indented only where a person might edit by hand (CFG: URLs, tab names;
    // COLS: column headers). DATA is generated from the folio, so it stays
    // compact (owner, 2026-10-31: "only what might be hand fiddled").
    for (const chunk of chunks(key === "DATA" ? JSON.stringify(c[key]) : readable(c[key]))) rows.push([key, "|" + chunk]);
  }
  return rows;
}

/** Where the document lives: its published site, its repository, and this sheet's settings file. */
export function linkLines(c: SheetConfig): string[] {
  const out: string[] = [];
  if (c.CFG.SITE_URL) out.push(`Document (GitHub Pages): ${c.CFG.SITE_URL}`);
  if (c.CFG.REPO_URL) {
    out.push(`Repository: ${c.CFG.REPO_URL}`);
    out.push(`This sheet's settings: ${c.CFG.REPO_URL}/blob/main/${c.CFG.SOURCE}`);
  }
  return out;
}

/** A cell of the Config tab holds at most this many lines, so a row stays a readable height. */
const LINES = 40;

/**
 * Indented JSON for a person to read: an object or a long array takes one
 * line per entry; a short array of plain values (a TOC pair, a column list)
 * stays on one line.
 */
export function readable(v: unknown, ind = ""): string {
  const inner = `${ind}  `;
  if (Array.isArray(v)) {
    const flat = JSON.stringify(v);
    if (v.every((x) => x === null || typeof x !== "object" || (Array.isArray(x) && x.every((y) => y === null || typeof y !== "object"))) && flat.length <= 160) return flat;
    if (!v.length) return "[]";
    return `[\n${v.map((x) => inner + readable(x, inner)).join(",\n")}\n${ind}]`;
  }
  if (v && typeof v === "object") {
    const es = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    if (!es.length) return "{}";
    return `{\n${es.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${readable(x, inner)}`).join(",\n")}\n${ind}}`;
  }
  return JSON.stringify(v);
}

/**
 * Indented JSON in cells of at most LINES lines and CHUNK characters, cut
 * between lines so a person can read each cell (owner, 2026-10-31). Every cut
 * falls between two JSON tokens, so the script's plain concatenation still
 * parses; only a single line longer than a cell is cut inside it.
 */
export function chunks(json: string): string[] {
  const out: string[] = [];
  let cur = "";
  let n = 0;
  for (const line of json.split("\n")) {
    const add = cur ? `${cur}\n${line}` : line;
    if (add.length <= CHUNK && n < LINES) { cur = add; n++; continue; }
    if (cur) out.push(cur);
    cur = line;
    n = 1;
    while (cur.length > CHUNK) { out.push(cur.slice(0, CHUNK)); cur = cur.slice(CHUNK); }
  }
  out.push(cur);
  return out;
}

function contentStamp(template: string): string {
  return `template sha256 ${createHash("sha256").update(template).digest("hex").slice(0, 16)}`;
}

/**
 * The build stamp of the Code.gs this checkout publishes. The Config tab
 * carries it as LATEST_BUILD, so "Which version is this?" can say whether the
 * sheet is up to date without the script fetching anything (owner, 2026-11-01).
 */
export function latestBuild(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return contentStamp(readFileSync(join(here, "review-sheet.gs"), "utf8"));
}

/** The one script every review sheet runs: the template, stamped with its commit. */
export function buildScript(opts: { stamp?: "commit" | "content" } = {}): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const template = readFileSync(join(here, "review-sheet.gs"), "utf8");
  // The committed copy (dist/Code.gs) is stamped by the template's content, not
  // a commit: a file cannot name the commit it is in, and the check that it is
  // current must not change with every commit.
  const at = opts.stamp === "content" ? contentStamp(template) : templateCommit(here);
  return asciiOnly(template
    .replace("/*@@VERSION@@*/", `// folio-assistant-core tools/review-sheet-sync at ${at}.`)
    .replace("@@STAMP@@", at.replace(/'/g, "")));
}

/**
 * Where a person gets the latest Code.gs: the committed build on core's main,
 * whose GitHub page has a "Copy raw file" button (owner, 2026-10-31: "where to
 * get code.gs is not stated ... should link to instructions w/ DL link").
 * `bun run …/build-review-sheet-script.ts --dist` rewrites it; a test fails
 * when it is stale.
 */
export const CODE_GS_URL = "https://github.com/litlfred/folio-assistant-core/blob/main/tools/review-sheet-sync/dist/Code.gs";
/** The one Apps Script library every sheet's stub calls (owner, 2026-10-31). */
export const LIBRARY_ID = "1us7_ApIq_XvDG-V1XtqdcyHucF0hSlST0qracv1Tw9KTb4-lAFvK1bMQ";
export const LIBRARY_URL = `https://script.google.com/home/projects/${LIBRARY_ID}/edit`;
export const STUB_GS_URL = "https://github.com/litlfred/folio-assistant-core/blob/main/tools/review-sheet-sync/dist/Stub.gs";
export const CODE_GS_RAW = "https://raw.githubusercontent.com/litlfred/folio-assistant-core/main/tools/review-sheet-sync/dist/Code.gs";
export const INSTALL_GUIDE_URL = "https://github.com/litlfred/folio-assistant-core/blob/main/skills/content/folio-document-adapter/review-sheet-script.md#installing-the-script-step-by-step";

/**
 * Every non-ASCII character as a \uXXXX escape. A paste into the Apps Script
 * editor can lose them (an en dash showed as a box), and an escape means the
 * same in a string, a regex and a comment.
 */
export const asciiOnly = (s: string) =>
  s.replace(/[^\x00-\x7f]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

if (import.meta.main) {
  const arg = (f: string) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : undefined; };
  const sha = (x: string) => createHash("sha256").update(x).digest("hex");
  if (process.argv.includes("--dist")) {
    const here = dirname(fileURLToPath(import.meta.url));
    mkdirSync(join(here, "dist"), { recursive: true });
    writeFileSync(join(here, "dist", "Code.gs"), buildScript({ stamp: "content" }));
    console.error("wrote dist/Code.gs");
    writeFileSync(join(here, "dist", "Stub.gs"), readFileSync(join(here, "stub.gs"), "utf8"));
    console.error("wrote dist/Stub.gs");
    writeFileSync(join(here, "dist", "Updater.gs"), readFileSync(join(here, "updater.gs"), "utf8"));
    writeFileSync(join(here, "dist", "library-appsscript.json"), readFileSync(join(here, "library-appsscript.json"), "utf8"));
    console.error("wrote dist/Updater.gs and dist/library-appsscript.json");
  }
  const script = arg("--script");
  if (script) {
    const out = buildScript();
    writeFileSync(script, out);
    console.error(`wrote ${script} (${out.length} bytes, sha256 ${sha(out)})`);
  }
  const link = arg("--link");
  let cfg = arg("--config");
  if (link) {
    // One command links a copied template: write sheet-sync.json, then the rows below.
    const document = arg("--document");
    if (!document) { console.error("--link needs --document <doc>, the folio's document name (folio/<doc>/)"); process.exit(2); }
    cfg = cfg ?? "review/drafting/sheet-sync.json";
    const at = join(resolve(arg("--repo") ?? "."), cfg);
    const sync = existsSync(at) ? { ...JSON.parse(readFileSync(at, "utf8")), sheet: sheetIdOf(link) } : draftingSheetSync(document, link);
    mkdirSync(dirname(at), { recursive: true });
    writeFileSync(at, `${JSON.stringify(sync, null, 2)}\n`);
    console.error(`wrote ${cfg}: sheet ${sync.sheet}`);
  }
  if (cfg) {
    const repo = resolve(arg("--repo") ?? ".");
    if (!existsSync(join(repo, cfg))) {
      console.error(`no ${cfg} in ${repo}: write one first (skill review-sheet-script)`);
      process.exit(2);
    }
    const built = buildConfig(repo, cfg);
    const rows = `${JSON.stringify(configRows(built), null, 1)}\n`;
    const to = arg("--out");
    if (to) { writeFileSync(to, rows); console.error(`wrote ${to}: the Config tab's rows`); }
    else process.stdout.write(rows);
    const tocOut = arg("--toc-out");
    if (tocOut) {
      const toc = tocRows(built);
      if (!toc) { console.error(`${cfg} is not a drafting sheet: it has no TOC tab`); process.exit(2); }
      writeFileSync(tocOut, `${JSON.stringify(toc, null, 1)}\n`);
      console.error(`wrote ${tocOut}: the TOC tab's rows (the Selected Sections dropdown)`);
    }
  }
  if (!script && !cfg && !link && !process.argv.includes("--dist")) {
    console.error("usage: build-review-sheet-script.ts [--script Code.gs] [--repo <folio>] [--link <sheet url or id> --document <doc>] [--config review/<mode>/sheet-sync.json] [--out config-rows.json] [--toc-out toc-rows.json] [--dist]");
    process.exit(2);
  }
}
