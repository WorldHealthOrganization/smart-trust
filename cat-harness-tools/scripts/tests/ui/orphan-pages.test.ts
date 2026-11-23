/**
 * The one orphan-page selector, and the two rules the unification carried.
 *
 * Bean `s8nu`. `orphanSubjectPages` and `prunableDashboards` were two correct
 * implementations of one question, and each held a rule the other lacked —
 * which is the argument for merging them rather than merely the tidiness of
 * one fewer function. Both rules are asserted here, because a merge that
 * quietly dropped either would still pass every test the two had before.
 *
 * The callers' own suites (`viewer-orphans.test.ts`, `state-visualizer.test.ts`)
 * are unchanged and remain the falsification the bean asked be kept: with the
 * ownership test replaced by "select on the directory", 5 of them fail.
 *
 * @module scripts/tests/orphan-pages.test
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  carriesMarker,
  declaresItsOwnDirectory,
  orphanSubjectPages,
} from "../../orphan-pages.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A parent directory holding `{ "<dir>/index.html": "<content>" }`. */
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "orphan-pages-"));
  made.push(root);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

/**
 * A page declaring itself the subject page for `name`.
 *
 * The line must stand ALONE: `SCOPE_LINE` is anchored `/^…$/m`, so a page
 * carrying `var SCOPE = "x";` inside a one-line `<script>` tag does not match.
 * The first draft of this file did exactly that and failed five of its own
 * tests — which is the helper being wrong, not the selector, and is why the
 * real generator emits the line on its own.
 */
const scoped = (name: string) => `<html>\n<script>\nvar SCOPE = "${name}";\n</script>\n</html>`;

describe("the ownership test is the parameter, the unit is not", () => {
  test("the default is self-naming, which is the strongest test", () => {
    const d = tree({ "alpha/index.html": scoped("alpha") });
    expect(orphanSubjectPages(d, [])).toEqual({ owned: ["alpha"], foreign: [] });
  });

  test("a page naming a DIFFERENT directory is foreign, not owned", () => {
    // The case a bare marker cannot see at all: this page was written by this
    // generator, and not for HERE.
    const d = tree({ "alpha/index.html": scoped("beta") });
    expect(orphanSubjectPages(d, [])).toEqual({ owned: [], foreign: ["alpha"] });
  });

  test("a marker test claims what self-naming cannot", () => {
    const d = tree({ "beans/index.html": "<html><!-- made by the dashboards --></html>" });
    expect(orphanSubjectPages(d, [])).toEqual({ owned: [], foreign: ["beans"] });
    expect(orphanSubjectPages(d, [], carriesMarker("made by the dashboards"))).toEqual({
      owned: ["beans"],
      foreign: [],
    });
  });

  test("a wanted directory is never examined, whatever the test says", () => {
    const d = tree({ "alpha/index.html": scoped("alpha") });
    expect(orphanSubjectPages(d, ["alpha"])).toEqual({ owned: [], foreign: [] });
    expect(orphanSubjectPages(d, ["alpha"], () => true)).toEqual({ owned: [], foreign: [] });
  });

  test("the tests are composable predicates, usable on their own", () => {
    expect(declaresItsOwnDirectory(scoped("a"), "a")).toBe(true);
    expect(declaresItsOwnDirectory(scoped("a"), "b")).toBe(false);
    expect(declaresItsOwnDirectory("<html>nothing</html>", "a")).toBe(false);
    expect(carriesMarker("XX")("... XX ...", "anything")).toBe(true);
    expect(carriesMarker("XX")("nope", "anything")).toBe(false);
  });
});

describe("the two rules the merge had to carry, one from each side", () => {
  test("FROM orphanSubjectPages: a directory it declines is FOREIGN, never silence", () => {
    // `prunableDashboards` dropped a non-owned directory with no trace, so a
    // page it did not recognise and a directory it had examined and cleared
    // looked identical. Now the caller can report.
    const d = tree({
      "mine/index.html": "<html><!-- MARK --></html>",
      "theirs/index.html": "<html>hand-authored</html>",
      "empty/README.md": "not an index",
    });
    const r = orphanSubjectPages(d, [], carriesMarker("MARK"));
    expect(r.owned).toEqual(["mine"]);
    expect(r.foreign).toEqual(["empty", "theirs"]);
  });

  test("FROM prunableDashboards: an unreadable page is foreign, and does NOT throw", () => {
    // `orphanSubjectPages` called readFileSync bare and would have aborted a
    // whole generator over one unreadable page. A file we cannot read is one
    // we cannot prove we wrote, so it is declined and reported.
    //
    // Unreadable is forced with a DIRECTORY named `index.html`, not with
    // `chmod 000`. The first draft used the permission bit and then had to
    // branch on "unless we are root" -- and this suite runs as root, so that
    // branch is the one that would have fired, leaving the assertion about
    // the thing being tested unreached. A test that skips itself in the
    // environment it actually runs in is the `dh4f` shape. `EISDIR` is raised
    // for everyone.
    const d = tree({ "locked/index.html/placeholder": "" });
    expect(() => orphanSubjectPages(d, [])).not.toThrow();
    expect(orphanSubjectPages(d, [])).toEqual({ owned: [], foreign: ["locked"] });
  });
});

describe("the boundaries that keep pruning safe", () => {
  test("a missing parent directory is not an error", () => {
    expect(orphanSubjectPages(join(tmpdir(), "no-such-dir-orphan-pages"), [])).toEqual({
      owned: [],
      foreign: [],
    });
  });

  test("files beside the subject directories are ignored entirely", () => {
    const d = tree({ "alpha/index.html": scoped("alpha") });
    writeFileSync(join(d, "loose.html"), scoped("loose"));
    const r = orphanSubjectPages(d, []);
    expect(r.owned).toEqual(["alpha"]);
    expect(r.foreign).toEqual([]);
  });

  test("EMPTYING the keep-set never widens what is owned", () => {
    // The bean's own falsification, at this level: with nothing wanted, only
    // the ownership test stands between a directory and deletion.
    const d = tree({
      "mine/index.html": scoped("mine"),
      "guides/index.html": "<html>hand-authored</html>",
      "reference/index.html": "<html>another generator</html>",
    });
    expect(orphanSubjectPages(d, []).owned).toEqual(["mine"]);
  });

  test("both lists are sorted, so a caller's report is stable", () => {
    const d = tree({
      "c/index.html": scoped("c"),
      "a/index.html": scoped("a"),
      "z/index.html": "<html>theirs</html>",
      "b/index.html": "<html>theirs</html>",
    });
    const r = orphanSubjectPages(d, []);
    expect(r.owned).toEqual(["a", "c"]);
    expect(r.foreign).toEqual(["b", "z"]);
  });
});
