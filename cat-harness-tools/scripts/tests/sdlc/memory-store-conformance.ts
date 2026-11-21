/**
 * What every memory Tool must do (cat-harness#991 §4.14, Q17): the
 * `MemoryStore` layer on its own, so a Tool that is not the work plan (the
 * run's file store) is held to the same responsibilities as beans.
 *
 * @module scripts/tests/sdlc/memory-store-conformance
 */
import { describe, expect, test } from "bun:test";
import type { MemoryEntry } from "../../../schemas/kg/memory-record.ts";
import type { MemoryStore } from "../../../src/workflow/work-plan-store.ts";

export interface MemoryToolUnderTest {
  name: string;
  /** Two handles on one fresh, empty store. */
  fresh(): { a: MemoryStore; b: MemoryStore };
}

const at = "2026-11-03T07:00:00Z";
const entry = (text: string, extra: Partial<MemoryEntry> = {}): MemoryEntry => ({ at, by: "agent-1", kind: "note", text, ...extra });

export function memoryStoreConformance(tool: MemoryToolUnderTest): void {
  describe(`memory store conformance — ${tool.name}`, () => {
    test("open, keep, recall: entries in order, with their metadata, one line each", () => {
      const { a } = tool.fresh();
      expect(a.open({ id: "m-item", title: "An item", scope: "item" }).state).toBe("opened");
      a.keep("m-item", entry("took it up", { kind: "taken-up", process: "p", instance: "p--a" }));
      a.keep("m-item", entry("chose the smaller fix\nbecause it is reversible", { step: "Task_X", role: "reviewer" }));
      const r = a.recall("m-item");
      if (r.state !== "hit") throw new Error("expected a record");
      expect([r.record.id, r.record.scope]).toEqual(["m-item", "item"]);
      expect(r.record.entries).toEqual([
        entry("took it up", { kind: "taken-up", process: "p", instance: "p--a" }),
        entry("chose the smaller fix because it is reversible", { step: "Task_X", role: "reviewer" }),
      ]);
    });

    test("a shared space: what one handle keeps, the other recalls, and neither overwrites the other", () => {
      const { a, b } = tool.fresh();
      expect(a.open({ id: "m-swarm", title: "Swarm", scope: "shared", about: ["run-7"] }).state).toBe("opened");
      a.keep("m-swarm", entry("found the parser bug", { kind: "checkpoint" }));
      b.keep("m-swarm", entry("fixed the fixture", { by: "agent-2" }));
      const r = b.recall("m-swarm");
      if (r.state !== "hit") throw new Error("expected a record");
      expect([r.record.scope, r.record.about]).toEqual(["shared", ["run-7"]]);
      expect(r.record.entries.map((e) => [e.by, e.kind])).toEqual([["agent-1", "checkpoint"], ["agent-2", "note"]]);
    });

    test("opening an id twice is refused, and the first record stands", () => {
      const { a } = tool.fresh();
      a.open({ id: "m-once", title: "First", scope: "run" });
      a.keep("m-once", entry("kept"));
      const again = a.open({ id: "m-once", title: "Second", scope: "run" });
      expect(again.state).toBe("refused");
      const r = a.recall("m-once");
      expect(r.state === "hit" && [r.record.title, r.record.entries.length]).toEqual(["First", 1]);
    });

    test("an unknown record: keep and recall are none, and nothing is created", () => {
      const { a } = tool.fresh();
      expect(a.keep("m-gone", entry("x")).state).toBe("none");
      expect(a.recall("m-gone").state).toBe("none");
    });

    test("the version moves when an entry is kept", () => {
      const { a } = tool.fresh();
      a.open({ id: "m-ver", title: "V", scope: "item" });
      const before = a.recall("m-ver");
      a.keep("m-ver", entry("x"));
      const after = a.recall("m-ver");
      expect(before.state === "hit" && after.state === "hit" && before.record.version !== after.record.version).toBe(true);
    });
  });
}
