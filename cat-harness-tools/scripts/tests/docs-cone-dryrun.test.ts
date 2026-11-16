/**
 * The docs site's dependency-cone deploy, dry run (bean `fwtz`, option C):
 * the inputs since the DEPLOYED stamp, the stamp-blind measurement, and the
 * verdict that must never call an under-carried cone safe.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

import { RENDERED_IMPACT_TAG, RenderedImpactSchema } from "../../schemas/ui/rendered-impact.js";
import {
  collectInputs,
  diffBranchMount,
  intoCheckout,
  judge,
  markerKey,
  measureDeploy,
  mountsForStamp,
  nameStatus,
  stampedHash,
  summary,
} from "../docs-cone-dryrun.js";

const tmp = mkdtempSync(join(tmpdir(), "docs-cone-dryrun-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function site(name: string, files: Record<string, string>): string {
  const root = join(tmp, name);
  for (const [p, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), text);
  }
  return root;
}

const page = (body: string, sha: string, v: string) =>
  `<html><head><link href="/r/a.css?v=179274877${v}"></head><body><main>${body}</main><footer><p class="text-small mb-0 fa-build-stamp">   deployed   <a href="https://x/runs/${sha}"><code>${sha}</code></a> &middot; 2026-10-23T14:03:16Z</p></footer></body></html>`;

const impact = (files: string[], undetermined: { input: string; reason: string }[] = []) =>
  RenderedImpactSchema.parse({ $schema: RENDERED_IMPACT_TAG, renderer: "docs-site", method: "cone", files: files.map((path) => ({ path, change: "changed", role: path.endsWith(".html") ? "content" : "data" })), undetermined });

describe("nameStatus", () => {
  test("reads adds, removals, renames and copies as REST-style statuses", () => {
    expect(nameStatus("M\ta.md\nA\tb.md\nD\tc.md\nR087\told.md\tnew.md\nC100\tx\ty\n")).toEqual([
      { status: "modified", path: "a.md" },
      { status: "added", path: "b.md" },
      { status: "removed", path: "c.md" },
      { status: "renamed", path: "new.md", from: "old.md" },
      { status: "added", path: "y" },
    ]);
  });
});

describe("intoCheckout", () => {
  test("maps a branch path under the mount's subtree to its checkout path, and nothing else", () => {
    expect(intoCheckout("beans/defs/x.md", { path: "beans", into: "beans" })).toBe("beans/defs/x.md");
    expect(intoCheckout("graph/a.json", { path: "graph", into: "fsh-guts" })).toBe("fsh-guts/a.json");
    expect(intoCheckout("README.md", { path: "beans", into: "beans" })).toBeUndefined();
    expect(intoCheckout("a.json", { path: "", into: "todos" })).toBe("todos/a.json");
    expect(intoCheckout("test/results/health/run.json", { path: ".", branchPath: "test/results/health", into: "smart-base" })).toBe(
      "smart-base/run.json",
    );
  });
});

describe("markerKey and mountsForStamp", () => {
  test("keys multi-instance mounts by <instance>.<id> and omits colliding bare ids", () => {
    const markers = [
      { id: "beans", key: "cat-harness.beans", tip: "b1" },
      { id: "health", key: "cat-harness.health", tip: "h1" },
      { id: "health", key: "smart-base.health", tip: "h2" },
    ];
    expect(markers.map(markerKey)).toEqual(["cat-harness.beans", "cat-harness.health", "smart-base.health"]);
    expect(mountsForStamp(markers)).toEqual({
      "cat-harness.beans": "b1",
      beans: "b1",
      "cat-harness.health": "h1",
      "smart-base.health": "h2",
    });
  });
});

describe("collectInputs", () => {
  const marker = { id: "beans", branch: "cat/cat-harness/beans", path: "beans", into: "beans", tip: "t2" };
  const diffs: Record<string, string> = { "s1..h": "M\tcat-harness/docs/a.md\n", "t1..t2": "M\tbeans/defs/x.md\nM\tmanifest.json\n" };
  const diff = (a: string, b: string) => {
    const d = diffs[`${a}..${b}`];
    if (d === undefined) throw new Error(`no diff ${a}..${b}`);
    return d;
  };

  test("diffs from the DEPLOYED commit, and a moved branch mount at its mount path", () => {
    const r = collectInputs({ stamp: { sha: "s1", mounts: { beans: "t1" } }, head: "h", markers: [marker], diff });
    expect(r.doubts).toEqual([]);
    expect(r.changed).toEqual([
      { status: "modified", path: "cat-harness/docs/a.md" },
      { status: "modified", path: "beans/defs/x.md" },
    ]);
  });

  test("an unmoved mount adds nothing", () => {
    const r = collectInputs({ stamp: { sha: "s1", mounts: { beans: "t2" } }, head: "h", markers: [marker], diff });
    expect(r.changed.map((c) => c.path)).toEqual(["cat-harness/docs/a.md"]);
  });

  test("a stamp with no recorded tip is a doubt, never 'the mount did not move'", () => {
    const r = collectInputs({ stamp: { sha: "s1" }, head: "h", markers: [marker], diff });
    expect(r.doubts).toHaveLength(1);
    expect(r.doubts[0]).toContain("records no tip");
  });

  test("multi-instance mounts sharing an id use their disambiguated key and never fall back to a colliding bare id", () => {
    const h1 = { id: "health", key: "cat-harness.health", branch: "cat/cat-harness/health", path: "test/health/results", into: "test/health/results", tip: "c2" };
    const h2 = { id: "health", key: "smart-base.health", branch: "cat/smart-base/health", path: ".", branchPath: "test/results/health", repository: "litlfred/smart-base", into: "smart-base", tip: "s2" };
    // Legacy stamp with only bare `health: "s1"` must not be used to diff either mount when two markers share `id: "health"`.
    const legacy = collectInputs({ stamp: { sha: "s1", mounts: { health: "s1" } }, head: "h", markers: [h1, h2], diff });
    expect(legacy.doubts).toHaveLength(2);
    expect(legacy.doubts[0]).toContain("records no tip for the branch mount 'cat-harness.health'");
    expect(legacy.doubts[1]).toContain("records no tip for the branch mount 'smart-base.health'");

    // Keyed stamp diffs each mount through diffMount with its own marker.
    const keyed = collectInputs({
      stamp: { sha: "s1", mounts: { "cat-harness.health": "c1", "smart-base.health": "s1" } },
      head: "h",
      markers: [h1, h2],
      diff,
      diffMount: (m, from, to) =>
        m.key === "smart-base.health" && from === "s1" && to === "s2"
          ? "M\ttest/results/health/ig.json\n"
          : m.key === "cat-harness.health" && from === "c1" && to === "c2"
            ? "M\ttest/health/results/ci.json\n"
            : "",
    });
    expect(keyed.doubts).toEqual([]);
    expect(keyed.changed).toEqual([
      { status: "modified", path: "cat-harness/docs/a.md" },
      { status: "modified", path: "test/health/results/ci.json" },
      { status: "modified", path: "smart-base/ig.json" },
    ]);
  });

  test("diffBranchMount reads from the mount's BranchStore (including foreign-repository mounts)", () => {
    const root = join(tmp, "mount-checkout");
    const remote = join(tmp, "foreign-remote.git");
    const work = join(tmp, "foreign-work");
    mkdirSync(root, { recursive: true });
    execFileSync("git", ["init", "-q", root]);
    execFileSync("git", ["init", "-q", "--bare", remote]);
    execFileSync("git", ["clone", "-q", remote, work]);
    execFileSync("git", ["-C", work, "checkout", "-q", "-b", "cat/smart-base/health"]);
    mkdirSync(join(work, "test/results/health"), { recursive: true });
    writeFileSync(join(work, "test/results/health/a.json"), "1\n");
    execFileSync("git", ["-C", work, "add", "."]);
    execFileSync("git", ["-C", work, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "c1"]);
    const c1 = execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
    writeFileSync(join(work, "test/results/health/a.json"), "2\n");
    execFileSync("git", ["-C", work, "add", "."]);
    execFileSync("git", ["-C", work, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "c2"]);
    const c2 = execFileSync("git", ["-C", work, "rev-parse", "HEAD"], { encoding: "utf-8" }).trim();
    execFileSync("git", ["-C", work, "push", "-q", "origin", "cat/smart-base/health"]);

    const m = {
      id: "health",
      key: "smart-base.health",
      branch: "cat/smart-base/health",
      path: ".",
      branchPath: "test/results/health",
      repository: "litlfred/smart-base",
      into: "smart-base",
      tip: c2,
    };
    const out = diffBranchMount(root, m, c1, c2, { urlFor: () => remote });
    expect(nameStatus(out)).toEqual([{ status: "modified", path: "test/results/health/a.json" }]);
  });

  test("no stamp at all, or an unreadable diff, is a doubt", () => {
    expect(collectInputs({ stamp: undefined, head: "h", markers: [], diff }).doubts[0]).toContain("no base");
    expect(collectInputs({ stamp: { sha: "zz" }, head: "h", markers: [], diff }).doubts[0]).toContain("could not be read");
  });
});

describe("measureDeploy", () => {
  test("a page that differs only in the deploy stamps measures as untouched", () => {
    expect(stampedHash("a.html", Buffer.from(page("x", "aaa1111", "1")))).toBe(stampedHash("a.html", Buffer.from(page("x", "bbb2222", "2"))));
    expect(stampedHash("a.html", Buffer.from(page("x", "aaa1111", "1")))).not.toBe(stampedHash("a.html", Buffer.from(page("y", "aaa1111", "1"))));
  });

  test("a schema's build provenance block is a stamp; its content is not", () => {
    const doc = (run: string, title: string) => `{"title":"${title}","staging":{"branch":"main","sha":"${run}abc","pr":"main","run":"${run}"}}`;
    expect(stampedHash("s.json", Buffer.from(doc("1", "x")))).toBe(stampedHash("s.json", Buffer.from(doc("2", "x"))));
    expect(stampedHash("s.json", Buffer.from(doc("1", "x")))).not.toBe(stampedHash("s.json", Buffer.from(doc("1", "y"))));
  });

  test("jekyll-remote-theme temp paths in .css.map and live QA witness timestamps/shas are stamps; real changes are not", () => {
    const map = (tmpDir: string, mapping: string) =>
      `{"version":3,"sources":["file:///tmp/${tmpDir}/_sass/base.scss"],"mappings":"${mapping}"}`;
    expect(stampedHash("assets/css/just-the-docs-default.css.map", Buffer.from(map("jekyll-remote-theme-20261029-4249-5040f6", "AAAA")))).toBe(
      stampedHash("assets/css/just-the-docs-default.css.map", Buffer.from(map("jekyll-remote-theme-20261030-4191-u6fd3s", "AAAA"))),
    );
    expect(stampedHash("assets/css/just-the-docs-default.css.map", Buffer.from(map("jekyll-remote-theme-20261029-4249-5040f6", "AAAA")))).not.toBe(
      stampedHash("assets/css/just-the-docs-default.css.map", Buffer.from(map("jekyll-remote-theme-20261029-4249-5040f6", "BBBB"))),
    );

    const qa = (at: string, sha: string, state: string) =>
      `{"state":"${state}","sidecarLinks":[{"key":"main/${sha}/test/results/a.json","href":"https://github.com/x/y/blob/main/${sha}/test/results/a.json"}],"witnesses":[{"kind":"script","at":"${at}","sha":"${sha}","scriptHash":"abc"}]}`;
    expect(
      stampedHash(
        "assets/qa/x.block.json",
        Buffer.from(qa("2026-10-29T15:32:54.307Z", "5723804889168c3dcbcfe87b06d255d5a9d017ea", "pass")),
      ),
    ).toBe(
      stampedHash(
        "assets/qa/x.block.json",
        Buffer.from(qa("2026-10-29T15:46:40.070Z", "dfc77dc94a6ad979535584ad8774e79a7572de73", "pass")),
      ),
    );
    expect(
      stampedHash(
        "assets/qa/x.block.json",
        Buffer.from(qa("2026-10-29T15:32:54.307Z", "5723804889168c3dcbcfe87b06d255d5a9d017ea", "pass")),
      ),
    ).not.toBe(
      stampedHash(
        "assets/qa/x.block.json",
        Buffer.from(qa("2026-10-29T15:46:40.070Z", "dfc77dc94a6ad979535584ad8774e79a7572de73", "fail")),
      ),
    );
  });

  test("instance graph export commit stamps and state-visualizer build timestamps are stamps; graph/token changes are not", () => {
    const kg = (at: string, sha: string, commitAt: string, nodes: number) =>
      JSON.stringify({
        generatedAt: at,
        sourceCommit: `https://github.com/litlfred/folio-assistant/commit/${sha}`,
        sourceCommitSha: sha,
        sourceCommitAt: commitAt,
        counts: { nodes },
      });
    const sha1 = "1783b00e32494dc2385797dc517699cfe31107f0";
    const sha2 = "7c9a579eeb8de6e4001ec5ca0f7519f64b2c5c3f";
    expect(stampedHash("smart-base/smart-base.json", Buffer.from(kg("2026-10-31T01:19:49.631Z", sha1, "2026-10-31T00:46:23Z", 42)))).toBe(
      stampedHash("smart-base/smart-base.json", Buffer.from(kg("2026-10-31T02:08:48.133Z", sha2, "2026-10-31T03:44:16+01:00", 42))),
    );
    expect(stampedHash("smart-base/smart-base.json", Buffer.from(kg("2026-10-31T01:19:49.631Z", sha1, "2026-10-31T00:46:23Z", 42)))).not.toBe(
      stampedHash("smart-base/smart-base.json", Buffer.from(kg("2026-10-31T02:08:48.133Z", sha2, "2026-10-31T01:47:58Z", 43))),
    );

    const boot = (at: string, sha: string, title: string) =>
      JSON.stringify({ title, generatedAtTime: at, wasDerivedFrom: `git:${sha}` });
    expect(stampedHash("bootstrap/bootstrap.jsonld", Buffer.from(boot("2026-10-31T01:19:33.488Z", sha1, "Bootstrap")))).toBe(
      stampedHash("bootstrap/bootstrap.jsonld", Buffer.from(boot("2026-10-31T02:08:31.887Z", sha2, "Bootstrap"))),
    );
    expect(stampedHash("bootstrap/bootstrap.jsonld", Buffer.from(boot("2026-10-31T01:19:33.488Z", sha1, "Bootstrap")))).not.toBe(
      stampedHash("bootstrap/bootstrap.jsonld", Buffer.from(boot("2026-10-31T02:08:31.887Z", sha2, "Other"))),
    );

    const wf = (at: string, status: string) =>
      `<p class="sv-sub">ages measured at ${at} (when this page was built) against a 7-day threshold.</p>` +
      `<p class="sv-sub">Measured at ${at}, when this page was built; a token unmoved...</p>` +
      `<section data-wv-built="{&quot;at&quot;:&quot;${at}&quot;,&quot;status&quot;:&quot;${status}&quot;}"></section>`;
    expect(stampedHash("en/cat-harness/beans/cat-harness/workflows/x/index.html", Buffer.from(wf("2026-10-31T03:03:12.208Z", "completed")))).toBe(
      stampedHash("en/cat-harness/beans/cat-harness/workflows/x/index.html", Buffer.from(wf("2026-10-31T03:45:37.683Z", "completed"))),
    );
    expect(stampedHash("en/cat-harness/beans/cat-harness/workflows/x/index.html", Buffer.from(wf("2026-10-31T03:03:12.208Z", "completed")))).not.toBe(
      stampedHash("en/cat-harness/beans/cat-harness/workflows/x/index.html", Buffer.from(wf("2026-10-31T03:45:37.683Z", "running"))),
    );
  });

  test("post-#1084 deploy stamps (pins.json self-sha, root-index sha256, site:viz gh-pages state, availability.json source race, and ustar package.tgz mtime) are stamps; content changes are not", () => {
    const sha1 = "aa193439f8961442431731741009911675888111";
    const sha2 = "c27093c3d1d245bc25b3175a8f6f26183079ab6b";
    const pins = (self: string, layer: string) => JSON.stringify({ ".": self, bootstrap: layer }, null, 2);
    expect(stampedHash("pins.json", Buffer.from(pins(sha1, sha1)))).toBe(stampedHash("pins.json", Buffer.from(pins(sha2, sha1))));
    expect(stampedHash("pins.json", Buffer.from(pins(sha1, sha1)))).not.toBe(stampedHash("pins.json", Buffer.from(pins(sha2, sha2))));

    const rootIdx = (nodes: number, bytes: number, sha: string) =>
      JSON.stringify({ "@graph": [{ name: "bootstrap", nodes, bytes, sha256: sha }] }, null, 2);
    const h1 = "116cf67213305989b492e851ae0ef357c90e26b267d3921a7c454e2bc1c0f823";
    const h2 = "584fb94c798dc1df548aa5382e4431400b4beaa12989ab24803667f8c31df8bb";
    expect(stampedHash("index.json", Buffer.from(rootIdx(489, 1358333, h1)))).toBe(
      stampedHash("index.json", Buffer.from(rootIdx(489, 1358340, h2))),
    );
    expect(stampedHash("index.json", Buffer.from(rootIdx(489, 1358333, h1)))).not.toBe(
      stampedHash("index.json", Buffer.from(rootIdx(490, 1358333, h1))),
    );

    const siteViz = (tip: string, apiPages: number, renderLogs: number, previews: number, previewRow: string) =>
      `<p class="m">Tip <code>${tip}</code> · 55 top-level route(s), 12662 page(s) · ${previews} staging preview(s) · 18 file(s) at the root</p>` +
      `<table><thead><tr><th>Route</th><th>Pages</th><th>Files</th></tr></thead><tbody><tr><td><code>_render-log/</code></td><td>0</td><td>${renderLogs}</td></tr><tr><td><code>api/</code></td><td>${apiPages}</td><td>2660</td></tr></tbody></table>` +
      `<table><thead><tr><th>Preview</th><th>Pages</th><th>Files</th></tr></thead><tbody>${previewRow}</tbody></table>`;
    expect(
      stampedHash("en/cat-harness/site/index.html", Buffer.from(siteViz("806c1d062fe5", 2651, 43, 6, "<tr><td>a</td><td>1</td><td>2</td></tr>"))),
    ).toBe(
      stampedHash("en/cat-harness/site/index.html", Buffer.from(siteViz("0486e13b5abc", 2651, 44, 5, "<tr><td>b</td><td>3</td><td>4</td></tr>"))),
    );
    expect(
      stampedHash("en/cat-harness/site/index.html", Buffer.from(siteViz("806c1d062fe5", 2651, 43, 6, "<tr><td>a</td><td>1</td><td>2</td></tr>"))),
    ).not.toBe(
      stampedHash("en/cat-harness/site/index.html", Buffer.from(siteViz("0486e13b5abc", 2652, 44, 5, "<tr><td>b</td><td>3</td><td>4</td></tr>"))),
    );

    const availCheckout = JSON.stringify({
      $schema: "folio-qa-availability/v1",
      source: "checkout",
      requested: ["main/<sha>", "main"],
      reason: "no exact entry for main/<sha> on `qa-reports`; the checkout already holds the QA corpus",
      expected: { witnesses: 17, results: 19 },
      published: { witnesses: 17, results: 20 },
    });
    const availFetched = JSON.stringify({
      $schema: "folio-qa-availability/v1",
      source: "fetched",
      requested: ["main/<sha>", "main"],
      key: "main/<sha>",
      reason: "fetched exact entry `main/<sha>` from `qa-reports`",
      expected: { witnesses: 17, results: 19 },
      published: { witnesses: 17, results: 20 },
    });
    const availUnavailable = JSON.stringify({
      $schema: "folio-qa-availability/v1",
      source: "unavailable",
      requested: ["main/<sha>", "main"],
      reason: "missing",
      expected: { witnesses: 17, results: 19 },
      published: { witnesses: 17, results: 20 },
    });
    expect(stampedHash("assets/qa/availability.json", Buffer.from(availCheckout))).toBe(
      stampedHash("assets/qa/availability.json", Buffer.from(availFetched)),
    );
    expect(stampedHash("assets/qa/availability.json", Buffer.from(availCheckout))).not.toBe(
      stampedHash("assets/qa/availability.json", Buffer.from(availUnavailable)),
    );

    const igIdx = (bytes: number, artifacts: number) =>
      JSON.stringify({ package: { localPath: "fhir-artifact-index/package.tgz", bytes }, artifacts }, null, 2);
    expect(stampedHash("smart-base/fhir-artifact-index/index.json", Buffer.from(igIdx(1218748, 230)))).toBe(
      stampedHash("smart-base/fhir-artifact-index/index.json", Buffer.from(igIdx(1218804, 230))),
    );
    expect(stampedHash("smart-base/fhir-artifact-index/index.json", Buffer.from(igIdx(1218748, 230)))).not.toBe(
      stampedHash("smart-base/fhir-artifact-index/index.json", Buffer.from(igIdx(1218804, 231))),
    );

    const makeTarGz = (mtimeOctal: string, payload: string): Buffer => {
      const tar = Buffer.alloc(1024, 0);
      tar.write("package/package.json", 0, "ascii");
      tar.write( payload.length.toString(8).padStart(11, "0") + "\0", 124, "ascii");
      tar.write(mtimeOctal.padStart(11, "0") + "\0", 136, "ascii");
      tar.write("012345\0 ", 148, "ascii");
      tar.write("ustar\0", 257, "ascii");
      tar.write(payload, 512, "utf-8");
      return gzipSync(tar);
    };
    expect(stampedHash("smart-base/fhir-artifact-index/package.tgz", makeTarGz("15267205120", "{\"name\":\"a\"}"))).toBe(
      stampedHash("smart-base/fhir-artifact-index/package.tgz", makeTarGz("15267211023", "{\"name\":\"a\"}")),
    );
    expect(stampedHash("smart-base/fhir-artifact-index/package.tgz", makeTarGz("15267205120", "{\"name\":\"a\"}"))).not.toBe(
      stampedHash("smart-base/fhir-artifact-index/package.tgz", makeTarGz("15267211023", "{\"name\":\"b\"}")),
    );
  });

  test("compares the main site only: other previews, the render log and build.json are left out", () => {
    const before = site("m-before", {
      "a.html": page("x", "aaa", "1"),
      "b.html": page("old", "aaa", "1"),
      "gone.html": page("g", "aaa", "1"),
      "STAGING/pr/a.html": "preview",
      "_render-log/x.txt": "log",
      "build.json": '{"sha":"aaa"}',
    });
    const after = site("m-after", {
      "a.html": page("x", "bbb", "2"),
      "b.html": page("new", "bbb", "2"),
      "c.json": "{}",
      "build.json": '{"sha":"bbb"}',
    });
    expect(measureDeploy(before, after).map((f) => `${f.change} ${f.path}`)).toEqual(["changed b.html", "added c.json", "removed gone.html"]);
  });
});

describe("judge", () => {
  const measured = [
    { path: "assets/beans/index.json", change: "changed" as const, role: "data" as const, via: [] },
    { path: "en/beans/index.html", change: "changed" as const, role: "content" as const, via: [] },
  ];

  test("a determined cone that covers every measured file is cone-safe", () => {
    const d = judge({ predicted: impact(["assets/beans/index.json", "en/beans/index.html", "extra.json"]), sources: { repins: [] }, doubts: [], measured });
    expect(d.verdict).toBe("cone-safe");
    expect(d.unconfirmed).toBe(1);
    expect(d.pages).toBe(1);
  });

  test("a determined cone that misses a measured file is cone-unsafe, and names it", () => {
    const d = judge({ predicted: impact(["assets/beans/index.json"]), sources: { repins: [] }, doubts: [], measured });
    expect(d.verdict).toBe("cone-unsafe");
    expect(d.missed).toEqual([{ path: "en/beans/index.html", change: "changed" }]);
    expect(summary(d)).toContain("en/beans/index.html");
  });

  test("any doubt falls back to the full build, whatever the measurement", () => {
    const covered = impact(["assets/beans/index.json", "en/beans/index.html"]);
    expect(judge({ predicted: impact([], [{ input: "_config.yml", reason: "site-wide" }]), sources: undefined, doubts: [], measured }).verdict).toBe("full");
    expect(judge({ predicted: covered, sources: { repins: [{ instance: "x", files: null, doubt: "unreadable" }] }, doubts: [], measured }).verdict).toBe("full");
    expect(judge({ predicted: covered, sources: undefined, doubts: ["no tip"], measured }).verdict).toBe("full");
    expect(judge({ predicted: undefined, sources: undefined, doubts: [], measured }).verdict).toBe("full");
  });

  test("no input since the deploy is an empty cone: safe only when the build changed nothing", () => {
    expect(judge({ predicted: undefined, sources: { repins: [] }, doubts: [], measured: [], noInputs: true }).verdict).toBe("cone-safe");
    expect(judge({ predicted: undefined, sources: { repins: [] }, doubts: [], measured, noInputs: true }).verdict).toBe("cone-unsafe");
  });

  test("split search indices under assets/js/search/*.json are covered when assets/js/search-data.json is predicted, and missed otherwise", () => {
    const withSearchSplit = [
      { path: "guides/onboarding.html", change: "changed" as const, role: "content" as const, via: [] },
      { path: "assets/js/search-data.json", change: "changed" as const, role: "index" as const, via: [] },
      { path: "assets/js/search/manifest.json", change: "changed" as const, role: "index" as const, via: [] },
      { path: "assets/js/search/_platform.json", change: "changed" as const, role: "index" as const, via: [] },
      { path: "assets/js/search/_platform.idx.json", change: "changed" as const, role: "index" as const, via: [] },
    ];
    const ok = judge({
      predicted: impact(["guides/onboarding.html", "assets/js/search-data.json"]),
      sources: { repins: [] },
      doubts: [],
      measured: withSearchSplit,
    });
    expect(ok.verdict).toBe("cone-safe");
    expect(ok.missed).toEqual([]);

    const bad = judge({
      predicted: impact(["assets/css/docs-ui.css"]),
      sources: { repins: [] },
      doubts: [],
      measured: [{ path: "assets/js/search/manifest.json", change: "changed", role: "index", via: [] }],
    });
    expect(bad.verdict).toBe("cone-unsafe");
    expect(bad.missed).toEqual([{ path: "assets/js/search/manifest.json", change: "changed" }]);
  });
});
