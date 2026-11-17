/**
 * kg-audit-all.ts — run the knowledge-graph audit for EVERY declared layer,
 * the one at the repository root included, so `audit:coverage` can tell
 * "audited and clean" from "never audited".
 *
 * `kg-audit.ts` resolves its root once at module scope, so this spawns one
 * process per layer rather than adding a `--all` flag. A crash in any one
 * is reported as "produced no report", never dropped.
 *
 * @covers processes, scenarios, skills, tools, cat-harness — the same kinds
 * `kg-audit.ts` covers, because it runs exactly that audit; what differs is its
 * RANGE, not which kinds it judges. Declared rather than `computed`: the set is
 * fixed by the audit it spawns, so deriving it would read the same list through
 * one more indirection.
 *
 * @module scripts/kg-audit-all
 */
import { availableParallelism } from "node:os";
import { relative, resolve } from "node:path";

import { layerRootsIn } from "../schemas/kg/cat-harness.js";
import { mountScopeFor } from "../schemas/kg/remote-mount.js";
import { againstOrUsage, judgeUsage } from "./qa-results.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));
const args = process.argv.slice(2);
const check = args.includes("--check");
const strict = args.includes("--strict");
/**
 * Judge mode (bean `oqe3`): each layer's `kg-audit.ts --check` computes
 * and judges against `--against <ref>`, passed through unchanged, and exits
 * on the four-state table (0 ok · 1 finding · 2 unknown or error). An unknown
 * flag is refused here before fifteen processes are spawned to ignore it.
 */
let against: string | undefined;
if (check) {
  const usage = judgeUsage("kg:audit:all:check", args, ["--strict", "--against"]);
  if (usage !== undefined) process.exit(usage);
  const a = againstOrUsage("kg:audit:all:check", args);
  if (a.exit !== undefined) process.exit(a.exit);
  against = a.against;
}

/** One layer's outcome. `crashed` is NOT a kind of failure — it is worse. */
interface Outcome {
  id: string;
  code: number;
  /** The audit's own summary line, when it produced one. */
  summary?: string;
  /** Set when the run produced no summary at all. */
  crashed?: string;
}

// A remote mount is another repository's (bean `nn8e`): its QA sidecars are
// that repository's to write, and writing them here breaks the lock's digest.
const roots = layerRootsIn(REPO).filter((r) => resolve(r) === resolve(REPO) || mountScopeFor(r) === undefined);

/**
 * Side by side under `--check`, one at a time otherwise.
 *
 * Each layer is its own process, so the only question is whether two runs
 * can disturb each other — and that has a different answer per mode. Under
 * `--check` an audit writes NOTHING, so the runs share only the cores; this is
 * the mode CI runs, and serially it was 39 s of the Repository gates job
 * (measured 2026-10-03, bean `fmdl`). Writing runs are left serial: a run may
 * read a sidecar another layer's run is writing, and nothing here has
 * established that it does not.
 *
 * Outcomes are reported in layer order either way, so the output is the
 * same text whichever mode ran.
 */
const width = check ? Math.max(1, availableParallelism()) : 1;

async function auditOne(root: string): Promise<Outcome> {
  // The root layer's relative path is "", which would print as nothing and
  // pass `./` — so it is named `.` in both places.
  const id = relative(REPO, root) || ".";
  const argv = ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", id === "." ? "." : `./${id}`];
  if (check) argv.push("--check");
  if (strict) argv.push("--strict");
  if (against !== undefined) argv.push("--against", against);

  // input-site: runs cat-harness/scripts/kg-audit.ts #6dfa6586 — one kg-audit per layer, inheriting this environment
  const p = Bun.spawn(argv, { cwd: REPO, stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;

  // The audit's own summary, quoted rather than recomputed: a second tally here
  // would be free to disagree with the sidecars it is reporting on.
  const summary = /^ {2}pass .*$/m.exec(out)?.[0]?.trim();
  const header = /Knowledge-graph audit\s+\([^)]*\)/.exec(out)?.[0];
  // The layer's own judge verdict, quoted (bean `oqe3`): "OK on what was
  // determined — N part(s) UNKNOWN" must reach the sweep's reader, or a run
  // with no baseline reads as a plain pass one level up.
  const judged = check ? /\(judge mode, wrote nothing\): (.*)$/m.exec(`${out}\n${err}`)?.[1]?.trim() : undefined;
  return header === undefined
    ? { id, code, crashed: (err.trim() || out.trim()).split("\n").slice(-3).join(" ").slice(0, 300) }
    : { id, code, summary: `${header.replace(/\s+/g, " ")} — ${summary ?? "no counts"}${judged ? `\n${" ".repeat(29)}${judged.slice(0, 200)}` : ""}` };
}

const outcomes: Outcome[] = new Array(roots.length);
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(width, roots.length) }, async () => {
    while (next < roots.length) {
      const i = next++;
      outcomes[i] = await auditOne(roots[i]!);
    }
  }),
);

const crashed = outcomes.filter((o) => o.crashed !== undefined);
const failed = outcomes.filter((o) => o.crashed === undefined && o.code !== 0);

for (const o of outcomes) {
  const mark = o.crashed !== undefined ? "‼" : o.code === 0 ? "✓" : "✗";
  console.log(`  ${mark} ${o.id.padEnd(24)} ${o.crashed ?? o.summary ?? ""}`);
}

console.log(
  `\n${outcomes.length} instance(s) audited${check ? " (--check: nothing written)" : ""}` +
    ` — ${outcomes.length - crashed.length - failed.length} clean, ${failed.length} failing, ${crashed.length} produced no report.`,
);

if (crashed.length > 0) {
  console.error(
    `\n${crashed.length} instance(s) produced NO audit report. That is not a pass and not a failing ` +
      `criterion — nothing was judged, so nothing is known. Named above.`,
  );
}

// Judge mode keeps the four states: a layer that could not be judged (a
// crash, or its own exit 2) is UNKNOWN for the sweep, and outranks a finding —
// a sweep blind on one layer has not cleared the others. The writer form
// keeps its historical 1.
if (check) {
  // Any exit but 0 and 1 is BLIND, not only 2. An audit killed after printing
  // its header (a signal, the OOM killer: 137) has a summary-less `failed`
  // entry whose code is neither, and testing `=== 2` here let the sweep exit
  // 0 over it (bean `8qyc`). `regen` derives `kg:audit:check`'s verdict from
  // this one, so this must fail whenever any spawned audit does.
  const blind = crashed.length > 0 || failed.some((o) => o.code !== 1);
  const found = failed.some((o) => o.code === 1);
  process.exit(blind ? 2 : found ? 1 : 0);
}
process.exit(crashed.length > 0 || failed.length > 0 ? 1 : 0);
