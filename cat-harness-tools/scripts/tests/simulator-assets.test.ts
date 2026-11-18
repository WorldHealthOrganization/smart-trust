/**
 * A simulator block's `html:` target is checked, and three states are kept apart.
 *
 * Bean `023p`. Before this, `validate.ts` contained **no reference to
 * `simulator` or `.html`**. Measured on qou 2026-09-19: two of eleven targets
 * existed in neither repository, had been dangling on `main` before any branch
 * touched them, and `run-validate` exited **0** with three issues, none about
 * a simulator. Both dangling blocks passed clean.
 *
 * `SimulatorBlock`'s own doc comment claimed *"Pipeline validates: .html
 * companion exists"*. It did not — a documented check that does not run is
 * worse than an absent one, because a reader stops looking.
 *
 * ## The base path, and the bug that nearly shipped
 *
 * `html:` is documented *relative to repo root*, and that is where the files
 * are: qou declares `simulators/x.html` and they sit at `<repo>/simulators/`,
 * NOT under the folio root at `<repo>/content/`.
 *
 * The first draft resolved against `folioDir()`. Both known-dangling cases
 * still came back `absent` — the right answer for the wrong reason — and the
 * NINE that exist would have been reported missing too. Caught by checking
 * where the files actually are, rather than by re-reading the two cases that
 * confirmed what I expected.
 *
 * @module cat-harness/scripts/tests/simulator-assets.test
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  classifyHtmlTarget,
  isDeferred,
  validateSimulatorAssets,
  DEFERRED_TAG,
} from "../../pipeline/validate-simulator.js";

function repoWith(files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "sim-assets-"));
  for (const f of files) {
    mkdirSync(join(root, "simulators"), { recursive: true });
    writeFileSync(join(root, f), "<html></html>");
  }
  return root;
}

const sim = (label: string, html: unknown, tags?: string[]) => ({
  name: label,
  block: { kind: "simulator", label, html, ...(tags ? { tags } : {}) } as never,
});

describe("the three states, and the third is the point", () => {
  test("present — resolved and on disk", () => {
    const root = repoWith(["simulators/ok.html"]);
    expect(classifyHtmlTarget("simulators/ok.html", root).state).toBe("present");
  });

  test("absent — resolved and not there", () => {
    const root = repoWith([]);
    expect(classifyHtmlTarget("simulators/gone.html", root).state).toBe("absent");
  });

  test("undetermined — a remote target is NOT fetched, so NOT verified", () => {
    // Silence here would make "I did not look" indistinguishable from
    // "I looked and it was fine".
    const r = classifyHtmlTarget("https://example.org/sim.html", repoWith([]));
    expect(r.state).toBe("undetermined");
    expect(r.detail).toContain("UNKNOWN");
  });

  test("undetermined — a path escaping the repository", () => {
    expect(classifyHtmlTarget("../outside.html", repoWith([])).state).toBe("undetermined");
  });

  test("a missing `html:` field is an absence, not a pass", () => {
    expect(classifyHtmlTarget(undefined, repoWith([])).state).toBe("absent");
    expect(classifyHtmlTarget("   ", repoWith([])).state).toBe("absent");
  });
});

describe("todo-html is a claim, and a claim is still an absence", () => {
  test("an untagged dangling target is an ERROR", () => {
    const root = repoWith([]);
    const { issues, summary } = validateSimulatorAssets([sim("a", "simulators/x.html")], root);
    expect(issues[0]!.level).toBe("error");
    expect(summary.dangling).toBe(1);
  });

  test("a tagged one is a WARNING, and is COUNTED rather than dropped", () => {
    // "how many are deferred" is the number an author needs. Dropping them
    // from the count is how an intended stub becomes an invisible one.
    const root = repoWith([]);
    const { issues, summary } = validateSimulatorAssets(
      [sim("b", "simulators/x.html", ["sim", DEFERRED_TAG])],
      root,
    );
    expect(issues[0]!.level).toBe("warning");
    expect(summary.deferred).toBe(1);
    expect(summary.dangling).toBe(0);
  });

  test("losing the tag while keeping the dead path escalates to error", () => {
    // The case the bean names as reported by nobody: nothing reconciled the
    // tag against disk, so a block that lost it kept passing.
    const root = repoWith([]);
    expect(isDeferred({ kind: "simulator", tags: ["other"] })).toBe(false);
    expect(validateSimulatorAssets([sim("c", "simulators/x.html", ["other"])], root).issues[0]!.level)
      .toBe("error");
  });

  test("a present target produces no issue at all", () => {
    const root = repoWith(["simulators/ok.html"]);
    const { issues, summary } = validateSimulatorAssets([sim("d", "simulators/ok.html")], root);
    expect(issues).toEqual([]);
    expect(summary.present).toBe(1);
  });

  test("non-simulator blocks are untouched", () => {
    const root = repoWith([]);
    const { issues } = validateSimulatorAssets(
      [{ name: "p", block: { kind: "prose", label: "p" } as never }],
      root,
    );
    expect(issues).toEqual([]);
  });
});
