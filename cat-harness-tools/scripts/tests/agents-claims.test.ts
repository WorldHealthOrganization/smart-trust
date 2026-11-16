/**
 * The claims `AGENTS.md` makes about code are checked — and the checker is
 * falsified against the two claims that were actually false.
 *
 * @module scripts/tests/agents-claims
 *
 * Bean `77ex`. The bean proposed a LOCATION check and asked, as its third
 * done-when, that it be falsified against real claims from git history.
 * Doing that FIRST is what found the problem: at `08f43c55b2` the file said
 * `resolveSkillDirs` was *in* `schemas/folio-config.ts` and had *no caller*,
 * and the LOCATION half of that was TRUE at that commit. The bean's own
 * design would not have caught its own motivating example, which is why
 * `absenceClaims` exists.
 *
 * The two exclusions in the absence branch are pinned here rather than
 * described, because each turns a true gap notice into a false finding:
 * a symbol's own DECLARATION is not a caller, and a symbol exercised only by
 * its unit test is precisely what "not yet wired in" means.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  absenceClaims,
  agentsFile,
  callersOf,
  checkClaims,
  declares,
  locationClaims,
  normalise,
  resolveCitedModule,
  resolveModule,
} from "../check-agents-claims.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const REPO = repoRootFor(resolve(HARNESS_ROOT));

describe("parsing — a claim must carry a backticked symbol and a shape", () => {
  test("a location claim is read, symbol and module", () => {
    const c = locationClaims(normalise("`foo` in `schemas/types.ts` is the thing."));
    expect(c).toEqual([
      { kind: "location", symbol: "foo", module: "schemas/types.ts", sentence: "`foo` in `schemas/types.ts`" },
    ]);
  });

  test("a claim spanning a BLOCKQUOTE line break is still one claim", () => {
    // The claims that went stale were inside `>` blocks; a continuation line
    // carrying `>` is what stopped a naive whitespace match from bridging them.
    expect(locationClaims(normalise("> `resolveSkillDirs` in\n> `schemas/kg/harness-config.ts` does it\n"))).toHaveLength(1);
  });

  test("coordination without a comma is one claim about two symbols", () => {
    const c = locationClaims(normalise("`A` and `B` in `schemas/types.ts`"));
    expect(c.map((x) => x.symbol)).toEqual(["A", "B"]);
    expect(c.every((x) => x.module === "schemas/types.ts")).toBe(true);
  });

  test("a COMMA before `and` is a clause boundary, not a list", () => {
    // A real false positive: `DocumentContentAdapter` was swallowed across
    // ", and" and attributed to `schemas/content/block-kinds.ts`, which it has
    // nothing to do with. A checker that cries wolf gets switched off.
    const c = locationClaims(normalise("`DocumentContentAdapter` extends it, and `X` in `schemas/content/block-kinds.ts`"));
    expect(c.map((x) => x.symbol)).toEqual(["X"]);
  });

  test("prose with no backticked symbol yields no claim — it is NOT verified", () => {
    expect(locationClaims(normalise("the overlay is computed in the config schema"))).toEqual([]);
    expect(absenceClaims(normalise("nothing calls it any more"))).toEqual([]);
  });

  test("fenced code is not prose", () => {
    expect(locationClaims(normalise("```ts\nimport { x } from `schemas/types.ts`\n```\n"))).toEqual([]);
  });

  test("an absence claim is read", () => {
    const c = absenceClaims(normalise("`resolveSkillDirs` computes the overlay and has no caller."));
    expect(c.map((x) => [x.kind, x.symbol])).toEqual([["absence", "resolveSkillDirs"]]);
  });

  test("an absence sentence naming TWO symbols is NOT guessed at", () => {
    // Which of them the phrase is about is a guess, and a guess here is a
    // false finding on the file every agent reads first.
    expect(absenceClaims(normalise("`a` and `b`: nothing calls it."))).toEqual([]);
  });

  test("each absence phrasing the file actually uses is recognised", () => {
    for (const p of ["has no caller", "nothing calls it", "not yet reachable", "is never called"]) {
      expect(absenceClaims(normalise(`\`sym\` ${p}.`))).toHaveLength(1);
    }
  });
});

describe("resolution", () => {
  test("a module is resolved against each root a path may be written from", () => {
    // A module the harness's AGENTS.md cites lives in this tools layer since
    // bean `8lcl`, so it resolves through the layer, as the checker reads it;
    // a path the checkout itself holds still resolves against the checkout.
    expect(resolveCitedModule(REPO, "schemas/kg/cat-harness.ts")).toBeDefined();
    expect(resolveModule(REPO, "schemas/no-such-module.ts")).toBeUndefined();
    expect(resolveCitedModule(REPO, "schemas/no-such-module.ts")).toBeUndefined();
  });

  test("`declares` finds each declaration form, and misses none of them", () => {
    for (const k of ["const", "function", "class", "interface", "type", "enum"]) {
      expect(declares(`export ${k} Foo = 1`, "Foo")).toBe(true);
    }
    expect(declares("export const Bar = 1", "Foo")).toBe(false);
  });

  test("`A.B` asks for a member of `A`", () => {
    expect(declares("export interface BlockBase { uses: string[] }", "BlockBase.uses")).toBe(true);
    expect(declares("export interface BlockBase { uses: string[] }", "BlockBase.gone")).toBe(false);
  });
});

describe("callers — comments are not calls", () => {
  const fixture = (): string => {
    const root = mkdtempSync(join(tmpdir(), "claims-"));
    mkdirSync(join(root, "schemas"), { recursive: true });
    writeFileSync(join(root, "schemas", "a.ts"), "export function target() {}\n");
    // The trap this repository has already paid for once: a check that
    // grepped source TEXT went red on a documentation comment.
    writeFileSync(join(root, "prose.ts"), "// target is described here\n/* and target here */\nexport const x = 1;\n");
    return root;
  };

  test("a mention in a comment is not a caller", () => {
    expect(callersOf(fixture(), "target")).toEqual(["schemas/a.ts"]);
  });

  test("a real reference in code IS a caller", () => {
    const root = fixture();
    writeFileSync(join(root, "user.ts"), "import { target } from './schemas/a.js';\ntarget();\n");
    expect(callersOf(root, "target").sort()).toEqual(["schemas/a.ts", "user.ts"]);
  });
});

describe("the two false claims from git history — the bean's done-when #3", () => {
  /**
   * `08f43c55b2`, verbatim shape. The LOCATION half was TRUE at that commit:
   * `schemas/folio-config.ts` existed and declared the symbol. Only the
   * ABSENCE half was false, and only because of ONE of the four files that
   * referenced it.
   */
  const HISTORICAL =
    "`resolveSkillDirs` in `schemas/folio-config.ts` computes the cross-instance " +
    "skill overlay and has no caller: `skill_list` is not yet reachable.";

  test("the stale module path is caught", () => {
    const { findings } = checkClaims(REPO, HISTORICAL);
    expect(findings.some((f) => f.reason.includes("no such module: schemas/folio-config.ts"))).toBe(true);
  });

  test("the `no caller` half is caught SEPARATELY — a location check alone would have missed it", () => {
    // Stated against today's tree, where `resolveSkillDirs` is called by
    // `scripts/skill-packages.ts` (moved out of the `skill_fetch` Tool, bean
    // `9umr`). This is the assertion that shows the bean's
    // proposed design was insufficient for the bean's own example.
    const { findings } = checkClaims(REPO, "`resolveSkillDirs` has no caller.");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.reason).toContain("skill-packages");
  });

  test("a TRUE location claim about today's tree passes", () => {
    const { claims, findings } = checkClaims(REPO, "`resolveSkillDirs` in `schemas/kg/harness-config.ts` does it.");
    expect(claims).toHaveLength(1);
    expect(findings).toEqual([]);
  });
});

describe("the two exclusions, each of which would invert a true claim", () => {
  const root = (): string => {
    const r = mkdtempSync(join(tmpdir(), "claims-excl-"));
    mkdirSync(join(r, "scripts", "tests"), { recursive: true });
    writeFileSync(join(r, "scripts", "lonely.ts"), "export function lonely() { return lonely.name; }\n");
    return r;
  };

  test("a symbol referenced ONLY in its own declaration still has no caller", () => {
    expect(checkClaims(root(), "`lonely` has no caller.").findings).toEqual([]);
  });

  test("a symbol exercised only by its TEST still has no caller", () => {
    // "Not yet wired in" is exactly the state of a function with a unit test
    // and no production caller. Counting the test would contradict the claim
    // while agreeing with it.
    const r = root();
    writeFileSync(join(r, "scripts", "tests", "lonely.test.ts"), "import { lonely } from '../lonely.js';\nlonely();\n");
    expect(checkClaims(r, "`lonely` has no caller.").findings).toEqual([]);
  });

  test("...and a PRODUCTION caller does refute it, counting the test separately", () => {
    const r = root();
    writeFileSync(join(r, "scripts", "tests", "lonely.test.ts"), "import { lonely } from '../lonely.js';\nlonely();\n");
    writeFileSync(join(r, "scripts", "real.ts"), "import { lonely } from './lonely.js';\nlonely();\n");
    const { findings } = checkClaims(r, "`lonely` has no caller.");
    expect(findings).toHaveLength(1);
    expect(findings[0]!.reason).toContain("scripts/real.ts");
    expect(findings[0]!.reason).toContain("1 test file(s)");
  });
});

describe("this repository, right now", () => {
  // THIS layer's declared `agent-instructions`, not the checkout root's:
  // the root `AGENTS.md` of an index checkout is a rendered index of the
  // layers and carries no claim about code (owner, 2026-10-09). The
  // pointers it held, claims included, moved to this layer's own file.
  const MD = readFileSync(agentsFile(), "utf-8");

  test("every claim AGENTS.md makes about code holds", () => {
    const { findings } = checkClaims(REPO, MD);
    if (findings.length > 0) {
      throw new Error(findings.map((f) => `\`${f.claim.symbol}\` — ${f.reason}`).join("\n"));
    }
  });

  test("a NON-TRIVIAL number of claims is parsed — zero parsed is not zero false", () => {
    // The same guard the entry-link sweep carries: "0 claims checked, 0 false"
    // over the file every agent opens first reads exactly like a pass. The CLI
    // exits 2 on zero; this fails if the shapes drift down towards it.
    expect(checkClaims(REPO, MD).claims.length).toBeGreaterThan(3);
  });
});
