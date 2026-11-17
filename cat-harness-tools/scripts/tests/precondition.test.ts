/**
 * `<bootstrap.processes:precondition>` — what must hold before a process starts.
 *
 * @module scripts/tests/precondition
 * @graphNode none — a test
 *
 * Bean `lv3j`. The positive cases here are the cheap half; the REFUSALS are
 * the reason the element exists. A precondition that reads as verified and is
 * not is worse than the documentation prose it replaces — prose is honestly
 * unchecked, a wrong declaration is dishonestly checked — so every way of
 * writing one of those must fail to load.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  evaluatePrecondition,
  evaluatePreconditions,
  loadProcessModel,
  type Precondition,
} from "../../src/workflow/process-model.js";
import { repoRootFor } from "../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../lib/roots.ts";

const ROOT = repoRootFor(join(HARNESS_ROOT));
const REAL = join(ROOT, "bootstrap/processes/initialize-harness.bpmn");

/**
 * A minimal loadable process, with whatever extension XML the case needs.
 *
 * `declared` writes a layer declaration beside it. A `file-exists` ref
 * resolves against the layer that owns the diagram, so a checkable fixture
 * needs one; a stated-only fixture does not, and leaving it out keeps the
 * refusal tests down to the one reason each is about.
 */
function fixture(ext: string, declared = false): string {
  const dir = mkdtempSync(join(tmpdir(), "precondition-"));
  if (declared) writeFileSync(join(dir, "fixture.json"), JSON.stringify({ name: "fixture" }));
  const p = join(dir, "p.bpmn");
  writeFileSync(
    p,
    `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bootstrap.processes="https://litlfred.github.io/bootstrap/v0/processes/ns/" xmlns:cat-harness.processes="https://litlfred.github.io/cat-harness/v0/processes/ns/"
                  targetNamespace="urn:t">
  <bpmn:process id="Process_T" name="T" isExecutable="false">
    <bpmn:extensionElements>${ext}</bpmn:extensionElements>
    <bpmn:startEvent id="Start_T" name="Start"/>
  </bpmn:process>
</bpmn:definitions>
`,
  );
  return p;
}

const refuses = (ext: string, declared = false) =>
  expect(loadProcessModel(fixture(ext, declared))).rejects.toThrow();

describe("the real diagram — `initialize-harness`", () => {
  // Loaded BY PATH because no corpus test covers `bootstrap/processes/`:
  // the platform's sweeps scan `cat-harness/processes/` only, which is
  // the same asymmetry bean `pve3` is about. Without this the element could be
  // added and the one diagram that needed it left behind.
  test("declares four preconditions, three of them unobservable", async () => {
    const m = await loadProcessModel(REAL);
    expect(m.preconditions).toHaveLength(4);
    expect(m.preconditions.filter((p) => p.kind === "stated").map((p) => p.id)).toEqual([
      "knows-the-vocabulary",
      "told-it-is-a-bootstrapping-agent",
      "at-the-start",
    ]);
    expect(m.preconditions.filter((p) => p.kind === "checkable")).toHaveLength(1);
  });

  test("the three claims about the ACTOR all come back could-not-determine", async () => {
    const m = await loadProcessModel(REAL);
    const v = evaluatePreconditions(m);
    expect(v.filter((x) => x.verdict === "could-not-determine").map((x) => x.precondition.id)).toEqual([
      "knows-the-vocabulary",
      "told-it-is-a-bootstrapping-agent",
      "at-the-start",
    ]);
  });

  test("the one claim about the WORLD is answered, and answers what it says", async () => {
    // It checks that README.md EXISTS. Whether the Bootstrapping Agent READ it is not
    // observable, and the declaration says so rather than implying otherwise.
    const m = await loadProcessModel(REAL);
    const readme = evaluatePreconditions(m).find((x) => x.precondition.id === "readme-present")!;
    expect(readme.verdict).toBe("satisfied");
    // `README.md`, not `bootstrap/README.md`: relative to the layer, so the
    // same ref names the same file once bootstrap is a repository of its own.
    expect(readme.precondition.check).toEqual({
      kind: "file-exists",
      ref: "README.md",
      base: join(ROOT, "bootstrap"),
    });
    // And it is a real check, not a constant: point it at a base without the
    // file and it must say so.
    const elsewhere = { ...readme.precondition.check!, base: mkdtempSync(join(tmpdir(), "empty-")) };
    expect(evaluatePrecondition({ ...readme.precondition, check: elsewhere })).toBe("unsatisfied");
  });
});

describe("a stated precondition can never read as satisfied", () => {
  test("...even when one is hand-built carrying a check the parser would refuse", () => {
    // The guarantee is STRUCTURAL — `evaluatePrecondition` returns on kind
    // before it looks at anything else — so this holds for a model nobody
    // parsed. A guarantee that only holds for well-formed input is a rule,
    // and rules are what this element exists to stop relying on.
    const smuggled = {
      id: "x",
      text: "the actor understands roles",
      kind: "stated",
      check: { kind: "file-exists", ref: "README.md", base: join(ROOT, "bootstrap") },
    } as unknown as Precondition;
    expect(evaluatePrecondition(smuggled)).toBe("could-not-determine");
  });

  test("a checkable one with no check is could-not-determine, never satisfied", () => {
    const broken = { id: "x", text: "t", kind: "checkable" } as Precondition;
    expect(evaluatePrecondition(broken)).toBe("could-not-determine");
  });
});

describe("refusals — every way of writing a precondition that lies", () => {
  test("no kind: there is deliberately no default", async () => {
    await refuses('<bootstrap.processes:precondition id="a" text="t"/>');
  });

  test("a kind that is neither", async () => {
    await refuses('<bootstrap.processes:precondition id="a" kind="probably" text="t"/>');
  });

  test("checkable with no check — the central case", async () => {
    // This is the failure the element exists for: a condition that LOOKS
    // verified and verifies nothing.
    await refuses('<bootstrap.processes:precondition id="a" kind="checkable" text="t"/>');
  });

  test("checkable with a check nobody implemented", async () => {
    // `ref` IS SUPPLIED, and that is the point. Without it the no-ref guard
    // rejects this first and the unknown-check branch is never reached — the
    // test passed with that branch disabled, which is how this was found.
    // A refusal test has to leave exactly one reason to refuse.
    await refuses(
      '<bootstrap.processes:precondition id="a" kind="checkable" check="agent-understood" ref="x" text="t"/>',
    );
  });

  test("checkable with no ref — a check that does not know what to check", async () => {
    await refuses('<bootstrap.processes:precondition id="a" kind="checkable" check="file-exists" text="t"/>');
  });

  test("stated WITH a check — mislabelled either way", async () => {
    await refuses(
      '<bootstrap.processes:precondition id="a" kind="stated" check="file-exists" ref="x" text="t"/>',
    );
  });

  test("no id — a verdict that cannot name its subject", async () => {
    await refuses('<bootstrap.processes:precondition kind="stated" text="t"/>');
  });

  test("no text — an id says a condition exists, not what it is", async () => {
    await refuses('<bootstrap.processes:precondition id="a" kind="stated"/>');
  });

  test("a ref that climbs out of the instance", async () => {
    // Declared, so the ONLY reason left to refuse is the `..`.
    await refuses(
      '<bootstrap.processes:precondition id="a" kind="checkable" check="file-exists" ref="../x" text="t"/>',
      true,
    );
  });

  test("an absolute ref", async () => {
    await refuses(
      // input-site: inert #8cbc72f7 — an absolute path used as test data (a fixture string, a trace line, a path a guard must refuse); the test never reads it
      '<bootstrap.processes:precondition id="a" kind="checkable" check="file-exists" ref="/etc/hosts" text="t"/>',
      true,
    );
  });

  test("a file check on a diagram no instance owns — there is no root to resolve against", async () => {
    // The same XML loads when declared (the next describe), so this refuses
    // for the missing owner and nothing else.
    await refuses('<bootstrap.processes:precondition id="a" kind="checkable" check="file-exists" ref="x" text="t"/>');
  });

  test("two sharing an id", async () => {
    await refuses(
      '<bootstrap.processes:precondition id="a" kind="stated" text="one"/>' +
        '<bootstrap.processes:precondition id="a" kind="stated" text="two"/>',
    );
  });
});

describe("a process that declares none", () => {
  test("gets an empty list, not undefined — most processes are this", async () => {
    // A process running inside a harness has had its actor established
    // already. The empty case must be ordinary rather than exceptional.
    const m = await loadProcessModel(fixture('<cat-harness.processes:policy enforcement="advisory"/>'));
    expect(m.preconditions).toEqual([]);
    expect(evaluatePreconditions(m)).toEqual([]);
  });
});

describe("a file-exists ref resolves against the owning instance", () => {
  test("not the repository root and not the working directory", async () => {
    const p = fixture(
      '<bootstrap.processes:precondition id="a" kind="checkable" check="file-exists" ref="here.txt" text="t"/>',
      true,
    );
    const m = await loadProcessModel(p);
    const base = m.preconditions[0].check!.base;
    expect(base).toBe(dirname(p));
    expect(evaluatePreconditions(m)[0].verdict).toBe("unsatisfied");
    writeFileSync(join(base, "here.txt"), "present");
    expect(evaluatePreconditions(m)[0].verdict).toBe("satisfied");
  });
});
