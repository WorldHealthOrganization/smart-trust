#!/usr/bin/env bun
/**
 * ig-publisher-i18n.ts — the IG Publisher's own translations, used to put the
 * Publisher's QA messages in each locale an IG translates into.
 *
 * Owner, 2026-11-14: *"For this page why is there no translation? … Do we
 * need to retrieve the translation files from the fhir IG publisher as part
 * of the process?"*, then, choosing between the options: the Publisher's
 * translations first, our machine translation for what they lack.
 *
 * ## Where the Publisher keeps them
 *
 * The validator's messages and the renderer's phrases ship inside
 * `org.hl7.fhir.utilities-<core>.jar` as Java bundles: `Messages.properties`
 * (English), `Messages_<lang>.properties`, and `rendering-phrases*.properties`.
 * Every message the Publisher writes to `qa.xml` carries its bundle key as
 * `message-id` (`ig-qa-messages.ts`), so a message can be translated by key
 * without running the Publisher again in each language.
 *
 * The jar is fetched from Maven Central at **exactly** the core version the
 * AST recorded (`manifest.toolchain.core`). No other version is substituted:
 * a missing jar leaves every message in English and the build says why.
 *
 * ## What is trusted
 *
 * A message is translated only when its English text is an instance of its
 * key's English template (the parameters are recovered from it) and the
 * locale's template uses exactly the same placeholders. A locale template
 * that drops, adds or misspells a placeholder (the Publisher's own bundles
 * carry some, e.g. `{0}}`) is refused and reported, never used.
 *
 * Order of sources for one message: the Publisher's bundle for the locale,
 * then this layer's catalogue `translations/<locale>/publisher/messages.po`
 * (machine translation, marked as such), then the English text unchanged.
 *
 *   bun run fhir-harness/scripts/ig-publisher-i18n.ts fetch <core-version> <dir>
 *
 * @module fhir-harness/scripts/ig-publisher-i18n
 * @covers none — it translates messages other tools wrote, and judges nothing
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePoEntries } from "../../cat-harness-tools/pipeline/po-inject.ts";
import type { QaMessage, QaMessages } from "./ig-qa-messages.ts";

/** The Maven Central location of the core utilities jar for `version`. */
export function coreJarUrl(version: string): string {
  return `https://repo1.maven.org/maven2/ca/uhn/hapi/fhir/org.hl7.fhir.utilities/${version}/org.hl7.fhir.utilities-${version}.jar`;
}

/** The bundle families this module reads. */
export const BUNDLES = ["Messages", "rendering-phrases"] as const;
export type BundleName = (typeof BUNDLES)[number];

/** Parse a Java `.properties` file: `key = value`, `\` continuations, `\uXXXX` and `\t \n` escapes. */
export function parseProperties(text: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]!.replace(/^\s+/, "");
    if (line === "" || line[0] === "#" || line[0] === "!") continue;
    while (/(^|[^\\])(\\\\)*\\$/.test(line) && i + 1 < lines.length) line = line.slice(0, -1) + lines[++i]!.replace(/^\s+/, "");
    const m = /^((?:\\.|[^\s=:\\])+)\s*[=:]?\s*([\s\S]*)$/.exec(line);
    if (!m) continue;
    out.set(unescapeProps(m[1]!), unescapeProps(m[2]!));
  }
  return out;
}

function unescapeProps(s: string): string {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_, e: string) =>
    e.length === 5 ? String.fromCharCode(parseInt(e.slice(1), 16)) : e === "t" ? "\t" : e === "n" ? "\n" : e === "r" ? "\r" : e === "f" ? "\f" : e,
  );
}

/** The placeholder indices a MessageFormat template uses, sorted and de-duplicated, or `undefined` when a brace is malformed. */
export function placeholders(template: string): number[] | undefined {
  const lit = template.replace(/''/g, "");
  const found = new Set<number>();
  const re = /\{(\d+)(?:,[^{}]*)?\}/g;
  let rest = lit;
  for (let m = re.exec(lit); m; m = re.exec(lit)) found.add(Number(m[1]));
  rest = lit.replace(re, "");
  if (/[{}]/.test(rest)) return undefined;
  return [...found].sort((a, b) => a - b);
}

const sameSet = (a: number[] | undefined, b: number[] | undefined): boolean => !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

/** MessageFormat's literal text: `''` is one quote. */
const literal = (s: string): string => s.replace(/''/g, "'");

/** Recover the parameters of `text` as an instance of `template`, or `undefined` when it is not one. */
export function matchTemplate(template: string, text: string): Map<number, string> | undefined {
  const parts = template.split(/(\{\d+(?:,[^{}]*)?\})/);
  const order: number[] = [];
  let src = "^";
  for (const p of parts) {
    const ph = /^\{(\d+)/.exec(p);
    if (ph && p.endsWith("}")) {
      const n = Number(ph[1]);
      if (order.includes(n)) src += `\\${order.indexOf(n) + 1}`;
      else {
        order.push(n);
        src += "([\\s\\S]*?)";
      }
    } else src += literal(p).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const m = new RegExp(`${src}$`).exec(text);
  if (!m) return undefined;
  return new Map(order.map((n, i) => [n, m[i + 1]!]));
}

/** Fill `template`'s placeholders with `params`. */
export function fillTemplate(template: string, params: Map<number, string>): string {
  return template
    .split(/(\{\d+(?:,[^{}]*)?\})/)
    .map((p) => {
      const ph = /^\{(\d+)/.exec(p);
      return ph && p.endsWith("}") ? (params.get(Number(ph[1])) ?? p) : literal(p);
    })
    .join("");
}

/** One family's bundles: English and each locale the jar has. */
export interface Bundle {
  en: Map<string, string>;
  locales: Map<string, Map<string, string>>;
}

/** Read the bundles extracted to `dir` (`<name>.properties`, `<name>_<lang>.properties`). */
export function readBundle(dir: string, name: BundleName): Bundle {
  const en = existsSync(join(dir, `${name}.properties`)) ? parseProperties(readFileSync(join(dir, `${name}.properties`), "utf-8")) : new Map<string, string>();
  const locales = new Map<string, Map<string, string>>();
  if (existsSync(dir))
    for (const f of readdirSync(dir)) {
      const m = new RegExp(`^${name}_([A-Za-z_]+)\\.properties$`).exec(f);
      if (m) locales.set(m[1]!.replace(/_/g, "-"), parseProperties(readFileSync(join(dir, f), "utf-8")));
    }
  return { en, locales };
}

/** What a fetch did. */
export interface FetchResult {
  dir: string;
  ok: boolean;
  /** Why there are no bundles, when `ok` is false. */
  why?: string;
}

/**
 * Put the jar's bundles for `version` in `<cache>/<version>/` (once: a
 * directory that already holds `Messages.properties` is reused). Needs
 * `curl` and `unzip`, as the PlantUML fetch does. Never substitutes another version.
 */
export function fetchPublisherBundles(version: string, cache: string): FetchResult {
  if (!/^\d+\.\d+\.\d+([.-][\w.-]+)?$/.test(version)) return { dir: "", ok: false, why: `"${version}" is not a core version` };
  const dir = join(cache, version);
  if (existsSync(join(dir, "Messages.properties"))) return { dir, ok: true };
  mkdirSync(dir, { recursive: true });
  const jar = join(dir, "core-utilities.jar");
  try {
    execFileSync("curl", ["-fsSL", "--retry", "3", "-m", "180", "-o", jar, coreJarUrl(version)], { stdio: ["ignore", "ignore", "pipe"] });
    execFileSync("unzip", ["-o", "-q", jar, ...BUNDLES.map((b) => `${b}*.properties`), "-d", dir], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    return { dir, ok: false, why: `could not fetch or unpack org.hl7.fhir.utilities ${version} from Maven Central: ${(e as Error).message.split("\n")[0]}` };
  }
  return existsSync(join(dir, "Messages.properties")) ? { dir, ok: true } : { dir, ok: false, why: `org.hl7.fhir.utilities ${version} holds no Messages.properties` };
}

/** One entry of this layer's own catalogue for the Publisher's messages. */
export interface OwnEntry {
  /** The message key, or `text` for a message the Publisher wrote without one. */
  context: string;
  /** The English template, `{n}` placeholders as in the Publisher's bundles. */
  msgid: string;
  msgstr: string;
}

/** The layer's catalogue for `locale` (`translations/<locale>/publisher/messages.po`): translated, non-fuzzy entries. */
export function readOwnCatalogue(translationsDir: string, locale: string): OwnEntry[] {
  const p = join(translationsDir, locale, "publisher", "messages.po");
  if (!existsSync(p)) return [];
  return parsePoEntries(readFileSync(p, "utf-8"))
    .filter((e) => e.msgid !== "" && e.msgstr.trim() !== "" && !e.flags.includes("fuzzy"))
    .map((e) => ({ context: e.context ?? "text", msgid: e.msgid, msgstr: e.msgstr }));
}

/** Where one message's words came from. */
export type Origin = "publisher" | "machine" | "source";

/** A message as drawn in one locale. */
export interface LocalisedMessage extends QaMessage {
  /** The English text, when `text` is a translation. */
  en?: string;
  origin: Origin;
  /** The catalogue key a reviewer finds it under: `<messageId or text>|<English template>`. */
  key?: string;
}

/** A locale template the build refused, and why. */
export interface Refusal {
  locale: string;
  messageId: string;
  why: string;
}

/** The sources one locale's messages are translated from. */
export interface MessageSources {
  locale: string;
  /** The Publisher's `Messages` bundle, when it was fetched. */
  publisher?: Bundle;
  /** This layer's catalogue for the locale. */
  own: OwnEntry[];
}

/** A template's literal characters: what a match of it is evidence of. */
const literalLength = (template: string): number => literal(template.replace(/\{\d+(?:,[^{}]*)?\}/g, "")).replace(/\s+/g, "").length;

/** The fewest literal characters a template needs to be matched against a message by text alone. */
export const MIN_LITERAL = 16;

const compiled = new WeakMap<Bundle, { key: string; lit: number; first: string }[]>();
const best = new WeakMap<Bundle, Map<string, string | null>>();

/**
 * The bundle key whose English template `text` is an instance of, with the
 * most literal characters; `undefined` when none of at least
 * {@link MIN_LITERAL} literal characters fits, or two fit equally well.
 */
export function bestTemplate(b: Bundle, text: string): string | undefined {
  let memo = best.get(b);
  if (!memo) best.set(b, (memo = new Map()));
  const hit = memo.get(text);
  if (hit !== undefined) return hit ?? undefined;
  let list = compiled.get(b);
  if (!list) {
    list = [...b.en]
      .map(([key, en]) => ({ key, lit: literalLength(en), first: literal(en.split(/\{\d+(?:,[^{}]*)?\}/)[0] ?? "") }))
      .filter((x) => x.lit >= MIN_LITERAL)
      .sort((a, b2) => b2.lit - a.lit);
    compiled.set(b, list);
  }
  let found: string | undefined;
  let lit = -1;
  let tie = false;
  for (const c of list) {
    if (c.lit < lit) break;
    if (!text.startsWith(c.first)) continue;
    if (!matchTemplate(b.en.get(c.key)!, text)) continue;
    if (c.lit === lit && b.en.get(c.key) !== b.en.get(found!)) tie = true;
    else if (found === undefined) {
      found = c.key;
      lit = c.lit;
    }
  }
  const r = found && !tie ? found : undefined;
  memo.set(text, r ?? null);
  return r;
}

/** The candidate keys for a message id: plurals are `<id>_one` / `<id>_other`. */
const keysFor = (id: string): string[] => [id, `${id}_one`, `${id}_other`];

/** One text in the locale, and where its words came from; `undefined` when no source has it. */
interface Rendered {
  text: string;
  origin: Exclude<Origin, "source">;
  key: string;
}

/** The locale's template for bundle key `k`, refusing one whose placeholders differ from the English. */
function localeTemplate(k: string, en: string, s: MessageSources, refused: Refusal[]): { t: string; origin: Exclude<Origin, "source"> } | undefined {
  const tr = s.publisher?.locales.get(s.locale)?.get(k);
  if (tr && tr.trim() !== "") {
    if (sameSet(placeholders(en), placeholders(tr))) return { t: tr, origin: "publisher" };
    refused.push({ locale: s.locale, messageId: k, why: `placeholders ${JSON.stringify(placeholders(tr) ?? "malformed")} differ from the English ${JSON.stringify(placeholders(en))}` });
  }
  const own = s.own.find((o) => o.context === k && o.msgid === en);
  return own && sameSet(placeholders(en), placeholders(own.msgstr)) ? { t: own.msgstr, origin: "machine" } : undefined;
}

/**
 * Fill a locale template, each parameter translated too when it is itself a
 * message (`depth` levels; a parameter no source has stays as printed).
 * The whole is `machine` when any part is.
 */
function fill(t: { t: string; origin: Exclude<Origin, "source"> }, params: Map<number, string>, s: MessageSources, refused: Refusal[], depth: number): { text: string; origin: Exclude<Origin, "source"> } {
  let origin = t.origin;
  const tp = new Map<number, string>();
  for (const [i, v] of params) {
    const r = depth > 0 && v.length >= MIN_LITERAL ? translateText(v, undefined, s, refused, depth - 1) : undefined;
    if (r && r.origin === "machine") origin = "machine";
    tp.set(i, r ? r.text : v);
  }
  return { text: fillTemplate(t.t, tp), origin };
}

/** `text` in `s.locale`: by its key's template, else the bundle template it best fits, else this layer's text templates. */
export function translateText(text: string, id: string | undefined, s: MessageSources, refused: Refusal[] = [], depth = 1): Rendered | undefined {
  const tryKey = (k: string): Rendered | undefined => {
    const en = s.publisher?.en.get(k) ?? s.own.find((o) => o.context === k)?.msgid;
    if (en === undefined) return undefined;
    const params = matchTemplate(en, text);
    if (!params) return undefined;
    const t = localeTemplate(k, en, s, refused);
    return t ? { ...fill(t, params, s, refused, depth), key: `${k}|${en}` } : undefined;
  };
  if (id) for (const k of keysFor(id)) {
    const r = tryKey(k);
    if (r) return r;
  }
  // The Publisher keys some messages by an outer message and prints an inner one.
  const k = s.publisher ? bestTemplate(s.publisher, text) : undefined;
  if (k && k !== id) {
    const r = tryKey(k);
    if (r) return r;
  }
  // This layer's text templates: what no bundle template covers.
  for (const o of s.own) {
    if (o.context !== "text") continue;
    const params = matchTemplate(o.msgid, text);
    if (params && sameSet(placeholders(o.msgid), placeholders(o.msgstr))) return { ...fill({ t: o.msgstr, origin: "machine" }, params, s, refused, depth), key: `text|${o.msgid}` };
  }
  return undefined;
}

/** Translate one message, or keep it in English with `origin: "source"`. */
export function translateMessage(m: QaMessage, s: MessageSources, refused: Refusal[] = []): LocalisedMessage {
  const r = translateText(m.text, m.messageId, s, refused);
  return r ? { ...m, text: r.text, en: m.text, origin: r.origin, key: r.key } : { ...m, origin: "source" };
}

/** Counts of a locale's messages by origin. */
export type OriginCounts = Record<Origin, number>;

/** Every message of `q` in `s.locale`, with counts and the refused templates. */
/** A locale's copy of the Publisher's messages, as the site publishes it beside the English. */
export interface LocalisedQaMessages extends Omit<QaMessages, "groups"> {
  locale: string;
  groups: { file?: string; messages: LocalisedMessage[] }[];
}

export function translateMessages(q: QaMessages, s: MessageSources): { messages: LocalisedQaMessages; counts: OriginCounts; refused: Refusal[] } {
  const counts: OriginCounts = { publisher: 0, machine: 0, source: 0 };
  const refused: Refusal[] = [];
  const groups = q.groups.map((g) => ({
    ...g,
    messages: g.messages.map((m) => {
      const t = translateMessage(m, s, refused);
      counts[t.origin]++;
      return t;
    }),
  }));
  const seen = new Set<string>();
  return { messages: { ...q, locale: s.locale, groups }, counts, refused: refused.filter((r) => !seen.has(r.messageId) && seen.add(r.messageId) !== undefined) };
}

/**
 * English templates for what the Publisher prints with no bundle key (or a
 * key its bundle does not hold), and for the core invariants' descriptions
 * that its constraint messages carry. MessageFormat, as the bundles: `''` is
 * one quote. Keyed `text` in this layer's catalogue.
 */
export const TEXT_TEMPLATES: readonly string[] = [
  "The resource {0} should have an OID assigned to cater for possible use with OID based terminology systems e.g. CDA usage (OIDs are easy to assign - see {1})",
  "The resource {0} could usefully have an OID assigned (OIDs are easy to assign - see {1})",
  "URL Mismatch {0} vs {1}",
  "Conformance resource {0} - the canonical URL ({1}) does not match the URL ({2}). Use the special-url parameter if you really mean for it not to match",
  "No conformance term found in the text: {0}",
  "Name should be usable as an identifier for the module by machine processing applications such as code generation ({0})",
  "Element names should be simple alphanumerics with a max of 64 characters, or code generation tools may be broken ({0})",
];

/** Where a page draws the Publisher's messages, and how one row is addressed there: `<page>#qa-m<group>-<row>`. */
export const QA_PAGE = "qa.html";
export const rowAnchor = (group: number, row: number): string => `qa-m${group}-${row}`;

/** One catalogue string a locale lacks, with what a translator needs to see. */
export interface Need {
  context: string;
  msgid: string;
  /** Where the English comes from: a bundle key in the jar, or this module. */
  reference: string;
  /** How many messages of this build print it. */
  count: number;
  /** One message as the Publisher printed it. */
  example: string;
  /** Up to {@link MAX_LINKS} rows that print it, as `[<site>/]<locale>/qa.html#qa-m<g>-<r>`. */
  links: string[];
}

export const MAX_LINKS = 5;

/**
 * The strings `locale` lacks for this build's messages: each bundle template
 * a message (or a parameter of one) is an instance of that neither the
 * Publisher nor this layer translates, and each {@link TEXT_TEMPLATES} entry
 * a message fits that this layer does not translate.
 */
export function needs(q: QaMessages, s: MessageSources, version = "?", site = ""): Need[] {
  const base = `${site ? `${site.replace(/\/+$/, "")}/` : ""}${s.locale}/${QA_PAGE}`;
  const out = new Map<string, Need>();
  const add = (context: string, msgid: string, reference: string, example: string, link: string) => {
    const k = `${context}\u0004${msgid}`;
    // Without a site, nothing of the IG's own data is kept: a shared catalogue must not name any IG.
    const n = out.get(k) ?? { context, msgid, reference, count: 0, example: site ? example : "", links: [] };
    n.count++;
    if (site && n.links.length < MAX_LINKS && !n.links.includes(link)) n.links.push(link);
    out.set(k, n);
  };
  const visit = (text: string, id: string | undefined, link: string, depth: number) => {
    let key: string | undefined;
    let en: string | undefined;
    if (s.publisher) {
      for (const k of id ? keysFor(id) : []) {
        const e = s.publisher.en.get(k);
        if (e !== undefined && matchTemplate(e, text)) {
          key = k;
          en = e;
          break;
        }
      }
      if (!key) {
        const k = bestTemplate(s.publisher, text);
        if (k) {
          key = k;
          en = s.publisher.en.get(k);
        }
      }
    }
    if (key && en !== undefined) {
      if (!localeTemplate(key, en, s, [])) add(key, en, `org.hl7.fhir.utilities ${version} Messages.properties:${key}`, text, link);
      if (depth > 0) for (const v of matchTemplate(en, text)!.values()) if (v.length >= MIN_LITERAL) visit(v, undefined, link, depth - 1);
      return;
    }
    const tt = TEXT_TEMPLATES.find((t) => matchTemplate(t, text));
    if (!tt) return;
    if (!s.own.some((o) => o.context === "text" && o.msgid === tt && sameSet(placeholders(tt), placeholders(o.msgstr)))) add("text", tt, "fhir-harness/scripts/ig-publisher-i18n.ts TEXT_TEMPLATES", text, link);
    if (depth > 0) for (const v of matchTemplate(tt, text)!.values()) if (v.length >= MIN_LITERAL) visit(v, undefined, link, depth - 1);
  };
  q.groups.forEach((g, gi) => g.messages.forEach((m, mi) => visit(m.text, m.messageId, `${base}#${rowAnchor(gi, mi)}`, 1)));
  return [...out.values()].sort((a, b) => b.count - a.count || a.context.localeCompare(b.context));
}

/** A PO string literal. */
export function poString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;
}

const oneLine = (s: string, max = 300): string => (s.length > max ? `${s.slice(0, max)}…` : s).replace(/\s+/g, " ");

/** One empty catalogue entry for `n`, carrying where it renders. */
export function needEntry(n: Need): string {
  return [
    "#. origin: to be filled by machine translation (agent); no person has reviewed it",
    ...(n.example ? [`#. used by ${n.count} message(s) of the build this entry was added from`, `#. example: ${oneLine(n.example)}`] : []),
    n.links.length
      ? `#. rendered at: ${n.links.join(" ")}`
      : `#. rendered at: <locale>/${QA_PAGE}, the Publisher's messages; each IG's assets/fhir-qa/i18n-usage.json links the rows that print it`,
    "#. keep every {n} placeholder; write '' for an apostrophe (MessageFormat)",
    `#: ${n.reference}`,
    "#, java-format",
    `msgctxt ${poString(n.context)}`,
    `msgid ${poString(n.msgid)}`,
    'msgstr ""',
  ].join("\n");
}

/** A new catalogue's header for `locale`. */
export function catalogueHeader(locale: string): string {
  return [
    "# The IG Publisher's QA messages: what its own bundles do not translate.",
    "# Read by fhir-harness/scripts/ig-publisher-i18n.ts after the Publisher's",
    "# Messages_<lang>.properties. Agent translation, unofficial: no person has",
    "# reviewed it. `ig-publisher-i18n.ts needs --merge` appends what a build lacks.",
    'msgid ""',
    'msgstr ""',
    `"Language: ${locale}\\n"`,
    '"Content-Type: text/plain; charset=UTF-8\\n"',
    '"Last-Translator: agent (unofficial, no human sign-off)\\n"',
    "",
  ].join("\n");
}

/** Append to `translations/<locale>/publisher/messages.po` each need it holds no entry for, translated or not. Returns how many were added. */
export function mergeNeeds(translationsDir: string, locale: string, ns: Need[]): number {
  const p = join(translationsDir, locale, "publisher", "messages.po");
  const text = existsSync(p) ? readFileSync(p, "utf-8") : catalogueHeader(locale);
  const have = new Set(parsePoEntries(text).map((e) => `${e.context ?? "text"}\u0004${e.msgid}`));
  const add = ns.filter((n) => !have.has(`${n.context}\u0004${n.msgid}`));
  if (!add.length) return 0;
  mkdirSync(join(translationsDir, locale, "publisher"), { recursive: true });
  writeFileSync(p, `${text.replace(/\n*$/, "\n")}\n${add.map(needEntry).join("\n\n")}\n`);
  return add.length;
}

/**
 * The where-used report a build publishes beside the translated messages:
 * for each locale, each catalogue key its messages were drawn from, with the
 * origin and the rows that print it. A reviewer reads a string here and opens
 * the row it renders in.
 */
export function usageReport(byLocale: Map<string, ReturnType<typeof translateMessages>>): Record<string, unknown> {
  const locales: Record<string, unknown> = {};
  for (const [locale, t] of byLocale) {
    const keys = new Map<string, { origin: Origin; count: number; links: string[] }>();
    t.messages.groups.forEach((g, gi) =>
      g.messages.forEach((m, mi) => {
        const k = m.key ?? `untranslated|${m.messageId ?? "text"}`;
        const e = keys.get(k) ?? { origin: m.origin, count: 0, links: [] };
        e.count++;
        if (e.links.length < MAX_LINKS) e.links.push(`${locale}/${QA_PAGE}#${rowAnchor(gi, mi)}`);
        keys.set(k, e);
      }),
    );
    locales[locale] = { counts: t.counts, refused: t.refused, keys: Object.fromEntries([...keys].sort((a, b) => b[1].count - a[1].count)) };
  }
  return { $schema: "ig-qa-i18n-usage/v1", locales };
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  if (cmd === "fetch" && rest.length === 2) {
    const r = fetchPublisherBundles(rest[0]!, rest[1]!);
    console.log(r.ok ? `${r.dir}: bundles for org.hl7.fhir.utilities ${rest[0]}` : `no bundles: ${r.why}`);
    return r.ok ? 0 : 1;
  }
  if (cmd === "needs" && rest.length >= 4) {
    const si = rest.indexOf("--site");
    const site = si >= 0 ? rest[si + 1] : undefined;
    const [messages, bundleDir, translationsDir, ...locales] = rest.filter((a, i) => a !== "--merge" && (si < 0 || (i !== si && i !== si + 1)));
    const merge = rest.includes("--merge");
    const q = JSON.parse(readFileSync(messages!, "utf-8")) as QaMessages;
    const publisher = readBundle(bundleDir!, "Messages");
    const version = bundleDir!.replace(/\/+$/, "").split("/").pop();
    for (const locale of locales) {
      const ns = needs(q, { locale, publisher, own: readOwnCatalogue(translationsDir!, locale) }, version, site);
      const added = merge ? mergeNeeds(translationsDir!, locale, ns) : 0;
      console.log(`${locale}: ${ns.length} string(s) lack a translation${merge ? `, ${added} appended to ${join(translationsDir!, locale, "publisher", "messages.po")}` : ""}`);
    }
    return 0;
  }
  console.error("usage: ig-publisher-i18n.ts fetch <core-version> <dir>\n       ig-publisher-i18n.ts needs <qa-messages.json> <bundle-dir> <translations-dir> <locale>... [--merge] [--site <published site url>]");
  return 2;
}

if (import.meta.main) process.exit(main(process.argv.slice(2)));
