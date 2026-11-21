/**
 * Retired prose words (work item folio-assistant-dkqd): "bean" is a name in
 * code and quotations, and "work item" in prose.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { findRetiredWords, isGenerated, MATERIALIZATION_RECORD, ownProseFiles, scanInstance } from "../retired-prose-words.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const RETIRED = new Map([
  ["bean", "work item"],
  ["beans", "work items"],
]);
const words = (src: string) => findRetiredWords(src, RETIRED).map((h) => `${h.line}:${h.word}`);

describe("what counts as prose", () => {
  test("a word in running text is found, in any case", () => {
    expect(words("Claim the bean first.\nBeans are shared.")).toEqual(["1:bean", "2:Beans"]);
  });

  test("a name is not prose: code, link targets, identifiers, URLs", () => {
    const src = [
      "Run `beans list` and open [the board](../beans/index.html).",
      "The skill bean-coordination and the path beans/defs stay.",
      "Its schema is bean/1.0.0, see https://github.com/hmans/beans.",
      "```",
      "beans create \"x\"",
      "```",
    ].join("\n");
    expect(words(src)).toEqual([]);
  });

  test("code and quotes that wrap onto the next line are still code and quotes", () => {
    expect(words("set `status:\ndraft` (or `beans create\n--status draft`)")).toEqual([]);
    expect(words('read §"Closing a bean\non evidence" first')).toEqual([]);
  });

  test("a span never crosses a blank line, so an unclosed backtick does not hide a paragraph", () => {
    expect(words("a stray ` here\n\nthe bean is found")).toEqual(["3:bean"]);
  });

  test("headings keep their anchors; quotations keep their words", () => {
    expect(words('## Adding to a bean\n\nOwner: *"a bean is a memory note"*.')).toEqual([]);
  });

  test("front matter: only the description is prose", () => {
    const src = "---\nname: bean-drain\ndescription: >\n  Drain the beans.\ngraph-typologies:\n  - beans\n---\nBody.\n";
    expect(words(src)).toEqual(["4:beans"]);
  });

  test("a quoted YAML description is prose; a quotation inside it is not", () => {
    expect(words('---\ndescription: "Measured for bean cmsl."\n---\n')).toEqual(["2:bean"]);
    expect(words('---\ndescription: >\n  Triggers on "a branch and bean for them".\n---\n')).toEqual([]);
  });

  test("a generated file is its generator's to fix", () => {
    expect(isGenerated("---\ngenerated: \"x.ts — do not edit\"\n---\n")).toBe(true);
    expect(isGenerated("# A page\n\nbeans")).toBe(false);
  });
});

const HARNESS = resolve(HARNESS_ROOT);
const DECLARED = existsSync(join(HARNESS, "code-lists", "retired-prose-words.json"));

describe("whose prose it is", () => {
  test("another graph's materialised bytes are not this instance's prose", () => {
    const root = mkdtempSync(join(tmpdir(), "retired-words-"));
    try {
      mkdirSync(join(root, "skills"), { recursive: true });
      writeFileSync(join(root, "skills", "own.md"), "Own prose.\n");
      const sub = join(root, "subscriptions", "other", "subgraphs", "skills");
      mkdirSync(join(sub, "tree"), { recursive: true });
      writeFileSync(join(sub, MATERIALIZATION_RECORD), "{}\n");
      writeFileSync(join(sub, "tree", "theirs.md"), "Their prose.\n");
      expect(ownProseFiles(root)).toEqual(["skills/own.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a page declared built at publish is its generator's, whether or not a build has written it", () => {
    const root = mkdtempSync(join(tmpdir(), "retired-words-"));
    try {
      writeFileSync(
        join(root, "inst.json"),
        JSON.stringify({
          $schema: "cat-harness-declaration/1.0.0",
          builtAtPublish: [{ path: "docs/kind-table.md" }, { path: "docs/auto/" }],
        }),
      );
      mkdirSync(join(root, "docs", "auto"), { recursive: true });
      writeFileSync(join(root, "docs", "own.md"), "Own prose.\n");
      writeFileSync(join(root, "docs", "kind-table.md"), "| Bean | built |\n");
      writeFileSync(join(root, "docs", "auto", "page.md"), "A bean page.\n");
      expect(ownProseFiles(root)).toEqual(["docs/own.md"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("this harness's own prose", () => {
  // Off until the harness declares the list: the words are its data, and a
  // harness that declares none has retired none.
  test.skipIf(!DECLARED)("says no retired word", async () => {
    const r = await scanInstance(HARNESS);
    expect(r.state).toBe("scanned");
    if (r.state !== "scanned") return;
    expect(r.files).toBeGreaterThan(100);
    expect(r.hits.map((h) => `${h.file}:${h.line}: ${h.word}`)).toEqual([]);
  });
});
