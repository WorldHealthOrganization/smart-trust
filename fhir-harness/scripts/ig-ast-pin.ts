/**
 * Pin, or check, the AST cache commit an IG's artefact index is built from
 * (`ig-ast.lock.json`, `schemas/ig-ast-lock.ts`; bean fwtz, Q-S2-1 A).
 *
 *   bun run cat ig-ast:pin --instance <ig> --branch <cache branch> (--sha <sha> | --tip) --consent-by <who> --evidence "<where they said yes>"
 *   bun run cat ig-ast:lock:check
 *
 * `--tip` resolves the branch's current commit once, here, so the build never
 * has to. The pinned commit's `manifest.json` is read to record the IG commit
 * the AST was compiled from, and the log says when that is not the IG's own
 * pin in `index.lock.json`. `--check` validates the lock against
 * `index.lock.json` with no network: each pin names a mounted layer, in the
 * repository it is mounted from.
 *
 * @covers fhir-artifact-index
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { astPinsIn, IG_AST_LOCK_FILE, IG_AST_LOCK_TAG, IgAstLockSchema, type IgAstPin } from "../schemas/ig-ast-lock.ts";
import { lockedMounts } from "./build-ig-indexes.ts";

const SHA = /^[0-9a-f]{40}$/;

function git(args: string[]): string {
  const r = spawnSync("git", args, { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout;
}

/** Problems with the lock at `root`, judged against its `index.lock.json`; empty means sound. */
export function checkAstLock(root: string): string[] {
  let pins: Map<string, IgAstPin>;
  try {
    pins = astPinsIn(root);
  } catch (e) {
    return [`${IG_AST_LOCK_FILE}: ${(e as Error).message}`];
  }
  const mounts = lockedMounts(root);
  const out: string[] = [];
  for (const p of pins.values()) {
    const m = mounts.get(p.instance);
    if (!m) out.push(`${p.instance}: pinned in ${IG_AST_LOCK_FILE} but not mounted by index.lock.json`);
    else if (m.repository !== p.repository) out.push(`${p.instance}: AST pinned in ${p.repository}, but the IG is mounted from ${m.repository}`);
  }
  return out;
}

/** `lock` with `pin` put in its layer's place, sorted by layer. */
export function withPin(pins: Iterable<IgAstPin>, pin: IgAstPin): { $schema: typeof IG_AST_LOCK_TAG; pins: IgAstPin[] } {
  const by = new Map([...pins].map((p) => [p.instance, p]));
  by.set(pin.instance, pin);
  return IgAstLockSchema.parse({ $schema: IG_AST_LOCK_TAG, pins: [...by.values()].sort((a, b) => a.instance.localeCompare(b.instance)) }) as { $schema: typeof IG_AST_LOCK_TAG; pins: IgAstPin[] };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const val = (f: string): string | undefined => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const root = resolve(val("--root") ?? process.cwd());
  if (argv.includes("--check")) {
    const problems = checkAstLock(root);
    for (const p of problems) console.error(`ig-ast:lock: ${p}`);
    console.log(problems.length ? `ig-ast:lock: ${problems.length} problem(s)` : `ig-ast:lock: ${astPinsIn(root).size} pin(s) — OK`);
    process.exit(problems.length ? 1 : 0);
  }
  const instance = val("--instance"), branch = val("--branch"), by = val("--consent-by"), evidence = val("--evidence");
  let sha = val("--sha");
  if (!instance || !branch || !by || !evidence || (!sha && !argv.includes("--tip"))) {
    console.error('usage: ig-ast-pin.ts --instance <ig> --branch <cache branch> (--sha <sha> | --tip) --consent-by <who> --evidence "<…>" | --check');
    process.exit(2);
  }
  const mount = lockedMounts(root).get(instance);
  if (!mount) {
    console.error(`ig-ast:pin: index.lock.json mounts no instance ${instance}`);
    process.exit(2);
  }
  const url = `https://github.com/${mount.repository}`;
  if (!sha) sha = git(["ls-remote", "--exit-code", "--heads", url, `refs/heads/${branch}`]).split(/\s/)[0];
  if (!sha || !SHA.test(sha)) {
    console.error(`ig-ast:pin: ${sha} is not a full sha`);
    process.exit(2);
  }
  const dir = mkdtempSync(join(tmpdir(), "ig-ast-pin-"));
  let sourceRevision: string | undefined;
  try {
    git(["init", "--quiet", dir]);
    git(["-C", dir, "fetch", "--quiet", "--depth", "1", "--no-tags", url, sha]);
    const m = JSON.parse(git(["-C", dir, "show", `${sha}:manifest.json`])) as { inputs?: { sourceRevision?: unknown } };
    if (typeof m.inputs?.sourceRevision === "string" && SHA.test(m.inputs.sourceRevision)) sourceRevision = m.inputs.sourceRevision;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const pin: IgAstPin = { instance, repository: mount.repository, branch, sha, ...(sourceRevision ? { sourceRevision } : {}), consent: { by, on: new Date().toISOString().slice(0, 10), evidence } };
  let prior: IgAstPin[] = [];
  try {
    prior = [...astPinsIn(root).values()];
  } catch {
    prior = [];
  }
  writeFileSync(join(root, IG_AST_LOCK_FILE), `${JSON.stringify(withPin(prior, pin), null, 2)}\n`);
  console.log(`ig-ast:pin: ${instance} AST = ${mount.repository}@${sha.slice(0, 12)} (${branch})`);
  if (sourceRevision && mount.sha && sourceRevision !== mount.sha) console.log(`  ! compiled from ${sourceRevision.slice(0, 7)}, not the IG's pin ${mount.sha.slice(0, 7)}: the index describes that commit until the cache is rebuilt at the pin and re-pinned`);
}
