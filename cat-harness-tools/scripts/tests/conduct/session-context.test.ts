/**
 * The session-context record's shape, and the three things it refuses.
 *
 * Nothing writes one yet (bean `3nfv`), which makes these tests the whole of
 * the contract's enforcement until something does — and the reason to write
 * them now rather than with the writer: a schema nobody has exercised is a
 * schema whose constraints are a hope.
 *
 * @module scripts/tests/session-context.test
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  SESSION_CONTEXT_SCHEMA_TAG,
  SessionContextSchema,
  parseSessionContext,
} from "../../../schemas/sdlc/session-context.js";
import { defaultGraphTypologies, graphTypologyIri, graphLayer, processMayWrite } from "../../../schemas/kg/cat-harness.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

/** The smallest record that parses — an idle session, which is the common one. */
function idle(): unknown {
  return {
    $schema: SESSION_CONTEXT_SCHEMA_TAG,
    id: "s-1",
    actor: { id: "authoring-agent", declared: true },
    startedAt: "2026-09-20T06:00:00Z",
    updatedAt: "2026-09-20T06:00:00Z",
    open: [],
    claimed: [],
  };
}

describe("session context", () => {
  test("an IDLE session parses — empty `open` is the normal state", () => {
    // A record that treated "no instance open" as a defect would report every
    // reading or deciding session as broken, which is most of them.
    expect(parseSessionContext(idle()).open).toEqual([]);
  });

  test("`actor` is required — the one field nothing else can supply", () => {
    const { actor: _drop, ...without } = idle() as Record<string, unknown>;
    expect(SessionContextSchema.safeParse(without).success).toBe(false);
  });

  test("an undeclared actor is representable, and says so", () => {
    // An agent may act with no node under the actors graph. Requiring one
    // would make the field unfillable in the cold-start case this record is
    // most useful for — so the fact is carried, not the refusal.
    const r = parseSessionContext({ ...(idle() as object), actor: { id: "some-agent", declared: false } });
    expect(r.actor).toEqual({ id: "some-agent", declared: false });
  });

  test("`declared` cannot be omitted — absent is not `false`", () => {
    // Written, never inferred at read time: a reader resolving it themselves
    // gets a different answer if the node moved in between.
    const bad = { ...(idle() as object), actor: { id: "x" } };
    expect(SessionContextSchema.safeParse(bad).success).toBe(false);
  });

  test("`waitingOn` carries `since` or does not exist", () => {
    // A wait with no start cannot be told from abandoned work.
    const noSince = { ...(idle() as object), waitingOn: { what: "a review" } };
    expect(SessionContextSchema.safeParse(noSince).success).toBe(false);
    const ok = { ...(idle() as object), waitingOn: { what: "a review", since: "2026-09-20T06:10:00Z" } };
    expect(SessionContextSchema.safeParse(ok).success).toBe(true);
  });

  test("the `$schema` tag is what identifies the file, not its path", () => {
    // #263's contract: extension and directory are coincidences of layout, a
    // declaration inside the file is the contract.
    const wrong = { ...(idle() as object), $schema: "folio-workflow-instance/v1" };
    expect(SessionContextSchema.safeParse(wrong).success).toBe(false);
  });

  test("`session-state` is a registered kind, writable, and its reader names it", () => {
    // Registered AHEAD of any directory, like `memory` and `folio`. Nothing
    // scans a kind, so this is not the `dh4f` shape.
    expect(defaultGraphTypologies.has("session-state")).toBe(true);
    expect(graphLayer("session-state")).toBe("state");
    expect(processMayWrite("session-state")).toBe(true);
    // The skill names the kind it reads, not the other way (#1168, B3).
    const skill = readFileSync(join(HARNESS_ROOT, "skills", "process", "workflow", "session-context.md"), "utf-8");
    const frontMatter = skill.startsWith("---\n") ? skill.slice(4, skill.indexOf("\n---", 4)) : "";
    expect(frontMatter).toContain("graph-typologies:\n  - session-state");
  });

  test("a session is NOT a process instance — two kinds, both state", () => {
    // `workflow-state` is where ONE instance got to; a session spans
    // processes. Merging them would make the idle session unrepresentable.
    expect(defaultGraphTypologies.has("session-state") && defaultGraphTypologies.has("workflow-state")).toBe(true);
    expect(graphTypologyIri("session-state", defaultGraphTypologies.get("session-state")))
      .not.toBe(graphTypologyIri("workflow-state", defaultGraphTypologies.get("workflow-state")));
  });
});
