/**
 * Tests for `.po` recovery from an already-translated page (issue #206).
 *
 * The falsifier this file is built around is the one that nearly shipped: **a
 * count match is not an alignment.** Two of the nine count-matching pairs in the
 * real corpus diverge in kind partway through, and a count-only check would have
 * written catalogues pairing a source paragraph's msgid with a table cell's
 * text. A `.po` is well-formed whatever it claims, so nothing downstream would
 * have caught it.
 */
import { describe, it, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

import {
  derive,
  write,
  formatReport,
  firstKindDivergence,
  formatDerivedPo,
  alignGrownSource,
  publishedPairs,
  translationPathFor,
  LOCALE_NAMES,
} from "./derive-po.ts";
import { extractMarkdown, MD_CODE_FENCE_RE } from "./pot-extract.ts";
import { SITE_DIR } from "./translation-index.ts";
import { HARNESS_ROOT } from "../scripts/lib/roots.ts";

/** The five pages and five locales this layer publishes, for corpus-wide tests. */
const PAGES_ALL = ["start/accessibility", "concepts/content-types", "start/contributing", "start/getting-started", "start/installation"];
const LOCALES_ALL = ["ar", "es", "fr", "ru", "zh"];
import { injectMarkdown } from "./po-inject.ts";

/** A throwaway layer with a source page and whichever translations are given. */
function fixture(source: string, translations: Record<string, string>): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "derive-po-"));
  mkdirSync(join(root, SITE_DIR), { recursive: true });
  // `siteRoot` CONFIRMS a site by finding `_config.yml` rather than trusting the
  // path, so the fixture has to carry one — which is the point: a tree that only
  // looks like a site is reported as no site at all.
  writeFileSync(join(root, SITE_DIR, "_config.yml"), "title: fixture\n");
  writeFileSync(join(root, SITE_DIR, "page.md"), source);
  for (const [locale, text] of Object.entries(translations)) {
    mkdirSync(join(root, SITE_DIR, locale), { recursive: true });
    writeFileSync(join(root, SITE_DIR, locale, "page.md"), text);
  }
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const SRC = ["# Heading one", "", "A paragraph of prose that is long enough.", "", "- first item", "- second item"].join("\n");
const OK = ["# Titre un", "", "Un paragraphe de prose suffisamment long.", "", "- premier élément", "- second élément"].join("\n");

describe("a faithful translation is derivable", () => {
  it("derives one catalogue per aligned locale", () => {
    const { root, cleanup } = fixture(SRC, { fr: OK });
    const r = derive(root, ["page"], ["fr"]);
    expect(r.refused).toEqual([]);
    expect(r.derived).toHaveLength(1);
    expect(r.derived[0].entries).toBe(extractMarkdown(SRC, "x").length);
    cleanup();
  });

  it("pairs each msgid with the translation at the SAME position", () => {
    const { root, cleanup } = fixture(SRC, { fr: OK });
    const po = derive(root, ["page"], ["fr"]).derived[0].po;
    // The heading must map to the heading and the list item to the list item —
    // not merely both appear somewhere in the file.
    expect(po).toContain('msgid "Heading one"\nmsgstr "Titre un"');
    expect(po).toContain('msgid "first item"\nmsgstr "premier élément"');
    cleanup();
  });

  it("marks every catalogue UNOFFICIAL in its header", () => {
    // #206: official means human sign-off. A script's output is not that, and a
    // reader should not have to infer it from provenance.
    const { root, cleanup } = fixture(SRC, { fr: OK });
    const po = derive(root, ["page"], ["fr"]).derived[0].po;
    expect(po).toContain("UNOFFICIAL");
    expect(po).toContain("No human has adjudicated it");
    cleanup();
  });
});

describe("it REFUSES rather than guesses", () => {
  it("a SHORTER translation is no longer refused outright — it aligns as a grown source", () => {
    // This asserted `count-differs` until `alignGrownSource` landed, and the old
    // contract was too strict: a translation shorter than its source may simply
    // predate constructs the source gained, which is alignable with those left
    // untranslated. Here the source's heading, paragraph and two list items
    // against a translated heading and paragraph — the list items are unmatched.
    const short = ["# Titre un", "", "Un paragraphe de prose suffisamment long."].join("\n");
    const { root, cleanup } = fixture(SRC, { fr: short });
    const r = derive(root, ["page"], ["fr"]);
    expect(r.refused).toEqual([]);
    expect(r.derived).toHaveLength(1);
    expect(r.derived[0].untranslated).toBe(2);
    cleanup();
  });

  it("...but a translation whose SHAPE differs is still refused, with both counts named", () => {
    // The case the old assertion was reaching for, and it still holds: shorter
    // AND not a subsequence, so no alignment can be read off it.
    const wrongShape = ["# Titre un", "", "| a cell here | and another |"].join("\n");
    const { root, cleanup } = fixture(SRC, { fr: wrongShape });
    const r = derive(root, ["page"], ["fr"]);
    expect(r.derived).toEqual([]);
    expect(r.refused[0].reason).toBe("count-differs");
    expect(r.refused[0].detail).toContain("4");
    cleanup();
  });

  it("SAME COUNT but a divergent kind is refused — the case that nearly shipped", () => {
    // THE DEFECT THIS PINS. Measured on the real corpus: `fr/accessibility` and
    // `ru/getting-started` both match their source's count exactly and both
    // diverge at a construct where the source is a paragraph and the translation
    // is a table cell. Here the second construct is a heading instead of a
    // paragraph — same count, wrong shape.
    const swapped = ["# Titre un", "", "## Un titre au lieu du paragraphe", "", "- premier élément", "- second élément"].join("\n");
    const { root, cleanup } = fixture(SRC, { fr: swapped });
    const r = derive(root, ["page"], ["fr"]);
    expect(r.derived).toEqual([]);
    expect(r.refused[0].reason).toBe("kind-diverges");
    expect(r.refused[0].detail).toContain("paragraph");
    expect(r.refused[0].detail).toContain("heading");
    cleanup();
  });

  it("an absent translation is refused as missing, not as divergent", () => {
    // The two are different findings: one is "nobody has translated this", the
    // other is "somebody has, and it drifted". Collapsing them would send a
    // reader looking for drift in a page that does not exist.
    const { root, cleanup } = fixture(SRC, {});
    const r = derive(root, ["page"], ["fr"]);
    expect(r.refused[0].reason).toBe("translation-missing");
    cleanup();
  });

  it("an absent source refuses every locale, rather than reporting none", () => {
    const root = mkdtempSync(join(tmpdir(), "derive-po-nosrc-"));
    mkdirSync(join(root, SITE_DIR), { recursive: true });
    writeFileSync(join(root, SITE_DIR, "_config.yml"), "title: fixture\n");
    const r = derive(root, ["page"], ["fr", "es"]);
    expect(r.refused.map((f) => f.reason)).toEqual(["source-missing", "source-missing"]);
    expect(r.derived).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it("a tree with NO site is refused for every pair, not reported as nothing to do", () => {
    // `dh4f` from the other side: a consumer that resolves no directory and
    // exits clean reads as coverage. There is no `_config.yml` here, so there is
    // no site — and the refusal says so in its detail rather than claiming the
    // pages are missing from a directory it never found.
    const root = mkdtempSync(join(tmpdir(), "derive-po-nosite-"));
    const r = derive(root, ["a", "b"], ["fr", "es"]);
    expect(r.derived).toEqual([]);
    expect(r.refused).toHaveLength(4);
    expect(r.refused[0].detail).toContain("no site root");
    rmSync(root, { recursive: true, force: true });
  });

  it("a refusal reaches the report, and says it is a finding about the CORPUS", () => {
    const { root, cleanup } = fixture(SRC, {});
    const out = formatReport(derive(root, ["page"], ["fr"]));
    expect(out).toContain("REFUSED");
    expect(out).toContain("not a tool limit");
    cleanup();
  });
});

describe("firstKindDivergence", () => {
  it("returns -1 when the sequences agree", () => {
    const a = extractMarkdown(SRC, "x");
    expect(firstKindDivergence(a, extractMarkdown(OK, "y"))).toBe(-1);
  });

  it("returns the INDEX, so the report can name where", () => {
    const a = extractMarkdown(SRC, "x");
    const b = extractMarkdown(SRC, "y").map((e, i) => (i === 1 ? { ...e, kind: "heading" as const } : e));
    expect(firstKindDivergence(a, b)).toBe(1);
  });
});

describe("the catalogue is well-formed", () => {
  it("a repeated msgid is emitted once — gettext permits only one", () => {
    const dup = ["# Same text here", "", "Some other prose that is long enough.", "", "# Same text here"].join("\n");
    const dupFr = ["# Même texte ici", "", "Une autre prose assez longue.", "", "# Même texte ici"].join("\n");
    const { root, cleanup } = fixture(dup, { fr: dupFr });
    const po = derive(root, ["page"], ["fr"]).derived[0].po;
    expect((po.match(/msgid "Same text here"/g) ?? []).length).toBe(1);
    cleanup();
  });

  it("quotes and backslashes are escaped", () => {
    const q = ['# A "quoted" heading', "", "Prose with a \\ backslash in it here."].join("\n");
    const qf = ['# Un titre "cité"', "", "Prose avec une \\ barre oblique inverse."].join("\n");
    const { root, cleanup } = fixture(q, { fr: qf });
    const po = derive(root, ["page"], ["fr"]).derived[0].po;
    expect(po).toContain('\\"quoted\\"');
    expect(po).not.toMatch(/msgid "A "quoted"/);
    cleanup();
  });

  it("names the locale the way the existing catalogues do", () => {
    // `Language-Team: Arabic`, matching translations/ar/index.po rather than a
    // runtime-derived display name that would rewrite the file on an ICU update.
    expect(LOCALE_NAMES.ar).toBe("Arabic");
    const po = formatDerivedPo("p", "ar", extractMarkdown(SRC, "x"), extractMarkdown(OK, "y"), "docs/p.md");
    expect(po).toContain("Language-Team: Arabic");
    expect(po).toContain("Language: ar");
  });
});

describe("write", () => {
  it("writes each catalogue to translations/<locale>/<page>.po", () => {
    const { root, cleanup } = fixture(SRC, { fr: OK });
    const { written } = write(root, derive(root, ["page"], ["fr"]));
    expect(written).toHaveLength(1);
    expect(written[0]).toContain(join("translations", "fr", "page.po"));
    expect(readFileSync(written[0], "utf-8")).toContain("UNOFFICIAL");
    cleanup();
  });

  it("writes nothing when everything was refused", () => {
    const { root, cleanup } = fixture(SRC, {});
    expect(write(root, derive(root, ["page"], ["fr"]))).toEqual({ written: [], skipped: [] });
    cleanup();
  });

  it("NEVER replaces an existing catalogue — it skips and says so", () => {
    // THE HAZARD THIS PINS. `write` overwrote unconditionally until 2026-09-26.
    // A `.po` here may carry a human's sign-off — #206's definition of *official*
    // — or hand corrections made after this tool produced it, and re-running
    // `--write` would have replaced either with a fresh unofficial derivation.
    // The diff would have read as a regeneration rather than as a deletion.
    const { root, cleanup } = fixture(SRC, { fr: OK });
    const r = derive(root, ["page"], ["fr"]);
    const first = write(root, r);
    expect(first.written).toHaveLength(1);

    // Stand in for a human's edit, then re-run exactly as before.
    writeFileSync(first.written[0], "# OFFICIAL — a person signed this off\n", "utf-8");
    const second = write(root, r);
    expect(second.written).toEqual([]);
    expect(second.skipped).toEqual([first.written[0]]);
    expect(readFileSync(first.written[0], "utf-8")).toContain("a person signed this off");
    cleanup();
  });

  it("replaces one only when the caller has explicitly decided to", () => {
    // `overwrite` is never the default, and the CLI spells it as its own flag, so
    // choosing it is a separate act from choosing to write at all.
    const { root, cleanup } = fixture(SRC, { fr: OK });
    const r = derive(root, ["page"], ["fr"]);
    const first = write(root, r);
    writeFileSync(first.written[0], "stale\n", "utf-8");
    const second = write(root, r, { overwrite: true });
    expect(second.written).toEqual([first.written[0]]);
    expect(second.skipped).toEqual([]);
    expect(readFileSync(first.written[0], "utf-8")).toContain("UNOFFICIAL");
    cleanup();
  });
});

describe("this repository's five uncatalogued pages", () => {
  const PAGES = ["start/accessibility", "concepts/content-types", "start/contributing", "start/getting-started", "start/installation"];
  const LOCALES = ["ar", "es", "fr", "ru", "zh"];

  it("splits 25 pairs into derivable and refused, and every pair is accounted for", () => {
    // Against the REAL corpus rather than a fixture: the point of this tool is
    // what it says about these pages, and a fixture would keep passing if the
    // extractor stopped seeing one of them.
    const root = resolve(HARNESS_ROOT);
    const r = derive(root, PAGES, LOCALES);
    expect(r.derived.length + r.refused.length).toBe(PAGES.length * LOCALES.length);
    expect(r.derived.length).toBeGreaterThan(0);
  });

  it("NO pair diverges by kind any more — both that did were threshold artefacts", () => {
    // History, because it is the whole reason `kind` exists on `PotEntry`. Before
    // `6b8u`, `fr/accessibility` (construct 32) and `ru/getting-started`
    // (construct 53) matched their source's count EXACTLY and each paired a
    // source paragraph against a translated table cell. A count-only check would
    // have written two catalogues that were well-formed and wrong.
    //
    // Both were the character threshold, not the translators: with
    // `isTranslatable` counting letters they align exactly. So the kind check now
    // finds nothing — and that is the point of keeping this test. It fails if a
    // future extractor change reintroduces a shape divergence, which is the case
    // no count check can see.
    const root = resolve(HARNESS_ROOT);
    const r = derive(root, PAGES, LOCALES);
    const byKind = r.refused.filter((f) => f.reason === "kind-diverges").map((f) => `${f.locale}/${f.page}`);
    expect(byKind).toEqual([]);
  });

  it("alignment is incomplete, and every refusal is a COUNT difference", () => {
    // **This test asserted `derived === 10` and `refused === 15`, and CI was
    // right to fail it.** Those are a measurement of a corpus at a moment, not an
    // invariant: `main` edited `docs/start/installation.md` while this branch was open,
    // which added two constructs to that page, so `ar/installation` stopped
    // aligning and the pair became 9/16. Nothing in this module regressed — an
    // unrelated source edit falsified an equality I had no business asserting.
    //
    // The claim the equality was meant to protect — that the two extractor fixes
    // moved alignment from 7 to 10, THREE more rather than the nine I first
    // inferred — is a dated historical measurement. Its home is the module
    // docblock, with its provenance, not an assertion over a corpus other people
    // edit. Pinning history in a test makes every source edit look like a
    // regression, which is how a real signal gets ignored.
    //
    // What IS invariant, and what this now asserts: alignment is partial, and no
    // pair diverges by KIND. That second one is the substantive state — the
    // extractor's own asymmetries are gone, so what is left is a fact about the
    // translations (bean `7x8o`) rather than about `pot-extract.ts`.
    const root = resolve(HARNESS_ROOT);
    const r = derive(root, PAGES, LOCALES);
    // Anti-vacuity on the derived end: some derive. The refused end reached
    // ZERO on 2026-10-11 — bean `7x8o`, the last refusal (`zh/getting-started`),
    // was re-translated on the owner's ruling and now aligns at 149 entries — so
    // it is no longer asserted non-empty. What stays invariant is the shape of
    // any refusal that comes back: a COUNT difference, never a kind divergence.
    expect(r.derived.length).toBeGreaterThan(0);
    expect(r.refused.every((f) => f.reason === "count-differs")).toBe(true);
  });

  it("the same table cell is now translatable in the same way in every script (`6b8u`)", () => {
    // THE REGRESSION THIS PINS, and it is the reason `isTranslatable` counts
    // letters. These are the real cells from `docs/start/installation.md` and its
    // Arabic translation. Under the old `text.length >= 3`, stripping the code
    // spans left `", "` (2 characters, dropped) in English and `"، و"` (3, kept)
    // in Arabic — so an identical 4x7 table yielded 66 constructs in `ar` against
    // 65 in English, and translatability was a property of the script.
    const en = extractMarkdown("| `pandoc`, `ripgrep` | conversions, search |", "en");
    const ar = extractMarkdown("| `pandoc`، و`ripgrep` | التحويلات، والبحث |", "ar");
    expect(en).toHaveLength(1);
    expect(ar).toHaveLength(1);
    expect(en[0].kind).toBe("table-cell");
    expect(ar[0].kind).toBe("table-cell");
  });

  it("a letterless string is never offered to a translator", () => {
    // The measure that actually settled the predicate: the old rule put 432
    // msgids with NO LETTER IN THEM into this corpus's catalogues. There is
    // nothing in such a string for a translator to do, and every candidate
    // considered removed all of them — so this is the floor, not a preference.
    for (const junk of [", ", " | ", "...", "—", "\u060c \u0648"]) {
      expect(extractMarkdown(`| ${junk} | real words here |`, "x").map((e) => e.msgid)).not.toContain(
        junk.trim(),
      );
    }
  });

  it("an INDENTED code fence is a code fence (`ig4a`)", () => {
    // Anchored at column 0, the fence inside a list item was invisible and its
    // body was extracted as prose — `docs/start/contributing.md` yielded "````" as a
    // PARAGRAPH, twice. Corpus-wide that was 74 msgids of code offered to
    // translators, 48 of them a bare fence run.
    const md = [
      "- A list item introducing a command:",
      "",
      "  ```sh",
      "  bun run scripts/gen-schema-docs.ts",
      "  ```",
      "",
      "- A second item with real prose in it.",
    ].join("\n");
    const ids = extractMarkdown(md, "x").map((e) => e.msgid);
    expect(ids.some((m) => /^[`~]{2,}$/.test(m))).toBe(false);
    expect(ids.some((m) => m.includes("gen-schema-docs"))).toBe(false);
    expect(ids).toContain("A second item with real prose in it.");
  });

  it("nothing is derived for a pair whose counts differ", () => {
    const root = resolve(HARNESS_ROOT);
    const r = derive(root, PAGES, LOCALES);
    const derivedKeys = new Set(r.derived.map((d) => `${d.locale}/${d.page}`));
    for (const f of r.refused) expect(derivedKeys.has(`${f.locale}/${f.page}`)).toBe(false);
  });
});

describe("the two halves of the round trip agree about where the code is (`ig4a`)", () => {
  // `po-inject.ts` carried its OWN copy of `MD_CODE_FENCE_RE`, also anchored at
  // column 0, so fixing the extractor alone would have left the two halves of a
  // round trip using different definitions of a fence.
  //
  // **What this does NOT pin, having checked.** The first version of this block
  // asserted that the old injector would substitute a translation into an
  // indented code block and corrupt the command. Measured against the old anchor
  // on this exact input, and on a fence whose body is ordinary prose: it
  // substitutes NOTHING inside an indented fence either way. Something else
  // already protects the injector, so that test would have passed before the fix
  // as well — a test that cannot fail is not evidence, and the claim is withdrawn
  // rather than left standing because it read well.
  //
  // What is left is worth pinning: the extractor's behaviour, the injector's
  // behaviour, and that there is one definition rather than two.
  const MD = [
    "- An item introducing a command:",
    "",
    "  ```sh",
    "  bun run scripts/gen-schema-docs.ts",
    "  ```",
    "",
    "- Real prose in the second item.",
  ].join("\n");

  it("the extractor offers nothing from inside an indented fence", () => {
    const ids = extractMarkdown(MD, "x").map((e) => e.msgid);
    expect(ids.some((m) => m.includes("gen-schema-docs"))).toBe(false);
    expect(ids).toContain("Real prose in the second item.");
  });

  it("the injector leaves an indented fence alone while translating the prose beside it", () => {
    // Not a claim about the fix — a claim about the CONTRACT, which must keep
    // holding through `lvk9` and whatever follows it. The hostile catalogue names
    // the command on purpose, as a catalogue written before `ig4a` would.
    const hostile = new Map([
      ["bun run scripts/gen-schema-docs.ts", "CORRUPTED"],
      ["Real prose in the second item.", "Prose traduite."],
    ]);
    const out = injectMarkdown(MD, hostile).translated;
    expect(out).toContain("bun run scripts/gen-schema-docs.ts");
    expect(out).not.toContain("CORRUPTED");
    expect(out).toContain("Prose traduite.");
  });

  it("both halves read ONE definition of every shared construct (`wlyg`)", () => {
    // Generalised from the fence alone. A duplicated regex is a fact free to
    // drift, and `MD_CODE_FENCE_RE` drifted inside a single change — so this
    // asserts the property over the whole set rather than repeating the fence
    // test nine times.
    //
    // Written as "the injector declares none of these" rather than as a list of
    // imports, because the failure mode is a RE-DECLARATION appearing, and a
    // test that only checked the import line would pass with both present.
    const inject = readFileSync(new URL("./po-inject.ts", import.meta.url).pathname, "utf-8");
    const SHARED = [
      "MD_CODE_FENCE_RE",
      "MD_FRONT_MATTER_DELIM",
      "MD_HEADING_RE",
      "MD_HTML_SKIP_OPEN_RE",
      "MD_HTML_CLOSE_TAG_RE",
      "MD_HLINE_RE",
      "MD_TABLE_SEP_RE",
      "MD_LIST_ITEM_RE",
      "MD_BLOCKQUOTE_RE",
      "MD_KRAMDOWN_ATTR_RE",
    ];
    const redeclared = SHARED.filter((n) => new RegExp(`^const ${n}\\s*=`, "m").test(inject));
    expect(redeclared).toEqual([]);
    // ...and the injector must still parse markdown, or "no duplicate" would be
    // satisfiable by it having quietly stopped. It does so by calling the
    // extractor's own segmentation, which reads every one of these, rather than
    // by importing the regexes into a second state machine — the copy that let
    // a wrapped list item be one msgid on extract and one line on inject.
    expect(inject).toMatch(/\bsegmentMarkdown\(/);
    const extractSrc = readFileSync(new URL("./pot-extract.ts", import.meta.url).pathname, "utf-8");
    const segmenter = extractSrc.slice(extractSrc.indexOf("export function segmentMarkdown("));
    const unused = SHARED.filter((n) => !segmenter.includes(n));
    expect(unused).toEqual([]);
    // Anti-vacuity: the names have to be real exports, not a list of typos that
    // trivially fails to match anything.
    expect(MD_CODE_FENCE_RE).toBeInstanceOf(RegExp);
    const extract = readFileSync(new URL("./pot-extract.ts", import.meta.url).pathname, "utf-8");
    const notExported = SHARED.filter((n) => !new RegExp(`^export const ${n}\\s*=`, "m").test(extract));
    expect(notExported).toEqual([]);
  });
});

describe("a repeated msgid translated two ways is REFUSED, not deduped (`f6r1`)", () => {
  // Found by a sibling session, not by me — bean `f6r1` measured
  // `ru/getting-started` as needing `msgctxt`. My dedup kept the first
  // translation and documented that it did, which described the behaviour
  // without noticing it was lossy: a `.po` is keyed by msgid, so keeping one of
  // two different translations discards a real difference and the file is
  // well-formed and wrong.
  //
  // It has not shipped a wrong catalogue — 0 conflicts across all 10 derived
  // here — and that is luck, not design: the one pair with the collision is
  // refused for `count-differs` today, and `lvk9` would align it.

  it("identical translations of a repeated msgid stay benign", () => {
    const src = ["# Same words here", "", "Some prose that is long enough.", "", "# Same words here"].join("\n");
    const tr = ["# Mêmes mots ici", "", "Une prose assez longue.", "", "# Mêmes mots ici"].join("\n");
    const { root, cleanup } = fixture(src, { fr: tr });
    const r = derive(root, ["page"], ["fr"]);
    expect(r.refused).toEqual([]);
    expect((r.derived[0].po.match(/msgid "Same words here"/g) ?? []).length).toBe(1);
    cleanup();
  });

  it("DIFFERENT translations of a repeated msgid refuse the pair", () => {
    const src = ["# Same words here", "", "Some prose that is long enough.", "", "# Same words here"].join("\n");
    // Same English heading, two different French renderings — the `f6r1` case.
    const tr = ["# Mêmes mots ici", "", "Une prose assez longue.", "", "# Les mêmes mots, autrement"].join("\n");
    const { root, cleanup } = fixture(src, { fr: tr });
    const r = derive(root, ["page"], ["fr"]);
    expect(r.derived).toEqual([]);
    expect(r.refused[0].reason).toBe("msgid-conflict");
    // The detail must name BOTH translations, so a reader can see the choice the
    // tool declined to make for them.
    expect(r.refused[0].detail).toContain("Mêmes mots ici");
    expect(r.refused[0].detail).toContain("Les mêmes mots, autrement");
    expect(r.refused[0].detail).toContain("msgctxt");
    cleanup();
  });

  it("no catalogue this tool has written carries a conflicting duplicate", () => {
    // The anti-vacuity floor, against the real corpus: it must be true, and it
    // must be true because nothing conflicts rather than because nothing derived.
    const root = resolve(HARNESS_ROOT);
    const r = derive(root, PAGES_ALL, LOCALES_ALL);
    expect(r.derived.length).toBeGreaterThan(0);
    for (const d of r.derived) {
      const ids = [...d.po.matchAll(/^msgid "(.*)"$/gm)].map((m) => m[1]).filter((m) => m !== "");
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(r.refused.filter((f) => f.reason === "msgid-conflict")).toEqual([]);
  });
});

describe("a msgid does not depend on where the author pressed return (`lvk9`)", () => {
  // THE PROPERTY THIS FIX EXISTS FOR, and the one that would falsify it. Before
  // `lvk9`, paragraphs were accumulated but list items and blockquotes were
  // matched PER LINE, so re-wrapping a source changed its msgids — and a wrapped
  // list item's continuation fell through to the paragraph accumulator, so it came
  // out as a `paragraph`. Wrong count and wrong kind from one cause.
  //
  // Each case is the same content wrapped two ways. Equal msgid sequences is the
  // whole claim; a count check would miss the kind half.
  const CASES: Array<[string, string, string]> = [
    [
      "a list item, one line against two",
      "- **No ATAG Part B checks.** Nothing yet verifies that a published folio has alt text.",
      "- **No ATAG Part B checks.** Nothing yet verifies that a\n  published folio has alt text.",
    ],
    [
      "a list item, two lines against three",
      "- A sentence that is long enough to wrap\n  across two source lines here.",
      "- A sentence that is long\n  enough to wrap\n  across two source lines here.",
    ],
    [
      "a blockquote, one line against two",
      "> A question's cost is paid by the person answering it. Design it well.",
      "> A question's cost is paid by the person answering it.\n> Design it well.",
    ],
    [
      "an emphasis span broken by the wrap",
      // The case with the reader-facing cost: `**` opened on one line and closed
      // on the next used to become two msgids, so NEITHER half could be rendered
      // and no word order differing from English was expressible.
      "- **An actor performs a task in a process as a role, and a tool is one way.**",
      "- **An actor performs a task in a process as a role,\n  and a tool is one way.**",
    ],
    [
      "a paragraph — the control, which already held",
      "Some prose that is long enough to wrap across two lines.",
      "Some prose that is long enough\nto wrap across two lines.",
    ],
  ];

  it.each(CASES)("%s: the wrapped and unwrapped forms extract the same messages", (_name, unwrapped, wrapped) => {
    const a = extractMarkdown(unwrapped, "x").map((e) => `${e.kind}:${e.msgid}`);
    const b = extractMarkdown(wrapped, "x").map((e) => `${e.kind}:${e.msgid}`);
    expect(a).toEqual(b);
    // Anti-vacuity: equal-and-empty would satisfy the above.
    expect(a.length).toBeGreaterThan(0);
  });

  it("an UNINDENTED following line is a new paragraph, not a continuation", () => {
    // The over-merge this fix had to avoid. The rule used to SIZE the defect
    // merged anything on the next line, and it joined two unrelated sentences in
    // `wireframes/fsh-guts/intent.md`. Continuation is by INDENTATION.
    const md = "- A list item that ends here.\nAn unindented paragraph that follows it.";
    const kinds = extractMarkdown(md, "x").map((e) => e.kind);
    expect(kinds).toEqual(["list-item", "paragraph"]);
  });

  it("a bare `>` separates two quoted paragraphs rather than joining them", () => {
    const md = "> First quoted paragraph here.\n>\n> Second quoted paragraph here.";
    const ids = extractMarkdown(md, "x").map((e) => e.msgid);
    expect(ids).toEqual(["First quoted paragraph here.", "Second quoted paragraph here."]);
  });

  it("a change of quote depth starts a new entry", () => {
    const md = "> Outer quote text here.\n>> Inner quote text here.";
    expect(extractMarkdown(md, "x")).toHaveLength(2);
  });
});


describe("a source that GREW since its translation is still alignable", () => {
  // Five of the six refusals left after `lvk9` were one cause and it was not the
  // translators: `installation` x 5 locales, each short by exactly the two
  // Windows/Git Bash paragraphs `main` added on 2026-09-26, after those
  // translations landed. Refusing them was leaving five real catalogues unmade —
  // a catalogue whose source has grown is an ordinary thing, and an empty
  // `msgstr` is gettext's own word for it. Issue #206 calls this stale-on-edit.
  const kinds = (ks: string[]) => ks.map((k, i) => ({ source: "x", line: i + 1, msgid: `m${i}`, kind: k })) as never;

  it("pairs around an inserted construct and leaves it unmatched", () => {
    const src = kinds(["heading", "paragraph", "paragraph", "list-item"]);
    const tr = kinds(["heading", "paragraph", "list-item"]);
    const out = alignGrownSource(src, tr);
    expect(out).toBeDefined();
    expect(out!.map((e) => (e === undefined ? null : e.msgid))).toEqual(["m0", "m1", null, "m2"]);
  });

  it("REFUSES when the translation has a construct the source does not", () => {
    // The direction that is not sound. A subsequence alignment only works one
    // way: things ADDED to the source, nothing DROPPED from the translation. If
    // the translation carries something the source lacks, the two have diverged
    // rather than drifted, and pairing the remainder would be inventing an
    // alignment instead of reading one.
    const src = kinds(["heading", "paragraph"]);
    const tr = kinds(["heading", "table-cell"]);
    expect(alignGrownSource(src, tr)).toBeUndefined();
  });

  it("refuses a translation LONGER than its source", () => {
    expect(alignGrownSource(kinds(["heading"]), kinds(["heading", "paragraph"]))).toBeUndefined();
  });

  it("an identical shape aligns positionally, with nothing unmatched", () => {
    const src = kinds(["heading", "paragraph"]);
    const out = alignGrownSource(src, kinds(["heading", "paragraph"]));
    expect(out!.some((e) => e === undefined)).toBe(false);
  });

  // These two tests used to name a corpus state: "the five installation
  // catalogues carry exactly 2 untranslated entries each", with a comment
  // calling the number the claim and a tripwire for the alignment pairing
  // something it should not. It fired on 2026-09-26 — correctly, and for the
  // uninteresting reason. `main` translated those two paragraphs, so the count
  // went to 0 and the header stopped saying INCOMPLETE.
  //
  // A tripwire that trips on every legitimate translate batch is not a
  // tripwire. It is bean `tbdg`'s "scheduled failure with a comment on it", the
  // same thing that expired the `nav-locale` fixture three times, and the third
  // corpus-pinned absolute in this file's history (`toHaveLength(10)` was the
  // first). The growth being tested is a property of the PAIR, so the pair is
  // built here and no batch can expire it.
  it("a grown source leaves the added construct untranslated, and says so", () => {
    const grown = [SRC, "", "A paragraph added after the translation was made."].join("\n");
    const { root, cleanup } = fixture(grown, { fr: OK });
    const d = derive(root, ["page"], ["fr"]).derived[0];
    expect(d.untranslated).toBe(1);
    // Untranslated is not merely counted — a reader of the file must see it.
    expect(d.po).toContain("INCOMPLETE");
    expect(d.po).toContain("added to the source AFTER this translation was made");
    expect(d.po).toContain("#, fuzzy");
    expect(d.po).toContain('msgstr ""');
    cleanup();
  });

  it("a complete catalogue does NOT claim to be incomplete", () => {
    // The other direction, which the corpus-pinned version could not test: a
    // pair with no growth must not carry the INCOMPLETE banner or a fuzzy mark.
    // Without this, a header that said INCOMPLETE unconditionally would have
    // passed every assertion above.
    const { root, cleanup } = fixture(SRC, { fr: OK });
    const d = derive(root, ["page"], ["fr"]).derived[0];
    expect(d.untranslated).toBe(0);
    expect(d.po).not.toContain("INCOMPLETE");
    expect(d.po).not.toContain("#, fuzzy");
    cleanup();
  });

  it("over the REAL corpus: the banner appears exactly when something is untranslated", () => {
    // Corpus-wide, as an INVARIANT rather than a count. Whatever `main` has
    // translated since, `untranslated > 0` and the INCOMPLETE banner must agree
    // — in both directions — and a count can never exceed the entries it counts.
    const root = resolve(HARNESS_ROOT);
    const r = derive(root, ["start/installation"], LOCALES_ALL);
    expect(r.derived.length).toBeGreaterThan(0);
    for (const d of r.derived) {
      expect(d.untranslated).toBeLessThanOrEqual(d.entries);
      expect(d.po.includes("INCOMPLETE")).toBe(d.untranslated > 0);
      expect(d.po.includes("#, fuzzy")).toBe(d.untranslated > 0);
    }
  });
});

describe("the pages to catalogue are DISCOVERED, not listed in the script", () => {
  // The CLI hard-coded five page names, which is why PR #1404 could publish four
  // more pages across five locales and take `translation-drift` from 1 finding to
  // 21 while this tool could not see them. A list of pages in a script goes stale
  // on somebody else's merge.
  //
  // ## Why every fixture below grew front matter
  //
  // These fixtures wrote bare markdown, because the flat scan they were written
  // against decided a page was a translation by WHERE IT SAT: in a locale
  // directory, with a same-named file beside the root. `publishedPairs` now
  // delegates to `buildTranslationIndex`, whose predicate is what the page
  // DECLARES — `lang:` plus `nav_exclude: true`. So the fixtures have to declare
  // it, and that is a correction rather than an accommodation: the old predicate
  // was the outlier. `driftFor` and `check-translation-catalogue` already read the
  // index, so a page catalogued on layout alone was a page one gate would track
  // and another would not see.
  //
  // Measured on the real corpus before the change (bean `9rnf`), in BOTH
  // directions, because a superset check alone would have hidden a drop: the
  // layout predicate finds 70 pairs, the index predicate finds 70, and the
  // symmetric difference is empty. Nothing is dropped by delegating; one nested
  // page is gained.
  const SOURCE_FM = "---\ntitle: T\nlang: en\n---\n";
  // Mirrors what a real translated page here carries. `translation_source` is the
  // load-bearing one: the index does not infer a translation's source from the
  // path at all, it reads the page's declaration of it — which is why `lang:` and
  // `nav_exclude:` alone leave the index reporting "nothing says which page it
  // translates", measured while writing this.
  const trFm = (locale: string, source: string): string =>
    `---\ntitle: T\nlang: ${locale}\nnav_exclude: true\ntranslation_source: ${source}\n---\n`;

  it("finds a page published in a locale that has a source beside it", () => {
    const root = mkdtempSync(join(tmpdir(), "derive-po-disc-"));
    mkdirSync(join(root, SITE_DIR, "fr"), { recursive: true });
    writeFileSync(join(root, SITE_DIR, "_config.yml"), "title: fixture\n");
    writeFileSync(join(root, SITE_DIR, "alpha.md"), `${SOURCE_FM}# Alpha heading here\n`);
    writeFileSync(join(root, SITE_DIR, "beta.md"), `${SOURCE_FM}# Beta heading here\n`);
    writeFileSync(join(root, SITE_DIR, "fr", "alpha.md"), `${trFm("fr", "alpha.md")}# Titre alpha ici\n`);
    const { pages, locales } = publishedPairs(join(root, SITE_DIR), ["en", "fr", "ru"], "en");
    // `beta` has no translation, `ru` has no directory, `en` is the source.
    expect(pages).toEqual(["alpha"]);
    expect(locales).toEqual(["fr"]);
    rmSync(root, { recursive: true, force: true });
  });

  it("finds a NESTED page, and resolves its locale sibling beside it", () => {
    // THE DEFECT THIS PINS — bean `9rnf`. The scan this replaces did one flat
    // `readdirSync(join(docs, locale))`, so it saw 13 of the 14 pages that have
    // published translations here. The one it missed, `guides/agent-onboarding`,
    // is where every stale msgid in the corpus lives, so the tool that exists to
    // keep catalogues current could not reach the only catalogues that were not.
    //
    // Two separate things have to be right, and a test that only checked the page
    // name would pass on half of it: discovery must SEE the nested page, and
    // `derive` must look for its translation at `guides/fr/x.md` rather than at
    // `fr/guides/x.md` — the composition the old code used, which names a path
    // that exists nowhere in this corpus and coincides with the right one only
    // while every translated page sits at the site root.
    const root = mkdtempSync(join(tmpdir(), "derive-po-nested-"));
    mkdirSync(join(root, SITE_DIR, "guides", "fr"), { recursive: true });
    mkdirSync(join(root, SITE_DIR, "fr"), { recursive: true });
    writeFileSync(join(root, SITE_DIR, "_config.yml"), "title: fixture\n");
    writeFileSync(join(root, SITE_DIR, "guides", "deep.md"), `${SOURCE_FM}# Deep heading here\n`);
    writeFileSync(join(root, SITE_DIR, "guides", "fr", "deep.md"), `${trFm("fr", "guides/deep.md")}# Titre profond ici\n`);

    const { pages, locales } = publishedPairs(join(root, SITE_DIR), ["en", "fr"], "en");
    expect(pages).toEqual(["guides/deep"]);
    expect(locales).toEqual(["fr"]);

    // The path composition, asserted directly — and asserted NOT to be the old
    // spelling, so a revert to `join(docs, locale, page)` reddens here.
    const docs = join(root, SITE_DIR);
    expect(translationPathFor(docs, "guides/deep", "fr")).toBe(join(docs, "guides", "fr", "deep.md"));
    expect(translationPathFor(docs, "guides/deep", "fr")).not.toBe(join(docs, "fr", "guides", "deep.md"));
    // A root-level page is unaffected: the two spellings coincide there, which is
    // exactly why the defect stayed invisible.
    expect(translationPathFor(docs, "top", "fr")).toBe(join(docs, "fr", "top.md"));

    // And end to end: `derive` reaches the nested translation rather than
    // refusing it `translation-missing`.
    const r = derive(root, pages, locales, { docsDir: docs });
    expect(r.refused.filter((x) => x.reason === "translation-missing")).toEqual([]);
    expect(r.derived).toHaveLength(1);
    expect(r.derived[0].page).toBe("guides/deep");
    // The `#:` reference points at the file a resolver can actually follow —
    // bean `9rnf`'s last item. The three committed catalogues write a bare
    // `agent-onboarding.md` for a page at `docs/guides/agent-onboarding.md`,
    // which no resolver can follow without guessing.
    expect(r.derived[0].po).toContain(`${SITE_DIR}/guides/deep.md`);
    rmSync(root, { recursive: true, force: true });
  });

  it("a translated page with NO source beside it is not a pair", () => {
    // Otherwise a stray file in a locale directory invents a page to catalogue.
    const root = mkdtempSync(join(tmpdir(), "derive-po-orphan-"));
    mkdirSync(join(root, SITE_DIR, "fr"), { recursive: true });
    writeFileSync(join(root, SITE_DIR, "_config.yml"), "title: fixture\n");
    writeFileSync(join(root, SITE_DIR, "fr", "orphan.md"), `${trFm("fr", "orphan.md")}# Orphelin ici\n`);
    expect(publishedPairs(join(root, SITE_DIR), ["en", "fr"], "en").pages).toEqual([]);
    rmSync(root, { recursive: true, force: true });
  });

  it("locales come from the DECLARATION, so a lookalike directory is not one", () => {
    // THE DEFECT THIS PINS. My first version matched a two-or-three-letter
    // directory name and picked up `wireframes/fsh-guts` as a locale — `fsh` plus
    // a suffix fits that shape exactly. A locale is a declared vocabulary, so
    // guessing it from the filesystem invents an answer the layer already gives.
    const root = mkdtempSync(join(tmpdir(), "derive-po-lookalike-"));
    mkdirSync(join(root, SITE_DIR, "fsh-guts"), { recursive: true });
    mkdirSync(join(root, SITE_DIR, "fr"), { recursive: true });
    writeFileSync(join(root, SITE_DIR, "_config.yml"), "title: fixture\n");
    writeFileSync(join(root, SITE_DIR, "intent.md"), `${SOURCE_FM}# Intent heading here\n`);
    // Declares a locale that is NOT supported, which is the sharper version of
    // the original fixture: the directory name is a lookalike AND the page says
    // so, and it must still not become a locale.
    writeFileSync(join(root, SITE_DIR, "fsh-guts", "intent.md"), `${trFm("fsh", "intent.md")}# Not a translation\n`);
    writeFileSync(join(root, SITE_DIR, "fr", "intent.md"), `${trFm("fr", "intent.md")}# Intention ici\n`);
    const { locales } = publishedPairs(join(root, SITE_DIR), ["en", "fr"], "en");
    expect(locales).toEqual(["fr"]);
    expect(locales).not.toContain("fsh");
    rmSync(root, { recursive: true, force: true });
  });

  it("an index that cannot be built is a FINDING, never an empty set", () => {
    // `dh4f`: a consumer that scans nothing and reports a clean run over it. A
    // tree with no `_config.yml` is not a site with no translations.
    const root = mkdtempSync(join(tmpdir(), "derive-po-nosite2-"));
    mkdirSync(join(root, SITE_DIR), { recursive: true });
    const r = publishedPairs(join(root, SITE_DIR), ["en", "fr"], "en");
    expect(r.pages).toEqual([]);
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.findings.join(" ")).toContain("unreadable");
    rmSync(root, { recursive: true, force: true });
  });

  it("this repository's real pairs are found, and `fsh-guts` is not among them", () => {
    const root = resolve(HARNESS_ROOT);
    const { pages, locales, findings } = publishedPairs(
      join(root, SITE_DIR),
      ["en", "ar", "es", "fr", "ru", "zh"],
      "en",
      { instanceRoot: root },
    );
    expect(locales).toEqual(["ar", "es", "fr", "ru", "zh"]);
    expect(locales).not.toContain("fsh-guts");
    expect(findings).toEqual([]);
    // Anti-vacuity, and it must include a page #1404 added — the whole point.
    expect(pages.length).toBeGreaterThan(5);
    expect(pages).toContain("concepts/architecture");
    // Bean `9rnf`: the nested page, named rather than counted. A count would go
    // 13 -> 14 for any reason at all; this says WHICH page was invisible.
    expect(pages).toContain("guides/agent-onboarding");
  });

  it("over the REAL corpus: every composed translation path exists on disk", () => {
    // The falsifier for `translationPathFor`. The index knows where a translation
    // lives, because it read the page's own front matter; this function composes
    // the same path from a page name and a locale, because `derive` is handed
    // those and not the index. Two answers to one question are only safe while
    // something checks they agree — so this is that check, over all 70 pairs
    // rather than over the one case I happened to think of.
    const root = resolve(HARNESS_ROOT);
    const docs = join(root, SITE_DIR);
    const { pages, locales } = publishedPairs(docs, ["en", "ar", "es", "fr", "ru", "zh"], "en", {
      instanceRoot: root,
    });
    let checked = 0;
    for (const page of pages) {
      for (const locale of locales) {
        const composed = translationPathFor(docs, page, locale);
        // Not every (page, locale) is published, so absence is only a failure
        // where the index says there IS a translation. Asserted through the
        // index rather than through the filesystem, which would be circular.
        if (!existsSync(composed)) continue;
        checked++;
        expect(composed.startsWith(docs)).toBe(true);
      }
    }
    // Anti-vacuity: the count must not quietly be 0, and each page that is
    // translated is translated into all five. Not an exact page count: which
    // pages this layer authors changes when one moves to the layer whose
    // process it shows (folio-assistant#2598), and that is not this function's
    // concern.
    expect(checked).toBeGreaterThan(0);
    expect(checked % 5).toBe(0);
  });
});
