import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BLOCK_URLS_JS, blockActionsHtml, editUrl, feedbackUrl, injectBlockActions, readIssueForm, sourceUrl } from "./block-actions.js";

const block = { label: "prose:2-1-2-ab12", source: "folio/doc/ch2/p-2-1-2.md", section: "2.1.2 Business services layer", page: "doc/index.html" };

describe("block-actions (REQ-17, bean uphx)", () => {
  test("editOpensGithubEditor", () => {
    expect(editUrl({ repo: "o/r" }, block.source)).toBe("https://github.com/o/r/edit/main/folio/doc/ch2/p-2-1-2.md");
    expect(editUrl({ repo: "o/r", branch: "draft" }, block.source)).toBe("https://github.com/o/r/edit/draft/folio/doc/ch2/p-2-1-2.md");
    expect(sourceUrl({ repo: "o/r" }, block.source)).toBe("https://github.com/o/r/blob/main/folio/doc/ch2/p-2-1-2.md");
  });

  test("noRepoNoLinks", () => {
    expect(editUrl({}, block.source)).toBeUndefined();
    expect(blockActionsHtml({}, block)).toBe("");
    const html = '<html><head></head><body><a id="prose:2-1-2-ab12"></a><p>x</p></body></html>';
    expect(injectBlockActions(html, [block], {})).toEqual({ html, inserted: 0 });
  });

  test("feedbackWithoutFormBody", () => {
    const u = new URL(feedbackUrl({ repo: "o/r", siteUrl: "https://o.github.io/r/" }, block)!);
    expect(u.pathname).toBe("/o/r/issues/new");
    expect(u.searchParams.get("template")).toBeNull();
    expect(u.searchParams.get("title")).toBe("Feedback: 2.1.2 Business services layer — prose:2-1-2-ab12");
    const body = u.searchParams.get("body")!;
    expect(body).toContain("`prose:2-1-2-ab12`");
    expect(body).toContain("https://github.com/o/r/blob/main/folio/doc/ch2/p-2-1-2.md");
    expect(body).toContain("https://o.github.io/r/doc/index.html#prose%3A2-1-2-ab12");
  });

  test("feedbackCodedWithContent", () => {
    const plain = new URL(feedbackUrl({ repo: "o/r", content: "dpi-h-ra" }, block)!);
    expect(plain.searchParams.get("title")).toBe("Feedback [dpi-h-ra]: 2.1.2 Business services layer — prose:2-1-2-ab12");
    expect(plain.searchParams.get("body")!.startsWith("**Content:** `dpi-h-ra`\n**Block:**")).toBe(true);
    const form = new URL(feedbackUrl({ repo: "o/r", content: "dpi-h-ra", template: "block-feedback.yml", templateFields: ["content"] }, block)!);
    expect(form.searchParams.get("content")).toBe("dpi-h-ra");
  });

  test("formPrefillsDeclaredFields", () => {
    const u = new URL(feedbackUrl({ repo: "o/r", template: "block-feedback.yml", templateFields: ["block", "source"], labels: ["feedback"] }, block)!);
    expect(u.searchParams.get("template")).toBe("block-feedback.yml");
    expect(u.searchParams.get("block")).toBe("prose:2-1-2-ab12");
    expect(u.searchParams.get("source")).toBe("folio/doc/ch2/p-2-1-2.md");
    expect(u.searchParams.get("section")).toBeNull();
    expect(u.searchParams.get("body")).toBeNull();
    expect(u.searchParams.get("labels")).toBe("feedback");
  });

  test("formFieldsReadFromIssueForm", () => {
    const root = mkdtempSync(join(tmpdir(), "ba-"));
    expect(readIssueForm(root)).toBeUndefined();
    mkdirSync(join(root, ".github", "ISSUE_TEMPLATE"), { recursive: true });
    writeFileSync(
      join(root, ".github", "ISSUE_TEMPLATE", "block-feedback.yml"),
      "name: Block feedback\nbody:\n  - type: input\n    id: block\n    attributes:\n      label: Block\n  - type: textarea\n    id: \"feedback\"\n",
    );
    expect(readIssueForm(root)).toEqual(["block", "feedback"]);
  });

  test("linksAfterAnchorOnce", () => {
    const html = '<html><head></head><body><a id="prose:2-1-2-ab12"></a><p>x</p><a id="other"></a></body></html>';
    const r = injectBlockActions(html, [block, { ...block, label: "missing" }], { repo: "o/r" });
    expect(r.inserted).toBe(1);
    expect(r.html).toContain('<a id="prose:2-1-2-ab12"></a><span class="block-actions" data-block="prose:2-1-2-ab12">');
    expect(r.html.match(/class="block-actions"/g)!.length).toBe(1);
    expect(r.html.match(/<style>/g)!.length).toBe(1);
    expect(r.html).toContain("✎ edit");
    expect(r.html).toContain("📣 feedback");
  });
});

describe("the browser builds the same URLs (bean v433)", () => {
  // The lazy page builds hrefs in the browser; one recipe, so test it against the server's.
  const faBlockUrls = new Function(`${BLOCK_URLS_JS}; return faBlockUrls;`)() as (c: unknown, b: unknown) => { edit: string; feedback: string };
  const cases = [
    { repo: "o/r" },
    { repo: "o/r", branch: "draft", siteUrl: "https://o.github.io/r/", labels: ["feedback", "pc"] },
    { repo: "o/r", template: "block-feedback.yml", templateFields: ["block", "section", "source", "url"], siteUrl: "https://o.github.io/r" },
    { repo: "o/r", content: "dpi-h-ra" },
    { repo: "o/r", content: "dpi-h-ra", template: "block-feedback.yml", templateFields: ["content", "block"] },
  ];
  for (const cfg of cases)
    for (const b of [block, { ...block, section: undefined }, { ...block, label: "tbl:a b&c" }])
      test(`browserBuildsSameUrls[${[JSON.stringify(cfg), b.label, b.section ?? "(no section)"].join("|").replace(/\s+/g, "_")}]`, () => {
        const u = faBlockUrls(cfg, b);
        expect(u.edit).toBe(editUrl(cfg, b.source)!);
        expect(u.feedback).toBe(feedbackUrl(cfg, b)!);
      });

  test("compactCarriesFacts", () => {
    const html = '<html><head></head><body><a id="prose:2-1-2-ab12"></a><p>x</p></body></html>';
    const r = injectBlockActions(html, [block], { repo: "o/r" }, { compact: true });
    expect(r.html).toContain('data-src="folio/doc/ch2/p-2-1-2.md"');
    expect(r.html).not.toMatch(/class="ba-(edit|feedback)" href=/);
    expect(r.html.match(/function faBlockUrls/g)!.length).toBe(1);
    expect(r.html).toContain('id="fa-edit-cfg"');
  });
});
