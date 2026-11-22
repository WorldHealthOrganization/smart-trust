/**
 * The IG site publisher waits for the workflow that seeds its AST cache.
 *
 * An IG repository's first Site publish restored the AST cache before the IG AST
 * refresh on the same push had seeded it, and failed ("no AST to build
 * from"). The IG publisher now declares `after`, and cat-harness-tools'
 * `site-publish-after.ts` derives the wait from it. Driven by this layer's
 * own templates, so it names no real IG.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { isSitePublisher } from "../../cat-harness-tools/scripts/site-publisher.ts";
import { publishAfter } from "../../cat-harness-tools/scripts/site-publish-after.ts";
import { IG_PUBLISHER, IG_SEEDERS } from "./ig-publisher.ts";

const TEMPLATES = join(import.meta.dir, "..", "templates", "ig-repo-site");
const template = (f: string): string => readFileSync(join(TEMPLATES, f), "utf-8");

describe("the IG publisher's after", () => {
  test("declaresAstRefreshAsSeeder", () => {
    expect([...(IG_PUBLISHER.after ?? [])]).toEqual(["ig-ast-refresh.yml"]);
    expect(IG_PUBLISHER.after).toBe(IG_SEEDERS);
    expect(isSitePublisher(IG_PUBLISHER)).toBe(true);
  });

  test("publishWaitsForTemplateRefresh", () => {
    // A repository that copied the templates and declares no site.publishAfter.
    const workflows = new Map([
      ["ig-ast-refresh.yml", template("ig-ast-refresh.yml")],
      ["site-publish.yml", template("site-publish.yml")],
    ]);
    const waits = publishAfter({ workflows, declared: [], publishers: [IG_PUBLISHER] });
    expect(waits.map((w) => w.workflow)).toEqual(["ig-ast-refresh.yml"]);
    expect(waits[0]!.why).toContain("ig-ast-refresh.yml");
  });
});

describe("the template refresh's push trigger", () => {
  test("refreshRunsOnPushAddingIt", () => {
    const on = (parse(template("ig-ast-refresh.yml")) as { on: { push: { branches: string[]; paths: string[] } } }).on;
    expect(on.push.branches).toEqual(["main"]);
    // The push that adds the caller seeds the cache, so a first publish has an AST
    // even when that push changes none of the IG's inputs.
    expect(on.push.paths).toContain(".github/workflows/ig-ast-refresh.yml");
    for (const p of ["sushi-config.yaml", "ig.ini", "input/**"]) expect(on.push.paths).toContain(p);
  });
});
