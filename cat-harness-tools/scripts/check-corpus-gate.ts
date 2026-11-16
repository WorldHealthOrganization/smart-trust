/**
 * Refuse a corpus write the editing process never authorised.
 *
 * Run from a pre-commit hook or from CI, in the **folio** repo (the one holding
 * `content/`), pointing at the folio-assistant checkout for the processes:
 *
 * ```sh
 * # what is staged
 * bun run <platform>/scripts/check-corpus-gate.ts --staged --platform <platform>
 *
 * # what a branch changed, for CI
 * bun run <platform>/scripts/check-corpus-gate.ts --since origin/main --platform <platform>
 *
 * # report without failing, while a folio adopts the gate
 * bun run <platform>/scripts/check-corpus-gate.ts --staged --warn
 * ```
 *
 * Exit 1 when a changed block has no layer recording that the findings
 * reached the editor; exit 0 under `--warn`. Files that are not content blocks
 * are ignored entirely.
 *
 * Installing it as a hook is deliberately a one-liner the folio owner writes,
 * not something a script does behind their back:
 *
 * ```sh
 * printf '#!/bin/sh\nexec bun run "$PWD/folio-assistant/scripts/check-corpus-gate.ts" --staged\n' \
 *   > .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
 * ```
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { changedContentFiles, checkCorpusGate } from "../src/workflow/corpus-gate.js";
import { readBlockManifest } from "../pipeline/qa-utils.js";
import { loadBlockModuleSync } from "../pipeline/block-module.js";
// The HARNESS, not this layer: these scripts moved up in 70lx B2b and read cat-harness.
import { HARNESS_ROOT } from "./lib/roots.ts";

/**
 * Resolve a changed `.ts` path to the block label it declares.
 *
 * This lives here rather than in the gate because reading a block manifest is
 * the content pipeline's job and the gate is harness-layer — see
 * `LabelForPath` in `corpus-gate.ts`, and bean `zlmp`. This script runs IN a
 * folio repo, so knowing what a block manifest is belongs to it.
 *
 * The cheap textual check comes first, exactly as in `walkBlocks`: it decides
 * what may be executed, and a script with a builder call inside a template
 * literal is not a block and must not be imported.
 */
function labelFor(tsPath: string): string | undefined {
  if (!readBlockManifest(tsPath)) return undefined;
  const loaded = loadBlockModuleSync(tsPath);
  if (!loaded) {
    throw new Error(
      `${tsPath} looks like a block manifest but its default export is not a labelled block`,
    );
  }
  return loaded.label;
}

const argv = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const warn = argv.includes("--warn");
const since = flag("--since");
const staged = argv.includes("--staged");
const repoRoot = resolve(flag("--repo") ?? process.cwd());
const platformRoot = resolve(flag("--platform") ?? HARNESS_ROOT);

if (!staged && !since) {
  console.error(
    "usage: check-corpus-gate.ts (--staged | --since <ref>) [--platform <dir>] [--repo <dir>] [--warn]",
  );
  process.exit(2);
}

const git = (args: string[]): string[] =>
  execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

// --diff-filter=d: a deleted block cannot be gated on a process step, and
// refusing deletions would make the gate impossible to satisfy.
// -M100%: a file moved with its bytes unchanged (a block moved to another
// chapter) is not an edit, so `changedContentFiles` drops it.
const files = changedContentFiles(
  staged
    ? git(["diff", "--cached", "--name-status", "-M100%", "--diff-filter=d"])
    : git(["diff", "--name-status", "-M100%", "--diff-filter=d", `${since}...HEAD`]),
);

const findings = await checkCorpusGate(repoRoot, { files, platformRoot, labelFor });
const refused = findings.filter((f) => !f.allowed);

if (findings.length === 0) {
  console.log("corpus gate: no content blocks in this change.");
  process.exit(0);
}

for (const f of findings.filter((x) => x.allowed)) {
  console.log(`  ✓ ${f.label ?? f.file} — ${f.reason}`);
}
for (const f of refused) {
  console.error(`  ✗ ${f.label ?? f.file}\n      ${f.reason}`);
}

console.log(
  `\ncorpus gate: ${findings.length - refused.length}/${findings.length} block(s) authorised.`,
);

if (refused.length > 0 && !warn) {
  console.error(
    `\nThe editing process is strict: a block reaches the corpus after the editor has\n` +
      `seen the validation findings and accepted the change. If a step should be\n` +
      `skippable for this content type, declare it in\n` +
      `skills/<package>/workflow-policy.json with a reason — see\n` +
      `docs/proposals/workflow-orchestration.md §4.\n`,
  );
  process.exit(1);
}
if (refused.length > 0) {
  console.error(`\n(--warn: reporting only, not failing.)\n`);
}
