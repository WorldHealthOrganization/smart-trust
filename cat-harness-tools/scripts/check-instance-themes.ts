#!/usr/bin/env bun
/**
 * Every layer that declares a `themes` graph: does it load, and does each
 * theme in it validate?
 *
 * @module scripts/check-instance-themes
 * @covers themes
 *
 * Resolves themes through `instanceThemes` in `schemas/ui/theme-by-ref.ts`,
 * the function every generator uses, rather than re-deriving them, so the gate
 * cannot disagree with what pages are rendered from. The platform's own theme
 * constants (`THEMES`, `THEME_LAYOUTS`) are a different thing and are not
 * read here.
 *
 * **Graded:** a declared themes directory whose module will not load, and a
 * theme that does not satisfy `ResolvedThemeSchema`.
 *
 * **Reported, never graded:** which kinds a layer's themes carry (e.g.
 * `sticky`, which the board styles cards from). Authoring one is the
 * layer's choice, not a defect.
 *
 * **Could-not-determine is never green:** a layer whose declaration will
 * not load, or a themes module that throws, exits 2.
 *
 * Exit codes: 0 report only, or `--check` with no blocking finding · 1
 * `--check` with one · 2 could not determine.
 */
import {
  layerRootsIn,
  readDeclaration,
} from "../schemas/kg/cat-harness.js";
import {
  explainThemeRefMiss,
  instanceThemes,
  THEMES_GRAPH_TYPOLOGY,
} from "../schemas/ui/theme-by-ref.js";
import { ResolvedThemeSchema } from "../schemas/ui/theme.js";
import { instanceDirectoriesForGraph } from "../schemas/kg/cat-harness.js";

interface Finding {
  readonly instance: string;
  readonly detail: string;
}

/** One layer's themes, once its declaration has been read. */
interface Row {
  readonly instance: string;
  readonly dirs: number;
  readonly themes: number;
  /** Theme kinds present, with how many carry each. */
  readonly kinds: ReadonlyMap<string, number>;
  readonly invalid: readonly string[];
  readonly miss?: string;
}

function main(): number {
  const repoRoot = process.cwd();
  const check = process.argv.includes("--check");

  const roots = layerRootsIn(repoRoot);
  if (roots.length === 0) {
    console.error("✗ no instance declaration read — refusing (see `layerRootsIn`).");
    return 2;
  }

  const rows: Row[] = [];
  for (const root of roots) {
    let name: string | undefined;
    try {
      name = readDeclaration(root)?.name;
    } catch (e) {
      // A declaration that will not load means this layer cannot be judged,
      // and judging the rest and printing a clean sweep is the `dh4f` defect.
      console.error(`✗ cannot read the declaration in ${root}:`);
      console.error(`  ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      return 2;
    }
    if (name === undefined) continue;

    const dirs = instanceDirectoriesForGraph(root, THEMES_GRAPH_TYPOLOGY);
    if (dirs.length === 0) continue; // declares no themes graph — not a finding

    let got: ReturnType<typeof instanceThemes>;
    try {
      got = instanceThemes(repoRoot, name);
    } catch (e) {
      console.error(`✗ ${name}'s themes module threw while loading:`);
      console.error(`  ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`);
      console.error("  Refusing: a module that throws is not a module that has no themes.");
      return 2;
    }

    if (!got.ok) {
      rows.push({
        instance: name,
        dirs: dirs.length,
        themes: 0,
        kinds: new Map(),
        invalid: [],
        miss: explainThemeRefMiss(got.miss),
      });
      continue;
    }

    const kinds = new Map<string, number>();
    const invalid: string[] = [];
    for (const t of got.themes) {
      const parsed = ResolvedThemeSchema.safeParse(t);
      const id = (t as { id?: unknown }).id;
      const label = typeof id === "string" ? id : "<no id>";
      if (!parsed.success) {
        invalid.push(`${label}: ${parsed.error.issues[0]?.message ?? "does not validate"}`);
        continue;
      }
      const k = parsed.data.kind;
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }

    rows.push({
      instance: name,
      dirs: dirs.length,
      themes: got.themes.length,
      kinds,
      invalid,
    });
  }

  // ── Report ─────────────────────────────────────────────────────────────
  const declaring = rows.length;
  const themes = rows.reduce((n, r) => n + r.themes, 0);

  console.log("Instance themes — every instance declaring a `themes` graph\n");
  console.log(`  instances read              ${roots.length}`);
  console.log(`  ...declaring a themes graph ${declaring} of ${roots.length}`);
  console.log(`  themes loaded               ${themes}\n`);

  if (declaring === 0) {
    // NOT a pass dressed as one. No layer declares the graph, so every
    // family below swept an empty domain and this run cleared nothing.
    console.log("  NOTE: no instance declares a `themes` graph, so this run examined");
    console.log("        nothing. That is a determined empty rather than a clean sweep.");
  }

  const findings: Finding[] = [];
  for (const r of rows) {
    console.log(`  ${r.instance}: ${r.themes} theme(s) in ${r.dirs} director(y/ies)`);
    if (r.miss !== undefined) {
      console.log(`      ✗ ${r.miss}`);
      findings.push({ instance: r.instance, detail: r.miss });
      continue;
    }
    // KINDS ARE REPORTED AND NOT GRADED — see the module docblock. Which theme
    // may style a given surface is the owner's authoring decision (#1584).
    const kinds = [...r.kinds].map(([k, n]) => `${k} ${n}`).join(", ");
    console.log(`      kinds: ${kinds || "none"}`);
    for (const bad of r.invalid) {
      console.log(`      ✗ ${bad}`);
      findings.push({ instance: r.instance, detail: bad });
    }
  }
  console.log();

  if (findings.length === 0) {
    console.log(
      declaring === 0
        ? "· nothing to check — no instance declares a `themes` graph."
        : `✓ every declared themes graph loads, and all ${themes} theme(s) validate.`,
    );
  } else {
    console.log(`✗ ${findings.length} finding(s) across ${declaring} declaring instance(s).`);
  }

  return check && findings.length > 0 ? 1 : 0;
}

// GUARDED so the module can be imported. Without this, a test importing an
// exported helper runs the CLI and exits the test runner — which is exactly
// what happened to `upload-names.test.ts`: the report printed and the run
// died with no tally. `if (import.meta.main)` is the idiom every other
// importable script here uses.
if (import.meta.main) process.exit(main());
