/**
 * QA criterion scoping by content PROFILE — the second axis, beside adapters.
 *
 * `adapterForKind("prose")` is `"paper"`, and correctly so: profiles nest
 * inside one adapter's vocabulary, so a document folio's prose block is a
 * paper-adapter kind and sails through the adapter gate. Which meant every
 * document-profile block inherited the paper adapter's LaTeX- and
 * Lean-shaped criteria. Measured on `docs/source/crdm-methodology`
 * (2026-09-18, sidecars removed first so nothing was `fresh-skip`):
 * 328 pass / 8 fail / 336 n/a, and **five of the eight failures** were
 * `voice-unicode-crash` — a criterion whose own description says the
 * characters "crash pdflatex" — firing on prose in a folio whose render path
 * never invokes latexmk.
 *
 * Two properties are load-bearing and both are asserted here, in both
 * directions, because the second one fails INVISIBLY:
 *
 * 1. An opted-out criterion is `n/a`'d in a document folio, under its own
 *    outcome string — not the adapter's.
 * 2. An **unannotated** criterion still runs there. `profiles` defaults to
 *    every profile, the opposite of `adapters`; had it defaulted narrow like
 *    `adapters` does, ~110 criteria would have stopped running on document
 *    folios and reported the silence as a clean sweep. A wrong `fail` gets
 *    argued with; a wrong `pass` gets believed.
 *
 * 3. And "could not determine" is a third state that RUNS the criterion. A
 *    folio with no readable `harness.config.json` must not lose coverage
 *    because a tool could not read its configuration.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { spawnSync } from "child_process";

import {
  criterionProfiles,
  criterionAdapters,
  profileExcludesCriterion,
} from "../../schemas/sdlc/block-qa.ts";
import { CONTENT_PROFILES, CONTENT_ADAPTERS } from "../../schemas/content/block-kinds.ts";
import { QA_CRITERIA_REGISTRY } from "../../pipeline/qa-criteria-registry";
import { readDeclaredFolioProfile, readFolioProfile } from "../../pipeline/profile-check";
import { initFolio, templatesDirs } from "../init-folio";
import { notApplicableAlone } from "../../test/support/checkout.js";
import { writeInstanceConfig } from "../../test/support/instance-fixture.js";
import { TOOLS_ROOT } from "../lib/roots.ts";

const SWEEP = join(TOOLS_ROOT, "pipeline", "qa-sweep.ts");

/** A criterion that opts out of the document profile, and one that does not. */
const PAPER_ONLY = "voice-unicode-crash";
const EVERY_PROFILE = "voice-status-leak";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

// ── Unit: the scope helpers ──────────────────────────────────────

describe("criterionProfiles — the default runs the other way from adapters", () => {
  test("absent means EVERY profile, not one of them", () => {
    // The single most consequential line in this change. `criterionAdapters`
    // defaults narrow because adapters partition; this defaults wide because
    // profiles nest and every existing criterion was written against the
    // document vocabulary with the math kinds as an addition.
    expect(criterionProfiles({})).toEqual(CONTENT_PROFILES);
    expect(criterionAdapters({})).toEqual([...CONTENT_ADAPTERS]);
  });

  test("an explicit scope is honoured", () => {
    expect(criterionProfiles({ profiles: ["paper"] })).toEqual(["paper"]);
    expect(criterionProfiles({ profiles: ["document"] })).toEqual(["document"]);
  });

  test("every criterion resolves to a non-empty scope", () => {
    for (const def of QA_CRITERIA_REGISTRY) {
      expect({ id: def.id, n: criterionProfiles(def).length > 0 }).toEqual({
        id: def.id,
        n: true,
      });
    }
  });

  test("the axis is an opt-out for a minority, not a re-scoping of the registry", () => {
    // The falsification condition stated when this was designed: if MOST
    // criteria needed `profiles: ["paper"]`, the default was wrong and the
    // axis should have defaulted narrow like `adapters`. It did not — so this
    // pins that the registry stays overwhelmingly profile-agnostic, and a
    // change that quietly opts half of it out has to argue with this test.
    const optedOut = QA_CRITERIA_REGISTRY.filter((d) => d.profiles !== undefined);
    expect(optedOut.length).toBeGreaterThan(0);
    expect(optedOut.length * 4).toBeLessThan(QA_CRITERIA_REGISTRY.length);
  });

  test("an opted-out criterion names `paper`, never `document` alone", () => {
    // A document-only criterion would be a different thing entirely — a rule
    // that a paper folio is exempt from — and nothing in the registry is one.
    // Left unasserted, `profiles: ["document"]` would be a silent way to
    // switch a criterion off for every paper folio in existence.
    for (const def of QA_CRITERIA_REGISTRY) {
      if (!def.profiles) continue;
      expect({ id: def.id, p: def.profiles }).toEqual({ id: def.id, p: ["paper"] });
    }
  });

  test("profiles and adapters stay orthogonal", () => {
    // Conflating them is the documented trap. A criterion scoped to the `dak`
    // adapter must not also be carrying a profile opt-out: profiles restrict
    // the PAPER adapter's vocabulary and say nothing about WHO L2/L3 kinds,
    // so the pair would read as a constraint that cannot be satisfied.
    for (const def of QA_CRITERIA_REGISTRY) {
      if (CONTENT_ADAPTERS.some((a) => criterionAdapters(def).includes(a))) continue;
      expect({ id: def.id, p: def.profiles }).toEqual({ id: def.id, p: undefined });
    }
    // And neither axis leaked into the other's value space.
    // One name sits on both axes on purpose: `paper` while it named the one
    // vocabulary, `document` since the split (bean bzwk) — never both, never another.
    const both = CONTENT_PROFILES.filter((p) => (CONTENT_ADAPTERS as readonly string[]).includes(p));
    expect(both.length).toBeLessThanOrEqual(1);
    for (const p of both) expect(["paper", "document"]).toContain(p);
  });
});

describe("profileExcludesCriterion — the third state", () => {
  test("excludes an opted-out criterion from a document folio", () => {
    expect(profileExcludesCriterion({ profiles: ["paper"] }, "document")).toBe(true);
  });

  test("never excludes an unannotated criterion", () => {
    expect(profileExcludesCriterion({}, "document")).toBe(false);
    expect(profileExcludesCriterion({}, "paper")).toBe(false);
  });

  test("an UNDETERMINED profile runs the criterion, it does not skip it", () => {
    // Not symmetry for its own sake: this is the difference between "this
    // folio is a document, so the TeX criterion does not apply" and "I could
    // not read this folio's config, so I skipped a critical check and
    // reported a clean sweep". Only the first is a verdict.
    expect(profileExcludesCriterion({ profiles: ["paper"] }, undefined)).toBe(false);
    expect(profileExcludesCriterion({ profiles: ["document"] }, undefined)).toBe(false);
  });
});

describe("readDeclaredFolioProfile — undetermined is not `paper`", () => {
  function folio(config?: string): string {
    const d = mkdtempSync(join(tmpdir(), "profile-scope-"));
    dirs.push(d);
    if (config !== undefined) writeInstanceConfig(d, config);
    return d;
  }

  test("a declared contentType resolves, and says where from", () => {
    const d = folio('{"contentType":"document"}');
    expect(readDeclaredFolioProfile(d).profile).toBe("document");
    expect(readDeclaredFolioProfile(d).declaredBy).toContain('contentType: "document"');
  });

  test("no config, no contentType, and unparseable config are all undetermined", () => {
    expect(readDeclaredFolioProfile(folio()).profile).toBeUndefined();
    expect(readDeclaredFolioProfile(folio("{}")).profile).toBeUndefined();
    expect(readDeclaredFolioProfile(folio("{ not json")).profile).toBeUndefined();
    for (const c of [undefined, "{}", "{ not json"]) {
      expect(readDeclaredFolioProfile(folio(c)).declaredBy).toContain("undetermined");
    }
  });

  test("the validator-facing reader still resolves undetermined to paper", () => {
    // Two callers, two right answers. `readFolioProfile` answers "may this
    // folio contain this block?", where the wider vocabulary is safe; the
    // declared reader answers "may I skip this check?", where it is not.
    expect(readFolioProfile(folio()).profile).toBe("paper");
    expect(readFolioProfile(folio()).declaredBy).toContain("default");
  });
});

// ── End to end: the sweep itself ─────────────────────────────────

/**
 * Outcome of every criterion for one block, as the sweep reports it.
 *
 * ## Why this records the child on EVERY run, including passes
 *
 * It SPAWNS the real sweep script against a temporary folio, so its verdict
 * depends on a separate process whose only trace used to be `res.stdout`. The
 * record is written unconditionally rather than on failure, because writing it
 * only when something looks wrong is what makes the next occurrence need a
 * reproduction: by the time an assertion fails, the process is gone.
 *
 * **The question it was opened for has since been ANSWERED, by `sff8` (#1447),
 * and the docblock said otherwise until this merge.** It claimed a failure in
 * this file was reproducible only inside a full `bun test`, that five attempts
 * across two sessions had produced the test NAME and nothing else, and that it
 * was still unknown whether the child reported a different OUTCOME or FAILED
 * with its reason discarded. `sff8` measured it with `--reporter=junit`: the
 * four end-to-end tests were **4.0s of their own work**, sitting at 77-82 % of a
 * 5s budget in a quiet process, so ordinary jitter crossed it. Not contention,
 * not an outcome mismatch, and not a discarded child failure. The hoist to
 * module scope below is that fix, and it is why the timeout no longer fires.
 *
 * So this stays for the case it still covers rather than the one it was built
 * for: a child that dies for any OTHER reason. `signal` is the discriminator —
 * a timeout reports status `null`, which reads as "no status" rather than
 * "killed" — and the third state below is a zero exit whose stdout is not JSON.
 * That is bean `y0n2`'s defect avoided in a second place: there a `catch` turned
 * "the tool could not answer" into a verdict; here silence turned it into an
 * absence.
 *
 * `console.error`, not `console.log`, so the line survives a `--json` consumer
 * reading stdout.
 */
function sweepOutcomes(root: string, blockRoot: string): Record<string, string> {
  const res = spawnSync(
    "bun",
    ["run", SWEEP, blockRoot + ".ts", "--dry-run", "--json"],
    { cwd: root, encoding: "utf-8", timeout: 600_000 },
  );
  // `signal` is the timeout case, which reports status `null` and would
  // otherwise read as "no status" rather than "killed at 600s".
  const stderr = (res.stderr ?? "").trim();
  console.error(
    `  · qa-sweep: status=${res.status} signal=${res.signal ?? "-"} ` +
      `stdout=${(res.stdout ?? "").length}B stderr=${stderr.length}B` +
      (stderr ? `\n    stderr: ${stderr.split("\n").slice(0, 6).join("\n    ")}` : ""),
  );
  if (res.status !== 0) {
    throw new Error(`qa-sweep exited ${res.status} (signal ${res.signal ?? "-"})\n${stderr}`);
  }
  let report: { results: Array<{ details: Array<{ criterion: string; outcome: string }> }> };
  try {
    report = JSON.parse(res.stdout) as typeof report;
  } catch (e) {
    // A zero exit with unparseable stdout is a THIRD state, and it used to
    // surface as a bare `SyntaxError` naming neither the child nor its output.
    throw new Error(
      `qa-sweep exited 0 but its stdout is not JSON (${e instanceof Error ? e.message : String(e)})\n` +
        `first 400B of stdout: ${(res.stdout ?? "").slice(0, 400)}\nstderr: ${stderr}`,
    );
  }
  // A THROW rather than `expect`, because this now runs at module scope where
  // `expect` is not available. The check itself is load-bearing and stays: a
  // sweep that reported two blocks, or none, would make every outcome lookup
  // below read from the wrong place, or from undefined.
  if (report.results.length !== 1) {
    throw new Error(`qa-sweep reported ${report.results.length} block(s), expected exactly 1`);
  }
  return Object.fromEntries(report.results[0].details.map((d) => [d.criterion, d.outcome]));
}

/**
 * The end-to-end sweeps, run ONCE at module scope — `vxho`'s fix, applied here
 * on its own measurement rather than by analogy.
 *
 * ## Why, with the numbers
 *
 * Each of the four tests below used to call `sweepOutcomes`, and each call
 * `spawnSync`s a whole `bun` process that imports the QA pipeline. Measured
 * 2026-09-27 with `--reporter=junit` (bean `sff8`): the four tests took
 * **4013, 4015, 4049 and 4061 ms** — that is **77-82 % of the 5000 ms per-test
 * budget**, and any jitter crossed it. Four distinct test names have failed this
 * way across runs of one commit.
 *
 * **The inflation factor is 1.0x, not the ~35x this was assumed to be.** Isolated
 * and inside the full 533-file suite the same tests measure within noise of each
 * other, and `--smol` (which this container sets and CI does not) changes nothing:
 * suite totals 308 s against 303 s. So the cost is not contention for a disk — it
 * is four process spawns sitting INSIDE four per-test budgets.
 *
 * Hoisting them out is the whole fix. Module-scope work belongs to no test's
 * timeout, so the tests become assertions on captured data and the wall-clock cost
 * is paid once, at import. THREE sweeps cover FOUR tests: the first two scaffold
 * an identical document folio and only assert different things about it.
 *
 * Each case removes its own temp directory as soon as its outcomes are captured —
 * the `afterEach` above drains `dirs` for the OTHER describe, and a module-scope
 * directory pushed there would be deleted after the first test while later tests
 * still needed it.
 */
function sweepOnce(
  contentType: "paper" | "document",
  corruptConfig = false,
): { out: Record<string, string>; profileAfterCorruption?: undefined | ReturnType<typeof readDeclaredFolioProfile>["profile"]; configText?: string } {
  const d = mkdtempSync(join(tmpdir(), `profile-sweep-${contentType}-`));
  try {
    initFolio({
      targetDir: d,
      contentType,
      slug: "cold-chain-guidance",
      title: "Cold Chain Guidance",
      authors: ["A. Author"],
      link: "sibling",
      assistantPath: "folio-assistant",
      skipVcs: true,
    });
    const blockRoot = join(d, "folio", "cold-chain-guidance", "introduction", "overview");
    let configText: string | undefined;
    let profileAfterCorruption: ReturnType<typeof readDeclaredFolioProfile>["profile"] | undefined;
    if (corruptConfig) {
      // The scaffold's config is INLINE in its `index.config.json` entry
      // (bean `ymvt`: `folio_init` writes no `<slug>.config.json`), so the
      // index is the config this case corrupts.
      const configPath = join(d, "index.config.json");
      configText = readFileSync(configPath, "utf-8");
      // Corrupted rather than deleted, because deleting it also removes the
      // marker `findContentRepoRoot` walks up to — and a test that changed two
      // things at once would not show which one the gate reacted to.
      appendFileSync(configPath, "\n{ truncated", "utf-8");
      profileAfterCorruption = readDeclaredFolioProfile(d).profile;
    }
    return { out: sweepOutcomes(d, blockRoot), profileAfterCorruption, configText };
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

const DOCUMENT_SWEEP = sweepOnce("document");
/**
 * A paper folio's templates include the `paper` profile, which a layer ABOVE
 * this one holds (folio-assistant-sci, move M11): standing alone there is no
 * paper folio to scaffold, so its sweep is not applicable (bean w1gy F18), as
 * in `init-folio.test.ts`. A templates lookup that throws guards nothing.
 */
const NO_PAPER_PROFILE = ((): boolean => {
  let held: boolean;
  try {
    held = templatesDirs().some((d) => existsSync(join(d, "paper")));
  } catch {
    return false;
  }
  return !held && notApplicableAlone("the `paper` folio-template profile, which folio-assistant-sci (a higher instance) holds");
})();
const PAPER_SWEEP = NO_PAPER_PROFILE ? { out: {} as Record<string, string> } : sweepOnce("paper");
const CORRUPTED_SWEEP = sweepOnce("document", true);

describe("the sweep's profile gate, end to end", () => {
  // Every test here asserts on a sweep captured at module scope — see
  // `sweepOnce`. They used to run the sweep themselves at ~4.0 s each against a
  // 5.0 s budget (bean `sff8`).
  test("a paper-only criterion is n/a'd in a document folio, under its OWN outcome", () => {
    const out = DOCUMENT_SWEEP.out;
    expect(out[PAPER_ONLY]).toBe("n/a-wrong-profile");
    // Not the adapter's string. A downstream reader — the per-block QA icons
    // this was built for — has to be able to say WHICH axis excluded it:
    // "wrong vocabulary" and "this folio takes no TeX" call for different
    // follow-up, and one shared string cannot carry both.
    expect(out[PAPER_ONLY]).not.toBe("n/a-wrong-adapter");
  });

  test("an automated:false criterion scoped to paper is n/a'd in a document folio, not needs-agent (nba0)", () => {
    const out = DOCUMENT_SWEEP.out;
    expect(out["da-lean-narrative-divergence"]).toBe("n/a-wrong-profile");
    expect(out["da-lean-narrative-divergence"]).not.toBe("needs-agent");
  });

  test("an UNANNOTATED criterion still runs in a document folio", () => {
    // The assertion that catches the false-pass regression. If `profiles`
    // ever defaults narrow, or a bulk annotation sweeps the registry, this is
    // where it shows up — and nowhere else, because the symptom of the bug is
    // silence.
    //
    // The SAME sweep as the test above: an identical document folio, asserted
    // differently. That is why three sweeps cover four tests.
    const out = DOCUMENT_SWEEP.out;
    expect(out[EVERY_PROFILE]).toBeDefined();
    expect(out[EVERY_PROFILE]).not.toBe("n/a-wrong-profile");
    // And the gate is narrow in fact, not just in principle: the great
    // majority of what the sweep considered still got considered.
    const excluded = Object.values(out).filter((o) => o === "n/a-wrong-profile").length;
    expect(excluded * 4).toBeLessThan(Object.keys(out).length);
  });

  test.skipIf(NO_PAPER_PROFILE)("the same criterion runs in a paper folio — the gate is profile-driven", () => {
    // Without this, a criterion that had simply stopped working everywhere
    // would pass the document-folio assertion above.
    const out = PAPER_SWEEP.out;
    expect(out[PAPER_ONLY]).not.toBe("n/a-wrong-profile");
    expect(out[EVERY_PROFILE]).not.toBe("n/a-wrong-profile");
  });

  test("a folio whose config cannot be read keeps its coverage", () => {
    // Third state, end to end. The corruption and the pre-sweep read both happen
    // in `sweepOnce`, because the sweep has to see the corrupted config — so what
    // that step OBSERVED is carried out here rather than re-derived, and both
    // halves are still asserted: the config really said `document` before it was
    // truncated, and the profile really became undetermined after.
    expect(CORRUPTED_SWEEP.configText).toContain("document");
    expect(CORRUPTED_SWEEP.profileAfterCorruption).toBeUndefined();
    for (const outcome of Object.values(CORRUPTED_SWEEP.out)) {
      expect(outcome).not.toBe("n/a-wrong-profile");
    }
  });
});
