/**
 * `publish-instance-files` tests that read the aggregate repository's own root
 * — `.github/workflows/docs-site.yml` — moved here from
 * `cat-harness-tools/scripts/tests/sdlc/publish-instance-files.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const REPO_ROOT = join(ORIGIN_DIR, "..", "..", "..");

describe("served-name collisions are chosen, never won by step order (Phase 4, bean xsqm)", () => {
  const tmp = mkdtempSync(join(tmpdir(), "pif-collide-"));
  const inst = join(tmp, "inst");
  mkdirSync(inst, { recursive: true });
  writeFileSync(join(inst, "bootstrap.json"), '{"name":"bootstrap"}\n');
  writeFileSync(join(inst, "ns.jsonld"), '{"@id":"x"}\n');

  test("both workflows name exactly the one collision they chose", () => {
    for (const wf of ["docs-site.yml", "feature-staging.yml"]) {
      const text = readFileSync(join(REPO_ROOT, ".github", "workflows", wf), "utf-8");
      const step = text.split("\n").find((l) => /^\s*bun run cat-harness(?:-tools)?\/scripts\/publish-instance-files\.ts/.test(l));
      expect({ wf, allow: /--allow-collision\s+(\S+)/.exec(step ?? "")?.[1] }).toEqual({ wf, allow: "bootstrap.json" });
    }
    rmSync(tmp, { recursive: true, force: true });
  });
});
