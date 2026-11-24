/**
 * Discovery must resolve exactly what the old dispatch tables resolved, and
 * must report the two ways the registry and the checker files can disagree.
 *
 * The equivalence test is the load-bearing one: replacing a hardcoded table
 * with a lookup is only safe if the lookup finds the same functions, and
 * "finds a function with the right name" is not the same claim as "finds the
 * same function object".
 *
 * @module scripts/tests/qa-checker-discovery.test
 *
 * The tests here whose subject is folio-assistant-sci's contribution (the
 * checkers this layer contributes for criteria declared
 * `checker_contributed`) live in
 * the checkout's `test/qa-checker-discovery-sci-checkout.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such contribution to read.
 */
import { describe, test, expect } from "bun:test";

import {
  checkerFunctionName,
  criterionSubject,
  discoverBlockCheckers,
  discoverScriptCheckers,
  readModule,
} from "../../pipeline/qa-checker-discovery.ts";
import { QA_CRITERIA_REGISTRY } from "../../pipeline/qa-criteria-registry.ts";
import { resolveCriterionSource } from "../../pipeline/criterion-source.ts";
import { loadContributions } from "../../schemas/kg/harness-config.ts";
import { ContributionRegistry, type FolioContribution } from "../../schemas/content/contributions.ts";
import { pathToFileURL } from "node:url";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

/**
 * The dependency tree, loaded exactly as `qa-sweep` loads it.
 *
 * Not optional decoration: two criteria (`proof-compile-cost`,
 * `proof-no-cost-regression`) declare `checker_contributed`, so their checkers
 * come from `folio-assistant-sci` and are absent without this. A test that
 * dropped it would still pass its shape checks while measuring a discovery run
 * two criteria short.
 */
const REPO = pathToFileURL(dirname(HARNESS_ROOT) + "/").pathname;
const CORE = pathToFileURL(HARNESS_ROOT + "/").pathname.replace(/\/$/, "");
const registry = await loadContributions<FolioContribution, ContributionRegistry>(
  REPO,
  new ContributionRegistry(),
);

const block = await discoverBlockCheckers(registry);
const script = await discoverScriptCheckers(registry);

describe("checkerFunctionName", () => {
  test("kebab-case ids", () => {
    expect(checkerFunctionName("dak-bpmn-has-process")).toBe("checkDakBpmnHasProcess");
  });

  test("snake_case ids — the script axis uses them", () => {
    expect(checkerFunctionName("does_not_default_to_float")).toBe("checkDoesNotDefaultToFloat");
  });

  test("a single word", () => {
    expect(checkerFunctionName("deprecated")).toBe("checkDeprecated");
  });
});

describe("subject partition", () => {
  test("absent means block", () => {
    expect(criterionSubject({ id: "x", domain: "d", description: "", default_severity: "minor", depends_on: [], automated: true })).toBe("block");
  });

  test("every script-quality criterion declares subject: script", () => {
    const undeclared = QA_CRITERIA_REGISTRY.filter(
      (c) => c.domain === "script-quality" && criterionSubject(c) !== "script",
    );
    expect(undeclared.map((c) => c.id)).toEqual([]);
  });

  test("the two sets are disjoint", () => {
    const both = [...block.checkers.keys()].filter((id) => script.checkers.has(id));
    expect(both).toEqual([]);
  });

  test("a script checker never lands in the block set", () => {
    // The failure this guards is silent, not loud: handed a CheckerPaths
    // object where it expects a path, a script checker reads
    // "[object Object]" off disk and reports a clean file.
    expect(block.checkers.has("does_not_default_to_float")).toBe(false);
    expect(script.checkers.has("does_not_default_to_float")).toBe(true);
  });
});

describe("every automated criterion resolves, from the module the registry names", () => {

  test("each checker comes from the module the registry DECLARES", async () => {
    // Not merely "a function by that name exists somewhere". `source_file` is
    // what `script_hash` is computed over, so a checker resolved from any
    // other module would have its verdicts invalidated by the wrong file's
    // changes — the defect that motivated discovery in the first place.
    // Asked through `resolveCriterionSource`, which is the ONE answer the
    // sweep itself uses. Re-deriving the path from the cascade here would be a
    // second answer in the test, free to disagree with production — and it
    // would resolve a contributed criterion to core's default, which is the
    // exact never-invalidates trap.
    for (const [id, fn] of block.checkers) {
      const located = resolveCriterionSource(id, CORE, registry);
      expect(located).not.toHaveProperty("reason");
      const src = located as { root: string; sourceFile: string };
      const mod = (await import(`${src.root}/${src.sourceFile}`)) as Record<string, unknown>;
      const found = Object.values(mod).some(
        (v) =>
          v === fn ||
          (v !== null && typeof v === "object" && (v as Record<string, unknown>)[id] === fn),
      );
      expect(found).toBe(true);
    }
  });
});

describe("the two disagreements are reported, not swallowed", () => {

  test("a checker for a criterion declared automated: false is an orphan", () => {
    // Found on the first run. It has never executed: the sweep short-circuits
    // to needs-agent before dispatch, so this is code with no caller.
    const ids = block.orphaned.map((o) => o.criterion);
    expect(ids).toContain("voice-statement-no-interpretation");
  });

  test("every orphan names a criterion the registry really declares non-automated", () => {
    for (const o of block.orphaned) {
      const def = QA_CRITERIA_REGISTRY.find((c) => c.id === o.criterion);
      expect(def?.automated).toBe(false);
    }
  });
});

describe("a module that never finished evaluating keeps its own name", () => {
  /**
   * Bean `95s1`. These reproduce the two shapes a half-built module namespace
   * takes, without needing a real one: a namespace whose `ownKeys` trap throws
   * (nothing can be enumerated), and one whose single binding throws on read
   * while the rest are fine.
   *
   * ## What this is really guarding
   *
   * Not a crash — `readModule` already survives both. It guards the
   * DISTINCTION. The first version of this guard returned an empty list, so
   * `discoverFor` went on to report "exports neither a dispatch-table entry
   * nor check<Id>()", which is a determined and FALSE statement about a module
   * nobody could read. `undefined` is what lets the caller say "did not finish
   * evaluating" instead.
   *
   * The measured original was `qa-checkers-extended.ts`: `const REPO_ROOT =
   * findContentRepoRoot()` at line 49 threw on a declaration that would not
   * parse, so `EXTENDED_AUTOMATED_CHECKERS` three thousand lines below was
   * never bound — and the error named a symptom, not the cause.
   */
  const tdzNamespace = (): Record<string, unknown> =>
    new Proxy({} as Record<string, unknown>, {
      ownKeys() {
        throw new ReferenceError("Cannot access 'X' before initialization.");
      },
    });

  const oneBadBinding = (): Record<string, unknown> =>
    new Proxy({ good: () => "ok", bad: undefined } as Record<string, unknown>, {
      get(target, prop, receiver) {
        if (prop === "bad") throw new ReferenceError("Cannot access 'bad' before initialization.");
        return Reflect.get(target, prop, receiver);
      },
    });

  test("an unenumerable namespace is `undefined`, not an empty read", () => {
    // The difference between a THIRD STATE and a wrong answer. An empty read
    // is indistinguishable from a module that legitimately exports nothing.
    expect(readModule(tdzNamespace())).toBeUndefined();
  });

  test("a module exporting nothing reads as EMPTY — the case `undefined` must not collide with", () => {
    const read = readModule({});
    expect(read).toBeDefined();
    expect(read!.values).toEqual([]);
  });

  test("one unreadable binding does not cost the others", () => {
    // Narrower than the case above, and it must stay narrower: a single
    // binding in its dead zone is not a reason to declare the whole module
    // unreadable, or one bad export would hide every checker beside it.
    const read = readModule(oneBadBinding());
    expect(read).toBeDefined();
    expect(read!.values).toHaveLength(1);
    expect(typeof read!.values[0]).toBe("function");
  });

  test("`byName` yields undefined for an unreadable binding rather than throwing", () => {
    // The named-export fallback reads a binding directly, so it needs the same
    // guard the enumeration has — it threw here before bean `95s1`.
    const read = readModule(oneBadBinding())!;
    expect(read.byName("bad")).toBeUndefined();
    expect(typeof read.byName("good")).toBe("function");
  });
});
