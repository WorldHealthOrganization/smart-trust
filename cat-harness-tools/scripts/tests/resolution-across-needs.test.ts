/**
 * A reference resolves against this layer AND everything it `needs`.
 *
 * Both graphs: a `<skill ref>` against the reachable SKILLS, a `<role ref>` and
 * every RACI value against the reachable ROLE IDS. One file because it is one
 * rule with one direction — resolution follows `needs` downward — and splitting
 * it would let the two halves drift on the question they share.
 *
 * ## The defect this pins
 *
 * `kg-audit.ts` resolved every `<bootstrap.processes:skill ref>` against
 * `knownSkills(root)` — the audited layer's OWN skills and nothing else. A
 * skill that legitimately lives in a DEPENDENCY therefore dangled.
 *
 * Measured 2026-09-27, before the fix: `kg:audit --instance ./smart-base`
 * reported `skill-ref-resolves` **fail (9)** on nine activities of
 * `methodologies/processes/diig-investment-path.bpmn`. All nine named the one
 * skill `methodology-adoption`, which lives at
 * `cat-harness/skills/process/process-core/methodology-adoption.md` — four layers down
 * smart-base's own declared `needs` chain (`smart-base → fhir-harness →
 * folio-assistant-core → cat-harness → bootstrap`). Nine criticals against a
 * diagram that is correct.
 *
 * The auditor's own run already disagreed, in a committed artefact:
 * `cat-harness/test/results/kg-qa/_external/smart-base/…/diig-investment-path.kg-qa.json`
 * recorded `skill-ref-resolves` **pass (0)** for that same file (deleted 2026-10-01
 * as a duplicate of the owner's own verdict, Q-A PR 4), because from
 * the auditor's root the skill is local. **Two runs, one diagram, two answers**
 * — and the instance-scoped one was wrong.
 *
 * ## Why this is the FIFTH cross-instance defect and none of the first four
 *
 * The other four leaked things a layer should NOT see — a repository's
 * actors read as one layer's roles (73 false criticals), its capabilities,
 * 119 phantom tool sidecars, 23 skills from `.claude/skills/`. Every one was
 * fixed by NARROWING. This one is the opposite polarity: a layer could not
 * see what is legitimately BELOW it. No narrowing fix could find it, which is
 * exactly why it survived all four.
 *
 * ## Why an invariant and not the nine findings
 *
 * Asserting "smart-base reports zero" pins today's corpus: the diagram may be
 * edited, the skill may move, and the test then passes for the wrong reason.
 * The rule is that **no ref is reported dangling when the layer's own
 * `needs` closure holds it**, stated over every layer that declares one —
 * with an anti-vacuity floor, because on a corpus where every ref happens to
 * be local the invariant holds trivially and would keep passing through a
 * regression. That floor is the shape whose absence let the original defect
 * sit unnoticed.
 *
 * @module scripts/tests/resolution-across-needs
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { layerRootsIn, readDeclaration } from "../../schemas/kg/cat-harness.js";
import { readRoleGraph } from "../../schemas/process/role-graph.js";
import { orderedDependencies } from "../../schemas/kg/harness-config.js";
import { knownSkills } from "../known-skills.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

const REPO = resolve(dirname(HARNESS_ROOT));

/**
 * Every spawn below passes `--check`, and that is not a detail.
 *
 * Without it the audit WRITES: `kg-audit.ts` writes `skills/kg-qa.manifest.json`
 * into the audited layer unless `--check` is set, so a test that spawned it
 * across sixteen layers left sixteen untracked manifests behind — including
 * one in a `skills/` directory it created at the REPOSITORY ROOT, which
 * `check:undeclared-files` then fails on. A test that dirties the tree it is
 * judging is the defect `bun run cat gates` warns about in its own failure
 * summary, one level down.
 *
 * `--check --json` still emits the full report array, verified: 12 reports for
 * `smart-base` with `skill-ref-resolves` decided. It is the same choice
 * `no-silent-first-directory.test.ts` made, for the same reason.
 */
const WRITE_FREE = ["--check", "--json"] as const;

/**
 * Each audit this file reads is run ONCE, and they run side by side.
 *
 * The skill half and the role half judge the SAME report — `kg-audit
 * --instance X --check --json` — for overlapping sets of instances, and each
 * spawned it again, one layer after another. Measured 2026-10-03: one pass
 * over the 14 layers is 54 s locally (`./cat-harness` alone 16 s), the file
 * made two of them plus a default run, 123 s in all, and in CI it was 92 s of
 * the 223 s `bun test` shard 2/4 — the longest job in the workflow, and one no
 * shard split can shorten because a file is the unit a shard moves (bean `fmdl`).
 *
 * Memoised by argument list, so each test still reads exactly the output it
 * read before; and every layer's audit is STARTED on first use, under a
 * limit of one per core, rather than when its turn in a loop comes. Each spawn
 * is a separate process, `--check` writes nothing, and `bun test` runs this
 * file's tests one at a time, so the only contention is for cores — which is
 * what the limit is for.
 */
interface AuditRun { out: string; err: string }

const AUDITS = new Map<string, Promise<AuditRun>>();
const LIMIT = Math.max(1, availableParallelism());
let running = 0;
const waiting: (() => void)[] = [];

async function slot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= LIMIT) await new Promise<void>((go) => waiting.push(go));
  running++;
  try {
    return await work();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** The audit's stdout and stderr for these arguments, spawned at most once. */
function audit(args: readonly string[]): Promise<AuditRun> {
  const key = args.join("\0");
  let run = AUDITS.get(key);
  if (!run) {
    run = slot(async () => {
      const p = Bun.spawn(["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", ...args], {
        cwd: REPO,
        stdout: "pipe",
        stderr: "pipe",
      });
      const [out, err] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
      await p.exited;
      if (!out.trim()) AUDITS.delete(key);
      return { out, err };
    });
    AUDITS.set(key, run);
  }
  return run;
}

/** `kg-audit --instance <rel>`, write-free. */
const auditInstance = (rel: string) =>
  resolve(REPO, rel) === resolve(HARNESS_ROOT) ? audit(WRITE_FREE) : audit(["--instance", rel, ...WRITE_FREE]);

/**
 * Start every audit this file reads — each layer's and the default run's —
 * so they overlap; the tests then await the ones they judge.
 */
function startAudits(first: readonly string[] = []): void {
  // The pool runs at most LIMIT audits and queues the rest in the order they
  // are started, so the calling test's own subjects go first. Started in
  // INSTANCES order, the skill test could wait behind audits it never reads.
  // The rest still start here, so the later tests find them running.
  for (const inst of first) void auditInstance(`./${relative(REPO, inst)}`);
  void audit(WRITE_FREE);
  for (const inst of INSTANCES) void auditInstance(`./${relative(REPO, inst)}`);
}

/**
 * The skills a ref in `root` may resolve to — own plus every declared `needs`.
 *
 * Deliberately recomputed here from the same two published helpers the audit
 * uses, rather than imported from it: the audit's set is built at module scope
 * behind a `--instance` argument and is not exported, so there is nothing to
 * import. That does mean this shares `orderedDependencies` with the subject, so
 * it checks the audit's OUTPUT against the closure rather than proving the
 * closure itself — which is what {@link REACHES_DOWN} is the floor for.
 */
function closureSkills(root: string): Set<string> {
  const out = new Set(knownSkills(root));
  for (const dep of orderedDependencies(root)) {
    for (const s of knownSkills(dep.rootPath)) out.add(s);
  }
  return out;
}

/** Does this layer declare where it sits? Absent `needs` is UNDETERMINED, never `[]`. */
function declaresLayering(root: string): boolean {
  try {
    return readDeclaration(root)?.needs !== undefined;
  } catch {
    return false;
  }
}

const INSTANCES = layerRootsIn(REPO);

// No root-instance exclusion: `kg:audit --instance .` used to throw before
// auditing anything (bean `pgzn`), and this file excluded that layer by
// name. The audit now resolves its repository root through `checkoutRootFor`,
// so every declared layer — the one AT the checkout root included — is a
// subject here. `kg-audit-root-instance.test.ts` pins the crash itself.

/** A name no layer holds, used by the constructed third-state case below. */
const MISSING_SKILL = "a-skill-that-exists-nowhere";

/** Layers whose closure is strictly wider than their own skills. */
const REACHES_DOWN = INSTANCES.filter(
  (i) => declaresLayering(i) && closureSkills(i).size > knownSkills(i).size,
);

describe("skill refs resolve across the `needs` chain", () => {
  test("some instance's closure is strictly wider than its own skills", () => {
    // Anti-vacuity, and the floor the whole file rests on. Measured 2026-09-27:
    // smart-base 0 own → 287 in closure; folio-assistant-core 1 → 287;
    // cat-harness 280 → 287 (bootstrap's seven). With no such layer the
    // invariant below is about nothing.
    expect(
      REACHES_DOWN.length,
      "no instance reaches skills through `needs` — the invariant below measures nothing",
    ).toBeGreaterThan(0);
  });

  test("a skill held anywhere in an instance's `needs` closure is not reported dangling", async () => {
    const offences: string[] = [];
    startAudits(REACHES_DOWN);

    for (const inst of REACHES_DOWN) {
      const rel = `./${relative(REPO, inst)}`;
      const reachable = closureSkills(inst);

      const { out, err } = await auditInstance(rel);

      // A run that did not report cannot clear the layer — "could not
      // determine" is never a pass, so it is recorded as an offence of its own
      // rather than skipped.
      // `--json` emits `{ reports, stale }`; the subjects are under `reports`.
      let reports: { subject?: { id?: string }; criteria?: Record<string, { findings?: { detail?: string }[] }> }[];
      try {
        reports = (JSON.parse(out) as { reports?: typeof reports }).reports ?? [];
      } catch {
        offences.push(`${rel}: audit produced no JSON report:\n${err.slice(0, 300)}`);
        continue;
      }

      for (const r of reports) {
        for (const f of r.criteria?.["skill-ref-resolves"]?.findings ?? []) {
          // The finding names the skill in quotes; anything else is a different
          // finding and not this rule's business.
          const named = /names skill "([^"]+)"/.exec(f.detail ?? "")?.[1];
          if (named !== undefined && reachable.has(named)) {
            offences.push(
              `${rel} ${r.subject?.id ?? "?"}: "${named}" is in the \`needs\` closure but reported dangling`,
            );
          }
        }
      }
    }

    expect(offences).toEqual([]);
    // The first test to await the pool pays for it: one `kg:audit` per layer,
    // LIMIT at a time. At 240 s it timed out on a 4-core runner once the
    // largest layer's reference corpus grew (2026-11-12), flipping between NEW
    // and fixed on PRs that touch neither; the later tests reuse the runs.
  }, 480_000);

  /**
   * The third state, which is a rule rather than a courtesy — and which this
   * repository's own corpus is no longer allowed to exhibit.
   *
   * `needs` is OPTIONAL in the schema and an absent value is UNDETERMINED —
   * `[]` asserts this layer is the floor, absent is nobody having said
   * (`schemas/kg/cat-harness.ts`; `schemas/kg/layer-direction.ts` refuses the same
   * collapse for edges). Such a layer cannot have a ref judged dangling:
   * what it reaches was never declared, so the honest answer is `unknown`.
   * The constructed test below proves that mechanism on a layer it builds.
   *
   * **In THIS repository the state is now gated out.** Measured 2026-09-27,
   * 5 of 16 layers declared no `needs`; #1508 declared all five by hand,
   * which left this test's corpus half with no subjects and its anti-vacuity
   * floor red on `main`. The owner's ruling, 2026-09-30 (issue #1548): *"QA
   * gates on harness declaration of dependences"* — so `check:instance-graph`
   * now FAILS on an undeclared layer, and what this test asserts about the
   * corpus is that gated invariant, not the coincidence it used to depend on.
   * Should the gate ever be relaxed, the loop below judges whatever it lets in.
   */
  test("no instance here leaves `needs` undeclared (gated), and any that did would report unknown", async () => {
    const undeclared = INSTANCES.filter((i) => !declaresLayering(i));
    expect(
      undeclared.map((i) => relative(REPO, i)),
      "check:instance-graph requires every instance to declare `needs` (issue #1548)",
    ).toEqual([]);

    const offences: string[] = [];
    for (const inst of undeclared) {
      const rel = `./${relative(REPO, inst)}`;
      const { out } = await auditInstance(rel);

      let reports: { subject?: { id?: string }; criteria?: Record<string, { result?: string }> }[];
      try {
        reports = (JSON.parse(out) as { reports?: typeof reports }).reports ?? [];
      } catch {
        continue; // a layer with nothing to audit is not a counter-example
      }
      for (const r of reports) {
        const e = r.criteria?.["skill-ref-resolves"];
        if (e?.result === "fail") {
          offences.push(`${rel} ${r.subject?.id ?? "?"}: reported \`fail\` with no declared layering`);
        }
      }
    }
    expect(offences).toEqual([]);
  }, 240_000);

  /**
   * Resolution widened; OWNERSHIP did not.
   *
   * `manifest-skill-exists` and `remote-skill-is-servable` both ask whether
   * THIS layer holds a BODY for a name it publishes, and a dependency's
   * skill is not this layer's to serve — widening them would excuse exactly
   * the defect they exist to catch. Same split, same ruling (`pve3`, *"not in
   * my overlay is not does not exist"*), as `satisfiableSkills` in
   * `check-tools.ts`.
   *
   * Pinned at the SOURCE because the two criteria pass on this corpus either
   * way: nothing here publishes a manifest entry that only a dependency
   * satisfies, so a behavioural test would be vacuous today and silent when it
   * stopped being so.
   */
  test("the two ownership criteria still read the instance's own skills", () => {
    const src = readFileSync(resolve(REPO, "cat-harness-tools/scripts/kg-audit.ts"), "utf8");
    for (const criterion of ["manifest-skill-exists", "remote-skill-is-servable"]) {
      const at = src.indexOf(`"${criterion}"`);
      expect(at, `${criterion} is no longer declared — this guard is stale`).toBeGreaterThan(0);
      // The criterion's own block, bounded generously rather than parsed: the
      // filter that matters sits within a few lines of the declaration.
      const block = src.slice(at, at + 1600);
      expect(
        block,
        `${criterion} resolves against the \`needs\` closure — ownership must stay narrow`,
      ).not.toContain("resolvableSkills");
      expect(
        block.includes("!skills.has("),
        `${criterion} no longer reads the instance's own skill set`,
      ).toBe(true);
    }
  });

  /**
   * The third state, PROVED — by building the layer the corpus lacks.
   *
   * Two runs over one synthetic layer whose diagram names a skill nothing
   * holds. The only difference between them is its declaration:
   *
   * | `needs`   | result    | because                                    |
   * |-----------|-----------|--------------------------------------------|
   * | absent    | `unknown` | nobody said what this layer reaches     |
   * | `[]`      | `fail`    | it asserts it IS the floor, so nothing else holds the skill |
   *
   * That pair is the whole rule. A implementation that collapsed absent into
   * `[]` — the `?? []` that `dependenciesFromNeeds` does deliberately, for a
   * different question — passes every other test in this file and fails this
   * one, which is why it exists.
   *
   * Built under `tmpdir()` with its own `package.json`, following
   * `schemas/harness-config.test.ts`. The `package.json` is not decoration:
   * `kg-audit.ts` reads one from `resolve(root, "..")`, so a synthetic layer
   * needs a parent that has it — the same resolution that makes bean `pgzn`
   * crash on the repository-root layer.
   */
  describe("absent `needs` and `needs: []` are different answers", () => {
    let dir: string;
    let inst: string;

    /**
     * The declaration, with `needs` supplied or deliberately omitted.
     *
     * **Not named `declare`.** It was, and every call VANISHED: `declare` is a
     * TypeScript keyword, so `declare([]);` at statement position parses as an
     * ambient declaration and the transpiler erases it. Both tests below then
     * ran against a layer with NO declaration file at all — which reads
     * `needs` as `undefined` and so reported `unknown`, making the absent-needs
     * case pass for entirely the wrong reason. That is why each case reads its
     * declaration back before asserting.
     */
    const writeDeclaration = (needs: string[] | undefined): void => {
      writeFileSync(
        join(inst, "inst.json"),
        JSON.stringify(
          {
            name: "inst",
            version: "0.0.1",
            title: "Synthetic instance",
            description: "Names one skill that nothing anywhere holds.",
            // Spread, so an absent `needs` is genuinely ABSENT from the JSON
            // rather than present as `null` — which the schema would reject and
            // which is a third thing again.
            ...(needs === undefined ? {} : { needs }),
            directories: [{ id: "processes", path: "processes/", graphTypologies: ["processes"] }],
          },
          null,
          2,
        ),
      );
    };

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), "needs-third-state-"));
      inst = join(dir, "inst");
      mkdirSync(join(inst, "processes"), { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "synth-repo", scripts: {} }));
      // A LOADABLE diagram: `skill-ref-resolves` is `unknown` for a diagram that
      // will not parse, which would make either expectation below pass for the
      // wrong reason. Start event, user task, end event, both flows.
      writeFileSync(
        join(inst, "processes", "p.bpmn"),
        `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/"
                  id="Defs_1" targetNamespace="http://example.com/synth">
  <bpmn:process id="Process_Synth" isExecutable="true">
    <bpmn:startEvent id="S_1" name="Start"><bpmn:outgoing>F_1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:userTask id="A_Do" name="Do the thing">
      <bpmn:extensionElements>
        <bootstrap.processes:skill ref="${MISSING_SKILL}"/>
      </bpmn:extensionElements>
      <bpmn:incoming>F_1</bpmn:incoming><bpmn:outgoing>F_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="E_1" name="Done"><bpmn:incoming>F_2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F_1" sourceRef="S_1" targetRef="A_Do"/>
    <bpmn:sequenceFlow id="F_2" sourceRef="A_Do" targetRef="E_1"/>
  </bpmn:process>
</bpmn:definitions>
`,
      );
    });

    afterAll(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    /** `skill-ref-resolves` for the synthetic process, as the audit reports it. */
    async function audit(): Promise<{ result?: string; findings?: { detail?: string }[] }> {
      const p = Bun.spawn(
        ["bun", "run", "cat-harness-tools/scripts/kg-audit.ts", "--instance", inst, ...WRITE_FREE],
        { cwd: REPO, stdout: "pipe", stderr: "pipe" },
      );
      const out = await new Response(p.stdout).text();
      const err = await new Response(p.stderr).text();
      await p.exited;

      let reports: { subject?: { id?: string }; criteria?: Record<string, { result?: string; findings?: { detail?: string }[] }> }[];
      try {
        reports = (JSON.parse(out) as { reports?: typeof reports }).reports ?? [];
      } catch {
        throw new Error(`the audit produced no JSON report:\n${err.slice(0, 800)}`);
      }
      const r = reports.find((x) => x.subject?.id === "Process_Synth");
      expect(r, `no report for Process_Synth in ${reports.length} report(s)`).toBeDefined();
      return r!.criteria?.["skill-ref-resolves"] ?? {};
    }

    test("no declared `needs` — the ref is unknown, not a failure", async () => {
      writeDeclaration(undefined);
      // Read back, for the reason on `writeDeclaration`: a missing FILE and a
      // file missing `needs` both read as `undefined`, and only one of them is
      // what this test is about.
      const onDisk = readFileSync(join(inst, "inst.json"), "utf8");
      expect(onDisk, `declaration did not land:\n${onDisk}`).toContain('"name": "inst"');
      expect(onDisk, `\`needs\` should be ABSENT here:\n${onDisk}`).not.toContain('"needs"');
      const e = await audit();
      expect(e.result).toBe("unknown");
      // The message must say WHY, or the verdict sends nobody anywhere.
      expect(e.findings?.[0]?.detail ?? "").toContain("declares no `needs`");
    }, 60_000);

    test("`needs: []` — the same ref is a failure, because the floor is asserted", async () => {
      writeDeclaration([]);
      // The declaration is the only variable between this case and the one
      // above, so it is read back rather than assumed: a `writeDeclaration` that did not
      // land would make this test report the OTHER state's answer.
      const onDisk = readFileSync(join(inst, "inst.json"), "utf8");
      expect(onDisk, `\`needs\` missing from the declaration:\n${onDisk}`).toContain('"needs": []');
      const e = await audit();
      expect(e.result).toBe("fail");
      expect(e.findings?.[0]?.detail ?? "").toContain("no skill in this instance or anything it `needs`");
    }, 60_000);
  });
});

/* ─────────────── the same rule, over the ROLE graph ─────────────── */

/**
 * Role IDS reachable from `root` — its own graph's, plus every dependency's.
 *
 * Recomputed here from the published readers rather than imported, for the same
 * reason {@link closureSkills} is.
 */
function closureRoleIds(root: string): Set<string> {
  const out = new Set<string>();
  const add = (dir: string): void => {
    try {
      for (const r of readRoleGraph(dir)?.roles ?? []) out.add(r.id);
    } catch {
      // An unreadable graph is not this test's subject.
    }
  };
  add(join(root, "scenarios"));
  add(join(root, "skills"));
  for (const dep of orderedDependencies(root)) {
    add(join(dep.rootPath, "scenarios"));
    add(join(dep.rootPath, "skills"));
  }
  return out;
}

describe("role refs resolve across the `needs` chain", () => {
  /**
   * The measured case, and why the role half is not a footnote.
   *
   * After the skill half landed, 11 of 13 nested layers reported ZERO
   * criticals and two did not: `smart-base` and `folio-assistant-core`, on
   * `role-ref-resolves` and `raci-role-resolves`. Their diagrams name
   * `business-analyst`, `programme-manager` and `deep-researcher` — all three
   * defined in `cat-harness/scenarios/roles.json`, a transitive dependency of
   * both. Only bootstrap (4 roles) and cat-harness (48) declare a role graph at
   * all, so every other layer's references necessarily resolve downward or
   * not at all.
   */
  test("a role held anywhere in the `needs` closure is not reported dangling", async () => {
    const offences: string[] = [];
    startAudits();
    for (const inst of INSTANCES) {
      const rel = `./${relative(REPO, inst)}`;
      const reachable = closureRoleIds(inst);
      if (reachable.size === 0) continue; // nothing to resolve against

      const { out } = await auditInstance(rel);
      let reports: { subject?: { id?: string }; criteria?: Record<string, { findings?: { detail?: string }[] }> }[];
      try {
        reports = (JSON.parse(out) as { reports?: typeof reports }).reports ?? [];
      } catch {
        offences.push(`${rel}: no JSON report`);
        continue;
      }
      for (const r of reports) {
        for (const f of r.criteria?.["role-ref-resolves"]?.findings ?? []) {
          const named = /binds role "([^"]+)"/.exec(f.detail ?? "")?.[1];
          if (named !== undefined && reachable.has(named)) {
            offences.push(`${rel} ${r.subject?.id ?? "?"}: "${named}" is reachable but reported dangling`);
          }
        }
      }
    }
    expect(offences).toEqual([]);
  }, 240_000);

  test("some instance resolves a role ONLY through its dependencies", () => {
    // Anti-vacuity. Measured: smart-base and folio-assistant-core declare no
    // role graph at all, so all of their reachable ids come from below.
    const downward = INSTANCES.filter((i) => {
      const own = new Set<string>();
      for (const d of ["scenarios", "skills"]) {
        try {
          for (const r of readRoleGraph(join(i, d))?.roles ?? []) own.add(r.id);
        } catch { /* not the subject */ }
      }
      return closureRoleIds(i).size > own.size;
    });
    expect(
      downward.length,
      "no instance reaches roles through `needs` — the invariant above measures nothing",
    ).toBeGreaterThan(0);
  });

  /**
   * RESOLUTION widened; SUBJECTHOOD did not — and this is the test that earns
   * its place, because the alternative design fails exactly here.
   *
   * The audit emits one SUBJECT per role in the graph. Overlaying the
   * `RoleGraph` OBJECT rather than its ids would give cat-harness's run
   * bootstrap's 4 roles as 4 extra subjects — for roles bootstrap's own run
   * already audits — which duplicates a dependency's subjects into its
   * dependent and is what `instance-graph-isolation.test.ts` forbids.
   *
   * So the default run's role count must equal cat-harness's OWN role count,
   * never its closure's. Measured 2026-09-27: own 48, closure 52.
   */
  test("the audit's role SUBJECTS are the instance's own, not its closure's", async () => {
    const auditor = join(REPO, "cat-harness");
    const own = new Set<string>();
    for (const r of readRoleGraph(join(auditor, "scenarios"))?.roles ?? []) own.add(r.id);
    const closure = closureRoleIds(auditor);
    expect(
      closure.size,
      "cat-harness's closure adds no roles — this guard cannot distinguish the two designs",
    ).toBeGreaterThan(own.size);

    const { out } = await audit(WRITE_FREE);
    const reports = (JSON.parse(out) as { reports?: { subject?: { kind?: string } }[] }).reports ?? [];
    const roleSubjects = reports.filter((r) => r.subject?.kind === "role").length;
    expect(
      roleSubjects,
      `the run audits ${roleSubjects} role subjects; cat-harness declares ${own.size} and its closure holds ` +
        `${closure.size}. A count matching the closure means the overlay reached subjecthood.`,
    ).toBe(own.size);
  }, 240_000);
});
