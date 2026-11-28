/**
 * Extract work-tracking Status / TODO / Pending sections OUT of paper
 * content blocks (owner directive 2026-06-13: not in paper, not in
 * compute, not in lean; todos → `beans/`).
 *
 * This is the `--write` companion to `audit-status-sections.ts` (the
 * report-only auditor). For each `voice-status-section`-flagged `.md`:
 *
 *   - **authorNotes-class** (formalization / compute status): the section
 *     body is migrated VERBATIM into the block `.ts` `authorNotes` field
 *     (CLAUDE.md §4d) and removed from the `.md`. Done ONLY when the `.ts`
 *     is injectable (ends in `});`, no existing `authorNotes`); otherwise
 *     the block is SKIPPED (the `.md` section is left in place) and flagged.
 *   - **todo-class**: the section is appended to `build/paper-todos.json`
 *     and removed from the `.md`.
 *   - **substantive-class** (real math under a status header): NEVER
 *     touched — reported for a manual re-heading pass.
 *
 * Safety: dry-run by default (prints the plan); `--write` applies. Run
 * per chapter (`--chapter <dir>`) so each batch can be validated +
 * committed independently. The classifier is shared with the auditor.
 *
 * Usage:
 *   bun run cat-harness-tools/pipeline/extract-status-sections.ts --chapter mass-theory          # dry-run
 *   bun run cat-harness-tools/pipeline/extract-status-sections.ts --chapter mass-theory --write  # apply
 *
 * @module pipeline/extract-status-sections
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { checkStatusSectionHeader } from "./qa-checkers-voice";
import { requirePaper } from "./repo-root";
import { requireFlagValue } from "./cli-args";

const TODO_RE =
  /\b(?:TODO|FIXME|XXX|HACK|to-?do|pending|punt(?:ed|ing)?|kick\s+the\s+can|not\s+yet\s+(?:implemented|written|done|filled)|remaining\s+work|work\s+remaining|next\s+steps?|needs?\s+(?:work|fixing|attention|filling))\b/i;
const STATUS_RE =
  /(?:sorry-free|formali[sz]ed|formali[sz]ation|Lean\s+(?:file|proof|class|side|structure|infrastructure)|theorem\s*\(this\s+proposition\)|verified\s+in|\*\*Compute\b|no\s+sympy\s+probe|has_sorry|mathlib_ok|not_started)/i;
const SUBSTANTIVE_RE =
  /(?:\*\*Open\s+gate\b|refuted|ans(?:ä|a)tze|\bconjecture\b|^\s*\|.*\|.*\|)/im;

type Cls = "todo" | "substantive" | "authorNotes";
function classify(body: string): Cls {
  if (TODO_RE.test(body)) return "todo";
  if (STATUS_RE.test(body)) return "authorNotes";
  if (SUBSTANTIVE_RE.test(body)) return "substantive";
  return "authorNotes";
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

/** [headerIdx, endIdxExclusive) of the section owned by the header at i. */
function sectionRange(lines: string[], i: number): [number, number] {
  const lvl = (lines[i].match(/^#+/) ?? ["#"])[0].length;
  let j = i + 1;
  for (; j < lines.length; j++) {
    const hm = lines[j].match(/^(#{1,6})\s/);
    if (hm && hm[1].length <= lvl) break;
  }
  return [i, j];
}

/** Inject an authorNotes array into a conforming builder `.ts`. Returns
 *  the new source, or null if the file is not safely injectable. */
function injectAuthorNotes(tsSrc: string, bodies: string[]): string | null {
  if (/\bauthorNotes\s*:/.test(tsSrc)) return null; // already has notes
  const anchor = tsSrc.lastIndexOf("\n});");
  if (anchor < 0) return null;
  const entries = bodies
    .map((b) => `    {\n      kind: "status",\n      body: ${JSON.stringify(b.trim())},\n    },`)
    .join("\n");
  const block = `\n  authorNotes: [\n${entries}\n  ],`;
  return tsSrc.slice(0, anchor) + block + tsSrc.slice(anchor);
}

interface TodoEntry { block: string; header: string; body: string; }

function main() {
  const args = process.argv.slice(2);
  // Guards every flag it reads, not just `--paper`: same defect, same fix.
  const get = (f: string) => requireFlagValue(args, f);
  const paper = requirePaper(get("--paper"));
  const chapter = get("--chapter");
  const write = args.includes("--write");
  const beansTodos = "build/paper-todos.json";

  // declared-path-literal: the folio content root. Resolving it through `directoryForGraph` is bean `hs08`; the harness-side callers hit `ot9a`'s layering boundary, so the literal is COUNTED here rather than hidden.
  let root = join("folio", paper);
  if (chapter) root = join(root, chapter);

  const stats = { blocks: 0, mdSectionsRemoved: 0, authorNotesInjected: 0, todosExtracted: 0, substantiveSkipped: 0, tsNotInjectable: 0 };
  const todoOut: TodoEntry[] = existsSync(beansTodos) && write
    ? (JSON.parse(readFileSync(beansTodos, "utf-8")).todos ?? [])
    : [];

  for (const md of walkMd(root).sort()) {
    const r = checkStatusSectionHeader(md);
    if (r.result !== "fail") continue;
    const lines = readFileSync(md, "utf-8").split("\n");
    const tsPath = md.replace(/\.md$/, ".ts");
    const block = md.replace(/\.md$/, "");

    // Classify each flagged section.
    const secs = r.hits.map((h) => {
      const [a, b] = sectionRange(lines, h.line - 1);
      const header = lines[a];
      const body = lines.slice(a + 1, b).join("\n");
      return { a, b, header, body, cls: classify(body) };
    });

    const statusSecs = secs.filter((s) => s.cls === "authorNotes");
    const todoSecs = secs.filter((s) => s.cls === "todo");
    const subSecs = secs.filter((s) => s.cls === "substantive");
    stats.substantiveSkipped += subSecs.length;

    // Status migration needs an injectable .ts; if not, leave status in place.
    let canInjectStatus = false;
    let newTs: string | null = null;
    if (statusSecs.length) {
      const tsSrc = existsSync(tsPath) ? readFileSync(tsPath, "utf-8") : "";
      newTs = tsSrc ? injectAuthorNotes(tsSrc, statusSecs.map((s) => s.body)) : null;
      canInjectStatus = newTs !== null;
      if (!canInjectStatus) stats.tsNotInjectable++;
    }

    const removable = [
      ...todoSecs,
      ...(canInjectStatus ? statusSecs : []),
    ].sort((x, y) => y.a - x.a); // bottom-up
    if (!removable.length) continue;
    stats.blocks++;

    if (!write) {
      console.log(
        `${block.split("/").slice(-2).join("/")}: ` +
          `remove ${removable.length} (status=${canInjectStatus ? statusSecs.length : 0}` +
          `${statusSecs.length && !canInjectStatus ? " [ts-not-injectable, kept]" : ""}` +
          `, todo=${todoSecs.length}, substantive-kept=${subSecs.length})`,
      );
      continue;
    }

    // APPLY. Remove sections bottom-up (also strip one preceding blank line).
    const out = [...lines];
    for (const s of removable) {
      let start = s.a;
      while (start > 0 && out[start - 1].trim() === "") start--;
      out.splice(start, s.b - start);
    }
    while (out.length && out[out.length - 1].trim() === "") out.pop();
    writeFileSync(md, out.join("\n") + "\n");
    stats.mdSectionsRemoved += removable.length;

    if (canInjectStatus && newTs) {
      writeFileSync(tsPath, newTs);
      stats.authorNotesInjected += statusSecs.length;
    }
    for (const t of todoSecs) {
      todoOut.push({ block, header: t.header.replace(/^#+\s*/, ""), body: t.body.trim() });
      stats.todosExtracted++;
    }
  }

  if (write && stats.todosExtracted) {
    mkdirSync(dirname(beansTodos), { recursive: true });
    writeFileSync(
      beansTodos,
      JSON.stringify({ generated_at: new Date().toISOString().slice(0, 10), source: "paper content blocks (.md)", count: todoOut.length, todos: todoOut }, null, 2) + "\n",
    );
  }

  console.log(`\n[extract-status-sections] ${write ? "WROTE" : "DRY-RUN"} ${chapter ?? paper}:`, JSON.stringify(stats));
}

main();
