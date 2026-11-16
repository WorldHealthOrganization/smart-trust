#!/usr/bin/env bun
/**
 * Every module in the declared `schemas/` directory declares what it is.
 *
 * Membership in the `schemas` graph is the file's own `@graphNode` tag; a
 * module without one is silently ABSENT from the published graph.
 *
 * - declared `schema` → a node;
 * - declared `none — <reason>` → deliberately not a node; the reason is
 *   required;
 * - **undeclared** → reported, non-zero. A `*.test.ts` that declares nothing
 *   is listed separately (not excluded by extension) and is not an error.
 *
 * Usage:  bun run cat check:schema-nodes
 *
 * @module scripts/check-schema-nodes
 * @covers schemas
 * @graphNode none — a gate over the declarations, not a schema itself
 */
import { HARNESS_ROOT } from "./lib/roots.ts";

import { gateOwnInstances } from "./lib/gate-own.ts";
import { auditSchemaNodes } from "./schema-nodes.js";

const ROOT = HARNESS_ROOT;

if (import.meta.main) {
  // In a layer's PR checks, only the caller's own layers' `schemas/`
  // (owner ruling 2026-11-05, "Move the checks"; `lib/gate-own.ts`). A lower
  // layer's are judged by that layer's own CI.
  const own = gateOwnInstances();
  const a = auditSchemaNodes(ROOT, "checkout", own);

  // Scoped, and the caller commits no `schemas/*.ts` at all (none declared, or
  // a data-only one, as cat-harness's has been since bean 8lcl): nothing of
  // its own to judge. The refusal below guards the WHOLE corpus, which always
  // holds the harness's modules, against a renamed directory.
  if (own && a.nodes.length + a.exempt.length + a.undeclared.length + a.reasonless.length === 0) {
    console.log(
      `✓ ${[...own].join(", ")} commits no schemas/*.ts (${a.directories.length} declared director(ies) read); ` +
        "the mounted layers' are judged by their own CI.",
    );
    process.exit(0);
  }

  // An empty corpus is not a pass. A renamed or moved `schemas/` would
  // otherwise turn this gate into a silent success over nothing — the same
  // defect it exists to catch, one level up.
  if (a.nodes.length + a.exempt.length + a.undeclared.length === 0) {
    console.error("No modules found under schemas/ — refusing to report a clean run.");
    process.exit(2);
  }

  const bad = a.undeclared.length + a.reasonless.length;
  if (bad === 0) {
    console.log(
      `✓ every schemas/*.ts declares itself: ${a.nodes.length} node(s), ` +
        `${a.exempt.length} deliberately not (${a.exempt.map((m) => m.name).join(", ")}), ` +
        `${a.undeclaredTests.length} test file(s) outside the graph.`,
    );
    process.exit(0);
  }

  console.error(`${bad} module(s) in schemas/ do not declare what they are:`);
  for (const m of a.undeclared) {
    console.error(`  ✗ ${m.module}\n      no @graphNode tag — it is absent from the published graph.`);
  }
  for (const m of a.reasonless) {
    console.error(`  ✗ ${m.module}\n      @graphNode none with no reason. Write "none — <why>".`);
  }
  console.error(
    '\nAdd `@graphNode schema` to the leading docblock, or `@graphNode none — <reason>`\n' +
      "if the module defines no schema (a barrel, a constant, a function library).",
  );
  process.exit(1);
}
