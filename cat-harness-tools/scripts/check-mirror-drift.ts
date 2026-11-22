#!/usr/bin/env bun
/**
 * Mirror-drift audit — a content-block `.lean` sibling that restates a library
 * declaration must not disagree with it.
 *
 * Content-block `.lean` siblings compile standalone, so a sibling that needs a
 * library type restates it (same `structure`/`class`, name and namespace).
 * When the copies drift, the sibling still wins **candidate 1** of `lean.ref`
 * resolution (`resolveCanonicalLean` / `walkBlocks` in `pipeline/qa-utils.ts`),
 * so every checker on that block audits the sibling's copy, not the one
 * `lake build` compiles.
 *
 * ## What counts as drift
 *
 * Same fully-qualified name (namespace + declaration name) declared both under
 * a package's Lake root and in a co-located sibling, where the two disagree on
 * either the `extends` list or the declared field names. Field types are not
 * part of *that* comparison — a rename or a re-ordering is drift, a whitespace
 * change is not.
 *
 * Reported separately, not as drift:
 *
 *   - `regime` — the pair agrees on every field name and parent but sits on
 *     **opposite sides of the §7c substrate→archimedean wall**, judged by
 *     `ARCHIMEDEAN_TYPE_RE` on the field *types*. The wall gates only catch a
 *     file that mixes regimes, not a declaration wholly on the wrong side.
 *     Drifted pairs that also cross the wall are counted under
 *     `driftedRegime` and flagged in place.
 *   - `duplicate-in-library` — one fully-qualified name declared more than once
 *     inside the Lake tree. Nothing to mirror against; fix that first.
 *
 * ## Gating
 *
 * Reports everything and exits 0 by default. `--baseline <N>` freezes the
 * current count so the gate fires only on growth.
 *
 * Exit codes:
 *   0  — under all gates, or `--warn-only`.
 *   2  — drifted-pair count exceeds `--max <N>`.
 *   3  — drifted-pair count exceeds `--baseline <N>` (growth gate).
 *
 * Usage
 * -----
 *   bun run cat-harness-tools/scripts/check-mirror-drift.ts                  # summary to stdout
 *   bun run cat-harness-tools/scripts/check-mirror-drift.ts --json           # machine-readable
 *   bun run cat-harness-tools/scripts/check-mirror-drift.ts --tsv drift.tsv  # one row per pair
 *   bun run cat-harness-tools/scripts/check-mirror-drift.ts --baseline 50    # fail only on growth
 *   bun run cat-harness-tools/scripts/check-mirror-drift.ts --max 0          # fail on any drift
 *   bun run cat-harness-tools/scripts/check-mirror-drift.ts --package qou    # one package only
 *
 * ## Parser limits
 *
 * Regex, not Lean. It reads a `structure`/`class` head, then indented
 * `field :` lines until the first dedent, tracking `namespace`/`section` as a
 * stack. Consequences:
 *
 *   - A field whose type spans lines before its `:` is missed.
 *   - A `where`-clause default on its own line is not counted as a field.
 *   - A head binder written `[inst : Foo]` on its own line is counted as a
 *     field. Both sides are parsed identically, so a drift verdict stays
 *     sound; a field *list* printed in a finding may include one binder.
 *   - Name + namespace collision is treated as "same declaration".
 *
 * `--json` reports `identical` alongside `drifted`; if that ratio collapses,
 * suspect the parser before the corpus. Parser regressions are pinned in
 * `scripts/tests/check-mirror-drift.test.ts`.
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";

import { LEAN_PACKAGES, type LeanPackage } from "../schemas/lean-packages.ts";
import { findContentRepoRoot } from "../pipeline/repo-root.ts";
import { ARCHIMEDEAN_TYPE_RE } from "../pipeline/qa-checkers-voice.ts";

// ── Lean surface parsing ─────────────────────────────────────────

/** One `structure`/`class` declaration as this parser sees it. */
interface Decl {
  /** Fully-qualified name: enclosing namespaces plus the declaration name. */
  fqn: string;
  /** `structure` or `class`. */
  kind: string;
  /** Absolute path of the file it was read from. */
  file: string;
  /** 1-indexed line of the declaration head. */
  line: number;
  /** Parent structures named in an `extends` clause, in source order. */
  extends: string[];
  /** Declared field names, in source order. Types are deliberately ignored. */
  fields: string[];
  /**
   * True when any field's *type* names a real-field type, by the corpus's own
   * `ARCHIMEDEAN_TYPE_RE` (`pipeline/qa-checkers-voice.ts`).
   *
   * This is the §7c side of the declaration. Two mirrors can agree on every
   * field *name* and still sit on opposite sides of the substrate→archimedean
   * wall, which the field-name comparison scores as a faithful mirror — see
   * `regimeDiffers` in the findings.
   */
  archimedean: boolean;
}

const HEAD = /^(\s*)(structure|class)\s+([A-Za-z_][A-Za-z0-9_'!?]*)/;
const NAMESPACE = /^\s*namespace\s+([A-Za-z0-9_.'!?]+)/;
/** Named *or* anonymous — an unnamed `section` still consumes an `end`. */
const SECTION = /^\s*section(?:\s+([A-Za-z0-9_.'!?]+))?\s*$/;
const END = /^\s*end(?:\s+([A-Za-z0-9_.'!?]+))?\s*$/;
/**
 * A field line: indented, optionally instance-implicit, `name :`.
 *
 * The identifier may start uppercase — `M : Type*`, `C : Type u` and
 * `Target : Place → Type*` are all real fields in this corpus, and a
 * lowercase-only pattern silently drops them, which turns a drifted pair whose
 * only difference is such a field into a false "identical".
 */
const FIELD = /^\s{2,}\[?\s*([A-Za-z_][A-Za-z0-9_'!?]*)\s*:/;
const EXTENDS = /\bextends\s+([^:]+?)(?:\s+where\b|$)/;

/**
 * Reduce one `extends` entry to the parent's name.
 *
 * Explicit universe annotations and applied arguments are dropped:
 * `QuantumUniverse.{u, v} R` and `QuantumUniverse R` name the same parent, and
 * Lean infers the levels either way. Comparing the raw text instead reports
 * every mirror that spells its universes differently, which is noise a gate
 * cannot afford — the corpus's own `QuantumObservableUniverse` pair is exactly
 * that case, identical in every field and differing only in `.{u, v}`.
 *
 * A genuine change of parent (`extends B` → `extends C`) or of arity
 * (`extends B, C` → `extends B`) still shows, because those change the names.
 */
export function parentName(entry: string): string {
  return stripUniverses(entry).trim().split(/\s+/)[0] ?? "";
}

/** Remove `.{u, v}` universe annotations from a clause. */
function stripUniverses(s: string): string {
  return s.replace(/\.\{[^}]*\}/g, "");
}

/**
 * Split an `extends` clause into its parent entries.
 *
 * Universe annotations are stripped **before** splitting, because `.{u, v}`
 * contains a comma: splitting first turns `B.{u, v} R` into `B.{u` and `v} R`,
 * which then compares unequal against a plain `B R` no matter how the entries
 * are normalised afterwards.
 */
export function splitExtends(clause: string): string[] {
  return stripUniverses(clause)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse every `structure`/`class` in one file.
 *
 * The namespace stack holds `section` entries too: a *named* section closed by
 * `end Foo` is indistinguishable from a namespace at the regex level, so both
 * go on one stack and `end` pops whichever is on top. Getting this wrong
 * silently mis-attributes every declaration after the first named section.
 */
export function parseLeanDecls(file: string, text: string): Decl[] {
  const out: Decl[] = [];
  const stack: { kind: "namespace" | "section"; name: string }[] = [];
  const lines = text.split("\n");

  let cur: Decl | undefined;
  let curIndent = 0;
  let inDocstring = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];

    // Block comments and docstrings can contain anything that looks like a
    // field, so track them before any other match.
    if (inDocstring) {
      if (raw.includes("-/")) inDocstring = false;
      continue;
    }
    if (/^\s*(\/--|\/-)/.test(raw) && !raw.includes("-/")) {
      inDocstring = true;
      continue;
    }
    if (/^\s*(\/--|\/-)/.test(raw)) continue; // single-line docstring
    if (/^\s*--/.test(raw)) continue;

    const ns = NAMESPACE.exec(raw);
    if (ns) {
      stack.push({ kind: "namespace", name: ns[1] });
      cur = undefined;
      continue;
    }
    const sec = SECTION.exec(raw);
    if (sec) {
      stack.push({ kind: "section", name: sec[1] });
      continue;
    }
    const end = END.exec(raw);
    if (end) {
      if (stack.length) stack.pop();
      cur = undefined;
      continue;
    }

    const head = HEAD.exec(raw);
    if (head) {
      const nsPath = stack
        .filter((s) => s.kind === "namespace")
        .map((s) => s.name)
        .join(".");
      const ext = EXTENDS.exec(raw);
      cur = {
        fqn: nsPath ? `${nsPath}.${head[3]}` : head[3],
        kind: head[2],
        file,
        line: i + 1,
        extends: ext ? splitExtends(ext[1]) : [],
        fields: [],
        archimedean: ARCHIMEDEAN_TYPE_RE.test(raw),
      };
      curIndent = head[1].length;
      out.push(cur);
      continue;
    }

    if (!cur) continue;

    // The head can wrap: binders and an `extends` clause often sit on their own
    // indented lines before `where`. Absorb those before anything else, and
    // only while no field has been seen — after the first field we are in the
    // body and `extends` can no longer appear.
    if (cur.fields.length === 0) {
      const ext = EXTENDS.exec(raw);
      if (ext) {
        cur.extends.push(...splitExtends(ext[1]));
        continue;
      }
      if (/^\s*(\{|\[[A-Z]|\(|where\b)/.test(raw)) continue;
    }

    // A non-blank line at or left of the head's indent closes the body.
    if (raw.trim() && raw.search(/\S/) <= curIndent) {
      cur = undefined;
      continue;
    }

    const f = FIELD.exec(raw);
    if (f) {
      cur.fields.push(f[1]);
      // The field's TYPE decides the §7c side. Only the text after the `:` is
      // tested, so a field merely *named* `real_part` does not count as
      // archimedean while `field : M → ℝ` does.
      if (ARCHIMEDEAN_TYPE_RE.test(raw.slice(raw.indexOf(":", f.index) + 1))) {
        cur.archimedean = true;
      }
    }
  }

  return out;
}

// ── File discovery ───────────────────────────────────────────────

function walkLean(dir: string, skip: string[]): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    if (skip.some((s) => d === s || d.startsWith(s + "/"))) continue;
    if (d.includes("/.lake")) continue;
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.endsWith(".lean")) out.push(full);
    }
  }
  return out;
}

function exists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

// ── Audit ────────────────────────────────────────────────────────

type Finding =
  | {
      type: "drift";
      fqn: string;
      /** Whether the sibling is a block sibling, i.e. masks a `lean.ref`. */
      masksLeanRef: boolean;
      sibling: { file: string; line: number; fields: string[]; extends: string[] };
      library: { file: string; line: number; fields: string[]; extends: string[] };
      siblingOnly: string[];
      libraryOnly: string[];
      extendsDiffers: boolean;
      /** The two sides sit on opposite sides of the §7c wall. */
      regimeDiffers: boolean;
    }
  | {
      type: "regime";
      fqn: string;
      masksLeanRef: boolean;
      sibling: { file: string; line: number; archimedean: boolean };
      library: { file: string; line: number; archimedean: boolean };
    }
  | { type: "duplicate-in-library"; fqn: string; files: string[] };

interface Report {
  packages: string[];
  totals: {
    libraryDecls: number;
    siblingDecls: number;
    /** Same-FQN pairs found — the denominator for `identical` + `drifted`. */
    pairs: number;
    identical: number;
    drifted: number;
    /** Drifted pairs whose sibling masks a block's `lean.ref`. */
    driftedMaskingLeanRef: number;
    driftedFiles: number;
    /** Drifted pairs that ALSO sit on opposite sides of the §7c wall. */
    driftedRegime: number;
    /**
     * Pairs that agree on every field name and parent yet sit on opposite
     * sides of the wall — invisible to the field comparison, counted here.
     */
    regimeOnly: number;
    regimeFiles: number;
    duplicatesInLibrary: number;
  };
  findings: Finding[];
}

function audit(repoRoot: string, packages: readonly LeanPackage[]): Report {
  const libraryByFqn = new Map<string, Decl[]>();
  const siblingByFqn = new Map<string, Decl[]>();
  let libraryDecls = 0;
  let siblingDecls = 0;

  for (const pkg of packages) {
    const lakeRoot = resolve(repoRoot, pkg.lakeRoot);
    const paperRoot = join(folioDir(repoRoot),  pkg.paperDir);

    const push = (m: Map<string, Decl[]>, d: Decl) => {
      const bucket = m.get(d.fqn);
      if (bucket) bucket.push(d);
      else m.set(d.fqn, [d]);
    };

    for (const f of walkLean(lakeRoot, [])) {
      for (const d of parseLeanDecls(f, readFileSync(f, "utf8"))) {
        libraryDecls++;
        push(libraryByFqn, d);
      }
    }
    for (const f of walkLean(paperRoot, [lakeRoot])) {
      for (const d of parseLeanDecls(f, readFileSync(f, "utf8"))) {
        siblingDecls++;
        push(siblingByFqn, d);
      }
    }
  }

  const findings: Finding[] = [];
  const driftedFiles = new Set<string>();
  let pairs = 0;
  let identical = 0;
  let drifted = 0;
  let driftedMasking = 0;
  let driftedRegime = 0;
  let regimeOnly = 0;
  const regimeFiles = new Set<string>();
  let duplicates = 0;

  for (const [fqn, libDecls] of [...libraryByFqn].sort()) {
    const sibDecls = siblingByFqn.get(fqn);
    if (!sibDecls) continue;

    if (libDecls.length > 1) {
      duplicates++;
      findings.push({
        type: "duplicate-in-library",
        fqn,
        files: libDecls.map((d) => relative(repoRoot, d.file)),
      });
      // Nothing authoritative to mirror against; do not also call it drift.
      continue;
    }
    const lib = libDecls[0];

    for (const sib of sibDecls) {
      pairs++;
      const sameFields =
        sib.fields.length === lib.fields.length &&
        sib.fields.every((f, i) => f === lib.fields[i]);
      const sibParents = sib.extends.map(parentName);
      const libParents = lib.extends.map(parentName);
      const sameExtends =
        sibParents.length === libParents.length &&
        sibParents.every((e, i) => e === libParents[i]);
      const regimeDiffers = sib.archimedean !== lib.archimedean;

      if (sameFields && sameExtends) {
        // Same field names, same parents — and still possibly opposite sides of
        // the §7c wall, because field *types* are not part of that comparison.
        // Reported as its own kind rather than folded into `drifted`: the fix
        // is a wall split, not a field resync, and the count is a §7c figure
        // that should not move when someone drains the drift backlog.
        if (regimeDiffers) {
          regimeOnly++;
          regimeFiles.add(sib.file);
          findings.push({
            type: "regime",
            fqn,
            masksLeanRef: exists(sib.file.replace(/\.lean$/, ".ts")),
            sibling: {
              file: relative(repoRoot, sib.file),
              line: sib.line,
              archimedean: sib.archimedean,
            },
            library: {
              file: relative(repoRoot, lib.file),
              line: lib.line,
              archimedean: lib.archimedean,
            },
          });
          continue;
        }
        identical++;
        continue;
      }
      drifted++;
      if (regimeDiffers) driftedRegime++;
      driftedFiles.add(sib.file);
      const masks = exists(sib.file.replace(/\.lean$/, ".ts"));
      if (masks) driftedMasking++;
      findings.push({
        type: "drift",
        fqn,
        masksLeanRef: masks,
        sibling: {
          file: relative(repoRoot, sib.file),
          line: sib.line,
          fields: sib.fields,
          extends: sib.extends,
        },
        library: {
          file: relative(repoRoot, lib.file),
          line: lib.line,
          fields: lib.fields,
          extends: lib.extends,
        },
        siblingOnly: sib.fields.filter((f) => !lib.fields.includes(f)),
        libraryOnly: lib.fields.filter((f) => !sib.fields.includes(f)),
        extendsDiffers: !sameExtends,
        regimeDiffers,
      });
    }
  }

  return {
    packages: packages.map((p) => p.name),
    totals: {
      libraryDecls,
      siblingDecls,
      pairs,
      identical,
      drifted,
      driftedMaskingLeanRef: driftedMasking,
      driftedFiles: driftedFiles.size,
      driftedRegime,
      regimeOnly,
      regimeFiles: regimeFiles.size,
      duplicatesInLibrary: duplicates,
    },
    findings,
  };
}

// ── Output ───────────────────────────────────────────────────────

function printSummary(r: Report): void {
  const t = r.totals;
  console.log(`mirror-drift — packages: ${r.packages.join(", ") || "(none)"}`);
  console.log(
    `  declarations: ${t.libraryDecls} in Lake trees, ${t.siblingDecls} in block siblings`,
  );
  console.log(`  same-FQN pairs: ${t.pairs}`);
  console.log(`    identical (faithful mirrors): ${t.identical}`);
  console.log(`    DRIFTED:                      ${t.drifted}`);
  console.log(
    `      of which mask a block's lean.ref: ${t.driftedMaskingLeanRef}`,
  );
  console.log(`      across files:                     ${t.driftedFiles}`);
  console.log(`      of which ALSO cross the §7c wall: ${t.driftedRegime}`);
  console.log(
    `    §7c REGIME-ONLY (same fields, opposite sides of the wall): ${t.regimeOnly} across ${t.regimeFiles} file(s)`,
  );
  if (t.duplicatesInLibrary) {
    console.log(
      `  duplicate FQNs inside the Lake tree: ${t.duplicatesInLibrary} (reported, not counted as drift)`,
    );
  }
  if (t.pairs) {
    const pct = ((t.identical / t.pairs) * 100).toFixed(0);
    console.log(
      `  faithful-mirror rate: ${pct}% — the parser's control; if this collapses, suspect the parser`,
    );
  }
  console.log();
  for (const f of r.findings) {
    if (f.type === "duplicate-in-library") {
      console.log(`DUPLICATE-IN-LIBRARY  ${f.fqn}`);
      for (const p of f.files) console.log(`    ${p}`);
      continue;
    }
    if (f.type === "regime") {
      console.log(
        `REGIME ${f.fqn}${f.masksLeanRef ? "  [masks lean.ref]" : ""}  — same fields, opposite sides of the §7c wall`,
      );
      console.log(
        `    sib ${f.sibling.file}:${f.sibling.line}  ${f.sibling.archimedean ? "archimedean" : "algebraic"}`,
      );
      console.log(
        `    lib ${f.library.file}:${f.library.line}  ${f.library.archimedean ? "archimedean" : "algebraic"}`,
      );
      continue;
    }
    console.log(`DRIFT  ${f.fqn}${f.masksLeanRef ? "  [masks lean.ref]" : ""}`);
    console.log(`    sib ${f.sibling.file}:${f.sibling.line}`);
    console.log(`    lib ${f.library.file}:${f.library.line}`);
    if (f.siblingOnly.length) {
      console.log(`    sibling-only fields: ${f.siblingOnly.join(", ")}`);
    }
    if (f.libraryOnly.length) {
      console.log(`    library-only fields: ${f.libraryOnly.join(", ")}`);
    }
    if (f.regimeDiffers) {
      console.log(
        "    §7c: the two sides are on opposite sides of the wall — a field " +
          "resync will not fix this, a wall split will",
      );
    }
    if (f.extendsDiffers) {
      console.log(
        `    extends differs: sib [${f.sibling.extends.join(", ")}] vs lib [${f.library.extends.join(", ")}]`,
      );
    }
  }
}

function writeTsv(r: Report, path: string): void {
  const rows = [
    [
      "fqn",
      "masksLeanRef",
      "siblingFile",
      "siblingLine",
      "libraryFile",
      "libraryLine",
      "siblingOnly",
      "libraryOnly",
      "extendsDiffers",
    ].join("\t"),
  ];
  for (const f of r.findings) {
    if (f.type !== "drift") continue;
    rows.push(
      [
        f.fqn,
        String(f.masksLeanRef),
        f.sibling.file,
        String(f.sibling.line),
        f.library.file,
        String(f.library.line),
        f.siblingOnly.join(" "),
        f.libraryOnly.join(" "),
        String(f.extendsDiffers),
      ].join("\t"),
    );
  }
  writeFileSync(path, rows.join("\n") + "\n");
}

// ── Main ─────────────────────────────────────────────────────────

interface Args {
  json: boolean;
  tsv?: string;
  max?: number;
  baseline?: number;
  packageName?: string;
  warnOnly: boolean;
  repoRoot: string;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { json: false, warnOnly: false, repoRoot: findContentRepoRoot() };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--json": a.json = true; break;
      case "--warn-only": a.warnOnly = true; break;
      case "--tsv": a.tsv = argv[++i]; break;
      case "--max": a.max = Number(argv[++i]); break;
      case "--baseline": a.baseline = Number(argv[++i]); break;
      case "--package": a.packageName = argv[++i]; break;
      case "--repo-root": a.repoRoot = resolve(argv[++i]); break;
      default:
        console.error(`unknown argument: ${argv[i]}`);
        process.exit(64);
    }
  }
  return a;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const pkgs = args.packageName
    ? LEAN_PACKAGES.filter((p) => p.name === args.packageName)
    : LEAN_PACKAGES;
  if (args.packageName && pkgs.length === 0) {
    console.error(
      `no configured Lean package named "${args.packageName}" — have: ${LEAN_PACKAGES.map((p) => p.name).join(", ") || "(none)"}`,
    );
    process.exit(64);
  }

  const report = audit(args.repoRoot, pkgs);

  if (args.tsv) writeTsv(report, args.tsv);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printSummary(report);

  let code = 0;
  const n = report.totals.drifted;
  if (args.max !== undefined && n > args.max) {
    console.error(`drifted pairs ${n} exceeds --max ${args.max}`);
    code = 2;
  } else if (args.baseline !== undefined && n > args.baseline) {
    console.error(
      `drifted pairs ${n} exceeds --baseline ${args.baseline} — new drift was introduced`,
    );
    code = 3;
  }

  if (args.warnOnly) {
    if (code !== 0) console.error("(warn-only: not exiting non-zero)");
    process.exit(0);
  }
  process.exit(code);
}

// Guarded so `scripts/tests/check-mirror-drift.test.ts` can import
// `parseLeanDecls` without the audit running (and calling `process.exit`).
if (import.meta.main) main();
