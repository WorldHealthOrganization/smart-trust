/**
 * Judge mode — every writer-only gate can FAIL on what it computes, and its
 * gate form writes nothing. Bean `bo44` (arc `3fva`, proposal
 * `qa-reports-branch-and-test-process` §2.3 and §4.3).
 *
 * Nine producers were found to write their own QA sidecar whenever they ran,
 * which made the gate CI ran also the writer of the record it reported into.
 * Each now has a `--check` form that COMPUTES AND JUDGES — never "compares with
 * the committed file", because that file leaves `main` with the arc — and
 * exits on bean `bo44`'s four-state table: 0 ok · 1 finding · 2 unknown or
 * error.
 *
 * Two directions per producer, because a test that only ever sees a clean
 * corpus has not shown the gate can fail:
 *
 * - **corrupted input → exit 1.** The producer's own check function is run
 *   over a fixture with the defect planted, and its judgement maps to 1.
 * - **clean → exit 0 and NO tracked-file change.** The CLI is spawned in judge
 *   mode against this checkout; the sidecar's bytes and `git status` must be
 *   identical afterwards. Where the checkout itself carries a real finding
 *   today (see the per-test notes), the clean exit is shown on a fixture and
 *   the CLI half asserts only that judging wrote nothing and agreed with the
 *   in-process judgement.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  JUDGEMENT_EXIT,
  concludeJudgement,
  judgeUsage,
  judgementOf,
  qaResultPath,
  unknownFlags,
  type Judgement,
} from "../../qa-results.ts";
import { checkWireframes, judgeWireframes, type WireframeReport } from "../../check-wireframes.ts";
import { checkLayoutNorms, judgeLayoutNorms } from "../../check-layout-norms.ts";
import { checkRenderedLabels, judgeRenderedLabels } from "../../check-rendered-labels.ts";
import { checkSourceLicence, judgeSourceLicence } from "../../check-source-licence.ts";
import { checkMethodologyEvidence, judgeMethodologyEvidence } from "../../check-methodology-evidence.ts";
import { checkLanes, judgeLaneDocumentation } from "../../check-lane-documentation.ts";
import { judgeKgExport } from "../../kg-export.ts";
import { coverage, judgeAvatarCoverage, trashDerivationPresent } from "../../check-avatar-coverage.ts";
import { renderAvatarsCss } from "../../gen-avatars-css.ts";
import {
  healthProducerCurrent,
  interactionProfilesRead,
  issueMarkEdits,
  judgeHarnessState,
  todoProcessRefs,
  type Family,
} from "../../check-harness-state.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { implementingRootFor } from "../../../schemas/kg/harness-config.ts";

// The harness owns the sidecars and baselines; this test moved up in 70lx B2b.
const INSTANCE_ROOT = HARNESS_ROOT;
const REPO_ROOT = resolve(INSTANCE_ROOT, "..");

/** The exit code a judge run ends in for this judgement — the CLI's `process.exit` argument. */
const exitOf = (j: Judgement): number => JUDGEMENT_EXIT[j];

function tmp(prefix: string): string {
  return mkdtempSync(join(tmpdir(), `judge-${prefix}-`));
}

function gitStatus(): string {
  return spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  }).stdout;
}

/**
 * Run a script in judge mode against this checkout and report what it did.
 * The sidecar's BYTES are compared, not only `git status`: a sidecar that was
 * already dirty before the run would hide a second write from a status diff.
 */
function judgeRun(
  script: string,
  stem: string,
  extra: string[] = [],
  flag = "--check",
): { exit: number | null; wrote: boolean; out: string } {
  const sidecar = qaResultPath(INSTANCE_ROOT, stem);
  const before = existsSync(sidecar) ? readFileSync(sidecar, "utf-8") : undefined;
  const statusBefore = gitStatus();
  const r = spawnSync("bun", ["run", join(implementingRootFor(INSTANCE_ROOT, `scripts/${script}`), "scripts", script), flag, ...extra], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    timeout: 120_000,
  });
  const after = existsSync(sidecar) ? readFileSync(sidecar, "utf-8") : undefined;
  return { exit: r.status, wrote: before !== after || statusBefore !== gitStatus(), out: `${r.stdout}${r.stderr}` };
}

describe("the shared judge (qa-results.ts)", () => {
  test("four states, one exit table — could-not-determine is never 0", () => {
    expect(JUDGEMENT_EXIT).toEqual({ ok: 0, finding: 1, unknown: 2, error: 2 });
    expect(judgementOf({ failing: 0 })).toBe("ok");
    expect(judgementOf({ failing: 3 })).toBe("finding");
    expect(judgementOf({ failing: 0, undetermined: true })).toBe("unknown");
    // A blind spot outranks a finding beside it.
    expect(judgementOf({ failing: 3, undetermined: true })).toBe("unknown");
  });

  test("an unknown flag is a usage error (2), so a typo never runs the WRITER", () => {
    expect(unknownFlags(["--check", "--chek"], [])).toEqual(["--chek"]);
    expect(unknownFlags(["--check", "--strict", "positional"], ["--strict"])).toEqual([]);
    expect(judgeUsage("x", ["--check", "--update"], [])).toBe(2);
    expect(judgeUsage("x", ["--check"], [])).toBeUndefined();
  });

  test("concludeJudgement returns the table's exit and writes nothing", () => {
    const dir = tmp("conclude");
    try {
      const fresh = {
        $schema: "qa-results/v1" as const,
        producer: { script: "s", script_hash: "h" },
        subject: { kind: "k", id: "i" },
        families: {},
        total: 0,
      };
      const exit = concludeJudgement({
        gate: "t",
        judgement: "finding",
        committed: { root: dir, stem: "nothing-here", fresh, writer: "t" },
      });
      expect(exit).toBe(1);
      // The advisory reads the committed copy; it must not create one.
      expect(existsSync(qaResultPath(dir, "nothing-here"))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("check:wireframes", () => {
  test("CORRUPTED: a wireframe with no intent and a ref nothing declares → exit 1", () => {
    const dir = tmp("wireframes");
    try {
      mkdirSync(join(dir, "ghost"), { recursive: true });
      writeFileSync(join(dir, "index.json"), JSON.stringify({ wireframes: { ghost: { covers: ["no/such/ref.html"] } } }));
      const r = checkWireframes(REPO_ROOT, dir);
      expect(r.unknownRef.length).toBeGreaterThan(0);
      expect(exitOf(judgeWireframes(r))).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("clean report → 0; nothing declared → 2", () => {
    const clean: WireframeReport = {
      declared: ["a"],
      covered: [{ ref: "a", wireframe: "w" }],
      uncovered: [],
      unknownRef: [],
      incomplete: [],
      missingViewport: [],
      failing: [],
      notJudged: [],
    };
    expect(exitOf(judgeWireframes(clean))).toBe(0);
    expect(exitOf(judgeWireframes({ ...clean, declared: [], covered: [] }))).toBe(2);
  });

  // This checkout carries real wireframe gaps today (three `auto-docs` skill
  // indexes renamed under the index that maps them), so the CLI half asserts
  // AGREEMENT with the in-process judgement and NO WRITE, not exit 0.
  test("CLI judge mode writes nothing and agrees with the in-process judgement", () => {
    const run = judgeRun("check-wireframes.ts", "wireframes");
    expect(run.wrote).toBe(false);
    expect(run.exit).toBe(exitOf(judgeWireframes(checkWireframes())));
  }, 120_000);
});

describe("check:layout-norms", () => {
  function fixture(dirs: Array<{ id: string; path: string }>): string {
    const repo = tmp("layout");
    const inst = join(repo, "thing");
    for (const d of dirs) mkdirSync(join(inst, d.path), { recursive: true });
    writeFileSync(
      join(inst, "thing.json"),
      JSON.stringify({
        name: "thing",
        description: "fixture",
        directories: dirs.map((d) => ({ ...d, graphTypologies: ["cat-harness"], description: "fixture" })),
      }),
    );
    return repo;
  }

  test("CORRUPTED: a nested declaration not in the baseline → exit 1", () => {
    const repo = fixture([
      { id: "outer", path: "skills/" },
      { id: "inner", path: "skills/voices/" },
    ]);
    try {
      expect(exitOf(judgeLayoutNorms(checkLayoutNorms(repo, join(repo, "none.json"))))).toBe(1);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("clean fixture → 0; no instance at all → 2", () => {
    const repo = fixture([
      { id: "a", path: "a/" },
      { id: "b", path: "b/" },
    ]);
    const empty = tmp("layout-empty");
    try {
      expect(exitOf(judgeLayoutNorms(checkLayoutNorms(repo, join(repo, "none.json"))))).toBe(0);
      expect(exitOf(judgeLayoutNorms(checkLayoutNorms(empty, join(empty, "none.json"))))).toBe(2);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(empty, { recursive: true, force: true });
    }
  });

  // This checkout carries one real un-baselined pair today
  // (`smart-base/methodologies` contains `…/processes`), so as for wireframes
  // the CLI half asserts agreement and no write.
  test("CLI judge mode writes nothing — not the sidecar, not the baseline", () => {
    const baseline = join(TOOLS_ROOT, "scripts", "layout-norms-baseline.json");
    const before = readFileSync(baseline, "utf-8");
    const run = judgeRun("check-layout-norms.ts", "layout-norms");
    expect(run.wrote).toBe(false);
    expect(readFileSync(baseline, "utf-8")).toBe(before);
    expect(run.exit).toBe(exitOf(judgeLayoutNorms(checkLayoutNorms())));
  }, 120_000);

  test("CLI refuses the writer's --update in judge mode (2), and writes nothing", () => {
    const run = judgeRun("check-layout-norms.ts", "layout-norms", ["--update"]);
    expect(run.exit).toBe(2);
    expect(run.wrote).toBe(false);
  }, 120_000);
});

describe("check:rendered-labels", () => {
  const svg = (labels: string[]): string =>
    `<svg xmlns="http://www.w3.org/2000/svg"><text>${labels.map((t) => `<tspan>${t}</tspan>`).join("")}</text></svg>`;
  function fixture(labels: string[] | undefined): string {
    const root = tmp("labels");
    spawnSync("git", ["init", "-q"], { cwd: root });
    if (labels) {
      mkdirSync(join(root, "img", "workflows"), { recursive: true });
      writeFileSync(join(root, "img", "workflows", "d.svg"), svg(labels));
    }
    return root;
  }

  test("CORRUPTED: a double-escaped label beyond the baseline → exit 1", () => {
    const root = fixture(["x&amp;#10;y"]);
    try {
      expect(exitOf(judgeRenderedLabels(checkRenderedLabels(root, join(root, "none.json"))))).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("clean fixture → 0; no SVG → 2", () => {
    const clean = fixture(["plain"]);
    const none = fixture(undefined);
    try {
      expect(exitOf(judgeRenderedLabels(checkRenderedLabels(clean, join(clean, "none.json"))))).toBe(0);
      expect(exitOf(judgeRenderedLabels(checkRenderedLabels(none, join(none, "none.json"))))).toBe(2);
    } finally {
      rmSync(clean, { recursive: true, force: true });
      rmSync(none, { recursive: true, force: true });
    }
  });

  test("CLI on this checkout: exit 0 and no tracked-file change", () => {
    const run = judgeRun("check-rendered-labels.ts", "rendered-labels");
    expect(run.wrote).toBe(false);
    expect(run.exit).toBe(0);
  }, 120_000);
});

describe("check:source-licence", () => {
  function fixture(licence: unknown | undefined): string {
    const root = tmp("licence");
    mkdirSync(join(root, "library", "a-source"), { recursive: true });
    writeFileSync(
      join(root, "library", "a-source", "manifest.jsonld"),
      JSON.stringify(licence === undefined ? {} : { licenceRecord: licence }),
    );
    return root;
  }

  test("CORRUPTED: `stated` with no basis → exit 1", () => {
    const root = fixture({ status: "stated", id: "CC-BY-4.0" });
    try {
      const r = checkSourceLicence(root);
      expect(r.malformed.length).toBe(1);
      expect(exitOf(judgeSourceLicence(r))).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("CORRUPTED: a manifest that will not parse → exit 1", () => {
    const root = fixture(undefined);
    try {
      writeFileSync(join(root, "library", "a-source", "manifest.jsonld"), "{ not json");
      expect(exitOf(judgeSourceLicence(checkSourceLicence(root)))).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("clean fixture → 0 (absence is reported, not gated); no library entry → 2", () => {
    const clean = fixture(undefined);
    const empty = tmp("licence-empty");
    try {
      expect(exitOf(judgeSourceLicence(checkSourceLicence(clean)))).toBe(0);
      expect(exitOf(judgeSourceLicence(checkSourceLicence(empty)))).toBe(2);
    } finally {
      rmSync(clean, { recursive: true, force: true });
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test("CLI on this checkout: exit 0 and no tracked-file change (bean i2kp)", () => {
    const run = judgeRun("check-source-licence.ts", "source-licence");
    expect(run.wrote).toBe(false);
    expect(run.exit).toBe(0);
  }, 120_000);
});

describe("check:methodology-evidence", () => {
  function fixture(front: string): string {
    const root = tmp("methodology");
    mkdirSync(join(root, "methodologies"), { recursive: true });
    writeFileSync(
      join(root, "thing.json"),
      JSON.stringify({
        name: "thing",
        description: "fixture",
        directories: [{ id: "m", path: "methodologies/", graphTypologies: ["methodology"], description: "fixture" }],
      }),
    );
    writeFileSync(join(root, "methodologies", "a-method.md"), `---\n${front}---\n\nBody.\n`);
    return root;
  }
  const VALID =
    "$schema: folio-methodology/v1\nname: a-method\ntitle: A method\norigin: Somebody, 2026.\napplies-when: always\n";

  test("CORRUPTED: an `evidence` ref no library holds → exit 1", () => {
    const root = fixture(`${VALID}evidence:\n  - library/no-such-source\n`);
    try {
      const r = checkMethodologyEvidence(root);
      expect(r.unresolved.length).toBe(1);
      expect(exitOf(judgeMethodologyEvidence(r))).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("CORRUPTED: front matter that does not validate → exit 1", () => {
    const root = fixture("$schema: folio-methodology/v1\nname: Not Kebab\n");
    try {
      expect(exitOf(judgeMethodologyEvidence(checkMethodologyEvidence(root)))).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("clean fixture → 0, and 1 only under --strict; no methodology graph → 2", () => {
    const root = fixture(VALID);
    const empty = tmp("methodology-empty");
    try {
      const r = checkMethodologyEvidence(root);
      expect(r.noEvidence.length).toBe(1);
      expect(exitOf(judgeMethodologyEvidence(r))).toBe(0);
      expect(exitOf(judgeMethodologyEvidence(r, true))).toBe(1);
      expect(exitOf(judgeMethodologyEvidence(checkMethodologyEvidence(empty)))).toBe(2);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test("CLI on this checkout: exit 0 and no tracked-file change", () => {
    const run = judgeRun("check-methodology-evidence.ts", "methodology-evidence");
    expect(run.wrote).toBe(false);
    expect(run.exit).toBe(0);
  }, 120_000);
});

describe("check:lane-documentation", () => {
  const diagram = (lane: string): string =>
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d">\n` +
    `  <bpmn:process id="p">\n` +
    `    <bpmn:laneSet id="ls">\n${lane}\n    </bpmn:laneSet>\n` +
    `    <bpmn:task id="T" name="Do the thing" />\n` +
    `  </bpmn:process>\n</bpmn:definitions>\n`;
  function fixture(xml: string | undefined): string {
    const root = tmp("lanes");
    spawnSync("git", ["init", "-q"], { cwd: root });
    if (xml) writeFileSync(join(root, "p.bpmn"), xml);
    return root;
  }

  test("CORRUPTED: a task-containing lane with no documentation → exit 1", () => {
    const root = fixture(
      diagram(`      <bpmn:lane id="L" name="Reviewer">\n        <bpmn:flowNodeRef>T</bpmn:flowNodeRef>\n      </bpmn:lane>`),
    );
    try {
      const r = checkLanes(root);
      expect(r.undocumented.length).toBe(1);
      expect(exitOf(judgeLaneDocumentation(r))).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("clean fixture → 0; zero diagrams → 2 (the writer has always said 1 — never 0)", () => {
    const clean = fixture(
      diagram(
        `      <bpmn:lane id="L" name="Reviewer">\n` +
          `        <bpmn:documentation>The person who reviews the thing.</bpmn:documentation>\n` +
          `        <bpmn:flowNodeRef>T</bpmn:flowNodeRef>\n      </bpmn:lane>`,
      ),
    );
    const none = fixture(undefined);
    try {
      const r = checkLanes(clean);
      expect(r.diagrams).toBe(1);
      expect(exitOf(judgeLaneDocumentation(r))).toBe(0);
      expect(exitOf(judgeLaneDocumentation(checkLanes(none)))).toBe(2);
    } finally {
      rmSync(clean, { recursive: true, force: true });
      rmSync(none, { recursive: true, force: true });
    }
  });

  test("CLI on this checkout: exit 0 and no tracked-file change", () => {
    const run = judgeRun("check-lane-documentation.ts", "lane-documentation");
    expect(run.wrote).toBe(false);
    expect(run.exit).toBe(0);
  }, 120_000);
});

describe("kg:export:judge", () => {
  const CLEAN = { rootUndeclared: 0, collisions: 0, undeclaredTerms: 0, problems: 0 };

  test("CORRUPTED: an undeclared term, a root field, a collision → exit 1 each", () => {
    expect(exitOf(judgeKgExport({ ...CLEAN, undeclaredTerms: 1 }))).toBe(1);
    expect(exitOf(judgeKgExport({ ...CLEAN, rootUndeclared: 1 }))).toBe(1);
    expect(exitOf(judgeKgExport({ ...CLEAN, collisions: 1 }))).toBe(1);
  });

  test("an unread source is UNKNOWN (2) — a partial graph has not been judged whole", () => {
    expect(exitOf(judgeKgExport({ ...CLEAN, problems: 1 }))).toBe(2);
    expect(exitOf(judgeKgExport({ ...CLEAN, problems: 1, undeclaredTerms: 1 }))).toBe(2);
    expect(exitOf(judgeKgExport(CLEAN))).toBe(0);
  });

  test("CLI on this checkout: exit 0, no sidecar written, no `_kg/` document written", () => {
    const kg = join(REPO_ROOT, "_kg");
    const kgBefore = existsSync(kg) ? spawnSync("ls", ["-l", "--time-style=full-iso", kg], { encoding: "utf-8" }).stdout : "";
    const run = judgeRun("kg-export.ts", "kg-export", [], "--judge");
    const kgAfter = existsSync(kg) ? spawnSync("ls", ["-l", "--time-style=full-iso", kg], { encoding: "utf-8" }).stdout : "";
    expect(run.wrote).toBe(false);
    expect(kgAfter).toBe(kgBefore);
    expect(run.exit).toBe(0);
  }, 120_000);

  test("CLI refuses a writer's flag in judge mode (2)", () => {
    const run = judgeRun("kg-export.ts", "kg-export", ["--out", "/dev/null"], "--judge");
    expect(run.exit).toBe(2);
    expect(run.wrote).toBe(false);
  }, 120_000);
});

describe("check:avatar-coverage", () => {
  test("CORRUPTED: a stylesheet that carries no trash rule → exit 1", () => {
    const css = renderAvatarsCss().replaceAll('[data-fa-trash="true"]', "");
    expect(trashDerivationPresent(css)).toBe(false);
    expect(exitOf(judgeAvatarCoverage(coverage(INSTANCE_ROOT), trashDerivationPresent(css)))).toBe(1);
  });

  // A kind with no art cannot be planted through a fixture DECLARATION without
  // registering it in the process-wide kind registry, which `avatars.test.ts`
  // records as making every coverage answer depend on the importer. So that
  // corruption is planted in the computed coverage instead.
  test("CORRUPTED: a required kind with no avatar → exit 1", () => {
    const c = coverage(INSTANCE_ROOT);
    const corrupted = {
      ...c,
      required: [...c.required, "zzz-kind-with-no-art"],
      missing: [...c.missing, { kind: "zzz-kind-with-no-art", where: "schemas/content/avatars.ts", note: "planted" }],
    };
    expect(exitOf(judgeAvatarCoverage(corrupted, true))).toBe(1);
    expect(exitOf(judgeAvatarCoverage(c, trashDerivationPresent()))).toBe(0);
  });

  test("an empty required set is UNKNOWN (2), never full coverage", () => {
    expect(exitOf(judgeAvatarCoverage({ required: [], missing: [], orphaned: [], declared: [] }, true))).toBe(2);
  });

  test("CLI on this checkout: exit 0 and no tracked-file change (`--check` used to write)", () => {
    const run = judgeRun("check-avatar-coverage.ts", "avatar-coverage");
    expect(run.wrote).toBe(false);
    expect(run.exit).toBe(0);
  }, 120_000);
});

// The tenth, found by the sweep's second pass rather than from the bean's list:
// `check:harness-state:check` is a WIRED gate and still rewrote its sidecar.
describe("check:harness-state", () => {
  const family = (over: Partial<Family>): Family => ({ id: "f", summary: "s", examined: 1, findings: [], ...over });

  test("CORRUPTED: a family with a finding → exit 1", () => {
    expect(exitOf(judgeHarnessState([family({ findings: [{ where: "x", detail: "planted" }] })]))).toBe(1);
  });

  test("clean → 0; an unreadable family → 2, outranking a finding beside it", () => {
    expect(exitOf(judgeHarnessState([family({})]))).toBe(0);
    expect(
      exitOf(
        judgeHarnessState([family({ unreadable: "gone" }), family({ findings: [{ where: "x", detail: "planted" }] })]),
      ),
    ).toBe(2);
  });

  // This checkout carries a real finding today (the committed health report is
  // from an older producer), so the CLI half asserts agreement and no write.
  test("CLI judge mode writes nothing and agrees with the in-process judgement", () => {
    const run = judgeRun("check-harness-state.ts", "harness-state");
    expect(run.wrote).toBe(false);
    const families = [healthProducerCurrent(), todoProcessRefs(), issueMarkEdits(), interactionProfilesRead()];
    expect(run.exit).toBe(exitOf(judgeHarnessState(families)));
  }, 120_000);
});
