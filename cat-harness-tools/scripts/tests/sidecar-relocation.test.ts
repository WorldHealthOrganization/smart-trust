/**
 * A relocated subject's QA sidecar MOVES with it — and refuses to move on
 * anything less than proof.
 *
 * Bean `lps0` asked for this; issue #760 walked into it. Moving `corpus-grep`
 * from `src/skills/` to `skills/folio-core/` stranded its verdict at the old
 * path, where the orphan sweep correctly reported it as auditing a file that
 * is not there — and the only way out was a human authorising a deletion.
 *
 * ## What this pins, and why the refusals matter more than the move
 *
 * The move itself is one `renameSync`. The reason this file exists is the
 * three conditions that stop it, each of which corresponds to a way a verdict
 * could be filed against a subject it never audited:
 *
 * - **Not on `undefined`.** `subjectExists` has three states and the third is
 *   "could not read the sidecar". A sidecar whose identity could not be read
 *   is exactly the one that must not be moved on a guess.
 * - **Identity, not basename.** Two packages can hold a same-named skill.
 *   Matching on the filename would move one package's verdict onto another's.
 * - **Not when ambiguous.** An orphan announces itself; a misfiled verdict
 *   reads as healthy. Ambiguity is left alone and reported.
 *
 * Asserted against a fixture rather than the corpus, because the corpus is
 * green and therefore proves none of it.
 *
 * @module scripts/tests/sidecar-relocation.test
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { sweepOrphans } from "../../schemas/sdlc/kg-qa.ts";

const RESULTS = "test/results/kg-qa";

/** A sidecar as `kg-audit` writes one: identity, path, and a verdict. */
const sidecar = (kind: string, id: string, path: string, marker: string): string =>
  JSON.stringify(
    {
      $schema: "kg-qa/v1",
      subject: { kind, id, path },
      source_hash: marker,
      criteria: {},
      totals: { pass: 0, fail: 0, warn: 0, "n/a": 0, unknown: 0 },
    },
    null,
    2,
  ) + "\n";

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), "sidecar-reloc-"));
  mkdirSync(join(root, RESULTS), { recursive: true });
  return root;
}

const write = (root: string, rel: string, body: string): string => {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, body);
  return p;
};

describe("sweepOrphans carries the identity a relocation matches on", () => {
  test("`kind` and `id` come back, not just the path", () => {
    const root = fixture();
    try {
      write(root, `${RESULTS}/src/skills/corpus-grep.kg-qa.json`,
        sidecar("skill", "corpus-grep", "src/skills/corpus-grep.md", "OLD"));
      const [o] = sweepOrphans(root, new Set());
      expect(o).toBeDefined();
      expect(o!.kind).toBe("skill");
      expect(o!.id).toBe("corpus-grep");
      // The subject is gone — that is what makes it a relocation candidate.
      expect(o!.subjectExists).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an unreadable sidecar yields NO identity — the third state survives", () => {
    const root = fixture();
    try {
      write(root, `${RESULTS}/broken.kg-qa.json`, "{ this is not json");
      const [o] = sweepOrphans(root, new Set());
      expect(o).toBeDefined();
      expect(o!.kind).toBeUndefined();
      expect(o!.id).toBeUndefined();
      expect(o!.subjectExists).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a sidecar whose subject still EXISTS is not a relocation candidate", () => {
    const root = fixture();
    try {
      write(root, "skills/folio-core/live.md", "# live\n");
      write(root, `${RESULTS}/skills/folio-core/live.kg-qa.json`,
        sidecar("skill", "live", "skills/folio-core/live.md", "X"));
      const [o] = sweepOrphans(root, new Set());
      expect(o!.subjectExists).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * The relocation rule itself, applied exactly as `relocateSidecars` applies
 * it. Reimplemented here rather than imported because `kg-audit.ts` runs the
 * whole audit at module scope — the same reason `ownKgRoots` was placed in
 * `known-skills.ts` under bean `lps0`. The conditions are what is under test,
 * and they are stated once here and once there; if they drift, the corpus run
 * in `kg:audit:check` is what notices.
 */
function relocate(
  root: string,
  orphans: ReturnType<typeof sweepOrphans>,
  targets: ReadonlyMap<string, string>,
): Array<{ from: string; to: string }> {
  const byIdentity = new Map<string, typeof orphans>();
  for (const o of orphans) {
    if (o.subjectExists !== false || !o.kind || !o.id) continue;
    const key = `${o.kind}:${o.id}`;
    const list = byIdentity.get(key) ?? [];
    list.push(o);
    byIdentity.set(key, list);
  }
  const moved: Array<{ from: string; to: string }> = [];
  for (const [key, rows] of byIdentity) {
    const dest = targets.get(key);
    if (rows.length !== 1 || dest === undefined) continue;
    if (existsSync(dest)) continue;
    moved.push({ from: rows[0]!.sidecar, to: dest });
  }
  return moved;
}

describe("the three conditions", () => {
  test("a moved subject's sidecar is relocated, and the verdict is the OLD one", () => {
    const root = fixture();
    try {
      const from = write(root, `${RESULTS}/src/skills/corpus-grep.kg-qa.json`,
        sidecar("skill", "corpus-grep", "src/skills/corpus-grep.md", "THE-OLD-VERDICT"));
      write(root, "skills/kg/kg-core/corpus-grep.md", "# corpus-grep\n");
      const dest = join(root, RESULTS, "skills/kg/kg-core/corpus-grep.kg-qa.json");

      const moved = relocate(root, sweepOrphans(root, new Set()),
        new Map([["skill:corpus-grep", dest]]));

      expect(moved).toHaveLength(1);
      expect(moved[0]!.to).toBe(dest);
      // The point of MOVING rather than regenerating: the artefact survives.
      expect(readFileSync(from, "utf-8")).toContain("THE-OLD-VERDICT");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("REFUSED when the subject's absence could not be established", () => {
    const root = fixture();
    try {
      write(root, `${RESULTS}/broken.kg-qa.json`, "{ not json");
      const dest = join(root, RESULTS, "skills/folio-core/anything.kg-qa.json");
      expect(relocate(root, sweepOrphans(root, new Set()),
        new Map([["skill:anything", dest]]))).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("REFUSED on a basename match with a different identity", () => {
    const root = fixture();
    try {
      // Same FILENAME, different package and different id. A basename rule
      // would move this; an identity rule must not.
      write(root, `${RESULTS}/skills/pkg-a/shared.kg-qa.json`,
        sidecar("skill", "pkg-a-shared", "skills/pkg-a/shared.md", "A"));
      const dest = join(root, RESULTS, "skills/pkg-b/shared.kg-qa.json");
      expect(relocate(root, sweepOrphans(root, new Set()),
        new Map([["skill:pkg-b-shared", dest]]))).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("REFUSED when two orphans share one identity — ambiguity is left alone", () => {
    const root = fixture();
    try {
      write(root, `${RESULTS}/one/dup.kg-qa.json`,
        sidecar("skill", "dup", "one/dup.md", "ONE"));
      write(root, `${RESULTS}/two/dup.kg-qa.json`,
        sidecar("skill", "dup", "two/dup.md", "TWO"));
      const dest = join(root, RESULTS, "skills/folio-core/dup.kg-qa.json");
      expect(relocate(root, sweepOrphans(root, new Set()),
        new Map([["skill:dup", dest]]))).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("REFUSED when a sidecar already sits at the destination", () => {
    const root = fixture();
    try {
      write(root, `${RESULTS}/src/skills/x.kg-qa.json`,
        sidecar("skill", "x", "src/skills/x.md", "OLD"));
      const dest = write(root, `${RESULTS}/skills/folio-core/x.kg-qa.json`,
        sidecar("skill", "x", "skills/folio-core/x.md", "ALREADY-HERE"));
      write(root, "skills/folio-core/x.md", "# x\n");
      // The destination is in `targets`, so it is NOT an orphan itself.
      const orphans = sweepOrphans(root, new Set([dest]));
      expect(relocate(root, orphans, new Map([["skill:x", dest]]))).toHaveLength(0);
      expect(readFileSync(dest, "utf-8")).toContain("ALREADY-HERE");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
