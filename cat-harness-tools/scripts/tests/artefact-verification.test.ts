/**
 * Currency is not validity, and the declaration that says so must be derived.
 *
 * Bean `jfr6`. Every generated artefact here has a `--check` mode asking
 * *would the generator write something different?* — currency. None of them
 * asks *does this artefact work?* — validity. `library:viz:check` was green
 * while the page it generated could not run (PR #805).
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { deriveArtefactChecks, deriveUncheckedGenerators, report } from "../check-artefact-verification.ts";

function repo(scripts: Record<string, string>, files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "artefact-"));
  writeFileSync(join(root, "package.json"), JSON.stringify({ scripts }));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(root, name), body);
  return root;
}

describe("the inventory is DERIVED, never listed", () => {
  test("a check running a generator with --check is picked up", () => {
    const root = repo({ "thing:check": "bun run gen-thing.ts --check" }, { "gen-thing.ts": "// nothing" });
    expect(deriveArtefactChecks(root).map((c) => c.check)).toEqual(["thing:check"]);
  });

  test("a check that is not a --check run is not", () => {
    const root = repo({ "check:something": "bun run x.ts" }, { "x.ts": "// nothing" });
    expect(deriveArtefactChecks(root)).toEqual([]);
  });

  test("a NEW generator is picked up with no edit here — the tyyc property", () => {
    // A hand-maintained list is edited by whoever remembers, and the symptom
    // of forgetting is invisible.
    const root = repo(
      { "a:check": "bun run a.ts --check", "b:check": "bun run b.ts --check" },
      { "a.ts": "// nothing", "b.ts": "// nothing" },
    );
    expect(deriveArtefactChecks(root)).toHaveLength(2);
  });
});

describe("the middle class is `undetermined`, not `validated`", () => {
  test("no parse call at all means it CANNOT be validating its output", () => {
    const root = repo({ "a:check": "bun run a.ts --check" }, { "a.ts": "writeFileSync(p, s);" });
    expect(deriveArtefactChecks(root)[0].classification).toBe("no-parsing");
  });

  test("a parse call does NOT establish that the OUTPUT is validated", () => {
    // It may be parsing its own input. A heuristic that cannot tell must not
    // report the difference as if it could — that is the over-claim this bean
    // exists to find, and making it here would be committing it.
    const root = repo({ "a:check": "bun run a.ts --check" }, { "a.ts": "const cfg = JSON.parse(input);" });
    expect(deriveArtefactChecks(root)[0].classification).toBe("undetermined");
  });
});

describe("three states, and undeclared is the finding", () => {
  const checks = [
    { check: "a:check", script: "a.ts", classification: "no-parsing" as const },
    { check: "b:check", script: "b.ts", classification: "undetermined" as const },
  ];

  test("a declared consumer check is not a finding", () => {
    const r = report(checks, { _comment: "", verified: { "a:check": "x.test.ts", "b:check": "y.test.ts" }, none: {} });
    expect(r.undeclared).toEqual([]);
  });

  test("a declared `none` WITH a reason is not a finding — saying so is the point", () => {
    const r = report(checks, { _comment: "", verified: {}, none: { "a:check": "nothing loads it", "b:check": "same" } });
    expect({ undeclared: r.undeclared, reasonless: r.reasonless }).toEqual({ undeclared: [], reasonless: [] });
  });

  test("a `none` with an EMPTY reason is a finding — it looks decided and is not", () => {
    const r = report(checks, { _comment: "", verified: { "b:check": "y" }, none: { "a:check": "  " } });
    expect(r.reasonless).toEqual(["a:check"]);
  });

  test("UNDECLARED is a finding — nobody-said is not nothing-to-check", () => {
    const r = report(checks, { _comment: "", verified: { "a:check": "x" }, none: {} });
    expect(r.undeclared).toEqual(["b:check"]);
  });

  test("a declaration for a check that no longer exists is stale — the list may only shrink", () => {
    const r = report(checks, {
      _comment: "",
      verified: { "a:check": "x", "b:check": "y" },
      none: { "gone:check": "reason" },
    });
    expect(r.stale).toEqual(["gone:check"]);
  });
});

// cat-harness-tools#1701: in a content repository that is its own index, the
// script table holds only the layers' share of the index's, so "stale" cannot
// be decided there; "undeclared" still can.
describe("a checkout holding part of the declared table", () => {
  const checks = [{ check: "a:check", script: "a.ts", classification: "no-parsing" as const }];
  const d = { _comment: "", verified: { "a:check": "x" }, none: { "index-only:check": "reason" }, unchecked: { "gone.ts": "why" } };

  test("an entry the table lacks is excused, not stale, and says so", () => {
    const r = report(checks, d, [], "a rooted checkout");
    expect({ stale: r.stale, uncheckedStale: r.uncheckedStale }).toEqual({ stale: [], uncheckedStale: [] });
    expect(r.excusedStale).toEqual(["index-only:check", "gone.ts"]);
  });

  test("a check present here with no declaration is still a finding", () => {
    const r = report([...checks, { check: "new:check", script: "n.ts", classification: "no-parsing" as const }], d, [], "a rooted checkout");
    expect(r.undeclared).toEqual(["new:check"]);
  });

  test("without a partial table the same entry is stale, as before", () => {
    const r = report(checks, d, []);
    expect(r.stale).toEqual(["index-only:check"]);
    expect(r.excusedStale).toEqual([]);
  });
});

describe("a GENERATOR with no --check is visible too (bean `v556`)", () => {
  // The inventory above is the --check scripts, so an artefact whose generator
  // has NO --check could never be in it. `kg:export` wrote two committed
  // qa-results/v1 sidecars carrying three hashes and this gate could not see it.
  const call = "writeQa" + "Result(root, 'x', doc);";

  test("a qa-results writer that no command runs with --check is listed", () => {
    const root = repo({ "gen:x": "bun run gen-x.ts" }, { "gen-x.ts": call });
    expect(deriveUncheckedGenerators(root)).toEqual(["gen-x.ts"]);
  });

  test("the same writer with a --check invocation is not — it is in the main inventory instead", () => {
    const root = repo({ "gen:x": "bun run gen-x.ts", "gen:x:check": "bun run gen-x.ts --check" }, { "gen-x.ts": call });
    expect(deriveUncheckedGenerators(root)).toEqual([]);
    expect(deriveArtefactChecks(root).map((c) => c.check)).toEqual(["gen:x:check"]);
  });

  test("the writer's DEFINITION is not a call", () => {
    const root = repo({ lib: "bun run qa.ts" }, { "qa.ts": "export function writeQa" + "Result(root, stem, r) {}" });
    expect(deriveUncheckedGenerators(root)).toEqual([]);
  });

  test("an undeclared unchecked generator is a finding; a declared one is not; a stale one is", () => {
    const d = { _comment: "", verified: {}, none: {}, unchecked: { "a.ts": "why", "gone.ts": "why" } };
    const r = report([], d, ["a.ts", "b.ts"]);
    expect(r.uncheckedUndeclared).toEqual(["b.ts"]);
    expect(r.uncheckedStale).toEqual(["gone.ts"]);
  });

  test("an `unchecked` entry with an empty reason is reasonless", () => {
    const r = report([], { _comment: "", verified: {}, none: {}, unchecked: { "a.ts": " " } }, ["a.ts"]);
    expect(r.reasonless).toEqual(["a.ts"]);
  });

  test("the REAL repository: kg-export.ts is no longer an unchecked generator", () => {
    expect(deriveUncheckedGenerators()).not.toContain("cat-harness/scripts/kg-export.ts");
  });
});
