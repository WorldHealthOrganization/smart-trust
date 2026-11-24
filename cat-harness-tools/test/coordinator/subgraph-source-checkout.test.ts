/**
 * `subgraph-source` tests about the WHOLE CHECKOUT, moved here from
 * `cat-harness/schemas/subgraph-source.test.ts` (bean `7zz1`, owner ruling
 * 2026-10-06 "Top-level instance"): each resolves every subgraph every
 * layer in the checkout declares, which only the checkout holds. Standing
 * alone, cat-harness has none of it, and `check:cat-harness-standalone`
 * collects every test in that layer. The rest of that file's tests stay there;
 * every path here is composed from ORIGIN_DIR, the directory they were written
 * in, so nothing they read changed.
 */
import { describe, expect, test } from "bun:test";
import { resolve, join } from "node:path";

import { checkoutDirectories, declaredSubgraph } from "../../schemas/kg/harness-config.ts";

/** The directory these tests were written in (`cat-harness/schemas/`): every path below is composed from it exactly as it was before the move, so nothing they read changed. */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

const REPO = resolve(ORIGIN_DIR, "..", "..");

describe("THE GATE — every declared subgraph in this checkout resolves", () => {
  // `declaredSubgraph` is the lookup every consumer uses; this asks it of
  // every own entry the checkout declares. A contradiction (both fields, a
  // tip-keyed qa) throws here, and a branch source naming no special branch
  // is a finding — the name would be a guess at what a mount should fetch.
  const own = checkoutDirectories(REPO).filter((d) => d.own && d.within === undefined);
  const ids = [...new Set(own.map((d) => d.id))];
  test("the checkout declares subgraphs to check", () => {
    expect(ids.length).toBeGreaterThan(0);
  });
  // An explicit budget, measured rather than guessed: this resolves EVERY
  // declared subgraph across every layer in the checkout (one
  // checkout-wide walk per id), which took ~4.5 s of a 5.47 s file run in the
  // CI-shaped mount on 2026-10-11 — at Bun's 5 s default, so a loaded runner
  // timed it out on unrelated PRs (#69, #93) while it passed everywhere else.
  // The assertion is unchanged; only the time it may take is stated.
  test("each resolves (a branch source needs no table row: the declaration is the authority, bean rva2)", () => {
    const findings: string[] = [];
    for (const id of ids) {
      try {
        const d = declaredSubgraph(REPO, id);
        if (d === undefined) findings.push(`${id}: declared, but resolves to nothing`);
      } catch (e) {
        if (e instanceof Error && /declared by \d+ instances/.test(e.message)) continue; // ambiguous ids are asked per layer
        findings.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    expect(findings).toEqual([]);
  }, 30_000);
});
