#!/usr/bin/env bun
/**
 * Write `"$schema": "cat-harness-declaration/1.0.0"` as the first key of every
 * harness declaration (`<instance>/<instance>.json`) that lacks it, or, with
 * `--check`, fail on one that still lacks it.
 *
 * A declaration is a node kind (`cat-harness-declaration/1.0.0`,
 * `schemas/kg/cat-harness.ts#CatHarnessDeclarationKind`), found by its name rather
 * than by a typology directory. `init-folio` tags new ones and
 * `CatHarnessDeclarationSchema` keeps the key through a parse; this script
 * tags older ones, and its `--check` keeps them tagged.
 *
 * The tag goes in as a TEXT edit, one line after the opening brace, so the diff
 * is one line. A declaration that carries some other `$schema` is reported and
 * left alone.
 *
 * Which declarations: every layer `layerRootsIn` finds under this
 * checkout's repository root (in an index checkout, including mounted
 * layers of other repositories, which `--check` names rather than
 * passes), or only the one named by `--instance <dir>`.
 *
 * Not tagged: the layers the harness is composed ON TOP of — every layer
 * that does not reach cat-harness through `needs` (bootstrap, bootstrap-tools;
 * `scripts/lib/needs-reach.ts`, the rule `libraries.ts` uses). Nothing in them
 * may refer to a harness; they are reported as below the harness and left
 * alone.
 *
 * Exit codes follow the bean gates: 0 every declaration tagged, 1 a defect
 * (untagged under `--check`, or a foreign tag), 2 could not check.
 *
 * @covers cat-harness — every harness declaration `<instance>/<instance>.json`, for its `$schema` tag
 * @module scripts/declarations-retag
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  CAT_HARNESS_DECLARATION_SCHEMA_TAG,
  CatHarnessDeclarationKind,
  repoRootFor,
} from "../schemas/kg/cat-harness.ts";
import { findDeclarationFile, layerRootsIn } from "../schemas/kg/instance-roots.ts";
import { acceptsSchemaTag } from "../schemas/kg/node-kind.ts";

import { belowHarness } from "./lib/needs-reach.ts";
import { HARNESS_NAME, HARNESS_ROOT } from "./lib/roots.ts";

/** The command a person runs to fix what `--check` finds, named once. */
export const RETAG_COMMAND = "bun run cat declarations:retag";

export type DeclarationOutcome = "tagged" | "added" | "foreign" | "unparseable";

export interface DeclarationRetag {
  outcome: DeclarationOutcome;
  /** The file text after the retag. Equal to the input unless `outcome` is `added`. */
  text: string;
  tag?: string;
}

/**
 * Tag one declaration's text. Pure.
 *
 * The new key goes on its own line straight after `{`, indented like the key
 * that follows it. A file whose `{` is not followed by a newline (a one-line
 * declaration) is rewritten with two-space indentation instead, which is the
 * shape every declaration in the repositories has.
 */
export function retagDeclarationText(text: string): DeclarationRetag {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { outcome: "unparseable", text };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return { outcome: "unparseable", text };
  const obj = parsed as Record<string, unknown>;
  if ("$schema" in obj) {
    return acceptsSchemaTag(CatHarnessDeclarationKind, obj.$schema)
      ? { outcome: "tagged", text }
      : { outcome: "foreign", text, tag: String(obj.$schema) };
  }
  const line = `"$schema": ${JSON.stringify(CAT_HARNESS_DECLARATION_SCHEMA_TAG)}`;
  const m = /^(\s*)\{\n([ \t]+)/.exec(text);
  if (m) {
    const empty = Object.keys(obj).length === 0;
    const at = m[1]!.length + 2;
    return { outcome: "added", text: `${text.slice(0, at)}${m[2]}${line}${empty ? "" : ","}\n${text.slice(at)}` };
  }
  return { outcome: "added", text: JSON.stringify({ $schema: CAT_HARNESS_DECLARATION_SCHEMA_TAG, ...obj }, null, 2) + "\n" };
}

export interface DeclarationsReport {
  /** Declarations checked: those below the harness are not counted. */
  files: number;
  /** Declarations of instances below the harness, left untagged on purpose. */
  below: string[];
  tagged: number;
  added: string[];
  foreign: { file: string; tag: string }[];
  unparseable: string[];
}

/** The `name` and `needs` a declaration states, or undefined if it cannot be read. */
function nameAndNeeds(text: string): { name: string; needs: string[] } | undefined {
  try {
    const o = JSON.parse(text) as { name?: unknown; needs?: unknown };
    if (typeof o.name !== "string") return undefined;
    return { name: o.name, needs: Array.isArray(o.needs) ? o.needs.filter((n): n is string => typeof n === "string") : [] };
  } catch {
    return undefined;
  }
}

/** The `needs` each declaration in `roots` states, by layer name. */
export function needsOfRoots(roots: readonly string[]): Map<string, string[]> {
  const declared = new Map<string, string[]>();
  for (const root of roots) {
    const name = findDeclarationFile(root);
    const d = name === undefined ? undefined : nameAndNeeds(readFileSync(join(root, name), "utf-8"));
    if (d) declared.set(d.name, d.needs);
  }
  return declared;
}

/**
 * Retag the declaration in each of `roots`. `write: false` changes nothing.
 * `needs` is the graph that says which layers are below the harness; by
 * default the one `roots` declare, and with `--instance` the whole checkout's,
 * so that one layer is judged by the layers around it.
 */
export function retagDeclarations(
  roots: readonly string[],
  base: string,
  opts: { write: boolean; needs?: ReadonlyMap<string, readonly string[]> },
): DeclarationsReport {
  const report: DeclarationsReport = { files: 0, below: [], tagged: 0, added: [], foreign: [], unparseable: [] };
  const found = roots.flatMap((root) => {
    const name = findDeclarationFile(root);
    return name === undefined ? [] : [{ path: join(root, name), name }];
  });
  const texts = new Map(found.map((f) => [f.path, readFileSync(f.path, "utf-8")]));
  const declared = new Map<string, readonly string[]>(opts.needs ?? []);
  for (const t of texts.values()) {
    const d = nameAndNeeds(t);
    if (d) declared.set(d.name, d.needs);
  }
  const below = belowHarness(HARNESS_NAME, declared);
  for (const { path, name } of found) {
    const shown = relative(base, path) || name;
    const before = texts.get(path)!;
    if (below.has(nameAndNeeds(before)?.name ?? "")) {
      report.below.push(shown);
      continue;
    }
    const r = retagDeclarationText(before);
    report.files++;
    if (r.outcome === "tagged") report.tagged++;
    else if (r.outcome === "foreign") report.foreign.push({ file: shown, tag: r.tag! });
    else if (r.outcome === "unparseable") report.unparseable.push(shown);
    else {
      report.added.push(shown);
      if (opts.write) writeFileSync(path, r.text);
    }
  }
  return report;
}

function argValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i >= 0) return argv[i + 1];
  return argv.find((a) => a.startsWith(`${flag}=`))?.slice(flag.length + 1);
}

function main(argv: readonly string[]): void {
  const check = argv.includes("--check");
  const one = argValue(argv, "--instance");
  const base = repoRootFor(HARNESS_ROOT);
  let roots: string[];
  if (one !== undefined) {
    const dir = resolve(one);
    if (!existsSync(dir) || findDeclarationFile(dir) === undefined) {
      console.error(`::error::declarations-retag: ${dir} holds no declaration. NOT a pass — nothing was checked`);
      process.exit(2);
    }
    roots = [dir];
  } else {
    roots = layerRootsIn(base);
  }
  if (roots.length === 0) {
    console.error(`::error::declarations-retag: no instance declaration under ${base}, so every count here would be vacuous`);
    process.exit(2);
  }

  const r = retagDeclarations(roots, base, { write: !check, needs: needsOfRoots(layerRootsIn(base)) });
  for (const f of r.foreign) {
    console.error(`::error::declarations-retag: ${f.file} carries \`$schema: ${f.tag}\`, which ${CAT_HARNESS_DECLARATION_SCHEMA_TAG} does not accept. Left as it is`);
  }
  for (const f of r.unparseable) console.error(`::error::declarations-retag: ${f} is not a JSON object`);
  const bad = r.foreign.length + r.unparseable.length;
  if (check) {
    if (r.added.length > 0) {
      console.error(
        `::error::declarations-retag: ${r.added.length} of ${r.files} declaration(s) carry no ` +
          `\`$schema: ${CAT_HARNESS_DECLARATION_SCHEMA_TAG}\`: ${r.added.join(", ")}. Run \`${RETAG_COMMAND}\``,
      );
      process.exit(1);
    }
    console.log(
      `Declaration tags — all ${r.tagged} of ${r.files} declaration(s) carry ${CAT_HARNESS_DECLARATION_SCHEMA_TAG}` +
        `${r.below.length ? `; ${r.below.length} below the harness left untagged (${r.below.join(", ")})` : ""}`,
    );
    process.exit(bad > 0 ? 1 : 0);
  }
  console.log(
    `Declaration tags — added ${CAT_HARNESS_DECLARATION_SCHEMA_TAG} to ${r.added.length} declaration(s)` +
      `${r.added.length ? ` (${r.added.join(", ")})` : ""}; ${r.tagged} already carried it` +
      `${r.below.length ? `; ${r.below.length} below the harness left untagged (${r.below.join(", ")})` : ""}`,
  );
  process.exit(bad > 0 ? 1 : 0);
}

if (import.meta.main) main(process.argv.slice(2));
