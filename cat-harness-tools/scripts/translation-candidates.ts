#!/usr/bin/env bun
/**
 * Collect candidate translations from open, self-hosted engines, and fill each
 * EMPTY `msgstr` with the first good one, `#, fuzzy`.
 *
 * @module scripts/translation-candidates
 * @covers translation-sources
 *
 *   bun run cat translation:candidates --instance <layer root> --engine opus-mt
 *   bun run cat translation:candidates --instance <layer root> \
 *     --engine opus-mt,libretranslate --url http://localhost:5000
 *
 * The owner, 2026-11-14: an open machine-translation step with no freemium
 * API quota, whose output is several CANDIDATES per string for a reviewer to
 * choose among on the translation review page. Each engine is a source
 * (`scripts/lib/translation-sources/`); every candidate goes through the one
 * writer, `addCandidates` (`scripts/lib/translation-candidates.ts`), which
 * appends to `<locale>/<catalogue>.candidates.json`
 * (`translation-candidates/v1`), drops a candidate whose placeholders do not
 * round-trip, fills an empty `msgstr` with the first good candidate as
 * `#, fuzzy`, never overwrites a non-empty one, and records the source on the
 * translation node without ever setting `official`.
 *
 * Each line of a string is masked and translated on its own, its whitespace
 * kept; a plural entry gets one candidate carrying every form, as many as the
 * catalogue's plural count (owner, 2026-11-14: plurals are machine-filled,
 * fuzzy). `translate-pot` is the same command under its older name and flags.
 *
 * Engines (`--engine`, comma-separated, tried in that order for the fill):
 *   - `opus-mt`: Helsinki-NLP Marian models (CC-BY 4.0) on this machine,
 *     through `translation/opus_mt_runner.py`, or `--runner "<cmd>"`
 *     (`--python <exe>` runs the bundled runner with another Python).
 *   - `libretranslate`: a LibreTranslate you host (`--url`, default
 *     `http://localhost:5000`). The hosted libretranslate.com is refused.
 *
 * Paid services (DeepL, Google Cloud Translation, Azure Translator, Amazon
 * Translate) are not engines here; see `translation-sources/index.ts`.
 *
 * Options: `--locale es,fr` (default every locale directory) · `--only
 * <catalogue>` · `--dir <path>` for a translations directory other than the
 * declared one · `--model <id>` to override the engine's model ·
 * `--init` to start a `.po` from each template that has none ·
 * `--no-create-node` to record candidates without filling a catalogue that has
 * no node · `--no-mask` to send placeholders as they are · `--batch <n>` ·
 * `--dry-run`.
 *
 * Exit 0 something was recorded (or would be) · 3 nothing was · 2 could not
 * determine (no declaration, no catalogue, bad options) · 1 an engine failed.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { instanceDirectories } from "../schemas/kg/cat-harness.js";
import { CANDIDATES_SUFFIX } from "./lib/translation-adjudication.ts";
import { entriesToTranslate, nplurals, pluralSources, poFromPot, translateStrings, type Skipped } from "./lib/machine-translation.ts";
import { addCandidates, type AddCandidatesReport, type CandidateInput } from "./lib/translation-candidates.ts";
import { sourceFor, type CandidateSourceAdapter, type CommandRunner } from "./lib/translation-sources/index.ts";

const SOURCE_LOCALE = "en";

/** `translation/opus_mt_runner.py`, shared with `translate-pot.ts`: the default OPUS-MT runner, run isolated (`python3 -I`). */
const BUNDLED_RUNNER = fileURLToPath(new URL("./translation/opus_mt_runner.py", import.meta.url));

const runCommand: CommandRunner = (argv, stdin) =>
  new Promise((ok, fail) => {
    const p = spawn(argv[0]!, argv.slice(1), { stdio: ["pipe", "pipe", "inherit"] });
    let out = "";
    p.stdout.on("data", (d: Buffer) => (out += d.toString("utf-8")));
    p.on("error", fail);
    p.on("close", (code) => (code === 0 ? ok(out) : fail(new Error(`runner exited ${code}`))));
    p.stdin.end(stdin);
  });

/** Every catalogue under a locale directory (`.po`, and with `init` also a lone `.pot`), without extension. */
function cataloguesIn(localeDir: string, init: boolean): { catalogues: string[]; potOnly: string[] } {
  const catalogues = new Set<string>();
  const potOnly: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (n.endsWith(".po") || n.endsWith(".pot")) {
        const name = relative(localeDir, p).replace(/\.pot?$/, "").split(sep).join("/");
        const hasPo = existsSync(join(localeDir, `${name}.po`));
        const hasPot = existsSync(join(localeDir, `${name}.pot`));
        if (!hasPot) continue; // a hand-authored catalogue (a glossary): no template, not a pair
        if (hasPo || init) catalogues.add(name);
        else if (n.endsWith(".pot")) potOnly.push(name);
      }
    }
  };
  walk(localeDir);
  return { catalogues: [...catalogues].sort(), potOnly };
}

export interface RunOptions {
  root: string;
  /** The `translation-sources` directory, relative to `root`. */
  translations: string;
  sources: CandidateSourceAdapter[];
  locales?: string[];
  only?: string;
  batch?: number;
  init?: boolean;
  createNode?: boolean;
  /** Mask placeholders before translation (default true). */
  mask?: boolean;
  dryRun?: boolean;
  now?: () => Date;
  log?: (s: string) => void;
}

export interface CatalogueReport extends AddCandidatesReport {
  /** Entries not asked for: a plural a person started, or a string with nothing to translate. */
  skipped: Skipped[];
}

/** Ask every source for every wanted entry of every catalogue. Exported for the tests. */
export async function collectCandidates(o: RunOptions): Promise<{ reports: CatalogueReport[]; potOnly: string[] }> {
  const tdir = join(o.root, o.translations);
  const log = o.log ?? (() => {});
  const now = o.now ?? (() => new Date());
  const reports: CatalogueReport[] = [];
  const potOnly: string[] = [];
  const locales = (o.locales ?? readdirSync(tdir).filter((n) => statSync(join(tdir, n)).isDirectory()).sort()).filter((l) => l !== SOURCE_LOCALE);
  for (const locale of locales) {
    const ldir = join(tdir, locale);
    if (!existsSync(ldir)) continue;
    const found = cataloguesIn(ldir, o.init === true);
    potOnly.push(...found.potOnly.map((n) => `${locale}/${n}.pot`));
    for (const catalogue of found.catalogues) {
      if (o.only !== undefined && catalogue !== o.only) continue;
      const poPath = join(ldir, `${catalogue}.po`);
      const po = existsSync(poPath) ? readFileSync(poPath, "utf-8") : poFromPot(readFileSync(join(ldir, `${catalogue}.pot`), "utf-8"), locale);
      const { wanted, skipped } = entriesToTranslate(po);
      const n = nplurals(po, locale);
      const sourcesOf = (w: (typeof wanted)[number]) => (w.msgidPlural === undefined ? [w.msgid] : pluralSources(w.msgid, w.msgidPlural, n));
      const inputs: CandidateInput[] = [];
      const untranslatable = new Set<string>();
      for (const source of o.sources) {
        const src = { ...source.source(locale), at: now().toISOString() };
        const back = await translateStrings(wanted.flatMap(sourcesOf), (texts) => source.translate(texts, SOURCE_LOCALE, locale), {
          ...(o.mask === false ? { mask: false } : {}),
          ...(o.batch !== undefined ? { batch: o.batch } : {}),
        });
        for (const w of wanted) {
          const got = sourcesOf(w).map((x) => back.get(x)!);
          const refused = got.find((g) => "refused" in g);
          if (refused) {
            if (!untranslatable.has(`${w.msgctxt ?? ""}\u0004${w.msgid}`)) skipped.push({ ...(w.msgctxt !== undefined ? { msgctxt: w.msgctxt } : {}), msgid: w.msgid, reason: (refused as { refused: string }).refused });
            untranslatable.add(`${w.msgctxt ?? ""}\u0004${w.msgid}`);
            continue;
          }
          const texts = got.map((g) => (g as { text: string }).text);
          inputs.push({ ...(w.msgctxt !== undefined ? { msgctxt: w.msgctxt } : {}), msgid: w.msgid, text: texts[0]!, ...(w.msgidPlural !== undefined ? { forms: texts } : {}), source: src });
        }
      }
      const r = addCandidates(inputs, {
        root: o.root,
        translations: o.translations,
        locale,
        catalogue,
        init: o.init === true,
        ...(o.createNode === false ? { createNode: false } : {}),
        ...(o.dryRun ? { dryRun: true } : {}),
        now,
      });
      reports.push({ ...r, skipped });
      if (r.added || r.filled.length) {
        log(`  ${locale}/${catalogue}: ${r.added} candidate(s) → ${catalogue}${CANDIDATES_SUFFIX}, ${r.filled.length} empty msgstr filled (fuzzy)${r.initialised ? ", catalogue started" : ""}${r.nodeCreated ? ", node created" : ""}`);
      }
    }
  }
  return { reports, potOnly };
}

/** What a test may put in place of the real engines. */
export interface MainOverrides {
  sources?: CandidateSourceAdapter[];
  log?: (s: string) => void;
}

export async function main(argv: string[], over: MainOverrides = {}): Promise<number> {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (flag: string) => argv.includes(flag);
  const say = over.log ?? ((s: string) => console.log(s));
  const root = resolve(arg("--instance") ?? arg("--root") ?? ".");
  let translations: string;
  if (arg("--dir") !== undefined) translations = relative(root, resolve(arg("--dir")!)).split(sep).join("/");
  else {
    const tdir = instanceDirectories(root).find((d) => (d.graphTypologies ?? []).includes("translation-sources"));
    if (!tdir) {
      console.error(`translation-candidates: ${root} declares no translation-sources directory (or name one with --dir). This is NOT a pass.`);
      return 2;
    }
    translations = tdir.path.replace(/\/+$/, "");
  }
  let sources: CandidateSourceAdapter[];
  if (over.sources) sources = over.sources;
  else {
    const ids = (arg("--engine") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) {
      console.error("translation-candidates: --engine <opus-mt|libretranslate>[,…] is required.");
      return 2;
    }
    try {
      sources = ids.map((id) =>
        sourceFor(id, {
          runner: arg("--runner")?.split(/\s+/).filter(Boolean) ?? [arg("--python") ?? "python3", "-I", BUNDLED_RUNNER],
          run: runCommand,
          url: arg("--url") ?? "http://localhost:5000",
          ...(arg("--model") !== undefined ? { model: arg("--model")! } : {}),
        }),
      );
    } catch (e) {
      console.error(`translation-candidates: ${(e as Error).message}`);
      return 2;
    }
  }
  const dryRun = has("--dry-run");
  let result: Awaited<ReturnType<typeof collectCandidates>>;
  try {
    result = await collectCandidates({
      root,
      translations,
      sources,
      ...(arg("--locale") ? { locales: arg("--locale")!.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
      ...(arg("--only") ? { only: arg("--only")! } : {}),
      batch: Number(arg("--batch") ?? 16),
      init: has("--init"),
      createNode: !has("--no-create-node"),
      mask: !has("--no-mask"),
      dryRun,
      log: say,
    });
  } catch (e) {
    console.error(`translation-candidates: ${(e as Error).message}`);
    return 1;
  }
  if (result.reports.length === 0 && result.potOnly.length === 0) {
    console.error(`translation-candidates: no catalogue under ${join(root, translations)}. This is NOT a pass.`);
    return 2;
  }
  const added = result.reports.reduce((n, r) => n + r.added, 0);
  const filled = result.reports.reduce((n, r) => n + r.filled.length, 0);
  const would = dryRun ? "would be " : "";
  say(`\n${added} candidate(s) ${would}recorded; ${filled} empty msgstr ${would}filled as fuzzy.`);
  const notes = result.reports.filter((r) => r.refused || r.noFill);
  if (notes.length) {
    say(`\nCatalogues not changed (${notes.length}):`);
    for (const r of notes) say(`  ${r.locale}/${r.catalogue}: ${r.refused ?? r.noFill}`);
  }
  const left = result.reports.flatMap((r) => [...r.skipped, ...r.rejected].map((s) => ({ ...s, where: `${r.locale}/${r.catalogue}` })));
  if (left.length) {
    say(`\nNot recorded (${left.length}):`);
    for (const s of left) say(`  ${s.where} ${s.msgctxt ? `[${s.msgctxt}] ` : ""}${JSON.stringify(s.msgid.slice(0, 80))}: ${s.reason}`);
  }
  if (result.potOnly.length) say(`\n${result.potOnly.length} template(s) have no .po beside them (--init starts them).`);
  return added + filled > 0 ? 0 : 3;
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
