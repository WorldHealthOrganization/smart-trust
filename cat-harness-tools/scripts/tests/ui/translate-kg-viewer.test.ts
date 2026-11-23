import { describe, expect, test } from "bun:test";
import type { PotEntry } from "../../../pipeline/pot-extract.js";
import { parsePo, parsePoEntries } from "../../../pipeline/po-inject.js";
import {
  defaultPoHeader,
  syncPoContent,
} from "../../translate-kg-viewer.js";

const SAMPLE_ENTRIES: PotEntry[] = [
  {
    kind: "ui-string",
    source: "scripts/kg-viewer-strings.ts",
    line: 10,
    msgid: "All",
    comment: "The filter that selects every node.",
  },
  {
    kind: "ui-string",
    source: "scripts/kg-viewer-strings.ts",
    line: 20,
    msgid: "Download this graph as JSON-LD ({doc})",
    comment: "Accessible name of that link. {doc} is a filename.",
  },
  {
    kind: "ui-string",
    source: "scripts/kg-viewer-strings.ts",
    line: 30,
    msgid: "Interface language",
    comment: "Accessible name of the language switcher.",
  },
];

describe("syncPoContent", () => {
  test("adds a missing msgid to a .po stub with empty msgstr", () => {
    const existingPo = `msgid ""
msgstr ""
"Project-Id-Version: kg-viewer\\n"
"Language: fr\\n"

#: scripts/kg-viewer-strings.ts:10
#. The filter that selects every node.
msgid "All"
msgstr ""
`;

    const result = syncPoContent(existingPo, SAMPLE_ENTRIES, { locale: "fr" });
    expect(result.changed).toBe(true);
    expect(result.added.sort()).toEqual([
      "Download this graph as JSON-LD ({doc})",
      "Interface language",
    ].sort());
    expect(result.removed).toEqual([]);

    const parsedEntries = parsePoEntries(result.content);
    expect(parsedEntries.map((e) => e.msgid).sort()).toEqual([
      "All",
      "Download this graph as JSON-LD ({doc})",
      "Interface language",
    ].sort());

    for (const e of parsedEntries) {
      expect(e.msgstr).toBe("");
    }
  });

  test("NEVER overwrites an existing msgstr — filled translations survive", () => {
    const existingPo = `msgid ""
msgstr ""
"Project-Id-Version: kg-viewer\\n"
"Language: fr\\n"

#: scripts/kg-viewer-strings.ts:5
msgid "All"
msgstr "Tous"

#: scripts/kg-viewer-strings.ts:15
msgid "Interface language"
msgstr "Langue de l'interface"
`;

    const result = syncPoContent(existingPo, SAMPLE_ENTRIES, { locale: "fr" });
    const parsed = parsePo(result.content);
    expect(parsed.get("All")).toBe("Tous");
    expect(parsed.get("Interface language")).toBe("Langue de l'interface");
    // New entry should be present with empty msgstr
    const entries = parsePoEntries(result.content);
    const newEntry = entries.find((e) => e.msgid === "Download this graph as JSON-LD ({doc})");
    expect(newEntry).toBeDefined();
    expect(newEntry?.msgstr).toBe("");
  });

  test("removes obsolete strings no longer in the source table and reports them", () => {
    const existingPo = `msgid ""
msgstr ""
"Project-Id-Version: kg-viewer\\n"
"Language: fr\\n"

#: scripts/kg-viewer-strings.ts:10
msgid "All"
msgstr "Tous"

#: scripts/kg-viewer-strings.ts:99
msgid "Old obsolete string"
msgstr "Ancienne chaîne"
`;

    const result = syncPoContent(existingPo, SAMPLE_ENTRIES, { locale: "fr" });
    expect(result.removed).toEqual(["Old obsolete string"]);
    expect(result.added.sort()).toEqual([
      "Download this graph as JSON-LD ({doc})",
      "Interface language",
    ].sort());

    const parsedEntries = parsePoEntries(result.content);
    expect(parsedEntries.some((e) => e.msgid === "Old obsolete string")).toBe(false);
  });

  test("preserves existing custom header block byte-for-byte", () => {
    const customHeader = `# Custom French header comments
# Line 2 of comments
msgid ""
msgstr ""
"Project-Id-Version: kg-viewer\\n"
"X-Custom-Field: hello\\n"
"Language: fr\\n"`;

    const existingPo = `${customHeader}

#: scripts/kg-viewer-strings.ts:10
msgid "All"
msgstr ""
`;

    const result = syncPoContent(existingPo, SAMPLE_ENTRIES, { locale: "fr" });
    expect(result.content.startsWith(customHeader)).toBe(true);
  });

  test("generates default header when .po is empty or has no header block", () => {
    const result = syncPoContent("", SAMPLE_ENTRIES, { locale: "es" });
    expect(result.changed).toBe(true);
    expect(result.content).toContain("Language: es\\n");
    expect(result.content).toContain("Language-Team: Spanish\\n");
    expect(result.content).toContain("DO NOT MACHINE-FILL THIS FILE");

    const entries = parsePoEntries(result.content);
    expect(entries.length).toBe(3);
  });

  test("preserves existing entry flags like fuzzy", () => {
    const existingPo = `msgid ""
msgstr ""
"Language: fr\\n"

#: scripts/kg-viewer-strings.ts:10
#, fuzzy
msgid "All"
msgstr "Tous"
`;

    const result = syncPoContent(existingPo, SAMPLE_ENTRIES, { locale: "fr" });
    const entries = parsePoEntries(result.content);
    const allEntry = entries.find((e) => e.msgid === "All");
    expect(allEntry?.flags).toContain("fuzzy");
    expect(allEntry?.msgstr).toBe("Tous");
  });

  test("returns changed = false when content is already in sync", () => {
    const existingPo = defaultPoHeader("es") + "\n\n" +
      `#: scripts/kg-viewer-strings.ts:10\n#. The filter that selects every node.\nmsgid "All"\nmsgstr ""\n\n` +
      `#: scripts/kg-viewer-strings.ts:20\n#. Accessible name of that link. {doc} is a filename.\nmsgid "Download this graph as JSON-LD ({doc})"\nmsgstr ""\n\n` +
      `#: scripts/kg-viewer-strings.ts:30\n#. Accessible name of the language switcher.\nmsgid "Interface language"\nmsgstr ""\n`;

    const result = syncPoContent(existingPo, SAMPLE_ENTRIES, { locale: "es" });
    expect(result.changed).toBe(false);
    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });
});

describe("manifest() writes a TranslationNode as JSON data (bean y9r6)", () => {
  test("valid against TranslationNodeSchema, with its $schema", async () => {
    const { manifest, TRANSLATION_NODE_SCHEMA } = await import("../../translate-kg-viewer.ts");
    const { TranslationNodeSchema } = await import("../../../schemas/content/translation.ts");
    const v = JSON.parse(manifest("fr", 0, "abc123def456"));
    expect(v.$schema).toBe(TRANSLATION_NODE_SCHEMA);
    expect(v.label).toBe("trans:fr/kg-viewer");
    expect(TranslationNodeSchema.safeParse(v).success).toBe(true);
  });
});
