/**
 * The front-matter gate fails on the defect it was built for.
 *
 * @module scripts/tests/bean-front-matter.test
 *
 * Bean `t7ao`'s own Done-when asks for this in as many words: *"a test that
 * FEEDS IT A BROKEN BEAN and asserts it fails. A gate for this defect that has
 * never seen the defect is the defect."*
 *
 * The fixture is the REAL failure, not an invented one. `224e0beac8` committed
 * a bean whose line 8 was a literal `\1` — an unsubstituted sed backreference
 * where `updated_at:` belonged — and `bun run cat gates --all` passed 92 gates over
 * it before `beans list` failed for every reader in the next shell. That exact
 * byte sequence is what `BROKEN_FRONT_MATTER` below reproduces.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MECHANICAL_KEYS,
  checkBeanFrontMatter,
  classifyDuplicate,
  duplicateBeanIds,
  duplicatedKeys,
  mechanicalWinner,
  reconcile,
} from "../check-bean-front-matter.ts";
import { readBeanFiles, readBeanStore } from "../bean-store-read.ts";
import { readdirSync } from "node:fs";

/** `sqtq` as committed in `224e0beac8`, line for line. */
const BROKEN_FRONT_MATTER = [
  "---",
  "# folio-assistant-sqtq",
  "title: 'SWIMLANES HAVE NO DEFINITION'",
  "status: todo",
  "type: bug",
  "priority: normal",
  "created_at: 2026-09-21T18:32:14Z",
  "\\1",
  "parent: folio-assistant-1xhc",
  "---",
  "",
  "A body, so this is not also an empty-body finding.",
  "",
].join("\n");

const GOOD_FRONT_MATTER = [
  "---",
  "# folio-assistant-aaaa",
  "title: A well-formed bean",
  "status: todo",
  "type: task",
  "created_at: 2026-09-21T00:00:00Z",
  "---",
  "",
  "A body.",
  "",
].join("\n");

/** Two `title:` lines — what `1hvo` carries, and what `beans` itself accepts. */
const DUPLICATE_KEY = [
  "---",
  "# folio-assistant-bbbb",
  "title: 'One title'",
  "title: 'A different title'",
  "status: todo",
  "type: task",
  "created_at: 2026-09-21T00:00:00Z",
  "---",
  "",
  "A body.",
  "",
].join("\n");

function storeWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "bean-fm-"));
  const defs = join(root, "beans", "defs");
  mkdirSync(defs, { recursive: true });
  for (const [name, text] of Object.entries(files)) writeFileSync(join(defs, name), text);
  return root;
}

describe("check-bean-front-matter", () => {
  test("a clean store reports no defect", () => {
    const root = storeWith({ "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER });
    try {
      const r = checkBeanFrontMatter(root);
      expect(r.beans).toBe(1);
      expect(r.defects).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("THE REAL BROKEN BEAN is caught, as unparseable", () => {
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "folio-assistant-sqtq--broken.md": BROKEN_FRONT_MATTER,
    });
    try {
      const r = checkBeanFrontMatter(root);
      const bad = r.defects.filter((d) => d.kind === "unparseable");
      expect(bad).toHaveLength(1);
      expect(bad[0]!.id).toBe("folio-assistant-sqtq");
      // The line a person opens the file to, not the parser's block-relative
      // one. `beans` itself said line 8, and line 8 is where the `\1` sits.
      expect(bad[0]!.line).toBe(8);
      expect(bad[0]!.baselined).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("one broken bean does not hide the others — the good one still counts", () => {
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "folio-assistant-sqtq--broken.md": BROKEN_FRONT_MATTER,
    });
    try {
      // The whole point of the bean: `beans` loads the store as a unit and
      // returns NOTHING. This check must read past the bad file, or it would
      // reproduce the failure it exists to report.
      expect(checkBeanFrontMatter(root).beans).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a duplicate key is its own kind, not 'unparseable'", () => {
    const root = storeWith({ "folio-assistant-bbbb--dup.md": DUPLICATE_KEY });
    try {
      const r = checkBeanFrontMatter(root);
      expect(r.defects).toHaveLength(1);
      // Conflating the two would gate the repository on a store that loads
      // perfectly well under the loader `beans` actually uses.
      expect(r.defects[0]!.kind).toBe("duplicate-key");
      expect(r.defects[0]!.baselined).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no store is null, never an empty one", () => {
    const root = mkdtempSync(join(tmpdir(), "bean-fm-none-"));
    try {
      // `null` and `0` are different answers, and a caller that renders them
      // the same reports a clean run over a repository it never looked at.
      expect(checkBeanFrontMatter(root).beans).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the baseline is reported stale when its bean is absent", () => {
    const root = storeWith({ "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER });
    try {
      // The baselined id is absent from this fixture, so it is stale — which is
      // how a repaired bean gets its entry removed rather than silently
      // excusing a fresh defect under the same id.
      //
      // ONE id, not two, since 2026-09-27: `7u3g`'s duplicate was `updated_at`,
      // which the FIELD settles rather than the owner (bean `kfkh`), so it was
      // collapsed to the later write and left the baseline. This expectation
      // mirrors `DUPLICATE_KEY_BASELINE`, so shrinking that set is meant to
      // fail here — and did, in the same change.
      //
      // `yt7j` joined 2026-10-03 from `DUPLICATE_ID_BASELINE` (bean `4vg7`) and
      // left the same day: the owner kept the archive copy and the stale defs/
      // copy was removed, so that set is empty again.
      expect(checkBeanFrontMatter(root).staleBaseline).toEqual(["folio-assistant-1hvo"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the repository's own store loads — no unparseable bean on this branch", () => {
    const repo = join(import.meta.dir, "..", "..", "..");
    const r = checkBeanFrontMatter(repo);
    expect(r.beans).not.toBeNull();
    expect(r.beans).toBeGreaterThan(0);
    expect(r.defects.filter((d) => d.kind === "unparseable")).toEqual([]);
  });
});

/**
 * Bean `t6s7` — the two states the gate inherited from `readBeanFiles`.
 *
 * `t7ao` above is the LOUD defect: the store goes down and every reader says
 * so. These two are the quiet ones, and they survived that fix because the
 * gate is built on a reader that drops both on the floor. Each case below is
 * the planted defect, because the live store is clean and therefore proves
 * neither — the same reason every fixture above exists.
 */
const UNFENCED = [
  "---",
  "# folio-assistant-cccc",
  "title: the closing fence is `--`, one dash short",
  "status: todo",
  "type: task",
  "--",
  "parent: folio-assistant-1xhc",
  "",
].join("\n");

/** `storeWith`, plus the `beans/beans.json` that makes the path DECLARED. */
function declaredStore(path: string, files: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "bean-fm-decl-"));
  mkdirSync(join(root, "beans"), { recursive: true });
  writeFileSync(
    join(root, "beans", "beans.json"),
    JSON.stringify({
      name: "fixture",
      directories: [{ id: "defs", path, graphs: ["bean-defs"], description: "declared" }],
    }),
  );
  if (Object.keys(files).length > 0) {
    mkdirSync(join(root, "beans", path), { recursive: true });
    for (const [n, t] of Object.entries(files)) writeFileSync(join(root, "beans", path, n), t);
  }
  return root;
}

describe("t6s7 — a mangled FENCE is reported, not skipped", () => {
  test("the planted file is a defect, and the good bean beside it still counts", () => {
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "folio-assistant-cccc--unfenced.md": UNFENCED,
    });
    try {
      const r = checkBeanFrontMatter(root);
      const unfenced = r.defects.filter((d) => d.kind === "unfenced");
      expect(unfenced).toHaveLength(1);
      expect(unfenced[0]!.file).toBe("folio-assistant-cccc--unfenced.md");
      // The id is the FILENAME STEM on purpose: that is what `beans` falls
      // back to when the front matter yields nothing, so the gate names the
      // same ghost row a person sees in `beans list`.
      expect(unfenced[0]!.id).toBe("folio-assistant-cccc--unfenced");
      // One bad file does not make the gate give up on the rest.
      expect(r.beans).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("THE REGRESSION: the bean count alone cannot see it — reconciliation can", () => {
    // This is the measurement that opened `t6s7`. Before the fix the gate's
    // count was IDENTICAL with and without the planted file (629 either way)
    // because the file was skipped before it was ever examined. So the count
    // is exactly the wrong thing to assert on, and `filesSeen` is the right
    // one: `beans + skipped` has to account for every `.md` in the directory.
    const clean = storeWith({ "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER });
    const planted = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "folio-assistant-cccc--unfenced.md": UNFENCED,
    });
    try {
      const a = checkBeanFrontMatter(clean);
      const b = checkBeanFrontMatter(planted);
      expect(b.beans).toBe(a.beans); // the count does NOT move — the old blind spot
      expect(b.filesSeen).toBe(a.filesSeen + 1); // but the directory does
      expect(b.beans! + b.skipped.length).toBe(b.filesSeen);
    } finally {
      rmSync(clean, { recursive: true, force: true });
      rmSync(planted, { recursive: true, force: true });
    }
  });

  test("README.md is the one documented exception — skipped, and NOT a defect", () => {
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "README.md": "# The bean store\n\nOne markdown file per work item.\n",
    });
    try {
      const r = checkBeanFrontMatter(root);
      expect(r.defects.filter((d) => d.kind === "unfenced")).toEqual([]);
      // Still ACCOUNTED FOR, not invisible — it has to appear in the
      // arithmetic or the reconciliation above would be excusing it.
      expect(r.skipped).toHaveLength(1);
      expect(r.skipped[0]!.expected).toBe(true);
      expect(r.beans! + r.skipped.length).toBe(r.filesSeen);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the archive is walked for this too", () => {
    const root = storeWith({ "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER });
    try {
      const archive = join(root, "beans", "defs", "archive");
      mkdirSync(archive, { recursive: true });
      writeFileSync(join(archive, "folio-assistant-dddd--unfenced.md"), UNFENCED);
      const r = checkBeanFrontMatter(root);
      const unfenced = r.defects.filter((d) => d.kind === "unfenced");
      expect(unfenced).toHaveLength(1);
      // Reported WITH its subdirectory, because the basename alone would send
      // a reader to `defs/` where the file is not.
      expect(unfenced[0]!.file).toBe(join("archive", "folio-assistant-dddd--unfenced.md"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("t6s7 — the two absences are two answers", () => {
  test("DECLARED and not there is `declared-but-absent`, never a pass", () => {
    const root = declaredStore("defs-that-does-not-exist");
    try {
      const r = checkBeanFrontMatter(root);
      expect(r.beans).toBeNull();
      expect(r.storeState).toBe("declared-but-absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("no `beans/` at all is `absent` — legitimate, and still a pass", () => {
    // The distinction the fallback destroys: `beanDefsDir` hands back a
    // perfectly plausible `beans/defs` for a repository that never mentioned
    // one, so without the `declared` flag this fixture and the one above are
    // indistinguishable — and BOTH reported "nothing to check", exit 0.
    const root = mkdtempSync(join(tmpdir(), "bean-fm-none-"));
    try {
      const r = checkBeanFrontMatter(root);
      expect(r.beans).toBeNull();
      expect(r.storeState).toBe("absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a DECLARED directory that exists is read normally", () => {
    const root = declaredStore("somewhere-else", {
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
    });
    try {
      const r = checkBeanFrontMatter(root);
      expect(r.storeState).toBe("read");
      expect(r.beans).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("t6s7 — the four consumers are untouched", () => {
  test("readBeanFiles still returns the beans, and still `null` for no store", () => {
    // Three of the four callers want exactly this shape and reach no verdict
    // about the store itself. The fix must not change what they see, or it
    // stops being a fix to one gate and becomes a change to four.
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "folio-assistant-cccc--unfenced.md": UNFENCED,
    });
    try {
      const files = readBeanFiles(root);
      expect(files).not.toBeNull();
      // The unfenced file is still not a bean — it is REPORTED elsewhere, not
      // promoted into the list, because a consumer given a fenceless "bean"
      // would read empty strings for every field.
      expect(files!.map((f) => f.id)).toEqual(["folio-assistant-aaaa"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    expect(readBeanFiles(mkdtempSync(join(tmpdir(), "bean-fm-none-")))).toBeNull();
  });

  test("the repository's own store has no unfenced file", () => {
    const repo = join(import.meta.dir, "..", "..", "..");
    const r = checkBeanFrontMatter(repo);
    expect(r.storeState).toBe("read");
    expect(r.defects.filter((d) => d.kind === "unfenced")).toEqual([]);
    // And the arithmetic closes on the real corpus, not just on fixtures.
    expect(r.beans! + r.skipped.length).toBe(r.filesSeen);
  });
});

describe("t6s7 — the reconciliation is not a tautology", () => {
  test("`filesSeen` is an INDEPENDENT count of the directory", () => {
    // Derived as `beans + skipped` it restates the two lists, so the guard
    // below holds by construction and cannot fail — which is `xom7`, and is
    // exactly what this whole bean is about. Found by mutating it: computing
    // `filesSeen` from the lists left every other test here green.
    //
    // Asserted against a count this test makes for itself, from the directory,
    // so the assertion does not depend on the implementation's arithmetic.
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "folio-assistant-cccc--unfenced.md": UNFENCED,
      "README.md": "# not a bean\n",
      "notes.txt": "not markdown, and must not be counted\n",
    });
    try {
      const onDisk = readdirSync(join(root, "beans", "defs")).filter((n) =>
        n.endsWith(".md"),
      ).length;
      expect(onDisk).toBe(3); // the .txt is excluded
      expect(checkBeanFrontMatter(root).filesSeen).toBe(onDisk);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the guard's FAILING branch is executed, not merely written", () => {
    // The read path cannot currently produce a mismatch — every `.md` lands in
    // `beans` or `skipped` — so this is the only way to run the branch that
    // reports one. A guard whose failure has never executed is indistinguish-
    // able from one that cannot fail.
    expect(reconcile(2, 1, 3)).toBeNull();
    const complaint = reconcile(1, 1, 3);
    expect(complaint).not.toBeNull();
    // It has to name all three numbers: a reader's next move is to work out
    // WHICH file went missing, and a bare "counts disagree" does not help.
    expect(complaint).toContain("3 .md file(s)");
    expect(complaint).toContain("1 bean(s)");
    expect(complaint).toContain("1 skipped");
  });
});

describe("who can settle a duplicated front-matter key (bean `kfkh`)", () => {
  test("same value twice is collapsible — nothing is lost", () => {
    expect(classifyDuplicate("title", ["'A'", "'A'"])).toBe("collapsible");
    expect(classifyDuplicate("updated_at", ["2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"])).toBe("collapsible");
  });

  test("two different TITLES are the owner's — choosing is an editorial act", () => {
    // 1hvo, the real one: `…cat-harness/theming/ subgraph…` against
    // `…cat-harness theming subgraph…`. Neither is derivable from the other.
    expect(classifyDuplicate("title", ["'a/b/ subgraph'", "'a b subgraph'"])).toBe("authored");
    expect(mechanicalWinner("title", ["'x'", "'y'"])).toBeUndefined();
  });

  test("two different `updated_at`s are NOT the owner's — the field settles it", () => {
    // THE POINT OF THIS BLOCK, and the refinement kfkh's two-way split misses.
    // 7u3g, the real one: 15:26:13Z against 15:32:27Z. `beans update` bumps this
    // on every change, so two values are two writes and the later IS the state.
    // Leaving it in the owner's queue is a question nobody needs to answer.
    const vs = ["2026-09-20T15:26:13Z", "2026-09-20T15:32:27Z"];
    expect(classifyDuplicate("updated_at", vs)).toBe("mechanical");
    expect(mechanicalWinner("updated_at", vs)).toBe("2026-09-20T15:32:27Z");
  });

  test("`created_at` goes the OTHER way — creation is immutable, so the earlier is it", () => {
    const vs = ["2026-09-20T15:26:13Z", "2026-09-20T15:32:27Z"];
    expect(classifyDuplicate("created_at", vs)).toBe("mechanical");
    expect(mechanicalWinner("created_at", vs)).toBe("2026-09-20T15:26:13Z");
    // Not a symmetry to assume: the two mechanical keys have opposite rules,
    // which is why the rule is recorded per key rather than inferred.
    expect(MECHANICAL_KEYS.created_at).toBe("earlier");
    expect(MECHANICAL_KEYS.updated_at).toBe("later");
  });

  test("status, type, priority and parent are authored, not mechanical", () => {
    for (const k of ["status", "type", "priority", "parent"]) {
      expect(classifyDuplicate(k, ["a", "b"])).toBe("authored");
    }
  });

  test("the key scan reads the RAW block, because the block does not parse", () => {
    // A YAML parse is unavailable by construction — a duplicate key is why we
    // are here. Continuations must not be mistaken for keys.
    const fm = [
      "# folio-assistant-x",
      "title: one",
      "status: todo",
      "title: two",
      "body: |",
      "  indented: not a key",
      "- listitem: also not",
    ].join("\n");
    expect(duplicatedKeys(fm)).toEqual([{ key: "title", values: ["one", "two"] }]);
  });

  test("a block with no duplicate yields none — the scan is not vacuous", () => {
    expect(duplicatedKeys("title: one\nstatus: todo")).toEqual([]);
  });
});

/**
 * Bean `4vg7`: two files declaring one id. Both are individually valid — that
 * is the whole point, and why every per-file check passed over `t3n8` for
 * eleven days. The fixture reproduces that shape: one id, two titles, two
 * dates, two parents, both files clean.
 */
const ID_COLLISION_DISPLAY = [
  "---",
  "# folio-assistant-cccc",
  "title: 'HARNESS DISPLAY NAMES'",
  "status: completed",
  "type: bug",
  "created_at: 2026-09-21T17:28:40Z",
  "parent: folio-assistant-yj32",
  "---",
  "",
  "A body.",
  "",
].join("\n");
const ID_COLLISION_ARCHIVE_RUNG = [
  "---",
  "# folio-assistant-cccc",
  "title: The archive rung stages but can never promote",
  "status: todo",
  "type: bug",
  "created_at: 2026-09-22T22:17:51Z",
  "parent: folio-assistant-ahvw",
  "---",
  "",
  "A different body.",
  "",
].join("\n");

describe("check-bean-front-matter — duplicate ids across files (4vg7)", () => {
  test("two valid files declaring one id are BOTH reported, each naming the other", () => {
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "folio-assistant-cccc--harness-display-names.md": ID_COLLISION_DISPLAY,
      "folio-assistant-cccc--the-archive-rung.md": ID_COLLISION_ARCHIVE_RUNG,
    });
    try {
      const r = checkBeanFrontMatter(root);
      const dup = r.defects.filter((d) => d.kind === "duplicate-id");
      expect(dup.map((d) => d.file).sort()).toEqual([
        "folio-assistant-cccc--harness-display-names.md",
        "folio-assistant-cccc--the-archive-rung.md",
      ]);
      expect(dup.every((d) => d.id === "folio-assistant-cccc" && !d.baselined)).toBe(true);
      expect(dup[0]!.message).toContain(dup[1]!.file);
      // No per-file defect: each file on its own is fine.
      expect(r.defects.filter((d) => d.kind !== "duplicate-id")).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a collision between defs/ and archive/ counts — archiving does not free an id", () => {
    const root = storeWith({ "folio-assistant-cccc--live.md": ID_COLLISION_DISPLAY });
    mkdirSync(join(root, "beans", "defs", "archive"));
    writeFileSync(
      join(root, "beans", "defs", "archive", "folio-assistant-cccc--old.md"),
      ID_COLLISION_ARCHIVE_RUNG,
    );
    try {
      const files = checkBeanFrontMatter(root)
        .defects.filter((d) => d.kind === "duplicate-id")
        .map((d) => d.file)
        .sort();
      expect(files).toEqual([join("archive", "folio-assistant-cccc--old.md"), "folio-assistant-cccc--live.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("distinct ids yield nothing, and a collision keeps both paths", () => {
    expect(
      duplicateBeanIds([
        { id: "a", file: "a.md", archived: false },
        { id: "b", file: "b.md", archived: false },
      ]).size,
    ).toBe(0);
    expect([
      ...duplicateBeanIds([
        { id: "a", file: "a1.md", archived: false },
        { id: "a", file: "a2.md", archived: true },
      ]),
    ]).toEqual([["a", ["a1.md", join("archive", "a2.md")]]]);
  });
});


const INVALID_STATUS_DONE = [
  "---",
  "# cat-tools-g7ls",
  "title: 'Standalone run reads fhir-harness glossary kind core registers'",
  "status: done",
  "type: bug",
  "priority: normal",
  "created_at: 2026-10-30T19:00:00Z",
  "---",
  "",
  "A body.",
  "",
].join("\n");

const GENERATED_README = [
  "---",
  'generated: "cat-harness-tools/scripts/subgraph-readmes.ts — bun run cat readme:subgraphs"',
  "---",
  "",
  "# `beans/defs/`",
  "",
].join("\n");

describe("check-bean-front-matter — invalid status and generated README.md", () => {
  test("a bean with `status: done` (cat-tools-g7ls in d29eea56) is caught as `invalid-status`", () => {
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "cat-tools-g7ls--standalone.md": INVALID_STATUS_DONE,
    });
    try {
      const r = checkBeanFrontMatter(root);
      const bad = r.defects.filter((d) => d.kind === "invalid-status");
      expect(bad).toHaveLength(1);
      expect(bad[0]!.id).toBe("cat-tools-g7ls");
      expect(bad[0]!.baselined).toBe(false);
      expect(bad[0]!.message).toContain('"done"');
      expect(bad[0]!.message).toContain("completed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a `README.md` with generated YAML front matter is skipped as expected, never parsed as a bean", () => {
    const root = storeWith({
      "folio-assistant-aaaa--ok.md": GOOD_FRONT_MATTER,
      "README.md": GENERATED_README,
    });
    try {
      const store = readBeanStore(root);
      if (store.state !== "read") throw new Error(store.state);
      expect(store.beans.map((b) => b.id)).toEqual(["folio-assistant-aaaa"]);
      expect(store.skipped).toEqual([{ file: "README.md", archived: false, expected: true }]);
      const r = checkBeanFrontMatter(root);
      expect(r.beans).toBe(1);
      expect(r.defects).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
