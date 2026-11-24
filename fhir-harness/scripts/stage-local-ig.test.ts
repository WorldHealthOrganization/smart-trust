/**
 * The FHIR-IG site publisher: where an IG lands, how its build is planned,
 * an IG published end to end through `stage-local.ts`, and an IG
 * repository's folio site. Moved from cat-harness-tools with the publisher
 * (owner, 2026-10-14, Q4); the generic half (which publisher, main site or
 * preview, the folio's main site) is tested there.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { detectPublisher, FOLIO_PUBLISHER } from "../../cat-harness-tools/scripts/site-publisher.ts";
import { stageLocal } from "../../cat-harness-tools/scripts/stage-local.ts";
import {
  FOLIO_ROOT_MARKERS,
  IG_DROPPED,
  droppedWords,
  IG_KEEP,
  versionedRoots,
  IG_SITE_OPTIONAL,
  IG_PUBLISHER,
  IG_SITE_STAMP,
  IG_SITE_STEPS,
  declaredKeep,
  igFolioSite,
  lockedMountPath,
  igIdentity,
  applyIgDeploy,
  branchDirOf,
  composeIg,
  evalExpr,
  type ExprContext,
  igTarget,
  missingPrerequisites,
  planIgSteps,
  readEnvFile,
  readIgDeploys,
  readWorkflow,
  splitArgs,
} from "./stage-local-ig.ts";
import { FAKE_RAIL, FAKE_SYNC } from "./ig-chrome-fixture.ts";

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const put = (root: string, rel: string, text = "x") => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const IG_CALLER = `on:
  workflow_dispatch:
jobs:
  call_build:
    uses: example-org/ig-template/.github/workflows/fhirbuild.yml@main
`;
const IG_PAGES_CALLER = IG_CALLER.replace("fhirbuild.yml", "ghbuild.yml").replace("call_build", "build");

/** The shape of an IG template's ghbuild.yml, cut to the parts the plan reads. */
const IG_WORKFLOW = `on:
  workflow_call:
    inputs:
      do_preprocess:
        type: boolean
        default: true
      deploy:
        type: boolean
        default: true
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      - name: Setup Python
        uses: actions/setup-python@v5
      - name: Find PR number
        id: find_pr
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: python3 input/scripts/find_pr.py
      - name: Comment on PR
        if: steps.find_pr.outputs.IS_PR == 'true'
        run: echo comment
      - name: Check for preprocessing configuration
        run: |
          if [ -f preprocess.json ]; then echo "PREPROCESS_ENABLED=true" >> "$GITHUB_ENV"; fi
      - name: Preprocessing
        if: inputs.do_preprocess != 'false' && env.PREPROCESS_ENABLED == 'true'
        run: python3 input/scripts/preprocess.py
      - name: Update the image to the latest publisher
        uses: docker://hl7fhir/ig-publisher-base:latest
        with:
          args: curl -L https://example.org/publisher.jar -o ./input-cache/publisher.jar --create-dirs
      - name: Run the IG publisher
        run: docker exec ig-run java -jar ./input-cache/publisher.jar publisher -ig .
      - name: Upload qa.json artifact
        uses: actions/upload-artifact@v4
      - name: Deploy candidate
        id: deploy_candidate_1
        uses: JamesIves/github-pages-deploy-action@v4.4.2
        if: env.IS_DEFAULT_BRANCH == 'false' && inputs.deploy != false
        with:
          branch: gh-pages
          folder: ./output
          commit-message: Deploy candidate branch
          target-folder: branches/\${{ env.BRANCH_DIR }}
          single-commit: true
          clean: false
      - name: Deploy candidate (retry)
        uses: JamesIves/github-pages-deploy-action@v4.4.2
        if: env.IS_DEFAULT_BRANCH == 'false' && steps.deploy_candidate_1.outcome == 'failure'
        with:
          branch: gh-pages
          folder: ./output
          commit-message: Deploy candidate branch (retry)
          target-folder: elsewhere
      - name: Deploy main
        uses: JamesIves/github-pages-deploy-action@v4.4.2
        if: env.IS_DEFAULT_BRANCH == 'true' && inputs.deploy != false
        with:
          branch: gh-pages
          folder: ./output
          commit-message: Deploy main branch
          single-commit: true
          clean-exclude: |
            branches
            sitepreview
      - name: Commit README.md branch links update
        if: env.IS_DEFAULT_BRANCH == 'true'
        run: |
          git add README.md
          git commit -m "chore: update README.md"
          git push
`;

const ctx = (env: Record<string, string> = {}): ExprContext => ({
  github: { repository: "o/r", ref: "refs/heads/feat", ref_name: "feat", head_ref: "", sha: "abc", event_name: "workflow_dispatch" },
  inputs: { do_preprocess: true, deploy: true },
  env,
  steps: {},
});

describe("the IG publisher declares the workflows it publishes for", () => {
  test("detectsIgPublisher", () => {
    const on = [FOLIO_PUBLISHER, IG_PUBLISHER];
    expect(detectPublisher(new Map([["fhirbuild.yml", IG_CALLER]]), on)).toMatchObject({ kind: "ig", uses: { file: "fhirbuild.yml" } });
    expect(detectPublisher(new Map([["fhirbuild.yml", IG_CALLER], ["ghbuild.yml", IG_PAGES_CALLER]]), on).uses.file).toBe("ghbuild.yml");
    expect(IG_PUBLISHER.kind).toBe("ig");
  });
});

describe("stage-local: an IG lands where its workflow's deploy step puts it", () => {
  const wf = readWorkflow(IG_WORKFLOW);
  const deploys = readIgDeploys(wf);

  test("readsDeploySteps", () => {
    expect(deploys.candidate).toEqual({ branch: "gh-pages", folder: "output", targetFolder: "branches/${{ env.BRANCH_DIR }}", message: "Deploy candidate branch", clean: false, cleanExclude: [], singleCommit: true });
    expect(deploys.main).toMatchObject({ targetFolder: "", message: "Deploy main branch", clean: true, cleanExclude: ["branches", "sitepreview"] });
    expect(wf.inputs).toEqual({ do_preprocess: true, deploy: true });
  });

  test("defaultRootOthersBranches", () => {
    const main = igTarget(deploys, { isDefault: true, branchDir: "main", sha: "abc", runUrl: "u" });
    expect(main.dest).toBe("");
    expect(main.keep).toEqual([".git", ".ssh", ".github", "branches", "sitepreview"]);
    expect(main.commit).toEqual(["Deploy main branch", "from abc", "built locally: u"]);
    expect(branchDirOf("claude/magical-davinci-cp6tcx")).toBe("magical-davinci-cp6tcx");
    const cand = igTarget(deploys, { isDefault: false, branchDir: branchDirOf("claude/feat-x"), sha: "abc", runUrl: "u" });
    expect(cand.dest).toBe("branches/feat-x");
    expect(cand.keep).toBeUndefined();
    expect(cand.commit[0]).toBe("Deploy candidate branch");
  });

  test("refusesRootOrOutsideCandidate", () => {
    expect(() => igTarget({ candidate: { ...deploys.candidate!, targetFolder: "" } }, { isDefault: false, branchDir: "x", sha: "a", runUrl: "u" })).toThrow(/overwrite the root/);
    expect(() => igTarget(deploys, { isDefault: false, branchDir: "..", sha: "a", runUrl: "u" })).toThrow(/leaves the publish root/);
    expect(() => igTarget({ main: deploys.main! }, { isDefault: false, branchDir: "x", sha: "a", runUrl: "u" })).toThrow(/no candidate-branch deploy/);
  });

  test("mainCleansCandidateAdds", () => {
    const pages = tmp("stage-local-ig-pages-");
    put(pages, "branches/feat/index.html", "feat");
    put(pages, "sitepreview/a.html");
    put(pages, ".git/HEAD");
    put(pages, "stale.html");
    const out = tmp("stage-local-ig-out-");
    put(out, "index.html", "new main");
    composeIg(pages, out, igTarget(deploys, { isDefault: true, branchDir: "main", sha: "a", runUrl: "u" }));
    expect(readdirSync(pages).sort()).toEqual([".git", "branches", "index.html", "sitepreview"]);
    expect(readFileSync(join(pages, "branches/feat/index.html"), "utf-8")).toBe("feat");

    put(pages, "branches/feat/old.html");
    const c = composeIg(pages, out, igTarget(deploys, { isDefault: false, branchDir: "feat", sha: "a", runUrl: "u" }));
    expect(c.add).toEqual(["branches/feat"]);
    expect(existsSync(join(pages, "branches/feat/old.html"))).toBe(true);
    expect(readFileSync(join(pages, "branches/feat/index.html"), "utf-8")).toBe("new main");
  });

  test("refusesCleanOverFolioSite", () => {
    const pages = tmp("stage-local-ig-pages-");
    put(pages, "STAGING/x/index.html");
    put(pages, "_main-site.json", "{}");
    const out = tmp("stage-local-ig-out-");
    put(out, "index.html");
    expect(() => applyIgDeploy(pages, out, igTarget(deploys, { isDefault: true, branchDir: "main", sha: "a", runUrl: "u" }), () => {})).toThrow(/folio's site/);
    expect(existsSync(join(pages, "STAGING/x/index.html"))).toBe(true);
  });

  test("refusesOverStampedFolioSite", () => {
    const pages = tmp("stage-local-ig-pages-");
    put(pages, "index.html", "<title>Example IG | folio-assistant</title>");
    put(pages, "folio-build.json", "{}");
    const out = tmp("stage-local-ig-out-");
    put(out, "index.html");
    expect(() => applyIgDeploy(pages, out, igTarget(deploys, { isDefault: true, branchDir: "main", sha: "a", runUrl: "u" }), () => {})).toThrow(/folio-build\.json/);
    expect(existsSync(join(pages, "folio-build.json"))).toBe(true);
  });
});

describe("stage-local: the IG build is the workflow's own steps, planned", () => {
  test("planEachStepAction", () => {
    const plan = planIgSteps(readWorkflow(IG_WORKFLOW), ctx({ IS_DEFAULT_BRANCH: "true", BRANCH_DIR: "main" }));
    const by = Object.fromEntries(plan.map((s) => [s.name, s]));
    expect(by["Checkout code"]!.action).toBe("skip");
    expect(by["Setup Python"]!.action).toBe("venv");
    expect(by["Find PR number"]).toMatchObject({ action: "skip", reason: expect.stringMatching(/secret/) });
    expect(by["Comment on PR"]).toMatchObject({ action: "skip", reason: expect.stringMatching(/false here/) });
    expect(by["Check for preprocessing configuration"]!.action).toBe("run");
    expect(by["Preprocessing"]).toMatchObject({ action: "run", reason: expect.stringMatching(/decided when the run reaches it/) });
    expect(by["Update the image to the latest publisher"]!.action).toBe("docker");
    expect(by["Upload qa.json artifact"]!.action).toBe("skip");
    expect(by["Deploy main"]!.action).toBe("deploy");
    expect(by["Commit README.md branch links update"]).toMatchObject({ action: "skip", reason: expect.stringMatching(/source branch/) });
  });

  test("dockerNamedWhenMissing", () => {
    const plan = planIgSteps(readWorkflow(IG_WORKFLOW), ctx());
    expect(missingPrerequisites(plan, (cmd) => cmd[0] !== "docker")).toEqual([expect.stringMatching(/Docker daemon/)]);
    expect(missingPrerequisites(plan, () => true)).toEqual([]);
  });

  test("expressionsAsRunner", () => {
    const c = ctx({ PREPROCESS_ENABLED: "true" });
    expect(evalExpr("inputs.do_preprocess != 'false' && env.PREPROCESS_ENABLED == 'true'", c)).toBe(true);
    expect(evalExpr("${{ inputs.deploy != false }}", c)).toBe(true);
    expect(evalExpr("steps.find_pr.outputs.IS_PR == 'true'", c)).toBe(false);
    expect(evalExpr("github.head_ref || github.ref_name", c)).toBe("feat");
    expect(evalExpr("!cancelled()", c)).toBe(true);
    expect(evalExpr("secrets.GITHUB_TOKEN", c)).toBeUndefined();
  });

  test("envFilesAndDockerArgs", () => {
    expect(readEnvFile("A=1\nB=x=y\nC<<EOF\nl1\nl2\nEOF\n")).toEqual({ A: "1", B: "x=y", C: "l1\nl2" });
    expect(splitArgs(`-c "mkdir -p ./x && chown 1001:127 ./x"`)).toEqual(["-c", "mkdir -p ./x && chown 1001:127 ./x"]);
    expect(splitArgs("curl -L u -o ./p.jar")).toEqual(["curl", "-L", "u", "-o", "./p.jar"]);
  });
});

describe("stage-local end to end: an IG published to a local origin, preview then main", () => {
  const sh = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf-8" }).trim();

  test("endToEndPreviewThenMain", async () => {
    const bare = tmp("stage-local-origin-");
    sh(bare, "init", "-q", "--bare", "-b", "main");
    const repo = tmp("stage-local-ig-repo-");
    sh(repo, "init", "-q", "-b", "main");
    sh(repo, "config", "user.name", "t");
    sh(repo, "config", "user.email", "t@example.org");
    sh(repo, "remote", "add", "origin", "https://github.com/o/r");
    sh(repo, "config", `url.file://${bare}.insteadOf`, "https://github.com/o/r");
    put(repo, ".github/workflows/fhirbuild.yml", IG_CALLER.replace("example-org/ig-template", "o/sb"));
    // The platform's chrome scripts, as a mount lays them (stand-ins: stage-local-ig-chrome.test.ts runs the real rail).
    put(repo, "cat-harness-tools/scripts/sync-docs-harness.ts", FAKE_SYNC);
    put(repo, "cat-harness-tools/scripts/rail-standalone-pages.ts", FAKE_RAIL);
    sh(repo, "add", "-A");
    sh(repo, "commit", "-q", "-m", "ig");
    sh(repo, "push", "-q", "origin", "main");

    // gh-pages already holds another branch's build and a stale root page.
    const seed = tmp("stage-local-seed-");
    sh(seed, "init", "-q", "-b", "gh-pages");
    put(seed, "branches/other/index.html", "other");
    put(seed, "stale.html", "stale");
    sh(seed, "add", "-A");
    sh(seed, "-c", "user.name=t", "-c", "user.email=t@example.org", "commit", "-q", "-m", "seed");
    sh(seed, "push", "-q", `file://${bare}`, "gh-pages");

    // The reusable workflows, as a local checkout: fhirbuild.yml deploys nothing, ghbuild.yml is the Pages build.
    const src = tmp("stage-local-wfsrc-");
    put(src, ".github/workflows/fhirbuild.yml", "on:\n  workflow_call:\njobs:\n  trigger:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo trigger\n");
    put(src, ".github/workflows/ghbuild.yml", `on:
  workflow_call:
    inputs:
      deploy:
        type: boolean
        default: true
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
        run: mkdir -p output && echo "<html><body>$GITHUB_SHA</body></html>" > output/index.html
${IG_WORKFLOW.slice(IG_WORKFLOW.indexOf("      - name: Deploy candidate\n"), IG_WORKFLOW.indexOf("      - name: Commit README.md"))}`);

    const quiet = () => {};
    sh(repo, "checkout", "-q", "-b", "claude/feat");
    const dry = await stageLocal({ repo, workflowSource: src, dryRun: true, log: quiet, publishers: [IG_PUBLISHER] });
    expect(dry).toMatchObject({ kind: "ig", target: "preview", pushed: false });
    expect(dry.composed).toMatch(/1 file changed/);
    expect(sh(bare, "log", "-1", "--format=%s", "gh-pages")).toBe("seed");

    const pre = await stageLocal({ repo, workflowSource: src, log: quiet, publishers: [IG_PUBLISHER] });
    expect(pre).toMatchObject({ kind: "ig", target: "preview", pushed: true, url: "https://o.github.io/r/branches/feat/" });
    expect(sh(bare, "log", "-1", "--format=%s", "gh-pages")).toBe("Deploy candidate branch");
    expect(sh(bare, "show", "gh-pages:branches/feat/index.html")).toContain(sh(repo, "rev-parse", "HEAD"));
    expect(sh(bare, "show", "gh-pages:branches/other/index.html")).toBe("other");
    expect(sh(bare, "show", "gh-pages:stale.html")).toBe("stale");

    sh(repo, "checkout", "-q", "main");
    const main = await stageLocal({ repo, workflowSource: src, log: quiet, publishers: [IG_PUBLISHER] });
    expect(main).toMatchObject({ kind: "ig", target: "main", pushed: true, url: "https://o.github.io/r/" });
    expect(sh(bare, "log", "-1", "--format=%s", "gh-pages")).toBe("Deploy main branch");
    expect(sh(bare, "log", "-1", "--format=%b", "gh-pages")).toContain(`from ${sh(repo, "rev-parse", "HEAD")}`);
    const root = sh(bare, "ls-tree", "--name-only", "gh-pages").split("\n");
    expect(root.sort()).toEqual(["branches", "index.html"]);
    expect(sh(bare, "show", "gh-pages:branches/feat/index.html")).toBeTruthy();
    // Never a force push: the seed is still in the branch's history.
    expect(sh(bare, "log", "--format=%s", "gh-pages")).toContain("seed");
  }, 60_000);
});

describe("an IG repository's folio site (owner, 2026-10-14)", () => {
  const table = (names: string[], manifest = "base-layer/package.json") => new Map(names.map((n) => [n, { manifest }]));
  const scripts = table(Object.values(IG_SITE_STEPS));
  const landing = { kind: "instance", name: "base-harness" };
  const identity = { title: "Example IG" };

  test("siteTitleFromSushi", () => {
    expect(igIdentity("id: x\ntitle: Example IG\ndescription: An example.\n", "repo")).toEqual({ title: "Example IG", description: "An example." });
    expect(igIdentity("id: x\nname: ExampleIG\n", "repo")).toEqual({ title: "ExampleIG" });
    expect(igIdentity(undefined, "repo")).toEqual({ title: "repo" });
    expect(igIdentity(": not yaml : [", "repo")).toEqual({ title: "repo" });
  });

  test("harnessedFolioRoute", () => {
    const r = igFolioSite({ hasIndexConfig: true, scripts, landing, identity });
    expect(r.site).toMatchObject({
      scope: "base-harness",
      title: "Example IG",
      pre: [IG_SITE_STEPS.ast],
      sourceSteps: [IG_SITE_STEPS.source],
      siteSteps: [IG_SITE_STEPS.site],
      keep: [...IG_KEEP],
      dropped: [...IG_DROPPED],
    });
  });

  test("coveragePolicyReachesBuild", () => {
    expect(igFolioSite({ hasIndexConfig: true, scripts, landing, identity, coverage: "report" }).site?.coverage).toBe("report");
    expect(igFolioSite({ hasIndexConfig: true, scripts, landing, identity }).site?.coverage).toBeUndefined();
  });

  test("bareRouteWithReason", () => {
    expect(igFolioSite({ hasIndexConfig: false, scripts, landing, identity }).why).toMatch(/no index\.config\.json/);
    expect(igFolioSite({ hasIndexConfig: true, scripts: table([]), landing, identity }).why).toMatch(new RegExp(IG_SITE_STEPS.site));
  });

  test("partialStepsRefused", () => {
    expect(() => igFolioSite({ hasIndexConfig: true, scripts: table([IG_SITE_STEPS.source, IG_SITE_STEPS.site]), landing, identity })).toThrow(new RegExp(`not ${IG_SITE_STEPS.ast}`));
  });

  test("sidecarsOnlyFromLanding", () => {
    const withSide = new Map([...scripts, [IG_SITE_OPTIONAL.sidecars, { manifest: "base-harness-mount/package.json" }]]);
    const run = igFolioSite({ hasIndexConfig: true, scripts: withSide, landing, landingPath: "base-harness-mount", identity }).site!;
    expect(run.pre).toEqual([IG_SITE_STEPS.ast, IG_SITE_OPTIONAL.sidecars]);
    const other = igFolioSite({ hasIndexConfig: true, scripts: withSide, landing, landingPath: "elsewhere", identity }).site!;
    expect(other.pre).toEqual([IG_SITE_STEPS.ast]);
    expect(other.notes.join("\n")).toMatch(/NOT run — provided by base-harness-mount\/package\.json/);
  });

  test("indexesAfterAstAndSidecars", () => {
    const withSide = new Map([...scripts, [IG_SITE_OPTIONAL.sidecars, { manifest: "base-harness-mount/package.json" }], [IG_SITE_OPTIONAL.index, { manifest: "fhir-harness/package.json" }]]);
    expect(igFolioSite({ hasIndexConfig: true, scripts: withSide, landing, landingPath: "base-harness-mount", identity }).site!.pre).toEqual([IG_SITE_STEPS.ast, IG_SITE_OPTIONAL.sidecars, IG_SITE_OPTIONAL.index]);
    expect(igFolioSite({ hasIndexConfig: true, scripts, landing, identity }).site!.notes.join("\n")).toMatch(/no artefact index is built/);
  });

  test("drawingsAfterIndexes", () => {
    const all = new Map([...scripts, [IG_SITE_OPTIONAL.index, { manifest: "fhir-harness/package.json" }], [IG_SITE_OPTIONAL.drawings, { manifest: "cat-harness-tools/package.json" }]]);
    expect(IG_SITE_OPTIONAL.drawings).toBe("render:bpmn");
    const run = igFolioSite({ hasIndexConfig: true, scripts: all, landing, identity }).site!;
    expect(run.pre).toEqual([IG_SITE_STEPS.ast, IG_SITE_OPTIONAL.index, IG_SITE_OPTIONAL.drawings]);
    expect(run.notes.join("\n")).toMatch(/render:bpmn: run/);
    const without = igFolioSite({ hasIndexConfig: true, scripts, landing, identity }).site!;
    expect(without.pre).not.toContain(IG_SITE_OPTIONAL.drawings);
    expect(without.notes.join("\n")).toMatch(/no process drawings are built/);
  });

  test("openapiBeforeServing", () => {
    const withOa = new Map([...scripts, [IG_SITE_OPTIONAL.openapi, { manifest: "tools/package.json" }]]);
    expect(igFolioSite({ hasIndexConfig: true, scripts: withOa, landing, hasOpenapi: true, identity }).site!.siteSteps).toEqual([IG_SITE_OPTIONAL.openapi, IG_SITE_STEPS.site]);
    expect(igFolioSite({ hasIndexConfig: true, scripts: withOa, landing, hasOpenapi: false, identity }).site!.siteSteps).toEqual([IG_SITE_STEPS.site]);
    expect(igFolioSite({ hasIndexConfig: true, scripts, landing, hasOpenapi: true, identity }).site!.notes.join("\n")).toMatch(/NOT built/);
  });

  test("igBarFinalStep", () => {
    const withBar = new Map([...scripts, [IG_SITE_OPTIONAL.bar, { manifest: "fhir-harness/package.json" }]]);
    expect(igFolioSite({ hasIndexConfig: true, scripts: withBar, landing, identity }).site!.finalSteps).toEqual([IG_SITE_OPTIONAL.bar]);
    const without = igFolioSite({ hasIndexConfig: true, scripts, landing, identity }).site!;
    expect(without.finalSteps).toEqual([]);
    expect(without.notes.join("\n")).toMatch(/keep no IG bar/);
  });

  test("igPageScanLastFinalStep", () => {
    const both = new Map([...scripts, [IG_SITE_OPTIONAL.bar, { manifest: "fhir-harness/package.json" }], [IG_SITE_OPTIONAL.pageScan, { manifest: "fhir-harness/package.json" }]]);
    expect(igFolioSite({ hasIndexConfig: true, scripts: both, landing, identity }).site!.finalSteps).toEqual([IG_SITE_OPTIONAL.bar, IG_SITE_OPTIONAL.pageScan]);
    expect(igFolioSite({ hasIndexConfig: true, scripts, landing, identity }).site!.notes.join("\n")).toMatch(/page scan says it has no results/);
  });

  test("parityExcusesRuledDrops", () => {
    expect(IG_DROPPED.map((d) => d.dir ?? `feature:${d.feature}`)).toEqual(["comparison-v*", "schemas", "ast-data", "feature:siteNav"]);
    expect(IG_DROPPED[0]!.ruling).toContain("2a");
    expect(IG_DROPPED[1]!.ruling).toContain("New address only");
    expect(IG_DROPPED[2]!.ruling).toMatch(/2026-11-08.*ast-data/);
    expect(IG_DROPPED[3]!.ruling).toMatch(/2026-10-15.*layout "C"/);
    // Each entry names one thing, never both.
    for (const d of IG_DROPPED) expect((d.dir === undefined) !== (d.feature === undefined)).toBe(true);
    // Search and the language picker are never excused.
    expect(IG_DROPPED.map((d) => d.feature).filter(Boolean)).toEqual(["siteNav"]);
  });

  test("dropsInWords", () => {
    expect(IG_DROPPED.map(droppedWords)).toEqual(["comparison-v*/", "schemas/", "ast-data/", "the page feature siteNav"]);
  });

  test("noLandingRefused", () => {
    expect(() => igFolioSite({ hasIndexConfig: true, scripts, landing: { kind: "ambiguous", reason: "none-flagged" }, identity })).toThrow(/site.*landing/);
  });

  test("previewsKeptAtRoot", () => {
    expect(IG_KEEP).toContain("branches");
    expect(IG_KEEP).toContain("ns");
    expect(versionedRoots(["0.1.0", "1.2.3-ballot", "branches", "assets", "v1", "0.1"])).toEqual(["0.1.0", "1.2.3-ballot"]);
  });

  test("declaredKeepAdded", () => {
    const r = igFolioSite({ hasIndexConfig: true, scripts, landing, identity, keep: ["ns", "branches", "0.1.0"] }).site!;
    // "ns" and "branches" are the IG's own (IG_KEEP) as well as declared: kept once, not doubled.
    expect(r.keep).toEqual([...IG_KEEP, "0.1.0"]);
  });

  test("declaredKeepFromConfig", () => {
    const repo = tmp("ig-declared-keep-");
    put(repo, "index.config.json", JSON.stringify({
      $schema: "folio-index-config/v1",
      instances: [{ name: "base-harness", source: { local: { at: "base-harness" } }, site: { build: { keep: ["ns", "0.1.0"] } } }, { name: "other" }],
      site: { landing: "base-harness" },
    }));
    expect(declaredKeep(repo, "base-harness")).toEqual(["ns", "0.1.0"]);
    expect(declaredKeep(repo, "other")).toEqual([]);
    put(repo, "index.config.json", JSON.stringify({ $schema: "folio-index-config/v1", instances: [{ name: "base-harness", site: { build: { keep: ["a/b"] } } }] }));
    expect(() => declaredKeep(repo, "base-harness")).toThrow(/site\.build\.keep/);
  });

  test("stampIsFolioRootMarker", () => {
    expect(FOLIO_ROOT_MARKERS as readonly string[]).toContain(IG_SITE_STAMP);
    const pages = mkdtempSync(join(tmpdir(), "ig-folio-root-"));
    writeFileSync(join(pages, IG_SITE_STAMP), "{}");
    writeFileSync(join(pages, "index.html"), "folio");
    const t = { deploy: { branch: "gh-pages", folder: "output", targetFolder: "", message: "", clean: true, cleanExclude: [], singleCommit: false }, dest: "", keep: [".git"], commit: ["m"] };
    expect(() => applyIgDeploy(pages, "output", t, () => {})).toThrow(/folio's site/);
  });
});

describe("where the checkout holds the landing instance (lockedMountPath)", () => {
  const repoWith = (files: Record<string, unknown>) => {
    const d = mkdtempSync(join(tmpdir(), "locked-mount-path-"));
    for (const [f, v] of Object.entries(files)) writeFileSync(join(d, f), JSON.stringify(v));
    return d;
  };
  const lock = { instances: [{ instance: "fhir-harness", path: "fhir-harness" }, { instance: "base-ig", path: "base-ig" }] };

  test("mountedInstancePath", () => {
    expect(lockedMountPath(repoWith({ "index.lock.json": lock }), "base-ig")).toBe("base-ig");
  });

  test("localInstancePath", () => {
    const config = { instances: [{ name: "base-ig", source: { local: { at: "./base-ig/" } } }, { name: "fhir-harness", source: { remote: { repository: "o/fhir-harness", ref: "x" } } }] };
    const repo = repoWith({ "index.lock.json": { instances: [{ instance: "fhir-harness", path: "fhir-harness" }] }, "index.config.json": config });
    expect(lockedMountPath(repo, "base-ig")).toBe("base-ig");
    expect(lockedMountPath(repo, "fhir-harness")).toBe("fhir-harness");
    expect(lockedMountPath(repo, "absent")).toBeUndefined();
  });

  test("localLandingSidecarsRun", () => {
    const repo = repoWith({ "index.config.json": { instances: [{ name: "base-ig", source: { local: { at: "base-ig" } } }] } });
    const landingPath = lockedMountPath(repo, "base-ig");
    const scripts = new Map([...Object.values(IG_SITE_STEPS), IG_SITE_OPTIONAL.sidecars].map((n) => [n, { manifest: n === IG_SITE_OPTIONAL.sidecars ? "base-ig/package.json" : "fhir-harness/package.json" }]));
    const r = igFolioSite({ hasIndexConfig: true, scripts, landing: { kind: "instance", name: "base-ig" }, ...(landingPath !== undefined ? { landingPath } : {}), identity: { title: "Base IG" } });
    expect(r.site?.pre).toEqual([IG_SITE_STEPS.ast, IG_SITE_OPTIONAL.sidecars]);
  });
});
