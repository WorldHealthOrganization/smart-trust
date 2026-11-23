/**
 * The files of every declared directory of one graph typology, across the
 * layers of a checkout: the one scan behind each node graph a harness
 * declares instead of a central table (`typologies/`, `validators/`). Reads
 * each declaration RAW (`directories[].graphTypologies`, `path`, `scope`)
 * because the declaration's Zod schema lives in `cat-harness.ts`, which
 * imports the registry that calls this. A LEAF: filesystem and
 * `instance-roots.ts` only.
 *
 * @module cat-harness/schemas/declared-nodes
 * @graphNode none — a function library over the declared directories; it defines no schema
 */
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

import { findDeclarationFile, layerRootsIn } from "./instance-roots";

/**
 * A TEST FIXTURE checkout scanned beside the real one: `FOLIO_FIXTURE_CHECKOUT`.
 *
 * Set by `test-preload.ts` only when the checkout under test holds no
 * vocabulary — cat-harness standing alone, as `check:cat-harness-standalone`
 * runs it — and never in the monorepo, where the real layers are present.
 * It points at `test/fixtures/standalone-checkout/`, copies of the node graphs
 * cat-harness's tests read from core and sci, held equal to them by
 * `standalone-fixture.test.ts`. Owner, 2026-10-05: fixture the tests rather
 * than grow the standalone baseline.
 */
const FIXTURE_ENV = "FOLIO_FIXTURE_CHECKOUT";

/**
 * Which layers of a checkout a scan reads: given a layer root, whether
 * its declared directories count. Omitted, every layer does. A generator
 * whose output must not depend on what else is mounted beside it (bean `8lcl`:
 * the harness's published JSON Schemas) passes the layers it may read.
 */
export type InstanceFilter = (instanceRoot: string) => boolean;

/** Every directory declared with `graphTypology`, across the layers of a checkout (absolute paths, declaration order). */
export function declaredDirectories(repoRoot: string, graphTypology: string, include?: InstanceFilter): string[] {
  // input-site: env-unset FOLIO_FIXTURE_CHECKOUT #d3ac43d3 — a test-only override naming a checkout OUTSIDE the tree
  const fixture = process.env[FIXTURE_ENV];
  const ownRoots = layerRootsIn(repoRoot);
  // The fixture's layers are scanned BESIDE this checkout's, for every
  // graph typology. It was "only when no own instance declares the typology",
  // which hid the fixture's IG-pipeline layer's `typologies/` from a standalone
  // cat-harness that declares a `typologies/` of its own (ig-pages, ig-ast,
  // ig-metadata-index, the todo kinds), so four tests failed standalone. The
  // fixture is set only when the checkout holds no vocabulary, never in a
  // composed checkout, so there a scan is unchanged.
  const ownNames = new Set(ownRoots.map((r) => basename(r)));
  const roots = fixture ? [...ownRoots, ...layerRootsIn(fixture).filter((r) => !ownNames.has(basename(r)))] : ownRoots;
  return roots.filter((root) => include === undefined || include(root)).flatMap((root) => ownDeclaredDirectories(root, graphTypology, repoRoot));
}

/** The directories ONE layer declares with `graphTypology` (absolute paths). `repository`-scoped paths resolve against `repoRoot`. */
export function ownDeclaredDirectories(root: string, graphTypology: string, repoRoot: string = root): string[] {
  const declFile = findDeclarationFile(root);
  if (declFile === undefined) return [];
  let decl: { directories?: { path?: string; scope?: string; graphTypologies?: string[] }[] };
  try {
    decl = JSON.parse(readFileSync(join(root, declFile), "utf-8")) as typeof decl;
  } catch {
    return []; // an unreadable declaration is `readDeclaration`'s finding, with its own message
  }
  const out: string[] = [];
  for (const d of decl.directories ?? []) {
    if (!d.path) continue;
    const abs = join(d.scope === "repository" ? resolve(repoRoot) : root, d.path);
    if ((d.graphTypologies ?? []).includes(graphTypology)) out.push(abs);
    // A NAMED SUBGRAPH of the harness (`cat-harness/openapi/`, owner
    // 2026-10-07): a directory of kind `cat-harness` names the graphs inside it
    // from within, in its HARNESS_SUBGRAPH_DECLARATION_FILE. Its `subgraph:
    // true` entries are this instance's directories, so a node graph declared
    // there (`openapi/typologies/`, `openapi/validators/`) is found here too.
    // One level, read raw for the reason the header gives; the full walk is
    // `nestedDirectories` in `cat-harness.ts`.
    if (d.scope === "repository" || !(d.graphTypologies ?? []).some((g) => g === "cat-harness" || g === "kg")) continue;
    let nested: { directories?: { path?: string; graphTypologies?: string[]; subgraph?: unknown }[] };
    try {
      nested = JSON.parse(readFileSync(join(abs, HARNESS_SUBGRAPH_DECLARATION_FILE), "utf-8")) as typeof nested;
    } catch {
      continue; // none, or unreadable — `check:harness-dirs` owns the latter
    }
    for (const nd of nested.directories ?? []) {
      if (nd.subgraph === true && nd.path && (nd.graphTypologies ?? []).includes(graphTypology)) out.push(join(abs, nd.path));
    }
  }
  return out;
}

/**
 * The file in which a directory of graph typology `cat-harness` — a named
 * subgraph holding more than one of the harness's parts — declares the graphs
 * inside it from within (#980). Stated here, in the leaf, because the
 * typology/validator scans above must descend into it before the registry
 * exists; `graph-typology-registry.ts` reads the same constant as the kind's
 * `declarationFile`, so there is one spelling.
 */
export const HARNESS_SUBGRAPH_DECLARATION_FILE = "graph.json";

/** `{ file, raw }` for every `*.json` in every directory declared with `graphTypology`, files sorted. */
export function declaredNodeFiles(
  repoRoot: string,
  graphTypology: string,
  include?: InstanceFilter,
): { file: string; raw: unknown }[] {
  const out: { file: string; raw: unknown }[] = [];
  for (const dir of declaredDirectories(repoRoot, graphTypology, include)) {
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
    } catch {
      continue; // a declared-but-absent directory is `check:declared-dirs`'s finding
    }
    for (const f of files) {
      const file = join(dir, f);
      out.push({ file, raw: JSON.parse(readFileSync(file, "utf-8")) });
    }
  }
  return out;
}
