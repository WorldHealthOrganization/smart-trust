/**
 * `qa-criterion-source-file` tests whose subject is folio-assistant-sci's
 * contribution — the checkers this layer contributes for criteria declared
 * `checker_contributed` — moved here from
 * `cat-harness/scripts/tests/qa-criterion-source-file.test.ts` (bean `ho66`).
 * The code under test is cat-harness's, imported DOWN; what it is held against
 * is this layer's, so standing alone cat-harness has nothing for these to
 * read. The rest of that file's tests stay there.
 *
 * Then moved up again, to the aggregate's `test/` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): it walks EVERY layer in the checkout
 * and the repository root's dependency tree, which also carries the `dak-*`
 * checkers smart-base contributes, so standing alone folio-assistant-sci has
 * neither (`seed:ready --layer folio-assistant-sci --rehearse`, 2026-10-07).
 */
import { describe, test, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";

import { QA_CRITERIA_REGISTRY } from "../../pipeline/qa-criteria-registry.ts";
import { checkerFunctionName } from "../../pipeline/qa-checker-discovery.ts";
import {
  isCriterionSourceMiss,
  resolveCriterionSource,
} from "../../pipeline/criterion-source.ts";
import { layerRootsIn } from "../../schemas/kg/cat-harness.ts";
import { loadContributions } from "../../schemas/kg/harness-config.ts";
import {
  ContributionRegistry,
  type FolioContribution,
} from "../../schemas/content/contributions.ts";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = resolve(ORIGIN_DIR, "../..");
const REPO = resolve(ROOT, "..");
const CHECKER_DIR = "pipeline";

/**
 * The dependency tree, so a CONTRIBUTED checker is found where it lives.
 *
 * Criteria declaring `checker_contributed` have their checkers in another
 * layer: `proof-compile-cost` and `proof-no-cost-regression` in
 * `folio-assistant-sci`, the five `dak-*` in `smart-base` (bean `1335`). Without
 * this the test would report them as having no checker anywhere — which is
 * what it says a defect looks like, so it would fail loudly rather than pass
 * vacuously, but for the wrong reason.
 */
const registry = await loadContributions<FolioContribution, ContributionRegistry>(
  REPO,
  new ContributionRegistry(),
);

/**
 * Every `qa-checkers-*.ts` in EVERY layer, discovered rather than listed.
 *
 * Globbing one directory was the previous version, and it stopped being
 * enough the moment a checker moved into another layer. Widening it to a
 * second hardcoded directory would reproduce the exact defect this test's own
 * header describes — an allow-list that falls through silently — so the
 * layer list comes from the declarations, and a checker file added in a
 * future contributor is covered without anyone remembering.
 *
 * Keys are the same labels `resolveCriterionSource` produces: bare and
 * repo-relative for core's own, `<contributor>/<path>` for a contributed one.
 */
function checkerFiles(): Array<{ label: string; abs: string }> {
  const out: Array<{ label: string; abs: string }> = [];
  for (const instance of layerRootsIn(REPO)) {
    const dir = resolve(instance, CHECKER_DIR);
    if (!existsSync(dir)) continue;
    const name = instance.split("/").pop() ?? "";
    for (const f of readdirSync(dir).filter((x) => /^qa-checkers-.*\.ts$/.test(x))) {
      const rel = `${CHECKER_DIR}/${f}`;
      out.push({
        label: instance === ROOT ? rel : `${name}/${rel}`,
        abs: resolve(dir, f),
      });
    }
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}

const checkerFileList = checkerFiles();
const sources = new Map<string, string>(
  checkerFileList.map((f) => [f.label, readFileSync(f.abs, "utf-8")]),
);

// The name convention is `qa-checker-discovery`'s, not this test's: discovery
// RESOLVES checkers by it at runtime, so a second copy here could drift and
// the drift would read as a passing test over a sweep that finds nothing.
const checkerFnName = checkerFunctionName;

/**
 * Files that contain `id`'s checker, by either dispatch style. Returns []
 * when none does — a real third state, reported rather than treated as
 * agreement.
 */
function hostFiles(id: string): string[] {
  return hostEntries(id).map((h) => h.label);
}

/** As {@link hostFiles}, with each host's absolute path. */
function hostEntries(id: string): Array<{ label: string; abs: string }> {
  const fn = checkerFnName(id);
  const out: Array<{ label: string; abs: string }> = [];
  for (const f of checkerFileList) {
    const s = sources.get(f.label) ?? "";
    if (s.includes(`"${id}":`) || s.includes(`export function ${fn}(`)) out.push(f);
  }
  return out;
}

const automated = QA_CRITERIA_REGISTRY.filter((d) => d.automated);

describe("getCriterionSourceFile — declared source must host the checker", () => {
  test("the glob finds the checker files", () => {
    // Guards the guard. A renamed directory would otherwise leave every
    // criterion "undetermined" and let this suite pass on an empty set —
    // exactly how the hard-coded list hid three mismatches.
    expect(sources.size).toBeGreaterThanOrEqual(10);
  });

  test("every locatable automated criterion is hashed against its own file", () => {
    const mismatched: string[] = [];
    for (const def of automated) {
      // Asked through the ONE resolver the sweep uses, so this test cannot
      // agree with a path production does not take.
      const located = resolveCriterionSource(def.id, ROOT, registry);
      if (isCriterionSourceMiss(located)) {
        mismatched.push(`${def.id}: ${located.reason}`);
        continue;
      }
      // Compared by the file the resolver READS — its `root` joined to its
      // `sourceFile` — not by label: a core criterion's label stays the path
      // as declared while its bytes are read from the implementing layer
      // (owner ruling T7, bean `70lx`), so a label match would need this test
      // to know which layer implements core's checkers.
      const declared = located.label;
      const declaredAbs = resolve(located.root, located.sourceFile);
      const hosts = hostEntries(def.id);
      if (hosts.length === 0) continue; // reported separately below
      if (!hosts.some((h) => h.abs === declaredAbs)) {
        mismatched.push(`${def.id}: declared ${declared}, found in ${hosts.map((h) => h.label).join(", ")}`);
      }
    }
    // Named in the failure so a fix does not need a re-run to find them.
    expect(mismatched).toEqual([]);
  });

  test("an automated criterion with NO checker anywhere is a defect, not a pass", () => {
    // `qa-sweep` resolves `AUTOMATED_CHECKERS[id] ?? DAK_AUTOMATED_CHECKERS[id]`
    // and falls through to `needs-agent` when undefined. So `automated: true`
    // with no checker silently bills an agent adjudication for a check nobody
    // wrote, and is indistinguishable downstream from `automated: false`.
    //
    // `proof-no-placeholder-stub` was in exactly that state and is now
    // declared `automated: false`, which is what the runtime already did.
    const orphans = automated.filter((d) => hostFiles(d.id).length === 0);
    expect(orphans.map((d) => d.id)).toEqual([]);
  });
});

describe("a contributed checker cannot fall through to the default", () => {

  test("and the resolver answers for exactly those, from the contributor", () => {
    for (const def of QA_CRITERIA_REGISTRY.filter((d) => d.checker_contributed)) {
      const located = resolveCriterionSource(def.id, ROOT, registry);
      expect(isCriterionSourceMiss(located)).toBe(false);
      const src = located as { root: string; label: string };
      // Not this layer: that is what "contributed" has to mean, or the flag
      // is decoration and the move never happened.
      expect(src.root).not.toBe(ROOT);
      // Labelled `<contributor>/<path>` by the contributor that supplied it —
      // folio-assistant-sci for the cost checkers, smart-base for the DAK ones
      // since bean 1335.
      const who = registry.contributedQaCheckers().find((c) => c.criterion === def.id)?.contributor;
      expect(who).toBeDefined();
      expect(src.label.startsWith(`${who}/`)).toBe(true);
    }
  });
});
