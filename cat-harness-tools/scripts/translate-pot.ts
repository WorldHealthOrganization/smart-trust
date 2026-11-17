#!/usr/bin/env bun
/**
 * `translate-pot`: the older name, and the older flags, of
 * `translation-candidates`. Kept so existing commands and beans still work.
 *
 * @module scripts/translate-pot
 * @covers translation-sources
 *
 * The owner, 2026-11-14: one machine-translation command, whose output is
 * CANDIDATES a reviewer chooses among, written through the one writer
 * (`scripts/lib/translation-candidates.ts` `addCandidates`). This script used
 * to fill catalogues itself, with its own engines, masking and plural fill; all
 * of that now lives once, in `scripts/translation-candidates.ts` and
 * `scripts/lib/machine-translation.ts`. Plural entries are machine-filled,
 * fuzzy, through the same writer, with the catalogue's plural count.
 *
 *   bun run cat translate-pot --engine opus-mt [--locale fr]... [--instance <dir>]
 *   bun run cat translate-pot --engine libretranslate --url http://localhost:5000
 *   … --dry-run      report what would be filled, write nothing
 *   … --dir <path>   the translations directory (default: the declared one)
 *   … --no-create    do not start a .po from a .pot that has none
 *   … --model <id> · --python <exe>
 *
 * Exit 0 done (refusals are reported, not failures) · 1 engine failure ·
 * 2 nothing to do (no catalogue, bad options).
 */
import { main as candidates, type MainOverrides } from "./translation-candidates.ts";

/** The `translation-candidates` arguments for a `translate-pot` command line, or why there are none. */
export function candidatesArgs(argv: string[]): string[] | { error: string } {
  const out: string[] = [];
  const locales: string[] = [];
  let create = true;
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]!;
    if (k === "--dry-run" || k === "--no-create") {
      if (k === "--dry-run") out.push(k);
      else create = false;
      continue;
    }
    const v = argv[++i];
    if (v === undefined) return { error: `${k} needs a value` };
    if (k === "--locale") locales.push(v);
    else if (k === "--source") {
      if (v !== "en") return { error: "--source: only English (en) sources are translated" };
    } else if (["--engine", "--url", "--model", "--python", "--instance", "--dir"].includes(k)) out.push(k, v);
    else return { error: `unknown argument ${k}` };
  }
  if (locales.length) out.push("--locale", locales.join(","));
  if (create) out.push("--init");
  return out;
}

export async function main(argv: string[], over: MainOverrides = {}): Promise<number> {
  const args = candidatesArgs(argv);
  if (!Array.isArray(args)) {
    console.error(`translate-pot: ${args.error}`);
    return 2;
  }
  const code = await candidates(args, over);
  return code === 3 ? 0 : code; // nothing new is not a failure here
}

if (import.meta.main) process.exit(await main(process.argv.slice(2)));
