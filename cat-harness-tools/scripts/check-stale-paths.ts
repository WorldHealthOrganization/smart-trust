#!/usr/bin/env bun
/**
 * A bean's stated PATH must not route through work that is already finished.
 *
 * ```sh
 * bun run cat check:stale-paths
 * bun run cat check:stale-paths --json
 * ```
 *
 * `check:bean-bodies` reports a prose ``blocked on `id` `` whose target is
 * closed; this checks the **routes** milestones write instead, e.g.
 * `` `a` → `b` → (`c` ‖ `d`) → `e` ``.
 *
 * | rule | shape |
 * |---|---|
 * | **chain** | an id **adjacent to an arrow** (`→` or `->`), in an open bean, whose status is closed |
 * | **numbered step** | a numbered list item under a heading naming a path/order/sequence |
 * | **done-when** | an **unchecked** `- [ ]` clause naming a closed bean as a **precondition** |
 *
 * False positives excluded:
 * - an arrow that is not a dependency (*"97 → 66 lines"*): the closed id must
 *   be **an operand of the arrow**, not merely on the same line
 *   ({@link chainRefs});
 * - a bean quoting another bean's path: a known bean id before the chain,
 *   outside it, attributes the path to that bean ({@link attributedTo}).
 *
 * Not claimed: it does not distinguish "waits on `x`" from "unblocks `x`"
 * outside these rules. Prose that merely mentions a closed bean is not
 * examined (neither reported nor counted clean).
 *
 * @module folio-assistant/scripts/check-stale-paths
 * @covers bean-defs, beans
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { CLOSED_STATUSES, OPEN_STATUSES, readBeanFiles, type BeanFile } from "./bean-store-read.ts";
import { exitIfBeanStoreAbsent } from "./lib/bean-store-absent.ts";

const REPO_ROOT = resolve(import.meta.dir, "../..");

/** Either arrow spelling the corpus uses. */
const ARROW = /→|->/;
/** A bean id as it is written in a body: four lowercase alphanumerics, in a code span. */
const REF = /`([a-z0-9]{4})`/g;

/**
 * A bean, as the shared store reader returns it.
 *
 * `readBeanFiles` resolves `beans/defs/` FROM THE DECLARATION rather than from
 * a literal, which is why this file no longer carries one — `check:declared-paths`
 * refused the first draft's `join(root, "beans", "defs")` and was right to.
 */
export type Bean = BeanFile;

export interface StalePath {
  /** The open bean whose path is stale. */
  id: string;
  /** The closed beans its path routes through. */
  through: { id: string; status: string }[];
  rule: "chain" | "numbered-step" | "done-when";
  line: string;
}

export interface StalePathReport {
  examined: number;
  /** Not in the baseline. These FAIL. */
  findings: StalePath[];
  /** Already recorded, repaired by the milestone's owner. Listed, never failed. */
  outstanding: StalePath[];
  /** Baseline entries nothing matched — repaired, so the file can shrink. */
  stale: string[];
}

/**
 * Stale paths already known, repaired BY THEIR OWNER.
 *
 * A milestone is a statement of what its owner believes the goal needs next,
 * and rewriting somebody else's belief is not a checker's to do. Same shape and
 * the same reasons as `bean-bodies-baseline.json`, including the property that
 * makes it shrink: an entry nothing matched is REPORTED, so a repaired
 * milestone takes its line out instead of leaving the file to grow forever.
 *
 * Keyed `<bean>:<rule>` rather than by line, because the line is the thing that
 * gets edited: keying on it would make every rewording look like a new defect.
 */
export const BASELINE_FILE = "cat-harness-tools/scripts/stale-paths-baseline.json";

/** Missing or unparseable is an EMPTY baseline — every finding fails, which is the safe direction. */
export function readBaseline(root: string): Set<string> {
  try {
    const raw = JSON.parse(readFileSync(join(root, BASELINE_FILE), "utf8")) as { known?: unknown };
    return new Set(Array.isArray(raw.known) ? raw.known.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set<string>();
  }
}

/**
 * Ids that are OPERANDS of an arrow on this line.
 *
 * "Adjacent to an arrow" rather than "present on a line containing an arrow",
 * because the second reported `x3bd`, whose arrow is a line count. Only a
 * token that sits immediately either side of an arrow is a step in a route.
 */
export function chainRefs(line: string): string[] {
  const parts = line.split(ARROW);
  if (parts.length < 2) return [];
  const out = new Set<string>();
  for (const part of parts) {
    // A STEP is a segment between arrows that is JUST ids -- optionally with a
    // route's own punctuation, `(`a` ‖ `b` + `c`)` being the shape `p5wm`
    // uses for parallel work. Anything with prose in it is a sentence that
    // happens to contain an arrow.
    //
    // The first draft took "the first id after the arrow", and its doc comment
    // claimed adjacency it did not implement: it accepted
    // "97 -> 66 lines, and bean `2krx` carries the reason", where the id is a
    // whole clause away. Its own guard test caught that.
    const refs = [...part.matchAll(REF)].map((m) => m[1]!);
    if (refs.length === 0) continue;
    const residue = part.replace(REF, "").replace(/[()[\]{}‖|+,&*\s]/g, "");
    if (residue !== "") continue;
    for (const r of refs) out.add(r);
  }
  return [...out];
}

/**
 * The bean this line's path belongs to, when it is not the bean we are reading.
 *
 * A known id appearing BEFORE the route, and not part of it, is an
 * attribution: `` | `p5wm` (GOAL 2) | critical path `b5f0` → … `` is `p5wm`'s
 * path quoted inside another bean. Returns that id, or `undefined` when the
 * line states the reading bean's own path.
 */
export function attributedTo(line: string, chain: string[], known: Set<string>): string | undefined {
  // A TABLE ROW is attributed by its first cell. This is the stronger signal
  // and it is checked first, because a quoted chain often sits inside ONE code
  // span -- `` `a -> b -> c` `` rather than `` `a` `` -> `` `b` `` -- which
  // leaves the backticks unpaired for the scan below and lets the subject be
  // mistaken for a step. `k59d` quotes `p5wm` exactly that way, and that is how
  // this check first reported its own bean.
  if (line.trimStart().startsWith("|")) {
    const firstCell = line.trimStart().slice(1).split("|")[0] ?? "";
    for (const m of firstCell.matchAll(REF)) if (known.has(m[1]!)) return m[1]!;
  }
  const first = line.search(ARROW);
  if (first < 0) return undefined;
  const chainSet = new Set(chain);
  for (const m of line.slice(0, first).matchAll(REF)) {
    const id = m[1]!;
    if (known.has(id) && !chainSet.has(id)) return id;
  }
  return undefined;
}

/** Is this line a numbered step under a heading that names a path? */
export function underPathHeading(lines: string[], i: number): boolean {
  if (!/^\s*\d+\.\s/.test(lines[i]!)) return false;
  for (let j = i; j >= 0; j--) {
    const l = lines[j]!;
    if (l.startsWith("#")) return /path|order|sequence/i.test(l);
  }
  return false;
}

/** Open beans whose stated path routes through finished work. */
/**
 * The four-character suffix a bean body actually cites.
 *
 * The store reader returns a FULL id (`folio-assistant-p5wm`); a body writes
 * `` `p5wm` ``. Indexing on both is what makes the two meet, and getting this
 * wrong is silent: every lookup misses, no finding is produced, and the check
 * reports a clean run over a store it read perfectly well.
 */
export function shortId(id: string): string {
  return id.slice(id.lastIndexOf("-") + 1);
}

/**
 * Words that put a reference in a PRECONDITION position — "once `x` is
 * settled", "until `x` lands", "blocked on `x`".
 *
 * `(?![-\w])` on every one of them, and it is not defensive typing: **every**
 * bean carries the literal heading "Done when" and most write "Done-when" in
 * prose. Without the guard, `when` inside "Done-when" matched — and so did
 * `done`, through the POST form — which put TWO false findings in the first
 * measurement of this rule. Both looked plausible enough to ship.
 */
const DONE_WHEN_PRE =
  String.raw`(?<![-\w])(?:once|until|after|when|blocked on|waits on|depends on|pending)(?![-\w])[^`+"`"+String.raw`]{0,40}`;
/** ...and the mirror: "`x` is settled", "`x` fixed" — the reference first, its completion after. */
const DONE_WHEN_POST =
  String.raw`(?:'s)?\s+(?:is\s+)?(?:fixed|closes|closed|lands|landed|settled|answered|merged|done|exists|ships|shipped)(?![-\w])`;

/**
 * Is `ref` asserted, in this clause, as something still to come?
 *
 * The distinction the whole rule turns on. A Done-when clause naming a closed
 * bean is stale only when it treats that bean as a PRECONDITION; a clause that
 * acts ON one is correct prose. Measured over the store: 16 unchecked clauses
 * name a closed bean, and **3** assert it as a precondition. The other 13 say
 * things like *"`1hvo` and `7u3g` are re-read under that distinction"* — an
 * instruction to go and read two finished beans, which is not a stale blocker
 * by any reading.
 */
export function assertsPending(clause: string, ref: string): boolean {
  const q = "`" + ref + "`";
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  return (
    new RegExp(DONE_WHEN_PRE + esc, "i").test(clause) ||
    new RegExp(esc + DONE_WHEN_POST, "i").test(clause)
  );
}

/**
 * An unchecked Done-when clause starting at `i`, with its wrapped continuation.
 *
 * The clause ENDS at the next box, a blank line, a heading, or any line that
 * dedents to the bullet's own column. Reading a fixed window instead — three
 * lines, in the first draft — let one box borrow the next box's "once", which
 * is how `zkgs` and `q2wn` were both reported against clauses that do not
 * mention them as preconditions at all.
 */
export function doneWhenClause(lines: string[], i: number): string | undefined {
  const line = lines[i]!;
  const m = /^(\s*)[-*]\s+\[ \]/.exec(line);
  if (m === null) return undefined; // checked boxes are not claims about what remains
  const indent = m[1]!.length;
  const buf = [line.trim()];
  for (const next of lines.slice(i + 1)) {
    if (next.trim() === "" || /^\s*[-*]\s+\[/.test(next) || next.startsWith("#")) break;
    if (next.length - next.trimStart().length <= indent) break;
    buf.push(next.trim());
  }
  return buf.join(" ");
}

export function stalePaths(beans: Bean[]): StalePath[] {
  const byId = new Map<string, Bean>();
  for (const b of beans) {
    byId.set(b.id, b);
    byId.set(shortId(b.id), b);
  }
  const known = new Set(byId.keys());
  const closed = (id: string) => {
    const b = byId.get(id);
    return b && CLOSED_STATUSES.has(b.status) ? b : undefined;
  };

  const out: StalePath[] = [];
  for (const b of beans) {
    if (!OPEN_STATUSES.has(b.status)) continue;
    const lines = b.body.split("\n");
    for (const [i, line] of lines.entries()) {
      const chain = chainRefs(line);
      if (chain.length > 0) {
        // Whose path is this? A quoted one belongs to its owner, not to us.
        if (attributedTo(line, chain, known) === undefined) {
          const through = chain
            .map(closed)
            .filter((x): x is Bean => x !== undefined)
            .map((x) => ({ id: shortId(x.id), status: x.status }));
          if (through.length > 0) out.push({ id: shortId(b.id), through, rule: "chain", line: line.trim() });
        }
        continue;
      }
      if (underPathHeading(lines, i)) {
        const through = [...line.matchAll(REF)]
          .map((m) => closed(m[1]!))
          .filter((x): x is Bean => x !== undefined)
          .map((x) => ({ id: shortId(x.id), status: x.status }));
        if (through.length > 0) {
          out.push({ id: shortId(b.id), through, rule: "numbered-step", line: line.trim() });
        }
        continue;
      }
      // NOT `if (!underPathHeading) continue` — that guard sat here and made
      // everything below it unreachable, so the done-when rule ran on no line
      // at all and the check printed ✓. It was caught only because the rule had
      // been measured independently first and was expected to report 3.
      // An UNCHECKED Done-when box is structurally a claim about what remains,
      // which is why it can be read at all where free prose cannot.
      const clause = doneWhenClause(lines, i);
      if (clause === undefined) continue;
      const pending = [...new Set([...clause.matchAll(REF)].map((r) => r[1]!))]
        .filter((r) => assertsPending(clause, r))
        .map(closed)
        .filter((x): x is Bean => x !== undefined)
        .map((x) => ({ id: shortId(x.id), status: x.status }));
      if (pending.length > 0) {
        out.push({ id: shortId(b.id), through: pending, rule: "done-when", line: clause });
      }
    }
  }
  return out;
}

export function checkStalePaths(root = REPO_ROOT): StalePathReport {
  const beans = readBeanFiles(root);
  // `null` means the declaration did not resolve. That is UNKNOWN, not clean,
  // so it throws rather than reporting zero findings over a store it never read.
  if (beans === null) throw new Error("could not resolve the bean store from the declaration");
  const all = stalePaths(beans);
  const baseline = readBaseline(root);
  const key = (f: StalePath) => `${f.id}:${f.rule}`;
  const matched = new Set(all.map(key).filter((k) => baseline.has(k)));
  return {
    examined: beans.filter((b) => OPEN_STATUSES.has(b.status)).length,
    findings: all.filter((f) => !baseline.has(key(f))),
    outstanding: all.filter((f) => baseline.has(key(f))),
    stale: [...baseline].filter((k) => !matched.has(k)).sort(),
  };
}

function formatReport(r: StalePathReport): string {
  if (r.examined === 0) {
    return "Stale paths\n  ? EXAMINED NOTHING — no open beans were read. Not a pass.";
  }
  const out = [`Stale paths (${r.examined} open bean(s), ${r.outstanding.length} baselined)`];
  const show = (f: StalePath, mark: string) => {
    const via = f.through.map((t) => `\`${t.id}\` (${t.status})`).join(", ");
    out.push(`  ${mark} ${f.id} [${f.rule}]: its path routes through ${via}`);
    out.push(`      ${f.line.length > 130 ? `${f.line.slice(0, 130)}…` : f.line}`);
  };
  if (r.findings.length === 0 && r.stale.length === 0) {
    out.push("  ✓ no NEW stale path — no open bean routes its stated path through finished work");
  }
  for (const f of r.findings) show(f, "✗");
  for (const f of r.outstanding) show(f, "·");
  for (const k of r.stale) {
    out.push(`  · baseline entry "${k}" no longer matches — repaired; remove it from ${BASELINE_FILE}`);
  }
  if (r.findings.length === 0 && r.stale.length === 0 && r.outstanding.length === 0) return out.join("\n");
  if (r.findings.length === 0) return out.join("\n");
  out.push("");
  out.push("  A path through finished work reads to the next agent as work still to do.");
  out.push("  Repaired by the bean's OWNER — see work-plan/skills/work-plan/bean-blocking.md.");
  out.push("  Prose that merely MENTIONS a closed bean is not examined and is not a pass;");
  out.push("  only an arrow chain, a numbered step under a path heading, and an UNCHECKED");
  out.push("  Done-when clause that names one as a PRECONDITION are read.");
  return out.join("\n");
}

if (import.meta.main) {
  let report: StalePathReport;
  try {
    report = checkStalePaths();
  } catch (e) {
    exitIfBeanStoreAbsent("check:stale-paths", e);
    console.error(`Could not check stale paths: ${e instanceof Error ? e.message : e}`);
    console.error("This is NOT a pass. Treat it as unknown.");
    process.exit(2);
  }
  console.log(process.argv.includes("--json") ? JSON.stringify(report, null, 2) : formatReport(report));
  process.exit(report.findings.length > 0 || report.examined === 0 ? 1 : 0);
}
