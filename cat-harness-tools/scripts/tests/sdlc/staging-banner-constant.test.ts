/**
 * The staging banner is CONSTANT across pages and across rebuilds. Bean `g196`.
 *
 * ## What is pinned, and why it is this rather than "the banner looks right"
 *
 * The bean's whole claim is a storage one: 9 previews took **346.1 MB** of
 * `gh-pages` and **zero HTML blobs were shared between any two previews**,
 * because the commit SHA and a `date -u` build timestamp were baked into all
 * ~530 pages. Since the timestamp changes every run, each re-push added
 * ~27.5 MB of permanently new objects — the history grew even when the
 * preview count did not.
 *
 * So the property that matters is **byte equality**, and the test that earns
 * its place is the one that runs two builds with DIFFERENT facts and compares
 * the emitted HTML. A test asserting the markup contains some string would
 * pass just as happily with the SHA still in it.
 *
 * ## The positive control
 *
 * `staging.json` must still DIFFER between those two runs — otherwise the
 * facts went nowhere and the banner is constant because it is empty. Both
 * halves are asserted together for that reason.
 */
import { describe, test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { repoRootFor, siteFileFor } from "../../../schemas/kg/cat-harness.js";
import {
  run,
  injectInto,
  previewRootOf,
  FRAGMENT,
  CLIENT,
  LOADER,
  BANNER_SCRIPT,
  type StagingFacts,
} from "../../staging-banner.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const PAGES = [
  "index.html",
  "guides/agent-onboarding.html",
  "reference/skills/deep/nested/page.html",
];

function build(facts: Partial<StagingFacts>): { dir: string; html: Map<string, string>; json: string } {
  const dir = mkdtempSync(join(tmpdir(), "fa-staging-"));
  for (const p of PAGES) {
    const full = join(dir, p);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, `<html><body class="x">\n<h1>${p}</h1>\n</body></html>`);
  }
  run(dir, {
    branch: "claude/example",
    sha: "aaaaaaa",
    built: "2026-09-20T10:00:00Z",
    pr: "1",
    prUrl: "https://github.com/o/r/pull/1",
    branchUrl: "https://github.com/o/r/tree/claude/example",
    issue: null,
    issueUrl: null,
    runUrl: "https://github.com/o/r/actions/runs/1",
    mainSite: "https://o.github.io/r",
    mainPagesKnown: true,
    newPages: [],
    ...facts,
  });
  const html = new Map(PAGES.map((p) => [p, readFileSync(join(dir, p), "utf-8")]));
  const json = readFileSync(join(dir, "staging.json"), "utf-8");
  return { dir, html, json };
}

describe("the build type is a fact in staging.json, never in the pages (owner, 2026-11-01)", () => {
  const p = build({ buildType: "preview" });
  const f = build({ buildType: "full" });

  test("staging.json names it, so `pc:release freeze` can refuse a preview", () => {
    expect(JSON.parse(p.json).buildType).toBe("preview");
    expect(JSON.parse(f.json).buildType).toBe("full");
  });

  test("the pages are byte-identical across build types", () => {
    for (const page of PAGES) expect(p.html.get(page)).toBe(f.html.get(page));
  });
});

describe("the injected HTML does not depend on the build — bean `g196`", () => {
  const a = build({ sha: "aaaaaaa", built: "2026-09-20T10:00:00Z" });
  const b = build({ sha: "bbbbbbb", built: "2026-09-20T18:30:00Z", pr: "999" });

  test("two builds with different SHA, timestamp and PR emit BYTE-IDENTICAL pages", () => {
    // The whole bean in one assertion. Any per-build fact that leaks back into
    // the page fails here, whatever it is and however it is spelled.
    for (const p of PAGES) expect(b.html.get(p)).toBe(a.html.get(p)!);
  });

  test("...and staging.json DOES differ, so the facts went somewhere", () => {
    // Positive control: without this, a banner that dropped the facts entirely
    // would pass the test above.
    expect(b.json).not.toBe(a.json);
    expect(JSON.parse(b.json).sha).toBe("bbbbbbb");
    expect(JSON.parse(a.json).sha).toBe("aaaaaaa");
  });

  test("the CI results link rides in staging.json, never in the page", () => {
    // The preview does not wait for CI, so it links to where the results
    // appear. Per-build, so it belongs with the facts, not in the markup.
    const c = build({ checksUrl: "https://github.com/o/r/pull/1/checks" });
    expect(JSON.parse(c.json).checksUrl).toBe("https://github.com/o/r/pull/1/checks");
    expect(c.html.get("index.html")).not.toContain("/pull/1/checks");
    expect(c.html.get("index.html")).toBe(a.html.get("index.html"));
    expect(CLIENT).toContain("f.checksUrl");
    rmSync(c.dir, { recursive: true, force: true });
  });

  test("every page in one build carries the SAME fragment, at any depth", () => {
    // `reference/skills/deep/nested/page.html` is four levels down. A
    // document-relative `<script src>` would differ here, which is why the
    // loader derives the preview root from the path instead.
    for (const p of PAGES) expect(a.html.get(p)).toContain(FRAGMENT);
  });

  test("no build fact appears in the page at all", () => {
    const page = a.html.get("index.html")!;
    for (const leaked of ["aaaaaaa", "2026-09-20T10:00:00Z", "claude/example", "o.github.io"]) {
      expect(page).not.toContain(leaked);
    }
  });

  for (const d of [a, b]) rmSync(d.dir, { recursive: true, force: true });
});

describe("the client is served once per preview, not inlined in every page (fhir-harness#325)", () => {
  test("run() writes it at the preview root, beside staging.json", () => {
    const a = build({});
    expect(readFileSync(join(a.dir, BANNER_SCRIPT), "utf-8")).toBe(CLIENT + "\n");
    rmSync(a.dir, { recursive: true, force: true });
  });

  test("the page carries only the loader: the fragment is a small fraction of the client", () => {
    expect(FRAGMENT).toContain(`<script>${LOADER}</script>`);
    expect(FRAGMENT).not.toContain("function fill(");
    expect(FRAGMENT.length).toBeLessThan(1500);
    expect(CLIENT.length).toBeGreaterThan(FRAGMENT.length * 4);
  });

  test("the loader names the client from the preview root, and states a failure to load it", () => {
    expect(LOADER).toContain(`m[1]+'${BANNER_SCRIPT}'`);
    expect(LOADER).toMatch(/s\.onerror=function\(\)\{[^}]*build details unavailable/);
    // Off a preview path it says so without loading anything.
    expect(LOADER).toContain("not served from a preview path");
  });
});

describe("a failed fetch still says PREVIEW — the third-state rule", () => {
  test("the STATIC markup announces the branch before any fetch happens", () => {
    // The banner exists so a reviewer cannot mistake staged content for the
    // published site. If `staging.json` is missing or unreadable the page must
    // still announce itself: "could not determine" is never rendered as "this
    // is the real site", and here the failure mode is a reviewer approving the
    // wrong artefact.
    expect(FRAGMENT).toContain("FEATURE BRANCH");
    // ...and it is in the markup, not produced by the script.
    const staticHalf = FRAGMENT.slice(0, FRAGMENT.indexOf("<script"));
    expect(staticHalf).toContain("FEATURE BRANCH");
  });

  test("the CATCH path specifically degrades to a stated unavailability", () => {
    // Scoped to the catch body rather than to the whole fragment. A plain
    // `toContain("build details unavailable")` over FRAGMENT passes even with
    // the catch path emptied, because the not-under-STAGING branch carries a
    // message of its own — found by ratcheting this very test, which stayed
    // green while the browser test went red.
    // The catch of the `staging.json` fetch, not the first catch in the
    // fragment: the live staleness check (#1076) has its own, which is
    // silent on purpose, since a failed GitHub request must not guess.
    const m = CLIENT.match(/fetch\(r\+'staging\.json'[\s\S]*?\.catch\(function\(\)\{([^}]*)\}\)/);
    expect(m).not.toBe(null);
    expect(m![1]).toContain("build details unavailable");
  });
});

describe("values from the JSON are never concatenated into markup", () => {
  test("the client builds nodes and sets textContent", () => {
    // Git ref names MAY contain `<`, `>` and `"` — they are not in git's
    // forbidden set, which stops at space, `~`, `^`, `:`, `?`, `*`, `[`, `\`
    // and the control characters. A branch name concatenated into HTML is
    // therefore attacker-influenced markup. The old bash banner interpolated
    // `$BRANCH` into a string; this one must not.
    const client = CLIENT;
    expect(client).toContain("textContent");
    expect(client).not.toMatch(/innerHTML\s*=/);
  });
});

describe("the preview root is derived from the path, not baked in", () => {
  test.each([
    ["/folio-assistant/STAGING/my-branch/index.html", "/folio-assistant/STAGING/my-branch/"],
    ["/folio-assistant/STAGING/my-branch/a/b/c.html", "/folio-assistant/STAGING/my-branch/"],
    ["/STAGING/x/", "/STAGING/x/"],
    // `branches/` since 2026-11-05; `STAGING/` above is still read.
    ["/folio-assistant/branches/my-branch/a/b/c.html", "/folio-assistant/branches/my-branch/"],
    ["/branches/x/", "/branches/x/"],
  ])("%s -> %s", (pathname, expected) => {
    expect(previewRootOf(pathname)).toBe(expected);
  });

  test("a path that is not under STAGING/ gives null rather than a guess", () => {
    // Served from somewhere that is not a preview, the banner says so instead
    // of fetching a `staging.json` that would belong to someone else.
    expect(previewRootOf("/folio-assistant/index.html")).toBe(null);
  });

  test("the SHIPPED regex is the one tested here, so they cannot drift", () => {
    // `stripLeanComments` was implemented six times in this repository and
    // three of the copies were broken (bean `bqrg`). The client half is a
    // string, so it cannot import `previewRootOf` — this pins them equal
    // instead.
    // Greedy to the LAST `/` before the closing paren: the pattern itself
    // contains escaped separators, so a non-greedy match stops inside it.
    // Both copies: the loader's, which finds the client, and the client's,
    // which finds `staging.json`.
    for (const src of [LOADER, CLIENT]) {
      const shipped = src.match(/location\.pathname\.match\((\/.*\/)\)/);
      expect(shipped).not.toBe(null);
      const client = new RegExp(shipped![1]!.slice(1, -1));
      for (const p of ["/a/STAGING/b/c.html", "/STAGING/x/", "/a/branches/b/c.html", "/branches/x/", "/nope/index.html"]) {
        expect(client.exec(p)?.[1] ?? null).toBe(previewRootOf(p));
      }
    }
  });
});

describe("injection mechanics carried over from the bash version", () => {
  test("the WHOLE opening tag is matched, so attributes survive", () => {
    // Matching `<body` alone re-emitted `<body>` and left the original tag's
    // own `>` behind: every staged page carried a stray `>`, and a `<body>`
    // with attributes came out as `<body>BANNER class="…"">` — attributes
    // orphaned as visible text and the real tag stripped of them.
    const { html: out, outcome } = injectInto(`<html><body class="a" id="b">x</body></html>`);
    expect(outcome).toBe("injected");
    expect(out).toContain(`<body class="a" id="b">`);
    expect(out).not.toContain(`">x`);
    expect(out.indexOf(FRAGMENT)).toBe(out.indexOf(`<body class="a" id="b">`) + `<body class="a" id="b">`.length);
  });

  test("a second pass is a no-op rather than a doubled banner", () => {
    const once = injectInto(`<html><body>x</body></html>`).html;
    const twice = injectInto(once);
    expect(twice.html).toBe(once);
    expect(twice.outcome).toBe("already");
  });

  test("a page that only NAMES the attribute (the review page's CSS) still gets the banner", () => {
    const page = `<html><head><style>[data-fa-staging-banner]{display:none}</style></head><body><script>q("[data-fa-staging-banner]")</script>x</body></html>`;
    const r = injectInto(page);
    expect(r.outcome).toBe("injected");
    expect(injectInto(r.html).outcome).toBe("already");
  });
});

/* ── A COMMENT ABOUT THE BANNER BROKE THE BANNER ──────────────────────────
 *
 * Owner, 2026-09-21, with two screenshots: *"staging banner gone from f-a"* —
 * present on a `who-iris` page, absent on the folio-assistant landing page of
 * the same preview.
 *
 * `docs/_includes/head_custom.html` sits in the `<head>` of every
 * just-the-docs page and contains, as PROSE, the sentence
 *
 *     A browser hoists a stray `<div>` into `<body>` and the code still works
 *
 * so the first `<body>` in the document was inside an HTML comment. The
 * non-global `replace` spent its one substitution there and the real tag,
 * hundreds of lines later, got nothing. `who-iris` pages are generated
 * without that include, which is why half the preview worked and the failure
 * read as a `who-iris` feature.
 *
 * MEASURED ON THE DEPLOYED TREE rather than inferred: of 670 staged pages,
 * 347 carried the banner correctly and **323 carried it inside a comment** —
 * 48 % of the preview, invisible, while the injector reported all 670 as
 * injected.
 */
describe("the banner goes in the BODY, not in a comment that mentions one", () => {
  test("a commented `<body>` before the real one does not absorb the banner", () => {
    const page = "<html><head><!-- hoists a stray div into <body> --></head><body>x</body></html>";
    const { html: out, outcome } = injectInto(page);
    expect(outcome).toBe("injected");
    // Inside the comment is where it used to land.
    expect(out.indexOf(FRAGMENT)).toBeGreaterThan(out.indexOf("-->"));
    expect(out).toContain(`<body>${FRAGMENT}`);
  });

  test("a Liquid-commented `<body>` in an unrendered include does not absorb the banner", () => {
    const page = "<html><head>{%- comment -%} hoists a stray div into <body> {%- endcomment -%}</head><body>x</body></html>";
    const { html: out, outcome } = injectInto(page);
    expect(outcome).toBe("injected");
    expect(out.indexOf(FRAGMENT)).toBeGreaterThan(out.indexOf("endcomment -%}"));
    expect(out).toContain(`<body>${FRAGMENT}`);
  });

  test("THE WITNESS — the real head_custom.html, which is what actually broke", () => {
    // A matcher proven only against fixtures is proven against its author's
    // idea of the file. This reads the include that shipped the defect and
    // builds a page the way Jekyll does, so the test fails if that sentence
    // comes back or another one like it is added.
    // `siteDirFor`, never a literal: the site root is one answer and this
    // file is not allowed to be a second one — which `check:site-root` holds.
    //
    // The INSTANCE root, not the repository root: this include belongs to
    // `cat-harness`, whose site dir is its own. `repoRootFor` would hand back
    // the checkout and resolve to a `docs/` that is not there.
    const instance = resolve(HARNESS_ROOT);
    const include = readFileSync(
      join(instance, siteFileFor(instance, "_includes/head_custom.html")),
      "utf-8",
    );
    // The premise of the test, asserted: if the include stops containing a
    // commented `<body>` this case is vacuous and should say so.
    expect(include).toMatch(/<body/i);

    const page = `<html><head>${include}</head><body class="x">content</body></html>`;
    const { html: out, outcome } = injectInto(page);
    expect(outcome).toBe("injected");
    expect(out).toContain(`<body class="x">${FRAGMENT}`);
  });

  test("a document with NO body is a reported state, not a silent success", () => {
    // The third state. It used to be indistinguishable from a successful
    // injection, because the only question asked was whether the bytes
    // changed.
    const { html: out, outcome } = injectInto("<html><head></head></html>");
    expect(outcome).toBe("no-body");
    expect(out).not.toContain("data-fa-staging-banner");
  });

  test("a `<body>` that appears ONLY inside a comment is no body at all", () => {
    const { outcome } = injectInto("<html><!-- <body> --></html>");
    expect(outcome).toBe("no-body");
  });

  test("run() reports the pages it could not place a banner in", () => {
    const dir = mkdtempSync(join(tmpdir(), "fa-staging-nb-"));
    writeFileSync(join(dir, "good.html"), "<html><body>x</body></html>");
    writeFileSync(join(dir, "bad.html"), "<html><head><!-- <body> --></head></html>");
    const out = run(dir, {
      branch: "b", sha: "s", built: "t", pr: "1",
      prUrl: "u", branchUrl: "u", issue: null, issueUrl: null,
      runUrl: "u", mainSite: "m", mainPagesKnown: false, newPages: [],
    });
    expect(out.injected).toBe(1);
    expect(out.noBody).toEqual(["bad.html"]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a bodiless meta-refresh stub is counted as a redirect, not a page with no banner", () => {
    const dir = mkdtempSync(join(tmpdir(), "fa-staging-rd-"));
    writeFileSync(
      join(dir, "stub.html"),
      '<!doctype html>\n<meta charset="utf-8">\n<title>Catalogue</title>\n<meta http-equiv="refresh" content="0; url=../../catalogue/">\n<link rel="canonical" href="../../catalogue/">\n',
    );
    writeFileSync(join(dir, "bad.html"), "<html><head></head></html>");
    const out = run(dir, {
      branch: "b", sha: "s", built: "t", pr: "1",
      prUrl: "u", branchUrl: "u", issue: null, issueUrl: null,
      runUrl: "u", mainSite: "m", mainPagesKnown: false, newPages: [],
    });
    expect(out.redirects).toBe(1);
    expect(out.noBody).toEqual(["bad.html"]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("newPages is the SHORT list, and absent is not empty", () => {
  test("a page missing from the publish ref lands in newPages; one present does not", () => {
    const dir = mkdtempSync(join(tmpdir(), "fa-staging-np-"));
    for (const p of PAGES) {
      mkdirSync(join(dir, p, ".."), { recursive: true });
      writeFileSync(join(dir, p), "<html><body>x</body></html>");
    }
    run(dir, {
      branch: "b", sha: "s", built: "t", pr: "1",
      prUrl: "u", branchUrl: "u", issue: null, issueUrl: null, runUrl: "u",
      mainSite: "https://o.github.io/r",
      mainPagesKnown: true,
      newPages: ["guides/agent-onboarding.html"],
    });
    const facts = JSON.parse(readFileSync(join(dir, "staging.json"), "utf-8"));
    expect(facts.newPages).toEqual(["guides/agent-onboarding.html"]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("mainPagesKnown false is a DIFFERENT state from an empty newPages", () => {
    // "Could not tell" must never render as "this page is new" — that would
    // label every page new on any run where the publish-ref fetch failed. The
    // client branches on the flag before it ever consults the list.
    const client = CLIENT;
    expect(client).toMatch(/if\(!f\.mainPagesKnown\)/);
    const flagAt = client.indexOf("mainPagesKnown");
    const listAt = client.indexOf("newPages.indexOf");
    expect(flagAt).toBeGreaterThan(-1);
    expect(listAt).toBeGreaterThan(flagAt);
  });
});

describe("the STAGING build does not bake a per-run stamp into the footer", () => {
  /**
   * The gap this file had, and the reason it is worth stating plainly.
   *
   * Every test above asserts things about `FRAGMENT`, and they were all
   * correct: the fragment IS constant. The deployed page was not, because
   * `docs/_includes/footer_custom.html` renders `short_sha`, `built_at` and
   * `run_url` from `docs/_data/build.yml` into every page's footer, and the
   * staging build wrote a fresh `date -u` into it on every run.
   *
   * Measured on two deploys of ONE branch three minutes apart, both already
   * shipping the constant banner: **1466 insertions, 1465 deletions across 613
   * files, every page changed by exactly one line.** A unit test of the part
   * is not a measurement of the whole, and this is what that costs.
   */
  const WORKFLOW = readFileSync(
    join(repoRootFor(resolve(HARNESS_ROOT)), ".github", "workflows", "feature-staging.yml"),
    "utf-8",
  );

  /** The `Stamp the build` step's body, comments stripped. */
  const stampStep = (() => {
    const m = WORKFLOW.match(/- name: Stamp the build\n([\s\S]*?)(?=\n      - name: )/);
    if (!m) throw new Error("no `Stamp the build` step in feature-staging.yml");
    return m[1]!
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
  })();

  test.each(["short_sha", "built_at", "run_url"])(
    "`%s` is not written on a staging build — the footer renders it on every page",
    (key) => {
      expect(stampStep).not.toContain(key);
    },
  );

  test("the keys that ARE written are constant for a preview", () => {
    // branch, slug and PR number do not change between rebuilds of one
    // preview, so they cost nothing and stay where Jekyll can use them.
    for (const key of ["branch:", "staging_slug:", "pr_number:"]) {
      expect(stampStep).toContain(key);
    }
  });

  test("the client fills the stamp from the facts it already fetched", () => {
    const client = CLIENT;
    expect(client).toContain("fa-build-stamp");
    // The definition existing is not the same as it being CALLED. Checking
    // only for `fa-build-stamp` passed with the `stamp(f)` call deleted —
    // caught by ratcheting, and by the browser test rather than this one.
    // Third variant of this trap in this change alone.
    // `stamp(f);` — the CALL, which ends in a semicolon. `\bstamp\(f\)`
    // also matches the DEFINITION `function stamp(f){`, so it stayed green
    // with the call deleted. Fourth variant of this trap in this one change:
    // the assertion must name what distinguishes the two, not what they share.
    expect(client).toMatch(/stamp\(f\);/);
    // From the same one fetch of `staging.json`, not a second request. The
    // other two fetches in the client are the staleness check against GitHub
    // (#1076) and the HEAD probe that finds the preview's review page (#1318).
    expect((client.match(/fetch\(r\+'staging\.json'/g) ?? []).length).toBe(1);
    expect((client.match(/fetch\(c\[i\]\+'index\.html',\{method:'HEAD'/g) ?? []).length).toBe(1);
    expect((client.match(/fetch\(/g) ?? []).length).toBe(3);
  });

  test("the MAIN site no longer bakes it either: the browser fills it from build.json", () => {
    // `footer_custom.html`'s own comment: without a stamp "a stale browser
    // cache and a deploy that has not run look identical". The stamp stays;
    // only the moment it is bound moved, on the live site too (owner,
    // 2026-10-31, folio-assistant#2837): baked in, it changed every page on
    // every deploy, so no preview could share the live site's unchanged
    // pages (`staging-share.ts`). `docs-site.yml` writes the same facts to
    // `build.json`, and cat-harness's `docs-ui.js` fills the footer from it.
    const main = readFileSync(
      join(repoRootFor(resolve(HARNESS_ROOT)), ".github", "workflows", "docs-site.yml"),
      "utf-8",
    );
    const code = main.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
    for (const key of ["short_sha:", "built_at:", "run_url:"]) expect(code).not.toContain(`echo "${key}`);
    expect(code).toContain("build.json");
    expect(code).toMatch(/runUrl: \$runUrl/);
  });
});

describe("the THIRD per-build source: TypeDoc's source links", () => {
  /**
   * Found only by measuring the deployed artefact, after both the banner and
   * the footer had been fixed and the page still changed every build.
   *
   * TypeDoc defaults `gitRevision` to the current commit SHA and writes it
   * into every "Defined in" link:
   *
   *     <a href="https://github.com/…/blob/<40-hex-sha>/…/builders.ts#L85">
   *
   * Measured on two consecutive deploys of one branch whose only source
   * difference was a **bean file** — which reaches no HTML page, since the
   * sticky board fetches `docs/assets/todos/index.json` at runtime:
   *
   *     1193 insertions(+), 1192 deletions(-)
   *
   * and the changed set began at `api/`, where before the banner and footer
   * fixes it began at `accessibility.html`. The Jekyll half had been fixed;
   * this had not.
   *
   * Three causes, three fixes, and each one was invisible until the one in
   * front of it was removed. That is the argument for measuring the artefact
   * rather than the part: no test of the banner could have found the footer,
   * and no test of either could have found this.
   */
  const WORKFLOW = readFileSync(
    join(repoRootFor(resolve(HARNESS_ROOT)), ".github", "workflows", "feature-staging.yml"),
    "utf-8",
  );
  const MAIN = readFileSync(
    join(repoRootFor(resolve(HARNESS_ROOT)), ".github", "workflows", "docs-site.yml"),
    "utf-8",
  );

  /**
   * The TypeDoc step's `with:` block, comments stripped. Both workflows call
   * one shared action, `.github/actions/typedoc-api` (fa#2739), so the
   * revision a build pins is the `git-revision` input it passes, and the
   * action's script turns that into `--gitRevision` only when it is set.
   */
  function typedocCall(yml: string): string {
    const m = yml.match(/uses: \.\/\.github\/actions\/typedoc-api\n[\s\S]*?(?=\n\n|\n      - name:)/);
    if (!m) throw new Error("no typedoc-api step");
    return m[0]
      .split("\n")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
  }
  const ACTION_SCRIPT = readFileSync(
    join(repoRootFor(resolve(HARNESS_ROOT)), ".github", "actions", "typedoc-api", "typedoc.sh"),
    "utf-8",
  );

  test("the shared action passes --gitRevision only when a revision is given", () => {
    expect(ACTION_SCRIPT).toMatch(/\[ -n "\$\{REV:-\}" \] && rev=\(--gitRevision "\$REV"\)/);
    expect(ACTION_SCRIPT).toContain('"${rev[@]}"');
  });

  test("the staging build pins source links to the branch, not the commit", () => {
    expect(typedocCall(WORKFLOW)).toMatch(/git-revision:\s+\$\{\{\s*steps\.slug\.outputs\.branch\s*\}\}/);
  });

  test("the MAIN site does not — a published link should freeze its commit", () => {
    // Not an oversight and not symmetry for its own sake. There is one copy of
    // the published site, nothing to deduplicate, and a source link that
    // follows a moving branch is worth less there than one that names the
    // commit it documented.
    expect(typedocCall(MAIN)).not.toContain("git-revision");
  });
});
