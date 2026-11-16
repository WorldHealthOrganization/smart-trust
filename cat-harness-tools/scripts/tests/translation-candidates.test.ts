/**
 * Candidate translations from open engines: the placeholder guard, the
 * never-overwrite rule, the first-candidate-as-fuzzy fill, the sidecar, and
 * what is recorded on the translation node.
 *
 * @covers translation-sources
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkedCandidate,
  entriesToTranslate,
  forbidsMachineFill,
  maskPlaceholders,
  placeholderProblem,
  placeholders,
  poFromPot,
  splitWhitespace,
  unmaskPlaceholders,
} from "../lib/machine-translation.ts";
import { candidatesProblems, poEntries, type CandidateSource } from "../lib/translation-adjudication.ts";
import { addCandidates, emptySidecar, generatedByFor, mergeCandidates, type CandidateInput } from "../lib/translation-candidates.ts";
import {
  libreTranslateSource,
  libreTranslateUrlProblem,
  opusMtModel,
  opusMtSource,
  sourceFor,
  type CandidateSourceAdapter,
} from "../lib/translation-sources/index.ts";
import { collectCandidates } from "../translation-candidates.ts";

const PO = `# Spanish catalogue
msgid ""
msgstr ""
"Language: es\\n"
"Content-Type: text/plain; charset=UTF-8\\n"

#: docs/a.md:1
msgid "Hello"
msgstr "Hola, ya traducido"

#: docs/a.md:2
msgid "Open {name} now"
msgstr ""

#: docs/a.md:3
msgctxt "button"
msgid "Open"
msgstr ""

#: docs/a.md:4
msgid "Open"
msgstr ""

#: docs/a.md:5
msgid "%d file"
msgid_plural "%d files"
msgstr[0] ""
msgstr[1] ""

#: docs/a.md:6
#, python-format
msgid "  Run %(cmd)s in <a0>the shell</a0>.\\n"
msgstr ""

#: docs/a.md:7
#, fuzzy
msgid "Already a machine guess"
msgstr "Una suposición"
`;

const OPUS: CandidateSource = { kind: "open-mt", id: "Helsinki-NLP/opus-mt-en-es" };
const ARGOS: CandidateSource = { kind: "open-mt", id: "argos-translate-en_es", version: "libretranslate" };

/** A fake source: `prefix` + the masked core it was sent. */
function fakeSource(id: string, prefix: string, f?: (s: string) => string): CandidateSourceAdapter & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    id,
    kind: "open-mt",
    calls,
    source: (t) => ({ kind: "open-mt", id: `${id}-en-${t}` }),
    async translate(texts) {
      calls.push(texts);
      return texts.map(f ?? ((s) => `${prefix}${s}`));
    },
  };
}

describe("placeholder guard", () => {
  test("finds the tokens a translation must keep", () => {
    expect(placeholders("Open {name} with %s, %(x)s, %1$s and {{y}}")).toEqual(["%(x)s", "%1$s", "%s", "{name}", "{{y}}"].sort());
    expect(placeholders("<a0>link</a0> to <slug> and `code {x}`")).toEqual(["</a0>", "<a0>", "<slug>", "`code {x}`"].sort());
    expect(placeholders("see [docs](https://x.org/a) &amp; https://y.org/b")).toEqual(["&amp;", "](https://x.org/a)", "https://y.org/b"].sort());
    expect(placeholders("100% sure, no tokens")).toEqual([]);
  });

  test("TeX math, liquid tags and Markdown strong/strike markers are kept too", () => {
    expect(placeholders("If $x^2$ then $$y$$, \\(z\\) and \\[w\\]")).toEqual(["$$y$$", "$x^2$", "\\(z\\)", "\\[w\\]"].sort());
    expect(placeholders("{% if a %}**bold** ~~old~~{% endif %}")).toEqual(["**", "**", "{% endif %}", "{% if a %}", "~~", "~~"].sort());
    expect(placeholderProblem("**Note** $x$", "Nota $x$")).toContain('lost "**"');
  });

  test("accepts a reordered but complete translation", () => {
    expect(placeholderProblem("{a} before {b}", "{b} después de {a}")).toBeUndefined();
    expect(placeholderProblem("<a0>x</a0> %s", "%s <a0>y</a0>")).toBeUndefined();
  });

  test("refuses a lost, renamed, duplicated or translated placeholder", () => {
    expect(placeholderProblem("Open {name}", "Abrir")).toContain('lost "{name}"');
    expect(placeholderProblem("Open {name}", "Abrir {nombre}")).toContain('added "{nombre}"');
    expect(placeholderProblem("%s", "%s %s")).toContain("do not round-trip");
    expect(placeholderProblem("<a0>x</a0>", "<a0>x")).toContain('lost "</a0>"');
    expect(placeholderProblem("Run `ls -l`", "Ejecuta `ls -larga`")).toContain("do not round-trip");
    expect(placeholderProblem("%(cmd)s", "%(comando)s")).toContain("do not round-trip");
  });

  test("refuses lost line breaks and an empty answer", () => {
    expect(placeholderProblem("a\nb", "a b")).toContain("line breaks");
    expect(placeholderProblem("a", "  ")).toBe("the engine returned nothing");
  });

  test("a checked candidate gets the source's surrounding whitespace back", () => {
    expect(splitWhitespace("  x y\n")).toEqual({ lead: "  ", core: "x y", trail: "\n" });
    expect(checkedCandidate("  Run %s\n", " Ejecuta %s ")).toEqual({ text: "  Ejecuta %s\n" });
    expect(checkedCandidate("Run %s", "Ejecuta")).toEqual({ refused: 'placeholders do not round-trip (lost "%s")' });
  });
});

describe("masking", () => {
  test("placeholders become numbered stand-ins and come back", () => {
    const { masked, tokens } = maskPlaceholders("Run `ls` on <a0>{name}</a0>");
    expect(masked).toBe("Run [0] on [1][2][3]");
    expect(unmaskPlaceholders("Ejecuta [0] en [1][2][3]", tokens)).toBe("Ejecuta `ls` en <a0>{name}</a0>");
    expect(unmaskPlaceholders("Ejecuta [ 0 ] en [1][2][3]", tokens)).toBe("Ejecuta `ls` en <a0>{name}</a0>");
  });

  test("the source's own bracketed numbers are not taken as stand-ins", () => {
    const { masked, tokens } = maskPlaceholders("See [0] and {x}");
    expect(masked).toBe("See [0] and [1]");
    expect(unmaskPlaceholders("Ver [0] y [1]", tokens)).toBe("Ver [0] y {x}");
  });

  test("a mangled stand-in is refused, never leaked into the text (bean cat-tools-ph0s)", () => {
    const { masked, tokens } = maskPlaceholders("Shown in {language}.");
    expect(masked).not.toContain("__PH");
    for (const mangled of ["Affiché en [0.", "Affiché en 0].", "Affiché en (0).", "Affiché en [0]_."]) {
      const back = unmaskPlaceholders(mangled, tokens);
      const r = checkedCandidate("Shown in {language}.", back);
      if (mangled.includes("[0]")) expect(back).toBe("Affiché en {language}_.");
      else expect(r).toEqual({ refused: 'placeholders do not round-trip (lost "{language}")' });
    }
    expect(unmaskPlaceholders("Affiché en [ 0 ].", tokens)).toBe("Affiché en {language}.");
  });

  test("a dropped or duplicated stand-in is still caught by the guard", () => {
    const { tokens } = maskPlaceholders("Open {name}");
    expect(placeholderProblem("Open {name}", unmaskPlaceholders("Abrir", tokens))).toContain("lost");
    expect(placeholderProblem("Open {name}", unmaskPlaceholders("Abrir [0] [0]", tokens))).toContain("do not round-trip");
  });
});

describe("which entries are translated", () => {
  test("empty and fuzzy entries, plural ones included; never a reviewed one", () => {
    const { wanted, skipped } = entriesToTranslate(PO);
    expect(wanted).toEqual([
      { msgid: "Open {name} now", empty: true },
      { msgctxt: "button", msgid: "Open", empty: true },
      { msgid: "Open", empty: true },
      { msgid: "%d file", msgidPlural: "%d files", empty: true },
      { msgid: "  Run %(cmd)s in <a0>the shell</a0>.\n", empty: true },
      { msgid: "Already a machine guess", empty: false },
    ]);
    expect(skipped).toEqual([]);
  });

  test("a plural a person has started is left to them", () => {
    const started = PO.replace('msgstr[0] ""\nmsgstr[1] ""', 'msgstr[0] "%d archivo"\nmsgstr[1] ""');
    expect(entriesToTranslate(started).wanted.some((w) => w.msgid === "%d file")).toBe(false);
    expect(entriesToTranslate(started).skipped).toEqual([]);
    const fuzzyStarted = started.replace('#: docs/a.md:5\n', '#: docs/a.md:5\n#, fuzzy\n');
    expect(entriesToTranslate(fuzzyStarted).skipped).toEqual([{ msgid: "%d file", reason: "plural entry with some forms filled: left for a person" }]);
  });

  test("a catalogue that forbids machine filling is recognised", () => {
    expect(forbidsMachineFill("# DO NOT MACHINE-FILL THIS FILE. A machine…\nmsgid \"\"")).toBe(true);
    expect(forbidsMachineFill(PO)).toBe(false);
  });

  test("a catalogue started from its template names the locale and says unofficial", () => {
    const pot = `# template\nmsgid ""\nmsgstr ""\n"Project-Id-Version: x\\n"\n"Language: \\n"\n\nmsgid "Hi"\nmsgstr ""\n`;
    const po = poFromPot(pot, "ru");
    expect(po).toContain('"Project-Id-Version: x\\n"\n"Language: ru\\n"\n"X-Folio-Official: no\\n"\n\nmsgid "Hi"\nmsgstr ""');
    expect(po.match(/Language:/g)).toHaveLength(1);
    expect(() => poFromPot('msgid "Hi"\nmsgstr ""\n', "ru")).toThrow("no header");
  });
});

describe("mergeCandidates: the never-overwrite rule and the first-candidate fill", () => {
  const all = (src: CandidateSource, f: (s: string) => string): CandidateInput[] =>
    entriesToTranslate(PO).wanted.filter((w) => w.msgidPlural === undefined).map((w) => ({ ...(w.msgctxt !== undefined ? { msgctxt: w.msgctxt } : {}), msgid: w.msgid, text: f(splitWhitespace(w.msgid).core), source: src }));

  test("every non-empty msgstr is kept byte-for-byte; each empty one gets the first candidate, fuzzy", () => {
    const r = mergeCandidates(PO, emptySidecar("es", "a"), [...all(OPUS, (s) => `ES:${s}`), ...all(ARGOS, (s) => `AR:${s}`)]);
    expect(r.added).toBe(10);
    expect(r.filled.map((f) => f.source)).toEqual([OPUS, OPUS, OPUS, OPUS]);
    const before = new Map(poEntries(PO).map((e) => [`${e.msgctxt}|${e.msgid}`, e]));
    for (const e of poEntries(r.po)) {
      const b = before.get(`${e.msgctxt}|${e.msgid}`)!;
      if (b.msgstr !== "") expect(e.msgstr).toBe(b.msgstr);
      else if (e.msgidPlural === undefined) {
        expect(e.fuzzy).toBe(true);
        expect(e.msgstr.trim().startsWith("ES:")).toBe(true);
      }
    }
    expect(r.po).toContain('msgstr "Hola, ya traducido"');
    expect(r.po).toContain('msgstr "Una suposición"'); // fuzzy with text: candidates only, never overwritten
    expect(r.po).toContain('msgstr[0] ""\nmsgstr[1] ""');
    expect(r.po).toContain('#, python-format, fuzzy\nmsgid "  Run %(cmd)s in <a0>the shell</a0>.\\n"\nmsgstr "  ES:Run %(cmd)s in <a0>the shell</a0>.\\n"');
    // msgctxt kept apart from the context-free entry with the same msgid.
    expect(poEntries(r.po).filter((e) => e.msgid === "Open").map((e) => e.msgctxt)).toEqual(["button", undefined]);
    // The sidecar holds both sources for each entry and validates.
    expect(candidatesProblems(r.sidecar)).toEqual([]);
    const fuzzy = r.sidecar.entries.find((e) => e.msgid === "Already a machine guess")!;
    expect(fuzzy.candidates).toEqual([
      { text: "ES:Already a machine guess", source: OPUS },
      { text: "AR:Already a machine guess", source: ARGOS },
    ]);
  });

  test("appending the same text from the same source twice adds nothing", () => {
    const once = mergeCandidates(PO, emptySidecar("es", "a"), all(OPUS, (s) => `ES:${s}`));
    const twice = mergeCandidates(once.po, once.sidecar, all(OPUS, (s) => `ES:${s}`));
    expect(twice.added).toBe(0);
    expect(twice.filled).toEqual([]);
    expect(twice.po).toBe(once.po);
  });

  test("a candidate that breaks a placeholder is not recorded and does not fill", () => {
    const r = mergeCandidates(PO, emptySidecar("es", "a"), all(OPUS, (s) => s.replace("{name}", "{nombre}")));
    expect(r.rejected).toEqual([{ msgid: "Open {name} now", reason: 'Helsinki-NLP/opus-mt-en-es: placeholders do not round-trip (lost "{name}"; added "{nombre}")' }]);
    expect(r.sidecar.entries.find((e) => e.msgid === "Open {name} now")).toBeUndefined();
    expect(poEntries(r.po).find((e) => e.msgid === "Open {name} now")!.msgstr).toBe("");
  });

  test("when the first source fails the guard, the next good candidate fills", () => {
    const bad = all(OPUS, (s) => s.replace("{name}", ""));
    const good = all(ARGOS, (s) => `AR:${s}`);
    const r = mergeCandidates(PO, emptySidecar("es", "a"), [...bad, ...good]);
    expect(r.filled.find((f) => f.msgid === "Open {name} now")!.source).toEqual(ARGOS);
  });

  test("a candidate for an entry the catalogue does not have is refused", () => {
    const r = mergeCandidates(PO, emptySidecar("es", "a"), [{ msgid: "Nope", text: "No", source: OPUS }]);
    expect(r.rejected[0]!.reason).toBe("no such entry in the catalogue");
    const plural = mergeCandidates(PO, emptySidecar("es", "a"), [{ msgid: "%d file", text: "%d archivo", source: OPUS }]);
    expect(plural.rejected[0]!.reason).toBe("Helsinki-NLP/opus-mt-en-es: plural entry: the candidate gives no forms");
    expect(plural.added).toBe(0);
  });

  test("a web-service import can skip the guard (a person wrote it), and still never overwrites", () => {
    const weblate: CandidateSource = { kind: "web-service", id: "weblate" };
    const r = mergeCandidates(PO, emptySidecar("es", "a"), [
      { msgid: "Hello", text: "Hola desde Weblate", source: weblate },
      { msgid: "Open {name} now", text: "Abrir ahora", source: weblate },
    ], { check: false });
    expect(r.added).toBe(2);
    expect(r.po).toContain('msgstr "Hola, ya traducido"');
    expect(r.po).toContain('msgstr "Abrir ahora"');
    expect(generatedByFor("web-service")).toBe("web-service");
    expect(generatedByFor("open-mt")).toBe("machine");
  });
});

describe("sources", () => {
  test("OPUS-MT models, with the target token the multi-target ones need", () => {
    expect(opusMtModel("es")).toEqual({ model: "Helsinki-NLP/opus-mt-en-es" });
    expect(opusMtModel("ar")).toEqual({ model: "Helsinki-NLP/opus-mt-en-ar", targetToken: ">>ara<<" });
    expect(opusMtModel("zh")).toEqual({ model: "Helsinki-NLP/opus-mt-en-zh", targetToken: ">>cmn_Hans<<" });
  });

  test("the OPUS-MT runner gets one JSON request and returns translations", async () => {
    let seen: { argv: string[]; req: Record<string, unknown> } | undefined;
    const s = opusMtSource(["runner", "--x"], async (argv, stdin) => {
      seen = { argv, req: JSON.parse(stdin) };
      return JSON.stringify({ translations: ["hola"] });
    });
    expect(await s.translate(["hello"], "en", "zh")).toEqual(["hola"]);
    expect(seen).toEqual({
      argv: ["runner", "--x"],
      req: { model: "Helsinki-NLP/opus-mt-en-zh", texts: [">>cmn_Hans<< hello"] },
    });
    expect(s.source("zh")).toEqual({ kind: "open-mt", id: "Helsinki-NLP/opus-mt-en-zh" });
  });

  test("LibreTranslate: self-hosted only, recorded as open MT", async () => {
    expect(libreTranslateUrlProblem("https://libretranslate.com")).toContain("hosted freemium");
    expect(libreTranslateUrlProblem("https://api.libretranslate.de/")).toContain("hosted freemium");
    expect(libreTranslateUrlProblem("http://localhost:5000")).toBeUndefined();
    expect(() => libreTranslateSource("https://libretranslate.com")).toThrow("hosted freemium");
    let body: Record<string, unknown> | undefined;
    const s = libreTranslateSource("http://localhost:5000/", (async (url: string, init: RequestInit) => {
      expect(url).toBe("http://localhost:5000/translate");
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ translatedText: ["Bonjour"] }));
    }) as unknown as typeof fetch);
    expect(await s.translate(["Hello"], "en", "fr")).toEqual(["Bonjour"]);
    expect(body).toEqual({ q: ["Hello"], source: "en", target: "fr", format: "text" });
    expect(s.source("fr")).toEqual({ kind: "open-mt", id: "argos-translate-en_fr", version: "libretranslate" });
  });

  test("an unknown engine name is refused, naming the known ones", () => {
    expect(() => sourceFor("deepl", { runner: [], run: async () => "", url: "http://localhost:5000" })).toThrow('no candidate source "deepl"; known: opus-mt, libretranslate');
  });
});

describe("collectCandidates over a layer", () => {
  function layer(): string {
    const root = mkdtempSync(join(tmpdir(), "translation-candidates-"));
    mkdirSync(join(root, "translations", "es", "start"), { recursive: true });
    mkdirSync(join(root, "translations", "fr"), { recursive: true });
    writeFileSync(join(root, "translations", "es", "start", "a.pot"), PO.replace(/msgstr "[^"]+"/g, 'msgstr ""'));
    writeFileSync(join(root, "translations", "es", "start", "a.po"), PO);
    writeFileSync(
      join(root, "translations", "es", "start", "a.json"),
      JSON.stringify({ $schema: "translation-node/v1", label: "trans:es/start/a", locale: "es", sourceFile: "docs/a.md", poFile: "translations/es/start/a.po", status: { locale: "es", official: false, generatedBy: "agent" }, title: "keep me" }),
    );
    writeFileSync(join(root, "translations", "fr", "kg.pot"), PO);
    writeFileSync(join(root, "translations", "fr", "kg.po"), `# DO NOT MACHINE-FILL THIS FILE.\n${PO}`);
    writeFileSync(join(root, "translations", "fr", "b.pot"), PO);
    return root;
  }
  const now = () => new Date("2026-11-14T12:00:00Z");
  const read = (root: string, p: string) => readFileSync(join(root, "translations", p), "utf-8");

  test("several sources become candidates; the first fills; the node records it; the forbidden catalogue is untouched", async () => {
    const root = layer();
    const opus = fakeSource("opus", "O:");
    const argos = fakeSource("argos", "A:");
    const { reports, potOnly } = await collectCandidates({ root, translations: "translations", sources: [opus, argos], now });
    const es = reports.find((r) => r.locale === "es")!;
    expect(es.added).toBe(12);
    expect(es.filled).toHaveLength(5);
    // The plural entry: one candidate per source, every form, filled fuzzy.
    expect(read(root, "es/start/a.po")).toContain('#, fuzzy\nmsgid "%d file"\nmsgid_plural "%d files"\nmsgstr[0] "O:%d file"\nmsgstr[1] "O:%d files"');
    const side = JSON.parse(read(root, "es/start/a.candidates.json"));
    expect(candidatesProblems(side)).toEqual([]);
    expect(side.entries.find((e: { msgid: string }) => e.msgid === "Open {name} now").candidates).toEqual([
      { text: "O:Open {name} now", source: { kind: "open-mt", id: "opus-en-es", at: "2026-11-14T12:00:00.000Z" } },
      { text: "A:Open {name} now", source: { kind: "open-mt", id: "argos-en-es", at: "2026-11-14T12:00:00.000Z" } },
    ]);
    expect(read(root, "es/start/a.po")).toContain('#, fuzzy\nmsgid "Open {name} now"\nmsgstr "O:Open {name} now"');
    const node = JSON.parse(read(root, "es/start/a.json"));
    expect(node.status).toEqual({ locale: "es", official: false, generatedBy: "machine", generator: "opus-en-es", generatedAt: "2026-11-14T12:00:00.000Z" });
    expect(node.title).toBe("keep me");
    // DO NOT MACHINE-FILL: candidates for a reviewer, catalogue unchanged.
    const kg = reports.find((r) => r.catalogue === "kg")!;
    expect(kg.noFill).toContain("DO NOT MACHINE-FILL");
    expect(kg.filled).toEqual([]);
    expect(read(root, "fr/kg.po")).toBe(`# DO NOT MACHINE-FILL THIS FILE.\n${PO}`);
    expect(existsSync(join(root, "translations", "fr", "kg.candidates.json"))).toBe(true);
    expect(potOnly).toEqual(["fr/b.pot"]);
    // Masked text reached the engine; whitespace did not.
    expect(opus.calls.flat()).toContain("Run [0] in [1]the shell[2].");
    // A second run adds nothing and changes nothing.
    const poBefore = read(root, "es/start/a.po");
    const again = await collectCandidates({ root, translations: "translations", sources: [opus, argos], locales: ["es"], now });
    expect(again.reports[0]!.added).toBe(0);
    expect(read(root, "es/start/a.po")).toBe(poBefore);
  });

  test("an official node gets candidates but no fill; a dry run writes nothing", async () => {
    const root = layer();
    const nodePath = join(root, "translations", "es", "start", "a.json");
    const n = JSON.parse(readFileSync(nodePath, "utf-8"));
    n.status.official = true;
    writeFileSync(nodePath, JSON.stringify(n));
    const r1 = await collectCandidates({ root, translations: "translations", sources: [fakeSource("o", "O:")], locales: ["es"], now });
    expect(r1.reports[0]!.noFill).toContain("official");
    expect(r1.reports[0]!.filled).toEqual([]);
    expect(read(root, "es/start/a.po")).toBe(PO);

    const root2 = layer();
    const r2 = await collectCandidates({ root: root2, translations: "translations", sources: [fakeSource("o", "O:")], locales: ["es"], dryRun: true, now });
    expect(r2.reports[0]!.filled).toHaveLength(5);
    expect(read(root2, "es/start/a.po")).toBe(PO);
    expect(existsSync(join(root2, "translations", "es", "start", "a.candidates.json"))).toBe(false);
  });

  test("--init starts a catalogue from its template and fills it; a missing node is created and validates", async () => {
    const root = layer();
    const { reports, potOnly } = await collectCandidates({ root, translations: "translations", sources: [fakeSource("o", "O:")], locales: ["fr"], init: true, now });
    expect(potOnly).toEqual([]);
    const b = reports.find((r) => r.catalogue === "b")!;
    expect(b.initialised).toBe(true);
    expect(b.nodeCreated).toBe(true);
    const po = read(root, "fr/b.po");
    expect(po).toContain('"Language: fr\\n"');
    expect(po).toContain('"X-Folio-Official: no\\n"');
    expect(po).toContain('msgstr "Hola, ya traducido"'); // the template's own text is kept
    expect(JSON.parse(read(root, "fr/b.json"))).toMatchObject({
      label: "trans:fr/b",
      sourceFile: "docs/a.md",
      potFile: "translations/fr/b.pot",
      poFile: "translations/fr/b.po",
      status: { locale: "fr", official: false, generatedBy: "machine", generator: "o-en-fr" },
    });
  });

  test("an invalid node or candidates file refuses the catalogue; --no-create-node records without filling", async () => {
    const root = layer();
    writeFileSync(join(root, "translations", "es", "start", "a.json"), "{}");
    const bad = await collectCandidates({ root, translations: "translations", sources: [fakeSource("o", "O:")], locales: ["es"], now });
    expect(bad.reports[0]!.refused).toContain("does not validate");

    const root2 = layer();
    writeFileSync(join(root2, "translations", "es", "start", "a.candidates.json"), JSON.stringify({ $schema: "nope" }));
    const bad2 = await collectCandidates({ root: root2, translations: "translations", sources: [fakeSource("o", "O:")], locales: ["es"], now });
    expect(bad2.reports[0]!.refused).toContain("translation-candidates/v1");

    const root3 = layer();
    rmSync(join(root3, "translations", "es", "start", "a.json"));
    const skip = await collectCandidates({ root: root3, translations: "translations", sources: [fakeSource("o", "O:")], locales: ["es"], createNode: false, now });
    expect(skip.reports[0]!.noFill).toContain("no translation node");
    expect(skip.reports[0]!.added).toBe(6);
    expect(read(root3, "es/start/a.po")).toBe(PO);
  });

  test("addCandidates is the shared entry point other sources call", () => {
    const root = layer();
    const r = addCandidates([{ msgid: "Open {name} now", text: "Abrir {name} ya", source: { kind: "web-service", id: "weblate", at: "2026-11-14T00:00:00Z" } }], {
      root,
      translations: "translations",
      locale: "es",
      catalogue: "start/a",
      now,
    });
    expect(r.added).toBe(1);
    expect(r.filled).toHaveLength(1);
    expect(JSON.parse(read(root, "es/start/a.json")).status.generatedBy).toBe("web-service");
  });

  test("addCandidates takes a region-tagged locale (pt-BR) and creates its node", () => {
    const root = layer();
    mkdirSync(join(root, "translations", "pt-BR", "start"), { recursive: true });
    const empty = PO.replace(/msgstr "[^"]+"/g, 'msgstr ""');
    writeFileSync(join(root, "translations", "pt-BR", "start", "a.pot"), empty);
    writeFileSync(join(root, "translations", "pt-BR", "start", "a.po"), empty);
    const r = addCandidates([{ msgid: "Open {name} now", text: "Abrir {name} agora", source: { kind: "web-service", id: "crowdin", at: "2026-11-14T00:00:00Z" } }], {
      root,
      translations: "translations",
      locale: "pt-BR",
      catalogue: "start/a",
      now,
    });
    expect(r.refused).toBeUndefined();
    expect(r.added).toBe(1);
    expect(r.filled).toHaveLength(1);
    expect(r.nodeCreated).toBe(true);
    const node = JSON.parse(read(root, "pt-BR/start/a.json"));
    expect(node).toMatchObject({ label: "trans:pt-BR/start/a", locale: "pt-BR", status: { locale: "pt-BR", official: false, generatedBy: "web-service" } });
    expect(read(root, "pt-BR/start/a.po")).toContain('msgstr "Abrir {name} agora"');
  });
});
