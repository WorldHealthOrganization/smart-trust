/**
 * A folio that depends on smart-base, for tests that hold this layer's
 * contributions (DAK block kinds, DAK QA checkers) against the dependency walk
 * that delivers them.
 *
 * ## Why a fixture, and not `smart-ig`
 *
 * A contribution reaches a folio through the folio's dependency tree, and
 * `loadContributions` walks a root's dependencies, never the root itself. So
 * these tests need a root whose tree INCLUDES smart-base. They used
 * `../../smart-ig` — the sibling layer that declared smart-base below it in
 * the monorepo. smart-ig has since been separated to `litlfred/smart-ig` and
 * the index composition skips it, so that path resolves to nothing and the
 * walk found no smart-base at all: every DAK kind, prefix and checker read as
 * unregistered.
 *
 * The fixture is the smallest root with the property, and the same one
 * `folio-assistant-sci/scripts/tests/sci-consumer.ts` uses: a declaration in
 * the system temp directory whose config names smart-base BY PATH. smart-base's
 * own `needs` still resolve as its siblings, wherever it is mounted, so the
 * fixture names no layer above this one.
 *
 * @module smart-base/scripts/tests/smart-base-consumer
 */
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ContributionRegistry, loadContributionsSync, writeInstanceConfig } from "../../platform/index.js";

/** This layer's root: `smart-base/`. */
export const SMART_BASE_ROOT = resolve(import.meta.dir, "../..");

let cached: string | undefined;

/** A folio root whose only declared dependency is smart-base. Written once per process. */
export function smartBaseConsumerRoot(): string {
  if (cached) return cached;
  const dir = join(mkdtempSync(join(tmpdir(), "smart-base-consumer-")), "smart-base-consumer");
  mkdirSync(dir, { recursive: true });
  writeInstanceConfig(
    dir,
    JSON.stringify({ contentType: "document", dependencies: { folioAssistant: [{ name: "smart-base", path: SMART_BASE_ROOT }] } }),
    "smart-base-consumer",
  );
  cached = dir;
  return dir;
}

/** The registry a folio depending on smart-base gets, loaded as `loadContributions` loads it. */
export function smartBaseRegistrySync(): ContributionRegistry {
  return loadContributionsSync(smartBaseConsumerRoot(), new ContributionRegistry());
}
