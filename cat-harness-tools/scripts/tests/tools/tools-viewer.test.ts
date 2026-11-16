/**
 * The tools graph has a surface of its own, and it stays separate from skills.
 *
 * Owner, 2026-09-21: **"keep tools and skills separate!"**
 *
 * They were not. `cat-harness.json`'s `tools` entry declared its documentation
 * as `cat-harness/docs/concepts/skills.md` — a page titled *"Skills & roles"* with no
 * tools section in it. The tools graph had no documentation of its own and
 * named a page about something else.
 *
 * ## The assertion shape that matters here
 *
 * The defect was invisible to every check because the declared path **existed**.
 * An absent `docs` ref is a legible gap; a ref that resolves REPORTS COVERAGE.
 * So a test asserting only "the docs ref resolves to a file" would have passed
 * on the broken declaration, which is exactly how it survived.
 *
 * What is asserted instead is that the two graphs' documentation are DIFFERENT
 * pages, and that the tools one is about tools. The second half cannot be fully
 * mechanised — "is this page about this subject" is not decidable — so it is
 * approximated honestly: the page must mention the graph's own vocabulary, and
 * the assertion says so rather than pretending to more.
 *
 * @module cat-harness/scripts/tests/tools-viewer.test
 *
 * The tests of this file that read the whole checkout (joins every Tool to the
 * skills of every layer in the checkout) live in
 * `test/tools-viewer-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { baseDocsDir } from "../../compose-docs.js";
import { page, pageRelPath, skillIds, toolRows } from "../../gen-tools-viz.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { siteNotBuilt } from "../../../test/support/checkout.ts";
import { PAGE_LOCALE } from "../../viewer-declarations.js";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
/**
 * The base docs layer — asked, never spelled.
 *
 * It was `join(REPO, "cat-harness", "docs")`, and `site-dir-single-answer`
 * refused it. Rightly: the site root has moved twice (beans `x4a6`, `wggr`),
 * and a test carrying its own copy keeps checking where the site used to be
 * while reporting a pass.
 *
 * Worth noting HOW this reached CI. The pre-push checks that caught the other
 * two failures were named gate scripts, and this guard is a UNIT TEST — so a
 * targeted run of `check:*` scripts skipped it entirely. `bun test` is itself
 * a gate, and a subset of the gate set is not the gate set.
 */
const DOCS = baseDocsDir(REPO);

const { tools } = (await import("../../../schemas/tools/harness-tools.js")) as { tools: () => unknown[] };
const rows = toolRows(tools());

describe("the page reports the join in both directions", () => {

  it("names the unresolved ones when there are any", () => {
    // Exercised with a planted gap rather than waiting for a real one, so the
    // failure path is not dead code that has never rendered.
    const planted = [...rows, { ...rows[0]!, id: "planted", satisfies: ["no-such-skill"] }];
    const html = page(planted, skillIds(REPO));
    expect(html).toContain("no-such-skill");
    expect(html).toContain("`planted`");
    expect(html).not.toMatch(/Yes — all \*\*\d+\*\*/);
  });

  it("names a tool that satisfies nothing, as a separate finding", () => {
    const planted = [...rows, { ...rows[0]!, id: "orphan", satisfies: [] }];
    const html = page(planted, skillIds(REPO));
    expect(html).toContain("satisfy no skill at all");
    expect(html).toContain("`orphan`");
  });
});

describe("the rendered page", () => {
  const html = page(rows, skillIds(REPO));

  it("keeps the direction of the relation explicit", () => {
    // The one sentence that does the conceptual work. Without it the page is a
    // table that a reader may take either way round.
    expect(html).toContain("from a tool to a skill");
  });

  it("lists every tool", () => {
    for (const r of rows) expect(html).toContain(`\`${r.id}\``);
  });

  it("carries no Liquid syntax, because Jekyll renders it as a page", () => {
    // A Tool description quoting a Liquid include tag reached this page and
    // Jekyll tried to execute it: the staging build died on `tools/index.md`
    // while every repository gate was green (PR #1489). Say it in words.
    const body = html.replace(/^---\n[\s\S]*?\n---\n/, "");
    expect(body).not.toMatch(/\{%|\{\{/);
  });

  it("is markdown, not HTML wearing front matter", () => {
    const body = html.replace(/^---\n[\s\S]*?\n---\n/, "").replace(/<style>[\s\S]*?<\/style>/g, "");
    expect(body).toMatch(/^## /m);
    expect(body).toMatch(/^\|---/m);
    expect(body).not.toMatch(/<table\b/);
    expect(body).not.toMatch(/<h[12]\b/);
  });

  it("declares no theme CSS of its own", () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    expect(css).not.toContain("body{");
    expect(css).not.toContain("prefers-color-scheme");
  });
});

describe("the generator writes where the declaration says", () => {
  it("resolves its page path from the declaration, not a literal", () => {
    const rel = pageRelPath(REPO);
    expect(rel).toBeDefined();
    // Declared under the page locale.
    expect(rel!.startsWith(`${PAGE_LOCALE}/`)).toBe(true);
  });

  // Until the committed site is regenerated (folio-assistant#2527) the page is
  // still at the address without the locale. Standing alone it is at neither:
  // it is built at publish and gitignored (bean w1gy F18).
  const declared = pageRelPath(REPO);
  const committed = declared === undefined ? [] : [declared, declared.slice(`${PAGE_LOCALE}/`.length)];
  it.skipIf(
    declared !== undefined &&
      !committed.some((r) => existsSync(join(DOCS, r))) &&
      siteNotBuilt("the Tools page `tools:viz` writes at publish (gitignored)", join(DOCS, declared)),
  )("and the page is at that path", () => {
    expect(committed.some((r) => existsSync(join(DOCS, r)))).toBe(true);
  });
});

/**
 * Bean `qgjh`: a `satisfies` that names a skill with a published instruction
 * page is a link; one without a page stays code rather than a link that 404s.
 */
describe("satisfies links what resolves (qgjh)", () => {
  const TOOLS_PAGE = pageRelPath(REPO)!;
  const withSkill = rows.find((r) => r.satisfies.length > 0)!;
  const s = withSkill.satisfies[0]!;
  const satisfiesCell = (md: string): string =>
    md
      .split("\n")
      .find((l) => l.includes(`\`${withSkill.id}\``) && l.startsWith("|"))!
      .split("|")[4]!;

  it("links a skill whose page exists, relative to the page it sits on", () => {
    // One `../` per directory of the page's route, back to the site root.
    const up = "../".repeat(TOOLS_PAGE.split("/").length - 1);
    expect(satisfiesCell(page(rows, new Set([s]), new Set([s]), TOOLS_PAGE))).toContain(
      `[\`${s}\`](${up}reference/skill-instructions/${s}.html)`,
    );
  });

  it("leaves a skill with no page as code", () => {
    const c = satisfiesCell(page(rows, new Set([s]), new Set(), TOOLS_PAGE));
    expect(c).toContain(`\`${s}\``);
    expect(c).not.toContain(`[\`${s}\`]`);
  });
});

/**
 * Bean `folio-assistant-qbfm`: wireframe fixes.
 * - Stat boxes link into in-page anchors / table sections.
 * - Tool ids are in-page anchors and links.
 * - Mobile scroll cue styling on table-wrapper.
 */
describe("wireframe fixes (qbfm)", () => {
  const html = page(rows, skillIds(REPO));

  it("renders stat boxes as links into page sections", () => {
    expect(html).toContain('<a class="tg-stat" href="#every-tool">');
    expect(html).toContain('<a class="tg-stat" href="#does-every-satisfies-name-a-skill-that-exists">');
    expect(html).toContain('<a class="tg-stat" href="#how-they-are-invoked-and-installed">');
  });

  it("renders tool ids as in-page anchors and links", () => {
    for (const r of rows) {
      expect(html).toContain(`<a id="${r.id}"></a>[\`${r.id}\`](#${r.id})`);
    }
  });

  it("provides mobile scroll cue for the table wrapper", () => {
    expect(html).toContain(".table-wrapper");
    expect(html).toContain("mask-image");
    expect(html).toContain("animation-timeline");
  });
});

/**
 * Bean `folio-assistant-tdir`: a Tool's page links its QA verdict on
 * `qa-reports` via `qa-result-link.ts` (never `blob/main/`).
 */
describe("a Tool's page links its QA verdict (tdir)", () => {
  const KEY = "main/0123456789abcdef0123456789abcdef01234567";
  const qaCell = (md: string, toolId: string): string =>
    md
      .split("\n")
      .find((l) => l.startsWith(`| <a id="${toolId}">`))!
      .split(/(?<!\\)\|/)[6]!;

  it("links every Tool row to its qa-reports verdict, never blob/main", () => {
    const html = page(rows, skillIds(REPO));
    expect(html).toContain("| tool | what it does | invoked | satisfies | i/o | qa |");
    for (const r of rows) {
      expect(r.qaHref).toBeDefined();
      expect(r.qaHref).toContain("/blob/cat/cat-harness/qa-reports/");
      expect(r.qaHref).not.toContain("/blob/main/");
      expect(qaCell(html, r.id)).toContain(`(${r.qaHref})`);
    }
  });

  it("addresses each Tool's kg-qa sidecar under the qa-reports entry key when known", () => {
    const keyed = toolRows(tools(), REPO, { key: KEY });
    for (const r of keyed) {
      expect(r.qaHref).toContain(`/blob/cat/cat-harness/qa-reports/${KEY}/`);
      expect(r.qaHref).toEndWith(`/${r.id}.kg-qa.json`);
    }
  });

  it("renders the sidecar verdict as the link label when present, and qa-reports when not fetched locally", () => {
    const sample = rows[0]!;
    const withPass = [{ ...sample, qaVerdict: "pass" }];
    const withoutLocal = [{ ...sample, qaVerdict: undefined }];
    expect(qaCell(page(withPass, skillIds(REPO)), sample.id)).toContain(`[\`pass\`](${sample.qaHref})`);
    expect(qaCell(page(withoutLocal, skillIds(REPO)), sample.id)).toContain(`[\`qa-reports\`](${sample.qaHref})`);
  });
});


