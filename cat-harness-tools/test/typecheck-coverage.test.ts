/**
 * Every TypeScript file here is either in the typecheck program or outside it
 * on purpose — never outside it because nothing named it.
 *
 * `tsc --noEmit` reports success, and its denominator is reported nowhere: a
 * pass over 1443 files and a pass over 1555 look identical, and moving a file
 * into a directory `include` does not name quietly drops it from the program
 * (bean `lvoa`, found when a whole layer's `scripts/` had fallen out). So
 * each file is put in one of three states:
 *
 *   - **covered** — named by an `include` glob and not by an `exclude`;
 *   - **exempt** — named by an `exclude`, which is a decision written down;
 *   - **unnamed** — neither, and the test fails naming it.
 *
 * Being named by a glob over-reports coverage slightly (a file can also be
 * pulled in transitively by an importer), which is the safe direction for a
 * gate that asks only that somebody SAID where each file stands.
 *
 * `**\/*.e2e.ts` is the one exclusion, and a recorded trade: Playwright
 * transpiles those files without checking them. Measured 2026-10-10 by adding
 * them to a scratch program: 9 type errors in 7 files, all in fixture literals
 * typed looser than the props they feed.
 *
 * The walk reads the filesystem, not `git ls-files`: CI mounts this checkout
 * with its `.git` removed.
 *
 * @module test/typecheck-coverage.test
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "bun:test";

const ROOT = resolve(import.meta.dir, "..");

/** Directories no glob should be asked about: installed or generated. */
const NEVER_WALKED = ["node_modules/", "dist/", ".git/"];

interface TsConfig {
  include: string[];
  exclude: string[];
}

function readTsConfig(): TsConfig {
  const raw = JSON.parse(readFileSync(resolve(ROOT, "tsconfig.json"), "utf8"));
  return { include: raw.include ?? [], exclude: raw.exclude ?? [] };
}

/** tsc treats a bare directory in `exclude` as everything beneath it. */
function asGlob(pattern: string): Bun.Glob {
  return new Bun.Glob(/[*?{[]/.test(pattern) || /\.[cm]?tsx?$/.test(pattern) ? pattern : `${pattern}/**`);
}

type State = "covered" | "exempt" | "unnamed";

function classify(file: string, config: TsConfig): State {
  if (config.exclude.some((p) => asGlob(p).match(file))) return "exempt";
  if (config.include.some((p) => asGlob(p).match(file))) return "covered";
  return "unnamed";
}

function tsFiles(): string[] {
  const files: string[] = [];
  for (const f of new Bun.Glob("**/*.{ts,mts,cts,tsx}").scanSync({ cwd: ROOT, dot: false })) {
    if (!NEVER_WALKED.some((d) => f.startsWith(d) || f.includes(`/${d}`))) files.push(f);
  }
  return files.sort();
}

describe("typecheck program coverage (bean lvoa)", () => {
  it("classifies by include and exclude, and an unnamed file is neither", () => {
    const config = { include: ["src/**/*.ts"], exclude: ["dist", "**/*.e2e.ts"] };
    expect(classify("src/a.ts", config)).toBe("covered");
    expect(classify("src/a.e2e.ts", config)).toBe("exempt");
    expect(classify("dist/src/a.ts", config)).toBe("exempt");
    expect(classify("elsewhere/a.ts", config)).toBe("unnamed");
  });

  it("leaves no TypeScript file unnamed by tsconfig.json", () => {
    const config = readTsConfig();
    const files = tsFiles();
    const counts: Record<State, number> = { covered: 0, exempt: 0, unnamed: 0 };
    const unnamed: string[] = [];
    for (const f of files) {
      const state = classify(f, config);
      counts[state]++;
      if (state === "unnamed") unnamed.push(f);
    }
    // The denominator, so a shrinking program is visible in the test log.
    console.log(
      `typecheck coverage: ${counts.covered} covered, ${counts.exempt} exempt, ${counts.unnamed} unnamed of ${files.length}`,
    );
    expect(files.length).toBeGreaterThan(0);
    expect(counts.covered).toBeGreaterThan(0);
    expect(unnamed).toEqual([]);
  });
});
