import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  bestTemplate,
  fetchPublisherBundles,
  fillTemplate,
  matchTemplate,
  mergeNeeds,
  needs,
  parseProperties,
  placeholders,
  readBundle,
  readOwnCatalogue,
  translateMessages,
  usageReport,
} from "./ig-publisher-i18n.ts";
import type { QaMessages } from "./ig-qa-messages.ts";

/** A jar's bundles as the Publisher ships them: English, a locale with one good and one broken template, and a locale with none. */
function bundles(): string {
  const dir = mkdtempSync(join(tmpdir(), "pub-i18n-"));
  writeFileSync(
    join(dir, "Messages.properties"),
    [
      "# comment",
      "MSG_EXPERIMENTAL = Reference to experimental {2} {0}",
      "MSG_DEPRECATED = Reference to deprecated {2} {0}",
      "XHTML_URL_INVALID = The URL is not valid because ''({1})'': {0}",
      "XHTML_URL_INVALID_CHARS_other = URL contains {0} Invalid Characters: {1}",
      "Details_for__matching_against_Profile_ = Details for {0} matching against profile {1}",
      "This_element_does_not_match_any_known_slice_ = This element does not match any known slice {0} (this may not be a \\",
      "  problem)",
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "Messages_ru.properties"),
    ["MSG_EXPERIMENTAL = \\u0421\\u0441\\u044b\\u043b\\u043a\\u0430 {2} {0}", "MSG_DEPRECATED = broken {2} {2} {0}}", "XHTML_URL_INVALID = URL bad ''({1})'': {0}"].join("\n"),
  );
  writeFileSync(join(dir, "Messages_zh.properties"), "");
  return dir;
}

const MESSAGES: QaMessages = {
  $schema: "ig-qa-messages/v1",
  groups: [
    {
      file: "a.json",
      messages: [
        { severity: "warning", text: "Reference to experimental CodeSystem http://x/CS|1", messageId: "MSG_EXPERIMENTAL" },
        { severity: "warning", text: "Reference to deprecated ValueSet http://x/VS", messageId: "MSG_DEPRECATED" },
        { severity: "information", text: "This element does not match any known slice defined in P (this may not be a problem)", messageId: "Details_for__matching_against_Profile_" },
        { severity: "error", text: "The URL is not valid because '(URL contains 6 Invalid Characters: '\\')': file://c", messageId: "XHTML_URL_INVALID" },
        { severity: "information", text: "The resource CodeSystem/A could usefully have an OID assigned (OIDs are easy to assign - see https://o)" },
      ],
    },
  ],
};

function catalogue(locale: string, body: string): string {
  const dir = mkdtempSync(join(tmpdir(), "pub-po-"));
  mkdirSync(join(dir, locale, "publisher"), { recursive: true });
  writeFileSync(join(dir, locale, "publisher", "messages.po"), `msgid ""\nmsgstr ""\n"Language: ${locale}\\n"\n\n${body}\n`);
  return dir;
}

describe("ig-publisher-i18n", () => {
  test("readsJavaPropertiesAndMessageFormatTemplates", () => {
    const p = parseProperties("a = x\\u00e9\nb: two \\\n  lines\n! c = no\nd=''{0}''");
    expect(p.get("a")).toBe("xé");
    expect(p.get("b")).toBe("two lines");
    expect(p.has("! c")).toBe(false);
    expect(placeholders("Reference to draft {2} {0} from {3}")).toEqual([0, 2, 3]);
    expect(placeholders("bad {0}}")).toBeUndefined();
    const m = matchTemplate("The URL is not valid because ''({1})'': {0}", "The URL is not valid because '(why)': file://c")!;
    expect([...m]).toEqual([
      [1, "why"],
      [0, "file://c"],
    ]);
    expect(fillTemplate("URL bad ''({1})'': {0}", m)).toBe("URL bad '(why)': file://c");
    expect(matchTemplate("Reference to deprecated {2} {0}", "Something else")).toBeUndefined();
  });

  test("translatesByKeyThenByBestTemplateAndRefusesBrokenPublisherTemplates", () => {
    const b = readBundle(bundles(), "Messages");
    expect(bestTemplate(b, "This element does not match any known slice X (this may not be a problem)")).toBe("This_element_does_not_match_any_known_slice_");
    const ru = translateMessages(MESSAGES, { locale: "ru", publisher: b, own: [] });
    const ms = ru.messages.groups[0]!.messages;
    expect(ms[0]).toMatchObject({ origin: "publisher", text: "Ссылка CodeSystem http://x/CS|1", en: "Reference to experimental CodeSystem http://x/CS|1" });
    // `broken {2} {2} {0}}` keeps a stray brace: refused, never shown.
    expect(ms[1]!.origin).toBe("source");
    expect(ru.refused.map((r) => r.messageId)).toContain("MSG_DEPRECATED");
    // The parameter, itself a message, has no ru translation and stays as printed.
    expect(ms[3]).toMatchObject({ origin: "publisher", text: "URL bad '(URL contains 6 Invalid Characters: '\\')': file://c" });
    expect(ru.counts).toEqual({ publisher: 2, machine: 0, source: 3 });
  });

  test("fillsTheGapsFromThisLayersCatalogueMarkedMachine", () => {
    const b = readBundle(bundles(), "Messages");
    const dir = catalogue(
      "zh",
      [
        'msgctxt "MSG_DEPRECATED"\nmsgid "Reference to deprecated {2} {0}"\nmsgstr "引用了已弃用的 {2} {0}"',
        'msgctxt "This_element_does_not_match_any_known_slice_"\nmsgid "This element does not match any known slice {0} (this may not be a problem)"\nmsgstr "不匹配切片 {0}"',
        'msgctxt "text"\nmsgid "The resource {0} could usefully have an OID assigned (OIDs are easy to assign - see {1})"\nmsgstr "资源 {0} 应有 OID（见 {1}）"',
        'msgctxt "MSG_EXPERIMENTAL"\nmsgid "Reference to experimental {2} {0}"\nmsgstr "drops a placeholder {0}"',
      ].join("\n\n"),
    );
    const zh = translateMessages(MESSAGES, { locale: "zh", publisher: b, own: readOwnCatalogue(dir, "zh") });
    const ms = zh.messages.groups[0]!.messages;
    expect(ms[0]!.origin).toBe("source");
    expect(ms[1]).toMatchObject({ origin: "machine", text: "引用了已弃用的 ValueSet http://x/VS", key: "MSG_DEPRECATED|Reference to deprecated {2} {0}" });
    expect(ms[2]).toMatchObject({ origin: "machine", text: "不匹配切片 defined in P" });
    expect(ms[4]).toMatchObject({ origin: "machine", text: "资源 CodeSystem/A 应有 OID（见 https://o）" });
  });

  test("listsWhatALocaleLacksWithWhereItRendersAndAppendsIt", () => {
    const b = readBundle(bundles(), "Messages");
    const dir = mkdtempSync(join(tmpdir(), "pub-needs-"));
    const ns = needs(MESSAGES, { locale: "zh", publisher: b, own: [] }, "7.0.1", "https://example.org/ig/");
    const slice = ns.find((n) => n.context === "This_element_does_not_match_any_known_slice_")!;
    expect(slice.links).toEqual(["https://example.org/ig/zh/qa.html#qa-m0-2"]);
    expect(slice.reference).toBe("org.hl7.fhir.utilities 7.0.1 Messages.properties:This_element_does_not_match_any_known_slice_");
    // A parameter that is itself a message is needed too.
    expect(ns.map((n) => n.context)).toContain("XHTML_URL_INVALID_CHARS_other");
    expect(ns.some((n) => n.context === "text" && n.msgid.startsWith("The resource {0} could usefully"))).toBe(true);
    expect(mergeNeeds(dir, "zh", ns)).toBe(ns.length);
    expect(mergeNeeds(dir, "zh", ns)).toBe(0);
    const po = readFileSync(join(dir, "zh", "publisher", "messages.po"), "utf-8");
    expect(po).toContain("#. rendered at: https://example.org/ig/zh/qa.html#qa-m0-2");
    // Without a site, an entry names no IG: no example and no links, only where to find them.
    const bare = needs(MESSAGES, { locale: "zh", publisher: b, own: [] }, "7.0.1");
    expect(bare.every((n) => n.example === "" && n.links.length === 0)).toBe(true);
    expect(po).toContain("#, java-format");
    // An empty entry translates nothing.
    expect(readOwnCatalogue(dir, "zh")).toEqual([]);
  });

  test("reportsWhereEachTranslatedStringIsUsed", () => {
    const b = readBundle(bundles(), "Messages");
    const r = usageReport(new Map([["ru", translateMessages(MESSAGES, { locale: "ru", publisher: b, own: [] })]])) as { locales: Record<string, { keys: Record<string, { origin: string; links: string[] }> }> };
    expect(r.locales.ru!.keys["MSG_EXPERIMENTAL|Reference to experimental {2} {0}"]).toEqual({ origin: "publisher", count: 1, links: ["ru/qa.html#qa-m0-0"] } as never);
  });

  test("neverSubstitutesAnotherCoreVersion", () => {
    expect(fetchPublisherBundles("latest", tmpdir())).toMatchObject({ ok: false });
    const cache = mkdtempSync(join(tmpdir(), "pub-cache-"));
    mkdirSync(join(cache, "7.0.1"));
    writeFileSync(join(cache, "7.0.1", "Messages.properties"), "A = a");
    // A cached version is reused without a fetch.
    expect(fetchPublisherBundles("7.0.1", cache)).toEqual({ dir: join(cache, "7.0.1"), ok: true });
  });
});
