#!/usr/bin/env bun
/**
 * Write `requirements.txt` and `requirements-extended.txt` from the declaration,
 * into this layer's declared `python/` directory — the location
 * `requirementsPath` in `cat-harness/schemas/sdlc/python-deps.ts` names, and nowhere
 * else.
 *
 * `schemas/sdlc/python-deps.ts` is definitional; these are downstream. pip
 * cannot read TypeScript, and the declaration carries what a flat list cannot
 * — the import name a distribution provides, and why a package has no import
 * at all — so the files are generated, never authored. `--check` fails when
 * either file is stale.
 *
 *   bun run cat deps:python          # write both files
 *   bun run cat deps:python:check    # fail if either is stale
 *
 * @covers code
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import {
  DEP_TIERS,
  depsForTier,
  importNameOf,
  requirementsPath,
  type DepTier,
} from "../schemas/sdlc/python-deps.ts";
import { REPO_ROOT, TOOLS_ROOT } from "./lib/roots.ts";
import { resolveScriptCommand } from "./lib/script-command.ts";
import { tools } from "../tools/discover.ts";
import type { ToolDefinition } from "../schemas/tools/tool.ts";

// THIS LAYER's root, because `requirementsPath` is relative to it. The pair
// sat beside `package.json` until 2026-10-06 and moved into the declared
// `python/` directory (bean `ar1s`, phase 3); CI still installs it from the
// checkout root, as `pip install -r cat-harness-tools/python/requirements.txt`.
const ROOT = TOOLS_ROOT;

// An image's Dockerfile path and build context are the REPOSITORY's — a
// Tool's `docker build` line runs from the checkout.
const DOCKER_ROOT = REPO_ROOT ?? TOOLS_ROOT;

/** The file body for one tier. Deterministic, so `--check` compares bytes. */
export function requirementsBody(tier: DepTier): string {
  const deps = [...depsForTier(tier)].sort((a, b) => a.distribution.localeCompare(b.distribution));
  const head = [
    "# GENERATED — do not edit.",
    "# Source: schemas/sdlc/python-deps.ts (bean 68dt). Regenerate: bun run cat deps:python",
    "#",
    tier === "lean"
      ? "# The set CI installs. Everything a gate can exercise."
      : "# NOT installed in CI. Declared so the cost is visible rather than implied;",
    tier === "lean" ? "#" : "# see each entry's reason in schemas/sdlc/python-deps.ts.",
    "",
  ];
  const body = deps.flatMap((d) => {
    // The `why` travels with the package. A requirements file is where
    // somebody lands when an install fails, and "what is this for" is the
    // question they have — answering it in the source file only would make
    // this artefact the less useful of the two.
    const note = d.transitive ? `${d.why} (no direct import)` : d.why;
    // `imports:` is STRUCTURED, not prose — `scripts/tests/python-deps-importable.test.py`
    // parses it. The mapping from a distribution to the module it provides was
    // written down in English only ("Imports as `yaml`"), which is unreadable to
    // the one check that could falsify it. Emitted for EVERY package, including
    // the ones where it equals the distribution name: a parser with a default
    // path cannot tell a missing line from an unremarkable one.
    return [`# ${d.distribution}: ${note}`, `# imports: ${importNameOf(d)}`, d.distribution, ""];
  });
  return [...head, ...body].join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * Does every image a Tool declares install the DECLARED set, rather than a
 * list retyped beside it?
 *
 * Added 2026-09-21 after the two diverged in silence. The Dockerfile carried a
 * hand-maintained pip list that omitted 6 of the 10 declared packages —
 * `cffi`, `cryptography`, `pymupdf`, `pillow`, `pdfminer.six`, `pdfplumber` —
 * and the omission was invisible because `--check` only ever compared
 * `requirements.txt` against this schema. Both were internally consistent;
 * nothing asked whether the IMAGE installed what they agreed on.
 *
 * The cost is on `requirements.txt` itself, which has documented it since
 * 2026-09-19: without `cffi`, importing `cryptography` raises
 * `ModuleNotFoundError: _cffi_backend` and then panics under pyo3, so every
 * PDF backend fails at import time. The knowledge was written down and the
 * image did not read it.
 *
 * ## Which images (bean `ar1s`, phase 2)
 *
 * This read the ROOT `Dockerfile` until 2026-10-07 — the one image no workflow
 * built — while every image that WAS built retyped its own list, the exact
 * drift it was written for. An image is now part of the Tool that uses it: a
 * Tool's `install.container` is its `docker build` line (or the script key that declares it), and the
 * `-f <Dockerfile>` there is the image checked. The set of images is the
 * declared one rather than a path chosen here, so deleting a Dockerfile cannot
 * turn this into a check of nothing — the Tool that declared it reports it
 * missing.
 *
 * ## What it asserts
 *
 * The WEAK property, deliberately: an image that pip-installs anything
 * installs a GENERATED requirements file (COPYed from its declared path), and
 * names no declared distribution on a pip line of its own. It does not parse
 * the generated file — a checker that re-derived the list would be a second
 * opinion about what is installed, free to disagree with the file it checks.
 * Wheels and build tools outside the declaration (`maturin`, a local `.whl`)
 * are not a retyped list and pass.
 */
export interface ImageFinding {
  tool: string;
  dockerfile: string | null;
  problem: string;
}

/** The generated files, as paths in the REPOSITORY build context an image COPYs from. */
export function generatedPaths(): string[] {
  const prefix = relative(DOCKER_ROOT, ROOT);
  return DEP_TIERS.map((t) => (prefix === "" ? requirementsPath(t) : `${prefix}/${requirementsPath(t)}`));
}

/** The `-f <Dockerfile>` a `docker build` line names, or null. */
export function dockerfileOf(installContainer: string): string | null {
  const m = /(?:^|\s)(?:-f|--file)(?:=|\s+)(\S+)/.exec(installContainer);
  return m ? m[1]! : null;
}

/** Instructions with `\`-continued lines joined, so one RUN is one string. */
function instructions(dockerfile: string): string[] {
  return dockerfile
    .replace(/\\\r?\n/g, " ")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
}

/** The findings for one Dockerfile's text. Pure, so the rules are testable without a Tool registry. */
export function dockerfileFindings(text: string, generated = generatedPaths()): string[] {
  const declared = new Set(DEP_TIERS.flatMap((t) => depsForTier(t).map((d) => d.distribution.toLowerCase())));
  const lines = instructions(text);
  // Where each generated file lands in the image: `COPY <generated> <dest>`.
  const landed = new Set<string>();
  for (const l of lines) {
    const m = /^COPY\s+(?:--\S+\s+)*(\S+)\s+(\S+)$/i.exec(l);
    if (m && generated.includes(m[1]!)) landed.add(m[2]!.endsWith("/") ? m[2]! + m[1]!.split("/").pop() : m[2]!);
  }
  const findings: string[] = [];
  let pipLines = 0;
  let installsGenerated = false;
  for (const l of lines) {
    for (const seg of l.split(/&&|;/)) {
      const m = /\bpip3?\s+install\b(.*)$/.exec(seg);
      if (!m) continue;
      pipLines++;
      const args = m[1]!.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < args.length; i++) {
        const a = args[i]!;
        if (a === "-r" || a === "--requirement") {
          const file = args[++i] ?? "";
          if (landed.has(file)) installsGenerated = true;
          else findings.push(`installs \`-r ${file}\`, which is not a generated requirements file COPYed into the image`);
          continue;
        }
        if (a.startsWith("-")) continue;
        const name = a.replace(/^["']|["']$/g, "").replace(/[<>=!~[;].*$/, "").toLowerCase();
        if (declared.has(name)) findings.push(`retypes \`${a}\`, a declared distribution — install the generated file instead`);
      }
    }
  }
  if (pipLines > 0 && !installsGenerated) {
    findings.push(`pip-installs packages but never \`-r\` a generated requirements file COPYed from ${generated.join(" or ")}`);
  }
  return findings;
}

/** The findings over every image the given Tools declare through `install.container`. */
export function imageFindings(defs: ToolDefinition[], root = DOCKER_ROOT): ImageFinding[] {
  const out: ImageFinding[] = [];
  for (const t of defs) {
    const declared = t.install.container;
    if (declared === undefined) continue;
    // A script key (owner ruling J2) is read as the command it is declared to
    // run: the definition names the key, the implementing layer the line.
    const build = resolveScriptCommand(root, declared)?.command;
    if (build === undefined) {
      out.push({ tool: t.id, dockerfile: null, problem: `\`install.container\` names a script key no manifest declares: ${declared}` });
      continue;
    }
    const df = dockerfileOf(build);
    if (df === null) {
      out.push({ tool: t.id, dockerfile: null, problem: "`install.container` names no `-f <Dockerfile>`" });
      continue;
    }
    const p = join(root, df);
    if (!existsSync(p)) {
      out.push({ tool: t.id, dockerfile: df, problem: "the Dockerfile does not exist" });
      continue;
    }
    for (const problem of dockerfileFindings(readFileSync(p, "utf-8"))) out.push({ tool: t.id, dockerfile: df, problem });
  }
  return out;
}

export function staleTiers(root = ROOT): DepTier[] {
  return DEP_TIERS.filter((tier) => {
    const p = join(root, requirementsPath(tier));
    if (!existsSync(p)) return true;
    return readFileSync(p, "utf-8") !== requirementsBody(tier);
  });
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  if (check) {
    const stale = staleTiers();
    if (stale.length > 0) {
      console.error(`✗ ${stale.length} requirements file(s) stale: ${stale.map(requirementsPath).join(", ")}`);
      console.error("  Run: bun run cat deps:python");
      process.exit(1);
    }
    const defs = tools();
    const images = defs.filter((t) => t.install.container !== undefined);
    const findings = imageFindings(defs);
    if (findings.length > 0) {
      console.error(`✗ ${findings.length} finding(s) in the images Tools declare:`);
      for (const f of findings) console.error(`  ${f.tool} (${f.dockerfile ?? "no Dockerfile"}): ${f.problem}`);
      console.error("  A list retyped beside the generated one drifts, and did: it omitted cffi,");
      console.error("  cryptography, pymupdf, pillow, pdfminer.six and pdfplumber. Without cffi,");
      console.error("  importing cryptography panics and every PDF backend fails at import.");
      process.exit(1);
    }
    console.log(`✓ ${DEP_TIERS.length} requirements file(s) current with schemas/sdlc/python-deps.ts`);
    console.log(`✓ ${images.length} declared image(s) install the declared set rather than retyping it: ${images.map((t) => t.id).join(", ") || "none"}`);
    process.exit(0);
  }
  for (const tier of DEP_TIERS) {
    const p = join(ROOT, requirementsPath(tier));
    writeFileSync(p, requirementsBody(tier), "utf-8");
    console.log(`wrote ${requirementsPath(tier)}  (${depsForTier(tier).length} package(s))`);
  }
}
