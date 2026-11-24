/**
 * A bean store seeded empty on purpose passes the two gates whose zero-bean
 * result was a vacuity refusal; every other empty store still fails.
 *
 * The failure (WorldHealthOrganization/dth-sfp#2): `cat/dth-sfp/beans` was
 * seeded empty on the owner's decision (2026-11-17), so its mount holds
 * `beans/beans.json`, `defs/.gitkeep` and the generated `defs/README.md`, and
 * nothing else. `check:bean-front-matter` refused it as "yielded no beans —
 * every count here would be vacuous", exit 1, and `beans:retag --check` would
 * have refused it next for the same reason. The rule the other bean gates
 * already follow (`storeDeterminedEmpty`, owner 2026-11-17: "nothing to
 * examine means pass") now covers these two, for a DECLARED store only.
 *
 * Each case runs the real gate in a throwaway checkout: `CAT_HARNESS_ROOT`
 * names a link to the real harness INSIDE it, so the gate's own anchoring
 * (`a6kl`, the harness's parent) lands on the scratch store rather than this
 * repository's.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { declaredStoreDeterminedEmpty } from "../bean-store-read.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const SCRIPTS = resolve(import.meta.dir, "..");
const FRONT_MATTER = join(SCRIPTS, "check-bean-front-matter.ts");
const RETAG = join(SCRIPTS, "beans-retag.ts");

/** `beans/beans.json` as the seeded `cat/dth-sfp/beans` branch carries it. */
const BEAN_GRAPH = JSON.stringify({
  name: "dth-sfp",
  directories: [{ id: "defs", path: "defs", graphTypologies: ["bean-defs"], description: "Work items." }],
});
const GENERATED_README = '---\ngenerated: "scripts/subgraph-readmes.ts"\n---\n<!-- kg:subgraph:begin -->\n';

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

/** A throwaway checkout holding the harness (linked) and the bean files given. */
function checkout(opts: { declared: boolean; defs: Record<string, string> | null }): string {
  const root = mkdtempSync(join(tmpdir(), "bean-seeded-empty-"));
  made.push(root);
  spawnSync("git", ["init", "-q"], { cwd: root });
  symlinkSync(HARNESS_ROOT, join(root, "cat-harness"), "dir");
  mkdirSync(join(root, "beans"), { recursive: true });
  if (opts.declared) writeFileSync(join(root, "beans", "beans.json"), BEAN_GRAPH);
  if (opts.defs !== null) {
    mkdirSync(join(root, "beans", "defs"), { recursive: true });
    for (const [name, text] of Object.entries(opts.defs)) writeFileSync(join(root, "beans", "defs", name), text);
  }
  return root;
}

function run(script: string, root: string, ...args: string[]): { status: number; out: string } {
  const r = spawnSync("bun", ["run", script, ...args], {
    cwd: root,
    encoding: "utf-8",
    env: { ...process.env, CAT_HARNESS_ROOT: join(root, "cat-harness") },
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

const SEEDED = { ".gitkeep": "", "README.md": GENERATED_README };

describe("declaredStoreDeterminedEmpty", () => {
  test("a declared store holding only .gitkeep and its README is determined empty", () => {
    const root = checkout({ declared: true, defs: SEEDED });
    expect(declaredStoreDeterminedEmpty(root)).toBe(join(root, "beans", "defs"));
  });
  test("an undeclared store is not, however empty", () => {
    expect(declaredStoreDeterminedEmpty(checkout({ declared: false, defs: SEEDED }))).toBeUndefined();
  });
  test("a declared store whose defs/ is missing is not", () => {
    expect(declaredStoreDeterminedEmpty(checkout({ declared: true, defs: null }))).toBeUndefined();
  });
  test("a file that is not a bean and not the README makes it unread, not empty", () => {
    const root = checkout({ declared: true, defs: { ...SEEDED, "mangled.md": "--\n# x\nstatus: todo\n--\nbody" } });
    expect(declaredStoreDeterminedEmpty(root)).toBeUndefined();
  });
});

describe("check:bean-front-matter over an empty store", () => {
  test("declared and seeded empty: passes, 0 findings, and says why", () => {
    const r = run(FRONT_MATTER, checkout({ declared: true, defs: SEEDED }));
    expect(r.out).toContain("Bean front matter (0 beans)");
    expect(r.out).toContain("determined-empty store");
    expect(r.out).not.toContain("vacuous");
    expect(r.status).toBe(0);
  });
  test("undeclared: still refused as vacuous", () => {
    const r = run(FRONT_MATTER, checkout({ declared: false, defs: SEEDED }));
    expect(r.out).toContain("would be vacuous");
    expect(r.status).toBe(1);
  });
  test("declared but missing: still not a pass", () => {
    const r = run(FRONT_MATTER, checkout({ declared: true, defs: null }));
    expect(r.out).toContain("NOT a pass");
    expect(r.status).toBe(2);
  });
});

describe("beans:retag --check over an empty store", () => {
  test("declared and seeded empty: passes and says why", () => {
    const r = run(RETAG, checkout({ declared: true, defs: SEEDED }), "--check");
    expect(r.out).toContain("determined-empty store");
    expect(r.status).toBe(0);
  });
  test("undeclared: still refused as vacuous", () => {
    const r = run(RETAG, checkout({ declared: false, defs: SEEDED }), "--check");
    expect(r.out).toContain("would be vacuous");
    expect(r.status).toBe(1);
  });
  test("an arbitrary --dir that is empty: still refused as vacuous", () => {
    const root = checkout({ declared: true, defs: SEEDED });
    const r = run(RETAG, root, "--check", "--dir", join(root, "beans", "defs"));
    expect(r.out).toContain("would be vacuous");
    expect(r.status).toBe(1);
  });
});
