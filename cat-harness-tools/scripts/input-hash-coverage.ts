/**
 * Which checks `regen` and `gates` may skip on an unchanged tree, and what
 * stops the rest.
 *
 * @module scripts/input-hash-coverage
 * @graphNode none — a report over `task-io.ts` and `input-sites.ts`; it writes nothing
 *
 * ```sh
 * bun run cat input-hash:coverage                 # per task: skippable, or the first thing in the way
 * bun run cat input-hash:coverage --blockers      # the input sites that block the most tasks
 * bun run cat input-hash:coverage --sites <file>  # every site in a file, with the pin it needs
 * ```
 *
 * It reports and never decides: a task is skippable only when its
 * `task-io.ts` declaration names `inputs` AND its fingerprint is determined.
 * "audit-clean, undeclared" lists the tasks whose closure already passes
 * the site audit but which nobody has declared yet — candidates, not facts.
 */
import { readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { checkoutRootFor } from "../schemas/kg/cat-harness.ts";
import { againstRefsOf, checkFingerprint, entryFiles, FileDigests, TRACKED } from "./input-hash.ts";
import { auditClosure, scanSource, SiteMemo } from "./input-sites.ts";
import { TASK_IO } from "./task-io.ts";
import { scriptsOf } from "../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";

const root = checkoutRootFor(join(HARNESS_ROOT));
const argv = process.argv.slice(2);

if (argv[0] === "--sites") {
  const file = argv[1];
  if (file === undefined) throw new Error("--sites needs a file");
  const rel = relative(root, resolve(file));
  for (const s of scanSource(rel, readFileSync(join(root, rel), "utf-8"))) {
    const state = s.verdicts === undefined ? "UNANNOTATED" : s.verdicts === "stale" ? "STALE" : "ok";
    const main = s.inMain ? "  (import.meta.main block: reached only as an entry)" : "";
    console.log(`${rel}:${s.line}  #${s.pin}  ${s.risks.join(",")}  ${state}${s.malformed ? ` (${s.malformed})` : ""}${main}`);
  }
  process.exit(0);
}

const scripts = scriptsOf(root);
const memo = new SiteMemo();
const digests = new FileDigests(root);
const blockers = new Map<string, Set<string>>();
const rows: { task: string; state: string; why: string }[] = [];
for (const [task, io] of Object.entries(TASK_IO).sort(([a], [b]) => a.localeCompare(b))) {
  const entries = entryFiles(root, scripts, task);
  const problems: string[] = [];
  const foreign = entries?.find((e) => !/\.(m?[jt]sx?)$/.test(e));
  const audit = entries === undefined
    ? { undetermined: "does not resolve to script files" }
    : foreign !== undefined
      ? { undetermined: `${foreign} is not TypeScript/JavaScript, so its reads cannot be audited` }
      : auditClosure(root, entries, memo, problems, (name) => entryFiles(root, scripts, name), (source) => digests.declared.resolve(source));
  for (const p of problems) {
    const site = /at (\S+:\d+)/.exec(p)?.[1] ?? p;
    (blockers.get(site) ?? blockers.set(site, new Set()).get(site)!).add(task);
  }
  if (io.inputs !== undefined) {
    // A stand-in baseline, so the rest of the fingerprint is still judged: a
    // report must not fetch the qa-reports branch. The row says it depends on one.
    const fp = checkFingerprint(root, scripts, task, io, digests, () => ({ id: "(stand-in)" }));
    const against = againstRefsOf(scripts, task);
    rows.push({
      task,
      state: "hash" in fp ? "skippable" : "declared, undetermined",
      why: "hash" in fp ? (against.length > 0 ? `while the --against ${against.join(", ")} baseline holds still` : "") : fp.undetermined,
    });
  } else if ("undetermined" in audit) {
    rows.push({ task, state: "blocked", why: audit.undetermined });
  } else {
    rows.push({ task, state: "audit-clean, undeclared", why: io.outputs?.length === 0 ? "read-only" : "may write" });
  }
}

if (argv.includes("--blockers")) {
  for (const [site, tasks] of [...blockers].sort((a, b) => b[1].size - a[1].size)) console.log(`${String(tasks.size).padStart(4)}  ${site}`);
} else {
  for (const r of rows) console.log(`${r.state.padEnd(24)} ${r.task}${r.why ? `  — ${r.why}` : ""}`);
}
const count = (s: string) => rows.filter((r) => r.state === s).length;
console.log(
  `\n${rows.length} declared tasks: ${count("skippable")} skippable, ${count("declared, undetermined")} declared but undetermined, ` +
    `${count("audit-clean, undeclared")} audit-clean but undeclared, ${count("blocked")} blocked by an input site. (${TRACKED} = the whole working tree)`,
);
