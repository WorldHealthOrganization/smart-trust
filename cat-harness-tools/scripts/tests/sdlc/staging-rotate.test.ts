/**
 * `staging-rotate` — the preview cap. Owner ruling 2026-10-02, issue #1868,
 * amended 2026-10-04 from a count of ten to a size budget of 3 GB.
 *
 * @module scripts/tests/staging-rotate.test
 *
 * Five properties the ruling and `deletion-requires-confirmation` between them
 * require: under the budget nothing goes; over it the OLDEST go; the preview
 * being staged never goes; `_retired/` and anything that is not a preview are
 * never touched; and a preview with no stamp still gets an age from the
 * fallbacks rather than being treated as new.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { createStagingPreview, readStagingPreview, serializeStagingPreview } from "../../../schemas/sdlc/staging-preview.ts";
import {
  MAX_PREVIEW_BYTES,
  STAGED_AT_FILE,
  isPreviewName,
  planRotation,
  readPreviews,
  rotate,
  type GitTime,
  type Preview,
} from "../../staging-rotate.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const NOW = "2026-10-02T12:00:00.000Z";
const NOW_MS = Date.parse(NOW);
const HOUR = 3_600_000;
const noGit: GitTime = () => undefined;

function p(slug: string, hoursAgo: number | undefined, bytes = 100): Preview {
  return {
    slug,
    updatedMs: hoursAgo === undefined ? undefined : NOW_MS - hoursAgo * HOUR,
    source: hoursAgo === undefined ? "unknown" : "stamp",
    bytes,
  };
}

/** A scratch `gh-pages` checkout with one directory per `[slug, hoursAgo]`. */
function pages(previews: [string, number | undefined][]): string {
  const dir = mkdtempSync(join(tmpdir(), "staging-rotate-"));
  for (const [slug, h] of previews) {
    const d = join(dir, "branches", slug);
    mkdirSync(d, { recursive: true });
    // 100 bytes each, so a budget of N x 100 holds N previews. The stamp
    // written below adds its own bytes, which is why budgets here leave room.
    writeFileSync(join(d, "index.html"), "x".repeat(100));
    if (h !== undefined) writeFileSync(join(d, STAGED_AT_FILE), new Date(NOW_MS - h * HOUR).toISOString());
  }
  return dir;
}

const remaining = (dir: string) => readdirSync(join(dir, "branches")).sort();

describe("the cap is the owner's number", () => {
  test("3 GB of previews in total, defined once", () => {
    expect(MAX_PREVIEW_BYTES).toBe(3 * 1024 ** 3);
  });
});

// Every preview below is 100 bytes unless it says otherwise, so a budget of
// N x 100 holds exactly N of them.
describe("planRotation — pure", () => {
  test("under the budget, nothing is removed", () => {
    const plan = planRotation([p("a", 1), p("b", 50), p("c", 500)], "a", 1000);
    expect(plan.remove).toEqual([]);
    expect(plan.keep.map((x) => x.slug).sort()).toEqual(["a", "b", "c"]);
  });

  test("exactly at the budget, nothing is removed — the current preview counts", () => {
    const all = Array.from({ length: 10 }, (_, i) => p(`s${i}`, i));
    expect(planRotation(all, "s0", 1000).remove).toEqual([]);
  });

  test("over the budget, the OLDEST are removed", () => {
    const all = Array.from({ length: 13 }, (_, i) => p(`s${String(i).padStart(2, "0")}`, i));
    const plan = planRotation(all, "s00", 1000);
    expect(plan.remove.map((x) => x.slug)).toEqual(["s10", "s11", "s12"]);
    expect(plan.keep).toHaveLength(10);
  });

  test("size decides how many fit: one large preview displaces several small ones", () => {
    const plan = planRotation([p("cur", 0, 300), p("big", 1, 500), p("a", 2), p("b", 3), p("c", 4)], "cur", 1000);
    expect(plan.keep.map((x) => x.slug)).toEqual(["cur", "big", "a", "b"]);
    expect(plan.remove.map((x) => x.slug)).toEqual(["c"]);
  });

  test("strictly by recency: an older small preview never outlives a newer one that did not fit", () => {
    const plan = planRotation([p("cur", 0, 600), p("newer", 1, 500), p("older", 2, 100)], "cur", 1000);
    expect(plan.keep.map((x) => x.slug)).toEqual(["cur"]);
    expect(plan.remove.map((x) => x.slug)).toEqual(["newer", "older"]);
  });

  test("the current preview is never removed, even when it is the oldest", () => {
    const all = [p("cur", 9999), ...Array.from({ length: 12 }, (_, i) => p(`o${i}`, i))];
    const plan = planRotation(all, "cur", 1000);
    expect(plan.keep.map((x) => x.slug)).toContain("cur");
    expect(plan.remove.map((x) => x.slug)).not.toContain("cur");
    expect(plan.keep).toHaveLength(10);
  });

  test("a current preview over the whole budget is kept, and everything else goes", () => {
    const plan = planRotation([p("cur", 0, 5000), p("a", 1), p("b", 2)], "cur", 1000);
    expect(plan.keep.map((x) => x.slug)).toEqual(["cur"]);
    expect(plan.remove.map((x) => x.slug)).toEqual(["a", "b"]);
  });

  test("the current preview not yet on the tree takes no bytes", () => {
    const all = Array.from({ length: 10 }, (_, i) => p(`o${i}`, i));
    expect(planRotation(all, "new", 1000).remove).toEqual([]);
    expect(planRotation(all, "new", 900).remove.map((x) => x.slug)).toEqual(["o9"]);
  });

  test("unknown ages sort oldest; ties break by slug", () => {
    const plan = planRotation([p("cur", 0), p("b", 5), p("z", 5), p("u", undefined)], "cur", 200);
    expect(plan.keep.map((x) => x.slug)).toEqual(["cur", "b"]);
    expect(plan.remove.map((x) => x.slug)).toEqual(["z", "u"]);
  });

  test("a budget that is not a positive number of bytes is refused", () => {
    expect(() => planRotation([], "x", 0)).toThrow();
    expect(() => planRotation([], "x", Number.NaN)).toThrow();
  });
});

describe("what counts as a preview", () => {
  test("_retired, dot- and underscore-entries and non-slugs are not previews", () => {
    expect(isPreviewName("_retired")).toBe(false);
    expect(isPreviewName(".git")).toBe(false);
    expect(isPreviewName("_reserved")).toBe(false);
    expect(isPreviewName("has space")).toBe(false);
    expect(isPreviewName("claude-foo-bar")).toBe(true);
  });
});

describe("rotate — on a checkout", () => {
  test("under the budget, nothing is removed and the current preview is stamped", () => {
    const dir = pages([["cur", undefined], ["a", 3], ["b", 30]]);
    const { plan } = rotate({ dir, current: "cur", now: NOW, git: noGit });
    expect(plan.remove).toEqual([]);
    expect(remaining(dir)).toEqual(["a", "b", "cur"]);
    expect(readFileSync(join(dir, "branches", "cur", STAGED_AT_FILE), "utf8").trim()).toBe(NOW);
  });

  test("over the budget, the oldest go, each with a render-log entry and a retired record", () => {
    const list: [string, number][] = Array.from({ length: 11 }, (_, i) => [`p${String(i).padStart(2, "0")}`, i + 1]);
    const dir = pages([["cur", undefined], ...list]);
    // Give the oldest a record, so its retirement can be checked.
    const rec = createStagingPreview({
      slug: "p10",
      branch: "claude/p10",
      commit: "abc1234",
      builtAt: "2026-09-01T00:00:00Z",
    });
    writeFileSync(join(dir, "branches", "p10", "staging-preview.json"), serializeStagingPreview(rec));

    const { plan, lines } = rotate({ dir, current: "cur", now: NOW, git: noGit, budget: 1300 });
    expect(plan.remove.map((x) => x.slug)).toEqual(["p09", "p10"]);
    expect(existsSync(join(dir, "branches", "p09"))).toBe(false);
    expect(existsSync(join(dir, "branches", "p10"))).toBe(false);
    expect(existsSync(join(dir, "branches", "cur"))).toBe(true);
    expect(lines[0]).toMatch(/rotated off branches\/p09: 10\.0h old/);

    const retired = readStagingPreview(readFileSync(join(dir, "branches", "_retired", "p10.json"), "utf8")).node;
    expect(retired?.staging.retiredOn).toBe(NOW);
    expect(retired?.staging.retiredReason).toContain("#1868");

    const log = readFileSync(join(dir, "_render-log", "2026-10-02.jsonl"), "utf8").trim().split("\n");
    expect(log.map((l) => JSON.parse(l).subject.path).sort()).toEqual(["branches/p09", "branches/p10"]);
    expect(log.every((l) => JSON.parse(l).event === "removed")).toBe(true);
  });

  test("_retired and non-preview entries are untouched, and do not count toward the budget", () => {
    const dir = pages([["cur", undefined], ["a", 1], ["b", 2]]);
    mkdirSync(join(dir, "branches", "_retired"), { recursive: true });
    writeFileSync(join(dir, "branches", "_retired", "old.json"), "{}");
    writeFileSync(join(dir, "branches", "README.txt"), "not a preview");
    mkdirSync(join(dir, "branches", ".hidden"));
    const { plan } = rotate({ dir, current: "cur", now: NOW, git: noGit, budget: 300 });
    expect(plan.remove.map((x) => x.slug)).toEqual(["b"]);
    expect(remaining(dir)).toEqual([".hidden", "README.txt", "_retired", "a", "cur"]);
    expect(readFileSync(join(dir, "branches", "_retired", "old.json"), "utf8")).toBe("{}");
  });

  test("a missing stamp falls back: render log, then record, then git", () => {
    const dir = pages([["cur", undefined], ["logged", undefined], ["recorded", undefined], ["gitonly", undefined]]);
    mkdirSync(join(dir, "_render-log"));
    writeFileSync(
      join(dir, "_render-log", "2026-10-01.jsonl"),
      JSON.stringify({
        $schema: "folio-render-log/v1",
        id: "x",
        at: "2026-10-01T12:00:00.000Z",
        event: "rendered",
        subject: { kind: "staging-preview", path: "branches/logged", slug: "logged" },
        summary: "staging preview published",
        process: "Process_RenderLog",
        capture: "on",
      }) + "\n",
    );
    writeFileSync(
      join(dir, "branches", "recorded", "staging-preview.json"),
      serializeStagingPreview(
        createStagingPreview({ slug: "recorded", branch: "b", commit: "c", builtAt: "2026-09-25T00:00:00Z" }),
      ),
    );
    const git: GitTime = (_d, path) => (path === "branches/gitonly" ? Date.parse("2026-09-01T00:00:00Z") : undefined);

    const byslug = Object.fromEntries(readPreviews(dir, git).map((x) => [x.slug, x]));
    expect(byslug.logged.source).toBe("render-log");
    expect(byslug.recorded.source).toBe("record");
    expect(byslug.gitonly.source).toBe("git");
    expect(byslug.cur.source).toBe("unknown");

    // Room for `cur` plus one more: the newest of the rest, the render-logged one.
    const { plan } = rotate({ dir, current: "cur", now: NOW, git, budget: 250 });
    expect(plan.keep.map((x) => x.slug)).toEqual(["cur", "logged"]);
    expect(plan.remove.map((x) => x.slug)).toEqual(["recorded", "gitonly"]);
  });

  test("refuses a current slug that is not a preview name", () => {
    const dir = pages([]);
    expect(() => rotate({ dir, current: "_retired", now: NOW, git: noGit })).toThrow();
    expect(() => rotate({ dir, current: "..", now: NOW, git: noGit })).toThrow();
  });
});

describe("the stage job runs the rotation where a lost race re-applies it", () => {
  // The workflow lives at the REPOSITORY root, one level above this layer.
  const YML = readFileSync(
    join(repoRootFor(resolve(HARNESS_ROOT)), ".github", "workflows", "feature-staging.yml"),
    "utf-8",
  );
  const step = YML.slice(YML.indexOf("- name: Deploy the preview and log the render, in one commit"));
  const body = step.slice(0, step.indexOf("\n      - name:", 10));

  test("inside the attempt loop, after the re-read and before the push", () => {
    const loop = body.indexOf('while [ "$attempt" -le 3 ]; do');
    const reset = body.indexOf("git -C pages reset --hard FETCH_HEAD");
    const rot = body.indexOf("staging-rotate.ts --dir pages");
    const push = body.indexOf("git -C pages push origin gh-pages");
    expect([loop, reset, rot, push].every((i) => i > -1)).toBe(true);
    expect(reset).toBeGreaterThan(loop);
    expect(rot).toBeGreaterThan(reset);
    expect(push).toBeGreaterThan(rot);
  });

  test("passes no budget of its own — the number lives once, in the script", () => {
    expect(body).not.toMatch(/staging-rotate\.ts[^\n]*--(max|budget)/);
    expect(YML).not.toMatch(/MAX_PREVIEW(S|_BYTES):/);
  });
});
