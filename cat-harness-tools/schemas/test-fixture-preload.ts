/**
 * Point node discovery at the standalone fixture when the checkout holds no
 * vocabulary — the first test preload, ahead of `test-preload.ts`.
 *
 * @module schemas/test-fixture-preload
 * @graphNode none — a test preload; it sets one environment variable and defines no schema
 *
 * ## Why
 *
 * cat-harness's code types the paper vocabulary, whose nodes live with their
 * owners — document kinds in the content core, math kinds and the `paper`
 * adapter in the science layer. Standing alone, as
 * `check:cat-harness-standalone` runs it, none of them is there.
 *
 * So: when no layer in this checkout declares a `block-kinds` graph,
 * `FOLIO_FIXTURE_CHECKOUT` names `test/fixtures/standalone-checkout/`, which
 * `declared-nodes.ts` then scans beside the real checkout. In the monorepo it
 * is never set, so no test there can pass on the fixture instead of the real
 * nodes; `standalone-fixture.test.ts` holds the copies equal to the real ones.
 *
 * ## Why a separate preload
 *
 * Imports are hoisted, and `test-preload.ts` imports the graph-typology registry,
 * which scans declared `typologies/` graphs at load. The variable must be set
 * before that, so this file imports only the two leaves it needs and runs
 * first (`bunfig.toml`).
 */
import { basename, resolve } from "node:path";

import { harnessRoot } from "./harness-root";
import { layerRootsIn, repoRootFor } from "./kg/instance-roots";

/** The checkout this preload's harness sits in. */
const CHECKOUT = repoRootFor(harnessRoot() ?? resolve(import.meta.dir, ".."));

const FIXTURE = resolve(import.meta.dir, "..", "test", "fixtures", "standalone-checkout");
const ownNames = new Set(layerRootsIn(CHECKOUT).map((r) => basename(r)));
const allFixtureInstancesPresent = layerRootsIn(FIXTURE).every((r) => ownNames.has(basename(r)));
// input-site: env-unset FOLIO_FIXTURE_CHECKOUT #7c8758d4 — a test-only override naming a checkout outside the tree
const override = process.env.FOLIO_FIXTURE_CHECKOUT;
if (!allFixtureInstancesPresent && override === undefined) setFixtureCheckout();

/** The fixture moved here from cat-harness with the tests that read it (bean `8lcl`). */
function setFixtureCheckout(): void {
  // input-site: inert #16254c9e — points the tests at the fixture checkout inside this layer; what they read there is in their read set and the tree
  process.env.FOLIO_FIXTURE_CHECKOUT = FIXTURE;
}
