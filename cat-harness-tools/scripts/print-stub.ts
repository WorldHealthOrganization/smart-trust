#!/usr/bin/env bun
/**
 * Print this layer's artefact stub, for a workflow to capture.
 *
 * @module scripts/print-stub
 *
 * A script rather than an inline `bun -e` in a workflow: graph kinds such as
 * `folio` are registered by CORE as a load-time side effect, which an inline
 * eval never imports, and a YAML string is checked by neither `tsc` nor
 * `eslint`.
 *
 * Prints the stub and nothing else, so `STUB=$(bun run …)` captures it cleanly.
 */
import { artefactStub, readDeclaration } from "../schemas/kg/cat-harness.js";

const root = process.argv[2] ?? "./cat-harness";
const decl = readDeclaration(root);
if (!decl) {
  console.error(`print-stub: no declaration at ${root}`);
  process.exit(1);
}
console.log(artefactStub(decl));
