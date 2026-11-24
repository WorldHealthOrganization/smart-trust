/**
 * `kg:validate` owns a NESTED layer's path, so every committed kg-audit
 * sidecar is validated for a consumer, not only proved current.
 *
 * ## The defect this pins (bean `676g`)
 *
 * `kg:validate` resolved every path against ONE root, its own layer
 * (`cat-harness/`). Measured on `main` `cf3e624`:
 *
 * ```
 * kg:validate cat-harness/test/results/kg-qa/processes/adjudication.kg-qa.json   ✓ [qa]
 * kg:validate smart-dak/test/results/kg-qa/scenarios/kg.kg-qa.json
 *   ? … could not determine: no declared directory owns this path
 * ```
 *
 * Fixing the owner exposed the second half: the `qa` kind's validator refs
 * (`schemas/sdlc/kg-qa.ts#…`) are relative to the layer whose registry DEFINES
 * the kind, and resolving them against `smart-dak/` reported "does not exist".
 * Both halves are asserted here, over the REAL corpus, because the question is
 * whether the committed sidecars a reader picks up parse — not whether a
 * fixture does. `smart-dak` was retired since (D3, `26eabf673`), so the
 * nested example below is `smart-base`'s sidecar at the same relative path.
 *
 * ## Anti-vacuity
 *
 * A sweep over zero files passes. So the sweep must reach sidecars in several
 * layers OTHER than the auditor's own — the population this bean is about.
 *
 * ## Where the sidecars are read (bean `7mwa`)
 *
 * "Committed" stopped meaning "on disk" when cat-harness stopped committing
 * its QA working copy (cat-harness#857): a layer whose `qa` home is absent
 * is swept in the `qa-reports` store's newest `main` entry instead, at the
 * same checkout paths and by the same validator, because that is what every
 * reader then reads. An unreachable store is reported in the anti-vacuity
 * message, never read as clean. A MOUNTED layer's home is read from that
 * layer's OWN store at the commit the lock pins (`scripts/layer-qa.ts`;
 * owner, 2026-11-03, "2. Each layer publishes"): its QA is its repository's
 * to write (bean `nn8e`), published by `layer-qa-publish.yml`.
 *
 * @module test/kg-validate-nested-instances
 *
 * Moved here from
 * `cat-harness/scripts/tests/kg-validate-nested-instances.test.ts` to the
 * checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it validates the kg-audit sidecars of
 * every nested layer in the checkout, which only the whole checkout holds.
 * Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. Paths are
 * composed from ORIGIN_DIR, the directory it was written in, so nothing it
 * reads changed.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { layerRootsIn, kgQaHomeFor, readDeclaration } from "../../schemas/kg/cat-harness.js";
import { owningInstanceRoot, validatePath, validateText } from "../../scripts/kg-validate.js";
import { readLayerQaTree } from "../../scripts/layer-qa.ts";
import { readQaTree, type QaStoreOptions } from "../../scripts/qa-store.js";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");


const REPO = resolve(ORIGIN_DIR, "../../..");
const HARNESS = join(REPO, "cat-harness");

/** One sidecar: its checkout path, and its text when it came from the store rather than the disk. */
type Sidecar = { path: string; text?: string };

/** Is this repository-relative path a kg-audit sidecar or the manifest beside them, under `home`? */
const isKgQaFile = (rel: string, home: string): boolean =>
  rel === `${home}/kg-qa.manifest.json` || (rel.startsWith(`${home}/kg-qa/`) && rel.endsWith(".kg-qa.json"));

/**
 * Every kg-audit sidecar a reader picks up, keyed by the layer it is ABOUT.
 *
 * Where it is read from (bean `7mwa`): a layer whose `qa` home is in the
 * working copy is swept on disk, as before. One whose home is ABSENT is swept
 * in the `qa-reports` store's newest `main` entry, at the same checkout paths:
 * the corpus left the checkout (cat-harness#857), and the store is then what
 * every reader reads. Nothing is written into the checkout. `storeState` says
 * why the store gave nothing, so an empty sweep names its cause.
 */
function readSidecars(): { byInstance: Map<string, Sidecar[]>; storeState: string } {
  const out = new Map<string, Sidecar[]>();
  const absent: Array<{ key: string; home: string }> = [];
  for (const inst of layerRootsIn(REPO)) {
    const key = relative(REPO, inst) || ".";
    const home = kgQaHomeFor(inst, HARNESS).root;
    if (!existsSync(home)) {
      absent.push({ key, home: relative(REPO, home).split("\\").join("/") });
      continue;
    }
    const files: Sidecar[] = [];
    const manifest = join(home, "kg-qa.manifest.json");
    if (existsSync(manifest)) files.push({ path: manifest });
    const tree = join(home, "kg-qa");
    if (existsSync(tree)) {
      for (const f of readdirSync(tree, { recursive: true }).map(String)) {
        if (f.endsWith(".kg-qa.json")) files.push({ path: join(tree, f) });
      }
    }
    // A home that holds no kg-audit sidecar is read from the store too: another
    // writer (any test that leaves a sidecar in `test/results/`) can create the
    // directory without putting a kg-qa file in it.
    if (files.length) out.set(key, files);
    else absent.push({ key, home: relative(REPO, home).split("\\").join("/") });
  }
  if (absent.length === 0) return { byInstance: out, storeState: "not read: every qa home is in the working copy" };
  // A MOUNTED layer's QA is its own repository's (bean `7mwa`; owner,
  // 2026-11-03, "2. Each layer publishes"): it is read from that layer's
  // store at the commit the lock pins, never from this index's store.
  const states: string[] = [];
  const indexOwned: typeof absent = [];
  for (const a of absent) {
    // cat-harness's own home, and the homes it HOSTS (`kgQaHomeFor` "hosted",
    // under cat-harness's), are written by the index's QA job (`qa-refresh.ts`),
    // so they stay the index's store's to answer.
    const root = join(REPO, a.key);
    const ownLayer = resolve(root) !== resolve(HARNESS) && kgQaHomeFor(root, HARNESS).by === "own";
    const { source, read } = ownLayer ? readLayerQaTree(REPO, root, a.home) : { source: undefined, read: undefined };
    if (source === undefined || read === undefined) {
      indexOwned.push(a);
      continue;
    }
    if (read.state === "corrupt") throw new Error(`${source.instance}'s qa-reports store is corrupt: ${read.reason}`);
    if (read.state !== "hit") {
      states.push(`${source.instance}: ${read.state} (${read.reason})`);
      continue;
    }
    const files: Sidecar[] = [];
    for (const [rel, text] of read.files) if (isKgQaFile(rel, a.home)) files.push({ path: join(REPO, rel), text });
    if (files.length) out.set(a.key, files);
    states.push(`${source.instance}: read ${source.repository} ${read.key}`);
  }
  if (indexOwned.length === 0) return { byInstance: out, storeState: states.join("; ") };
  // The store is reached the way every reader reaches it: the checkout's
  // `origin`, or QA_STORE_REMOTE / QA_STORE_DIR where the checkout has none.
  const opts: QaStoreOptions = { repoRoot: REPO, log: () => {} };
  let read: ReturnType<typeof readQaTree>;
  try {
    read = readQaTree("main", "", opts);
  } catch (e) {
    return { byInstance: out, storeState: [...states, `index: unknown: ${e instanceof Error ? e.message : String(e)}`].join("; ") };
  }
  if (read.state !== "hit") {
    // A corrupt entry is a finding about what readers read, not an absence.
    if (read.state === "corrupt") throw new Error(`the qa-reports store is corrupt: ${read.reason}`);
    return { byInstance: out, storeState: [...states, `index: ${read.state}: ${read.reason}`].join("; ") };
  }
  for (const { key, home } of indexOwned) {
    const files: Sidecar[] = [];
    for (const [rel, text] of read.files) if (isKgQaFile(rel, home)) files.push({ path: join(REPO, rel), text });
    if (files.length) out.set(key, files);
  }
  return { byInstance: out, storeState: [...states, `index: read ${read.key}`].join("; ") };
}

/** Read once per run: the store read is slow, and two tests share it. */
let sidecarsRead: ReturnType<typeof readSidecars> | undefined;
function sidecarsByInstance(): ReturnType<typeof readSidecars> {
  return (sidecarsRead ??= readSidecars());
}

describe("kg:validate over nested instances (bean `676g`)", () => {
  test("a path is owned by the DEEPEST instance that contains it", () => {
    expect(owningInstanceRoot(join(REPO, "smart-base/test/results/kg-qa/scenarios/kg.kg-qa.json"), HARNESS)).toBe(
      join(REPO, "smart-base"),
    );
    expect(owningInstanceRoot(join(HARNESS, "test/results/kg-qa.manifest.json"), HARNESS)).toBe(HARNESS);
    // A file in no nested layer belonged to the layer AT the checkout
    // root. RESTATED 2026-10-09: the owner removed that declaration (3d4caf6,
    // 2026-10-08), so the root is an index and no layer contains such a
    // file. It falls back to the auditing layer -- cat-harness, which hosts
    // the checkout-root graphs repository-scoped (coordinator decision (b)), so
    // a root-level `beans/` sidecar is judged by the layer that declares it.
    expect(readDeclaration(REPO)).toBeUndefined();
    expect(owningInstanceRoot(join(REPO, "package.json"), HARNESS)).toBe(HARNESS);
  });

  test("resolving against the auditor's own instance — the old behaviour — refuses a nested sidecar", async () => {
    // The falsifier: proves the sweep below is not passing for a reason that
    // has nothing to do with ownership.
    //
    // MOVED 2026-10-09 (folio-assistant#2518), as its own message asks: the
    // sidecar was `smart-base`'s, and since the separation each layer's
    // kg-audit sidecars are its own repository's to commit. litlfred/smart-base
    // commits none, and `kg:audit:all` writes none into a remote mount, so the
    // composed checkout has no `smart-base/test/results/kg-qa/`.
    // `folio-assistant-core` commits its own — the same relative path, in a
    // layer that is nested, is not the auditor, and does not define the
    // `qa` kind — which is everything the falsifier needs.
    //
    // Since bean `7mwa` the core no longer commits test/results/ either, so the
    // sidecar is read where the sweep below reads it: on disk, or from the
    // qa-reports store.
    //
    // Chosen, not named (2026-11-02, folio-assistant#2781): the core's
    // sidecar left the qa-reports store, and a named path breaks each time
    // one does. Any kg-audit sidecar of a nested layer other than the
    // auditor serves, so the first one the sweep finds is taken.
    const { byInstance, storeState } = sidecarsByInstance();
    const candidates = [...byInstance.entries()]
      .filter(([instance]) => instance !== "cat-harness")
      .flatMap(([instance, files]) => files.filter((f) => f.path.endsWith(".kg-qa.json")).map((f) => ({ instance, f })));
    expect(candidates.length, `no nested kg-audit sidecar to falsify with (qa-reports store: ${storeState})`).toBeGreaterThan(0);
    const { instance: NESTED, f: found } = candidates[0]!;
    const nested = resolve(found.path);
    const check = (root: string, schemaRoot?: string) =>
      found!.text === undefined ? validatePath(nested, root, schemaRoot) : validateText(nested, found!.text, root, schemaRoot);
    expect((await check(HARNESS)).state).toBe("undetermined");
    // ...and a nested owner with the nested root as SCHEMA root is the second half.
    expect((await check(join(REPO, NESTED))).state).toBe("undetermined");
    expect((await check(join(REPO, NESTED), HARNESS)).state).toBe("valid");
  }, 120_000); // the store read is the sweep's, and as slow

  test("every committed kg-audit sidecar, in every instance, validates", async () => {
    const { byInstance, storeState } = sidecarsByInstance();
    const others = [...byInstance.keys()].filter((k) => k !== "cat-harness");
    // ANTI-VACUITY, DERIVED rather than counted (owner, 2026-10-10: "derive
    // the floor"). The floor was a literal 5; smart-base stopped committing
    // kg-audit sidecars when QA results moved to the `qa-reports` branch,
    // only 4 layers remained, and the test failed with nothing broken.
    // What a layer commits says whether it commits sidecars: `kg:audit`
    // writes `kg-qa.manifest.json` beside them. So every layer whose home
    // holds a manifest must ALSO hold sidecars (a manifest with none is the
    // regression this guards), and the sweep must reach at least one layer
    // other than the auditor, which is the population bean `676g` is about.
    // The manifest is asked of the same source the sidecars came from: on
    // disk, or in the store entry (bean `7mwa`).
    const declaring = [...byInstance.entries()]
      .filter(([, files]) => files.some((f) => f.path.endsWith("kg-qa.manifest.json")))
      .map(([k]) => k);
    const withoutSidecars = declaring.filter((k) => !(byInstance.get(k) ?? []).some((f) => f.path.endsWith(".kg-qa.json")));
    expect(withoutSidecars, "instances with a kg-qa manifest but no kg-audit sidecars").toEqual([]);
    expect(
      others.length,
      `sidecars found only in: ${[...byInstance.keys()].join(", ")} (qa-reports store: ${storeState})`,
    ).toBeGreaterThanOrEqual(1);

    const offences: string[] = [];
    let n = 0;
    for (const files of byInstance.values()) {
      for (const { path: f, text } of files) {
        n++;
        const owner = owningInstanceRoot(f, HARNESS);
        const v = text === undefined ? await validatePath(f, owner, HARNESS) : await validateText(f, text, owner, HARNESS);
        if (v.state !== "valid") {
          offences.push(
            `${relative(REPO, f)}${text === undefined ? "" : " (qa-reports)"}: ${v.state}${v.state === "invalid" ? ` — ${v.problems.slice(0, 2).join("; ")}` : v.state === "undetermined" ? ` — ${v.reason}` : ""}`,
          );
        }
      }
    }
    expect(n).toBeGreaterThan(50);
    expect(offences).toEqual([]);
  }, 120_000);
});
