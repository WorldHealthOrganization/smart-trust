#!/usr/bin/env bun
/**
 * Validate a node in the graph — **one Tool, parameterised by graph typology**.
 *
 * Give it a path, and it works out what the file *is* from the declaration —
 * which declared directory contains it, and therefore which graph typology —
 * then runs that kind's validator.
 *
 * ## What it refuses to call valid
 *
 * A kind with no declared validator yields **could not determine**, and this
 * exits non-zero on it by default rather than printing a tick: many kinds,
 * including `qa`, have none, so "nothing to run" is not "fine". `--lenient`
 * downgrades it to a warning for a caller that knowingly wants partial
 * coverage.
 *
 * @module folio-assistant/scripts/kg-validate
 */

import { existsSync, readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

import { instanceDirectories, layerRootsIn, readDeclaration } from "../schemas/kg/cat-harness.js";
import { checkoutRootFor } from "../schemas/kg/harness-config.js";
import type { z } from "zod";

import { familyBody, nodeFamilyTag, resolveKindValidator, resolveNodeSchemas, stripAnnotations } from "../schemas/kg/kind-validator.js";
import { pathToFileURL } from "node:url";
import { HARNESS_ROOT } from "./lib/roots.ts";

const instanceRoot = pathToFileURL(HARNESS_ROOT + "/").pathname.replace(/\/$/, "");

export type Verdict =
  | { path: string; state: "valid"; kind: string }
  | { path: string; state: "invalid"; kind: string; problems: string[] }
  | { path: string; state: "undetermined"; reason: string; kind?: string };

/**
 * Which declared graph typology owns this path.
 *
 * The LONGEST matching directory wins, because declarations nest — `beans/`
 * contains `beans/defs/`, and answering with the outer one would validate a
 * bean definition against the wrong kind and pass.
 */
export function kindForPath(
  filePath: string,
  root: string,
  dirs: { path: string; graphTypologies: string[] }[],
): string | undefined {
  const rel = relative(root, resolve(filePath));
  if (rel.startsWith("..")) return undefined;
  let best: { len: number; kind: string } | undefined;
  for (const d of dirs) {
    const dir = d.path.replace(/\/+$/, "");
    if (rel === dir || rel.startsWith(dir + sep) || rel.startsWith(dir + "/")) {
      // A directory may declare several graphs; one is unambiguous, more is
      // not, and guessing which would be the lie of precision the
      // `cat-harness` kind's own doc comment warns about.
      if (d.graphTypologies.length === 1 && (!best || dir.length > best.len)) {
        best = { len: dir.length, kind: d.graphTypologies[0] };
      }
    }
  }
  return best?.kind;
}

/**
 * The declared layer that OWNS a path: the deepest layer root in the
 * checkout that contains it, or `fallback` when none does (bean `676g`).
 *
 * ## Why this exists
 *
 * `kg:validate` resolved every path against ONE root — its own layer,
 * `cat-harness/` — so a file inside a NESTED layer was refused rather than
 * validated. Measured on `main` `cf3e624`:
 *
 * ```
 * kg:validate smart-dak/test/results/kg-qa/scenarios/kg.kg-qa.json
 *   ? … could not determine: no declared directory owns this path
 * ```
 *
 * `smart-dak.json` declares `test/results/` as `qa` — one kind — so the
 * failing branch was "no directory owns it": the resolver never read that
 * layer's declaration at all. ~150 committed sidecars across 13 layers
 * sat in that gap, which is why `kg:audit:all:check` could prove them current
 * but nothing could prove they PARSE for a consumer.
 *
 * ## Why the deepest, not the first
 *
 * Layers nest inside the checkout, and the layer declared AT the
 * checkout root contains every other one. Answering with the outer one would
 * resolve a nested layer's path against the root's declaration — the same
 * refusal, one level up. Longest-prefix is the rule `kindForPath` already
 * applies to directories, for the same reason.
 */
const checkoutRootsCache = new Map<string, string[]>();

export function owningInstanceRoot(filePath: string, fallback: string): string {
  const abs = resolve(filePath);
  const checkout = checkoutRootFor(fallback);
  let roots = checkoutRootsCache.get(checkout);
  if (!roots) {
    roots = layerRootsIn(checkout);
    checkoutRootsCache.set(checkout, roots);
  }
  let best: string | undefined;
  for (const r of roots) {
    const rel = relative(r, abs);
    if (rel.startsWith("..") || resolve(r, rel) !== abs) continue;
    if (best === undefined || r.length > best.length) best = r;
  }
  return best ?? fallback;
}

/**
 * Validate one file.
 *
 * Two roots, because they answer two questions (bean `676g`):
 *
 * - `root` — the layer whose DECLARATION says which directory owns the
 *   path, and therefore its graph typology. For a nested layer's file that is
 *   the nested layer (see {@link owningInstanceRoot}).
 * - `schemaRoot` — what the kind's unqualified `module#Export` validator refs
 *   resolve against: the layer whose registry DEFINES the kind. The
 *   registry here is `defaultGraphTypologies`, defined in this layer, so its
 *   refs (`schemas/sdlc/kg-qa.ts#…`) are relative to `cat-harness/`. Resolving them
 *   against `smart-dak/` instead reported "schemas/sdlc/kg-qa.ts does not exist"
 *   for every nested sidecar — the second half of the same refusal.
 *
 * `schemaRoot` defaults to `root`, so a caller validating the registry's own
 * layer is unchanged.
 */
export async function validatePath(filePath: string, root: string, schemaRoot: string = root): Promise<Verdict> {
  if (!existsSync(filePath)) {
    return { path: filePath, state: "undetermined", reason: "no such file" };
  }
  return validateText(filePath, readFileSync(filePath, "utf-8"), root, schemaRoot);
}

/**
 * Validate a node's TEXT as the file it would be at `filePath`.
 *
 * {@link validatePath} without the read: the path still decides the owning
 * declaration and the kind, and `text` is the body. A sidecar read from the
 * `qa-reports` store (`readQaTree`) has a checkout path but no file in the
 * checkout once the working copy is not committed (bean `7mwa`,
 * cat-harness#857), and it is judged by the same rule as one on disk.
 */
const instanceDirsCache = new Map<string, ReturnType<typeof instanceDirectories>>();

export async function validateText(filePath: string, text: string, root: string, schemaRoot: string = root): Promise<Verdict> {
  const absRoot = resolve(root);
  let dirs = instanceDirsCache.get(absRoot);
  if (!dirs) {
    const decl = readDeclaration(root);
    if (!decl) {
      return { path: filePath, state: "undetermined", reason: `no declaration under ${root}` };
    }
    // Own entries AND those declared from within (bean `cmsl`): a voice file
    // under `skills/voices/` classified as `skills`, or as nothing, the moment
    // `voices` moved into `skills/skills.json` (measured 2026-09-30, bean `2j2r`).
    dirs = instanceDirectories(root, decl);
    instanceDirsCache.set(absRoot, dirs);
  }
  const kind = kindForPath(filePath, root, dirs);
  if (!kind) {
    return {
      path: filePath,
      state: "undetermined",
      reason:
        "no declared directory owns this path, or the one that does declares " +
        "several graphs and which applies is not stated",
    };
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return {
      path: filePath,
      state: "undetermined",
      kind,
      reason: `not readable as JSON: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // Bean `rdkm`: a kind that names its `$schema` families routes the node by
  // its own tag first — `qa` holds seven families, and the kind-level
  // validator would check six of them against the wrong shape.
  const families = await resolveNodeSchemas(kind, schemaRoot);
  let schema: z.ZodTypeAny;
  if (families.length) {
    const tag = nodeFamilyTag(data);
    const fam = families.find((f) => f.tag === tag);
    if (!fam) {
      return { path: filePath, state: "undetermined", kind, reason: `${kind} names no $schema family ${JSON.stringify(tag)}` };
    }
    if (fam.state !== "resolved") {
      const why =
        fam.state === "shape" ? "is a TypeScript shape, not a runnable schema"
        : fam.state === "external" ? `conforms to ${fam.spec}, which nothing here runs`
        : fam.reason;
      return { path: filePath, state: "undetermined", kind, reason: `${fam.tag} ${why}` };
    }
    schema = fam.schema;
  } else {
    const v = await resolveKindValidator(kind, schemaRoot);
    if (v.state !== "resolved") {
      return { path: filePath, state: "undetermined", kind, reason: v.reason };
    }
    schema = v.schema;
  }
  const parsed = schema.safeParse(families.length ? familyBody(data) : stripAnnotations(data));
  if (parsed.success) return { path: filePath, state: "valid", kind };
  return {
    path: filePath,
    state: "invalid",
    kind,
    problems: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
  };
}

async function main(): Promise<number> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const lenient = process.argv.includes("--lenient");
  if (args.length === 0) {
    console.log("usage: bun run cat kg:validate <path>… [--lenient]");
    return 2;
  }

  let bad = 0;
  let undetermined = 0;
  for (const p of args) {
    // Against the layer that OWNS the path, not this script's own (bean
    // `676g`) — see `owningInstanceRoot`.
    const abs = resolve(p);
    const v = await validatePath(abs, owningInstanceRoot(abs, instanceRoot), instanceRoot);
    if (v.state === "valid") {
      console.log(`✓ ${v.path}  [${v.kind}]`);
    } else if (v.state === "invalid") {
      bad++;
      console.log(`✗ ${v.path}  [${v.kind}]`);
      for (const pr of v.problems) console.log(`    ${pr}`);
    } else {
      undetermined++;
      console.log(`? ${v.path}${v.kind ? `  [${v.kind}]` : ""} — could not determine: ${v.reason}`);
    }
  }

  if (bad > 0) return 1;
  if (undetermined > 0 && !lenient) {
    console.log(
      `\n${undetermined} file(s) could not be checked. Exiting non-zero: "nothing to ` +
        `run" is not "valid". Pass --lenient to accept partial coverage knowingly.`,
    );
    return 1;
  }
  return 0;
}

if (import.meta.main) process.exit(await main());
