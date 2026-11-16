/**
 * The orphan-sidecar sweep — and it had no test at all until now.
 *
 * @module scripts/tests/kg-audit-orphan-sweep.test
 *
 * That gap is the point of this file. The sweep exists to catch a QA sidecar
 * left behind by a subject that moved, and it **shipped silently broken**: the
 * first draft walked `KG_QA_DIRNAME` ("kg-qa") rather than
 * `KG_QA_RESULTS_DIR` ("test/results/kg-qa"), so `readdirSync` threw on a path
 * that does not exist, the `catch` returned, and it reported a clean sweep over
 * nothing on every run. Nothing failed. It was caught only because somebody put
 * the orphan back by hand and watched the guard stay silent — which is the
 * `dh4f` shape produced by the guard written to prevent it.
 *
 * A guard that cannot fire needs a test that watches it fire. These run against
 * a synthetic tree rather than the real results directory, deliberately: an
 * assertion about the real tree pins today's twelve orphans and turns green the
 * moment somebody clears them, which is exactly backwards.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { sweepOrphans, KG_QA_RESULTS_DIR } from "../../../schemas/sdlc/kg-qa.js";


const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "orphan-sweep-"));
  roots.push(root);
  return root;
}

/** Write a sidecar at the mirrored results path, recording `subjectPath`. */
function sidecar(root: string, relDir: string, stem: string, subjectPath: string | null): string {
  const dir = join(root, KG_QA_RESULTS_DIR, relDir);
  mkdirSync(dir, { recursive: true });
  const p = join(dir, `${stem}.kg-qa.json`);
  writeFileSync(
    p,
    JSON.stringify({
      subject: { kind: "skill", id: stem, path: subjectPath },
      criteria: {},
      totals: { pass: 0, fail: 0, "n/a": 0, unknown: 0 },
    }),
  );
  return p;
}

/** Put a subject file on disk at a repo-relative path. */
function subject(root: string, relPath: string): void {
  mkdirSync(join(root, relPath, ".."), { recursive: true });
  writeFileSync(join(root, relPath), "# a skill\n");
}

describe("the sweep finds what this run did not write", () => {
  test("a sidecar in `written` is not an orphan; one outside it is", () => {
    const root = fixture();
    const kept = sidecar(root, "skills/pkg", "kept", "skills/pkg/kept.md");
    sidecar(root, "skills/pkg", "left", "skills/pkg/left.md");

    const orphans = sweepOrphans(root, new Set([resolve(kept)]));
    expect(orphans.map((o) => o.sidecar)).toEqual([
      join(KG_QA_RESULTS_DIR, "skills/pkg", "left.kg-qa.json"),
    ]);
  });

  test("it recurses — the real orphans sit three and four levels deep", () => {
    // The `folio-paper-adapter/lean-environment-setup/` one is four levels
    // below the results root. A sweep that only read the top would have
    // reported a clean run over every one of them.
    const root = fixture();
    sidecar(root, "skills/a/b/c", "deep", "skills/a/b/c/deep.md");
    expect(sweepOrphans(root, new Set()).map((o) => o.sidecar)).toEqual([
      join(KG_QA_RESULTS_DIR, "skills/a/b/c", "deep.kg-qa.json"),
    ]);
  });

  test("a missing results tree is not a finding", () => {
    // No sidecars yet is a fresh layer, not a defect.
    expect(sweepOrphans(fixture(), new Set())).toEqual([]);
  });

  test("...but an EMPTY results tree is not a finding either, and neither is silence", () => {
    // The regression this file exists for, stated as an assertion rather than
    // as a comment: the broken draft returned [] from the `catch` for a
    // directory it could not read, and [] is also the correct answer for a
    // directory with nothing wrong in it. The two are indistinguishable from
    // the return value alone — so the tests above, which assert a NON-empty
    // result on a tree that has an orphan in it, are the ones that can fail.
    const root = fixture();
    mkdirSync(join(root, KG_QA_RESULTS_DIR), { recursive: true });
    expect(sweepOrphans(root, new Set())).toEqual([]);
  });

  test("a non-sidecar file in the tree is ignored", () => {
    const root = fixture();
    mkdirSync(join(root, KG_QA_RESULTS_DIR), { recursive: true });
    writeFileSync(join(root, KG_QA_RESULTS_DIR, "README.md"), "not a sidecar\n");
    expect(sweepOrphans(root, new Set())).toEqual([]);
  });
});

describe("it says WHY, from the sidecar's own `subject.path`", () => {
  /**
   * The whole reason this function reads the file rather than its name.
   *
   * The first version asked one question — is this in `written`? — then offered
   * the reader a guess between two causes. Both branches were wrong for eight
   * of the twelve it found, and the guess became a finding in bean `3jj9`:
   * *"their verdicts are real and the cause is discovery, not staleness."*
   * Neither half held. Those eight declare `part-of:` and are excluded by
   * `isPartOfASkill` deliberately; their sidecars predate the exclusion.
   *
   * One `existsSync` on a path the sidecar already records splits the two.
   */
  test("subject gone → subjectExists false", () => {
    const root = fixture();
    sidecar(root, "skills/pkg", "moved", "skills/pkg/moved.md");
    const [o] = sweepOrphans(root, new Set());
    expect({ subject: o?.subject, exists: o?.subjectExists }).toEqual({
      subject: "skills/pkg/moved.md",
      exists: false,
    });
  });

  test("subject present but unaudited → subjectExists true", () => {
    // The eight. The file is there, this run did not audit it, and that is a
    // different fact from the file having moved — opposite responses, so the
    // report must not merge them.
    const root = fixture();
    subject(root, "skills/pkg/frag.md");
    sidecar(root, "skills/pkg", "frag", "skills/pkg/frag.md");
    const [o] = sweepOrphans(root, new Set());
    expect({ subject: o?.subject, exists: o?.subjectExists }).toEqual({
      subject: "skills/pkg/frag.md",
      exists: true,
    });
  });

  test("both kinds in one tree are reported separately, not merged", () => {
    const root = fixture();
    subject(root, "skills/pkg/here.md");
    sidecar(root, "skills/pkg", "here", "skills/pkg/here.md");
    sidecar(root, "skills/pkg", "gone", "skills/pkg/gone.md");

    const byStem = Object.fromEntries(
      sweepOrphans(root, new Set()).map((o) => [o.subject, o.subjectExists]),
    );
    expect(byStem).toEqual({ "skills/pkg/here.md": true, "skills/pkg/gone.md": false });
  });

  test("unreadable or path-less → subjectExists UNDEFINED, not false", () => {
    // The third state, and it is the one that matters. "Could not tell"
    // rendered as either answer is how the eight got the wrong diagnosis; a
    // sidecar that cannot be parsed must not be reported as a dead subject,
    // because that is the branch whose advice is "delete it".
    const root = fixture();
    const dir = join(root, KG_QA_RESULTS_DIR, "skills/pkg");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "broken.kg-qa.json"), "{ not json");
    sidecar(root, "skills/pkg", "nopath", null);

    const rows = sweepOrphans(root, new Set()).sort((a, b) =>
      a.sidecar < b.sidecar ? -1 : 1,
    );
    expect(rows.map((o) => o.subjectExists)).toEqual([undefined, undefined]);
    expect(rows.every((o) => "subjectExists" in o === false || o.subjectExists === undefined)).toBe(
      true,
    );
  });
});
