/**
 * The workflow tools' typed results agree with the engine (issue #1259, group 2).
 *
 * Each schema in `schemas/tools/workflow-tool-results.ts` is held equal to the
 * engine's own TypeScript type at compile time, so a field added to the engine
 * without the schema (or the reverse) fails `tsc`. The runtime cases run the
 * real position code over one of this checkout's processes and parse what
 * comes back (the instance store needs the beans mount, so listing is checked
 * on a constructed value).
 */
import { describe, expect, test } from "bun:test";
import type { z } from "zod";

import type {
  WorkflowCompletion,
  WorkflowGateAnswer,
  WorkflowListing,
  WorkflowStarted,
} from "../../src/tools/workflow.ts";
import { position, startInstance, type Enabled, type WorkflowPosition } from "../../src/workflow/instance.ts";
import { processFiles } from "../../src/workflow/process-files.ts";
import { loadProcessModel } from "../../src/workflow/process-model.ts";
import {
  EnabledStepSchema,
  WorkflowCompletionSchema,
  WorkflowGateAnswerSchema,
  WorkflowListingSchema,
  WorkflowPositionSchema,
  WorkflowStartedSchema,
} from "../../schemas/tools/workflow-tool-results.ts";
import { TOOL_TYPES } from "../../schemas/tools/tool-types.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

/** Compiles only when A and B are each assignable to the other. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const agree = <T extends true>(_: T) => _;
agree<Same<z.infer<typeof EnabledStepSchema>, Enabled>>(true);
agree<Same<z.infer<typeof WorkflowPositionSchema>, WorkflowPosition>>(true);
agree<Same<z.infer<typeof WorkflowListingSchema>, WorkflowListing>>(true);
agree<Same<z.infer<typeof WorkflowStartedSchema>, WorkflowStarted>>(true);
agree<Same<z.infer<typeof WorkflowGateAnswerSchema>, WorkflowGateAnswer>>(true);
agree<Same<z.infer<typeof WorkflowCompletionSchema>, WorkflowCompletion>>(true);

describe("the workflow tools' results", () => {
  test("are published as shared tool types", () => {
    for (const n of ["WorkflowListing", "WorkflowStarted", "WorkflowPosition", "WorkflowGateAnswer", "WorkflowCompletion"]) {
      expect(n in TOOL_TYPES).toBe(true);
    }
  });

  test("a listing, with a process that cannot be read, parses", () => {
    const l: WorkflowListing = {
      processes: [
        { file: "processes/a.bpmn", name: "A", id: "Process_A", activities: 3 },
        { file: "processes/b.bpmn", error: "unsupported element" },
      ],
      instances: [{ id: "Process_A--x", subject: "x", status: "running", updatedAt: "2026-11-01T00:00:00Z" }],
    };
    expect(WorkflowListingSchema.parse(l)).toEqual(l);
    expect(WorkflowListingSchema.safeParse({ ...l, instances: [{ ...l.instances[0], status: "paused" }] }).success).toBe(false);
  });

  test("a fresh instance of a real process gives a position that parses", async () => {
    const file = processFiles(HARNESS_ROOT).find((f) => !/global-tasks/.test(f));
    if (!file) return; // a checkout with no processes has nothing to position
    const model = await loadProcessModel(file);
    const state = startInstance(model, { id: "test--position", subject: "a subject" });
    const p = position(model, state);
    expect(WorkflowPositionSchema.parse(p)).toEqual(p);
    expect(p.instance).toBe("test--position");
    expect(p.status).toBe("running");
  });

  test("a gate answer with an unknown assignment is refused", () => {
    const ok: WorkflowGateAnswer = {
      allowed: false,
      gate: { allowed: true, reason: "enabled" },
      authorization: {
        allowed: false,
        mode: "strict",
        authenticatedBy: "none",
        actor: null,
        assignment: "unknown-actor",
        authorized: "unknown",
        findings: ["no principal"],
      },
    };
    expect(WorkflowGateAnswerSchema.parse(ok)).toEqual(ok);
    const bad = { ...ok, authorization: { ...ok.authorization, assignment: "maybe" } };
    expect(WorkflowGateAnswerSchema.safeParse(bad).success).toBe(false);
  });
});
