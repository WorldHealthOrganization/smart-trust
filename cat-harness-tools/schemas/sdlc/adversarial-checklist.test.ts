/**
 * The adversarial checklists' references are NAMES — `skill:<name>` and
 * `schema:<module>` — and every one resolves through the declaration.
 *
 * They were paths until 2026-10-11 (`check:declared-paths`): two named a skill
 * that no longer exists anywhere, and most named a package a skill has since
 * left. A name survives a move; this test is what says it still names
 * something.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { ALL_ADVERSARIAL_CHECKLIST_ITEMS, AdversarialChecklistItemSchema } from "./adversarial-checklist";
import { instanceDirectoriesForGraph } from "../kg/cat-harness";

import { requireHarnessRoot } from "../harness-root.ts";
const ROOT = requireHarnessRoot();
/** The tools layer, which holds the harness's schema modules (bean `8lcl`). */
const TOOLS = resolve(import.meta.dir, "..", "..");

/** Every `.md` under the declared skills directories, by basename. */
function skillNames(): Set<string> {
  const out = new Set<string>();
  const walk = (d: string): void => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (e.endsWith(".md")) out.add(e.slice(0, -3));
    }
  };
  for (const d of instanceDirectoriesForGraph(ROOT, "skills")) if (existsSync(d)) walk(d);
  return out;
}

const ALL = ALL_ADVERSARIAL_CHECKLIST_ITEMS;

describe("adversarial checklist references", () => {
  test("there are references to check — a pass over none is not one", () => {
    expect(ALL.flatMap((i) => i.references).length).toBeGreaterThan(0);
  });

  test("every item parses, so every reference is a name, never a path", () => {
    for (const i of ALL) expect(AdversarialChecklistItemSchema.safeParse(i).success).toBe(true);
  });

  test("every skill: reference names a skill in a declared skills directory", () => {
    const skills = skillNames();
    const missing = ALL.flatMap((i) => i.references)
      .filter((r) => r.startsWith("skill:"))
      .map((r) => r.slice("skill:".length))
      .filter((n) => !skills.has(n));
    expect(missing).toEqual([]);
  });

  test("every schema: reference names a module in a declared schemas directory", () => {
    const dirs = [...instanceDirectoriesForGraph(ROOT, "schemas"), ...instanceDirectoriesForGraph(TOOLS, "schemas")];
    const missing = ALL.flatMap((i) => i.references)
      .filter((r) => r.startsWith("schema:"))
      .map((r) => r.slice("schema:".length))
      .filter((m) => !dirs.some((d) => existsSync(join(d, `${m}.ts`))));
    expect(missing).toEqual([]);
  });

  test("every code: reference names a module in its layer, when that layer is checked out beside this one", () => {
    const missing = ALL.flatMap((i) => i.references)
      .filter((r) => r.startsWith("code:"))
      .map((r) => r.slice("code:".length))
      .filter((p) => existsSync(join(ROOT, "..", p.split("/")[0]!)) && !existsSync(join(ROOT, "..", p)));
    expect(missing).toEqual([]);
  });

  test("FALSIFICATION: a path is refused", () => {
    expect(AdversarialChecklistItemSchema.safeParse({ ...ALL[0], references: ["skills/x/y.md"] }).success).toBe(false);
  });
});
