/**
 * Read a Knowledge Graph Declaration with nothing but bootstrap's own shape.
 *
 * @module bootstrap-tools/schemas/declaration
 *
 * ## Why this exists instead of a harness's reader
 *
 * bootstrap-tools needed three things from the hosting harness's declaration module
 * — find a directory's declaration, parse it, list the layers in a
 * checkout — and importing them pulled in that module and seven more: 9,299 of
 * the 11,577 lines the bootstrap code reached (measured 2026-09-29). A -tools
 * package for bootstrap may depend on bootstrap and nothing above it (owner,
 * 2026-09-29: the Zod moves down, and bootstrap-tools depends on `zod` alone).
 *
 * The rule is the same one the hosting harness applies, so the two cannot disagree
 * about which file is a declaration: **a directory's declaration is the
 * `<stem>.json` whose own `name` equals `<stem>`.** Nothing is inferred from
 * the directory's name. The shape is bootstrap's `KnowledgeGraphDeclarationSchema`,
 * which passes every other field through — a harness's fields are Extensions.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import type { z } from "zod";

import { KnowledgeGraphDeclarationSchema } from "./graph.ts";

export type KnowledgeGraphDeclaration = z.infer<typeof KnowledgeGraphDeclarationSchema>;

/** The declaration file in `dir`, or `undefined` when there is none. Throws on two. */
export function declarationFileIn(dir: string): string | undefined {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return undefined;
  }
  const found = entries.filter((entry) => {
    if (!entry.endsWith(".json") || entry === ".json") return false;
    try {
      return (JSON.parse(readFileSync(join(dir, entry), "utf-8")) as { name?: unknown }).name === entry.slice(0, -5);
    } catch {
      return false;
    }
  });
  if (found.length > 1) {
    throw new Error(`${resolve(dir)} carries ${found.length} declarations (${found.sort().join(", ")}); a directory is one Knowledge Graph.`);
  }
  return found[0] ? join(dir, found[0]) : undefined;
}

/** Parse `dir`'s declaration with bootstrap's shape, or `undefined` when there is none. Throws when it does not parse. */
export function readKnowledgeGraphDeclaration(dir: string): KnowledgeGraphDeclaration | undefined {
  const file = declarationFileIn(dir);
  if (!file) return undefined;
  const r = KnowledgeGraphDeclarationSchema.safeParse(JSON.parse(readFileSync(file, "utf-8")));
  if (!r.success) throw new Error(`${file} is not a Knowledge Graph declaration: ${r.error.message}`);
  return r.data;
}

/**
 * Every Knowledge Graph in a checkout: its root, if it declares one, and each
 * directory directly under it that does. One level, because that is where an
 * layer's declaration sits; a nested layer is its own checkout's to list.
 */
/**
 * Top-level build-output directories, never layers. Scanning them read every
 * `*.json` a build wrote (`build/qa-refresh.json`, stamped with a commit and
 * per-writer seconds), which made that report an input of every writer that
 * lists the checkout's graphs, so none of them could be skipped when it was
 * rebuilt (bean fwtz, 2026-11-01). The same list as `NOT_INSTANCE_DIRS` in
 * https://github.com/litlfred/cat-harness-tools (scripts/); this layer may not import it.
 */
// input-site: inert #29752765 — the build-output directories instance discovery leaves out; it reads none of them
export const BUILD_OUTPUT_DIRS: readonly string[] = ["build", "_kg", "_site", "dist"];

export function knowledgeGraphsIn(repoRoot: string): { root: string; decl: KnowledgeGraphDeclaration }[] {
  const out: { root: string; decl: KnowledgeGraphDeclaration }[] = [];
  const add = (dir: string) => {
    const decl = readKnowledgeGraphDeclaration(dir);
    if (decl) out.push({ root: resolve(dir), decl });
  };
  add(repoRoot);
  for (const entry of readdirSync(repoRoot).sort()) {
    const dir = join(repoRoot, entry);
    if (entry.startsWith(".") || entry === "node_modules" || BUILD_OUTPUT_DIRS.includes(entry) || !existsSync(dir) || !statSync(dir).isDirectory()) continue;
    add(dir);
  }
  return out;
}

/**
 * Does this toolset support `content` at `version`? It declares the content
 * MAJOR versions it handles under `supports` (owner, 2026-09-29: tools may
 * manage several versions of the content). Semver: within one major a newer
 * minor or patch only adds, so a major is the unit of support — and no range
 * syntax, per instance-versioning rule 2.
 */
export function supportsContent(tools: Record<string, unknown>, content: string, version: string | undefined): boolean {
  const majors = (tools["supports"] as Record<string, unknown> | undefined)?.[content];
  const m = /^(\d+)\.\d+\.\d+$/.exec(version ?? "");
  return Array.isArray(majors) && m !== null && majors.includes(Number(m[1]));
}
