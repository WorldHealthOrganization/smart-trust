/**
 * `check:uploads-retired` — the rule this repository wrote down and then broke
 * in the same commit. Bean `q7ey`.
 *
 * The retention rule is the owner's, 2026-09-29: an upload is the archival
 * copy until it is ingested, and then it retires to `fsh-guts/uploads/`. It
 * was written into `library-ingestion` and swept by hand on 2026-09-30, and
 * that one sweep produced four wrong answers:
 *
 *   1. **nine** sources to retire, having resolved `cat-harness/library/`
 *      alone — the answer was 28 across five harnesses;
 *   2. **five RESTORED from git history after deletion** — none had been
 *      deleted; all five sat at `cat-harness/uploads/` continuously and are
 *      in `4b10661cdde` at that path, so the sweep copied a second set into
 *      the archive and reported a recovery with nothing recovered;
 *   3. three more copied rather than moved, original left in place;
 *   4. `who-iris` counted as swept while three ingested sources stayed in its
 *      queue, because that queue keeps a DIRECTORY per source and the sweep
 *      listed only the top level.
 *
 * Every one is the same shape — an answer computed over less than the corpus,
 * indistinguishable from an answer over all of it — and correcting (1)'s
 * number did not stop (2), (3) or (4) inside the same commit. That is the
 * argument for a check rather than a better sweep.
 *
 * ## What each test holds
 *
 * Fixtures are real directories with real manifests, because the contract is
 * "this file's bytes are what some entry derived from" and a mocked hash
 * would test the mock. The cases are the four failures above, plus the two
 * distinctions the remedy depends on:
 *
 *   - **ingested and unarchived** must be a finding (a move);
 *   - **ingested and already archived** must be a finding with a DIFFERENT
 *     remedy (a removal) — conflating them is exactly how eight files ended
 *     up in two places;
 *   - **queued** must not be a finding, or the check tells everyone to retire
 *     work nobody has read;
 *   - matching is on **hash, not filename**: `2509.06388v1.pdf` is archived
 *     as `wang-rangaiah-2026-mcdm-aggregation.pdf`, and a name comparison
 *     would have called that unarchived and produced a ninth duplicate.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  companionSource,
  findings,
  ingestedSources,
  queueState,
  resolvedQueues,
  withCompanions,
} from "../check-uploads-retired.ts";

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface Fixture {
  /** Files to write into the layer's `uploads/`, by relative path. */
  queue?: Record<string, string>;
  /** Library entries: slug → the content whose hash the manifest records. */
  entries?: Record<string, string>;
  /** Files to write into `fsh-guts/uploads/`, by basename. */
  archive?: Record<string, string>;
}

/**
 * A layer that DECLARES its `library/` and `uploads/`, because the whole
 * defect class here is a directory nobody resolved. A fixture that hardcoded
 * the paths would pass over a declaration bug.
 */
function instance(f: Fixture): string {
  const root = mkdtempSync(join(tmpdir(), "uploads-retired-"));
  made.push(root);
  mkdirSync(join(root, "library"), { recursive: true });
  mkdirSync(join(root, "uploads"), { recursive: true });
  mkdirSync(join(root, "fsh-guts", "uploads"), { recursive: true });

  // `<instance>.json`, named after the directory — that is how the resolver
  // finds it, and a fixture that hardcoded `instance.json` would test nothing
  // the real tree does.
  writeFileSync(
    join(root, `${basename(root)}.json`),
    JSON.stringify({
      name: basename(root),
      directories: [
        { id: "library", path: "library/", graphTypologies: ["library"], dependents: "reproduce" },
        { id: "uploads", path: "uploads/", graphTypologies: ["uploads"], dependents: "reproduce" },
        // The archive is found through this declaration, never by spelling
        // `fsh-guts/uploads` (bean `gz47`); a fixture that only MADE the
        // directory passed because the reader hardcoded the same spelling.
        { id: "fsh-guts", path: "fsh-guts/", graphTypologies: ["fsh-guts"] },
      ],
    }),
  );

  for (const [rel, body] of Object.entries(f.queue ?? {})) {
    const abs = join(root, "uploads", rel);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, body);
  }
  for (const [slug, body] of Object.entries(f.entries ?? {})) {
    mkdirSync(join(root, "library", slug), { recursive: true });
    writeFileSync(
      join(root, "library", slug, "manifest.jsonld"),
      // Nested, because a real manifest nests and the reader walks for the
      // field NAME rather than reading a fixed key path.
      JSON.stringify({ "@graph": [{ intake: { source_sha256: sha(body) } }] }),
    );
  }
  for (const [name, body] of Object.entries(f.archive ?? {})) {
    writeFileSync(join(root, "fsh-guts", "uploads", name), body);
  }
  return root;
}

describe("what counts as a finding", () => {
  test("ingested and not archived → a finding whose remedy is a MOVE", () => {
    const root = instance({ queue: { "a.pdf": "AAA" }, entries: { "entry-a": "AAA" } });
    const f = findings(queueState([root]));
    expect(f).toHaveLength(1);
    expect(f[0].rel).toBe(join("uploads", "a.pdf"));
    expect(f[0].state).toBe("retired");
    expect(f[0].entry).toBe(join("library", "entry-a"));
    expect(f[0].archived).toBeUndefined();
  });

  test("ingested AND already archived → a finding whose remedy is a REMOVAL", () => {
    const root = instance({
      queue: { "a.pdf": "AAA" },
      entries: { "entry-a": "AAA" },
      archive: { "a.pdf": "AAA" },
    });
    const f = findings(queueState([root]));
    expect(f).toHaveLength(1);
    // The distinction the eight duplicates were created by losing.
    expect(f[0].state).toBe("duplicated");
    expect(f[0].archived).toBe(join("fsh-guts", "uploads", "a.pdf"));
  });

  test("queued but never ingested is NOT a finding", () => {
    const root = instance({ queue: { "unread.pdf": "ZZZ" }, entries: { "entry-a": "AAA" } });
    expect(findings(queueState([root]))).toHaveLength(0);
    expect(queueState([root]).map((q) => q.state)).toEqual(["queued"]);
  });
});

describe("the four ways the 2026-09-30 sweep was wrong", () => {
  test("a RENAMED archive copy still counts as archived — hash, not filename", () => {
    // The real case: uploads/2509.06388v1.pdf, archived as
    // wang-rangaiah-2026-mcdm-aggregation.pdf.
    const root = instance({
      queue: { "2509.06388v1.pdf": "MCDM" },
      entries: { "wang-rangaiah-2026-mcdm-aggregation": "MCDM" },
      archive: { "wang-rangaiah-2026-mcdm-aggregation.pdf": "MCDM" },
    });
    const f = findings(queueState([root]));
    expect(f).toHaveLength(1);
    expect(f[0].state).toBe("duplicated");
    expect(f[0].archived).toContain("wang-rangaiah");
  });

  test("a queue that nests one directory per source is READ, not reported empty", () => {
    // who-iris's shape, and failure (4): the sweep listed the top level, saw
    // three directories and no files, and recorded the harness as swept.
    const root = instance({
      queue: { "src-a/paper.pdf": "AAA", "src-a/intake.json": "{}" },
      entries: { "entry-a": "AAA" },
    });
    const all = queueState([root]);
    expect(all.map((q) => q.rel).sort()).toEqual([join("uploads", "src-a", "intake.json"), join("uploads", "src-a", "paper.pdf")]);
    const f = findings(all);
    expect(f).toHaveLength(1);
    expect(f[0].rel).toContain("paper.pdf");
  });

  test("a file beside an intake.json is the ADVISORY shape, not the blocking one", () => {
    const root = instance({
      queue: { "src-a/paper.pdf": "AAA", "src-a/intake.json": "{}" },
      entries: { "entry-a": "AAA" },
    });
    expect(findings(queueState([root]))[0].shape).toBe("structured-intake");
  });

  test("a bare drop is the BLOCKING shape", () => {
    const root = instance({ queue: { "a.pdf": "AAA" }, entries: { "entry-a": "AAA" } });
    expect(findings(queueState([root]))[0].shape).toBe("flat");
  });

  test("README.md is not a queue item", () => {
    const root = instance({ queue: { "README.md": "what this queue is for" } });
    expect(queueState([root])).toHaveLength(0);
  });
});

describe("the denominator, because a clean zero is the failure mode", () => {
  test("an instance whose library records no source hash yields an EMPTY ingested set", () => {
    // The entry-point guard refuses on this. Asserted here so the guard's
    // premise is pinned rather than assumed: the first version of the script
    // hit exactly this (0 libraries resolved) and printed a green line.
    const root = instance({ queue: { "a.pdf": "AAA" } });
    expect(ingestedSources([root]).size).toBe(0);
    expect(findings(queueState([root]))).toHaveLength(0);
  });

  test("the ingested set is read from the DECLARATION, across every declared library", () => {
    const root = instance({ entries: { "entry-a": "AAA", "entry-b": "BBB" } });
    const m = ingestedSources([root]);
    expect(m.size).toBe(2);
    expect(m.get(sha("AAA"))).toBe(join("library", "entry-a"));
    expect(m.get(sha("BBB"))).toBe(join("library", "entry-b"));
  });

  // A review bot on #1633: the first vacuity guard failed on ANY empty file
  // list, so a repository that had retired every source would be red for
  // ever. Both halves matter and they are different answers, which is this
  // repository's own rule — "an empty directory is still a determined empty".
  // `library-ingestion/uploads-retirement.md` requires an ingested source's `*.extraction.json`
  // companion to move WITH it. Nothing enforced that: every other judgement
  // here is a file's own sha256 against the ingested set, and a companion's
  // bytes match no `source_sha256`, so it could never be a finding. Found by
  // a review bot on #1633, against the rule this branch itself wrote.
  describe("a companion follows its source", () => {
    const q = (rel: string): QueueFileLike => ({ rel, sha256: "x", state: "queued", shape: "flat" });
    type QueueFileLike = Parameters<typeof withCompanions>[0][number];

    test("companionSource reads the relation off the name, and only that shape", () => {
      expect(companionSource("uploads/a.pdf.extraction.json")).toBe("a.pdf");
      expect(companionSource("uploads/a.pdf.extraction.md")).toBe("a.pdf");
      expect(companionSource("uploads/a.pdf")).toBeUndefined();
      expect(companionSource("uploads/extraction.json")).toBeUndefined();
    });

    test("beside a source still in the queue it is queued too — the live who-iris case", () => {
      const out = withCompanions(
        [q("uploads/a.pdf"), q("uploads/a.pdf.extraction.json")],
        new Set(["a.pdf"]),
      );
      // Archived name present AND source present: the source has not retired,
      // so the pair is queued together. Getting this wrong would flag the
      // three companions in who-iris/.../iris-capture/, whose sources sit
      // beside them.
      expect(findings(out)).toHaveLength(0);
    });

    test("left behind by a source that DID retire, it is a finding", () => {
      const out = withCompanions([q("uploads/a.pdf.extraction.json")], new Set(["a.pdf"]));
      expect(findings(out)).toHaveLength(1);
      expect(out[0]?.state).toBe("orphaned-companion");
      expect(out[0]?.archived).toBe("a.pdf");
    });

    test("source absent from BOTH queue and archive is not guessed about", () => {
      // No evidence the source was ever ingested, so this is an ordinary
      // queued file. Reporting it would be the check inventing a retirement.
      const out = withCompanions([q("uploads/a.pdf.extraction.json")], new Set());
      expect(findings(out)).toHaveLength(0);
    });

    test("a companion in another directory is not matched to a same-named source", () => {
      const out = withCompanions(
        [q("uploads/one/a.pdf"), q("uploads/two/a.pdf.extraction.json")],
        new Set(["a.pdf"]),
      );
      // The relation is `dirname`-scoped: `two/`'s companion has no source
      // beside it, so it IS the orphan, and `one/a.pdf` does not shield it.
      expect(findings(out)).toHaveLength(1);
      expect(findings(out)[0]?.rel).toBe("uploads/two/a.pdf.extraction.json");
    });
  });

  describe("resolved-and-empty is not the same answer as nothing-resolved", () => {
    test("a declared queue holding no files RESOLVES — determined empty, and a pass", () => {
      const root = instance({ entries: { "entry-a": "AAA" } });
      // The declaration is present and resolves; the directory simply holds
      // nothing, which is the end state the retirement rule drives towards.
      expect(resolvedQueues([root]).length).toBeGreaterThan(0);
      expect(queueState([root])).toHaveLength(0);
    });

    test("the two states are distinguishable at all — the premise the fix rests on", () => {
      // Same empty `queueState()`, different `resolvedQueues()`. If these ever
      // agreed, the entry point could not tell a swept repository from one
      // whose declarations it failed to read, and `dh4f` would be unavoidable.
      const declared = instance({ entries: { "entry-a": "AAA" } });
      expect(queueState([declared])).toHaveLength(0);
      expect(resolvedQueues([declared]).length).toBeGreaterThan(0);
      expect(resolvedQueues([mkdtempSync(join(tmpdir(), "undeclared-"))])).toHaveLength(0);
    });
  });
});
