/**
 * The `folio-run-context/v1` of one L1 extraction run — which checkout, which
 * mounts, which script and which inputs — built in TypeScript and VALIDATED
 * against cat-harness's own schema (`cat-harness/schemas/run-context.ts`).
 *
 * Nothing here adds a field. It is the TypeScript twin of cat-harness-tools'
 * `scripts/_run_context.py` (the writer the ingest scripts use): the same
 * `platform` / `mounts` / `invoker` / `inputs` rules, the same
 * `run-context.json` file name beside the output, and the reference computed
 * by cat-harness's own `runContextRef`, so a reader of either writer agrees
 * on the digest.
 *
 * A context changes on every commit (its `platform.commit` is the checkout's
 * HEAD), so the outputs a `--check` compares carry only the REFERENCE, and
 * `--check` ignores it — the same treatment `generatedAt` gets.
 *
 * @module smart-base/L1/scripts/l1-run-context
 */
export {
  RUN_CONTEXT_FILENAME,
  hashBasis,
  mountsOf,
  buildRunContext,
  writeRunContext,
  runContextRef,
  type RunContext,
  type RunContextRef,
} from "../../scripts/l1-recommendation-scenarios.ts";
