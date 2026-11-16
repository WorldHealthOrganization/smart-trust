/**
 * The generic pipeline slots fhir-harness fills, as ONE typed table.
 *
 * Each `pipeline-plugins/<slot>.json` node names this table and its slot (bean
 * riit, step 3b, the shape folio-assistant-sci's table set): the node says the
 * slot is filled, and this table is what `tsc` checks against the generic
 * side's contract.
 *
 * `site-publisher-ig` — the FHIR-IG site publisher that `stage-local.ts` hands
 * an IG repository to (owner, 2026-10-14, Q4 of the folio-assistant#2529
 * reference-direction review). cat-harness-tools reads every
 * `site-publisher-<kind>` slot from the dependencies of the repository it
 * publishes, and names neither this layer nor this file.
 *
 * ## It also registers this layer's content type
 *
 * The contributions loader (`loadContributions` in cat-harness) requires this
 * module for every repository that depends on fhir-harness, when the QA
 * sweep, the site publisher or the server starts. That is this layer's
 * load-time entry, so the `ig` content type (`schemas/ig-content-type.ts`)
 * is registered here, in the default registry, before anything asks a
 * repository what it is. Until this import, `ig` was registered only when some
 * module happened to load the schema.
 *
 * ## It loads no network and no spawn
 *
 * cat-harness-tools fingerprints a check through the declared plugin tables,
 * so this module's import closure is in every such gate's input hash. It
 * imports the publisher's registration (`scripts/ig-publisher.ts`), not its
 * work (`scripts/stage-local-ig.ts`), which that registration loads when a
 * publish stages.
 *
 * @module fhir-harness/pipeline/plugin-slots
 */
import type { SitePublisher } from "../../cat-harness-tools/scripts/stage-local.ts";
import { IG_PUBLISHER } from "../scripts/ig-publisher.ts";
import "../schemas/ig-content-type.ts";

export const PIPELINE_IMPLEMENTATIONS: Record<`site-publisher-${string}`, SitePublisher> = {
  "site-publisher-ig": IG_PUBLISHER,
};
