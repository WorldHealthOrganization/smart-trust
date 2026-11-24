#!/usr/bin/env bun
/**
 * Emit the published JSON-LD `@context` from `schemas/kg/jsonld.ts`.
 *
 * The context is the one artefact both populations share — authored block
 * siblings and ingested `library/**` nodes both reference it by URL — so it
 * is generated from the TypeScript definition rather than hand-kept, and
 * `--check` gates it in CI like every other generated file in this repo.
 *
 * Output: `ns/content/v1.jsonld`, served at the URL in `CONTENT_CONTEXT_URL`.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-jsonld-context.ts
 *   bun run cat-harness-tools/scripts/gen-jsonld-context.ts --check
 *
 * @module scripts/gen-jsonld-context
 * @covers schemas
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { CONTENT_CONTEXT } from "../schemas/kg/jsonld.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

// NOT a folio root: `content` here names the content VOCABULARY, and this
// file is served at `CONTENT_CONTEXT_URL`. The 2026-09-20 content/ -> folio/
// excision renamed it by mistake — a published, dereferenceable URL, which
// moving breaks every consumer of the context. Left as `content`.
// declared-path-literal: the path is fixed by the published `CONTENT_CONTEXT_URL` (see above); moving it with the declaration would break every consumer of the context.
const OUT = join(resolve(HARNESS_ROOT), "ns", "content", "v1.jsonld");

function main(): number {
  const next = `${JSON.stringify({ "@context": CONTENT_CONTEXT }, null, 2)}\n`;
  const prev = existsSync(OUT) ? readFileSync(OUT, "utf-8") : undefined;

  if (process.argv.includes("--check")) {
    if (prev === next) {
      console.log("gen-jsonld-context --check: ns/content/v1.jsonld is up to date.");
      return 0;
    }
    console.error(
      "ns/content/v1.jsonld is stale or missing.\n" +
        "Run: bun run cat-harness-tools/scripts/gen-jsonld-context.ts",
    );
    return 1;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, next);
  console.log(`${prev === next ? "unchanged" : "wrote"}: ns/content/v1.jsonld`);
  return 0;
}

if (import.meta.main) process.exit(main());
