import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { paperArg, requireFlagValue } from "../../pipeline/cli-args";
import { TOOLS_ROOT } from "../lib/roots.ts";

/**
 * The `--paper` guard, and the invariant that stops it being re-broken.
 *
 * Thirteen scripts read `--paper <name>` by taking the token after the flag
 * without checking it was a value, so `--paper --apply` named a paper `--apply`
 * and failed three steps later. Reported by the review bot on
 * folio-assistant#151 and fixed there in one script; this covers the sweep.
 *
 * The corpus check below is the part that matters long-term: a fourteenth copy
 * of the idiom is easier to write than to notice.
 */

const ROOT = resolve(TOOLS_ROOT);  // bean 70lx: the code scanned is here
const UNGUARDED = /indexOf\(["']--paper["']\)/;

function* tsFiles(dir: string): Generator<string> {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".git" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* tsFiles(p);
    else if (e.endsWith(".ts")) yield p;
  }
}

describe("requireFlagValue", () => {
  test("absent flag is not an error — it means 'not specified'", () => {
    expect(requireFlagValue(["--other", "x"], "--paper")).toBeUndefined();
  });

  test("a well-formed value comes back", () => {
    expect(requireFlagValue(["--paper", "qou", "--apply"], "--paper")).toBe("qou");
  });

  test("a flag-shaped value is refused, naming what was found", () => {
    expect(() => requireFlagValue(["--paper", "--apply"], "--paper")).toThrow(
      /needs a value.*another flag/s,
    );
  });

  test("a single-hyphen token is refused too", () => {
    expect(() => requireFlagValue(["--paper", "-x"], "--paper")).toThrow(/another flag/);
  });

  test("a trailing flag with nothing after it is refused", () => {
    expect(() => requireFlagValue(["--apply", "--paper"], "--paper")).toThrow(
      /Nothing followed it/,
    );
  });

  test("paperArg is requireFlagValue at --paper", () => {
    expect(paperArg(["--paper", "qou"])).toBe("qou");
    expect(() => paperArg(["--paper", "--apply"])).toThrow(/needs a value/);
  });
});

describe("no script re-introduces the unguarded idiom", () => {
  // The control. Without it a broken regex would report a clean corpus, which
  // is exactly the failure mode this whole PR is about: an absent check looks
  // identical to a passing one.
  test("the detector fires on a planted unguarded snippet", () => {
    const planted = 'const i = process.argv.indexOf("--paper");';
    expect(UNGUARDED.test(planted)).toBe(true);
  });

  test("and finds nothing in pipeline or scripts", () => {
    const offenders: string[] = [];
    for (const dir of ["pipeline", "scripts"]) {
      for (const f of tsFiles(join(ROOT, dir))) {
        // Two legitimate self-references: cli-args.ts is where the flag name
        // is searched for real, and THIS file necessarily contains the pattern
        // it detects. Excluded by exact path rather than by skipping all of
        // scripts/tests, which would weaken the scan for no reason.
        if (f.endsWith("/cli-args.ts")) continue;
        if (f.endsWith("/cli-args-paper-guard.test.ts")) continue;
        if (UNGUARDED.test(readFileSync(f, "utf-8"))) {
          offenders.push(f.slice(ROOT.length + 1));
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

// The "q-usage-audit still IMPORTS" guard moved to folio-assistant-sci with
// the script (scripts/tests/q-usage-audit-cli.test.ts, bean saqd).
