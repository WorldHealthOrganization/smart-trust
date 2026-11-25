#!/usr/bin/env bun
/**
 * ig-instantiate.ts — what an IG repository newly harnessed on this layer
 * declares for it: `contentTypes.ig` in its `index.config.json`, and
 * `output-ast/` ignored.
 *
 * @module fhir-harness/scripts/ig-instantiate
 * @covers none — a SETUP step: it writes two files once and judges no graph
 *
 * ```sh
 * bun run fhir-harness/scripts/ig-instantiate.ts [--root <checkout>]
 * ```
 *
 * It is the checkout script `instantiate:fhir-harness`, which
 * cat-harness-tools' `instantiate-harness.ts` runs after it has mounted this
 * layer over a repository and before it commits the setup.
 *
 * ## `contentTypes.ig`: the paths this layer reads, and only those
 *
 * Owner, 2026-10-30: a harness "desclares what it it pays attention to in the
 * repo" (`schemas/ig-content-type.ts`). A repository without the section is
 * read as a legacy IG, every path, and each site step says so. This writes
 * the IG's own sources, the ones that exist: `sushi-config.yaml`, `ig.ini`
 * and `input/`. An existing section is left alone: what a repository already
 * declares is its author's choice.
 *
 * ## `output-ast/`: built here, never committed
 *
 * `ig-ast-build.sh` (`prepare:fhir-harness`) and `ig-cache.sh restore` write
 * the AST to `output-ast/`. Its home is the cache branch, so the checkout
 * ignores it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { IG_INDEX_SECTION } from "../schemas/ig-content-type.ts";

/** The IG sources this layer reads, in the order they are written. */
export const IG_SOURCES = ["sushi-config.yaml", "ig.ini", "input/"] as const;

/** `index.config.json` with `contentTypes.ig` when it has none; `undefined` when nothing changes. */
export function withIgSection(config: Record<string, unknown>, present: (path: string) => boolean): Record<string, unknown> | undefined {
  const types = (config.contentTypes as Record<string, unknown> | undefined) ?? {};
  if (types[IG_INDEX_SECTION] !== undefined) return undefined;
  const include = IG_SOURCES.filter(present);
  if (include.length === 0) throw new Error(`none of ${IG_SOURCES.join(", ")} is here: this is not an IG repository`);
  return { ...config, contentTypes: { ...types, [IG_INDEX_SECTION]: { include } } };
}

/** `.gitignore` with `output-ast/` ignored; the author's lines kept. */
export function withIgnoredAst(text: string): string {
  if (/^\/?output-ast\/?\s*$/m.test(text)) return text;
  return `${text}${text === "" || text.endsWith("\n") ? "" : "\n"}output-ast/\n`;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--root");
  const root = resolve(at >= 0 ? argv[at + 1]! : ".");
  const configFile = join(root, "index.config.json");
  if (!existsSync(configFile)) {
    console.error(`✗ ig-instantiate: ${configFile} is absent; mount this layer first (cat-harness-tools instantiate-harness.ts)`);
    process.exit(2);
  }
  const next = withIgSection(JSON.parse(readFileSync(configFile, "utf-8")) as Record<string, unknown>, (p) => existsSync(join(root, p)));
  if (next) {
    writeFileSync(configFile, `${JSON.stringify(next, null, 2)}\n`);
    console.error(`✓ contentTypes.${IG_INDEX_SECTION}: ${JSON.stringify((next.contentTypes as Record<string, { include: string[] }>)[IG_INDEX_SECTION]!.include)}`);
  } else console.error(`· contentTypes.${IG_INDEX_SECTION} already declared — left as it is`);
  const ignore = join(root, ".gitignore");
  const before = existsSync(ignore) ? readFileSync(ignore, "utf-8") : "";
  const after = withIgnoredAst(before);
  if (after !== before) writeFileSync(ignore, after);
  console.error(after !== before ? "✓ .gitignore: output-ast/" : "· .gitignore already ignores output-ast/");
}
