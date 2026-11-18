/**
 * `translate-pot`, now the older name and flags of `translation-candidates`:
 * the flags it maps, and the behaviour its users rely on, end to end through
 * the one candidates writer.
 *
 * @module scripts/tests/translate-pot.test
 *
 * Every test uses a fake engine, so nothing here needs a model or a network.
 */
import { describe, expect, test } from "bun:test";

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { poEntries } from "../lib/translation-adjudication.ts";
import type { CandidateSourceAdapter } from "../lib/translation-sources/index.ts";
import { candidatesArgs, main } from "../translate-pot.ts";

const HEADER = `msgid ""
msgstr ""
"Language: fr\\n"
"Content-Type: text/plain; charset=UTF-8\\n"
`;

/** Upper-cases the words it is sent; the `[n]` stand-ins pass through, as a well-behaved engine's would. */
function upper(): CandidateSourceAdapter & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    id: "upper",
    kind: "open-mt",
    calls,
    source: (t) => ({ kind: "open-mt", id: `fake upper-${t}` }),
    async translate(texts) {
      calls.push(texts);
      return texts.map((t) => t.toUpperCase());
    },
  };
}

const quiet = { log: () => {} };

describe("the older flags map onto translation-candidates", () => {
  test("--locale repeats into one list, a .po is started unless --no-create, and the rest pass through", () => {
    expect(candidatesArgs(["--engine", "opus-mt", "--locale", "fr", "--locale", "es", "--dir", "t", "--dry-run"])).toEqual([
      "--engine", "opus-mt", "--dir", "t", "--dry-run", "--locale", "fr,es", "--init",
    ]);
    expect(candidatesArgs(["--engine", "libretranslate", "--url", "http://localhost:5000", "--no-create"])).toEqual([
      "--engine", "libretranslate", "--url", "http://localhost:5000",
    ]);
    expect(candidatesArgs(["--model", "m", "--python", "python3.12", "--source", "en"])).toEqual(["--model", "m", "--python", "python3.12", "--init"]);
  });

  test("an unknown flag, a missing value or a non-English source is refused", () => {
    expect(candidatesArgs(["--bogus", "x"])).toEqual({ error: "unknown argument --bogus" });
    expect(candidatesArgs(["--engine"])).toEqual({ error: "--engine needs a value" });
    expect(candidatesArgs(["--source", "fr"])).toEqual({ error: "--source: only English (en) sources are translated" });
  });
});

describe("the CLI over a translations tree", () => {
  function tree(po = `\nmsgid "Proof"\nmsgstr "Demostración"\n\nmsgid "Lemma"\nmsgstr ""\n`, locale = "es") {
    const root = mkdtempSync(join(tmpdir(), "translate-pot-"));
    const dir = join(root, "translations", locale, "glossary");
    mkdirSync(dir, { recursive: true });
    const template = po.replace(/msgstr(\[\d\])? "[^"]+"/g, 'msgstr$1 ""');
    writeFileSync(join(dir, "terms.pot"), `${HEADER.replace("fr", "")}${template}`);
    writeFileSync(join(dir, "terms.po"), `${HEADER.replace("fr", locale)}${po}`);
    return { root, dir, args: ["--instance", root, "--dir", join(root, "translations")] };
  }
  const read = (dir: string, f: string) => readFileSync(join(dir, f), "utf8");

  test("fills the empty entry, keeps the filled one, and writes the node", async () => {
    const { dir, args } = tree();
    expect(await main(args, { sources: [upper()], ...quiet })).toBe(0);
    const po = read(dir, "terms.po");
    expect(po).toContain(`msgid "Proof"\nmsgstr "Demostración"`);
    expect(po).toContain(`#, fuzzy\nmsgid "Lemma"\nmsgstr "LEMMA"`);
    const node = JSON.parse(read(dir, "terms.json"));
    expect(node.label).toBe("trans:es/glossary/terms");
    expect(node.poFile).toBe("translations/es/glossary/terms.po");
    expect(node.status).toMatchObject({ generatedBy: "machine", generator: "fake upper-es", official: false });
  });

  test("singular strings become candidates for the review page; a second run changes nothing", async () => {
    const { dir, args } = tree();
    expect(await main(args, { sources: [upper()], ...quiet })).toBe(0);
    const side = JSON.parse(read(dir, "terms.candidates.json"));
    expect(side).toMatchObject({ $schema: "translation-candidates/v1", catalogue: "glossary/terms" });
    expect(side.entries).toHaveLength(1);
    expect(side.entries[0].candidates[0]).toMatchObject({ text: "LEMMA", source: { kind: "open-mt", id: "fake upper-es" } });
    const po = read(dir, "terms.po");
    expect(await main(args, { sources: [upper()], ...quiet })).toBe(0);
    expect(read(dir, "terms.po")).toBe(po);
    expect(JSON.parse(read(dir, "terms.candidates.json")).entries[0].candidates).toHaveLength(1);
  });

  test("plural entries are machine-filled, fuzzy, with the target's plural count, and are candidates too", async () => {
    const plural = `"Plural-Forms: nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);\\n"\n\nmsgid "%d file"\nmsgid_plural "%d files"\nmsgstr[0] ""\nmsgstr[1] ""\n\nmsgid "Proof"\nmsgstr ""\n`;
    const { dir, args } = tree(plural, "ru");
    expect(await main(args, { sources: [upper()], ...quiet })).toBe(0);
    const po = read(dir, "terms.po");
    expect(po).toContain('#, fuzzy\nmsgid "%d file"\nmsgid_plural "%d files"\nmsgstr[0] "%d FILE"\nmsgstr[1] "%d FILES"\nmsgstr[2] "%d FILES"');
    expect(po).toContain('#, fuzzy\nmsgid "Proof"\nmsgstr "PROOF"');
    const side = JSON.parse(read(dir, "terms.candidates.json"));
    const file = side.entries.find((e: { msgid: string }) => e.msgid === "%d file");
    expect(file.candidates[0]).toMatchObject({ text: "%d FILE", forms: ["%d FILE", "%d FILES", "%d FILES"] });
  });

  test("a language with one form (zh) takes its only form from the plural", async () => {
    const { dir, args } = tree(`\nmsgid "%d file"\nmsgid_plural "%d files"\nmsgstr[0] ""\n`, "zh");
    expect(await main(args, { sources: [upper()], ...quiet })).toBe(0);
    expect(read(dir, "terms.po")).toContain('msgid_plural "%d files"\nmsgstr[0] "%d FILES"\n');
  });

  test("leading and trailing whitespace, and line structure, come back verbatim; math and markup reach the engine masked", async () => {
    const eng = upper();
    const { dir, args } = tree(`\nmsgid ""\n"  Hello\\n"\n"\\n"\n"world  "\nmsgstr ""\n\nmsgctxt "a"\nmsgid "See **$x^2$** in <em>Note</em>"\nmsgstr ""\n\nmsgctxt "b"\nmsgid "See **$x^2$** in <em>Note</em>"\nmsgstr ""\n`);
    expect(await main(args, { sources: [eng], ...quiet })).toBe(0);
    const entries = poEntries(read(dir, "terms.po"));
    expect(entries.find((e) => e.msgid.includes("Hello"))!.msgstr).toBe("  HELLO\n\nWORLD  ");
    expect(entries.filter((e) => e.msgid.startsWith("See")).map((e) => e.msgstr)).toEqual(["SEE **$x^2$** IN <em>NOTE</em>", "SEE **$x^2$** IN <em>NOTE</em>"]);
    // Each line on its own; the two identical strings sent once.
    expect(eng.calls.flat().sort()).toEqual(["Hello", "See [0][1][2] in [3]Note[4]", "world"]);
  });

  test("a string with nothing but placeholders is not sent, and is reported", async () => {
    const eng = upper();
    const { dir, args } = tree(`\nmsgid "{count}"\nmsgstr ""\n`);
    const said: string[] = [];
    expect(await main(args, { sources: [eng], log: (s) => said.push(s) })).toBe(0);
    expect(eng.calls.flat()).toEqual([]);
    expect(read(dir, "terms.po")).toContain('msgid "{count}"\nmsgstr ""');
    expect(said.join("\n")).toContain('"{count}": nothing translatable');
  });

  test("an entry whose placeholders do not survive is left empty and not flagged fuzzy", async () => {
    const dropper: CandidateSourceAdapter = { ...upper(), translate: async (t) => t.map((x) => x.replace(/\[\d+\]/g, "").toUpperCase()) };
    const { dir, args } = tree(`\nmsgid "Hello {name}"\nmsgstr ""\n`);
    await main(args, { sources: [dropper], ...quiet });
    expect(read(dir, "terms.po")).toContain('\nmsgid "Hello {name}"\nmsgstr ""');
    expect(read(dir, "terms.po")).not.toContain("fuzzy");
  });

  test("a catalogue signed off as official gets candidates, but its .po and node are not changed", async () => {
    const { dir, args } = tree();
    const before = read(dir, "terms.po").replace("Language: es", 'X-Folio-Official: yes\\n"\n"Language: es');
    writeFileSync(join(dir, "terms.po"), before);
    expect(await main(args, { sources: [upper()], ...quiet })).toBe(0);
    expect(read(dir, "terms.po")).toBe(before);
    expect(existsSync(join(dir, "terms.json"))).toBe(false);
    expect(existsSync(join(dir, "terms.candidates.json"))).toBe(true);
  });

  test("a catalogue that says DO NOT MACHINE-FILL gets candidates, but its .po is not changed", async () => {
    const { dir, args } = tree();
    const before = `# DO NOT MACHINE-FILL THIS FILE.\n${read(dir, "terms.po")}`;
    writeFileSync(join(dir, "terms.po"), before);
    expect(await main(args, { sources: [upper()], ...quiet })).toBe(0);
    expect(read(dir, "terms.po")).toBe(before);
    expect(existsSync(join(dir, "terms.candidates.json"))).toBe(true);
    expect(existsSync(join(dir, "terms.json"))).toBe(false);
  });

  test("a template with no .po is started, unless --no-create", async () => {
    const { root, dir, args } = tree();
    const fr = join(root, "translations", "fr", "glossary");
    mkdirSync(fr, { recursive: true });
    writeFileSync(join(fr, "terms.pot"), read(dir, "terms.pot"));
    expect(await main([...args, "--locale", "fr", "--no-create"], { sources: [upper()], ...quiet })).toBe(0);
    expect(existsSync(join(fr, "terms.po"))).toBe(false);
    expect(await main([...args, "--locale", "fr"], { sources: [upper()], ...quiet })).toBe(0);
    expect(read(fr, "terms.po")).toContain('"Language: fr\\n"');
    expect(read(fr, "terms.po")).toContain('#, fuzzy\nmsgid "Lemma"\nmsgstr "LEMMA"');
  });

  test("--dry-run writes nothing", async () => {
    const { dir, args } = tree();
    const before = read(dir, "terms.po");
    expect(await main([...args, "--dry-run"], { sources: [upper()], ...quiet })).toBe(0);
    expect(read(dir, "terms.po")).toBe(before);
    expect(existsSync(join(dir, "terms.candidates.json"))).toBe(false);
  });

  test("no catalogue at all is reported, not passed", async () => {
    const root = mkdtempSync(join(tmpdir(), "translate-pot-"));
    mkdirSync(join(root, "translations", "es"), { recursive: true });
    expect(await main(["--instance", root, "--dir", join(root, "translations")], { sources: [upper()], ...quiet })).toBe(2);
  });
});
