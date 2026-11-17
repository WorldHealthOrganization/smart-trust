/**
 * No e2e spec may inherit a verdict from the live QA corpus.
 *
 * `main` went red at 78a399ee5 because `qa-panel.e2e.ts` read a real sidecar
 * with `readFileSync` and asserted its first row was a FAILING
 * `voice-status-leak`. #302 then adjudicated that finding to zero, correctly,
 * and a test of the PANEL failed because the CONTENT got better. PR #314 fixed
 * that spec and `test/support/qa-fixture.ts` gave the fix a home — but nothing
 * stopped the next spec doing the same thing. This does. Bean
 * `folio-assistant-iumj`.
 *
 * ## The two rules, and what each costs
 *
 * 1. **No raw fs read of a QA/witness-corpus path in a `*.e2e.ts`.** Go through
 *    a helper in `test/support/`: `sidecarWithVerdicts` / `applyVerdicts` when
 *    the spec asserts a verdict, `indexWithRows` for a badge index, and
 *    `sidecar()` when the spec really is about shape only. The helper name IS
 *    the declaration of which of those the spec is doing, so a reviewer can
 *    see it without reading every assertion.
 *
 * 2. **A spec whose only corpus source is the verbatim `sidecar()` must not
 *    assert a verdict literal** (`toHaveText("fail")`, `"2 fail, 1 warn"`, …).
 *    That is the #314 defect wearing the helper.
 *
 * Rule 2 is per FILE, and that is its known limit: a spec that already pins
 * one verdict through `sidecarWithVerdicts` may also read another sidecar
 * verbatim, and this cannot tell which assertion targets which document
 * (`qa-panel.e2e.ts` does exactly that, legitimately). Tracking data flow into
 * Playwright assertions is a type-checker's job, not a regex's; the rule
 * catches the likely case — a NEW spec that reads a sidecar and asserts what
 * it says — which is the one that took `main` red.
 *
 * Shape is still read from disk on purpose: a hand-written fixture can agree
 * with the code while the code disagrees with what the generator writes.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TOOLS_ROOT } from "../lib/roots.ts";

const SPEC_DIR = join(TOOLS_ROOT, "test");  // bean 70lx: the specs moved here

/**
 * What a QA / witness / results corpus path looks like on DISK.
 *
 * Deliberately not `/assets/qa/…`: that prefix appears in e2e specs as the URL
 * a `page.route` mock answers, which is not a read of anything.
 */
const CORPUS =
  /test\/results\/|test\/health\/results\/|\.(?:block|kg|translation|translation-qa|qa-results)\.json\b|qa-index\.json\b/;

/** Raw readers. A helper in `test/support/` is not one of these. */
const RAW_READ = /\b(?:readFileSync|readFile|createReadStream|Bun\.file)\s*\(/g;
/** The verbatim helper — `sidecar(`, not `sidecarWithVerdicts(`. */
const VERBATIM = /\bsidecar\s*\(/g;
/** The helpers that PIN a verdict rather than inherit one. */
const PINS = /\b(?:sidecarWithVerdicts|applyVerdicts|indexWithRows)\s*\(/;

/** Assertions whose expected value is a verdict rather than a shape. */
const VERDICT_LITERALS: RegExp[] = [
  /toHaveText\(\s*["'`](?:fail|warn|pass|critical|major|minor|stale|STALE)["'`]/,
  /toHaveClass\(\s*\/fa-qa-(?:fail|warn|pass)\b/,
  /\b\d+ fail, \d+ warn\b/,
];

interface Coupling {
  rule: "raw-corpus-read" | "verdict-from-verbatim-sidecar";
  line: number;
  text: string;
}

/** The text of a call's argument list, from the `(` at `open` to its match. */
function argsAt(src: string, open: number): string {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) return src.slice(open + 1, i);
  }
  return src.slice(open + 1);
}

const lineOf = (src: string, at: number): number => src.slice(0, at).split("\n").length;

/**
 * Identifiers bound to a corpus path, to a fixpoint — `const DIR = join(ROOT,
 * "test/results/witnesses")` then `const F = join(DIR, "x.json")` makes both
 * corpus identifiers. Without this the guard is beaten by one line of
 * indirection, which is how `qa-badge.e2e.ts` and `qa-panel.e2e.ts` both
 * already spell it.
 */
function corpusIdentifiers(src: string, pattern: RegExp = CORPUS): Set<string> {
  const decls = [...src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);/g)].map(
    (m) => ({ name: m[1]!, init: m[2]! }),
  );
  const ids = new Set<string>();
  for (let changed = true; changed; ) {
    changed = false;
    for (const d of decls) {
      if (ids.has(d.name)) continue;
      if (pattern.test(d.init) || [...ids].some((id) => new RegExp(`\\b${id}\\b`).test(d.init))) {
        ids.add(d.name);
        changed = true;
      }
    }
  }
  return ids;
}

function readsCorpus(args: string, ids: Set<string>, pattern: RegExp = CORPUS): boolean {
  return pattern.test(args) || [...ids].some((id) => new RegExp(`\\b${id}\\b`).test(args));
}

/**
 * The DERIVED results trees on disk. Narrower than {@link CORPUS}: it names
 * where a file is, not what it is called.
 */
const DERIVED_TREE = /test\/results\/|test\/health\/results\//;

/**
 * Rule 3 (bean `cxcn`, reader audit R72/R73): no e2e spec reads a derived
 * results tree AT ALL — not raw, and not through a helper either. Rules 1 and
 * 2 are about inheriting a verdict; this one is about the tree being there.
 * `test/results/` is derived and leaves `main` (bean `5hox`), so a spec that
 * reads it at load fails on every checkout that does not carry it. A spec
 * that needs a witness doc reads a committed copy under
 * `test/support/fixtures/`. Returns the offending call texts.
 */
function derivedTreeReads(src: string): string[] {
  const ids = corpusIdentifiers(src, DERIVED_TREE);
  const out: string[] = [];
  for (const m of src.matchAll(/\b(?:readFileSync|readFile|createReadStream|Bun\.file|sidecar|sidecarWithVerdicts|indexWithRows|badgeRunFor)\s*\(/g)) {
    const args = argsAt(src, m.index! + m[0].length - 1);
    if (readsCorpus(args, ids, DERIVED_TREE)) out.push(`${lineOf(src, m.index!)}: ${m[0]}${args})`);
  }
  return out;
}

/** Every coupling in one spec's source. Empty means clean. */
function findCorpusCoupling(src: string): Coupling[] {
  const ids = corpusIdentifiers(src);
  const out: Coupling[] = [];

  for (const m of src.matchAll(RAW_READ)) {
    const open = m.index! + m[0].length - 1;
    const args = argsAt(src, open);
    if (readsCorpus(args, ids)) {
      out.push({ rule: "raw-corpus-read", line: lineOf(src, m.index!), text: m[0] + args + ")" });
    }
  }

  const verbatim = [...src.matchAll(VERBATIM)].filter((m) =>
    readsCorpus(argsAt(src, m.index! + m[0].length - 1), ids),
  );
  if (verbatim.length > 0 && !PINS.test(src)) {
    for (const re of VERDICT_LITERALS) {
      const hit = re.exec(src);
      if (hit) {
        out.push({
          rule: "verdict-from-verbatim-sidecar",
          line: lineOf(src, hit.index),
          text: hit[0],
        });
      }
    }
  }
  return out;
}

/** Does this spec read the corpus at all, by any route? For the sanity check. */
function touchesCorpus(src: string): boolean {
  const ids = corpusIdentifiers(src);
  return (
    ids.size > 0 ||
    [...src.matchAll(/\b(?:readFileSync|sidecar|sidecarWithVerdicts|indexWithRows)\s*\(/g)].some(
      (m) => readsCorpus(argsAt(src, m.index! + m[0].length - 1), ids),
    )
  );
}

const specs = readdirSync(SPEC_DIR, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith(".e2e.ts"))
  .map((f) => ({ file: f, src: readFileSync(join(SPEC_DIR, f), "utf8") }));

describe("the guard fires", () => {
  test("on a raw readFileSync of a sidecar path — the 78a399ee5 shape", () => {
    // declared-path-literal: source text fed to findCorpusCoupling, never read from disk; it reproduces the
    // 78a399ee5 spec, and the committed corpus it named left cat-harness (bean `7mwa`).
    const bad = `
      const BLOCK_JSON = readFileSync(
        join(ROOT, "test/results/witnesses/process-crdm-methodology/what-is-not-built-yet.block.json"),
        "utf8",
      );
      await expect(firstRow.locator(".fa-qa-chip").first()).toHaveText("fail");`;
    const found = findCorpusCoupling(bad);
    expect(found.map((c) => c.rule)).toContain("raw-corpus-read");
    expect(found[0]!.line).toBe(2);
  });

  test("through one and two lines of indirection", () => {
    const bad = `
      const DIR = join(ROOT, "test/results/witnesses");
      const FILE = join(DIR, "page/overview.block.json");
      const DOC = JSON.parse(readFileSync(FILE, "utf8"));`;
    expect(findCorpusCoupling(bad).map((c) => c.rule)).toEqual(["raw-corpus-read"]);
  });

  test("on the other corpora too — kg-qa, translation-qa, health results, a qa-index", () => {
    for (const p of [
      "test/results/kg-qa/processes/x.kg-qa.json",
      "docs/source/concepts-harness/overview.fr.translation-qa.json",
      "test/health/results/example.health-report.json",
      "docs/assets/qa/page/qa-index.json",
    ]) {
      expect(findCorpusCoupling(`const x = readFileSync("${p}", "utf8");`)).toHaveLength(1);
    }
  });

  test("on a verdict asserted off a verbatim sidecar() with nothing pinned", () => {
    const bad = `
      const JSON_ = sidecar(join(ROOT, "test/results/witnesses/a/b.block.json"));
      await expect(b).toHaveAccessibleName("Content QA: 2 fail, 1 warn, 21 pass, 26 n/a");
      await expect(chip).toHaveText("critical");`;
    const rules = findCorpusCoupling(bad).map((c) => c.rule);
    expect(rules).toEqual(["verdict-from-verbatim-sidecar", "verdict-from-verbatim-sidecar"]);
  });
});

describe("the guard does not fire", () => {
  test("on the helpers that pin a verdict", () => {
    const ok = `
      const CORPUS_PATH = join(ROOT, "test/results/witnesses/x/y.block.json");
      const BLOCK_JSON = sidecarWithVerdicts(CORPUS_PATH, [{ id: "v", result: "fail" }]);
      await expect(chip).toHaveText("fail");`;
    expect(findCorpusCoupling(ok)).toEqual([]);
  });

  test("on a verbatim sidecar() whose assertions are shape only", () => {
    const ok = `
      const KG_JSON = sidecar(join(ROOT, "test/results/witnesses/p/q.kg.json"));
      await expect(when.locator(".fa-qa-absent")).toHaveText("not recorded");`;
    expect(findCorpusCoupling(ok)).toEqual([]);
  });

  test("on site assets, or on /assets/qa/ as a mocked URL", () => {
    const ok = `
      const CSS = readFileSync(join(ROOT, SITE, "assets/css/docs-ui.css"), "utf8");
      const INDEX_URL = "/assets/qa/publication-workflow/qa-index.json";
      if (url.endsWith("/assets/qa/block.json")) return route.fulfill({ body: X });
      await expect(chip).toHaveText("fail");`;
    // `INDEX_URL` names a qa-index but is never READ — only a mocked route.
    expect(findCorpusCoupling(ok)).toEqual([]);
  });
});

describe("the real e2e specs", () => {
  test("are found — a guard over zero files passes vacuously", () => {
    expect(specs.length).toBeGreaterThan(10);
  });

  test("the known QA-doc readers are recognised as readers", () => {
    // If the path heuristic rots (the files move, say), these stop being
    // recognised and every other assertion here passes over nothing. Since
    // bean `cxcn` both read committed fixtures, which still carry a QA-doc
    // name through the helpers, so they are still found.
    const readers = specs.filter((s) => touchesCorpus(s.src)).map((s) => s.file.replace(/\\/g, "/"));
    expect(readers).toContain("sdlc/qa-badge.e2e.ts");
    for (const f of ["sdlc/qa-panel.e2e.ts", "sdlc/qa-badge.e2e.ts"]) {
      expect(specs.find((s) => s.file.replace(/\\/g, "/") === f)!.src).toContain("test/support/fixtures/qa-e2e/");
    }
  });

  test("rule 3 fires on a helper fed a derived-tree path, and not on a fixture path", () => {
    expect(derivedTreeReads(`const P = join(ROOT, "test/results/witnesses/a/b.block.json");\nconst J = sidecarWithVerdicts(P, []);`)).toHaveLength(1);
    expect(derivedTreeReads(`const J = indexWithRows(join(ROOT, "test/results/witnesses/p/qa-index.json"), {});`)).toHaveLength(1);
    expect(derivedTreeReads(`const J = sidecar(join(TOOLS_ROOT, "test", "support", "fixtures", "qa-e2e", "kg-witness.json"));`)).toEqual([]);
  });

  test.each(specs.map((s) => [s.file, s.src] as const))("%s reads no derived results tree (rule 3)", (_file, src) => {
    expect(derivedTreeReads(src)).toEqual([]);
  });

  test.each(specs.map((s) => [s.file, s.src] as const))("%s takes no verdict from the live corpus", (file, src) => {
    const found = findCorpusCoupling(src);
    if (found.length > 0) {
      const where = found.map((c) => `  ${file}:${c.line} [${c.rule}] ${c.text.trim()}`).join("\n");
      throw new Error(
        `e2e spec reads the live QA corpus in a way that can inherit a verdict:\n${where}\n` +
          `A verdict is content and is SUPPOSED to change; a spec keyed to it goes red when a ` +
          `finding is correctly adjudicated (78a399ee5, bean iumj). Use a helper in ` +
          `test/support/: sidecarWithVerdicts/applyVerdicts to pin the verdict under test, ` +
          `indexWithRows for a badge index, or sidecar() when the spec asserts shape only.`,
      );
    }
  });
});
