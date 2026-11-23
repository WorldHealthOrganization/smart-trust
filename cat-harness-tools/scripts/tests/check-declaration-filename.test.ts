/**
 * The declaration-filename check, and the boundary of what it claims.
 *
 * Bean `jijc`. Ten tests. **Measured by stubbing both halves of the rule to
 * `false`: 5 go red, 5 stay green.** The five that stay green are the
 * false-positive guards — they pass whether or not the rule works, and exist
 * so that narrowing the rule later cannot quietly re-admit a class that was
 * measured and closed.
 *
 * That ratio is deliberate, and it is the one `sfhr` shipped: a check whose
 * tests all assert the happy path is a check whose false positives nobody has
 * looked for. The count here is stated because it was RUN, not estimated — an
 * earlier draft of this header said "three", which is the failure this
 * repository keeps paying for.
 *
 * ## The literals in this file are DATA and must stay literal
 *
 * Every `"harness.json"` below sits inside a fixture's **source text** — the
 * code this checker reads, not code this file executes. Substituting the
 * constant into them makes each test feed the checker a string that no longer
 * contains what the checker looks for, so the suite passes while asserting
 * nothing.
 *
 * Stated because it already happened: the ~100-fixture migration the owner
 * ruled on 2026-09-21 was run as a blanket replace and rewrote exactly these,
 * silently gutting the four detection tests. **A blanket migration cannot tell
 * a literal that IS the code from a literal DESCRIBING code**, and this is the
 * file where the difference lives.
 *
 * @module folio-assistant/scripts/tests/check-declaration-filename
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkDeclarationFilename,
  classifyMarkdownLine,
  classifyWorkflowLine,
  markdownUses,
  paragraphsOf,
  workflowUses,
} from "../check-declaration-filename.ts";

/**
 * A tree holding one source file at `<root>/<rel>`.
 *
 * Defaults to placing it **inside the owning layer**, because that is where
 * a failing bypass has to live: a site outside it is classified as
 * cross-instance and counted rather than failed. An earlier draft of this
 * helper wrote to a bare `src/`, and all four detection tests went red for
 * that reason alone — the rule was right and the fixture was modelling a tree
 * this repository does not have.
 */
function fixture(rel: string, src: string, instance = "cat-harness"): string {
  const root = mkdtempSync(join(tmpdir(), "declfile-"));
  const full = join(root, instance, rel);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, src);
  return root;
}


/**
 * The real-corpus scan, computed ONCE for the whole file.
 *
 * `checkDeclarationFilename()` with no argument walks every TypeScript and
 * markdown file in the repository — measured 2026-09-24 at **4.3 s** here,
 * against **3.6 s** on `main` before this branch added 118 annotated scripts
 * and a skill. Three tests below called it separately, so the file paid that
 * cost three times, and under full-suite parallel load the first of them
 * crossed bun's 5 s per-test default and failed as a TIMEOUT — with its
 * assertion (`toEqual([])`) never reached, so a green corpus reported as a
 * red test.
 *
 * Sharing is sound because the scan is PURE and read-only, and all three call
 * sites pass no argument, so they were computing the same value. Fixing it
 * here rather than raising the timeout is the `generalise-the-fix` Move 1.1
 * distinction: the symptom was a budget, the defect was doing the same
 * expensive work three times. Raising the budget would have left the next
 * corpus growth to rediscover it.
 *
 * The tests that build a synthetic checkout still call it with a path of their
 * own — those are cheap and must not share this.
 *
 * ## Sharing is not sufficient, and {@link CORPUS_TIMEOUT} is the other half
 *
 * Sharing fixed the second and third calls; the FIRST one still pays the whole
 * scan, and 4.3 s standalone becomes 5.2 s under full-suite parallel load, so it
 * crossed the 5 s default again. There is no margin to find here: the scan reads
 * the whole corpus by construction, so its cost grows with the repository while
 * a per-test default does not. That makes an explicit budget the correct fix for
 * this half rather than a concession — and it has to carry its measurement, or
 * the next person cannot tell a considered budget from a number somebody raised
 * until the red went away.
 */
let realCorpus: ReturnType<typeof checkDeclarationFilename> | undefined;
const corpus = (): ReturnType<typeof checkDeclarationFilename> => {
  if (realCorpus) return realCorpus;
  const t0 = performance.now();
  realCorpus = checkDeclarationFilename();
  const ms = Math.round(performance.now() - t0);
  // A timeout says only "timed out after N ms", which names nothing a
  // contributor can act on (bean `6brk`). So the scan says what it cost and
  // over how much, once it reaches half its budget, BEFORE it is a red: then
  // "the corpus grew" can be told from "my change is slow".
  if (ms > CORPUS_TIMEOUT / 2) {
    console.warn(
      `check-declaration-filename: the corpus scan took ${ms} ms over ${realCorpus.filesRead} files, ` +
        `past half its ${CORPUS_TIMEOUT} ms budget. The corpus has grown; see CORPUS_TIMEOUT's basis.`,
    );
  }
  return realCorpus;
};

/**
 * The budget for whichever test populates {@link corpus} first.
 *
 * BASIS, measured 2026-09-24: the scan is 4.3 s standalone and 5.2 s observed
 * under `bun test` over all 470 files, against bun's 5 s default. 30 s is ~6x
 * the standalone cost, which leaves room for the corpus to grow and for a
 * loaded runner, while still failing fast if the scan regresses into something
 * quadratic rather than hanging the suite.
 *
 * It is on all three tests rather than the first, because which one runs first
 * is not guaranteed and a budget that depends on ordering is a budget that
 * comes back.
 */
const CORPUS_TIMEOUT = 30_000;

describe("a path to the declaration is built from the constant", () => {
  test("a whole-value string literal is a bypass", () => {
    const r = checkDeclarationFilename(fixture("src/a.ts", 'const p = join(root, "harness.json");\n'));
    expect(r.bypasses).toHaveLength(1);
    expect(r.bypasses[0]!.kind).toBe("literal");
    expect(r.bypasses[0]!.line).toBe(1);
  });

  test("a single-quoted literal is the same bypass — the repo's quote style is not the rule", () => {
    const r = checkDeclarationFilename(fixture("src/a.ts", "const p = join(root, 'harness.json');\n"));
    expect(r.bypasses).toHaveLength(1);
  });

  test("a map KEY is a bypass too — it is still the filename, not a sentence", () => {
    const r = checkDeclarationFilename(fixture("src/a.ts", 'out.set("harness.json", "the root declaration");\n'));
    expect(r.bypasses).toHaveLength(1);
  });

  test("an interpolated template builds a path, so it is a bypass", () => {
    // Measured at ZERO on the real corpus. Implemented and tested anyway: the
    // class is reachable the moment somebody writes it, and a rule that has
    // never fired cannot be distinguished from a rule that cannot fire.
    const r = checkDeclarationFilename(fixture("src/a.ts", "const p = `${dir}/harness.json`;\n"));
    expect(r.bypasses).toHaveLength(1);
    expect(r.bypasses[0]!.kind).toBe("template");
  });

  // ── False-positive guards. Each one closes a class that was MEASURED on the
  // real corpus, and each must keep passing if the rule is ever narrowed. ──

  test("a message string naming the retired file is not a bypass, but it FAILS as user-visible", () => {
    // Was a guard that this is "counted, never failed". Owner ruling
    // 2026-10-20 (bean `k8rc`, option 1): output is read by someone who then
    // looks for the file, so a log line naming a file that is gone is wrong
    // at run time, which a doc comment is not.
    const src = "console.error(`no harness.json at ${root}; nothing to resolve.`);\n";
    const r = checkDeclarationFilename(fixture("src/a.ts", src));
    expect(r.bypasses).toHaveLength(0);
    expect(r.userVisible.map((u) => u.file)).toEqual(["cat-harness/src/a.ts"]);
    expect(r.counted.prose).toBe(0);
  });

  test("GUARD: a STATIC path inside backticks is prose, not construction", () => {
    // The first draft of the template rule accepted a bare `/` before the
    // filename and reported this shape out of a tool description. Only an
    // INTERPOLATION is something a constant substitutes into.
    const src = 'const d = "a repo carrying `cat-harness/harness.json` is not blank";\n';
    const r = checkDeclarationFilename(fixture("src/a.ts", src));
    expect(r.bypasses).toHaveLength(0);
    // ...and that tool-description shape is exactly the user-visible class.
    expect(r.userVisible).toHaveLength(1);
  });

  test("GUARD: `docs/_data/harness.json` is a DIFFERENT FILE and must not be reported", () => {
    // Found by that same false positive, and worth more than the rule it
    // corrected: the Jekyll data file shares the basename, is not a layer
    // declaration, and must NOT be renamed under the REPLACE ruling.
    const src = "const msg = `docs/_data/harness.json is stale.`;\n";
    const r = checkDeclarationFilename(fixture("src/a.ts", src));
    expect(r.bypasses).toHaveLength(0);
    expect(r.userVisible).toHaveLength(0);
  });

  test("GUARD: a doc comment naming the file is prose", () => {
    const r = checkDeclarationFilename(fixture("src/a.ts", " * An instance carries `harness.json`.\n"));
    expect(r.bypasses).toHaveLength(0);
    expect(r.userVisible).toHaveLength(0);
    expect(r.counted.prose).toBe(1);
  });

  // ── The user-visible class (bean `k8rc`): its own guards ──

  test("GUARD: the CURRENT declaration `cat-harness.json` in a message is not the retired name", () => {
    const src = "throw new Error(`no cat-harness.json under ${root}`);\n";
    const r = checkDeclarationFilename(fixture("src/a.ts", src));
    expect(r.userVisible).toHaveLength(0);
    expect(r.counted.prose).toBe(0);
  });

  test("GUARD: a test's own message string stays counted prose, as before", () => {
    const src = "expect(msg).toContain(`no harness.json at`);\n";
    const r = checkDeclarationFilename(fixture("src/a.test.ts", src));
    expect(r.userVisible).toHaveLength(0);
    expect(r.counted.prose).toBe(1);
  });

  test("OUTSIDE the owning instance it still fails: a message needs no import to be right", () => {
    const src = 'log("init", "Loaded harness.json");\n';
    const r = checkDeclarationFilename(fixture("schemas/a.ts", src, "folio-assistant-core"));
    expect(r.crossInstance).toHaveLength(0);
    expect(r.userVisible.map((u) => u.file)).toEqual(["folio-assistant-core/schemas/a.ts"]);
  });

  test("GUARD: a test fixture is counted and does NOT fail the gate", () => {
    // An open judgement on `jijc`, not a finding. A fixture writing the file
    // the code under test looks for has a real argument for staying pinned:
    // route it through the constant and it passes vacuously after a rename.
    const r = checkDeclarationFilename(
      fixture("src/a.test.ts", 'writeFileSync(join(root, "harness.json"), "{}");\n'),
    );
    expect(r.bypasses).toHaveLength(0);
    expect(r.counted.tests).toBe(1);
  });

  test("GUARD: a bypass OUTSIDE the owning instance is counted, not failed", () => {
    // Measured on the real corpus: two, both in folio-assistant-core, which
    // imports nothing from cat-harness. Using the constant there would be this
    // repo's first cross-instance import; a second copy would be two
    // constants. That is the split's decision, not this check's — but it is
    // REPORTED with its locations, because silently excluding it would be the
    // `dh4f` shape this repository keeps paying for.
    const r = checkDeclarationFilename(
      fixture("schemas/a.ts", 'const p = join(root, "harness.json");\n', "folio-assistant-core"),
    );
    expect(r.bypasses).toHaveLength(0);
    expect(r.crossInstance).toHaveLength(1);
    expect(r.crossInstance[0]!.file).toBe("folio-assistant-core/schemas/a.ts");
  });

  test("examining nothing is not a pass", () => {
    const empty = mkdtempSync(join(tmpdir(), "declfile-empty-"));
    const r = checkDeclarationFilename(empty);
    expect(r.filesRead).toBe(0);
    // An unreadable workflow directory is UNKNOWN, not an empty finding
    // list: the runner exits 2 on a null scan, and 1 on filesRead === 0 —
    // see the module's main. The runner itself is not spawned here because
    // it scans its own checkout, never a given root.
    expect(r.workflows).toBeNull();
  });
});

// ── The YAML half. It was one bucket until the workflow half of `jijc`. ─────
//
// These literals are DATA too — see this module's header. Each is a workflow
// line the classifier reads, not a line this file executes.

describe("a workflow line is classified, not merely counted", () => {
  test("a step that READS the retired declaration fails", () => {
    // Falsified by planting exactly this in `health-check.yml` before any of
    // the classifier existed: the check printed "✓ no call site names the
    // retired name" and exited 0.
    expect(classifyWorkflowLine("        run: cat cat-harness/harness.json")).toBe("use");
  });

  test("a comment naming it is prose — a rename REWORDS these", () => {
    expect(classifyWorkflowLine("      # the `stub` in harness.json")).toBe("prose");
    expect(classifyWorkflowLine("# Declared in `harness.json` as the `health` graph.")).toBe("prose");
  });

  test("the Jekyll data file is its own class, and outranks prose", () => {
    // Both a comment AND an exemption. The exemption is the part a rename
    // needs to hear: `docs/_data/harness.json` must NOT be renamed.
    expect(classifyWorkflowLine("          # and `docs/_data/harness.json` is a")).toBe("jekyll-data");
    expect(classifyWorkflowLine("        run: cat cat-harness/docs/_data/harness.json")).toBe("jekyll-data");
  });

  test("a line not naming it at all classifies as null, not as clean", () => {
    expect(classifyWorkflowLine("      - name: Checkout")).toBeNull();
  });
});

describe("GUARD: `cat-harness.json` CONTAINS `harness.json`", () => {
  test("the CURRENT declaration is not a reference to the retired one", () => {
    // Load-bearing, and found by writing the fix rather than by foresight: the
    // corrected `docs-site.yml` comment names `cat-harness/cat-harness.json`,
    // and a bare indexOf counted the correction as the defect. Same collision
    // class as `docs/_data`, one character further left.
    expect(classifyWorkflowLine("      # the `stub` in cat-harness/cat-harness.json")).toBeNull();
    expect(classifyWorkflowLine("        run: cat cat-harness/cat-harness.json")).toBeNull();
  });

  test("...and the boundary does not swallow the real thing", () => {
    // The direction that matters: narrowing for the collision must not make
    // the case the gate exists for invisible.
    expect(classifyWorkflowLine("        run: cat cat-harness/harness.json")).toBe("use");
    expect(classifyWorkflowLine("        run: cat harness.json")).toBe("use");
  });

  test("a second occurrence in an already-seen file is its own finding", () => {
    // The old counter counted FILES, so a bypass added to a file already on
    // the list did not move the number either.
    const a = classifyWorkflowLine("        run: cat cat-harness/harness.json");
    const b = classifyWorkflowLine("        run: cat folio-assistant/harness.json");
    expect([a, b]).toEqual(["use", "use"]);
  });
});

/*
 * The hoist above landed independently on main (#1258) and on this branch,
 * within hours, with the same shape and different names -- `corpus()` there,
 * `repoScan()` here. Main's is kept; this branch's duplicate is gone.
 *
 * One measurement from this side is worth keeping, because it says WHEN the
 * cost tipped over: promoting `arxiv-2510.21603v1` added that paper's 22
 * sections to the corpus, 4,071 -> 4,093 files, and that was the increment
 * that took the file from passing to intermittently red. Measured against a
 * worktree of origin/main rather than a stash, which is the only way to
 * measure main once a branch has commits. Nothing was wrong with the scan or
 * the promotion -- every promotion adds to this corpus, and it will tip again.
 */

describe("the workflow scan reports unknown, never zero", () => {
  test("a checkout with no .github/workflows gives null, and null is not clean", () => {
    const empty = mkdtempSync(join(tmpdir(), "declfile-noyml-"));
    mkdirSync(join(empty, "src"), { recursive: true });
    writeFileSync(join(empty, "src", "a.ts"), "export const x = 1;\n");
    const r = checkDeclarationFilename(empty);
    expect(r.workflows).toBeNull();
    // `workflowUses` must not turn unknown into an empty finding list that a
    // caller reads as a pass; the runner exits 2 on null before it gets here.
    expect(workflowUses(r)).toEqual([]);
  });

  test(
    "this repository's own workflows carry no USE",
    () => {
      const r = corpus();
      expect(workflowUses(r).map((w) => `${w.file}:${w.line}`)).toEqual([]);
    },
    CORPUS_TIMEOUT,
  );
});

/**
 * The markdown half. Bean `vzur`, turned on once its backlog was cleared.
 *
 * Prose was exempt on the TypeScript side because "a rename REWORDS these",
 * which is sound for a doc comment and not for a skill — a skill's whole job
 * is telling a reader where to look, and a REVERSAL rewords nothing.
 */
describe("markdown lines are classified, not matched", () => {
  const NO_RECORDS: string[] = [];
  const md = (rel: string, line: string, para?: string) =>
    classifyMarkdownLine(rel, line, NO_RECORDS, para ?? line);

  test("a current-path claim in a skill FAILS", () => {
    expect(md("skills/x.md", "declared in `harness.json` at the root")).toBe("use");
  });

  test("a line naming no declaration is not a finding at all", () => {
    expect(md("skills/x.md", "nothing to see here")).toBeNull();
  });

  test("`docs/_data/harness.json` is Jekyll's and must NOT be renamed", () => {
    expect(md("docs/x.md", "see `docs/_data/harness.json` for the nav")).toBe("jekyll-data");
  });

  test("a declared record directory is correct history", () => {
    expect(classifyMarkdownLine("beans/defs/x.md", "we used `harness.json`", ["beans/"])).toBe("record");
  });

  test("a generated reference follows its source rather than failing", () => {
    // The prefixes are DERIVED from each layer's `siteDirFor()`, so the
    // test supplies one rather than assuming this repo's layout.
    const gen = ["cat-harness/docs/reference/skill-instructions/"];
    expect(
      classifyMarkdownLine(
        "cat-harness/docs/reference/skill-instructions/x.md",
        "`harness.json`",
        NO_RECORDS,
        "`harness.json`",
        gen,
      ),
    ).toBe("generated");
  });

  test("history is recognised by a CURRENT name in the paragraph, not by tense", () => {
    const para = "It is `<name>.json` now.\nThat argument ran: the file stays `harness.json`.";
    expect(md("skills/x.md", "That argument ran: the file stays `harness.json`.", para)).toBe("historical");
  });

  test("...and a paragraph naming ONLY the retired word cannot excuse itself", () => {
    const para = "Open `harness.json`.\nIt lists the directories `harness.json` declares.";
    expect(md("skills/x.md", "It lists the directories `harness.json` declares.", para)).toBe("use");
  });

  test("a concrete sibling declaration counts as the current name", () => {
    const para = "`cat-harness/cat-harness.json` replaced `harness.json`.";
    expect(md("skills/x.md", para, para)).toBe("historical");
  });
});

/**
 * `harness.jsonld` is not `harness.json`, and the bean that added the LEFT
 * boundary named it in the same sentence as `cat-harness.json` before
 * guarding only the side it had a failing example for. The markdown scanner
 * found it on its first run.
 */
describe("the retired name is matched as a FILENAME, on both sides", () => {
  const md = (line: string) => classifyMarkdownLine("skills/x.md", line, []);

  test("a published rendering is not the retired declaration", () => {
    expect(md("So `…/folio-assistant/harness.jsonld` is this instance's rendering")).toBeNull();
  });

  test("the CURRENT declaration is not the retired one either", () => {
    expect(md("open `cat-harness/cat-harness.json` first")).toBeNull();
  });

  test("...but the retired name itself still matches, bounded either side", () => {
    expect(md("open `harness.json` first")).toBe("use");
    expect(md("open `cat-harness/harness.json` first")).toBe("use");
  });
});

describe("the TypeScript corpus, on this repository", () => {
  test(
    "carries no user-visible string naming the retired declaration",
    () => {
      const r = corpus();
      expect(r.userVisible.map((u) => `${u.file}:${u.line}`)).toEqual([]);
    },
    CORPUS_TIMEOUT,
  );
});

describe("the markdown corpus, on this repository", () => {
  test(
    "carries no STALE PATH",
    () => {
      const r = corpus();
      expect(markdownUses(r).map((m) => `${m.file}:${m.line}`)).toEqual([]);
    },
    CORPUS_TIMEOUT,
  );

  test(
    "and was actually examined — an empty corpus is not a pass",
    () => {
      const r = corpus();
      expect(r.markdown).not.toBeNull();
      expect(r.markdown!.length).toBeGreaterThan(0);
    },
    CORPUS_TIMEOUT,
  );
});

/**
 * The paragraph a markdown line is judged with, built in LINEAR time.
 *
 * Extracted library sections run to 3,000-line blocks with no blank line.
 * Walking out from every line to the nearest blank lines copied each block
 * once per line, about 8.5 GB of strings over the composed index, and the
 * corpus scan took 384 s on CI (core run 43469742934), timing out
 * "this repository's own workflows carry no USE".
 */
describe("a line's paragraph is found in linear time", () => {
  /** The walk this replaced, kept as the oracle. */
  const walk = (lines: string[], i: number): string => {
    let a = i;
    let b = i;
    while (a > 0 && lines[a - 1]!.trim() !== "") a--;
    while (b < lines.length - 1 && lines[b + 1]!.trim() !== "") b++;
    return lines.slice(a, b + 1).join("\n");
  };

  test("every non-blank line gets the paragraph the walk gave it", () => {
    const lines = ["", "a", "b", "", "", "c", "  ", "d", "e", "f", "", "g"];
    const at = paragraphsOf(lines);
    for (const [i, line] of lines.entries()) {
      if (line.trim() !== "") expect(at(i)).toBe(walk(lines, i));
    }
  });

  test("a file with no blank line at all is one paragraph", () => {
    const lines = ["x", "y", "z"];
    expect(paragraphsOf(lines)(1)).toBe("x\ny\nz");
  });

  test("a 20,000-line block with the retired name on every line scans in well under a second", () => {
    // Every line asks for its paragraph, the worst case for any per-line
    // walk. Measured 2026-11-13: the walk takes 11 s here (737 ms at 5,000
    // lines, under this bound, so a smaller block would not catch it); the
    // linear version takes 3 ms.
    const lines = Array.from({ length: 20000 }, (_, i) => `row ${i} names \`harness.json\` in prose`);
    const t0 = performance.now();
    const at = paragraphsOf(lines);
    for (let i = 0; i < lines.length; i++) at(i);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
