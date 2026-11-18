/**
 * Each writer regen runs REPAIRS its check — measured on a staled artefact.
 *
 * Bean `i1q7`. `regen-after-merge.test.ts` asserts the PAIRING: that a check
 * names a writer that exists. That is the assertion that passed while
 * `translate-bpmn:bootstrap` printed "Nothing to do" and wrote nothing, so the
 * pairing was right by name and wrong in effect. This file asserts the effect:
 * stale one artefact on purpose, confirm the check goes red, let regen's own
 * pass run the writer it pairs from `package.json`, and confirm the check goes
 * green. Every artefact is restored to its exact bytes afterwards, so the test
 * leaves the tree as it found it (the gate runner's mutation guard checks).
 *
 * ## Why these pairs and not all of them
 *
 * Running every one of the ~90 writers over a staled fixture is a full regen
 * (5–6 minutes), and most writers have no single artefact a test can stale
 * without knowing the generator. These are the pairs MEASURED broken under
 * regen on 2026-10-01 — each one a merge where `bun run cat regen` left a gate red
 * and a person ran the writer by hand — plus the root `translate-bpmn` pair as
 * the control the bootstrap one should have matched. The class-wide guard is
 * the runtime one: a writer that exits non-zero is reported `writer-failed` by
 * regen itself, for every pair, rather than read as a real defect.
 *
 * Moved here from `cat-harness/scripts/tests/regen-writers.test.ts` to the
 * checkout's own test home `test/` (bean `7zz1`, owner ruling 2026-10-06
 * "Top-level instance"): every test in it runs the checkout's real regen
 * writers, whose artefacts span layers (`bat:sync` wraps scripts in
 * folio-assistant-sci and the root `.claude/`), which only the whole checkout
 * holds. Standing alone, cat-harness has none of it, and
 * `check:cat-harness-standalone` collects every test in that layer. Paths are
 * composed from ORIGIN_DIR, the directory it was written in, so nothing it
 * reads changed.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { regenPass, writerFor, type Outcome, type Runner } from "../../scripts/regen-after-merge.ts";
import { chromiumExecutable } from "../../scripts/bpmn-render.ts";
import { repoRootFor } from "../../schemas/kg/cat-harness.ts";
import { scriptsOf } from "../../schemas/sdlc/script-table.ts";
import { mountedInstances, readPathAt } from "../../scripts/lib/layer-output.ts";
import { noRootManifest, scratchCheckoutOf } from "../support/checkout.ts";

/** The directory this test was written in (`cat-harness/scripts/tests/`): every path below is composed from it exactly as it was before the move to the checkout's test home (bean `7zz1`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/scripts/tests");


const REPO = repoRootFor(join(ORIGIN_DIR, "..", ".."));
const SCRIPTS = scriptsOf(REPO);

/**
 * Where the writers RUN: a scratch copy of the checkout, made once for the
 * file (bean `cat-tools-sm8r` item 4). Each writer redraws or re-extracts
 * EVERY artefact it owns, not only the one staled here, and the redraws
 * differ from the committed bytes; run in place, `translate-bpmn` and
 * `render:bpmn` rewrote every layer's process drawings and translation
 * templates, and only the one staled artefact was put back.
 */
let WORK = REPO;

const runner: Runner = (script) => spawnSync("bun", ["run", "cat", script], { cwd: WORK, encoding: "utf-8" }).status === 0;

/** The first file in a directory with this suffix, so a rename does not silently skip the case. */
function firstIn(dir: string, suffix: string): string {
  const f = readdirSync(join(WORK, dir)).filter((n) => n.endsWith(suffix)).sort()[0];
  if (f === undefined) throw new Error(`no *${suffix} under ${dir} — the fixture this case stales is gone`);
  return join(dir, f);
}

/** An own drawing committed beside its `.bpmn` (bean akiq): the first `<name>.svg` under `<instance>/<dir>` whose `<name>.bpmn` sits next to it. */
function firstBesideSource(instance: string, dir: string): string {
  const root = join(WORK, instance, dir);
  const hits = (readdirSync(root, { recursive: true }) as string[])
    .filter((p) => p.endsWith(".bpmn") && existsSync(join(root, p.replace(/\.bpmn$/, ".svg"))))
    .map((p) => p.replace(/\.bpmn$/, ".svg"))
    .sort();
  if (hits[0] === undefined) throw new Error(`no drawing beside a .bpmn under ${instance}/${dir} — the fixture this case stales is gone`);
  return join(instance, dir, hits[0]);
}

/** Is this check routed through `publish-check.ts`, which runs its writer before it checks (B1)? */
function checkRunsItsWriter(check: string): boolean {
  return (SCRIPTS[check] ?? "").includes("publish-check.ts");
}

/** The outermost ancestor of `abs` that does not exist yet (it may be `abs` itself). */
function firstMissingAncestor(abs: string): string {
  let p = abs;
  while (!existsSync(dirname(p))) p = dirname(p);
  return p;
}

function hasBrowser(): boolean {
  if (chromiumExecutable() !== undefined) return true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require("playwright") as typeof import("playwright");
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

interface Case {
  check: string;
  /** Repo-relative path of the artefact staled. */
  artefact: () => string;
  /** Turn the committed bytes into a version no writer would emit. */
  stale: (text: string) => string;
  needsBrowser?: boolean;
  /**
   * The layer whose committed file this case stales, made LOCAL in the
   * scratch checkout for the case (dropped from `WORK`'s `index.lock.json`,
   * put back after).
   *
   * Since cat-harness-tools b2e4118d (bean `cat-tools-sm8r`) a writer never
   * writes into a mount: render:bpmn puts a MOUNTED layer's changed
   * beside-source drawing at its output-root twin, so publish-check sees no
   * committed file move and stays green, and the red control cannot fire.
   * That is right: a mounted layer's committed drawing is judged in its own
   * repository, where it is not mounted. So the case stales a drawing the
   * checkout OWNS, which is the contract the gate still enforces, by making
   * that layer local here rather than by skipping the case.
   */
  localize?: string;
}

const CASES: Case[] = [
  {
    check: "translate-bpmn:bootstrap:check",
    artefact: () => firstIn("cat-harness/translations/es/bootstrap/processes", ".pot"),
    stale: (t) => `${t}\nmsgid "a string no diagram carries (i1q7 fixture)"\nmsgstr ""\n`,
  },
  {
    check: "translate-bpmn:check",
    artefact: () => firstIn("cat-harness/translations/es/processes", ".pot"),
    stale: (t) => `${t}\nmsgid "a string no diagram carries (i1q7 fixture)"\nmsgstr ""\n`,
  },
  // `check:published-instance-exports` was a case here, staling
  // `test/results/kg-export.bootstrap.qa-results.json`. Since bean `5hox` that
  // directory declares `storage`: the check reads its baseline from the
  // `qa-reports` branch (`--against`) or reports UNKNOWN, and a staled WORKING
  // copy is no longer a record it can go red on. Staleness of a stored file is
  // not a regen question; the record is written by `qa-publish`.
  {
    check: "bat:sync:check",
    artefact: () => firstIn("cat-harness-tools/scripts", ".bat"),
    stale: (t) => `${t}REM hand edit (i1q7 fixture)\r\n`,
  },
  {
    check: "render:bpmn:check",
    // A drawing committed beside its .bpmn: cat-harness's workflows/ folder is
    // built at publish since cat-harness#1047, so nothing there is committed
    // (bean nikw). bootstrap's beside-source drawings are drawn by render:bpmn
    // with or without cat-harness-tools#1504 (bean akiq), so the case holds
    // either side of it.
    artefact: () => firstBesideSource("bootstrap", "processes"),
    stale: (t) => t.replace("</svg>", "<!-- stale (i1q7 fixture) --></svg>"),
    needsBrowser: true,
    localize: "bootstrap",
  },
];

describe("every writer regen pairs for these gates turns a STALED artefact's check green (bean i1q7)", () => {
  const browser = hasBrowser();
  // Every check and writer runs as `bun run cat <script>` from the checkout root.
  const noCatAlias = noRootManifest(REPO, "the `cat` alias every check and writer here runs through");
  beforeAll(() => {
    if (!noCatAlias) WORK = scratchCheckoutOf(REPO);
  }, 180_000);
  afterAll(() => {
    if (WORK !== REPO) rmSync(WORK, { recursive: true, force: true });
    WORK = REPO;
  }, 180_000);
  /** The case for one check, staled, judged red, repaired by regen, judged green. */
  const run = (check: string) => async () => {
    const c = CASES.find((x) => x.check === check)!;
    const writer = writerFor(SCRIPTS, c.check);
    expect(writer, `${c.check} has no writer regen can run`).toBeDefined();
    const rel = c.artefact();
    // Make the fixture's layer local for this case (see `Case.localize`).
    const lockFile = join(WORK, "index.lock.json");
    const lockBefore = c.localize !== undefined && existsSync(lockFile) ? readFileSync(lockFile, "utf-8") : undefined;
    if (lockBefore !== undefined) {
      const lock = JSON.parse(lockBefore) as { instances?: { instance?: string }[] };
      lock.instances = (lock.instances ?? []).filter((i) => i.instance !== c.localize);
      writeFileSync(lockFile, `${JSON.stringify(lock, null, 2)}\n`);
    }
    // The file the check READS: a mounted layer's computed file is read over
    // its output-root twin when a writer put one there (bean `cat-tools-sm8r`),
    // so staling the pinned bytes under the twin changes nothing the check
    // sees. Stale what is read, and judge the writer by what is read after.
    const mounted = mountedInstances(WORK);
    const mountAbs = join(WORK, rel);
    let abs = readPathAt(WORK, mountAbs, mounted);
    const readBack = () => readFileSync(readPathAt(WORK, mountAbs, mounted), "utf-8");
    let twinsBefore = abs !== mountAbs;
    // A derived QA artefact may be absent — the committed corpus is
    // leaving `main` (bean `cxcn`, reader audit F7). Then the WRITER
    // produces it fresh first, and the directory it had to create is
    // removed afterwards, so the test asserts on a fresh run rather than
    // on the committed copy, and leaves the checkout as it found it.
    const createdDir = existsSync(abs) ? undefined : firstMissingAncestor(abs);
    if (createdDir !== undefined) {
      expect(runner(writer!), `${writer} could not produce ${rel}`).toBe(true);
      abs = readPathAt(WORK, mountAbs, mounted);
      twinsBefore = abs !== mountAbs;
    }
    const original = readFileSync(abs, "utf-8");
    const staled = c.stale(original);
    expect(staled, `the fixture did not change ${rel}`).not.toBe(original);
    try {
      writeFileSync(abs, staled);
      // The control: without it a check that is ALWAYS green would pass this test.
      expect(runner(c.check), `${c.check} did not go red on a staled ${rel}`).toBe(false);
      const { results } = await regenPass([{ check: c.check, writer }], runner);
      // A check routed through publish-check runs the writer itself, so the
      // red run above already redrew the artefact and regen finds it
      // current. Either way the effect asserted below is the same: the
      // staled bytes are gone and the check is green.
      const repaired: Outcome[] = checkRunsItsWriter(c.check) ? ["regenerated", "current"] : ["regenerated"];
      // `unrepaired` means the check is still red after its writer ran. That
      // is this case's failure only if the stale was the cause: a check
      // already red on the clean tree (render:bpmn:check over every mounted
      // layer's diagrams, red on a layer main for a diagram this test never
      // touched, 2026-11-12) stays red whatever regen does, and the test then
      // flipped with that main rather than with the diff under review. So on
      // `unrepaired`, put the original back and ask again: still red means
      // the red is not the stale's, and what this case can still judge is
      // that the writer removed the staled bytes.
      let outcome = results[0]?.outcome;
      if (outcome === "unrepaired") {
        const at = readPathAt(WORK, mountAbs, mounted);
        const after = readFileSync(at, "utf-8");
        writeFileSync(at, original);
        const redWithoutStale = !(await runner(c.check));
        writeFileSync(at, after);
        if (redWithoutStale) outcome = repaired[0];
      }
      expect(repaired).toContain(outcome);
      expect(results[0]).toMatchObject({ check: c.check, writer });
      expect(readBack(), `${writer} left ${rel} staled`).not.toBe(staled);
    } finally {
      if (lockBefore !== undefined) writeFileSync(lockFile, lockBefore);
      if (createdDir !== undefined) rmSync(createdDir, { recursive: true, force: true });
      else writeFileSync(abs, original);
      // A writer that put a twin under the output root for this case takes it
      // away again, so the checkout is left as it was found.
      const twin = readPathAt(WORK, mountAbs, mounted);
      if (!twinsBefore && twin !== mountAbs) rmSync(twin, { force: true });
    }
  };
  const skip = (check: string): boolean => noCatAlias || (CASES.find((x) => x.check === check)?.needsBrowser === true && !browser);

  test.skipIf(skip("translate-bpmn:bootstrap:check"))(
    "translate-bpmn:bootstrap:check: red on a staled artefact, green after regen runs its writer",
    run("translate-bpmn:bootstrap:check"),
    120_000,
  );
  test.skipIf(skip("translate-bpmn:check"))(
    "translate-bpmn:check: red on a staled artefact, green after regen runs its writer",
    run("translate-bpmn:check"),
    120_000,
  );
  test.skipIf(skip("bat:sync:check"))(
    "bat:sync:check: red on a staled artefact, green after regen runs its writer",
    run("bat:sync:check"),
    120_000,
  );
  test.skipIf(skip("render:bpmn:check"))(
    "render:bpmn:check: red on a staled artefact, green after regen runs its writer",
    run("render:bpmn:check"),
    // Each render:bpmn:check draws every mounted layer's diagrams (47 s as a
    // gate on a CI runner, 2026-11-12), and this case runs it up to four
    // times: the red control, regen's check, regen's re-check, and the clean
    // re-check on `unrepaired`. 120 s timed out mid-regen.
    300_000,
  );
});
