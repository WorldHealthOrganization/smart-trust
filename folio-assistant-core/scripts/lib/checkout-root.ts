/**
 * The checkout a core script reads, in either layout core is run from.
 *
 * @module folio-assistant-core/scripts/lib/checkout-root
 *
 * Core runs in two layouts:
 *
 * - **composed**: core is mounted as `<root>/folio-assistant-core`, beside
 *   `<root>/cat-harness` and the other layers. The checkout is core's parent.
 * - **standalone**: core is the checkout itself (its own site build,
 *   `stage-local.ts --repo .`, and the Site publish workflow), and
 *   `mount-from-lock --root .` mounts the layers INSIDE it, as
 *   `<core>/cat-harness`. The checkout is core.
 *
 * `repoRootFor(core)` answers only the composed layout: the parent. In a
 * standalone build that is the runner's work directory, which holds no layer,
 * so `glossary-page.ts` resolved `cat-harness.glossary.json`'s
 * `source: cat-harness/cat-harness.json` to nothing. The scheme then fell to
 * core's own namespace, where it collided with core's `platform` scheme
 * (Site publish, 2026-11-12).
 *
 * The rule: core is the checkout when the harness is mounted inside it,
 * that is, when `<core>/cat-harness/cat-harness.json` is there. Otherwise the
 * composed answer stands.
 */
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { repoRootFor } from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";

/** The harness's declaration, relative to a checkout that mounts it. */
const MOUNTED_HARNESS = join("cat-harness", "cat-harness.json");

/** The checkout `core` belongs to: `core` itself when it mounts the harness inside it, else the composed checkout. */
export function checkoutRootFor(core: string): string {
  const abs = resolve(core);
  return existsSync(join(abs, MOUNTED_HARNESS)) ? abs : repoRootFor(abs);
}
