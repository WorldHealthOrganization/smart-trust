#!/usr/bin/env bun
/**
 * The untainted round-trip translation check over who-iris's own catalogues,
 * as a `qa-results/v1` report. Bean `folio-assistant-ktt2` (folio-assistant-core).
 *
 * @module who-iris/scripts/translation-roundtrip-report
 *
 * ```sh
 * bun run who-iris/scripts/translation-roundtrip-report.ts          # write the report
 * bun run who-iris/scripts/translation-roundtrip-report.ts --check  # exit 1 if it is stale
 * ```
 *
 * ## What was measured, and by whom
 *
 * For each target locale, the strings of `site/iris-site.po` and
 * `glossary/who-iris--who-terms.po` were checked by TWO agents kept apart
 * (the `untainted-verification` skill):
 *
 * | agent | saw | wrote |
 * |---|---|---|
 * | back-translator | the `msgstr` values only, by index | each entry's `back_translation` |
 * | adjudicator | the English `msgid`, its translator note, and the back-translation, never the `msgstr` | each entry's `result`, `severity` and `findings` |
 *
 * ## Where the agents' outputs live
 *
 * They are JUDGEMENTS, which no re-run reproduces, so they are kept on main
 * in the `attestations` graph: one `qa-attestations/v1` file per catalogue
 * and locale, `test/attestations/translation-qa/<catalogue>.<locale>.attestations.json`,
 * criterion `translation-semantic-roundtrip`, one entry per string pinned by
 * the hashes of the `msgid` and `msgstr` it judged, after a `scope: "run"`
 * entry carrying the agents' trailer lines (TOOLS_USED, UNCERTAIN, SUMMARY).
 * They were TSVs under `test/results/translation-roundtrip/agents/` until
 * 2026-11-03 (owner: "1. Convert to attestations"; bean folio-assistant-7mwa),
 * converted losslessly, every cell checked. The report below is DERIVED and
 * is no longer committed: the layer's QA publisher writes it to the
 * qa-reports store.
 *
 * Each back-translator was limited to one Read (its input) and one Write (its
 * output), and reported `TOOLS_USED: Read,Write` in its file. So it could not
 * look up the English. The earlier check of the same catalogues (bean
 * `folio-assistant-lffo`, 580/580 PASS) was done by the translating agent
 * itself, in one context, and says so. This one is the independent check that
 * one could not be.
 *
 * ## What this script does, and does not do
 *
 * It does not call a model. It joins the committed agent outputs to the
 * catalogues as they are NOW, by content: each string to the ruling pinned by
 * the hash of its msgid (`pairRulings`), so removing or reordering strings
 * invalidates nothing. A ruling whose msgstr hash no longer matches is
 * reported `stale`, not counted as a verdict. It records each
 * catalogue's SHA-256, so the report reads as stale the moment a catalogue
 * changes. A flagged string is not corrected here: which reading is right is
 * a reviewer's call (`ingest-l1-completeness-gate.bpmn`, `Task_FlagDrift`).
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const INSTANCE = join(import.meta.dir, "..");
const OUT_DIR = join(INSTANCE, "test", "results", "translation-roundtrip");
const OUT = join(OUT_DIR, "iris-catalogues.qa-results.json");
const LOCALES = ["ar", "es", "fr", "ru", "zh"] as const;
/** In the order the agents saw them: every site string, then the glossary terms. */
const CATALOGUES = ["site/iris-site.po", "glossary/who-iris--who-terms.po"] as const;
const RUN_DATE = "2026-10-10";
const SESSION = "https://claude.ai/code/session_018NFVUeJjQJdrEU32AS1Mco";

export interface PoString {
  catalogue: string;
  msgid: string;
  msgstr: string;
}

/** The non-header entries of a PO file, in file order. Handles continuation lines. */
export function parsePo(text: string, catalogue: string): PoString[] {
  const out: PoString[] = [];
  let cur: Record<string, string> = {};
  let key: string | null = null;
  const flush = () => {
    if (cur.msgid) out.push({ catalogue, msgid: cur.msgid, msgstr: cur.msgstr ?? "" });
    cur = {};
    key = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line === "") { flush(); continue; }
    if (line.startsWith("#")) { if (cur.msgstr !== undefined) flush(); continue; }
    const m = /^(msgctxt|msgid|msgstr)\s+(".*")$/.exec(line);
    if (m) { key = m[1]!; cur[key] = JSON.parse(m[2]!) as string; continue; }
    if (line.startsWith('"') && key) cur[key] += JSON.parse(line) as string;
  }
  flush();
  return out;
}

type Verdict = "pass" | "warn" | "fail";

/** One string's ruling, as the attestation entry records it. */
export interface RoundtripEntry {
  index: number;
  field_hash: { msgid: string; msgstr: string };
  result: Verdict;
  severity?: string;
  findings: string[];
  back_translation: string;
}

/** The `scope: "run"` entry: the agents' trailer lines, verbatim. */
export interface RoundtripRun {
  scope: "run";
  back_translation_trailer: Record<string, string>;
  adjudication_trailer: Record<string, string>;
}

const ATTESTATIONS = join(INSTANCE, "test", "attestations", "translation-qa");
export const h12 = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);

/** A catalogue's attestation for a locale: its run entry and its per-string rulings, in order. */
export function readRoundtrip(catalogue: string, locale: string, root = ATTESTATIONS): { run: RoundtripRun; entries: RoundtripEntry[] } {
  const file = JSON.parse(readFileSync(join(root, `${catalogue}.${locale}.attestations.json`), "utf-8")) as {
    $schema: string;
    family: string;
    locale: string;
    criteria: Record<string, Array<RoundtripEntry | RoundtripRun>>;
  };
  if (file.$schema !== "qa-attestations/v1" || file.family !== "translation-qa" || file.locale !== locale) {
    throw new Error(`${catalogue}.${locale}: not a translation-qa attestation for ${locale}`);
  }
  const all = file.criteria["translation-semantic-roundtrip"] ?? [];
  const run = all.find((e): e is RoundtripRun => (e as RoundtripRun).scope === "run");
  if (!run) throw new Error(`${catalogue}.${locale}: no scope:"run" entry`);
  const entries = all.filter((e): e is RoundtripEntry => (e as RoundtripRun).scope !== "run").sort((a, b) => a.index - b.index);
  return { run, entries };
}


/** One string and the ruling that judged it. `stale`: the translation changed since. */
export interface Pairing {
  string: PoString;
  ruling: RoundtripEntry;
  stale: boolean;
}

/**
 * Pair each string of a catalogue with its ruling BY CONTENT, never by position.
 *
 * A ruling is pinned by `field_hash.msgid`, the hash of the English it judged,
 * and `field_hash.msgstr`, the hash of the translation it judged. So a string
 * is paired with the ruling whose msgid hash is its own, preferring one whose
 * msgstr hash matches too (two strings with one msgid are paired in catalogue
 * order). Removing or reordering strings therefore invalidates no ruling
 * (owner, 2026-11-13: "this will happen a lot. we need a mechanical process").
 * Until 2026-11-13 the join was by index, so removing two strings
 * (who-iris#260) shifted every later string onto its neighbour's ruling.
 *
 * - A string with NO ruling fails loudly: it was added without a run, and only
 *   the agents can judge it.
 * - A ruling whose msgstr hash no longer matches is paired but `stale`: it
 *   judged an earlier translation. The report lists it as stale; it is never
 *   counted as a current verdict.
 * - A ruling no string claims is `unused`. RULINGS MAY RUN AHEAD OF THE
 *   CATALOGUE (owner, 2026-11-08, issue #196): they live on the attestations
 *   state branch and the catalogue on main, so a PR that adds strings cannot
 *   land both at once, and its rulings are recorded first. The rulings of a
 *   removed string are unused in the same way, until `translation-qa:prune`
 *   drops them (`scripts/translation-qa-prune.ts`).
 */
export function pairRulings(strings: PoString[], entries: RoundtripEntry[], what: string): { pairs: Pairing[]; unused: RoundtripEntry[] } {
  const byMsgid = new Map<string, RoundtripEntry[]>();
  for (const e of [...entries].sort((a, b) => a.index - b.index)) {
    const q = byMsgid.get(e.field_hash.msgid) ?? [];
    q.push(e);
    byMsgid.set(e.field_hash.msgid, q);
  }
  const pairs: Pairing[] = [];
  const missing: PoString[] = [];
  for (const s of strings) {
    const q = byMsgid.get(h12(s.msgid));
    if (!q || q.length === 0) { missing.push(s); continue; }
    const want = h12(s.msgstr);
    const at = Math.max(0, q.findIndex((e) => e.field_hash.msgstr === want));
    const [ruling] = q.splice(at, 1);
    pairs.push({ string: s, ruling: ruling!, stale: ruling!.field_hash.msgstr !== want });
  }
  if (missing.length > 0) {
    const first = missing[0]!.msgid.slice(0, 60);
    throw new Error(
      `${what}: ${missing.length} of ${strings.length} strings have no ruling (first: "${first}") — strings were added without a run; re-run the agents`,
    );
  }
  const unused = [...byMsgid.values()].flat().sort((a, b) => a.index - b.index);
  return { pairs, unused };
}

export function buildReport(instance = INSTANCE): Record<string, unknown> {
  const script = readFileSync(join(import.meta.dir, "translation-roundtrip-report.ts"), "utf-8");
  const families: Record<string, { summary: string; count: number; entries: unknown[] }> = {};
  const totals: Record<string, Record<Verdict | "stale", number>> = {};
  const catalogues: Record<string, string> = {};
  for (const locale of LOCALES) {
    const pairs: Pairing[] = [];
    let tools: string | undefined;
    for (const cat of CATALOGUES) {
      const path = join(instance, "translations", locale, cat);
      const text = readFileSync(path, "utf-8");
      catalogues[relative(instance, path)] = createHash("sha256").update(text).digest("hex");
      const { run, entries } = readRoundtrip(cat, locale, join(instance, "test", "attestations", "translation-qa"));
      tools ??= run.back_translation_trailer.TOOLS_USED;
      pairs.push(...pairRulings(parsePo(text, cat), entries, `${locale} ${cat}`).pairs);
    }
    const count: Record<Verdict | "stale", number> = { pass: 0, warn: 0, fail: 0, stale: 0 };
    const flagged: unknown[] = [];
    pairs.forEach(({ string: s, ruling: r, stale }, i) => {
      // A stale ruling judged an earlier msgstr: it is not a verdict on this one.
      if (stale) count.stale++;
      else count[r.result]++;
      if (stale || r.result !== "pass") {
        flagged.push({
          index: i,
          catalogue: s.catalogue,
          msgid: s.msgid,
          msgstr: s.msgstr,
          back_translation: r.back_translation,
          verdict: stale ? "stale" : r.result,
          ...(stale ? { stale_ruling: { result: r.result, msgstr_hash: r.field_hash.msgstr } } : {}),
          severity: r.severity,
          drift: r.findings.some((x) => x.startsWith("[term]")) ? "terminology" : "semantic",
          findings: r.findings,
        });
      }
    });
    totals[locale] = count;
    families[`roundtrip-${locale}`] = {
      summary:
        `${locale}: ${count.pass} pass, ${count.warn} warn, ${count.fail} fail, ${count.stale} stale of ${pairs.length}. ` +
        `Back-translator tools: ${tools ?? "not recorded"}. Each entry awaits a reviewer's ruling; nothing was auto-corrected.`,
      count: flagged.length,
      entries: flagged,
    };
  }
  return {
    $schema: "qa-results/v1",
    producer: {
      script: "who-iris/scripts/translation-roundtrip-report.ts",
      script_hash: createHash("sha256").update(script).digest("hex").slice(0, 12),
    },
    subject: { kind: "translation-catalogues", id: "who-iris" },
    criterion: "translation-semantic-roundtrip",
    method: {
      skill: "untainted-verification",
      run: RUN_DATE,
      session: SESSION,
      back_translator: "roundtrip-back-translator: saw msgstr only; one Read, one Write",
      adjudicator: "roundtrip-adjudicator: saw msgid, translator note and back-translation; never msgstr",
      // The registry's one word for "the run did not say which model"
      // (bootstrap's NOT_DISCLOSED). "not recorded" said the same in prose, and
      // is not a model id, so `check-model-languages` could not resolve it.
      model: "not-disclosed",
      supersedes_note: "folio-assistant-lffo's 580/580 was self-checked by the translating agent; this run is independent",
      reruns: [
        "2026-10-11: indexes 15 and 17 in all five locales, after the owner ruled that 'bean' is never translated as 'task' (a Task is its own term) and stays untranslated. Same two-agent protocol, on those 10 strings only (folio-core-2mb0).",
        "2026-10-11, second ruling: 'bean' is translated after all, as each language's ordinary word for a bean or kernel (ar حبة, es grano, fr grain, ru зерно, zh 豆); DSpace 'Bundle' as 'File Set' (all five); ru 'item' as «единица хранения»; 'CDN edge' as the CDN's edge server (es, fr, ru); ru 12's catalogue made folio-assistant's own; zh 'size' as 大小, not 容量. 39 strings re-run; the adjudicator was given these rulings as a glossary.",
        "2026-10-20, third ruling (owner: fix all 34 remaining warnings): 'ingest' is one fixed term per locale (ru «принятый на хранение», zh 摄取); fr DSpace 'item' is «item»; 'kind' is fr «genre (kind)», ru «вид (kind)», zh 种类（kind）; zh 'directory' is 文件目录, distinct from 目录 'catalogue'; state names are labels (ru «ссылочное», zh 已引用; es 'State' «Estado de materialización»); zh 'captured' is 捕获, not 采集 'harvested'; and the 12 sense drifts (ar 11, 39, 76, 80, 91; es 23, 95; fr 100; ru 25, 26, 76, 101) are corrected. 34 strings re-run; the adjudicator was given all rulings as a glossary.",
      ],
    },
    catalogues,
    totals,
    families,
    total: Object.values(families).reduce((n, f) => n + f.count, 0),
  };
}

if (import.meta.main) {
  const json = JSON.stringify(buildReport(), null, 2) + "\n";
  if (process.argv.includes("--check")) {
    const have = (() => { try { return readFileSync(OUT, "utf-8"); } catch { return ""; } })();
    if (have !== json) {
      console.error(`stale: ${relative(INSTANCE, OUT)} — run without --check`);
      process.exit(1);
    }
    console.log(`current: ${relative(INSTANCE, OUT)}`);
  } else {
    // test/results/ is computed, not committed: a fresh checkout has no such directory.
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, json);
    console.log(`wrote ${relative(dirname(INSTANCE), OUT)}`);
  }
}
