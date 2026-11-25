import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkIdStable,
  checkIdUnique,
  resetIdsBaseCache,
  resetIdsIndexCache,
} from "../../pipeline/qa-checkers-ids";
import { QA_CRITERIA_BY_ID } from "../../pipeline/qa-criteria-registry";
import { checkerFunctionName } from "../../pipeline/qa-checker-discovery";
import * as idsModule from "../../pipeline/qa-checkers-ids";

interface Blk {
  slug: string;
  label: string;
  kind?: string;
  renamedFrom?: string[];
}

function manifest(b: Blk): string {
  const rf = b.renamedFrom ? `  renamedFrom: [${b.renamedFrom.map((l) => `"${l}"`).join(", ")}],\n` : "";
  return `export default ${b.kind ?? "definition"}({\n  label: "${b.label}",\n${rf}});\n`;
}

let roots: string[] = [];
function makeFolio(blocks: Blk[]) {
  const root = mkdtempSync(join(tmpdir(), "ids-"));
  roots.push(root);
  const folio = join(root, "folio");
  const dir = join(folio, "p", "ch");
  mkdirSync(dir, { recursive: true });
  const paths: Record<string, string> = {};
  for (const b of blocks) {
    const p = join(dir, `${b.slug}.ts`);
    writeFileSync(p, manifest(b));
    paths[b.slug] = p;
  }
  resetIdsIndexCache(folio);
  return { root, dir, paths };
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** A folio committed once; returns the base commit to compare against. */
function committed(blocks: Blk[]) {
  const f = makeFolio(blocks);
  git(f.root, "init", "-q");
  git(f.root, "add", "-A");
  git(f.root, "commit", "-q", "-m", "base");
  const base = git(f.root, "rev-parse", "HEAD").trim();
  process.env.QA_ID_BASE_REF = base;
  return { ...f, base };
}

beforeEach(() => {
  resetIdsBaseCache();
});
afterEach(() => {
  delete process.env.QA_ID_BASE_REF;
  resetIdsIndexCache();
  for (const r of roots) rmSync(r, { recursive: true, force: true });
  roots = [];
});

describe("id-unique", () => {
  test("distinct labels pass", () => {
    const { paths } = makeFolio([
      { slug: "a", label: "def:a" },
      { slug: "b", label: "def:b" },
    ]);
    expect(checkIdUnique({ ts: paths.a }).result).toBe("pass");
  });

  test("two blocks declaring one label FAIL, from both sides", () => {
    // The defect validate.ts does not see: two different FILES, one label.
    // buildContentGraph would keep only one of them.
    const { paths } = makeFolio([
      { slug: "a", label: "def:shared" },
      { slug: "b", label: "def:shared" },
    ]);
    const ra = checkIdUnique({ ts: paths.a });
    const rb = checkIdUnique({ ts: paths.b });
    expect(ra.result).toBe("fail");
    expect(rb.result).toBe("fail");
    expect(ra.hits[0].file).toBe(paths.b);
    expect(rb.hits[0].file).toBe(paths.a);
  });

  test("taking a label another block retired in renamedFrom FAILS", () => {
    const { paths } = makeFolio([
      { slug: "renamed", label: "def:new", renamedFrom: ["def:old"] },
      { slug: "squatter", label: "def:old" },
    ]);
    const r = checkIdUnique({ ts: paths.squatter });
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain("retired id");
    // The block that did the renaming is not at fault.
    expect(checkIdUnique({ ts: paths.renamed }).result).toBe("pass");
  });

  test("no folio to index is n/a, never a pass", () => {
    const { paths } = makeFolio([{ slug: "a", label: "def:a" }]);
    resetIdsIndexCache(join(tmpdir(), "ids-does-not-exist-" + Date.now()));
    const r = checkIdUnique({ ts: paths.a });
    expect(r.result).toBe("n/a");
  });
});

describe("id-stable", () => {
  test("an unchanged block passes", () => {
    const { paths } = committed([{ slug: "a", label: "def:a" }]);
    const r = checkIdStable({ ts: paths.a });
    expect(r.result).toBe("pass");
    expect(r.notes).toContain("unchanged");
  });

  test("a relabel WITHOUT renamedFrom fails; the same relabel WITH it passes", () => {
    // The bean's own acceptance test: only the undeclared rename is a finding.
    const { paths } = committed([{ slug: "a", label: "def:a" }]);
    writeFileSync(paths.a, manifest({ slug: "a", label: "def:a-renamed" }));
    const bare = checkIdStable({ ts: paths.a });
    expect(bare.result).toBe("fail");
    expect(bare.hits[0].text).toContain('renamedFrom: ["def:a"]');

    resetIdsBaseCache();
    writeFileSync(paths.a, manifest({ slug: "a", label: "def:a-renamed", renamedFrom: ["def:a"] }));
    const declared = checkIdStable({ ts: paths.a });
    expect(declared.result).toBe("pass");
    expect(declared.notes).toContain("renamed from");
  });

  test("a moved AND relabelled block is still compared with its old self", () => {
    const { root, dir, paths } = committed([{ slug: "a", label: "def:a" }]);
    const moved = join(dir, "moved.ts");
    renameSync(paths.a, moved);
    writeFileSync(moved, manifest({ slug: "moved", label: "def:b" }));
    git(root, "add", "-A"); // -M follows renames among tracked changes
    const r = checkIdStable({ ts: moved });
    expect(r.result).toBe("fail");
    expect(r.hits[0].text).toContain('"def:a"');
  });

  test("a new block is an addition — including one not yet git-added", () => {
    const { dir } = committed([{ slug: "a", label: "def:a" }]);
    const fresh = join(dir, "fresh.ts");
    writeFileSync(fresh, manifest({ slug: "fresh", label: "def:fresh" }));
    const r = checkIdStable({ ts: fresh });
    expect(r.result).toBe("pass");
    expect(r.notes).toContain("new since");
  });

  test("an unreachable base ref is n/a, never stable", () => {
    const { paths } = committed([{ slug: "a", label: "def:a" }]);
    process.env.QA_ID_BASE_REF = "no-such-ref";
    const r = checkIdStable({ ts: paths.a });
    expect(r.result).toBe("n/a");
    expect(r.notes).toContain("not reachable");
  });
});

describe("registration", () => {
  test("both criteria are registered, automated, and discoverable by name", () => {
    for (const id of ["id-unique", "id-stable"]) {
      const def = QA_CRITERIA_BY_ID[id];
      expect(def?.automated).toBe(true);
      expect(def?.source_file).toBe("pipeline/qa-checkers-ids.ts");
      expect(typeof (idsModule as Record<string, unknown>)[checkerFunctionName(id)]).toBe("function");
    }
    expect(QA_CRITERIA_BY_ID["id-unique"].default_severity).toBe("critical");
  });
});
