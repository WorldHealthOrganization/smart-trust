/**
 * QA on init (bean `tw61`, the owner's "setup proper QA on init"): a folio
 * scaffolded by init-folio is swept by the command its own AGENTS.md
 * documents, the verdicts land at the LAYER root, and the preview's QA
 * summary reads them, including for a folio kept in a subfolder, as the
 * ojcx run's `handbook/` is.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { initFolio } from "../init-folio";
import { SCRIPT_SIDECAR_DIR } from "../../pipeline/qa-utils.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO_ROOT = resolve(dirname(HARNESS_ROOT));
const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("a new folio is QA'd from its first commit", () => {
  test("AGENTS.md documents the sweep and where its verdicts go", () => {
    const repo = mkdtempSync(join(tmpdir(), "init-qa-doc-"));
    dirs.push(repo);
    const root = join(repo, "doc");
    initFolio({ targetDir: root, contentType: "document", slug: "qa-doc", title: "QA Doc", authors: ["A"], link: "sibling", assistantPath: "folio-assistant", skipVcs: true });
    const agents = readFileSync(join(root, "AGENTS.md"), "utf-8");
    expect(agents).toContain("bun run folio-assistant/cat-harness-tools/pipeline/qa-sweep.ts folio");
    expect(agents).toContain("test/results/block-qa/");
    // The old sibling layout is no longer taught.
    expect(agents).not.toContain("<chapter>/<root>.qa.json");
  });

  test("swept from the repository root, as CI does, a subfolder folio's verdicts land at ITS root and the summary finds them", () => {
    const repo = mkdtempSync(join(tmpdir(), "init-qa-repo-"));
    dirs.push(repo);
    const folio = join(repo, "handbook");
    initFolio({ targetDir: folio, contentType: "document", slug: "qa-sub", title: "QA Sub", authors: ["A"], link: "sibling", assistantPath: "../platform", skipVcs: true });
    symlinkSync(REPO_ROOT, join(repo, "platform"));

    // ── `--script-sidecar-root`, and it is not tidiness (bean `ymsu`) ──────
    //
    // `qa-sweep.ts` writes one script sidecar per automated criterion, and
    // their home is resolved from the SWEEP SCRIPT's location, not from the
    // folio being swept. So this test — sweeping a temp-directory folio —
    // wrote into `cat-harness/content/pipeline/script-sidecars/` of the real
    // platform checkout, inside `bun test`, which is gate 1 of `bun run cat gates`.
    // Every gate ordered after it then read a repaired copy.
    //
    // Measured on origin/main e718627f198: with one sidecar's `script_hash`
    // hand-staled to `deadbeefdead`, `bun test` on THIS FILE ALONE put the
    // true value back.
    //
    // Pointed at a directory this test owns, so the real write still happens
    // and lands where the test can assert on it.
    const sidecars = join(repo, "sidecar-root");
    // `env` explicitly: Bun does not pass runtime-set variables to a child, and
    // standalone the preload sets FOLIO_FIXTURE_CHECKOUT (the vocabulary).
    const sweep = spawnSync("bun", ["run", join(REPO_ROOT, "cat-harness-tools/pipeline/qa-sweep.ts"), "handbook/folio", "--script-sidecar-root", sidecars], { cwd: repo, encoding: "utf-8", env: { ...process.env } });
    expect(sweep.status).toBe(0);
    // ANTI-VACUITY. Without this, "the platform checkout was not written to"
    // would also be satisfied by a flag that silently disabled the write, or
    // by a sweep that found no automated criteria at all — and this test would
    // pass over exactly the emptiness it is supposed to rule out.
    const wrote = readdirSync(join(sidecars, SCRIPT_SIDECAR_DIR));
    expect(wrote.length).toBeGreaterThan(0);
    expect(wrote.every((f) => f.endsWith(".script.json"))).toBe(true);
    expect(existsSync(join(folio, "test/results/block-qa/folio/qa-sub/introduction/overview.qa.json"))).toBe(true);
    // Not at the repository root, and not inside the content graph.
    expect(existsSync(join(repo, "test"))).toBe(false);
    expect(existsSync(join(folio, "folio/test"))).toBe(false);

    const out = join(repo, "block-qa.json");
    const pub = spawnSync("bun", ["run", join(REPO_ROOT, "cat-harness-tools/scripts/publish-block-qa.ts"), "--folio", "handbook/folio", "--out", out], { cwd: repo, encoding: "utf-8", env: { ...process.env } });
    expect(pub.status).toBe(0);
    const summary = JSON.parse(readFileSync(out, "utf-8")) as { counts: Record<string, number> };
    // The regression: with the repository root as the anchor, every block read unaudited.
    expect(summary.counts.unaudited).toBe(0);
    expect(summary.counts.passing + summary.counts.failing).toBeGreaterThan(0);
  }, 60_000);
});
