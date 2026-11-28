/**
 * Tests for pot-extract.ts and po-inject.ts — the TypeScript port of
 * smart-base's markdown extraction/injection pipeline.
 *
 * Run: bun test pipeline/translation.test.ts
 */

import { describe, test, expect } from "bun:test";
import {
  cleanMarkdownText,
  extractMarkdown,
  extractFromManifest,
  formatPot,
  isTranslatable,
} from "./pot-extract";
import { parsePo, injectMarkdown } from "./po-inject";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { publishedPairs } from "./derive-po.ts";
import { siteRoot, sourceLocale, supportedLocales } from "./translation-index.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

// ── cleanMarkdownText ───────────────────────────────────────────

describe("cleanMarkdownText", () => {
  test("strips bold markers", () => {
    expect(cleanMarkdownText("**bold text**")).toBe("bold text");
  });

  test("strips italic markers (asterisk)", () => {
    expect(cleanMarkdownText("*italic text*")).toBe("italic text");
  });

  test("strips italic markers (underscore)", () => {
    expect(cleanMarkdownText("_italic text_")).toBe("italic text");
  });

  // ── bean `o29r`: CommonMark's intraword rule ──────────────────
  //
  // `_` cannot OPEN emphasis after an alphanumeric, nor CLOSE before one. The
  // regex had no such guard, so ANY TWO underscores in one string paired up and
  // both were deleted. One subscript alone was safe, because the pattern needs a
  // second `_` to close on — so TWO is the threshold, and two is the ordinary
  // case in mathematical prose.
  //
  // Measured over the real corpora, current extractor against the same one with
  // only that line changed: 229 corrupted msgids of 46306 here, 13251 of 211139
  // in `litlfred/qou`. Each case below is a shape taken from those, not invented.

  test("a LaTeX subscript survives, alone or beside another", () => {
    // `$a_1$` alone already passed before the fix; the pair is the regression.
    expect(cleanMarkdownText("$a_1$")).toBe("$a_1$");
    expect(cleanMarkdownText("$a_1$ and $b_2$")).toBe("$a_1$ and $b_2$");
    expect(cleanMarkdownText("x_1 y_2")).toBe("x_1 y_2");
  });

  test("a subscripted LaTeX command is not turned into a different expression", () => {
    // The case that sets the severity. Losing these underscores does not flatten
    // a subscript, it rewrites the mathematics: `\sum{\lambdai}` is not valid
    // LaTeX, so the msgid cannot be reconstructed by a translator who knows the
    // convention.
    expect(cleanMarkdownText("weighted by $w_\\lambda = dq$")).toBe("weighted by $w_\\lambda = dq$");
    expect(cleanMarkdownText("the subspace $G^+ = \\sum_{\\lambda_i}$")).toBe(
      "the subspace $G^+ = \\sum_{\\lambda_i}$",
    );
  });

  test("a snake_case identifier is not a word with emphasis inside it", () => {
    // Not a maths-only concern: this shape broke BPMN ids in this repo's own
    // `prov-qaqc` page, where `Process_CodeChangeReview/Task_ClaimBean` extracted
    // as `ProcessCodeChangeReview/TaskClaimBean` — a msgid no translator can
    // round-trip.
    expect(cleanMarkdownText("snake_case_name stays")).toBe("snake_case_name stays");
    expect(cleanMarkdownText("perform-task for Process_CodeChangeReview/Task_ClaimBean")).toBe(
      "perform-task for Process_CodeChangeReview/Task_ClaimBean",
    );
  });

  test("real emphasis is still stripped, including two spans in one string", () => {
    // The guard must not buy subscript safety by giving up emphasis. Without
    // this, deleting the emphasis branch outright would pass every case above.
    expect(cleanMarkdownText("say _this_ and _that_")).toBe("say this and that");
    expect(cleanMarkdownText("a _multi word_ span")).toBe("a multi word span");
    expect(cleanMarkdownText("(_parenthesised_)")).toBe("(parenthesised)");
  });

  test("replaces links with indexed <aN> placeholders (G3)", () => {
    expect(cleanMarkdownText("[click here](https://example.com)")).toBe(
      "<a0>click here</a0>"
    );
  });

  test("replaces images with alt text", () => {
    expect(cleanMarkdownText("![alt text](image.png)")).toBe("alt text");
  });

  test("replaces inline code with indexed {codeN} placeholders (G3)", () => {
    expect(cleanMarkdownText("use `foo()` function")).toBe("use {code0} function");
  });

  test("removes HTML comments", () => {
    expect(cleanMarkdownText("text <!-- comment --> more")).toBe("text  more");
  });

  test("removes HTML tags", () => {
    expect(cleanMarkdownText("<br/>text<div>more</div>")).toBe("textmore");
  });

  test("removes angle-bracket autolinks", () => {
    expect(cleanMarkdownText("see <https://example.com> for info")).toBe(
      "see  for info"
    );
  });

  test("transforms Liquid output to gettext brace vars", () => {
    expect(cleanMarkdownText("There are {{ count }} items")).toBe(
      "There are {lqd_count} items"
    );
  });

  test("removes Liquid control tags", () => {
    expect(cleanMarkdownText("{% if true %}text{% endif %}")).toBe("text");
  });

  test("preserves underscores in Liquid variables", () => {
    // The Liquid tokenisation must protect underscores from the italic regex
    expect(cleanMarkdownText("{{ cell_var }}")).toBe("{lqd_cell_var}");
  });
});

// ── extractMarkdown ─────────────────────────────────────────────

// ── bean `3mo4`: a code span WRAPPED in emphasis ──────────────────
//
// The code span was removed before emphasis was stripped, so the emphasis pair
// was left with nothing between its markers. `MD_BOLD_RE` requires `[^*]+`
// there, so it did not match and the asterisks survived into the msgid — noise
// the translator is asked to reproduce, and part of the catalogue key. The
// repair tokenises code spans the way Liquid expressions were already
// tokenised, so emphasis sees something opaque rather than nothing.
//
// The four rows the bean tabulated are pinned below, plus a fifth it did not
// list and the case that proves the fix cannot reach inside a code span.

describe("cleanMarkdownText — emphasis around a code span (bean `3mo4` + G3)", () => {
  test("bold wrapping a code span leaves no asterisks", () => {
    // Was `"**** — fail if x"`. Now identical to the bare-code-span row below,
    // which is the point: one construct, one answer. With G3 (`h11k`), the code
    // span is preserved as `{code0}` rather than dropped.
    expect(cleanMarkdownText("**`clarity-defn-single`** — fail if x")).toBe("{code0} — fail if x");
  });

  test("italic wrapping a code span leaves no asterisks", () => {
    // Not in the bean's table — found while reproducing it. Was `"** trailing"`.
    expect(cleanMarkdownText("*`italic-code`* trailing")).toBe("{code0} trailing");
  });

  test("bold around ordinary text is unaffected", () => {
    expect(cleanMarkdownText("**bold** — fail if x")).toBe("bold — fail if x");
  });

  test("a bare code span is unaffected", () => {
    expect(cleanMarkdownText("`code` — fail if x")).toBe("{code0} — fail if x");
  });

  test("the construct TWICE in one string preserves both code placeholders", () => {
    expect(cleanMarkdownText("**`a`** and **`b`** both")).toBe("{code0} and {code1} both");
  });

  test("TWO bold runs, the first wrapping a code span, left the markers asymmetric", () => {
    const real = "**`skill_list`** — every servable skill **with its one-line summary**,";
    expect(cleanMarkdownText(real)).toBe("{code0} — every servable skill with its one-line summary,");
  });

  test("a glob INSIDE a code span is never reached by the emphasis regexes", () => {
    expect(cleanMarkdownText("see `content/**/*.lean` glob")).toBe("see {code0} glob");
    expect(cleanMarkdownText("`a/**/b` and `c/**/d`")).toBe("{code0} and {code1}");
  });

  test("over the REAL corpus: no msgid carries a run of four asterisks", () => {
    const root = resolve(HARNESS_ROOT);
    const docs = siteRoot(root);
    expect(docs).toBeDefined();
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) {
          if (!e.name.startsWith("_")) walk(p);
        } else if (e.name.endsWith(".md")) files.push(p);
      }
    };
    walk(docs!);
    let msgids = 0;
    const offenders: string[] = [];
    for (const f of files) {
      for (const e of extractMarkdown(readFileSync(f, "utf-8"), relative(docs!, f))) {
        msgids++;
        if (/\*{4}/.test(e.msgid)) offenders.push(`${relative(docs!, f)}:${e.line}`);
      }
    }
    expect(offenders).toEqual([]);
    // Anti-vacuity: a walk that found nothing would satisfy the line above.
    // Adjusted for M6–M8 moves (matching lines 327 and 798 below).
    expect(files.length).toBeGreaterThan(300);
    expect(msgids).toBeGreaterThan(20000);
  });
});

// ── bean `6b8u`: one ideograph is a word ──────────────────────────
//
// The owner's decision of 2026-09-27, on the MERITS. `MD_MIN_TEXT_LETTERS` is a
// count and a count is not script-neutral: `是` and `否` are the complete words
// "yes" and "no", while `y` and `n` are abbreviations. Over 660 files / 46 800
// msgids the rule admits exactly those two strings, four times each, in yes/no
// cells of three zh comparison tables.
//
// The alignment non-claim is pinned too, because it is the thing a later reader
// is most likely to get wrong: this does NOT improve alignment and must not be
// cited as if it did.

describe("isTranslatable — a single ideograph is a word (bean `6b8u`)", () => {
  test("a lone Han character is translatable", () => {
    expect(isTranslatable("是")).toBe(true);
    expect(isTranslatable("否")).toBe(true);
  });

  test("a lone Latin letter is still NOT translatable", () => {
    // The asymmetry is the decision, not an oversight: `y` abbreviates a word,
    // `是` is one. A rule that admitted both would admit every stray initial.
    expect(isTranslatable("y")).toBe(false);
    expect(isTranslatable("n")).toBe(false);
    expect(isTranslatable("a")).toBe(false);
  });

  test("two Latin letters remain the threshold", () => {
    expect(isTranslatable("no")).toBe(true);
    expect(isTranslatable("нет")).toBe(true);
  });

  test("Hiragana, Katakana and Hangul count too, not only Han", () => {
    // The decision was about the property rather than about `是`/`否`, so the
    // other scripts where one character is a word are included. A vocabulary of
    // two characters would be a rule expressed as a backlog.
    expect(isTranslatable("ひ")).toBe(true);
    expect(isTranslatable("ア")).toBe(true);
    expect(isTranslatable("한")).toBe(true);
  });

  test("still nothing translatable in a letterless string", () => {
    // The guard the threshold exists for in the first place.
    expect(isTranslatable(", ")).toBe(false);
    expect(isTranslatable("")).toBe(false);
    expect(isTranslatable("42 — 7")).toBe(false);
  });

  test("it admits EXACTLY the cells measured, and no more", () => {
    // Anti-scope-creep, over the real corpus. If a later change widens the rule,
    // this is where the widening shows up rather than in a msgid count nobody
    // reads. Counted over table cells, which is where the bean found the defect.
    const root = resolve(HARNESS_ROOT);
    const docs = siteRoot(root);
    expect(docs).toBeDefined();
    const files: string[] = [];
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) {
          if (!e.name.startsWith("_")) walk(p);
        } else if (e.name.endsWith(".md")) files.push(p);
      }
    };
    walk(docs!);
    const twoLetters = (t: string): boolean => {
      let n = 0;
      for (const c of t) if (/\p{L}/u.test(c) && ++n >= 2) return true;
      return false;
    };
    const admitted = new Map<string, number>();
    for (const f of files) {
      for (const raw of readFileSync(f, "utf-8").split("\n")) {
        const t = raw.trim();
        if (!t.startsWith("|") || !t.endsWith("|")) continue;
        for (const cell of t.slice(1, -1).split("|")) {
          const m = cleanMarkdownText(cell.trim());
          // Admitted by the new rule and rejected by the old one.
          if (m && !twoLetters(m) && isTranslatable(m)) admitted.set(m, (admitted.get(m) ?? 0) + 1);
        }
      }
    }
    expect([...admitted.keys()].sort()).toEqual(["否", "是"]);
    // 6 since moves M6–M8 took two of the eight measured cells up to
    // folio-assistant-core with the pages that hold them.
    expect([...admitted.values()].reduce((a, b) => a + b, 0)).toBe(6);
  });
});

describe("extractMarkdown", () => {
  test("extracts headings", () => {
    const entries = extractMarkdown("# Main Title\n\nSome text.\n", "test.md");
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0].msgid).toBe("Main Title");
  });

  test("extracts paragraphs", () => {
    const entries = extractMarkdown(
      "First paragraph text.\n\nSecond paragraph text.\n",
      "test.md"
    );
    expect(entries.length).toBe(2);
    expect(entries[0].msgid).toBe("First paragraph text.");
    expect(entries[1].msgid).toBe("Second paragraph text.");
  });

  test("accumulates continuation lines into one paragraph", () => {
    const entries = extractMarkdown(
      "This is a long\nparagraph that spans\nmultiple lines.\n\nNext para.\n",
      "test.md"
    );
    expect(entries[0].msgid).toBe(
      "This is a long paragraph that spans multiple lines."
    );
  });

  test("skips YAML front matter", () => {
    const entries = extractMarkdown(
      "---\ntitle: Test\nlayout: default\n---\n\nActual content here.\n",
      "test.md"
    );
    expect(entries.length).toBe(1);
    expect(entries[0].msgid).toBe("Actual content here.");
  });

  test("skips fenced code blocks", () => {
    const entries = extractMarkdown(
      "Before code.\n\n```typescript\nconst x = 1;\n```\n\nAfter code.\n",
      "test.md"
    );
    const msgids = entries.map((e) => e.msgid);
    expect(msgids).toContain("Before code.");
    expect(msgids).toContain("After code.");
    expect(msgids).not.toContain("const x = 1;");
  });

  test("skips HTML style blocks", () => {
    const entries = extractMarkdown(
      "Before.\n\n<style>\n.foo { color: red; }\n</style>\n\nAfter.\n",
      "test.md"
    );
    const msgids = entries.map((e) => e.msgid);
    expect(msgids).toContain("Before.");
    expect(msgids).toContain("After.");
    expect(msgids).not.toContain(".foo { color: red; }");
  });

  test("extracts list items", () => {
    const entries = extractMarkdown(
      "- First item\n- Second item\n- Third item\n",
      "test.md"
    );
    expect(entries.length).toBe(3);
    expect(entries[0].msgid).toBe("First item");
  });

  test("extracts blockquote text", () => {
    const entries = extractMarkdown(
      "> This is a quote.\n",
      "test.md"
    );
    expect(entries[0].msgid).toBe("This is a quote.");
  });

  test("extracts table cells", () => {
    const entries = extractMarkdown(
      "| Header One | Header Two |\n|---|---|\n| Cell one | Cell two |\n",
      "test.md"
    );
    const msgids = entries.map((e) => e.msgid);
    expect(msgids).toContain("Header One");
    expect(msgids).toContain("Cell one");
  });

  test("skips table separator rows", () => {
    const entries = extractMarkdown(
      "| A | B |\n|---|---|\n| C | D |\n",
      "test.md"
    );
    const msgids = entries.map((e) => e.msgid);
    expect(msgids).not.toContain("---");
  });

  test("skips kramdown attributes", () => {
    const entries = extractMarkdown(
      "# Title\n{: .no_toc }\n\nContent.\n",
      "test.md"
    );
    const msgids = entries.map((e) => e.msgid);
    expect(msgids).not.toContain(".no_toc");
  });

  // ── `{:toc}` consumes its list — bean `lrbx` ──────────────────────
  //
  // Every case below is asserted in BOTH directions, because the failure mode
  // of a fix like this is deleting prose a reader does see. `{: .no_toc }` is
  // the near miss: it is about the table of contents, it sits beside a heading
  // that renders, and a rule matching on "toc" rather than on the exact
  // directive would silently drop that heading from every catalogue.

  test("the list a `{:toc}` replaces is not offered to translators", () => {
    // The measured cost: the ar and ru translators rendered `1. TOC` as a
    // heading (ar `جدول المحتويات`), which is the correct reading of a string
    // that should never have been shown to them.
    const entries = extractMarkdown("Intro line.\n\n1. TOC\n{:toc}\n", "test.md");
    expect(entries.map((e) => e.msgid)).toEqual(["Intro line."]);
  });

  test("`{: .no_toc }` keeps the heading it attaches to", () => {
    const entries = extractMarkdown("## Subgraph viewers\n{: .no_toc }\n\nBody.\n", "test.md");
    expect(entries.map((e) => e.msgid)).toEqual(["Subgraph viewers", "Body."]);
  });

  test("an ordinary list is untouched", () => {
    const entries = extractMarkdown("- first item\n- second item\n\nA paragraph.\n", "test.md");
    expect(entries.map((e) => e.msgid)).toEqual(["first item", "second item", "A paragraph."]);
  });

  test("a `{:toc}` further down the page does not reach back to an earlier list", () => {
    // The run must END at the first line that is neither an item nor a blank,
    // or one directive would delete a list nobody asked it to touch.
    const entries = extractMarkdown(
      "- keep me\n- keep me too\n\nA paragraph.\n\n1. TOC\n{:toc}\n",
      "test.md",
    );
    expect(entries.map((e) => e.msgid)).toEqual(["keep me", "keep me too", "A paragraph."]);
  });

  test("a multi-item placeholder goes entirely, because the directive takes the LIST", () => {
    // Conventionally one item, but kramdown replaces the whole list — so a
    // rule that dropped only the last item would leak the rest.
    const entries = extractMarkdown("- TOC\n- Contents\n{:toc}\n", "test.md");
    expect(entries).toEqual([]);
  });

  test("an attribute list that attaches to prose keeps the prose", () => {
    const entries = extractMarkdown("Some real prose.\n{: .note }\n", "test.md");
    expect(entries.map((e) => e.msgid)).toEqual(["Some real prose."]);
  });

  test("skips horizontal rules", () => {
    const entries = extractMarkdown(
      "Before.\n\n---\n\nAfter.\n",
      "test.md"
    );
    const msgids = entries.map((e) => e.msgid);
    expect(msgids).toContain("Before.");
    expect(msgids).toContain("After.");
  });

  test("skips strings with fewer than two LETTERS, not fewer than three characters", () => {
    // Changed 2026-09-26, bean `6b8u`. The old rule was `text.length >= 3`, which
    // made translatability a property of the locale's script: `否` ("no") is one
    // character and was dropped where `non` and `нет` were kept, and an Arabic
    // cell's `"، و"` was kept where the English `", "` it translates was not.
    //
    // `OK` is the case that moved. It is two characters, so the old rule dropped
    // it — and it is a word with real translations (`Vale`, `Хорошо`), so dropping
    // it was wrong in the same direction as the rest of the defect.
    const entries = extractMarkdown("OK\n\nReal content here.\n", "test.md");
    expect(entries.map((e) => e.msgid)).toEqual(["OK", "Real content here."]);
  });

  test("a string with no letters is never translatable", () => {
    // What the threshold is actually FOR: skipping things that are not prose.
    // The old rule let 432 letterless msgids into this corpus's catalogues,
    // because it counted characters and punctuation is characters.
    const entries = extractMarkdown("| ... | — | 1.2.3 | Real words here |\n", "test.md");
    expect(entries.map((e) => e.msgid)).toEqual(["Real words here"]);
  });
});

// ── extractFromManifest ─────────────────────────────────────────

describe("extractFromManifest", () => {
  test("extracts title from manifest", () => {
    const entries = extractFromManifest(
      { label: "def:foo", title: "My Definition", kind: "definition" },
      "block.ts"
    );
    expect(entries.length).toBe(1);
    expect(entries[0].msgid).toBe("My Definition");
    expect(entries[0].comment).toContain("definition");
  });

  test("returns empty for manifest without title", () => {
    const entries = extractFromManifest(
      { label: "def:foo" },
      "block.ts"
    );
    expect(entries.length).toBe(0);
  });
});

// ── formatPot ───────────────────────────────────────────────────

describe("formatPot", () => {
  test("formats valid POT with header", () => {
    const pot = formatPot(
      [{ source: "test.md", line: 1, msgid: "Hello world" , kind: "paragraph" }],
      { projectName: "test-folio" }
    );
    expect(pot).toContain('msgid "Hello world"');
    expect(pot).toContain('msgstr ""');
    expect(pot).toContain("Project-Id-Version: test-folio");
    expect(pot).toContain("#: test.md:1");
  });

  test("deduplicates entries with same msgid", () => {
    const pot = formatPot([
      { source: "a.md", line: 1, msgid: "Same text" , kind: "paragraph" },
      { source: "b.md", line: 5, msgid: "Same text" , kind: "paragraph" },
    ]);
    // Should appear once as msgid, but with two #: references
    const matches = pot.match(/msgid "Same text"/g);
    expect(matches?.length).toBe(1);
    expect(pot).toContain("#: a.md:1");
    expect(pot).toContain("#: b.md:5");
  });

  test("adds python-brace-format flag for Liquid vars", () => {
    const pot = formatPot([
      { source: "t.md", line: 1, msgid: "Count: {lqd_count}" , kind: "paragraph" },
    ]);
    expect(pot).toContain("#, python-brace-format");
  });
});

// ── parsePo ─────────────────────────────────────────────────────

describe("parsePo", () => {
  test("parses simple PO file", () => {
    const po = `
msgid ""
msgstr ""
"Language: fr\\n"

msgid "Hello world"
msgstr "Bonjour le monde"

msgid "Goodbye"
msgstr "Au revoir"
`;
    const translations = parsePo(po);
    expect(translations.get("Hello world")).toBe("Bonjour le monde");
    expect(translations.get("Goodbye")).toBe("Au revoir");
  });

  test("skips fuzzy entries", () => {
    const po = `
msgid "Clear"
msgstr "Clair"

#, fuzzy
msgid "Uncertain"
msgstr "Incertain"
`;
    const translations = parsePo(po);
    expect(translations.get("Clear")).toBe("Clair");
    expect(translations.has("Uncertain")).toBe(false);
  });

  test("skips entries with empty msgstr", () => {
    const po = `
msgid "Translated"
msgstr "Traduit"

msgid "Untranslated"
msgstr ""
`;
    const translations = parsePo(po);
    expect(translations.get("Translated")).toBe("Traduit");
    expect(translations.has("Untranslated")).toBe(false);
  });
});

// ── injectMarkdown ──────────────────────────────────────────────

describe("injectMarkdown", () => {
  test("injects heading translations", () => {
    const translations = new Map([["Main Title", "Titre principal"]]);
    const result = injectMarkdown("# Main Title\n\nContent.\n", translations);
    expect(result.translated).toContain("# Titre principal");
    expect(result.changed).toBe(true);
  });

  test("injects paragraph translations", () => {
    const translations = new Map([
      ["First paragraph.", "Premier paragraphe."],
      ["Second paragraph.", "Deuxième paragraphe."],
    ]);
    const result = injectMarkdown(
      "First paragraph.\n\nSecond paragraph.\n",
      translations
    );
    expect(result.translated).toContain("Premier paragraphe.");
    expect(result.translated).toContain("Deuxième paragraphe.");
  });

  test("preserves untranslated content", () => {
    const translations = new Map([["Known", "Connu"]]);
    const result = injectMarkdown(
      "Known\n\nUnknown text here.\n",
      translations
    );
    expect(result.translated).toContain("Connu");
    expect(result.translated).toContain("Unknown text here.");
  });

  test("preserves code blocks", () => {
    const translations = new Map([
      ["Before code.", "Avant le code."],
      ["After code.", "Après le code."],
    ]);
    const result = injectMarkdown(
      "Before code.\n\n```\nconst x = 1;\n```\n\nAfter code.\n",
      translations
    );
    expect(result.translated).toContain("Avant le code.");
    expect(result.translated).toContain("const x = 1;");
    expect(result.translated).toContain("Après le code.");
  });

  test("restores Liquid variables", () => {
    const translations = new Map([
      ["There are {lqd_count} items", "Il y a {lqd_count} éléments"],
    ]);
    const result = injectMarkdown(
      "There are {{ count }} items\n",
      translations
    );
    expect(result.translated).toContain("Il y a {{ count }} éléments");
  });

  test("reports statistics", () => {
    const translations = new Map([["Hello", "Bonjour"]]);
    const result = injectMarkdown(
      "Hello\n\nWorld is big.\n",
      translations
    );
    expect(result.stats.translatedSpans).toBe(1);
    expect(result.stats.untranslatedSpans).toBe(1);
  });
});

// ── The blank line is part of the document (bean `rmor`) ────────
//
// Every test in the block above asserts with `toContain`, and that is exactly
// why this defect lived: `toContain` cannot see a blank line that is gone. The
// final filter read `outLines.filter((line) => line !== "")` under a comment
// saying it removed blank lines "introduced by paragraph collapse", and it
// removed every empty line in the document. `src/tools/translation.ts` writes
// the result to disk, so `translation_inject` could not produce a usable page
// for any document with more than one block.
//
// Structure is asserted here rather than substrings, in both directions: the
// blanks must survive, AND the paragraph must still collapse. A fix that
// preserved blank lines by not collapsing at all would satisfy the first and
// silently remove the feature.

describe("a link target keeps its Liquid", () => {
  // smart-trust#158: a home page linked the onboarding game as
  // `.../onboarding-game/{{game_lang}}`. The msgid was right, but the target
  // was recorded after Liquid output had become a placeholder, so every
  // translated page linked to `.../onboarding-game/<NUL>LQD0<NUL>`.
  test("Liquid output in a target is restored as written", () => {
    const source = "Play [the game](https://example.org/game/{{game_lang}}) now.";
    const result = injectMarkdown(source, new Map([["Play <a0>the game</a0> now.", "Jouez à <a0>le jeu</a0> maintenant."]]));
    expect(result.translated).toBe("Jouez à [le jeu](https://example.org/game/{{game_lang}}) maintenant.");
  });

  test("a Liquid tag in a target is restored as written, and is still not in the msgid", () => {
    const source = 'Play [the game](https://example.org/game/{% if page.lang %}?lang={{ page.lang }}{% endif %}) now.';
    expect(cleanMarkdownText(source)).toBe("Play <a0>the game</a0> now.");
    const result = injectMarkdown(source, new Map([["Play <a0>the game</a0> now.", "Jouez à <a0>le jeu</a0> maintenant."]]));
    expect(result.translated).toBe('Jouez à [le jeu](https://example.org/game/{% if page.lang %}?lang={{ page.lang }}{% endif %}) maintenant.');
  });

  test("Liquid in the text, outside any target, is unchanged", () => {
    expect(cleanMarkdownText("{% if x %}See [it](a.html) for {{ site.title }}.{% endif %}")).toBe("See <a0>it</a0> for {lqd_site.title}.");
  });
});

describe("injectMarkdown preserves document structure", () => {
  test("the author's blank lines survive — all three of them", () => {
    // The bean's own fixture, byte for byte. Measured before the fix: 3 blank
    // lines in, 0 out; the heading ran into the paragraph, the paragraph into
    // the list, and the trailing paragraph was absorbed by the list.
    const source = "# Title\n\nFirst paragraph here.\n\n- item one\n- item two\n\nSecond paragraph here.";
    const result = injectMarkdown(source, new Map([["Title", "Titre"]]));
    const blanks = (s: string): number => s.split("\n").filter((l) => l.trim() === "").length;
    expect(blanks(source)).toBe(3);
    expect(blanks(result.translated)).toBe(3);
    // And the whole document, so nothing else moved either.
    expect(result.translated).toBe(
      "# Titre\n\nFirst paragraph here.\n\n- item one\n- item two\n\nSecond paragraph here.",
    );
  });

  test("a wrapped paragraph STILL collapses to one line", () => {
    // The other half of the falsifier. Preserving blank lines by not collapsing
    // would pass the test above and remove the feature.
    const source = "A sentence that was\nhard wrapped across\nthree source lines.";
    const result = injectMarkdown(
      source,
      new Map([["A sentence that was hard wrapped across three source lines.", "Une phrase repliée."]]),
    );
    expect(result.translated).toBe("Une phrase repliée.");
    expect(result.translated.split("\n")).toHaveLength(1);
    expect(result.changed).toBe(true);
  });

  test("collapsing a multi-line continuation leaves no blank line inside the list", () => {
    // The second defect the same mechanism caused, and the two INTERACTED in a way
    // worth writing down: blanking put a blank line inside the list, and the global
    // filter then swept it away. So the list damage was MASKED by the blank-line
    // destruction, and fixing only the filter would have exposed it.
    //
    // Measured on this exact fixture with blanking kept and the global filter
    // removed: `"- an item\nsuite traduite\n\n- second item"` — a blank line inside
    // the list, which makes the list LOOSE and changes how every item renders.
    //
    // **This test does not discriminate against the old code as a whole**, and
    // saying so is the point: with both defects present the final output matches,
    // because the second hid the first. What it guards is a future "fix" that makes
    // the filter precise while still emptying lines — the obvious half-repair.
    //
    // The continuation is part of the ITEM (bean `lvk9`), so the catalogue's
    // msgid is the joined item; this fixture used to key the continuation alone,
    // which is the injector-side half of that defect.
    const source = "- an item\n  continued line one\n  continued line two\n- second item";
    const result = injectMarkdown(
      source,
      new Map([["an item continued line one continued line two", "article traduit"]]),
    );
    expect(result.translated).toBe("- article traduit\n- second item");
    expect(result.translated).not.toContain("\n\n");
  });

  test("a document with NO translation is returned unchanged, byte for byte", () => {
    // The cheapest guard against the whole class: if nothing is translated,
    // nothing may move.
    const source = "# Heading\n\nA paragraph.\n\n- one\n- two\n\n\nDouble blank above.\n";
    const result = injectMarkdown(source, new Map());
    expect(result.translated).toBe(source);
    expect(result.changed).toBe(false);
  });

  test("over the REAL corpus: injection never changes the blank-line count", () => {
    // 62 (catalogue, source) pairs in this layer. A fixture proves the
    // mechanism; only the corpus says whether any real page trips it. Measured
    // before the fix: the old filter would have destroyed 3,871 blank lines
    // across these same pairs.
    const root = resolve(HARNESS_ROOT);
    const docs = siteRoot(root);
    expect(docs).toBeDefined();
    const { pages, locales } = publishedPairs(docs!, supportedLocales(root), sourceLocale(root), {
      instanceRoot: root,
    });
    const blanks = (s: string): number => s.split("\n").filter((l) => l.trim() === "").length;
    let pairs = 0;
    let injected = 0;
    let collapsed = 0;
    for (const page of pages) {
      const srcFile = join(docs!, `${page}.md`);
      if (!existsSync(srcFile)) continue;
      const source = readFileSync(srcFile, "utf-8");
      for (const locale of locales) {
        // A catalogue path MIRRORS the page path — the owner's decision of
        // 2026-09-27 on bean `9rnf`. This composed a basename when it was
        // written, with a comment recording that as an open question; the
        // question is answered, so the test follows rather than keeping a
        // convention the code no longer uses.
        const po = join(root, "translations", locale, `${page}.po`);
        if (!existsSync(po)) continue;
        pairs++;
        const result = injectMarkdown(source, parsePo(readFileSync(po, "utf-8")));
        expect(blanks(result.translated)).toBe(blanks(source));
        if (result.translated !== source) injected++;
        if (result.translated.split("\n").length < source.split("\n").length) collapsed++;
      }
    }
    // Anti-vacuity, both ways: the loop must have run, and injection must have
    // done something on every pair rather than passing by doing nothing.
    // 55 since moves M6–M8 took pages, and their catalogues, up a layer.
    // Collapsing is counted over the corpus, not per pair: a catalogue whose
    // wrapped paragraphs `translation:obsolete` retired after the source
    // changed holds only one-line entries, so nothing in it can collapse until
    // the page is translated again (cat-harness start/contributing, 2026-10-31).
    expect(pairs).toBeGreaterThanOrEqual(55);
    expect(injected).toBe(pairs);
    expect(collapsed).toBeGreaterThan(0);
  });
});

// ── A wrapped list item or blockquote is ONE unit on both sides ──
//
// The extractor joins a list item, or a run of `>` lines at one depth, across
// the lines it wraps over and writes ONE msgid (bean `lvk9`). The injector kept
// its own state machine, which looked each list or quote line up on its own:
// the first line's half-sentence is in no catalogue, the continuation is not a
// list line at all, and the page came out in English. Found by the ar
// translator on injected pages whose `.po` was complete. Asserted on the whole
// output, because `toContain` would pass with the English continuation still
// sitting under the item.

describe("injectMarkdown translates a wrapped list item and blockquote whole", () => {
  const source = [
    "Intro paragraph that is short.",
    "",
    "- The first item of the list wraps",
    "  onto a second line here.",
    "  1. A nested item that also wraps",
    "     across two lines.",
    "- An item whose continuation starts with markup:",
    "  **bold words** and a [link](https://example.org/x).",
    "",
    "> A quoted sentence that wraps",
    "> onto the next quoted line.",
    "",
    "Outro paragraph that is short.",
    "",
  ].join("\n");

  const po = [
    'msgid ""',
    'msgstr ""',
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    "",
    'msgid "The first item of the list wraps onto a second line here."',
    'msgstr "العنصر الأول من القائمة يلتف على سطر ثانٍ هنا."',
    "",
    'msgid "A nested item that also wraps across two lines."',
    'msgstr "عنصر متداخل يلتف أيضًا عبر سطرين."',
    "",
    'msgid "An item whose continuation starts with markup: bold words and a <a0>link</a0>."',
    'msgstr "عنصر يبدأ استمراره بترميز: كلمات عريضة و<a0>رابط</a0>."',
    "",
    'msgid "A quoted sentence that wraps onto the next quoted line."',
    'msgstr "جملة مقتبسة تلتف على السطر المقتبس التالي."',
    "",
  ].join("\n");

  test("the catalogue's msgids are the joined units the extractor writes", () => {
    const ids = extractMarkdown(source, "page.md").map((e) => [e.kind, e.msgid]);
    expect(ids).toEqual([
      ["paragraph", "Intro paragraph that is short."],
      ["list-item", "The first item of the list wraps onto a second line here."],
      ["list-item", "A nested item that also wraps across two lines."],
      [
        "list-item",
        "An item whose continuation starts with markup: bold words and a <a0>link</a0>.",
      ],
      ["blockquote", "A quoted sentence that wraps onto the next quoted line."],
      ["paragraph", "Outro paragraph that is short."],
    ]);
  });

  test("every wrapped unit is translated whole, under its own marker and indentation", () => {
    const result = injectMarkdown(source, parsePo(po));
    expect(result.translated).toBe(
      [
        "Intro paragraph that is short.",
        "",
        "- العنصر الأول من القائمة يلتف على سطر ثانٍ هنا.",
        "  1. عنصر متداخل يلتف أيضًا عبر سطرين.",
        "- عنصر يبدأ استمراره بترميز: كلمات عريضة و[رابط](https://example.org/x).",
        "",
        "> جملة مقتبسة تلتف على السطر المقتبس التالي.",
        "",
        "Outro paragraph that is short.",
        "",
      ].join("\n"),
    );
    expect(result.stats).toEqual({ totalSpans: 6, translatedSpans: 4, untranslatedSpans: 2 });
  });

  test("a depth change inside a quote is a separate unit", () => {
    const md = "> Outer quote that\n> wraps here.\n>> Inner quote that\n>> wraps too.\n";
    const result = injectMarkdown(
      md,
      new Map([
        ["Outer quote that wraps here.", "اقتباس خارجي."],
        ["Inner quote that wraps too.", "اقتباس داخلي."],
      ]),
    );
    expect(result.translated).toBe("> اقتباس خارجي.\n>> اقتباس داخلي.\n");
  });
});

// ── Round-trip: extract → format → parse → inject ───────────────

describe("round-trip", () => {
  test("extract → format → parse → inject preserves structure", () => {
    const source = [
      "---",
      "title: Test Page",
      "---",
      "",
      "# Introduction",
      "",
      "This is the first paragraph of the test page.",
      "",
      "## Details",
      "",
      "- First item in the list",
      "- Second item in the list",
      "",
      "```typescript",
      "const x = 42;",
      "```",
      "",
      "> A blockquote for emphasis.",
      "",
      "| Column A | Column B |",
      "|---|---|",
      "| Cell one | Cell two |",
      "",
      "Final paragraph.",
      "",
    ].join("\n");

    // Step 1: Extract
    const entries = extractMarkdown(source, "test-page.md");
    expect(entries.length).toBeGreaterThan(0);

    // Step 2: Format POT
    const pot = formatPot(entries, { projectName: "test" });
    expect(pot).toContain("msgid");

    // Step 3: Create a fake PO with French translations
    const frTranslations = new Map<string, string>();
    for (const entry of entries) {
      frTranslations.set(entry.msgid, `[FR] ${entry.msgid}`);
    }

    // Step 4: Inject
    const result = injectMarkdown(source, frTranslations);
    expect(result.changed).toBe(true);

    // Verify structure preserved
    expect(result.translated).toContain("```"); // code block preserved
    expect(result.translated).toContain("const x = 42;"); // code content preserved
    expect(result.translated).toContain("---"); // front matter preserved
    expect(result.translated).toContain("[FR] Introduction"); // heading translated
    expect(result.translated).toContain("[FR] First item in the list"); // list item translated
    expect(result.translated).toContain("[FR] A blockquote for emphasis."); // blockquote translated
  });
});

// ── Bean h11k: G1, G3, G4, G5 ───────────────────────────────────

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { poContextKey } from "./po-inject";
import { renderBlockMarkdown, buildDocumentMarkdown } from "./render-markdown";
import { renderBlock } from "./render-latex";
import { measureBlock, buildReport } from "./translation-block-qa";

describe("bean h11k — G1: math protection through extraction and injection", () => {
  test("inline math with asterisks $a*b*c$ is preserved verbatim", () => {
    expect(cleanMarkdownText("Let $a*b*c$ be the product.")).toBe(
      "Let $a*b*c$ be the product.",
    );
    expect(cleanMarkdownText("We have $f^* \\circ g^*$ and *italic* text.")).toBe(
      "We have $f^* \\circ g^*$ and italic text.",
    );
  });

  test("subscripts after closing braces in math survive", () => {
    const src = "The group $\\pi_K = \\pi_1(S^3 \\setminus K)$ has presentation $\\langle g_1\\rangle_{i_0}$.";
    expect(cleanMarkdownText(src)).toBe(src);
  });

  test("multi-line display math $$...$$ is skipped as a block, never split on '- x + y'", () => {
    const md = [
      "Consider the system:",
      "",
      "$$",
      "\\begin{aligned}",
      "  f(x) &= x^2 \\\\",
      "  - x + y &= 0",
      "\\end{aligned}",
      "$$",
      "",
      "where $x, y \\in \\mathbb{R}$.",
    ].join("\n");

    const entries = extractMarkdown(md, "sys.md");
    expect(entries.map((e) => e.msgid)).toEqual([
      "Consider the system:",
      "where $x, y \\in \\mathbb{R}$.",
    ]);

    const po = new Map([
      ["Consider the system:", "Considérons le système :"],
      ["where $x, y \\in \\mathbb{R}$.", "où $x, y \\in \\mathbb{R}$."],
    ]);
    const res = injectMarkdown(md, po);
    expect(res.translated).toContain("Considérons le système :");
    expect(res.translated).toContain("  - x + y &= 0");
    expect(res.translated).toContain("où $x, y \\in \\mathbb{R}$.");
  });

  test("pure-math strings are excluded by isTranslatable", () => {
    expect(isTranslatable("$x^2 + y^2 = z^2$")).toBe(false);
    expect(isTranslatable("$$\\int_0^1 f(x)\\,dx$$")).toBe(false);
    expect(isTranslatable("Let $x > 0$ be positive.")).toBe(true);
  });

  test("table cell containing $|\\psi|^2$ is not split at the pipe", () => {
    const md = [
      "| Quantity | Expression |",
      "|---|---|",
      "| Probability density | The norm $|\\psi|^2$ vanishes at the boundary |",
    ].join("\n");

    const entries = extractMarkdown(md, "table.md");
    expect(entries.map((e) => e.msgid)).toContain(
      "The norm $|\\psi|^2$ vanishes at the boundary",
    );

    const po = new Map([
      ["Quantity", "Quantité"],
      ["Expression", "Expression"],
      ["Probability density", "Densité de probabilité"],
      [
        "The norm $|\\psi|^2$ vanishes at the boundary",
        "La norme $|\\psi|^2$ s'annule sur le bord",
      ],
    ]);
    const res = injectMarkdown(md, po);
    expect(res.translated).toContain(
      "| Densité de probabilité | La norme $|\\psi|^2$ s'annule sur le bord |",
    );
  });
});

describe("bean h11k — G3: inline-code and link placeholders", () => {
  test("extracts {code0}, {code1} and <a0>...</a0> and restores them on inject", () => {
    const md = "Call `compute(x)` and `verify(y)` as described in [Section 2](#sec:two).\n";
    const entries = extractMarkdown(md, "api.md");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.msgid).toBe(
      "Call {code0} and {code1} as described in <a0>Section 2</a0>.",
    );

    const pot = formatPot(entries);
    expect(pot).toContain("#, python-brace-format");

    const po = new Map([
      [
        "Call {code0} and {code1} as described in <a0>Section 2</a0>.",
        "Appelez {code0} puis {code1} comme décrit dans la <a0>Section 2</a0>.",
      ],
    ]);
    const res = injectMarkdown(md, po);
    expect(res.translated.trim()).toBe(
      "Appelez `compute(x)` puis `verify(y)` comme décrit dans la [Section 2](#sec:two).",
    );
  });

  test("preserves standalone image ![alt](src) wrapper on inject", () => {
    const md = "![Architecture overview](assets/arch.svg)\n";
    const entries = extractMarkdown(md, "fig.md");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.msgid).toBe("Architecture overview");

    const po = new Map([["Architecture overview", "Vue d'ensemble de l'architecture"]]);
    const res = injectMarkdown(md, po);
    expect(res.translated.trim()).toBe(
      "![Vue d'ensemble de l'architecture](assets/arch.svg)",
    );
  });
});

describe("bean h11k — G4: extractFromManifest on objects, .ts sources, and QA pipeline", () => {
  test("extracts title, caption, narrative, simulator views, and section titles with msgctxt", () => {
    const tsSource = `
import { simulator } from "../schema/builders";

export default simulator({
  label: "sim:wave-packet",
  title: "Wave-Packet Dispersion",
  caption: "Time evolution of $|\\\\psi(x, t)|^2$ under free propagation.",
  narrative: "Adjust the initial momentum $k_0$ to observe dispersion.",
  defaultView: {
    title: "Gaussian wave packet",
  },
  views: [
    { name: "narrow", title: "Narrow barrier" },
    { name: "wide", title: "Wide barrier" },
  ],
});
`;
    const entries = extractFromManifest(tsSource, "wave-packet.ts");
    expect(entries.map((e) => ({ msgid: e.msgid, msgctxt: e.msgctxt, kind: e.kind }))).toEqual([
      { msgid: "Wave-Packet Dispersion", msgctxt: "title", kind: "manifest-title" },
      {
        msgid: "Time evolution of $|\\psi(x, t)|^2$ under free propagation.",
        msgctxt: "caption",
        kind: "manifest-caption",
      },
      {
        msgid: "Adjust the initial momentum $k_0$ to observe dispersion.",
        msgctxt: "narrative.text",
        kind: "manifest-narrative",
      },
      { msgid: "Gaussian wave packet", msgctxt: "defaultView.title", kind: "manifest-title" },
      { msgid: "Narrow barrier", msgctxt: "views[0].title", kind: "manifest-title" },
      { msgid: "Wide barrier", msgctxt: "views[1].title", kind: "manifest-title" },
    ]);

    const pot = formatPot(entries);
    expect(pot).toContain('msgctxt "title"');
    expect(pot).toContain('msgctxt "caption"');
    expect(pot).toContain('msgctxt "narrative.text"');

    const parsed = parsePo(
      [
        'msgctxt "title"',
        'msgid "Wave-Packet Dispersion"',
        'msgstr "Dispersion du paquet d\'ondes"',
        "",
        'msgctxt "caption"',
        'msgid "Time evolution of $|\\psi(x, t)|^2$ under free propagation."',
        'msgstr "Évolution temporelle de $|\\psi(x, t)|^2$ en propagation libre."',
      ].join("\n"),
    );
    expect(parsed.get(poContextKey("title", "Wave-Packet Dispersion"))).toBe(
      "Dispersion du paquet d'ondes",
    );
    expect(parsed.get("Wave-Packet Dispersion")).toBe("Dispersion du paquet d'ondes");
  });

  test("measureBlock and buildReport include companion .ts manifest strings", () => {
    const dir = mkdtempSync(join(tmpdir(), "h11k-qa-"));
    try {
      const mdPath = join(dir, "thm.md");
      const tsPath = join(dir, "thm.ts");
      const poPath = join(dir, "fr.po");
      writeFileSync(
        tsPath,
        'export default theorem({ label: "thm:main", title: "Fundamental Theorem of Arithmetic" });\n',
      );
      writeFileSync(mdPath, "Every integer $n > 1$ factors uniquely into primes.\n");
      writeFileSync(
        poPath,
        [
          'msgid ""',
          'msgstr ""',
          '"Language: fr\\n"',
          "",
          'msgctxt "title"',
          'msgid "Fundamental Theorem of Arithmetic"',
          'msgstr "Théorème fondamental de l\'arithmétique"',
          "",
          'msgid "Every integer $n > 1$ factors uniquely into primes."',
          'msgstr "Tout entier $n > 1$ se factorise de manière unique en nombres premiers."',
        ].join("\n"),
      );

      const m = measureBlock(
        readFileSync(mdPath, "utf-8"),
        "thm.md",
        parsePo(readFileSync(poPath, "utf-8")),
        new Map(),
        readFileSync(tsPath, "utf-8"),
        "thm.ts",
      );
      expect(m.total).toBe(2);
      expect(m.translated).toBe(2);

      const report = buildReport(mdPath, "thm:main", "fr", [poPath]);
      expect(report).toBeDefined();
      expect(report!.criteria["translation-coverage"]![0]!.metrics).toMatchObject({
        translated: 2,
        total: 2,
        pct: 100,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("bean h11k — G5: translated block render path (Markdown & LaTeX)", () => {
  test("renderBlockMarkdown and renderBlock translate block title, caption, kind heading, and .md body", () => {
    const translations = parsePo(
      [
        'msgctxt "title"',
        'msgid "Noether\'s Theorem"',
        'msgstr "Théorème de Noether"',
        "",
        'msgid "Every differentiable symmetry of the action $S$ yields a conserved current {code0}."',
        'msgstr "Chaque symétrie différentiable de l\'action $S$ engendre un courant conservé {code0}."',
      ].join("\n"),
    );

    const entry = {
      block: {
        kind: "theorem" as const,
        label: "thm:noether",
        title: "Noether's Theorem",
      } as never,
      mdContent:
        "Every differentiable symmetry of the action $S$ yields a conserved current `j^mu`.\n",
    };

    const mdOut = renderBlockMarkdown(entry, { locale: "fr", translations });
    expect(mdOut).toContain('<span class="fa-block-kind">Théorème</span> **Théorème de Noether.**');
    expect(mdOut).toContain(
      "Chaque symétrie différentiable de l'action $S$ engendre un courant conservé `j^mu`.",
    );

    const texOut = renderBlock(
      entry.block,
      entry.mdContent,
      undefined,
      "noether",
      undefined,
      { locale: "fr", translations },
    );
    expect(texOut).toContain("\\begin{theorem}[{Théorème de Noether}]");
    expect(texOut).toContain(
      "Chaque symétrie différentiable de l'action $S$ engendre un courant conservé \\texttt{j\\textasciicircum{}mu}.",
    );
  });

  test("buildDocumentMarkdown resolves translations/<locale>/*.po via resolvePoSources and renders translated document", async () => {
    const dir = mkdtempSync(join(tmpdir(), "h11k-doc-"));
    try {
      const docDir = join(dir, "folio", "guideline");
      const chDir = join(docDir, "ch1");
      const trDir = join(dir, "translations", "fr");
      mkdirSync(chDir, { recursive: true });
      mkdirSync(trDir, { recursive: true });

      writeFileSync(
        join(docDir, "guideline.ts"),
        `export default { title: "Clinical Guideline", chapters: [{ dir: "ch1" }] };\n`,
      );
      writeFileSync(
        join(chDir, "ch1.ts"),
        `export default {
          title: "Chapter One",
          label: "ch:one",
          sections: [
            {
              title: "First Section",
              label: "sec:first",
              blocks: ["def-care"],
            },
          ],
        };\n`,
      );
      writeFileSync(
        join(chDir, "def-care.ts"),
        `export default {
          kind: "definition",
          label: "def:care",
          title: "Continuity of Care",
        };\n`,
      );
      writeFileSync(
        join(chDir, "def-care.md"),
        "Care is coordinated across `L1` and [clinical teams](#sec:first) with rate $\\alpha*\\beta$.\n",
      );

      writeFileSync(
        join(trDir, "ch1.po"),
        [
          'msgid ""',
          'msgstr ""',
          '"Language: fr\\n"',
          "",
          'msgctxt "title"',
          'msgid "Clinical Guideline"',
          'msgstr "Directive clinique"',
          "",
          'msgctxt "title"',
          'msgid "Chapter One"',
          'msgstr "Chapitre premier"',
          "",
          'msgctxt "title"',
          'msgid "First Section"',
          'msgstr "Première section"',
          "",
          'msgctxt "title"',
          'msgid "Continuity of Care"',
          'msgstr "Continuité des soins"',
          "",
          'msgid "Care is coordinated across {code0} and <a0>clinical teams</a0> with rate $\\alpha*\\beta$."',
          'msgstr "Les soins sont coordonnés entre {code0} et les <a0>équipes cliniques</a0> au taux $\\alpha*\\beta$."',
        ].join("\n"),
      );

      const built = await buildDocumentMarkdown(join(docDir, "guideline.ts"), {
        locale: "fr",
        folioRoot: dir,
      });

      expect(built.issues).toEqual([]);
      expect(built.markdown).toContain("# Directive clinique");
      expect(built.markdown).toContain("## Chapitre premier");
      expect(built.markdown).toContain("### Première section");
      expect(built.markdown).toContain('<span class="fa-block-kind">Définition</span> **Continuité des soins.**');
      expect(built.markdown).toContain(
        "Les soins sont coordonnés entre `L1` et les [équipes cliniques](#sec:first) au taux $\\alpha*\\beta$.",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
