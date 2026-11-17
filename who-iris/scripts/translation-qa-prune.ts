#!/usr/bin/env bun
/**
 * Drop the round-trip rulings of strings the catalogues no longer hold, and
 * renumber the rest to catalogue order. Mechanical upkeep of the
 * `translation-qa` attestations; it never judges anything.
 *
 * @module who-iris/scripts/translation-qa-prune
 *
 * ```sh
 * bun run translation-qa:prune                 # dry run against origin/main: print what would change
 * bun run translation-qa:prune --write         # apply it to test/attestations/translation-qa/
 * bun run translation-qa:prune --ref <ref>     # judge "removed" against another ref's catalogues
 * ```
 *
 * ## Why it exists (owner, 2026-11-13)
 *
 * > this will happen a lot. we need a mechanical process as much as possible.
 *
 * who-iris#260 removed two strings from `site/iris-site.po` and its CI failed:
 * the report paired rulings with strings by position, so every later string
 * met its neighbour's ruling. The report now pairs by content
 * (`pairRulings`), so removing strings invalidates no ruling and needs no
 * agent re-run. What is left is housekeeping: the removed strings' rulings sit
 * unused in the store. This command takes them out.
 *
 * ## What it may change, and what it may not
 *
 * It may only DROP a ruling or rewrite its `index`. It never changes a
 * verdict, a finding, a back-translation, a hash or the run entry, and it
 * never adds a ruling: every kept entry is checked to equal its original in
 * every field but `index` before anything is written. `roundtrip_index`, the
 * position the agents saw, is provenance and is kept as it was.
 *
 * ## Which rulings are "removed", and which are only ahead
 *
 * RULINGS MAY RUN AHEAD OF THE CATALOGUE (owner, 2026-11-08, issue #196): a PR
 * that adds strings has its rulings recorded on the state branch before it
 * merges. Such a ruling's string is not in the catalogue either, so absence
 * alone does not mean removed. A ruling is dropped only when its msgid is
 * absent from the catalogue at `--ref` AND some earlier version of that
 * catalogue in `--ref`'s history held it. A ruling for a string the history
 * never held is ahead, and is kept, after the current strings.
 *
 * `--ref` defaults to `origin/main`, not the working tree. The state branch
 * serves main and every open branch at once, so a ruling may go only once
 * main no longer holds its string: pruning from a PR branch that removes
 * strings, before it merges, would leave main's strings without rulings and
 * turn main red. Run it after the removing PR merges. (A shallow clone sees
 * less history and so drops less: it errs towards keeping.)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { h12, pairRulings, parsePo, type RoundtripEntry, type RoundtripRun } from "./translation-roundtrip-report.ts";

const INSTANCE = join(import.meta.dir, "..");
const LOCALES = ["ar", "es", "fr", "ru", "zh"] as const;
const CATALOGUES = ["site/iris-site.po", "glossary/who-iris--who-terms.po"] as const;
const CRITERION = "translation-semantic-roundtrip";

type Entry = RoundtripEntry | RoundtripRun;

export interface PruneResult {
  file: string;
  dropped: RoundtripEntry[];
  renumbered: Array<{ from: number; to: number }>;
  ahead: number;
  next: Entry[];
}

/**
 * The pruned entry list for one attestation file. Pure: `current` is the
 * catalogue's strings at the ref, `everHeld` the msgid hashes any version of it
 * in the ref's history held.
 */
export function prune(entries: Entry[], current: ReturnType<typeof parsePo>, everHeld: Set<string>, what: string): Omit<PruneResult, "file"> {
  const rulings = entries.filter((e): e is RoundtripEntry => (e as RoundtripRun).scope !== "run");
  const { pairs, unused } = pairRulings(current, rulings, what);
  const dropped = unused.filter((e) => everHeld.has(e.field_hash.msgid));
  const ahead = unused.filter((e) => !everHeld.has(e.field_hash.msgid));
  const order = [...pairs.map((p) => p.ruling), ...ahead];
  const renumbered: Array<{ from: number; to: number }> = [];
  const kept = order.map((e, i) => {
    if (e.index !== i) renumbered.push({ from: e.index, to: i });
    return { ...e, index: i };
  });
  // The invariant the owner set: drop or reorder only. Every kept ruling is
  // its original but for `index`, and nothing is invented.
  const before = new Map(rulings.map((e) => [e, JSON.stringify({ ...e, index: 0 })]));
  order.forEach((e, i) => {
    if (JSON.stringify({ ...kept[i]!, index: 0 }) !== before.get(e)) throw new Error(`${what}: a kept ruling changed beyond its index`);
  });
  if (kept.length + dropped.length !== rulings.length) throw new Error(`${what}: rulings were lost or invented`);
  // Run entries keep their places (a store can hold several runs, each before
  // the rulings it recorded); the ruling slots are refilled in catalogue order.
  const gone = new Set(dropped);
  let k = 0;
  const next = entries.flatMap((e): Entry[] => {
    if ((e as RoundtripRun).scope === "run") return [e];
    if (gone.has(e as RoundtripEntry)) return [];
    return [kept[k++]!];
  });
  return { dropped, renumbered, ahead: ahead.length, next };
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
}

/** The msgid hashes every version of `path` in `ref`'s history held. */
function historyOf(instance: string, ref: string, path: string): Set<string> {
  const held = new Set<string>();
  const shas = git(["log", "--format=%H", ref, "--", path], instance).split("\n").filter(Boolean);
  for (const sha of shas) {
    let text: string;
    try { text = git(["show", `${sha}:${path}`], instance); } catch { continue; } // the commit deleted it
    for (const s of parsePo(text, path)) held.add(h12(s.msgid));
  }
  return held;
}

export function pruneAll(instance: string, ref: string, root: string): PruneResult[] {
  const out: PruneResult[] = [];
  for (const cat of CATALOGUES) {
    for (const locale of LOCALES) {
      const po = `translations/${locale}/${cat}`;
      const current = parsePo(git(["show", `${ref}:${po}`], instance), cat);
      const everHeld = historyOf(instance, ref, po);
      const file = join(root, `${cat}.${locale}.attestations.json`);
      const doc = JSON.parse(readFileSync(file, "utf-8")) as { criteria: Record<string, Entry[]> };
      const r = prune(doc.criteria[CRITERION] ?? [], current, everHeld, `${locale} ${cat}`);
      out.push({ file, ...r });
    }
  }
  return out;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (import.meta.main) {
  const instance = arg("--instance") ?? INSTANCE;
  const ref = arg("--ref") ?? "origin/main";
  const root = arg("--attestations") ?? join(instance, "test", "attestations", "translation-qa");
  const write = process.argv.includes("--write");
  const results = pruneAll(instance, ref, root);
  let changed = 0;
  for (const r of results) {
    if (r.dropped.length === 0 && r.renumbered.length === 0) continue;
    changed++;
    console.log(`${relative(instance, r.file)}: drop ${r.dropped.length}, renumber ${r.renumbered.length}, keep ${r.ahead} ahead`);
    for (const d of r.dropped) {
      console.log(`  - index ${d.index}  msgid ${d.field_hash.msgid}  ${d.result}  "${d.back_translation.slice(0, 70)}"`);
    }
    const spans: string[] = [];
    for (const { from, to } of r.renumbered) {
      const last = spans.at(-1);
      const m = last && /^(\d+)-(\d+) → (\d+)-(\d+)$/.exec(last);
      if (m && Number(m[2]) + 1 === from && Number(m[4]) + 1 === to) spans[spans.length - 1] = `${m[1]}-${from} → ${m[3]}-${to}`;
      else spans.push(`${from}-${from} → ${to}-${to}`);
    }
    if (spans.length) console.log(`  ~ index ${spans.join(", ")}`);
    if (write) {
      const doc = JSON.parse(readFileSync(r.file, "utf-8")) as { criteria: Record<string, Entry[]> };
      doc.criteria[CRITERION] = r.next;
      writeFileSync(r.file, JSON.stringify(doc, null, 2) + "\n");
    }
  }
  if (changed === 0) console.log(`nothing to prune against ${ref}`);
  else if (!write) console.log(`dry run against ${ref}: ${changed} file(s) would change; --write to apply`);
  else console.log(`wrote ${changed} file(s); push them to cat/who-iris/attestations (\`bun run cat state:push\`)`);
}
