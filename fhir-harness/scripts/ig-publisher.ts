/**
 * The FHIR-IG site publisher as the `site-publisher-ig` slot holds it: its
 * kind, its workflows and its Pages sibling, with no network and no spawn.
 *
 * `pipeline/plugin-slots.ts` is the module the contributions loader requires
 * for every repository that depends on this layer, and cat-harness-tools'
 * `harness-config.ts` resolves the declared plugin tables when it
 * fingerprints a check. So whatever this module loads sits in the input-hash
 * closure of every gate that loads a harness configuration, `skill:register:check`
 * and `kg:audit:check` among them (beans folio-assistant-x35i, vgfp, k3vv).
 * The publisher's work, `stageIg` in `stage-local-ig.ts`, fetches workflows
 * from GitHub and runs git and the build; it is loaded only when a publish
 * actually stages, which no check does.
 *
 * @module fhir-harness/scripts/ig-publisher
 */
import { join } from "node:path";

import { inputSiteReached } from "../../cat-harness-tools/schemas/sdlc/input-trace.ts";
import type { SitePublisher } from "../../cat-harness-tools/scripts/stage-local.ts";

/** The reusable workflows an IG calls: this layer's, which upstream IG repositories call. */
export const IG_WORKFLOWS = ["fhirbuild.yml", "ghbuild.yml"] as const;
/** Where an IG workflow with no deploy step finds its Pages build: the sibling beside it. */
export const PAGES_SIBLING = "ghbuild.yml";

/**
 * The FHIR-IG site publisher: what `site-publisher-ig` holds. Its kind is the
 * slot's suffix, and it is what `stage-local.ts --publisher ig` names.
 */
export const IG_PUBLISHER: SitePublisher = {
  kind: "ig",
  workflows: IG_WORKFLOWS,
  preferred: PAGES_SIBLING,
  stage: async (run, host) => {
    // input-site: traced #d101a054 — loads the publisher's work only when a publish stages; no check stages
    inputSiteReached("ig publisher: stage");
    const { stageIg } = (await import(join(import.meta.dir, "stage-local-ig.ts"))) as { stageIg: SitePublisher["stage"] };
    return stageIg(run, host);
  },
};
