/**
 * `check:instance-themes` — the gate that truly covers the `themes` kind.
 *
 * Bean `z6xd`: three gates declared `@covers themes` while none of them
 * resolved a themes directory, so the kind read `covered` over ground nothing
 * reached. These tests hold the three things that made that possible.
 *
 * **The declaration must match the scan set.** The strongest test here is not
 * about this script at all: it asserts that exactly one script in the corpus
 * declares `@covers themes`, and that the one which does resolves a themes
 * directory. The original defect was written from a script's TITLE, which no
 * amount of reading the script would have caught.
 *
 * **One answer, not two.** The gate calls `instanceThemes` — the same
 * resolution every generator renders a theme reference through. A gate that
 * re-derived it would be free to disagree with the pages, which is `z6xd`'s own
 * defect one layer along, so a test asserts the import.
 *
 * **Kinds are reported and never graded.** The board styles a card only from
 * `sticky` themes, and whether a layer authors one is the owner's call
 * (#1584; answered for who-iris on 2026-09-30, bean `v8n5`). So a green run over
 * a missing `sticky` is CORRECT and a test pins it, over a fixture layer: a
 * check that failed would be answering a question its author was told not to.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { coversIn } from "../../audit-coverage.js";

const REPO = resolve(import.meta.dir, "..", "..", "..", "..");
const SCRIPT = join("cat-harness-tools", "scripts", "check-instance-themes.ts");
// Scripts live in TWO directories while the 70lx split is in flight: the
// harness's and, once moved, the tools layer's. A claim is about a script,
// not about which directory it currently sits in, so both are scanned.
const SCRIPTS_DIRS = [join(REPO, "cat-harness", "scripts"), join(REPO, "cat-harness-tools", "scripts")].filter((d) => existsSync(d));
const scriptPath = (file: string): string => SCRIPTS_DIRS.map((d) => join(d, file)).find((p) => existsSync(p)) ?? join(SCRIPTS_DIRS[0]!, file);

function run(...args: string[]): { status: number; out: string } {
  const r = spawnSync("bun", ["run", SCRIPT, ...args], { cwd: REPO, encoding: "utf-8" });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/**
 * The kinds a script declares, read with **the auditor's own parser**.
 *
 * A first draft of this helper reimplemented it and got a different answer:
 * `coversIn` stops the kind list at the em-dash and treats the rest as prose,
 * so `@covers none — it reads `THEMES`, the platform's themes` declares
 * exactly `none`. The lookalike split the whole line on whitespace, found the
 * word "themes" in the REASON, and reported gen-themes-css as still claiming
 * the kind. That is the `vq8g` defect — a detector that recognises one form and
 * calls the corpus wrong — committed inside the test written to catch it. Use
 * the parser the verdict is actually computed from.
 */
function coversOf(file: string): string[] {
  return coversIn(readFileSync(scriptPath(file), "utf-8")) ?? [];
}

describe("the repository passes as committed", () => {
  test("`--check` is green", () => {
    const { status, out } = run("--check");
    expect(out).toContain("instances read");
    expect(status).toBe(0);
  });

  test("every count carries its denominator", () => {
    const { out } = run();
    expect(out).toMatch(/\.\.\.declaring a themes graph\s+\d+ of \d+/);
  });
});

describe("the declaration matches the scan set — z6xd itself", () => {
  test("exactly one script declares `@covers themes`, and it is this one", () => {
    const claimants = SCRIPTS_DIRS.flatMap((d) => readdirSync(d))
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => coversOf(f).includes("themes"));
    expect(claimants).toEqual(["check-instance-themes.ts"]);
  });

  test("the claimant actually resolves a themes directory", () => {
    // The defect was a declaration written from a script's TITLE. A claimant
    // that never asks for a directory of the kind it claims is that defect,
    // whatever its name says.
    const text = readFileSync(scriptPath("check-instance-themes.ts"), "utf-8");
    expect(text).toContain("instanceDirectoriesForGraph");
    expect(text).toContain("THEMES_GRAPH_TYPOLOGY");
  });

  test("the three former claimants declare `none` WITH a reason", () => {
    // `none` with an empty reason looks decided and is not — the same rule
    // `check:artefact-verification` applies to its own `none` entries.
    for (const f of ["check-theme-art.ts", "gen-themes-css.ts", "render-theme-sheet.ts"]) {
      // `coversIn` returns the KIND LIST only, so a correct `none` declaration
      // reads exactly ["none"] however long its reason is.
      expect(coversOf(f)).toEqual(["none"]);
      // ...and the reason must be there: `none` with nothing after it looks
      // decided and is not, the rule check:artefact-verification applies to
      // its own `none` entries.
      const line = readFileSync(scriptPath(f), "utf-8").match(/^ \* @covers none(.*)$/m);
      expect(line?.[1]?.trim().length ?? 0).toBeGreaterThan(8);
    }
  });
});

describe("one answer, not two", () => {
  test("it calls the runtime's own resolution rather than re-deriving it", () => {
    const text = readFileSync(scriptPath("check-instance-themes.ts"), "utf-8");
    // The SAME module, wherever the script sits relative to it (70lx moves
    // scripts to `cat-harness-tools/`, which reaches it through `cat-harness/`).
    expect(text).toMatch(/import \{[^}]*instanceThemes[^}]*\} from "(?:\.\.\/|@litlfred\/cat-harness\/)schemas\/(?:ui\/)?theme-by-ref\.js"/s);
  });
});

describe("kinds are reported, never graded", () => {
  test("a declaring instance with no `sticky` theme is still green", () => {
    // Authoring a sticky theme is the owner's call per layer (#1584); this
    // MUST pass, and if it ever fails somebody has graded an authoring call.
    // It used who-iris as the example until who-iris authored one (bean
    // `v8n5`, owner 2026-09-30), so the case is now a FIXTURE layer whose
    // only theme is a `webpage` — the real corpus no longer holds one.
    const dir = mkdtempSync(join(tmpdir(), "instance-themes-"));
    try {
      mkdirSync(join(dir, ".git"));
      mkdirSync(join(dir, "acme", "themes"), { recursive: true });
      writeFileSync(
        join(dir, "acme", "acme.json"),
        JSON.stringify({ name: "acme", version: "0.1.0", directories: [{ id: "acme-themes", path: "themes/", graphTypologies: ["themes"] }] }),
      );
      const themeTs = JSON.stringify(join(REPO, "cat-harness-tools", "schemas", "ui", "theme.ts"));
      writeFileSync(
        join(dir, "acme", "themes", "themes.ts"),
        `import { ResolvedThemeSchema } from ${themeTs};\nexport const INSTANCE_THEMES = [ResolvedThemeSchema.parse({ $schema: "folio-theme/v1", kind: "webpage", id: "acme-web", name: "Acme", palette: { surface: "#ffffff", ink: "#111111", edge: "#cccccc", accent: "#aa0000" }, layouts: { laptop: { minWidth: "1000px", padding: "1rem", fontScale: 1 }, mobile: { minWidth: "100%", padding: "1rem", fontScale: 1 }, card: { minWidth: "200px", padding: "1rem", fontScale: 1 } } })];\n`,
      );
      const r = spawnSync("bun", ["run", join(REPO, SCRIPT), "--check"], { cwd: dir, encoding: "utf-8" });
      const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
      expect(out).toMatch(/kinds: .*webpage/);
      expect(out).not.toMatch(/sticky/);
      expect(r.status).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("the kinds line is printed, so the gap is visible without being fatal", () => {
    expect(run().out).toMatch(/kinds: /);
  });
});

describe("could-not-determine is never green", () => {
  test("an empty declaring set is reported as a determined empty, not a pass", () => {
    // Today the set is 1, so this asserts the BRANCH exists rather than its
    // output: a future repository with no themes graph must not read as clean.
    const text = readFileSync(scriptPath("check-instance-themes.ts"), "utf-8");
    expect(text).toContain("determined empty rather than a clean sweep");
    expect(text).toContain("nothing to check");
  });

  test("a themes module that throws refuses rather than counting zero", () => {
    const text = readFileSync(scriptPath("check-instance-themes.ts"), "utf-8");
    expect(text).toContain("a module that throws is not a module that has no themes");
  });
});
