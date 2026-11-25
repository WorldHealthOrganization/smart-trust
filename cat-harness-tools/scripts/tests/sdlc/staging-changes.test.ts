/**
 * The staging preview's changes page: sources (with re-pins expanded), the
 * predicted cone, and the QA diff against the publish root.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { RENDERED_IMPACT_TAG, RenderedImpactSchema } from "../../../schemas/ui/rendered-impact.js";
import {
  collectSources,
  coneInputs,
  type Differ,
  expandRepins,
  foldBase,
  type Lock,
  measureSites,
  mergeImpacts,
  mountedPath,
  pageBody,
  parseChangedList,
  pageSources,
  parseNameStatus,
  predictByProvenance,
  provenanceIndex,
  qaCheck,
  renderPage,
} from "../../staging-changes.js";

const lock = (sha: string, extra: Lock["instances"] = []): Lock => ({
  instances: [
    { instance: "mounted-layer", repository: "o/mounted-layer", sha, directories: [{ path: "mounted-layer/processes", upstreamPath: "mounted-layer/processes" }, { path: "mounted-layer/library", upstreamPath: "mounted-layer/library" }] },
    { instance: "tools", repository: "o/tools", sha: "t1", directories: [{ path: "tools", upstreamPath: "." }] },
    ...extra,
  ],
});

describe("mountedPath", () => {
  test("maps through the longest declared directory, and a root mount", () => {
    const dirs = [{ path: "x", upstreamPath: "." }, { path: "x/deep", upstreamPath: "a/b" }];
    expect(mountedPath("a/b/c.md", dirs)).toBe("x/deep/c.md");
    expect(mountedPath("z.md", dirs)).toBe("x/z.md");
    expect(mountedPath("q.md", [{ path: "m", upstreamPath: "only" }])).toBeUndefined();
  });
});

describe("expandRepins", () => {
  const differ: Differ = (repo, from, to) => {
    expect([repo, from, to]).toEqual(["o/mounted-layer", "s1", "s2"]);
    return [
      { status: "modified", path: "mounted-layer/processes/a.bpmn" },
      { status: "renamed", from: "mounted-layer/library/old.md", path: "mounted-layer/library/new.md" },
      { status: "modified", path: "input/fsh/x.fsh" },
    ];
  };
  test("a moved pin becomes its files at their mount paths; an unmoved one contributes nothing", () => {
    const { repins, changes } = expandRepins(lock("s1"), lock("s2"), differ);
    expect(repins).toEqual([{ instance: "mounted-layer", repository: "o/mounted-layer", from: "s1", to: "s2", files: 3 }]);
    expect(changes.map((c) => [c.path, c.status, c.mounted])).toEqual([
      ["mounted-layer/processes/a.bpmn", "modified", true],
      ["mounted-layer/library/new.md", "renamed", true],
      ["input/fsh/x.fsh", "modified", false],
    ]);
    expect(changes[1].from).toBe("mounted-layer/library/old.md");
  });
  test("a pin that cannot be diffed is said, never dropped", () => {
    const { repins, changes } = expandRepins(lock("s1"), lock("s2"), () => {
      throw new Error("fetch refused");
    });
    expect(changes).toEqual([]);
    expect(repins[0].files).toBeNull();
    expect(repins[0].doubt).toContain("fetch refused");
  });
  test("a newly mounted instance is a doubt, not an empty list", () => {
    const { repins } = expandRepins(lock("s1"), lock("s1", [{ instance: "new", repository: "o/new", sha: "n1" }]), differ);
    expect(repins).toEqual([expect.objectContaining({ instance: "new", from: null, to: "n1", files: null })]);
  });
});

describe("collectSources", () => {
  test("expands only when the lock is in the branch's list, and says so when its base is missing", () => {
    const differ: Differ = () => [{ status: "added", path: "mounted-layer/processes/b.bpmn" }];
    const s = collectSources({ repository: "o/fa", changed: "modified\tindex.lock.json\nadded\tdocs/x.md\n", base: lock("s1"), headLock: lock("s2"), differ });
    expect(s.changes.map((c) => c.path)).toEqual(["index.lock.json", "docs/x.md", "mounted-layer/processes/b.bpmn"]);
    expect(coneInputs(s)).toEqual(["docs/x.md", "index.lock.json", "mounted-layer/processes/b.bpmn"]);
    const noBase = collectSources({ repository: "o/fa", changed: "index.lock.json", headLock: lock("s2"), differ });
    expect(noBase.repins[0].doubt).toContain("not expanded");
    const noLock = collectSources({ repository: "o/fa", changed: "docs/x.md", base: lock("s1"), headLock: lock("s2"), differ });
    expect(noLock.repins).toEqual([]);
  });
  test("parses both list shapes and git's name-status", () => {
    expect(parseChangedList("a.md\nrenamed\tb.md\told.md\n")).toEqual([{ path: "a.md", status: "changed" }, { path: "b.md", status: "renamed", from: "old.md" }]);
    expect(parseNameStatus("M\ta\nA\tb\nD\tc\nR087\td\te\n")).toEqual([
      { status: "modified", path: "a" },
      { status: "added", path: "b" },
      { status: "removed", path: "c" },
      { status: "renamed", from: "d", path: "e" },
    ]);
  });
});

describe("the QA diff against the publish root", () => {
  const T = mkdtempSync(join(tmpdir(), "staging-changes-"));
  afterAll(() => rmSync(T, { recursive: true, force: true }));
  const put = (rel: string, body: string) => {
    mkdirSync(dirname(join(T, rel)), { recursive: true });
    writeFileSync(join(T, rel), body);
  };
  const page = (base: string, nav: string, body: string) => `<html><nav>${nav}<a href="${base}/x.html">x</a></nav><main><a href="${base}/y.html">y</a>${body}</main><footer>${nav}</footer></html>`;
  // Root: main's site, plus another preview and the render log.
  put("pages/index.html", page("/r", "sha:aaa", "home"));
  put("pages/a.html", page("/r", "sha:aaa", "A"));
  put("pages/b.html", page("/r", "sha:aaa", "B"));
  put("pages/ref/one.html", page("/r", "sha:aaa", "ref"));
  put("pages/build.json", JSON.stringify({ sha: "base1" }));
  put("pages/STAGING/other/a.html", "theirs");
  put("pages/_render-log/1.json", "{}");
  // Preview: a changed (predicted), b changed (NOT predicted), index same body but other chrome, ref/ not carried, the job's own files.
  put("site/index.html", page("/r/STAGING/s", "branch:feat", "home"));
  put("site/a.html", page("/r/STAGING/s", "branch:feat", "A2"));
  put("site/b.html", page("/r/STAGING/s", "branch:feat", "B2"));
  put("site/build.json", JSON.stringify({ sha: "base1" }));
  put("site/changes/index.html", "page");
  put("site/rendered-impact.json", "[]");

  test("folds the base, compares the body only, and leaves out other previews and the job's files", () => {
    expect(foldBase("/r/STAGING/s/a /r/STAGING/s", "/r/STAGING/s/", "/r")).toBe("/r/a /r");
    expect(pageBody("<p>x</p><main id=m>y</main>z")).toBe("<main id=m>y");
    const m = measureSites({ before: join(T, "pages"), after: join(T, "site"), rule: { stagingBase: "/r/STAGING/s", siteBase: "/r" } });
    expect(m.files.map((f) => [f.path, f.change])).toEqual([
      ["a.html", "changed"],
      ["b.html", "changed"],
      ["ref/one.html", "removed"],
    ]);
  });

  test("sorts the measurement into not-in-cone, confirmed, unconfirmed and absent", () => {
    const m = measureSites({ before: join(T, "pages"), after: join(T, "site"), rule: { stagingBase: "/r/STAGING/s", siteBase: "/r" } });
    const predicted = RenderedImpactSchema.parse({
      $schema: RENDERED_IMPACT_TAG,
      renderer: "docs-site",
      method: "cone",
      files: [
        { path: "a.html", change: "changed", role: "content", via: ["docs/a.md"] },
        { path: "c.json", change: "changed", role: "data" },
      ],
    });
    const qa = qaCheck(predicted, m, "base1", "base1");
    expect(qa.status).toBe("known");
    expect(qa.notInCone.map((f) => f.path)).toEqual(["b.html"]);
    expect(qa.confirmed).toEqual(["a.html"]);
    expect(qa.unconfirmed).toEqual([{ path: "c.json", role: "data" }]);
    expect(qa.absent).toEqual([{ dir: "ref", count: 1, sample: ["ref/one.html"] }]);
    expect(qaCheck(predicted, m, "old", "base1").status).toBe("not-base");

    const html = renderPage({
      sources: { $schema: "staging-changes/v1", repository: "o/fa", head: "abcdef1234", changes: [{ path: "docs/a.md", status: "modified", repository: "o/fa", upstreamPath: "docs/a.md", ref: "abcdef1234", mounted: true }], repins: [] },
      predicted,
      qa,
      siteUrl: "https://o.github.io/r/",
      stagingUrl: "https://o.github.io/r/STAGING/s/",
      branch: "feat<x>",
      slug: "s",
      generatedAt: "now",
    });
    expect(html).toContain("feat&lt;x&gt;");
    expect(html).toContain('href="https://o.github.io/r/STAGING/s/b.html"');
    expect(html).toContain('href="https://github.com/o/fa/blob/abcdef1234/docs/a.md"');
    expect(html).toMatch(/Changed, but not in the dependency cone <span class="muted">\(1\)/);
  });

  test("no prediction and no root are 'not known', never 'nothing'", () => {
    const html = renderPage({
      sources: { $schema: "staging-changes/v1", repository: "o/fa", changes: [], repins: [] },
      qaAbsent: "no root",
      siteUrl: "https://o.github.io/r/",
      stagingUrl: "https://o.github.io/r/STAGING/s/",
      branch: "b",
      slug: "s",
      generatedAt: "now",
    });
    expect(html).toContain("Not known: this build wrote no prediction");
    expect(html).toContain("Not measured: no root");
  });
});

describe("prediction by provenance", () => {
  const T = mkdtempSync(join(tmpdir(), "staging-prov-"));
  afterAll(() => rmSync(T, { recursive: true, force: true }));
  const put = (rel: string, body: string) => {
    mkdirSync(dirname(join(T, rel)), { recursive: true });
    writeFileSync(join(T, rel), body);
  };
  put("root/processes/a.html", '<main><p>Generated from <code class="x">mounted-layer/processes/a.bpmn</code> by render</p></main>');
  put("root/reference/a.html", '<main><p>Generated from <a href="https://x/blob/main/mounted-layer/skills/a.md"><code>mounted-layer/skills/a.md</code></a></p><a data-src="mounted-layer/skills/a.md">edit</a></main>');
  put("root/reference/b.html", '<main><a data-src="mounted-layer/skills/b.md">edit</a></main>');
  put("root/index.html", "<main>no provenance</main>");
  put("root/STAGING/other/reference/a.html", '<a data-src="mounted-layer/skills/a.md">x</a>');

  test("reads both provenance forms, and never another preview", () => {
    expect(pageSources('Generated from <code>x/y.md</code> <a data-src="./z.md">')).toEqual(["x/y.md", "z.md"]);
    const ix = provenanceIndex(join(T, "root"));
    expect(ix.get("mounted-layer/skills/a.md")).toEqual(["reference/a.html"]);
    expect(ix.get("mounted-layer/processes/a.bpmn")).toEqual(["processes/a.html"]);
  });

  test("a changed source predicts its pages; a removed one removes them; an unmounted one predicts nothing", () => {
    const ix = provenanceIndex(join(T, "root"));
    const src = (path: string, status: "modified" | "removed", mounted = true) => ({ path, status, repository: "o/sb", upstreamPath: path, mounted });
    const p = predictByProvenance(
      { $schema: "staging-changes/v1", repository: "o/fa", repins: [], changes: [src("mounted-layer/skills/a.md", "modified"), src("mounted-layer/skills/b.md", "removed"), src("mounted-layer/processes/a.bpmn", "modified", false)] },
      ix,
    );
    expect(p.files.map((f) => [f.path, f.change, f.via])).toEqual([
      ["reference/a.html", "changed", ["mounted-layer/skills/a.md"]],
      ["reference/b.html", "removed", ["mounted-layer/skills/b.md"]],
    ]);
    const merged = mergeImpacts([p, { ...p, renderer: "docs-site", files: [{ path: "reference/a.html", change: "changed", role: "content", via: ["x.md"] }] }]);
    expect(merged.files.find((f) => f.path === "reference/a.html")!.via).toEqual(["mounted-layer/skills/a.md", "x.md"]);
  });
});
