/**
 * Helpers the Tool folders beside this file share. Not a Tool, and declares
 * none: a Tool is one folder, `<id>/<id>.ts`.
 *
 * @module smart-base/tools/lib
 */
/**
 * The publisher-site rules smart-base supplies to fhir-harness's
 * `fhir-cache-seed-npm`: package-name prefix → `OWNER/REPO[@BRANCH]` of the
 * repository holding the publisher's published site, where
 * `<rest-of-name>/<version>/package.tgz` is read.
 *
 * fhir-harness knows no publisher (ig-build-pipeline §"What this layer refuses
 * to know about"), so its default is empty and this WHO entry is passed in
 * from here.
 */
export const SMART_PUBLISHER_SITE_REPOS: Readonly<Record<string, string>> = Object.freeze({
  "smart.who.int.": "WorldHealthOrganization/smart-html@main",
});

/** `SMART_PUBLISHER_SITE_REPOS` as the seeder's `--site-repo` arguments. */
export function smartSiteRepoArgs(): string[] {
  return Object.entries(SMART_PUBLISHER_SITE_REPOS).flatMap(([prefix, repo]) => ["--site-repo", `${prefix}=${repo}`]);
}
