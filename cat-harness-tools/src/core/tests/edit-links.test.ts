import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteFileFor } from "../../../schemas/kg/cat-harness.js";
import { BLOCK_URLS_JS, SUGGEST_TOKENS_JS, editLinkHtml, editLinksAsset, editUrl, feedbackUrl, sourceUrl } from "../edit-links.js";
import { HARNESS_ROOT } from "../../../scripts/lib/roots.ts";

describe("edit-links: one recipe for every page's edit and feedback links (bean v433)", () => {
  test("the published runtime is the generated one (run --write-asset after changing the recipe)", () => {
    const harness = join(HARNESS_ROOT);
    const asset = readFileSync(join(harness, siteFileFor(harness, "assets/js/edit-links.js")), "utf-8");
    expect(asset).toBe(editLinksAsset());
  });

  // input-site: inert #fcaf7f8b — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const urls = new Function(`${BLOCK_URLS_JS}; return faBlockUrls;`)() as (c: unknown, b: unknown) => { edit: string; source: string; feedback: string };
  const b = { label: "h-intro", source: "input/pagecontent/index.md", section: "Introduction", line: 12, repo: "who/smart-base" };

  test("a source line and a submodule's repository reach every URL, in both halves", () => {
    const cfg = { repo: "o/r", branch: "main" };
    const u = urls(cfg, b);
    expect(u.source).toBe(sourceUrl(cfg, b.source, b.line, b.repo)!);
    expect(u.source).toBe("https://github.com/who/smart-base/blob/main/input/pagecontent/index.md#L12");
    expect(u.edit).toBe(editUrl(cfg, b.source, b.repo)!);
    expect(u.feedback).toBe(feedbackUrl(cfg, b)!);
    // feedback goes to the SITE's repository, whatever repository the source is in
    expect(u.feedback.startsWith("https://github.com/o/r/issues/new?")).toBe(true);
  });

  test("a single link carries its facts, and edit keeps a plain href for readers without JavaScript", () => {
    const html = editLinkHtml({ repo: "o/r" }, { source: "docs/a b.md", line: 3 });
    expect(html).toContain('data-fa-link="edit"');
    expect(html).toContain('data-src="docs/a b.md"');
    expect(html).toContain('href="https://github.com/o/r/edit/main/docs/a%20b.md"');
    expect(editLinkHtml({ repo: "o/r" }, { source: "x.md", kind: "feedback" })).not.toContain("href=");
  });

  type Tokens = { wrap: (md: string, ownOnly?: boolean) => string; errors: (md: string, ownOnly?: boolean) => string[] };
  // input-site: inert #78abe6ad — evaluates browser-side or toString'd source from this tree's own modules, already in the read set; it reads no environment
  const tokensOf = new Function(`${SUGGEST_TOKENS_JS}; return faSuggestTokens;`)() as (rules?: unknown[]) => Tokens;

  test("the suggest editor's own tokens are Liquid and directives, and no content type's", () => {
    const t = tokensOf();
    const md = "A {{ x.y }} and :term[DPI]{#dpi} and \\name{a} and @cite{b}.";
    expect(t.wrap(md)).toBe("A ⟦{{ x.y }}⟧ and ⟦:term[DPI]{#dpi}⟧ and \\name{a} and @cite{b}.");
    expect(t.errors("{{ x | }} and :term[open")).toEqual(["{{ x | }}", ":term[open"]);
    expect(t.errors("\\name{a b and @cite{")).toEqual([]);
  });

  test("a profile's token rules, serialised as the page config carries them, are shielded and checked", () => {
    // What pipeline/editor-profiles.ts writes for a rule: each pattern as String(RegExp).
    const rule = { id: "at-ref", shield: String(/@[a-z]+\{[^}\n]*\}/), find: String(/@[a-z]+\S*/g), valid: String(/^@[a-z]+\{[^{}\n]+\}$/), trim: String(/[.,;:)]+$/) };
    const t = tokensOf([rule]);
    expect(t.wrap("See @cite{b} and {{ v }}.")).toBe("See ⟦@cite{b}⟧ and ⟦{{ v }}⟧.");
    expect(t.errors("See @cite{b}, and @ref{c}).")).toEqual([]);
    expect(t.errors("See @cite{b and @ref.")).toEqual(["@cite{b", "@ref."]);
    // ownOnly: the profile's module keeps or checks its own syntax itself.
    expect(t.wrap("See @cite{b}.", true)).toBe("See @cite{b}.");
    expect(t.errors("See @cite{b", true)).toEqual([]);
  });

  test("the runtime includes the gutter bookmark control and folio pin attributes (cat-harness#982)", () => {
    const asset = editLinksAsset();
    expect(asset).toContain("ba-bookmark");
    expect(asset).toContain('data-fa-pin-kind", "bookmark"');
    expect(asset).toContain("data-fa-pin-control");
  });
});

