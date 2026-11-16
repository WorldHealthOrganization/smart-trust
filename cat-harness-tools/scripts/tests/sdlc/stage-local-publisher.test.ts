/**
 * stage-local as ONE publish path: which publisher a repository uses, main
 * site or preview, and what the folio's main site keeps. A publisher other
 * than the folio's is a layer's declared `site-publisher-<kind>` pipeline
 * slot (owner, 2026-10-14, Q4), tested where it lives; here it is a stand-in
 * with the same workflows.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ContributionRegistry } from "../../../schemas/content/contributions.ts";

import { callerInputs, declaredSitePublishers, detectPublisher, FOLIO_PUBLISHER, isReusableWorkflow, isSitePublisher, parseUses, type PublisherWorkflows } from "../../site-publisher.ts";
import { chooseTarget, composeMain, mainCommitMessage, parseSymref, platformScript, previewCommitMessage } from "../../stage-local.ts";

const tmp = (p: string) => mkdtempSync(join(tmpdir(), p));
const put = (root: string, rel: string, text = "x") => {
  mkdirSync(join(root, rel, ".."), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const FOLIO_CALLER = `on:
  workflow_dispatch:
jobs:
  staging:
    uses: litlfred/folio-assistant/.github/workflows/folio-staging.yml@main
    with:
      build_command: 'bun run build'
`;
const IG_CALLER = `on:
  workflow_dispatch:
jobs:
  call_build:
    uses: WorldHealthOrganization/smart-base/.github/workflows/fhirbuild.yml@main
`;
const IG_PAGES_CALLER = IG_CALLER.replace("fhirbuild.yml", "ghbuild.yml").replace("call_build", "build");

/** A declared publisher's workflows, as a layer above declares them: a stand-in, so this layer names none. */
const STAND_IN: PublisherWorkflows = { kind: "ig", workflows: ["fhirbuild.yml", "ghbuild.yml"], preferred: "ghbuild.yml" };
const ON_OFFER: readonly PublisherWorkflows[] = [FOLIO_PUBLISHER, STAND_IN];

describe("stage-local: which publisher, read from the repository's own workflows", () => {
  test("a caller of folio-staging.yml is a folio; a caller of a declared publisher's workflow is that publisher's kind", () => {
    expect(detectPublisher(new Map([["staging.yml", FOLIO_CALLER]]), ON_OFFER)).toMatchObject({ kind: "folio", caller: "staging.yml", uses: { file: "folio-staging.yml", ref: "main" } });
    expect(detectPublisher(new Map([["fhirbuild.yml", IG_CALLER]]), ON_OFFER)).toMatchObject({ kind: "ig", uses: { owner: "WorldHealthOrganization", repo: "smart-base", file: "fhirbuild.yml" } });
  });

  test("a pinned uses: line with a trailing comment is still read (smart-trust's `@<sha> # main`)", () => {
    const pinned = IG_CALLER.replace("fhirbuild.yml@main", "fhirbuild.yml@49178a48d460bb53acf6e90d8c0aee3f0146d8f7 # main");
    expect(detectPublisher(new Map([["fhirbuild.yml", pinned]]), ON_OFFER)).toMatchObject({
      kind: "ig",
      uses: { file: "fhirbuild.yml", ref: "49178a48d460bb53acf6e90d8c0aee3f0146d8f7" },
    });
  });

  test("a repository calling two of one publisher's workflows builds with the one it prefers", () => {
    expect(detectPublisher(new Map([["fhirbuild.yml", IG_CALLER], ["ghbuild.yml", IG_PAGES_CALLER]]), ON_OFFER).uses.file).toBe("ghbuild.yml");
  });

  test("a repository calling both kinds publishes the folio unless told otherwise, and says so", () => {
    const both = new Map([["staging.yml", FOLIO_CALLER], ["fhirbuild.yml", IG_CALLER]]);
    expect(detectPublisher(both, ON_OFFER)).toMatchObject({ kind: "folio", alsoCalls: { kind: "ig", file: "fhirbuild.yml" } });
    expect(detectPublisher(both, ON_OFFER, "ig")).toMatchObject({ kind: "ig", alsoCalls: { kind: "folio" } });
    expect(() => detectPublisher(new Map([["staging.yml", FOLIO_CALLER]]), ON_OFFER, "ig")).toThrow(/no workflow here calls/);
  });

  test("the repository that DEFINES a publisher's reusable workflow builds with it at the commit being built (smart-base, 2026-11-13)", () => {
    const DEFINED = "on:\n  workflow_call:\n  workflow_dispatch:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps: []\n";
    const site = "on:\n  push:\njobs:\n  publish:\n    uses: litlfred/cat-harness-tools/.github/workflows/folio-site-publish.yml@abc # index.lock.json\n";
    const self = { owner: "litlfred", repo: "smart-base", ref: "f".repeat(40) };
    const wf = new Map([["fhirbuild.yml", DEFINED], ["ghbuild.yml", DEFINED], ["site-publish.yml", site]]);
    // Its own ghbuild.yml, the publisher's preferred workflow, at this commit.
    expect(detectPublisher(wf, ON_OFFER, undefined, self)).toMatchObject({
      kind: "ig",
      caller: "ghbuild.yml",
      uses: { owner: "litlfred", repo: "smart-base", path: ".github/workflows/ghbuild.yml", ref: self.ref, file: "ghbuild.yml" },
    });
    // Without knowing which repository this is, nothing is defined "here": refused as before.
    expect(() => detectPublisher(wf, ON_OFFER)).toThrow(/nothing to mirror/);
    // A same-named file that is not reusable is not the publisher's workflow.
    expect(() => detectPublisher(new Map([["ghbuild.yml", "on:\n  push:\njobs: {}\n"]]), ON_OFFER, undefined, self)).toThrow(/nothing to mirror/);
    // A repository that also calls the folio's workflow still publishes the folio unless told otherwise.
    const both = new Map([...wf, ["folio.yml", FOLIO_CALLER]]);
    expect(detectPublisher(both, ON_OFFER, undefined, self)).toMatchObject({ kind: "folio", alsoCalls: { kind: "ig" } });
    expect(isReusableWorkflow("on:\n  workflow_call: # reusable\n")).toBe(true);
    expect(isReusableWorkflow("on: [push]\n")).toBe(false);
  });
  test("a repository calling neither is refused, naming what it does call", () => {
    expect(() => detectPublisher(new Map([["ci.yml", "jobs:\n  x:\n    uses: o/r/.github/workflows/other.yml@v1\n"]]), ON_OFFER)).toThrow(/other\.yml/);
    expect(() => detectPublisher(new Map(), ON_OFFER)).toThrow(/nothing to mirror/);
  });

  test("uses: references parse, and a caller's with: is read for the inputs", () => {
    expect(parseUses("o/r/.github/workflows/a.yml@v2")).toEqual({ owner: "o", repo: "r", path: ".github/workflows/a.yml", ref: "v2", file: "a.yml" });
    expect(parseUses("actions/checkout@v4")).toBeUndefined();
    const u = parseUses("WorldHealthOrganization/smart-base/.github/workflows/fhirbuild.yml@main")!;
    expect(callerInputs(IG_CALLER.replace("@main\n", "@main\n    with:\n      do_dak: false\n"), u)).toEqual({ do_dak: false });
    expect(callerInputs(IG_CALLER, u)).toEqual({});
  });

  test("only the folio is built in: without a declared publisher, an IG caller is refused, and the refusal says where publishers come from", () => {
    expect(() => detectPublisher(new Map([["fhirbuild.yml", IG_CALLER]]), [FOLIO_PUBLISHER])).toThrow(/site-publisher-<kind> pipeline slot/);
  });
});

describe("site publishers are declared pipeline slots, never named here (owner, 2026-10-14, Q4)", () => {
  const stage = async () => ({}) as never;
  const reg = (slots: Record<string, unknown>): ContributionRegistry => {
    const r = new ContributionRegistry();
    r.register({ name: "upper-layer", pipelinePlugins: Object.entries(slots).map(([kind, implementation]) => ({ kind, implementation })) } as never);
    return r;
  };

  test("a `site-publisher-<kind>` slot is a publisher of that kind; other slots are not read", () => {
    const got = declaredSitePublishers("/nowhere", reg({ "site-publisher-ig": { ...STAND_IN, stage }, "lean-lexer": {} }));
    expect(got.map((p) => [p.kind, [...p.workflows]])).toEqual([["ig", ["fhirbuild.yml", "ghbuild.yml"]]]);
  });

  test("FAILS loudly for a slot that holds no publisher, a kind that disagrees with its slot, or the folio's kind", () => {
    expect(() => declaredSitePublishers("/nowhere", reg({ "site-publisher-ig": { kind: "ig" } }))).toThrow(/not a site publisher/);
    expect(() => declaredSitePublishers("/nowhere", reg({ "site-publisher-ig": { ...STAND_IN, kind: "other", stage } }))).toThrow(/not 'ig'/);
    expect(() => declaredSitePublishers("/nowhere", reg({ "site-publisher-folio": { ...STAND_IN, kind: "folio", stage } }))).toThrow(/built-in/);
    expect(isSitePublisher({ ...STAND_IN, stage })).toBe(true);
  });

  test("no slot filled: no publisher besides the folio's", () => {
    expect(declaredSitePublishers("/nowhere", new ContributionRegistry())).toEqual([]);
  });
});

describe("stage-local: main site or preview", () => {
  test("the default branch publishes the main site; any other branch a preview", () => {
    expect(chooseTarget({ branch: "main", defaultBranch: "main" })).toBe("main");
    expect(chooseTarget({ branch: "claude/x", defaultBranch: "main" })).toBe("preview");
  });

  test("--main is refused off the default branch, and the default branch must be known without it", () => {
    expect(() => chooseTarget({ branch: "claude/x", defaultBranch: "main", main: true })).toThrow(/not the default branch/);
    expect(chooseTarget({ branch: "main", main: true })).toBe("main");
    expect(() => chooseTarget({ branch: "HEAD", defaultBranch: "main" })).toThrow(/detached/);
    expect(() => chooseTarget({ branch: "HEAD", main: true })).toThrow(/detached/);
    expect(() => chooseTarget({ branch: "main" })).toThrow(/default branch/);
  });

  test("the default branch is read from ls-remote --symref", () => {
    expect(parseSymref("ref: refs/heads/main\tHEAD\n5a2b76de\tHEAD\n")).toBe("main");
    expect(parseSymref("5a2b76de\tHEAD\n")).toBeUndefined();
  });

  test("the commits: publish-main's for the root, staging(<slug>) for a preview", () => {
    expect(mainCommitMessage("abc123", "main", "https://github.com/o/r/commit/abc123")).toEqual([
      "main-site: from abc123",
      "render-log: rendered the root from main",
      "built locally: https://github.com/o/r/commit/abc123",
    ]);
    expect(previewCommitMessage("feat-x", "abc123", "u")[0]).toBe("staging(feat-x): from abc123");
  });

  test("a platform script is found either side of the 70lx split", () => {
    const p = tmp("stage-local-platform-");
    put(p, "cat-harness/scripts/render-log.ts");
    put(p, "cat-harness-tools/scripts/publish-main-site.ts");
    expect(platformScript(p, "render-log.ts")).toBe(join(p, "cat-harness/scripts/render-log.ts"));
    expect(platformScript(p, "publish-main-site.ts")).toBe(join(p, "cat-harness-tools/scripts/publish-main-site.ts"));
    expect(() => platformScript(p, "nothing.ts")).toThrow(/in none of/);
  });
});

describe("stage-local: the folio's main site keeps what publish-main keeps", () => {
  const scripts = (n: string) => join(import.meta.dir, "..", "..", n);

  test("STAGING/, _render-log/ and a hand-placed root file survive; the last publish's files are replaced; a main-site entry is logged", () => {
    const pages = tmp("stage-local-pages-");
    put(pages, "STAGING/feat/index.html", "preview");
    put(pages, "_render-log/README.md", "log");
    put(pages, "CNAME", "example.org");
    put(pages, "gone.html", "old main page");
    writeFileSync(join(pages, "_main-site.json"), JSON.stringify({ $schema: "folio-main-site/v1", commit: "old", files: ["gone.html"] }));
    const site = tmp("stage-local-site-");
    put(site, "index.html", "<p>main");
    put(site, "doc/index.html", "<p>doc");

    const c = composeMain(pages, site, { branch: "main", sha: "abc123", runUrl: "https://github.com/o/r/commit/abc123", script: scripts });
    expect(c.commit[0]).toBe("main-site: from abc123");
    expect(c.add).toEqual(["."]);
    expect(readFileSync(join(pages, "STAGING/feat/index.html"), "utf-8")).toBe("preview");
    expect(readFileSync(join(pages, "CNAME"), "utf-8")).toBe("example.org");
    expect(existsSync(join(pages, "gone.html"))).toBe(false);
    expect(readFileSync(join(pages, "index.html"), "utf-8")).toBe("<p>main");
    expect(JSON.parse(readFileSync(join(pages, "_main-site.json"), "utf-8")).files).toEqual(["doc/index.html", "index.html"]);
    const logs = readdirSync(join(pages, "_render-log"), { recursive: true }).map(String).filter((f) => f.endsWith(".jsonl"));
    const entry = logs.map((f) => readFileSync(join(pages, "_render-log", f), "utf-8")).join("");
    expect(entry).toContain('"kind":"main-site"');
    expect(entry).toContain('"path":"/"');
  });

  test("an empty build is refused before the root is touched (bean oisv)", () => {
    const pages = tmp("stage-local-pages-");
    put(pages, "index.html", "last main");
    writeFileSync(join(pages, "_main-site.json"), JSON.stringify({ $schema: "folio-main-site/v1", commit: "old", files: ["index.html"] }));
    let refusal = "";
    try {
      composeMain(pages, tmp("stage-local-empty-"), { branch: "main", sha: "a", runUrl: "u", script: scripts, stderr: "pipe" });
    } catch (e) {
      refusal = String((e as { stderr?: unknown }).stderr ?? "");
    }
    expect(refusal).toContain("is empty; refusing to publish");
    expect(readFileSync(join(pages, "index.html"), "utf-8")).toBe("last main");
  });
});
