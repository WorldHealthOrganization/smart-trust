/**
 * A check wired in two steps (owner, 2026-11-07, "A. Two steps"): a new check
 * judged against a baseline main has never written reports every finding as
 * new, so its WRITER is wired first and main's push records the baseline. A
 * `pending-baseline` exemption covers the check meanwhile, but only while CI
 * runs that writer, and it names the follow-up that wires the check.
 *
 * @module scripts/tests/sdlc/pending-baseline.test
 */
import { describe, expect, test } from "bun:test";
import { pendingBaselinesFrom, type ScriptExemption, unrunFrom, writersRunBy } from "../../gates.ts";
import { QA_WRITERS } from "../../qa-refresh.ts";
import { GateExemptionsSchema } from "../../../schemas/kg/cat-harness.ts";

const PENDING: ScriptExemption = {
  script: "translation:page-qa:check",
  kind: "pending-baseline",
  reason: "catalogue sidecars are new; main has stored none",
  writer: "translation:page-qa",
  followUp: "the PR after folio-assistant#2985",
};
const NAMES = ["check:a", "translation:page-qa:check"];

describe("unrunFrom and a pending-baseline exemption", () => {
  test("covers the check while CI runs its writer", () => {
    const commands = ["bun run cat check:a", "bun run cat translation:page-qa"];
    expect(unrunFrom(NAMES, commands, [PENDING])).toEqual([]);
  });

  test("does not cover it when the writer is not run: no silent skip", () => {
    expect(unrunFrom(NAMES, ["bun run cat check:a"], [PENDING])).toEqual(["translation:page-qa:check"]);
  });

  test("the writer's name must match at a token boundary, not as a prefix of the check", () => {
    // `translation:page-qa` is a prefix of `translation:page-qa:check`; a run
    // of some other `translation:page-qa:x` is not a run of the writer.
    expect(unrunFrom(NAMES, ["bun run cat check:a", "bun run cat translation:page-qa:x"], [PENDING])).toEqual([
      "translation:page-qa:check",
    ]);
  });

  test("a writer run INDIRECTLY, as a QA_WRITERS entry of a qa:refresh CI runs, counts", () => {
    expect(unrunFrom(NAMES, ["bun run cat check:a"], [PENDING], ["translation:page-qa"])).toEqual([]);
  });

  test("other kinds are unchanged: an exemption covers without conditions", () => {
    const report: ScriptExemption = { script: "translation:page-qa:check", kind: "report", reason: "r" };
    expect(unrunFrom(NAMES, ["bun run cat check:a"], [report])).toEqual([]);
    expect(unrunFrom(NAMES, ["bun run cat check:a"], [])).toEqual(["translation:page-qa:check"]);
  });
});

describe("pendingBaselinesFrom reports where each wait stands", () => {
  test("writer wired, check not yet", () => {
    expect(pendingBaselinesFrom(["bun run cat translation:page-qa"], [PENDING])).toEqual([
      { script: PENDING.script, writer: PENDING.writer!, followUp: PENDING.followUp!, writerRun: true, checkRun: false },
    ]);
  });

  test("check wired: reported as done, so the exemption can go", () => {
    const [row] = pendingBaselinesFrom(["bun run cat translation:page-qa", "bun run cat translation:page-qa:check"], [PENDING]);
    expect(row?.checkRun).toBe(true);
  });

  test("only pending-baseline rows are listed", () => {
    expect(pendingBaselinesFrom([], [{ script: "x:check", kind: "report", reason: "r" }])).toEqual([]);
  });
});

describe("the declaration schema", () => {
  const parse = (s: unknown) => GateExemptionsSchema.safeParse({ scripts: [s] }).success;

  test("a pending-baseline entry names its writer and its follow-up", () => {
    expect(parse(PENDING)).toBe(true);
    expect(parse({ ...PENDING, writer: undefined })).toBe(false);
    expect(parse({ ...PENDING, followUp: undefined })).toBe(false);
  });

  test("no other kind carries them", () => {
    expect(parse({ script: "x:check", kind: "report", reason: "r" })).toBe(true);
    expect(parse({ script: "x:check", kind: "report", reason: "r", writer: "x" })).toBe(false);
  });
});

describe("writersRunBy", () => {
  test("is empty unless CI runs qa:refresh or qa:working-copy", () => {
    expect(writersRunBy(["bun run cat check:a"])).toEqual([]);
  });

  test("lists every QA_WRITERS command when it does, translation:page-qa among them", () => {
    const viaWorkingCopy = writersRunBy(["bun run cat qa:working-copy"]);
    expect(viaWorkingCopy).toEqual(QA_WRITERS.map((w) => w.run[0]));
    expect(viaWorkingCopy).toContain("translation:page-qa");
    expect(writersRunBy(["bun run cat qa:refresh --dir x"])).toEqual(viaWorkingCopy);
  });
});
