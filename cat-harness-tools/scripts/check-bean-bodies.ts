#!/usr/bin/env bun
/**
 * Three store defects `beans check` cannot see, because none of them is a link.
 *
 * 1. **An empty body** on an open bean — front matter only, so a sibling
 *    reading the store cannot tell what the claimed item is.
 * 2. **A folded title** — a `title: |-` that continues into the body and
 *    swallows its first lines (e.g. a `## Done when` checklist).
 * 3. **A dead prose blocker** — *"blocked on bean `x`"* where `x` is
 *    `scrapped`, so the block can never lift.
 *
 * Blockers are checked in prose because `beans` has no blocker field, so
 * [`bean-blocking.md`](../work-plan/skills/work-plan/bean-blocking.md) puts
 * them in the body, which the CLI's link check does not read.
 *
 * ## What it does NOT do
 *
 * **It does not repair anything.** Beans are repaired by their owners, the
 * same rule as `bun run cat health`: every finding names something a person
 * does.
 *
 * **It ignores closed beans**, like `check:bean-parents`: a finished bean is
 * history. A `## Done when` is not required either; the requirement is that
 * the body EXISTS.
 *
 * Exit: 0 clean (or no store), 1 a real defect, 2 could not check.
 *
 * @module folio-assistant/scripts/check-bean-bodies
 * @covers bean-defs, beans
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { repoRootFor } from "../schemas/kg/cat-harness.js";

import {
  CLOSED_STATUSES,
  OPEN_STATUSES,
  isFoldedTitle,
  readBeanFiles,
  type BeanFile,
} from "./bean-store-read.ts";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

/**
 * A blocker written the way the corpus actually writes one:
 * **`Blocked on bean \`fsch\``**, **`Blocked on \`folio-assistant-68dt\``**.
 *
 * Two constraints, and both were added after MEASURING the looser form against
 * the store. A bare word is not a reference — permitting one matched *"not
 * blocked on anything but the question"*, *"blocked on there being a
 * dataset"*, *"blocked on effort"* and four more, none of them a bean. So the
 * id must be **in a code span** and must be **id-shaped**: the store's
 * `id_length` is 4, with the layer prefix optional.
 *
 * ## The `not` escape is LINE-SCOPED, and a wrap defeats it
 *
 * The caller scans `body.split("\n")` one line at a time, so `\s+` in the
 * `not` group can never span a newline. A withdrawal written as
 *
 * ```md
 * ... and as of 2026-09-22 each is **not
 * blocked on `68dt`** because it completed.
 * ```
 *
 * reads correctly to a person and is reported as a live block, because the
 * line the checker sees begins at `blocked on`. Hit while withdrawing the six
 * dead blockers on 2026-09-22 — the fix is to keep `not blocked on \`id\``
 * on ONE line, not to widen the pattern: making it multi-line would also let
 * a `not` three paragraphs up silence a real assertion.
 *
 * The same scoping is why {@link insideQuotation} takes a line rather than
 * the body, and it is deliberate there for the identical reason.
 */
export const BLOCKER = /(not\s+)?blocked\s+on\s+(?:bean\s+)?`((?:[a-z0-9-]+-)?[a-z0-9]{4})`/gi;

/**
 * Is the match inside a quotation on its own line?
 *
 * **A quotation is not an assertion**, and the distinction is not academic:
 * `sfhr` — the bean this check was written for — contains the sentence
 * *"`nvbr` is \"blocked on bean `fsch`\", which is `scrapped`"*. Reporting
 * that as `sfhr`'s own dead blocker would make the check's first finding a
 * misreading of its own specification.
 *
 * Counted rather than pattern-matched: an odd number of unescaped `"` before
 * the match on that line means the match sits inside one.
 *
 * ## SCOPE: the quote mark is the whole signal, and a TABLE CELL is not one
 *
 * `k59d` asked whether this should also read a markdown table cell — *"the
 * guard covers a markdown table cell, or the guard's stated scope says it
 * does not and why — a workaround in one bean is not a fix"*. It does not,
 * and the corpus is what settles it rather than taste.
 *
 * Measured 2026-09-21 over every bean body, for `blocked on \`id\`` on a line
 * beginning `|`. **Two occurrences, and they point opposite ways:**
 *
 * | bean | the cell | what it is |
 * |---|---|---|
 * | `k59d` | `"blocked on \`hqku\`, …"` | yg29's sentence, quoted — already marked, already skipped |
 * | `xgd8` | `blocked on \`slw1\`, see above` | **its own** blocker, asserted in a cell. `slw1` is `todo`, so the block is live |
 *
 * So the only unquoted cell in the store is a genuine self-assertion that
 * must keep being read. **Treating a cell as a quotation would silently
 * exempt exactly it** — and every future one, since a table is where a bean
 * naturally states structured facts about itself.
 *
 * That also means `k59d`'s double-quoting was never a workaround. Quoting
 * text you are quoting is correct English and is precisely the signal this
 * function reads; the finding message below says so, on the one line shape
 * where an author is most likely to leave it off.
 *
 * ## What is deliberately NOT read, and why nothing was built for it
 *
 * A **blockquote** (`> blocked on \`x\``) is unambiguously a quotation in
 * markdown and would be a defensible extension. The store contains **zero**
 * of them, measured the same way, so implementing it would be building for a
 * case that does not exist. Emphasis (`*…*`) is not attribution at all and is
 * not a candidate. If a blockquote form appears later, this is the paragraph
 * that says the gap was known and priced rather than missed.
 */
export function insideQuotation(line: string, at: number): boolean {
  let quotes = 0;
  for (let i = 0; i < at && i < line.length; i++) {
    if (line[i] === '"' && line[i - 1] !== "\\") quotes++;
  }
  return quotes % 2 === 1;
}


/**
 * A bean's canonical checklist, and every checklist item written BELOW it.
 *
 * The `## Done when` section is the bean's answer to "what is left". A
 * checklist item further down is NOT automatically wrong — recording a new
 * open item in a dated entry is this store's ordinary idiom, and 57 of 323
 * beans do it. What is wrong is a later item that **restates a canonical one
 * and ticks it while the canonical stays unticked**.
 *
 * That is the `bbbl` defect in the bean's own words: *"the ticks were
 * appended as a SECOND copy of the checklist at the foot of the file, so the
 * canonical `## Done when` still read 0 of 2 and any reader or tool
 * consulting it saw an untouched bean."*
 */
export interface ChecklistItem {
  done: boolean;
  text: string;
}

export function splitChecklist(body: string): { canonical: ChecklistItem[]; later: ChecklistItem[] } {
  const head = /^##+\s*Done when\s*$/im.exec(body);
  if (!head) return { canonical: [], later: [] };
  const rest = body.slice(head.index + head[0].length);
  const at = sectionEnd(rest);
  return {
    canonical: checklistItems(at === undefined ? rest : rest.slice(0, at)),
    later: at === undefined ? [] : checklistItems(rest.slice(at)),
  };
}

/**
 * Where the canonical section stops — a heading OR a horizontal rule.
 *
 * The rule was missing and it is the dominant separator: measured across the
 * store, **61** beans close their `## Done when` with a `---` before any
 * heading, against 141 that use a heading. Reading only headings folded a
 * later checklist back INTO the canonical section, so a ticked duplicate
 * looked canonical and could never fire — the check was blind to 61 beans
 * while reporting a clean run over them, which is the `dh4f` shape aimed at
 * this checker.
 *
 * Found by using the check on the next task rather than by re-reading it:
 * bean `cvab` has both lists and separates them with `---`, and it was not
 * among the six the first version reported.
 *
 * A table's `|---|` is not a rule and does not match; front matter's `---`
 * is above the body this ever sees.
 */
function sectionEnd(rest: string): number | undefined {
  const heading = /^##+\s+/m.exec(rest);
  const rule = /^---+\s*$/m.exec(rest);
  if (!heading) return rule?.index;
  if (!rule) return heading.index;
  return Math.min(heading.index, rule.index);
}

/** Checklist lines, with an indented continuation folded into its item. */
export function checklistItems(block: string): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  let cur: ChecklistItem | undefined;
  for (const line of block.split("\n")) {
    const m = /^\s*[-*]\s*\[([ xX])\]\s*(.*)$/.exec(line);
    if (m) {
      if (cur) out.push(cur);
      cur = { done: m[1]!.toLowerCase() === "x", text: m[2]! };
    } else if (cur && /^\s{4,}\S/.test(line)) {
      cur.text += ` ${line.trim()}`;
    } else if (cur) {
      out.push(cur);
      cur = undefined;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Words, with markdown emphasis and punctuation removed. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_[\]()]/g, " ")
    .replace(/[^a-z0-9 /:.-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * How much of the shorter item the two share.
 *
 * Containment rather than equality, because the real cases are not verbatim:
 * `fgnw`'s appended copy dropped a parenthetical and `9x17`'s paraphrased
 * ("schema validation as its operation" for "schema validation and profile
 * check as DISTINCT operations"). Both are plainly the same item restated,
 * and an equality test would have called them different and passed.
 */
export function overlap(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

/** Below this, two items are different items. Measured — see the module header. */
export const SHADOW_OVERLAP = 0.75;

/** Shorter than this, an item is too generic for overlap to mean anything. */
export const SHADOW_MIN_WORDS = 6;

/** Every later item that ticks a canonical item the canonical section still shows open. */
export function shadowedItems(body: string): { later: string; canonical: string }[] {
  const { canonical, later } = splitChecklist(body);
  const out: { later: string; canonical: string }[] = [];
  for (const l of later) {
    // An UNTICKED later item is a new open item, which is the legitimate idiom.
    if (!l.done) continue;
    const lw = words(l.text);
    if (lw.length < SHADOW_MIN_WORDS) continue;
    for (const c of canonical) {
      // A canonical item already ticked means the note AGREES with it.
      if (c.done) continue;
      const cw = words(c.text);
      if (cw.length < SHADOW_MIN_WORDS) continue;
      if (overlap(lw, cw) >= SHADOW_OVERLAP) {
        out.push({ later: l.text, canonical: c.text });
        break;
      }
    }
  }
  return out;
}

export interface BeanBodyProblem {
  id: string;
  kind: "empty-body" | "folded-title" | "dead-blocker" | "shadow-checklist";
  detail: string;
}

export interface BeanBodyReport {
  store: boolean;
  examined: number;
  /** Defects NOT in the baseline. These fail. */
  problems: BeanBodyProblem[];
  /** Defects the baseline already records. Listed, never failed. */
  outstanding: BeanBodyProblem[];
  /** Baseline entries nothing matched — repaired, and the baseline can shrink. */
  stale: string[];
  /**
   * CLOSED beans carrying the shadow-checklist shape. Counted, never failed.
   *
   * Bean `sfhr` left it open *"whether the check should also scan closed
   * beans"*, and the question sat undecided because nobody had the number.
   * Measured 2026-09-21, and the shape of the answer is in the dates rather
   * than the count:
   *
   * | | |
   * |---|---|
   * | closed beans with the shape | 30 (75 items), against 3 open |
   * | **archived** beans with it | **0 of 219** — and archived beans are the OLD ones |
   * | last updated 2026-09-20 | **21** |
   * | last updated 2026-09-21 | 9 |
   * | this check shipped (#589) | **2026-09-21** |
   *
   * So it is not sediment and not a trend. It is a ONE-DAY BURST on
   * 2026-09-20 — the 54-merge window bean `vlhk` describes — and the gate
   * shipped the day after, in response to it.
   *
   * **That is why closed beans are not scanned as a failure.** Every bean is
   * open before it is closed, so the open-bean rule already prevents
   * recurrence; extending it backwards would add 75 baseline entries, all
   * belonging to other owners, for work already finished. A completed bean's
   * unticked checklist misleads nobody about what to do next — its `status`
   * says `completed` and dominates.
   *
   * It is COUNTED rather than dropped so *"is it recurring?"* stays answerable
   * every run. A rising number here means the open-bean gate is being evaded;
   * a flat one means the burst is history. A measurement that lives only in a
   * bean is a printed verdict — gone, and unaskable later.
   */
  closedWithShadow: number;
}

/**
 * The defects this store had when the check was written.
 *
 * Same move `check:bean-parents` documents: *"it locks in a property the corpus
 * HAS rather than demanding work to reach one"*. Here the corpus does NOT have
 * the property — eight open beans carry one of the three defects — and `sfhr`
 * is explicit that they are **repaired by their owners**, not by whoever runs
 * this. Failing on them would make the check unrunnable and someone would
 * delete it; hiding them would report a clean sweep over the very beans it was
 * written for.
 *
 * So they are listed, by `<id>:<kind>`, and a **new** one fails. An entry that
 * stops matching is reported as stale so the baseline shrinks as the backlog
 * is worked, rather than fossilising.
 */
export const BASELINE_FILE = "cat-harness-tools/scripts/bean-bodies-baseline.json";

function loadBaseline(root: string): Set<string> {
  const f = resolve(root, BASELINE_FILE);
  if (!existsSync(f)) return new Set();
  const raw = JSON.parse(readFileSync(f, "utf-8")) as { known?: string[] };
  return new Set(raw.known ?? []);
}

/** Resolve a loosely-written id against the store, archive included. */
function lookup(all: BeanFile[], ref: string): BeanFile | undefined {
  return all.find((b) => b.id === ref) ?? all.find((b) => b.id.endsWith(`-${ref}`));
}

/**
 * The closed-bean line: counted, never failed, and never silent.
 *
 * `sfhr` asked whether closed beans should be scanned. They are not — the
 * reasoning is on {@link BeanBodyReport.closedWithShadow} — but "not scanned"
 * and "none there" must not look alike from the report, which is the same
 * three-state rule this repository applies to every other sweep.
 */
function closedNote(r: BeanBodyReport, out: string[]): void {
  if (r.closedWithShadow === 0) return;
  out.push(
    `  ~ ${r.closedWithShadow} CLOSED bean(s) carry the shadow-checklist shape — counted, not failed.`,
  );
  out.push("    Measured 2026-09-21: a one-day burst on 09-20, the day before this check shipped;");
  out.push("    0 of 219 ARCHIVED beans have it. Every bean is open before it is closed, so the");
  out.push("    open-bean rule already prevents recurrence. A RISING number here means it does not.");
}

export function checkBeanBodies(root: string): BeanBodyReport {
  const all = readBeanFiles(root);
  if (all === null) {
    return { store: false, examined: 0, problems: [], outstanding: [], stale: [], closedWithShadow: 0 };
  }
  const open = all.filter((b) => !b.archived && OPEN_STATUSES.has(b.status));
  const found: BeanBodyProblem[] = [];
  const problems = found;

  for (const b of open) {
    if (b.body.trim() === "") {
      problems.push({
        id: b.id,
        kind: "empty-body",
        detail: `\`${b.status}\` with front matter and nothing else — a sibling reading the store learns nothing about it`,
      });
    }
    if (isFoldedTitle(b.frontMatter)) {
      problems.push({
        id: b.id,
        kind: "folded-title",
        detail: "`title:` is a YAML block scalar, so it continues into the body and takes whatever followed it (this is how `52dz` lost three Done-when boxes)",
      });
    }
    for (const sh of shadowedItems(b.body)) {
      problems.push({
        id: b.id,
        kind: "shadow-checklist",
        detail:
          `a checklist item below \`## Done when\` is ticked — "${sh.later.slice(0, 60)}" — ` +
          `while the canonical item it restates is still open: "${sh.canonical.slice(0, 60)}". ` +
          `The section a reader and every tool consult says this is not done`,
      });
    }
    for (const line of b.body.split("\n")) {
      for (const m of line.matchAll(BLOCKER)) {
      // "NOT blocked on x" asserts the opposite; `1lfx` says exactly that.
      if (m[1]) continue;
      if (insideQuotation(line, m.index ?? 0)) continue;
      const ref = m[2]!;
      const target = lookup(all, ref);
      // A TABLE ROW is the one line shape where an author is likely to have
      // MEANT a quotation and left the marks off — the evidence a bean of
      // this kind carries is a table of "what it says" against "what the
      // store says". The rule does not bend for it (see `insideQuotation`:
      // the only unquoted cell in the store is a real self-assertion), so the
      // message teaches the marking instead of the checker guessing at it.
      const hint = line.trimStart().startsWith("|")
        ? ". This is a table cell — if it quotes another bean, put the cell's " +
          "text in double quotes and this check will read it as a quotation"
        : "";
      if (!target) {
        problems.push({ id: b.id, kind: "dead-blocker", detail: `"blocked on \`${ref}\`" — no such bean in the store or its archive${hint}` });
      } else if (CLOSED_STATUSES.has(target.status)) {
        problems.push({
          id: b.id,
          kind: "dead-blocker",
          detail: `"blocked on \`${ref}\`" — that bean is \`${target.status}\`, so the block can never lift on its own${hint}`,
        });
      }
      }
    }
  }
  const baseline = loadBaseline(root);
  const key = (p: BeanBodyProblem) => `${p.id}:${p.kind}`;
  const matched = new Set(found.map(key).filter((k) => baseline.has(k)));
  return {
    store: true,
    examined: open.length,
    problems: found.filter((p) => !baseline.has(key(p))),
    outstanding: found.filter((p) => baseline.has(key(p))),
    stale: [...baseline].filter((k) => !matched.has(k)).sort(),
    // Counted over the beans this check does NOT scan — see the field's docs.
    closedWithShadow: all.filter(
      (b) => !(!b.archived && OPEN_STATUSES.has(b.status)) && shadowedItems(b.body).length > 0,
    ).length,
  };
}

function formatReport(r: BeanBodyReport): string {
  if (!r.store) return "Bean bodies\n  · no bean store — nothing to check";
  const out = [`Bean bodies (${r.examined} open, ${r.outstanding.length} baselined)`];
  closedNote(r, out);
  if (r.problems.length === 0) {
    out.push("  ✓ no NEW defect — every open bean has a body, a one-line title, and no blocker on a closed bean");
  }
  for (const p of r.problems) out.push(`  ✗ ${p.id} [${p.kind}]: ${p.detail}`);
  for (const p of r.outstanding) out.push(`  · outstanding ${p.id} [${p.kind}]: ${p.detail}`);
  for (const k of r.stale) out.push(`  · baseline entry ${k} no longer matches — repaired; remove it from ${BASELINE_FILE}`);
  out.push("");
  out.push("  Outstanding defects are repaired by the bean's OWNER, not by this check and not by whoever ran it.");
  out.push("  A blocker that can never lift is withdrawn with its reason — see work-plan/skills/work-plan/bean-blocking.md.");
  return out.join("\n");
}

if (import.meta.main) {
  let report: BeanBodyReport;
  try {
    // The REPOSITORY root, not the cwd: `beans/` is repository-scoped, and a
    // run from anywhere else reads "no store" — a clean-looking answer to a
    // question asked in the wrong place.
    report = checkBeanBodies(repoRootFor(HARNESS_ROOT));
  } catch (e) {
    exitIfBeanStoreAbsent("check:bean-bodies", e);
    console.error(`Could not check bean bodies: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.problems.length ? 1 : 0);
}
