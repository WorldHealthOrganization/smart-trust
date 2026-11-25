/**
 * A site publish waits for the workflows that seed what the site is built
 * from, derived from the publishers the mounted layers declare, not only from
 * `site.publishAfter` (smart-pcmt, 2026-11-19: the first publish read the AST
 * cache before the same push's refresh had seeded it).
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { declaredPublishAfter, publishAfter } from "../site-publish-after.ts";
import { isSitePublisher, type PublisherWorkflows } from "../site-publisher.ts";

const SHA = "a".repeat(40);
const caller = (file: string, owner = "litlfred/seeder") => `on: { push: { branches: [main] } }\njobs:\n  j:\n    uses: ${owner}/.github/workflows/${file}@${SHA} # index.lock.json\n`;
const SEEDING: PublisherWorkflows = { kind: "ig", workflows: ["fhirbuild.yml"], after: ["refresh-cache.yml"] };
const IG_REPO = new Map([
  ["refresh-cache.yml", caller("refresh-cache.yml")],
  ["site-publish.yml", caller("folio-site-publish.yml", "litlfred/cat-harness-tools")],
  ["fhirbuild.yml", caller("fhirbuild.yml")],
]);

describe("site-publish-after", () => {
  test("a repository declaring no publishAfter still waits for the workflow a publisher says seeds its site", () => {
    expect(publishAfter({ workflows: IG_REPO, publishers: [SEEDING] }).map((w) => w.workflow)).toEqual(["refresh-cache.yml"]);
  });

  test("the caller is found by what it calls, not by its own file name", () => {
    const w = publishAfter({ workflows: new Map([["ast.yml", caller("refresh-cache.yml")]]), publishers: [SEEDING] });
    expect(w).toEqual([{ workflow: "ast.yml", why: "it calls refresh-cache.yml, which seeds what the ig publisher builds from" }]);
  });

  test("site.publishAfter adds to the derived ones, once each, and a name that is not a workflow file is dropped", () => {
    const w = publishAfter({ workflows: IG_REPO, declared: ["refresh-cache.yml", "other.yml", "../x.yml", 3], publishers: [SEEDING] });
    expect(w.map((x) => x.workflow)).toEqual(["other.yml", "refresh-cache.yml"]);
  });

  test("the publish's own caller is never waited for, even when declared", () => {
    expect(publishAfter({ workflows: IG_REPO, declared: ["site-publish.yml"], publishers: [SEEDING] }).map((w) => w.workflow)).toEqual(["refresh-cache.yml"]);
  });

  test("with no publisher declaring what seeds it, only site.publishAfter is waited for", () => {
    expect(publishAfter({ workflows: IG_REPO, publishers: [{ kind: "ig", workflows: ["fhirbuild.yml"] }] })).toEqual([]);
  });

  test("a publisher's after must be a list of file names", () => {
    const stage = async () => undefined;
    expect(isSitePublisher({ ...SEEDING, stage })).toBe(true);
    expect(isSitePublisher({ kind: "ig", workflows: ["fhirbuild.yml"], stage })).toBe(true);
    expect(isSitePublisher({ ...SEEDING, after: "refresh-cache.yml", stage })).toBe(false);
  });

  test("site.publishAfter is read from index.config.json, and an unreadable one declares none", () => {
    const dir = mkdtempSync(join(tmpdir(), "site-publish-after-"));
    expect(declaredPublishAfter(dir)).toEqual([]);
    writeFileSync(join(dir, "index.config.json"), JSON.stringify({ site: { publishAfter: ["refresh-cache.yml"] } }));
    expect(declaredPublishAfter(dir)).toEqual(["refresh-cache.yml"]);
    writeFileSync(join(dir, "index.config.json"), "{");
    expect(declaredPublishAfter(dir)).toEqual([]);
  });

  test("the shared publish waits after the mount, on a manual run as well as a push", () => {
    const wf = readFileSync(join(import.meta.dir, "../../.github/workflows/folio-site-publish.yml"), "utf-8");
    const mount = wf.indexOf("/.github/actions/mount-layers@");
    const wait = wf.indexOf("- name: Wait for this commit's runs the site is built from");
    expect(mount).toBeGreaterThan(0);
    expect(wait).toBeGreaterThan(mount);
    const step = wf.slice(wait, wf.indexOf("\n      - ", wait + 1));
    expect(step).toContain("scripts/site-publish-after.ts");
    expect(step).not.toContain("github.event_name == 'push'");
  });
});
