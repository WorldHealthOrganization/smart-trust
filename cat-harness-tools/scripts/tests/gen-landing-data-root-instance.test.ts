/**
 * Landing data for the CHECKOUT-ROOT layer never reads outside the checkout.
 *
 * Measured 2026-10-15, publishing litlfred/smart-ra from `~/space_cats/smart-ra`:
 * `gen-landing-data` resolved sticky themes against `repoRootFor(ROOT)`, which
 * is `dirname`. For a folio whose landing IS the repository that is the
 * directory holding the clone, so `themeByRef` scanned every sibling clone and
 * the build died on a stranger's declaration —
 * `qou/qou.json: directory "lake-cache" declares unknown graph typology`.
 *
 * The fixture is that machine in miniature: a parent directory holding an
 * unrelated, INVALID declaration (sorted first, so the old scan reaches it
 * before anything else) beside a git checkout whose root layer is the
 * landing. The build must succeed and must carry the root's own card — the
 * second assertion is what keeps the first from passing on an empty board.
 *
 * @module scripts/tests/gen-landing-data-root-instance.test
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { contributingRoots, ensureLandingSticky } from "../ensure-landing-sticky.ts";
import { readDeclaration } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const SCRIPT = join(import.meta.dir, "..", "gen-landing-data.ts");

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

/** `parent/` holding a stranger's invalid declaration and the `folio/` checkout. */
function fixture(): { parent: string; checkout: string } {
  const parent = mkdtempSync(join(tmpdir(), "landing-root-"));

  // The stranger: a sibling clone this build has no business reading. Its
  // declaration is invalid on purpose — reading it throws, so a scan that
  // reaches it fails loudly instead of passing silently. Malformed JSON rather
  // than the unknown typology measured on the machine: whether a typology is
  // known depends on which layers registered theirs, and standing alone
  // (`check:standalone`) none had, so that file read as valid there.
  mkdirSync(join(parent, "aaa-stranger"));
  writeFileSync(join(parent, "aaa-stranger", "aaa-stranger.json"), '{ "name": "aaa-stranger", not json\n');

  // The checkout: a root layer that is the site's sole landing, with the
  // platform nested beneath it as a lock mount would lay it down.
  const checkout = join(parent, "folio");
  mkdirSync(checkout);
  expect(spawnSync("git", ["init", "-q", checkout]).status).toBe(0);
  writeFileSync(
    join(checkout, "folio.json"),
    json({
      name: "folio",
      description: "the checkout-root instance",
      stickies: [{ id: "folio", order: 10, theme: { themeId: "engineer" }, body: "the folio's card" }],
      directories: [{ id: "folio-docs", path: "docs/", graphTypologies: ["docs"] }],
    }),
  );
  mkdirSync(join(checkout, "docs"));
  writeFileSync(join(checkout, "index.config.json"), json({ $schema: "folio-index-config/v1", instances: [{ name: "folio", source: { local: { at: "." } } }] }));
  mkdirSync(join(checkout, "cat-harness"));
  writeFileSync(join(checkout, "cat-harness", "cat-harness.json"), json({ name: "cat-harness", description: "the platform" }));
  // The platform's code list: since bean `8lcl` the namespaces module reads it
  // from wherever the harness is, and here the harness is this fixture.
  mkdirSync(join(checkout, "cat-harness", "code-lists"));
  copyFileSync(join(HARNESS_ROOT, "code-lists", "own-namespaces.json"), join(checkout, "cat-harness", "code-lists", "own-namespaces.json"));

  ensureLandingSticky(checkout, "2026-10-15T00:00:00.000Z");
  return { parent, checkout };
}

describe("gen-landing-data for a checkout-root landing", () => {
  test("the stranger's declaration really is invalid (not vacuous)", () => {
    const { parent } = fixture();
    try {
      expect(() => readDeclaration(join(parent, "aaa-stranger"))).toThrow();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test("builds the root's board and never reads beside the checkout", () => {
    const { parent, checkout } = fixture();
    try {
      const run = spawnSync("bun", ["run", SCRIPT], {
        cwd: checkout,
        env: { ...process.env, CAT_HARNESS_ROOT: join(checkout, "cat-harness") },
        encoding: "utf8",
      });
      expect(run.stderr).not.toContain("aaa-stranger");
      expect(run.status).toBe(0);
      const board = JSON.parse(readFileSync(join(checkout, "docs", "_data", "stickies.json"), "utf8")) as { id: string }[] | { stickies: { id: string }[] };
      const cards = Array.isArray(board) ? board : board.stickies;
      expect(cards.map((c) => c.id)).toContain("folio");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("gen-landing-data --check when the board is built at publish (owner, 2026-11-13)", () => {
  test("a layer that declares docs/_data/stickies.json builtAtPublish has nothing committed to judge: not applicable", () => {
    const { parent, checkout } = fixture();
    try {
      const decl = JSON.parse(readFileSync(join(checkout, "folio.json"), "utf8"));
      // declared-path-literal: a test vector — the board path a fixture declaration names as builtAtPublish, written as a declaration holds it.
      decl.builtAtPublish = [{ path: "docs/_data/stickies.json", writer: ["landing:data"], because: "checkout", reason: "fixture" }];
      writeFileSync(join(checkout, "folio.json"), json(decl));
      const run = spawnSync("bun", ["run", SCRIPT, "--check"], {
        cwd: checkout,
        env: { ...process.env, CAT_HARNESS_ROOT: join(checkout, "cat-harness") },
        encoding: "utf8",
      });
      expect(run.status).toBe(78);
      expect(`${run.stdout}${run.stderr}`).toContain("builtAtPublish");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  test("without the declaration, a missing board is still stale", () => {
    const { parent, checkout } = fixture();
    try {
      const run = spawnSync("bun", ["run", SCRIPT, "--check"], {
        cwd: checkout,
        env: { ...process.env, CAT_HARNESS_ROOT: join(checkout, "cat-harness") },
        encoding: "utf8",
      });
      expect(run.status).toBe(1);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe("contributingRoots for a checkout-root instance", () => {
  // The `.git` guard in `contributingRoots` stops a scan of a plain parent,
  // but not of a parent that is a checkout too — a Claude Code worktree, whose
  // `repoRootFor` is the MAIN checkout. Its layers are another tree's.
  test("never takes an instance from a parent checkout as a layer", () => {
    const parent = mkdtempSync(join(tmpdir(), "landing-root-git-"));
    try {
      expect(spawnSync("git", ["init", "-q", parent]).status).toBe(0);
      mkdirSync(join(parent, "other"));
      writeFileSync(join(parent, "other", "other.json"), json({ name: "other", description: "another tree's instance" }));
      const checkout = join(parent, "folio");
      mkdirSync(checkout);
      expect(spawnSync("git", ["init", "-q", checkout]).status).toBe(0);
      writeFileSync(join(checkout, "folio.json"), json({ name: "folio", description: "the checkout-root instance" }));
      const roots = contributingRoots(checkout);
      expect(roots).toContain(checkout);
      expect(roots).not.toContain(join(parent, "other"));
      expect(roots).not.toContain(parent);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
