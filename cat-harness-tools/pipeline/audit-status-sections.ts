/**
 * Audit + extract work-tracking Status / TODO / Pending sections out of
 * paper content blocks into a `beans/` review queue.
 *
 * Owner directive (2026-06-13): paper content blocks must not carry
 * `## Status` / `### Status` / TODO / Pending SECTION HEADERS; todos
 * belong in `beans/`, status/formalization notes belong in the block
 * `.ts` `authorNotes` field (CLAUDE.md §4d).
 *
 * This is the review/extract companion to the `voice-status-section`
 * QA criterion (detection lives in
 * `pipeline/qa-checkers-voice.ts`). It walks every content
 * `.md`, captures each flagged section's body, classifies the
 * extraction target, and writes a `beans/` work-queue (same JSON
 * shape as `build/qa-agent-drain-queue.json`) so the cleanup can be
 * drained in reviewable batches.
 *
 * Classification (a hint for the reviewer — adjudicate, don't trust
 * blindly):
 *   - `todo`        — body has TODO / FIXME / pending / remaining-work
 *                     phrasing → extract to `beans/`.
 *   - `substantive` — body carries real math (a bold Theorem/Open-gate
 *                     claim, a refuted-ansätze table, a conjecture) →
 *                     keep the content, re-head to a scholarly title.
 *   - `authorNotes` — formalization / Lean / compute / proof status →
 *                     migrate to the `.ts` `authorNotes` field (§4d).
 *
 * Report-only: it never mutates `.md` / `.ts`. The per-block cleanup
 * is performed by an agent/human draining the emitted queue.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/audit-status-sections.ts
 *   bun run cat-harness-tools/pipeline/audit-status-sections.ts --paper quantum-observable-universe
 *   bun run cat-harness-tools/pipeline/audit-status-sections.ts --out build/status-section-audit.json
 *
 * @module pipeline/audit-status-sections
 */

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, dirname, basename } from "path";
import { checkStatusSectionHeader } from "./qa-checkers-voice";
import { BLOCK_KIND_ALT } from "../schemas/types.ts";
import { requirePaper } from "./repo-root";
import { paperArg } from "./cli-args";

/** Builder call identifying a block's kind — see `BLOCK_KIND_ALT`. */
const BUILDER_RE = new RegExp(`\\b(${BLOCK_KIND_ALT})\\s*\\(`);

const TODO_RE =
  /\b(?:TODO|FIXME|XXX|HACK|to-?do|pending|punt(?:ed|ing)?|kick\s+the\s+can|not\s+yet\s+(?:implemented|written|done|filled)|remaining\s+work|work\s+remaining|next\s+steps?|needs?\s+(?:work|fixing|attention|filling))\b/i;
// Formalization / compute STATUS signals — a `## Status` section that
// merely NAMES its theorem ("**Theorem (this proposition).** Sorry-free
// Lean proof …") is status, not new math. Deliberately does NOT include
// a bare "witness" token (it matches "No verified witness yet" in genuine
// open-problem prose like the Δ_λ gate).
const STATUS_RE =
  /(?:sorry-free|formali[sz]ed|formali[sz]ation|Lean\s+(?:file|proof|class|side|structure|infrastructure)|theorem\s*\(this\s+proposition\)|verified\s+in|\*\*Compute\b|no\s+sympy\s+probe|has_sorry|mathlib_ok|not_started)/i;
// Genuine new-math content under a status header (open-gate tables,
// refuted-ansätze lists, a conjecture statement). Checked AFTER STATUS so
// a status label that happens to bold "Theorem" is not mis-tagged.
const SUBSTANTIVE_RE =
  /(?:\*\*Open\s+gate\b|refuted|ans(?:ä|a)tze|\bconjecture\b|^\s*\|.*\|.*\|)/im;

type Classification = "todo" | "substantive" | "authorNotes";

interface SectionRec {
  header: string;
  line: number;
  classification: Classification;
  body_lines: number;
  preview: string;
}
interface BlockRec {
  block: string;
  kind: string;
  sections: SectionRec[];
}

function walkMd(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) out = out.concat(walkMd(p));
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

/** Cheap block-kind sniff from the sibling `.ts` builder call. */
function sniffKind(mdPath: string): string {
  const ts = mdPath.replace(/\.md$/, ".ts");
  try {
    const src = readFileSync(ts, "utf-8");
    const m = src.match(BUILDER_RE);
    return m ? m[1] : "unknown";
  } catch {
    return "unknown";
  }
}

/** Body = lines after the header up to the next header of level <= L. */
function sectionBody(lines: string[], headerIdx: number): string[] {
  const lvl = (lines[headerIdx].match(/^#+/) ?? ["#"])[0].length;
  const body: string[] = [];
  for (let j = headerIdx + 1; j < lines.length; j++) {
    const hm = lines[j].match(/^(#{1,6})\s/);
    if (hm && hm[1].length <= lvl) break;
    body.push(lines[j]);
  }
  return body;
}

function classify(body: string): Classification {
  if (TODO_RE.test(body)) return "todo";
  // STATUS before SUBSTANTIVE: a section naming its (sorry-free) theorem
  // is formalization status, not new mathematics.
  if (STATUS_RE.test(body)) return "authorNotes";
  if (SUBSTANTIVE_RE.test(body)) return "substantive";
  return "authorNotes";
}

function main() {
  const args = process.argv.slice(2);
  // Was a hardcoded folio paper name in PLATFORM code; see `requirePaper`.
  const paper = requirePaper(paperArg(args));
  const out =
    args.includes("--out") ? args[args.indexOf("--out") + 1] : "build/status-section-audit.json";
  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  const root = join("folio", paper);

  const mds = walkMd(root);
  const byChapter = new Map<string, BlockRec[]>();
  const byClass: Record<Classification, number> = { todo: 0, substantive: 0, authorNotes: 0 };
  let totalSections = 0;

  for (const md of mds.sort()) {
    const r = checkStatusSectionHeader(md);
    if (r.result !== "fail") continue;
    const lines = readFileSync(md, "utf-8").split("\n");
    const recs: SectionRec[] = [];
    for (const h of r.hits) {
      const body = sectionBody(lines, h.line - 1);
      const bodyText = body.join("\n");
      const cls = classify(bodyText);
      byClass[cls]++;
      totalSections++;
      const preview = body
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(" ⏎ ")
        .slice(0, 220);
      recs.push({
        header: h.text.replace(/^status-section-header:\s*/, ""),
        line: h.line,
        classification: cls,
        body_lines: body.filter((l) => l.trim()).length,
        preview,
      });
    }
    const chapter = basename(dirname(md));
    const block = md.replace(/\.md$/, "");
    if (!byChapter.has(chapter)) byChapter.set(chapter, []);
    byChapter.get(chapter)!.push({ block, kind: sniffKind(md), sections: recs });
  }

  const batches = [...byChapter.entries()]
    .sort()
    .map(([chapter, blocks], i) => ({
      batch_id: i + 1,
      chapter,
      status: "open",
      block_count: blocks.length,
      blocks,
    }));

  const queue = {
    generated_at: new Date().toISOString().slice(0, 10),
    directive: "no ## Status / ### Status / TODO / Pending section headers in paper content (owner 2026-06-13)",
    criterion: "voice-status-section",
    paper,
    total_blocks: batches.reduce((n, b) => n + b.block_count, 0),
    total_sections: totalSections,
    by_classification: byClass,
    extraction_targets: {
      todo: "a bean, via `beans create` — see AGENTS.md",
      authorNotes: "block .ts `authorNotes` field (CLAUDE.md §4d)",
      substantive: "re-head to a scholarly section title; keep the math",
    },
    total_batches: batches.length,
    batches,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(queue, null, 2) + "\n");
  console.log(
    `[audit-status-sections] ${paper}: ${queue.total_blocks} blocks, ` +
      `${totalSections} sections (todo=${byClass.todo}, ` +
      `substantive=${byClass.substantive}, authorNotes=${byClass.authorNotes}) ` +
      `across ${batches.length} chapters → ${out}`,
  );
}

main();
