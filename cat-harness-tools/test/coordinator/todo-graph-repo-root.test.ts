/**
 * `todo-graph` tests that read the aggregate repository's own root — the
 * root-declared `todos/` graph — moved here from
 * `cat-harness/scripts/tests/todo-graph.test.ts` (bean `ho66`), as
 * `merge-guard-workflows.test.ts` was: a standalone cat-harness layer has no
 * such root, and `check:cat-harness-standalone` collects every test in that
 * layer. The rest of that file's tests stay there.
 *
 * Moved again, from `cat-harness-tools/scripts/tests/` to the checkout's own
 * test home `test/` (bean `7zz1`, owner ruling 2026-10-06 "Top-level
 * instance"): what it reads belongs to the whole checkout, which the root
 * layer declares, not to any one layer — so cat-harness-tools stays green
 * standing alone too.
 */
import { describe, expect, test } from "bun:test";
// Publish-time files are written to the layer output overlay (bean sm8r);
// these read the copy a site reader sees, falling back to the path given.
import { readFileSync } from "../support/site-fs.ts";
import { join } from "node:path";

import { siteDirFor } from "../../schemas/kg/cat-harness.ts";
import { declaredSubgraphNode } from "../../scripts/kg-export.ts";
import { subgraphPublicationFindings } from "../../scripts/subgraph-node.ts";
import { ensureDocsPages, siteNotBuilt } from "../support/checkout.ts";

/**
 * The directory this test was written in (`cat-harness/scripts/tests/`): every path below
 * is composed from it exactly as it was before the move, so nothing it reads changed.
 */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");

const ROOT = join(ORIGIN_DIR, "..", "..");
const SITE = join(ROOT, siteDirFor(ROOT));

// The document is written by `docs:pages`, so build it when it is missing
// rather than rely on another file in this shard having run it first (#411).
ensureDocsPages(ROOT);

/** The todo graph is written at publish and gitignored (bean w1gy F18). */
const NOT_BUILT = siteNotBuilt("the todo graph `docs:pages` writes at publish (gitignored)", join(SITE, "todos.jsonld"));

describe.skipIf(NOT_BUILT)("what is published", () => {
  // `describe.skipIf` still runs this body, so nothing is read when it skips.
  const graph = (NOT_BUILT ? {} : JSON.parse(readFileSync(join(SITE, "todos.jsonld"), "utf8"))) as Record<string, unknown>;

  test("its container is the declared todos Subgraph node, and every todo is a member of it", () => {
    const declared = declaredSubgraphNode(ROOT, "todos");
    expect(declared).toBeDefined();
    expect(subgraphPublicationFindings(graph, { iri: declared!.iri })).toEqual([]);
    expect(graph["contentSource"]).toEqual(declared!.contentSource);
  });
});
