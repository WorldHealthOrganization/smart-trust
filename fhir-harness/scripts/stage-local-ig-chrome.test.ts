/**
 * The harness chrome on stage-local's IG path — owner, 2026-10-14, decision
 * "1": an IG site published by the one publish path wears the chrome
 * `folio-site.yml` gave it, and a root publish never replaces a chromed root
 * with bare IG Publisher pages.
 *
 * Three claims, each with its own fixture: the plan LISTS the chrome step; the
 * real rail (the function `rail-standalone-pages.ts` runs) leaves on a tiny
 * fake IG output the markers the folio path leaves, with the IG's own content
 * intact; and a chrome step that chromes nothing refuses the root publish,
 * leaving the publish branch as it was.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DOCS_SITE_BASE } from "@litlfred/cat-harness-tools/schemas/kg/jsonld.js";
import { railStandalonePages } from "../../cat-harness-tools/scripts/mount-instance-docs.js";
import { formatPlan, stageLocal } from "../../cat-harness-tools/scripts/stage-local.ts";
import { applyIgDeploy, chromeCoverage, chromeShortfall, IG_PUBLISHER, igTarget, readIgDeploys, readWorkflow } from "./stage-local-ig.ts";
import { FAKE_RAIL, FAKE_RAIL_NOTHING, FAKE_SYNC, FAKE_SYNC_FAILS } from "./ig-chrome-fixture.ts";

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const put = (root: string, rel: string, text = "x") => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), text);
};
const sh = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).trim();
const page = (body: string) => `<!doctype html>\n<html><head><title>t</title></head><body>${body}</body></html>\n`;
const CHROMED_ROOT = page(`<nav id="site-nav"></nav><script type="application/json" id="fa-navbar-row">{}</script>live`);
/** A root stage-local itself published over railed IG output: the rail and the icon row, no theme side bar, no stamp. */
const RAILED_ROOT = page(`<nav class="fa-nav"></nav><script type="application/json" id="fa-navbar-row">{}</script>railed`);

const CALLER = `on:
  workflow_dispatch:
jobs:
  build:
    uses: o/sb/.github/workflows/ghbuild.yml@main
`;
/** smart-base's ghbuild.yml, cut to a build that writes two IG pages and its two deploy steps. */
const WORKFLOW = `on:
  workflow_call:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Get branch name
        env:
          GH_REF_NAME: \${{ github.ref_name }}
        run: echo "BRANCH_DIR=\${GH_REF_NAME##*/}" >> "$GITHUB_ENV"
      - name: Default branch
        run: |
          D=$(git remote show origin | sed -n '/HEAD branch/s/.*: //p')
          if [ "$GITHUB_REF_NAME" = "$D" ]; then echo "IS_DEFAULT_BRANCH=true" >> $GITHUB_ENV; else echo "IS_DEFAULT_BRANCH=false" >> $GITHUB_ENV; fi
      - name: Build
        run: |
          mkdir -p output
          echo "<html><body><h1>IG home</h1></body></html>" > output/index.html
          echo "<html><body><h1>CWT</h1></body></html>" > output/StructureDefinition-CWT.html
      - name: Deploy candidate
        uses: JamesIves/github-pages-deploy-action@v4.4.2
        if: env.IS_DEFAULT_BRANCH == 'false'
        with:
          branch: gh-pages
          folder: ./output
          commit-message: Deploy candidate branch
          target-folder: branches/\${{ env.BRANCH_DIR }}
          clean: false
      - name: Deploy main
        uses: JamesIves/github-pages-deploy-action@v4.4.2
        if: env.IS_DEFAULT_BRANCH == 'true'
        with:
          branch: gh-pages
          folder: ./output
          commit-message: Deploy main branch
          clean-exclude: |
            branches
`;

/**
 * A local origin holding an IG checkout (its workflow, its declaration, and —
 * when `rail` is given — the platform's chrome scripts where a mount puts
 * them) and a gh-pages root that a `folio-site.yml` run chromed.
 */
function fixture(rail?: string, sync = FAKE_SYNC, root: "folio-site" | "railed" = "folio-site"): { bare: string; repo: string; src: string } {
  const bare = tmp("ig-chrome-origin-");
  sh(bare, "init", "-q", "--bare", "-b", "main");
  const repo = tmp("ig-chrome-repo-");
  sh(repo, "init", "-q", "-b", "main");
  sh(repo, "config", "user.name", "t");
  sh(repo, "config", "user.email", "t@example.org");
  sh(repo, "remote", "add", "origin", "https://github.com/o/r");
  sh(repo, "config", `url.file://${bare}.insteadOf`, "https://github.com/o/r");
  put(repo, ".github/workflows/fhirbuild.yml", CALLER);
  put(repo, "r.json", JSON.stringify({ $schema: "cat-harness-declaration/1.0.0", name: "r", title: "R Guide", directories: [] }));
  if (rail !== undefined) {
    put(repo, "cat-harness-tools/scripts/sync-docs-harness.ts", sync);
    put(repo, "cat-harness-tools/scripts/rail-standalone-pages.ts", rail);
  }
  sh(repo, "add", "-A");
  sh(repo, "commit", "-q", "-m", "ig");
  sh(repo, "push", "-q", "origin", "main");

  const seed = tmp("ig-chrome-seed-");
  sh(seed, "init", "-q", "-b", "gh-pages");
  put(seed, "index.html", root === "folio-site" ? CHROMED_ROOT : RAILED_ROOT);
  if (root === "folio-site") put(seed, "folio-build.json", "{}");
  put(seed, "branches/other/index.html", "other");
  sh(seed, "add", "-A");
  sh(seed, "-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "-m", "folio-site");
  sh(seed, "push", "-q", `file://${bare}`, "gh-pages");

  const src = tmp("ig-chrome-wfsrc-");
  put(src, ".github/workflows/ghbuild.yml", WORKFLOW);
  return { bare, repo, src };
}

const quiet = () => {};

describe("the plan lists the chrome step", () => {
  test("planListsChromeStep", async () => {
    const { repo, src } = fixture(FAKE_RAIL);
    const r = await stageLocal({ repo, workflowSource: src, plan: true, log: quiet, publishers: [IG_PUBLISHER] });
    const actions = r.plan.steps!.map((s) => s.action);
    const chrome = actions.indexOf("chrome");
    expect(chrome).toBeGreaterThan(actions.indexOf("run"));
    expect(chrome).toBeLessThan(actions.indexOf("deploy"));
    expect(r.plan.steps![chrome]!.name).toMatch(/rail-standalone-pages\.ts --foreign-site --instance r --home-label "R Guide"/);
    expect(formatPlan(r.plan)).toMatch(/step chrome +the harness chrome over output\//);
    expect(r.plan.missing ?? []).toEqual([]);
  });

  test("missingChromeScriptsNamed", async () => {
    const { repo, src } = fixture();
    const r = await stageLocal({ repo, workflowSource: src, plan: true, log: quiet, publishers: [IG_PUBLISHER] });
    expect(r.plan.missing).toEqual([expect.stringMatching(/the harness chrome — .*rail-standalone-pages|sync-docs-harness/)]);
    expect(formatPlan(r.plan)).toMatch(/step chrome .*UNAVAILABLE/);
  });
});

describe("the real rail leaves the folio path's markers on an IG's pages", () => {
  test("railAddedContentKept", () => {
    const site = tmp("ig-chrome-output-");
    put(site, "index.html", page("<h1>IG home</h1>"));
    put(site, "StructureDefinition-CWT.html", page("<h1>CWT</h1><table><tr><td>cell</td></tr></table>"));
    put(site, "branches/x/index.html", page("<p>nested</p>"));
    expect(chromeShortfall(chromeCoverage(site))).toMatch(/carries the rail/);

    // What `rail-standalone-pages.ts --foreign-site --instance <i>` runs.
    railStandalonePages(site, "cat-harness", "cat-harness", [], { platformBase: DOCS_SITE_BASE.replace(/\/$/, ""), homeLabel: "R Guide", instance: "smart-base" });

    const c = chromeCoverage(site);
    expect(c).toEqual({ pages: 3, railed: 3, navbarRow: 3, index: true });
    expect(chromeShortfall(c)).toBeUndefined();
    const cwt = readFileSync(join(site, "StructureDefinition-CWT.html"), "utf-8");
    expect(cwt).toContain('<nav class="fa-nav"');
    expect(cwt).toContain('id="fa-navbar-row"');
    expect(cwt).toContain("data-fa-platform-ui");
    expect(cwt).toContain("<h1>CWT</h1><table><tr><td>cell</td></tr></table>");
  });

  test("chromeIsPinnedCopy", () => {
    const site = tmp("ig-chrome-pinned-");
    put(site, "index.html", page("<h1>IG home</h1>"));
    put(site, "branches/x/index.html", page("<p>nested</p>"));
    const base = DOCS_SITE_BASE.replace(/\/$/, "");
    railStandalonePages(site, "cat-harness", "cat-harness", [], { platformBase: base, homeLabel: "R Guide", instance: "smart-base" });
    for (const rel of ["index.html", "branches/x/index.html"]) {
      const html = readFileSync(join(site, rel), "utf-8");
      const loaded = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]!);
      expect(loaded.length).toBeGreaterThan(0);
      expect(loaded.filter((u) => /^[a-z]+:\/\//i.test(u))).toEqual([]);
      for (const u of loaded) expect(existsSync(join(site, rel, "..", u))).toBe(true);
    }
  });
});

describe("a root publish never replaces a chromed root with bare pages", () => {
  const deploys = readIgDeploys(readWorkflow(WORKFLOW));
  const main = igTarget(deploys, { isDefault: true, branchDir: "main", sha: "a", runUrl: "u" });

  test("bareNeverReplacesChromed", () => {
    const pages = tmp("ig-chrome-pages-");
    put(pages, "index.html", CHROMED_ROOT);
    const out = tmp("ig-chrome-out-");
    put(out, "index.html", page("bare"));
    expect(() => applyIgDeploy(pages, out, main, () => {})).toThrow(/wears the harness chrome/);
    expect(readFileSync(join(pages, "index.html"), "utf-8")).toBe(CHROMED_ROOT);

    put(pages, "folio-build.json", "{}");
    expect(() => applyIgDeploy(pages, out, main, () => {})).toThrow(/folio-build\.json/);
    // Railed IG Publisher output lacks the theme's side bar and the stamp folio-site.yml's root carries.
    const railed = tmp("ig-chrome-railed-");
    put(railed, "index.html", RAILED_ROOT);
    expect(() => applyIgDeploy(pages, railed, main, () => {}, { chromed: true })).toThrow(/side bar \(#site-nav\).*folio-build\.json/);
    expect(readFileSync(join(pages, "index.html"), "utf-8")).toBe(CHROMED_ROOT);
    // A candidate carrying all of it replaces the root, stamp included.
    const whole = tmp("ig-chrome-whole-");
    put(whole, "index.html", CHROMED_ROOT.replace("live", "new"));
    put(whole, "folio-build.json", '{"new":1}');
    applyIgDeploy(pages, whole, main, (from, to) => execFileSync("cp", ["-a", `${from}/.`, to]), { chromed: true });
    expect(readFileSync(join(pages, "folio-build.json"), "utf-8")).toBe('{"new":1}');

    put(pages, "STAGING/x/index.html");
    expect(() => applyIgDeploy(pages, out, main, () => {}, { chromed: true })).toThrow(/folio's site \(STAGING\)/);
  });

  test("emptyChromeRefusesRoot", async () => {
    const { bare, repo, src } = fixture(FAKE_RAIL_NOTHING);
    await expect(stageLocal({ repo, workflowSource: src, log: quiet, publishers: [IG_PUBLISHER] })).rejects.toThrow(/harness chrome was not applied: none of its 2 page\(s\) carries the rail — refusing to publish the root/);
    expect(sh(bare, "log", "-1", "--format=%s", "gh-pages")).toBe("folio-site");
    expect(sh(bare, "show", "gh-pages:index.html")).toBe(CHROMED_ROOT.trim());
  }, 60_000);

  test("previewPublishedBare", async () => {
    const { bare, repo, src } = fixture(FAKE_RAIL_NOTHING);
    sh(repo, "checkout", "-q", "-b", "claude/feat");
    const said: string[] = [];
    const r = await stageLocal({ repo, workflowSource: src, log: (s) => said.push(s), publishers: [IG_PUBLISHER] });
    expect(r).toMatchObject({ target: "preview", pushed: true });
    expect(said.join("\n")).toMatch(/chrome was not applied.*published bare/);
    expect(sh(bare, "show", "gh-pages:index.html")).toBe(CHROMED_ROOT.trim());
  }, 60_000);

  test("railedOverSiteRootRefused", async () => {
    const { bare, repo, src } = fixture(FAKE_RAIL);
    await expect(stageLocal({ repo, workflowSource: src, log: quiet, publishers: [IG_PUBLISHER] })).rejects.toThrow(/lacks what the publish root carries: the theme's side bar \(#site-nav\).*folio-build\.json/);
    expect(sh(bare, "log", "-1", "--format=%s", "gh-pages")).toBe("folio-site");
  }, 60_000);

  test("chromedReplacesRailedRoot", async () => {
    const { bare, repo, src } = fixture(FAKE_RAIL, FAKE_SYNC, "railed");
    const r = await stageLocal({ repo, workflowSource: src, log: quiet, publishers: [IG_PUBLISHER] });
    expect(r).toMatchObject({ target: "main", pushed: true });
    expect(sh(bare, "show", "gh-pages:index.html")).toContain('id="fa-navbar-row"');
    expect(sh(bare, "show", "gh-pages:StructureDefinition-CWT.html")).toContain("<h1>CWT</h1>");
    expect(sh(bare, "ls-tree", "--name-only", "gh-pages").split("\n").sort()).toEqual(["StructureDefinition-CWT.html", "branches", "index.html"]);
  }, 60_000);

  test("refusingSyncNotFatal", async () => {
    const { bare, repo, src } = fixture(FAKE_RAIL, FAKE_SYNC_FAILS, "railed");
    const said: string[] = [];
    const r = await stageLocal({ repo, workflowSource: src, log: (s) => said.push(s), publishers: [IG_PUBLISHER] });
    expect(r).toMatchObject({ target: "main", pushed: true });
    expect(said.join("\n")).toMatch(/sync-docs-harness exited 1: the rail reads the harness data the cat-harness mount pins/);
    expect(sh(bare, "show", "gh-pages:index.html")).toContain('id="fa-navbar-row"');
  }, 60_000);
});
