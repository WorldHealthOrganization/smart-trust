#!/usr/bin/env bun
/**
 * Which build produced this file, for the artefacts that can say so in-band.
 *
 * A staging preview publishes a whole site under `branches/<slug>/`, and the
 * question a reviewer has about any file in it is *which commit am I looking
 * at*. HTML answers with the injected banner. Everything else is data, and
 * data needs the answer written into the document.
 *
 * ## One function, because two stamps can disagree
 *
 * The JSON-LD export, `<stub>.schema.json`, `tool.schema.json`,
 * `tool-types.schema.json` and the skill I/O contracts are all stamped by this
 * one function, so no two documents have independent notions of the same
 * build.
 *
 * ## Previews only
 *
 * A build of `main` (or `master`) is the published site, and `build.json`
 * names its commit once for every page. So it is not stamped; see
 * {@link RELEASE_BRANCHES}.
 *
 * ## Absent rather than fabricated
 *
 * Outside CI there is no build, so there is no stamp: this returns `undefined`
 * and callers write no key — never a `git rev-parse HEAD` stand-in that claims
 * a build that never happened. Same rule `harness-schema-export` follows for
 * `$id`: absolute or absent.
 *
 * @module scripts/staging-stamp
 */

import { termIri } from "../schemas/kg/namespaces.js";

/**
 * Build identity as it appears in a stamped document.
 *
 * `branch` is the human-readable branch name and `pr` the ref the workflow ran
 * on; they differ on a `pull_request` event, where the ref is the merge ref and
 * is not something a reviewer can check out.
 */
export interface StagingStamp {
  branch: string;
  sha: string;
  pr: string;
  run: string;
}

/** The key every stamped document carries it under. One name for one concept. */
export const STAGING_KEY = "staging";

/**
 * Branches whose build is the published site, not a preview of it.
 *
 * ## Why the main site carries no stamp (bean `g196`, 2026-10-31)
 *
 * The term's own gloss: "Which build produced this document, when it is a
 * staging preview rather than a release." The main site answers that question
 * once, in `build.json` (sha, built, run URL), which the footer already reads in
 * the browser. Stamping it into every document as well made every main deploy
 * rewrite every graph page and data file: on gh-pages `ee02d1d..5bdefb2`
 * (2026-10-31 19:33Z to 21:14Z) 10,635 files changed, and in a sample of 150 of
 * them 112 (75%) differed ONLY by this stamp's `sha` and `run`.
 */
export const RELEASE_BRANCHES: ReadonlySet<string> = new Set(["main", "master"]);

/**
 * Whether this run builds the published site. A workflow that names its branch
 * (`KG_BRANCH`, set by the staging workflows) is a preview, whatever the name:
 * a fork's `main` opened as a pull request is still a preview.
 */
export function isReleaseBuild(env: Record<string, string | undefined>): boolean {
  if (env.KG_BRANCH !== undefined && env.KG_BRANCH !== "") return false;
  return RELEASE_BRANCHES.has(env.GITHUB_REF_NAME ?? "");
}

/**
 * The stamp for the current process, or `undefined` when there is no build.
 *
 * `sha` is what makes a stamp meaningful, so its absence means no stamp at all
 * rather than a partial one: a `{branch, run}` with no commit answers the
 * question nobody asked. The other three fall back to the empty string only
 * when `sha` is present, which is the case where we are demonstrably in a run
 * and one variable happens to be unset.
 */
// input-site: env GITHUB_SHA,KG_BRANCH,GITHUB_REF_NAME,GITHUB_RUN_ID #10e8f84f — build and git identity variables for the staging stamp
export function stagingStamp(env: Record<string, string | undefined> = process.env): StagingStamp | undefined {
  if (isReleaseBuild(env)) return undefined;
  const sha = env.GITHUB_SHA;
  if (!sha) return undefined;
  return {
    branch: env.KG_BRANCH ?? env.GITHUB_REF_NAME ?? "",
    sha,
    pr: env.GITHUB_REF_NAME ?? "",
    run: env.GITHUB_RUN_ID ?? "",
  };
}

/**
 * `{ staging: … }` when there is a build, `{}` when there is not.
 *
 * Spread into a document literal so the key is absent rather than `undefined`
 * — `JSON.stringify` drops an `undefined` value, but an explicitly-present key
 * would survive a structural comparison and make a local export look like a
 * build artefact with a missing field.
 */
export function stagingFields(
  // input-site: env GITHUB_SHA,KG_BRANCH,GITHUB_REF_NAME,GITHUB_RUN_ID #631c5920 — build and git identity variables for the staging stamp
  env: Record<string, string | undefined> = process.env,
): Record<string, StagingStamp> {
  const s = stagingStamp(env);
  return s ? { [STAGING_KEY]: s } : {};
}

/**
 * The `@context` term a stamped JSON-LD document needs for its `staging` key.
 * Without it a JSON-LD processor drops the key, and `publish-verify`'s
 * `jsonld-expand` reports `invalid property (staging)`. Scoped (JSON-LD 1.1
 * §4.1.8), so `branch`, `sha`, `pr` and `run` mean this only inside `staging`.
 */
export function stagingContextTerm(): Record<string, unknown> {
  return {
    "@id": termIri("staging"),
    "@context": {
      branch: termIri("stagingBranch"),
      sha: termIri("stagingSha"),
      pr: termIri("stagingRef"),
      run: termIri("stagingRun"),
    },
  };
}

/**
 * `doc` with `stagingFields()` added, and, when a stamp is added and `doc` has
 * an object `@context`, the `staging` term declared in that context.
 */
export function withStaging(
  doc: Record<string, unknown>,
  fields: Record<string, StagingStamp> = stagingFields(),
): Record<string, unknown> {
  if (!(STAGING_KEY in fields)) return doc;
  const ctx = doc["@context"];
  const isObj = ctx !== null && typeof ctx === "object" && !Array.isArray(ctx);
  return {
    ...doc,
    ...(isObj ? { "@context": { ...(ctx as Record<string, unknown>), [STAGING_KEY]: stagingContextTerm() } } : {}),
    ...fields,
  };
}
