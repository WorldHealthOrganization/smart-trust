/**
 * `xd1g` — the two-sided control, one case per converted scanner.
 *
 * ## Why this file exists rather than a new gate
 *
 * The obvious guard is a check that finds root-rooted walks and demands they
 * ask git. I built it and it failed its own falsifier, so it is not in the
 * repository: a filter of "binds a root constant AND enumerates" found **62**
 * scanners, most of them correctly reading one declared directory, while a
 * filter of "enumeration SEEDED at a root constant" found **4** and missed
 * eleven of the twelve — they seed a recursion helper or take the root as a
 * PARAMETER. There is no middle setting, because the shapes are not
 * syntactically distinguishable. Shipping it advisory-anyway would be the
 * `1xhc` gate-that-cannot-fail this repository has argued against.
 *
 * So the guard is behavioural and lives with the conversions. A scanner that
 * regresses to a bare walk fails its own case here.
 *
 * ## Both directions, always
 *
 * NARROWING is the point — git ignores what the walk swept. LOSING is the
 * risk, and the count falls either way, so a one-sided test would call a
 * conversion that dropped real files a success. Every case asserts:
 *
 *   1. nothing the new corpus admits was absent from the old  (lost nothing)
 *   2. everything the old admitted and the new does not IS gitignored (and
 *      not laid down by a remote mount, which the corpus holds)
 *
 * The second is what makes the first non-vacuous: a `keep` that returned
 * `false` for everything would satisfy (1) and fail (2).
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { gitCorpus, gitFiles } from "../../schemas/sdlc/git-corpus.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const ROOT = resolve(dirname(HARNESS_ROOT));
const rel = (p: string, root = ROOT): string => relative(root, p).split(sep).join("/");
const noDot = (r: string): boolean => !r.split("/").some((s) => s.startsWith("."));

/**
 * The checkout's corpus, as `gitCorpus` gives it: tracked and untracked files
 * git does not ignore, PLUS the files a remote mount laid down. In the index
 * checkout every layer is such a mount — ignored by the index's own git,
 * yet part of the corpus — so `git check-ignore` called every one of them
 * ignored and the discriminating control below found nothing swept-but-held.
 */
let corpus: Set<string> | undefined;

/** Is this repo-relative path one the corpus leaves out — gitignored, and not mounted? */
function ignored(p: string): boolean {
  corpus ??= new Set((gitCorpus(ROOT) ?? []).map((f) => rel(f)));
  if (corpus.has(p)) return false;
  return spawnSync("git", ["check-ignore", "-q", p], { cwd: ROOT }).status === 0;
}

/** The walk each scanner used BEFORE conversion, parameterised by its skip set and predicate. */
function bareWalk(
  root: string,
  skipDir: (name: string) => boolean,
  keepFile: (name: string) => boolean,
): string[] {
  const out: string[] = [];
  const go = (dir: string): void => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skipDir(e.name)) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) go(p);
      else if (keepFile(e.name)) out.push(p);
    }
  };
  go(root);
  return out.map((p) => rel(p, root)).sort();
}

function control(
  before: string[],
  after: string[],
  root = ROOT,
): { lost: string[]; sweptButTracked: string[]; swept: number } {
  const lost = after.filter((p) => !before.includes(p));
  const swept = before.filter((p) => !after.includes(p));
  const base = root === ROOT ? "" : `${rel(root)}/`;
  return { lost, sweptButTracked: swept.filter((p) => !ignored(`${base}${p}`)), swept: swept.length };
}

const ts = (n: string): boolean => n.endsWith(".ts");
const dotDir = (n: string): boolean => n.startsWith(".") || n === "node_modules";

describe("every converted scanner narrowed to git's corpus and lost nothing", () => {
  test("check-code-accounting / typescriptFiles", () => {
    // In a container that has run a build, this drops
    // `cat-harness/schemas/block-qa-schema/dist/index.d.ts` — gitignored output
    // being counted by the check whose subject is accounting for code.
    //
    // THERE IS NO `swept > 0` ASSERTION, and its absence is the point. The
    // first version had one, it passed here, and it FAILED IN CI — a clean
    // checkout has no `dist/`, so there is nothing to sweep. That assertion
    // was a property of my machine rather than of the code, which is exactly
    // the defect this whole bean is about, committed while fixing it.
    // Reproduced by moving `dist/` aside: 5 pass, 1 fail, the same case.
    //
    // What is machine-independent is the PAIR below — nothing lost, and
    // anything swept is gitignored — and they hold on a clean checkout where
    // both sets are equal. The discrimination lives in the final `describe`,
    // which compares against the empty set and so needs no residue to exist.
    const before = bareWalk(ROOT, dotDir, ts);
    const after = gitFiles(ROOT, (r) => r.endsWith(".ts") && noDot(r)).files.map((p) => rel(p));
    const c = control(before, after);
    expect(c.lost).toEqual([]);
    expect(c.sweptButTracked).toEqual([]);
  });

  test("bpmnFiles — lane-documentation, process-documentation, glossary-export", () => {
    // One predicate, three scanners that each had their own copy of it.
    const before = bareWalk(ROOT, dotDir, (n) => n.endsWith(".bpmn"));
    const after = gitFiles(ROOT, (r) => r.endsWith(".bpmn") && noDot(r)).files.map((p) => rel(p));
    const c = control(before, after);
    expect(c.lost).toEqual([]);
    expect(c.sweptButTracked).toEqual([]);
    expect(before.length).toBeGreaterThan(0);
  });

  test("ns-export / minted-term scan", () => {
    const before = bareWalk(ROOT, dotDir, (n) => ts(n) && !n.endsWith(".test.ts"));
    const after = gitFiles(
      ROOT,
      (r) => r.endsWith(".ts") && !r.endsWith(".test.ts") && noDot(r),
    ).files.map((p) => rel(p));
    const c = control(before, after);
    expect(c.lost).toEqual([]);
    expect(c.sweptButTracked).toEqual([]);
  });

  test("check-viewer-backticks / viewerSources", () => {
    const before = bareWalk(ROOT, dotDir, (n) => ts(n) && !n.endsWith(".test.ts") && !n.endsWith(".e2e.ts"));
    const after = gitFiles(
      ROOT,
      (r) => r.endsWith(".ts") && !r.endsWith(".test.ts") && !r.endsWith(".e2e.ts") && noDot(r),
    ).files.map((p) => rel(p));
    const c = control(before, after);
    expect(c.lost).toEqual([]);
    expect(c.sweptButTracked).toEqual([]);
  });

  test("audit-coverage / census, over a declared directory", () => {
    // The scanner the standing *"never run audit:coverage in this container"*
    // warning names — and over a DECLARED directory it changes nothing, which
    // is the honest result. `census` is never called on a root, so the
    // dramatic root-level figure (31437 -> 14135) is what the old SHAPE would
    // have cost, not what this scanner was doing.
    const dir = join(ROOT, "cat-harness", "skills");
    const before = bareWalk(dir, (n) => n.startsWith("."), () => true);
    const after = gitFiles(dir, noDot).files.map((p) => rel(p, dir));
    const c = control(before, after, dir);
    expect(c.lost).toEqual([]);
    expect(c.sweptButTracked).toEqual([]);
    expect(before.length).toBeGreaterThan(100);
  });
});

describe("the control itself is discriminating", () => {
  test("a `keep` that admits nothing FAILS the swept-are-ignored half", () => {
    // Without this, every case above is satisfiable by a conversion that
    // returned the empty set — the exact failure a one-sided "the count went
    // down" check cannot see.
    const before = bareWalk(ROOT, dotDir, (n) => n.endsWith(".bpmn"));
    const c = control(before, []);
    expect(c.sweptButTracked.length).toBeGreaterThan(0);
  });
});
