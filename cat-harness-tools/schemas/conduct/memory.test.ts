/**
 * Agent memory as a graph node — the rules that are not obvious from the type.
 */
import { describe, expect, test } from "bun:test";

import { EMPTY_NOTE_TAGS } from "../kg/carried-note.js";
import {
  MEMORY_SCHEMA_TAG,
  MemoryNodeSchema,
  memoryForRoles,
  overlayMemory,
  type MemoryNode,
} from "./memory.js";

const base = {
  id: "m1",
  summary: "two workflows fail by design here",
  comment: "…",
  createdAt: "2026-09-19T00:00:00Z",
  tags: EMPTY_NOTE_TAGS,
  $schema: MEMORY_SCHEMA_TAG,
} as const;

const mk = (over: Record<string, unknown> = {}): MemoryNode =>
  MemoryNodeSchema.parse({ ...base, label: "stable", ...over });

describe("a BASELINE must carry its provenance", () => {
  test("a baseline WITHOUT `measured` is refused", () => {
    // `AGENTS.md`: a BASELINE is "a measured number, stored with the command
    // that produced it and the date, and never quoted as a current answer."
    // That was prose discipline until here. Prose discipline is exactly what
    // `judgementOnly` was invented to replace, after a rule stated only in a
    // role summary came within one commit of being overturned.
    const r = MemoryNodeSchema.safeParse({ ...base, label: "baseline" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("provenance");
  });

  test("a baseline WITH command, date and result parses", () => {
    const m = mk({
      label: "baseline",
      measured: { command: "bun run cat kg:audit", date: "2026-09-19", result: "fail 0" },
    });
    expect(m.measured?.command).toBe("bun run cat kg:audit");
  });

  test("STABLE and TRAP need no provenance — they are not numbers", () => {
    expect(mk({ label: "stable" }).label).toBe("stable");
    expect(mk({ label: "trap" }).label).toBe("trap");
  });
});

describe("memory carries no status, deliberately", () => {
  test("a status field is not part of the shape", () => {
    // A TRAP is not "open", and marking one "done" would assert the failure it
    // records has stopped being possible. The lifecycle belongs to the todo.
    expect("status" in mk()).toBe(false);
  });
});

describe("overlay is by id, in dependency order", () => {
  test("a nearer layer overrides an id from a further one", () => {
    const far = [mk({ id: "x", summary: "from the dependency" })];
    const near = [mk({ id: "x", summary: "from this instance" })];
    const out = overlayMemory([far, near]);
    expect(out).toHaveLength(1);
    expect(out[0]!.summary).toBe("from this instance");
  });

  test("different ids both survive — same subject is not the same entry", () => {
    // Overriding by summary or by subject would be a guess about authorial
    // intent. Two entries about one topic are two entries.
    const out = overlayMemory([[mk({ id: "a", summary: "s" })], [mk({ id: "b", summary: "s" })]]);
    expect(out.map((m) => m.id).sort()).toEqual(["a", "b"]);
  });

  test("order is least-specific-first, so the LAST layer wins", () => {
    const out = overlayMemory([
      [mk({ id: "x", summary: "1" })],
      [mk({ id: "x", summary: "2" })],
      [mk({ id: "x", summary: "3" })],
    ]);
    expect(out[0]!.summary).toBe("3");
  });
});

describe("role scoping — the thing that ends the duplication", () => {
  const tagged = (roles: string[], id: string) =>
    mk({ id, tags: { ...EMPTY_NOTE_TAGS, roles } });

  test("an untagged entry reaches EVERY agent", () => {
    // This is how one fact — "could not determine is a third state" — reaches
    // every agent without being copied into each one's file. Measured
    // 2026-09-19: 5 subject areas were duplicated across two agents' memories
    // for exactly the want of this.
    const out = memoryForRoles([mk({ id: "shared" })], ["reviewer"]);
    expect(out.map((m) => m.id)).toEqual(["shared"]);
  });

  test("a role-tagged entry reaches only agents taking that role", () => {
    const entries = [tagged(["author"], "a"), tagged(["reviewer"], "r")];
    expect(memoryForRoles(entries, ["reviewer"]).map((m) => m.id)).toEqual(["r"]);
  });

  test("an agent taking several roles gets the union", () => {
    const entries = [tagged(["author"], "a"), tagged(["reviewer"], "r"), tagged(["editor"], "e")];
    const got = memoryForRoles(entries, ["author", "editor"]).map((m) => m.id);
    expect(got.sort()).toEqual(["a", "e"]);
  });
});
