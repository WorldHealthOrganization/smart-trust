/**
 * Every writer of a `qa-results/v1` sidecar in the harness's results tree is
 * claimed by a `QA_WRITERS` entry (`scripts/qa-refresh.ts`).
 *
 * Why (2026-11-19, three content PRs blocked intermittently): the writer form of
 * `check:library-qa` wrote `cat-harness/test/results/library-entry-qa.qa-results.json`
 * in a gate shard; later in the same shard `uml:overview:check` ran
 * `qa:refresh`, which refused the file — "no declared writer claims …
 * QA_WRITERS is out of date" — and the gate failed intermittently, depending
 * on which gates the shard held. A writer nobody listed is a refresh waiting to
 * fail, so the list is checked against the code, not remembered.
 *
 * How: every `scripts/` and `pipeline/` module that calls
 * `writeQaResult(<root>, <stem>, …)` with a stem it spells (a literal, or a
 * `const` in the same module) and that some `checkoutScripts` entry runs
 * WITHOUT `--check` (its writer form) must have its sidecar,
 * `cat-harness/test/results/<stem>.qa-results.json`, claimed by
 * `claimants`. A stem computed at run time is not judged here.
 *
 * {@link UNCLAIMED} names the writers known to be unclaimed, each with why,
 * so a NEW one fails this test rather than a gate shard.
 *
 * @module scripts/tests/qa-writers-claim
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { claimants } from "../qa-refresh.ts";

const TOOLS = join(import.meta.dir, "..", "..");
const RESULTS = "cat-harness/test/results";

/**
 * Writers known to be unclaimed, by stem. Not a licence: each is a refresh
 * that can fail the same way, and adding it to `QA_WRITERS` makes `qa:refresh`
 * RUN it, which has to be decided per writer.
 */
const UNCLAIMED: Record<string, string> = {
  "glossary-consistency":
    "`translation:glossary` writes one sidecar per OWN instance root (`<instance>/test/results/`), not only the harness's; claiming it means qa:refresh runs it in every root, including content roots with no translation-sources, so it needs its own decision",
  "audit-reachability":
    "`audit:reachability` is no gate in any shard (only its writer form exists); claiming it means qa:refresh runs the whole reachability audit, so it needs its own decision",
};

/** The top-level arguments of the call that opens at `src[open]` (`(`). */
function args(src: string, open: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = open; i < src.length; i++) {
    const c = src[i]!;
    if (c === "(" || c === "[" || c === "{") {
      if (depth++ === 0) continue;
    } else if (c === ")" || c === "]" || c === "}") {
      if (--depth === 0) {
        out.push(cur.trim());
        return out;
      }
    } else if (c === "," && depth === 1) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  return out;
}

/** The stem a call names, when it spells it: a literal, or a `const` of this module. */
function stemOf(expr: string, src: string): string | undefined {
  const lit = /^["'`]([\w.-]+)["'`]$/.exec(expr);
  if (lit) return lit[1];
  if (!/^[A-Za-z_]\w*$/.test(expr)) return undefined;
  return new RegExp(`const ${expr}\\s*=\\s*["']([\\w.-]+)["']`).exec(src)?.[1];
}

interface Writer {
  module: string;
  stem: string;
  writerScripts: string[];
}

function writers(): Writer[] {
  const pkg = JSON.parse(readFileSync(join(TOOLS, "package.json"), "utf-8")) as { checkoutScripts?: Record<string, string> };
  const scripts = Object.entries(pkg.checkoutScripts ?? {});
  const out: Writer[] = [];
  for (const dir of ["scripts", "pipeline"]) {
    for (const f of readdirSync(join(TOOLS, dir)).filter((x) => x.endsWith(".ts") && !x.endsWith(".test.ts"))) {
      const src = readFileSync(join(TOOLS, dir, f), "utf-8");
      const module = `cat-harness-tools/${dir}/${f}`;
      const writerScripts = scripts.filter(([, cmd]) => cmd.includes(module) && !/--check\b/.test(cmd)).map(([n]) => n);
      if (writerScripts.length === 0) continue;
      for (const m of src.matchAll(/\bwriteQaResult\(/g)) {
        if (src.slice(Math.max(0, m.index - 20), m.index).includes("function ")) continue;
        const stem = stemOf(args(src, m.index + m[0].length - 1)[1] ?? "", src);
        if (stem !== undefined) out.push({ module, stem, writerScripts });
      }
    }
  }
  return out;
}

describe("every qa-results writer is claimed by QA_WRITERS", () => {
  const found = writers();

  test("the scan finds the writers it is about (not a pass over nothing)", () => {
    const stems = new Set(found.map((w) => w.stem));
    for (const s of ["library-entry-qa", "source-licence", "harness-state"]) expect(stems).toContain(s);
  });

  test("each writer's sidecar has a claimant, or is a named exception", () => {
    const missing = found
      .filter((w) => !Object.hasOwn(UNCLAIMED, w.stem))
      .filter((w) => claimants(`${RESULTS}/${w.stem}.qa-results.json`).length === 0)
      .map((w) => `${w.module} (${w.writerScripts.join(", ")}) writes ${RESULTS}/${w.stem}.qa-results.json, which no QA_WRITERS entry claims`);
    expect(missing).toEqual([]);
  });

  test("a named exception is still a writer and still unclaimed; otherwise remove it", () => {
    const stems = new Set(found.map((w) => w.stem));
    for (const stem of Object.keys(UNCLAIMED)) {
      expect(stems).toContain(stem);
      expect(claimants(`${RESULTS}/${stem}.qa-results.json`)).toEqual([]);
    }
  });

  test("check:library-qa's sidecar is claimed by its writer (the 2026-11-19 shard failure)", () => {
    expect(claimants(`${RESULTS}/library-entry-qa.qa-results.json`)).toEqual(["check:library-qa"]);
  });
});
