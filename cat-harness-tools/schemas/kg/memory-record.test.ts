/**
 * The memory record, and the bean as one with more structure (cat-harness#991
 * §4.14, Q17).
 */
import { describe, expect, test } from "bun:test";

import { BeanFrontMatterSchema, BeanKind } from "../sdlc/bean-graph.ts";
import { entriesInBody, MemoryRecordCoreKind, MemoryRecordKind, parseEntryLine, renderEntryLine, type MemoryEntry } from "./memory-record.ts";

const e: MemoryEntry = { at: "2026-11-03T07:00:00Z", by: "agent-1", kind: "checkpoint", text: "stopped at the parser", process: "p", step: "Task_X", instance: "p--a", role: "reviewer" };

describe("the layers", () => {
  test("a bean is a memory record with more structure: it inherits the shared core", () => {
    expect(BeanKind.order).toContain(MemoryRecordCoreKind.id);
    expect(MemoryRecordKind.order).toContain(MemoryRecordCoreKind.id);
  });

  test("the bean's fields are exactly what they were: the core plus its own", () => {
    const want = Object.keys(BeanFrontMatterSchema.shape).sort();
    expect(Object.keys(BeanKind.schema.shape).filter((k) => k !== "$schema").sort()).toEqual(want);
  });

  test("a memory record on its own: scope required, entries structured", () => {
    expect(MemoryRecordKind.schema.safeParse({ $schema: "memory-record/1.0.0", id: "m1", scope: "shared", entries: [e] }).success).toBe(true);
    // Scope required: absent, or not one of the scopes, is refused — each with valid entries, so the scope is the only fault.
    expect(MemoryRecordKind.schema.safeParse({ $schema: "memory-record/1.0.0", id: "m1", entries: [e] }).success).toBe(false);
    expect(MemoryRecordKind.schema.safeParse({ $schema: "memory-record/1.0.0", id: "m1", scope: "everyone", entries: [e] }).success).toBe(false);
    expect(MemoryRecordKind.schema.safeParse({ $schema: "memory-record/1.0.0", id: "m1", scope: "run", entries: [{ ...e, kind: "gossip" }] }).success).toBe(false);
  });
});

describe("an entry as a body line", () => {
  test("round-trips, metadata included", () => {
    expect(parseEntryLine(renderEntryLine(e))).toEqual(e);
  });

  test("is one line, whatever the text holds", () => {
    expect(renderEntryLine({ ...e, text: "a\n\nb ] · c" })).not.toContain("\n");
    expect(parseEntryLine(renderEntryLine({ ...e, text: "a\n\nb" }))!.text).toBe("a b");
  });

  test("is found after a Tool's own stamp, and a Tool's signature is not the text", () => {
    expect(parseEntryLine(`_2026-11-03 07:00_ — ${renderEntryLine(e)} (agent-1)`)).toEqual(e);
  });

  test("prose in a body is not an entry", () => {
    expect(entriesInBody(`Some prose.\n\n${renderEntryLine(e)}\nmore prose [memory?]`)).toEqual([e]);
  });
});
