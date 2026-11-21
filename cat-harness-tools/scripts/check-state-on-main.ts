/**
 * Every declared directory whose graph typology `holds: "state"` is kept OFF
 * `main`, or it is recorded debt that may only go down.
 *
 * @covers cat-harness
 *
 * No kind-level `storage` default is provided: `BranchSourceSchema` requires a
 * `branch`, which a kind cannot supply, so each tip-keyed directory declares
 * its own `source`. (A kind's `newInstanceSource` is a scaffold default read
 * once by `folio_init`; the resolver never reads it.)
 *
 * Ratchet: a baseline that may only SHRINK.
 *
 * - a state directory on `main` that the baseline does not name is a NEW
 *   finding, and fails;
 * - a baseline entry that is no longer on `main` has been cut over, and fails
 *   too, with the instruction to delete the line.
 *
 * `--update` writes the baseline and refuses to grow it without
 * `--allow-growth`. The gate is listed in `regen-after-merge.ts`'s `NO_WRITER`
 * table so that `regen` can never raise the ratchet as a "repair".
 *
 * It asks the DECLARATION, never the disk: `contentIsOffCheckout` is the
 * single predicate, shared with `materialiseDirectories`,
 * `check:declared-dirs` and `audit:coverage`. A checkout where `state:mount`
 * has not run is not a finding, so the gate is safe before the mount step.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { findDeclarationFile, layerRootsIn, nestedDirectories, readDeclaration } from "../schemas/kg/cat-harness.js";
import { defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.js";
import { contentIsOffCheckout } from "../schemas/kg/subgraph-source.ts";
// The registration side-effect import, same reason `check:declared-dirs` has
// it: without it a reader's acceptance of this repository's own declaration is
// an import-order property of the process rather than of the declaration.
import "../schemas/kg/folio-graph-typology.js";

/** Where the recorded debt lives. One file, named in one place. */
export const BASELINE = "cat-harness-tools/scripts/state-on-main-baseline.json";
/** The baseline's top-level `_generated` — see where it is written. */
export const STATE_ON_MAIN_GENERATED = "scripts/check-state-on-main.ts --update — do not hand-edit";

/** A declared directory that holds state, and where its content lives. */
export interface StateDirectory {
  /** Repo-relative layer root; `""` for the repository root itself. */
  instance: string;
  id: string;
  /** Repo-relative path of the directory as declared. */
  path: string;
  /** Only the kinds that `holds: "state"` — the reason it is in this list. */
  stateKinds: string[];
  /** `true` when the declaration puts the content off the checkout. */
  offCheckout: boolean;
  /** The declaring file, for a message somebody can act on. */
  declaredIn: string;
}

/**
 * The key a baseline line carries: layer and id, NOT the path.
 *
 * The path is reported but not keyed on, deliberately. A cutover changes
 * `source` and leaves `path` alone (it becomes where the mount lands), so
 * keying on the path would make a line stop matching for the one change it is
 * meant to track. Keying on `id` within its layer is stable across
 * everything except a rename, and a rename of a declared directory is a
 * reviewed act in its own right.
 */
export function keyOf(d: { instance: string; id: string }): string {
  return `${d.instance || "."}::${d.id}`;
}

/** Does this kind record LIVE state? Asked of the registry, never guessed. */
function holdsState(kind: string): boolean {
  return defaultGraphTypologies.get(kind)?.holds === "state";
}

/**
 * Every declared directory in the checkout that holds state.
 *
 * Both levels: a layer's own `directories`, and the entries declared FROM
 * WITHIN one of them (`beans/beans.json`, `todos/todos.json`). The second
 * level is where most of them are, and a one-level read would have reported
 * `beans` as the only bean-shaped finding while missing `defs`, `notes`,
 * `workflows`, `queue` and `surveys` underneath it.
 */
export function stateDirectories(repoRoot: string): StateDirectory[] {
  const root = resolve(repoRoot);
  const out: StateDirectory[] = [];
  for (const inst of layerRootsIn(root)) {
    const decl = readDeclaration(inst);
    if (decl === undefined) continue;
    const instRel = relative(root, inst);
    // The REAL declaration file, asked of the same finder the reader used.
    // Composing it from the directory's basename gave `som.json` in a git
    // worktree named `som` — a message naming a file that does not exist is
    // worse than no message, because the reader goes looking for it.
    const declFile = `${instRel ? `${instRel}/` : ""}${findDeclarationFile(inst) ?? "<declaration>"}`;
    // A `repository`-scoped entry describes a directory of the CHECKOUT, not
    // of the layer declaring it: in the index checkout cat-harness declares
    // the root's `beans/`, `todos/`, `uploads/` (decision (b), the root itself
    // declaring nothing). It is keyed and located at the root (`.`), where the
    // baseline has always named those directories; joining it under the
    // layer reported `cat-harness/beans/defs`, which does not exist.
    const own = (decl.directories ?? []).map((d) => ({
      id: d.id,
      path: d.path,
      graphTypologies: d.graphTypologies ?? [],
      source: d.source,
      storage: (d as { storage?: unknown }).storage,
      declaredIn: declFile,
      parent: undefined as string | undefined,
      atRoot: (d as { scope?: string }).scope === "repository",
    }));
    const byId = new Map(own.map((d) => [d.id, d]));
    const nested = nestedDirectories(inst, decl).map((d) => ({
      id: d.id,
      path: d.path,
      graphTypologies: d.graphTypologies ?? [],
      source: d.source,
      storage: d.storage,
      atRoot: byId.get(d.parentId)?.atRoot ?? false,
      // The from-within file, named by the PARENT entry it hangs off, so a
      // message says which file to edit rather than which layer to search.
      declaredIn: `${instRel ? `${instRel}/` : ""}${d.parentId}/${d.parentId}.json`,
      parent: d.parentId,
    }));
    // Off the checkout is INHERITED: an entry declared from within a directory
    // whose content lives on a branch is on that branch too. `beans/defs` is
    // read from the mounted `cat/cat-harness/beans`, not from `main`, whatever
    // `beans/beans.json` says of it.
    const off = new Map<string, boolean>();
    for (const d of [...own, ...nested]) {
      const inherited = d.parent !== undefined && off.get(d.parent) === true;
      const offCheckout = inherited || contentIsOffCheckout({ source: d.source as never, storage: d.storage });
      off.set(d.id, offCheckout);
      const stateKinds = d.graphTypologies.filter(holdsState);
      if (stateKinds.length === 0) continue;
      const where = d.atRoot ? "" : instRel;
      out.push({
        instance: where,
        id: d.id,
        path: join(where, d.path).replace(/\\/g, "/").replace(/\/+$/, ""),
        stateKinds,
        offCheckout,
        declaredIn: d.declaredIn,
      });
    }
  }
  return out;
}

export interface Baseline {
  /** Keys of state directories known to be on `main`. May only shrink. */
  onMain: string[];
}

export type Finding =
  | { kind: "new-on-main"; key: string; dir: StateDirectory }
  | { kind: "baseline-stale"; key: string }
  // Not a failure: the line names an instance this checkout does not hold at
  // all, so whether that directory is on `main` is not this root's to judge
  // (cat-harness-tools#1701). Printed, never counted.
  | { kind: "not-applicable"; key: string; why: string };

/** The instance part of a baseline key (`.` for the repository root). */
function instanceOfKey(key: string): string {
  const at = key.indexOf("::");
  return at < 0 ? key : key.slice(0, at);
}

/**
 * Baseline instances DETERMINED not to be in this checkout, each with why
 * (cat-harness-tools#1701).
 *
 * The baseline is cat-harness-tools' own, written in the platform index, so it
 * names instances (a layer above this one) that a content instance's joined
 * checkout never mounts. In smart-ips-pilgrimage's run that line was
 * reported stale — "no longer a state directory on `main`" — which is not
 * true: the gate simply could not see it. An instance is only excused when the
 * checkout says so twice over: an `index.lock.json` that parses and does not
 * list it (by name or mount path), AND no directory of that path on disk. A
 * checkout with no lock, an unreadable lock, or the instance locked but
 * missing on disk is judged exactly as before, so the platform index — whose
 * lock lists that layer — still fails a genuinely stale line.
 */
export function instancesNotInCheckout(repoRoot: string, baseline: Baseline): Map<string, string> {
  const out = new Map<string, string>();
  const lockFile = join(resolve(repoRoot), "index.lock.json");
  if (!existsSync(lockFile)) return out;
  let lock: { instances?: { instance?: unknown; path?: unknown }[] };
  try {
    lock = JSON.parse(readFileSync(lockFile, "utf8")) as typeof lock;
  } catch {
    return out;
  }
  const locked = new Set<string>();
  for (const i of lock.instances ?? []) {
    if (typeof i.instance === "string") locked.add(i.instance);
    if (typeof i.path === "string") locked.add(i.path.replace(/\\/g, "/").replace(/\/+$/, ""));
  }
  for (const key of baseline.onMain) {
    const inst = instanceOfKey(key);
    if (inst === "." || locked.has(inst) || out.has(inst)) continue;
    if (existsSync(join(resolve(repoRoot), inst))) continue;
    out.set(inst, `\`${inst}\` is not in this checkout: index.lock.json does not mount it and no \`${inst}/\` exists`);
  }
  return out;
}

/**
 * The two directions, and both of them fail.
 *
 * A one-way ratchet that only looks for new entries goes quiet the moment the
 * debt is paid: the line stays, and the next directory declared with that id
 * inherits an exemption nobody granted.
 */
export function compare(
  dirs: readonly StateDirectory[],
  baseline: Baseline,
  notHere: ReadonlyMap<string, string> = new Map(),
): Finding[] {
  const recorded = new Set(baseline.onMain);
  const findings: Finding[] = [];
  const live = new Set<string>();
  for (const d of dirs) {
    if (d.offCheckout) continue;
    const key = keyOf(d);
    live.add(key);
    if (!recorded.has(key)) findings.push({ kind: "new-on-main", key, dir: d });
  }
  for (const key of baseline.onMain) {
    if (live.has(key)) continue;
    const why = notHere.get(instanceOfKey(key));
    findings.push(why === undefined ? { kind: "baseline-stale", key } : { kind: "not-applicable", key, why });
  }
  return findings;
}

export function readBaseline(repoRoot: string): Baseline {
  const raw = JSON.parse(readFileSync(join(repoRoot, BASELINE), "utf8")) as Partial<Baseline>;
  return { onMain: [...(raw.onMain ?? [])].sort() };
}

if (import.meta.main) {
  const repoRoot = process.cwd();
  const update = process.argv.includes("--update");
  const dirs = stateDirectories(repoRoot);
  const onMain = dirs.filter((d) => !d.offCheckout);

  if (update) {
    const next = { onMain: onMain.map(keyOf).sort() };
    const prior = (() => {
      try {
        return readBaseline(repoRoot);
      } catch {
        return { onMain: [] as string[] };
      }
    })();
    const added = next.onMain.filter((k) => !prior.onMain.includes(k));
    if (added.length > 0 && !process.argv.includes("--allow-growth")) {
      // The ratchet's whole value is that it cannot be raised by the tool that
      // reads it. Recording a NEW entry has to be a deliberate, separate act.
      console.error(
        `  ✗ --update would ADD ${added.length} entr(ies): ${added.join(", ")}\n` +
          `    The baseline may only shrink. Move the directory off \`main\`, or pass\n` +
          `    --allow-growth in a commit whose message says why the debt grew.`,
      );
      process.exit(1);
    }
    writeFileSync(
      join(repoRoot, BASELINE),
      JSON.stringify(
        // `_generated` is the file's own declaration that a tool wrote it — the
        // `sync-docs-harness.ts` convention `check-reference-direction.ts` reads.
        // Its lines name the layers whose state it records, which an authored
        // file in this layer may not do.
        {
          _generated: STATE_ON_MAIN_GENERATED,
          _comment:
            "Declared directories whose graph typology `holds: \"state\"` and whose content is still on `main`, " +
            "as `<instance>::<id>` (`.` for the repository root). RECORDED DEBT, and it may only go DOWN: " +
            "a state directory on `main` that is not listed here fails `check:state-on-main`, and a line " +
            "here that no longer describes a directory on `main` fails too, so a paid-off entry cannot " +
            "linger as an exemption nobody granted. Written by `bun run cat check:state-on-main --update`; " +
            "growing it needs --allow-growth and a commit message saying why. See the module header of " +
            "scripts/check-state-on-main.ts for why the `holds: state` default was NOT built.",
          onMain: next.onMain,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(`${BASELINE} — written, ${next.onMain.length} entr(ies) on \`main\``);
    process.exit(0);
  }

  const baseline = readBaseline(repoRoot);
  const all = compare(dirs, baseline, instancesNotInCheckout(repoRoot, baseline));
  const findings = all.filter((f) => f.kind !== "not-applicable");
  for (const f of all) {
    if (f.kind === "not-applicable") {
      console.log(`  · ${f.key} not applicable here — ${f.why}`);
    } else if (f.kind === "new-on-main") {
      console.error(
        `  ✗ ${f.key} (${f.dir.path}) holds ${f.dir.stateKinds.map((k) => `\`${k}\``).join(" + ")} ` +
          `and its content is on \`main\`, with no \`source\` declared. ` +
          `Declare it on a branch in ${f.dir.declaredIn} — ` +
          `\`source: { kind: "branch", branch: "cat/<harness>/<name>", keyedBy: "tip" }\` — ` +
          `and remember the flip and the removal are ONE commit, because \`mountTip\` ` +
          `refuses a path the checkout still tracks.`,
      );
    } else {
      console.error(
        `  ✗ ${f.key} is in ${BASELINE} but is no longer a state directory on \`main\`. ` +
          `Delete the line: a baseline entry that describes nothing is an exemption for ` +
          `whatever next takes that id.`,
      );
    }
  }
  console.log(
    `${dirs.length} declared director(ies) hold state across ` +
      `${new Set(dirs.map((d) => d.instance || ".")).size} instance(s); ` +
      `${dirs.length - onMain.length} off the checkout, ${onMain.length} on \`main\` ` +
      `(${readBaseline(repoRoot).onMain.length} recorded); ${findings.length} finding(s)`,
  );
  process.exit(findings.length > 0 ? 1 : 0);
}
