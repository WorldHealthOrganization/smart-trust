/**
 * Diff the two ways `walkBlocks` can establish a block's identity, over a real
 * corpus.
 *
 * `walkBlocks` establishes each block's `kind` and `label` by importing it.
 * With `{ verify: false }` it reads them out of the source text instead, the
 * way it did before. The textual read is wrong in three demonstrated ways —
 * see `scripts/tests/block-walk-verify.test.ts` — but *how often* it is wrong
 * on a given corpus is a question about the content, not about the code, and
 * the corpora live in folio repositories rather than here.
 *
 * So this answers it in one command:
 *
 * ```sh
 * bun run cat-harness-tools/pipeline/verify-block-walk.ts ../qou/content/quantum-observable-universe
 * ```
 *
 * It prints every disagreement, every block only one mode finds, every block
 * that will not import, and what verification costs in wall-clock. This repo
 * has twice learned that lesson the hard way: `#125` let a non-block into the
 * walk, `qou/3fui` kept 63 real ones out, and in the second case the
 * measurement *reversed* the recommendation the change was argued on.
 *
 * The default was flipped on this tool's output against `qou` — 3557 blocks,
 * zero disagreements, zero load failures, 1475 ms against 450 ms. That is one
 * corpus. **Run this against any other folio before trusting the default
 * there**, and use `verify: false` if it disagrees.
 *
 * Exit code is 0 whatever it finds — this reports, it does not gate.
 *
 * @module pipeline/verify-block-walk
 */

import { resolve } from "path";
import { existsSync } from "fs";
import { walkBlocks, type BlockPaths } from "./qa-utils";
import type { BlockLoadFailure } from "./block-module";

const root = process.argv[2];
if (!root) {
  console.error(
    "usage: bun run cat-harness-tools/pipeline/verify-block-walk.ts <content-root>\n" +
      "  e.g. bun run cat-harness-tools/pipeline/verify-block-walk.ts ../qou/content/qou",
  );
  process.exit(2);
}
const rootAbs = resolve(root);
if (!existsSync(rootAbs)) {
  console.error(`No such directory: ${rootAbs}`);
  process.exit(2);
}

/**
 * Both modes include unlabelled prose, so the comparison covers what qa-sweep
 * sees. `verify` is stated explicitly on **both** arms rather than left to the
 * default: this tool exists to compare the two readings, so it must not start
 * comparing a reading with itself the day the default moves — which is exactly
 * what happened the first time the default flipped under it.
 */
const TEXTUAL = { includeUnlabelled: true, verify: false } as const;
const VERIFIED = { includeUnlabelled: true, verify: true } as const;

const byPath = (blocks: BlockPaths[]): Map<string, BlockPaths> =>
  new Map(blocks.map((b) => [b.ts, b]));

const t0 = Bun.nanoseconds();
const textual = byPath([...walkBlocks(rootAbs, { ...TEXTUAL, onLoadFailure: () => {} })]);
const t1 = Bun.nanoseconds();

const failures: BlockLoadFailure[] = [];
const verified = byPath([
  ...walkBlocks(rootAbs, { ...VERIFIED, onLoadFailure: (f) => failures.push(f) }),
]);
const t2 = Bun.nanoseconds();

const ms = (a: number, b: number): string => ((b - a) / 1e6).toFixed(0);

console.log(`\ncorpus: ${rootAbs}`);
console.log(`  textual walk : ${textual.size} blocks in ${ms(t0, t1)} ms`);
console.log(`  verified walk: ${verified.size} blocks in ${ms(t1, t2)} ms\n`);

/** In the verified walk but not the textual one — a block nothing sweeps today. */
const onlyVerified = [...verified.keys()].filter((p) => !textual.has(p));
/** In the textual walk but not the verified one — would be lost by the flip. */
const onlyTextual = [...textual.keys()].filter((p) => !verified.has(p));
/** Present in both, but the identity differs. */
const disagree = [...verified.entries()].flatMap(([path, v]) => {
  const t = textual.get(path);
  if (!t) return [];
  if (t.label === v.label && t.kind === v.kind) return [];
  return [{ path, textual: t, verified: v }];
});

const section = (title: string, n: number): void =>
  console.log(`${n === 0 ? "  ✓" : "  ✗"} ${title}: ${n}`);

section("blocks only the verified walk finds", onlyVerified.length);
for (const p of onlyVerified) console.log(`        + ${verified.get(p)!.label}  ${p}`);

section("blocks only the textual walk finds", onlyTextual.length);
for (const p of onlyTextual) console.log(`        - ${textual.get(p)!.label}  ${p}`);

section("blocks whose identity differs", disagree.length);
for (const d of disagree) {
  console.log(
    `        ${d.textual.kind} ${d.textual.label}  ->  ${d.verified.kind} ${d.verified.label}\n` +
      `          ${d.path}`,
  );
}

section("blocks that would not import", failures.length);
for (const f of failures) console.log(`        ${f.file}\n          ${f.error}`);

const clean =
  onlyVerified.length === 0 &&
  onlyTextual.length === 0 &&
  disagree.length === 0 &&
  failures.length === 0;

console.log(
  clean
    ? `\nThe two walks agree on every block. Verifying costs ${ms(t1, t2)} ms ` +
        `against the source-text reading's ${ms(t0, t1)} ms, and changes nothing ` +
        `else about this corpus.\n`
    : `\nThe walks disagree. Each line above is a block some QA tool is currently ` +
        `keyed to the wrong identity for, missing entirely, or unable to load — ` +
        `read them before flipping the default.\n`,
);
