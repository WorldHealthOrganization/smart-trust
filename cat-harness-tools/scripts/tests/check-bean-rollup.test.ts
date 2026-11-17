/**
 * The guard has to FAIL on each contradiction it claims to catch, and to stay
 * SILENT on the two shapes that look like one and are not.
 *
 * Written against temp stores rather than the real one on purpose: the real
 * corpus has zero findings in one direction and one baselined finding in the
 * other, so a test that only asserted "the repo passes" would go on passing if
 * the checker were gutted to `return []`.
 *
 * Two of these cases are regressions against mistakes made while writing it.
 * The childless-`feature` case is the first draft's own false positive — nine
 * beans reported as containers whose work was finished, when they had no
 * children at all. The unjudged case is the sweep refusing to convict 47 beans
 * of the GitHub API being unreachable.
 *
 * @module scripts/tests/check-bean-rollup
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readBeans } from "../beans.ts";
import { ageDays, rollupFindings, sweep } from "../check-bean-rollup.ts";

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A store of beans, each given as [id, status, type, parent, updatedAt?]. */
function store(beans: Array<[string, string, string, string, string?]>): string {
  const root = mkdtempSync(join(tmpdir(), "beanrollup-"));
  made.push(root);
  const dir = join(root, "beans", "defs");
  mkdirSync(dir, { recursive: true });
  for (const [id, status, type, parent, updated] of beans) {
    writeFileSync(
      join(dir, `${id}.md`),
      `---\n# ${id}\ntitle: '${id} title'\nstatus: ${status}\ntype: ${type}\n` +
        (parent ? `parent: ${parent}\n` : "") +
        `updated_at: ${updated ?? "2026-09-22T18:00:00Z"}\n` +
        `---\n\nbody\n`,
    );
  }
  return root;
}

const read = (root: string) => readBeans(root) ?? [];

describe("a status its own subtree refutes", () => {
  test("an open container whose every child is closed is reported", () => {
    const f = rollupFindings(
      read(store([
        ["ep1", "in-progress", "epic", ""],
        ["t1", "completed", "task", "ep1"],
        ["t2", "scrapped", "task", "ep1"],
      ])),
    );
    expect(f.map((x) => x.kind)).toEqual(["open-container-closed-subtree"]);
    expect(f[0]!.message).toContain("asserts live work its own subtree denies");
  });

  test("a closed container with an open child is reported, and names the count", () => {
    const f = rollupFindings(
      read(store([
        ["ep1", "completed", "epic", ""],
        ["t1", "todo", "task", "ep1"],
        ["t2", "in-progress", "task", "ep1"],
        ["t3", "completed", "task", "ep1"],
      ])),
    );
    expect(f.map((x) => x.kind)).toEqual(["closed-container-open-subtree"]);
    expect(f[0]!.message).toContain("2 open child(ren)");
  });

  test("a container with one open child is silent in both directions", () => {
    expect(
      rollupFindings(
        read(store([
          ["ep1", "in-progress", "epic", ""],
          ["t1", "completed", "task", "ep1"],
          ["t2", "in-progress", "task", "ep1"],
        ])),
      ),
    ).toEqual([]);
  });

  /* THE FIRST DRAFT'S OWN FALSE POSITIVE. "No open child" is vacuously true
   * of every leaf in the store; nine `feature` beans with zero children were
   * duly reported as containers whose work was done. */
  test("a childless bean is never judged as a container, whatever its type", () => {
    expect(
      rollupFindings(
        read(store([
          ["f1", "in-progress", "feature", ""],
          ["f2", "completed", "feature", ""],
          ["m1", "in-progress", "milestone", ""],
        ])),
      ),
    ).toEqual([]);
  });

  test("the key is the rule and the id, so a title edit cannot move it", () => {
    const f = rollupFindings(
      read(store([["ep1", "completed", "epic", ""], ["t1", "todo", "task", "ep1"]])),
    );
    expect(f[0]!.key).toBe("closed-container-open-subtree:ep1");
  });
});

describe("the sweep carries the clock, and declines to guess", () => {
  const NOW = new Date("2026-09-22T18:00:00Z");
  const corpus = () =>
    read(
      store([
        ["ep1", "in-progress", "epic", "", "2026-09-19T18:00:00Z"],
        ["t1", "in-progress", "task", "ep1", "2026-09-19T18:00:00Z"],
        ["t2", "in-progress", "task", "ep1", "2026-09-19T18:00:00Z"],
        ["t3", "in-progress", "task", "ep1", "2026-09-22T17:00:00Z"],
      ]),
    );

  test("a container with a live child is never counted as a stale claim", () => {
    const s = sweep(corpus(), NOW, new Set<string>());
    const live = s.buckets.find((b) => b.name === "container-live")!;
    expect(live.beans.map((b) => b.split(" ")[0])).toEqual(["ep1"]);
    expect(live.reading).toContain("the claim is TRUE");
  });

  test("a claim touched today is not untouched", () => {
    const s = sweep(corpus(), NOW, new Set<string>());
    expect(s.inProgress).toBe(4);
    expect(s.untouched).toBe(3);
    expect(s.buckets.flatMap((b) => b.beans).join(" ")).not.toContain("t3");
  });

  test("an open PR naming a leaf makes it live, not a candidate", () => {
    const s = sweep(corpus(), NOW, new Set(["t1"]));
    expect(s.buckets.find((b) => b.name === "leaf-open-pr")!.beans.map((b) => b.split(" ")[0])).toEqual(["t1"]);
    expect(s.buckets.find((b) => b.name === "leaf-no-open-pr")!.beans.map((b) => b.split(" ")[0])).toEqual(["t2"]);
  });

  /* UNJUDGED IS NOT GUILTY — `check-ci-health`'s third-state rule, inverted.
   * Rendering an unreachable API as "no PR names this bean" would convict
   * every leaf in the store of the network being down. */
  test("with no GitHub answer the leaves are one UNJUDGED bucket, not candidates", () => {
    const s = sweep(corpus(), NOW, null);
    expect(s.githubConsulted).toBe(false);
    expect(s.buckets.map((b) => b.name)).not.toContain("leaf-no-open-pr");
    const un = s.buckets.find((b) => b.name === "leaf-unjudged")!;
    expect(un.beans.map((b) => b.split(" ")[0]).sort()).toEqual(["t1", "t2"]);
    expect(un.reading).toContain("unjudged is not stale");
  });

  test("a bean stating no `updated_at` is not aged", () => {
    const root = mkdtempSync(join(tmpdir(), "beanrollup-"));
    made.push(root);
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    writeFileSync(
      join(root, "beans", "defs", "t9.md"),
      `---\n# t9\ntitle: 't9'\nstatus: in-progress\ntype: task\n---\n\nbody\n`,
    );
    expect(ageDays(read(root)[0]!, NOW)).toBeNull();
  });
});
