/**
 * The dedupe plan merges copies of one bean without losing text, and says when
 * it cannot. Each case is a shape measured on the live stores 2026-10-20.
 */
import { describe, expect, test } from "bun:test";
import { headerOk, homeOf, merge3, resolveDiff3, settleStatus, withConflictNotes } from "../scripts/bean-dedupe.ts";

const bean = (status: string, updated: string, body: string) =>
  `---\n# folio-assistant-abcd\ntitle: A bean\nstatus: ${status}\ntype: task\nupdated_at: ${updated}\n---\n\n${body}\n`;

describe("homeOf", () => {
  test("a prefix names its home", () => {
    expect(homeOf("cat-tools-0nxe", ["cat-harness-tools"]).home).toBe("cat-harness-tools");
    expect(homeOf("folio-core-1abc", ["folio-assistant-core"]).home).toBe("folio-assistant-core");
  });
  test("a bean one layer took belongs to that layer", () => {
    expect(homeOf("folio-assistant-abcd", ["folio-assistant", "cat-harness", "cat-harness-tools"]).home).toBe("cat-harness-tools");
  });
  test("taken by both layers: the main store (owner, 2026-10-30)", () => {
    expect(homeOf("folio-assistant-abcd", ["cat-harness-tools", "folio-assistant-core"]).home).toBe("folio-assistant");
  });
  test("everything else goes to the main store", () => {
    expect(homeOf("folio-assistant-abcd", ["folio-assistant", "cat-harness"]).home).toBe("folio-assistant");
  });
});

describe("merge3", () => {
  const base = bean("todo", "2026-10-08T00:00:00Z", "Do the thing.");

  test("two dated notes appended at the same place: both kept", () => {
    const a = bean("todo", "2026-10-09T00:00:00Z", "Do the thing.\n\nNote from A.");
    const b = bean("todo", "2026-10-10T00:00:00Z", "Do the thing.\n\nNote from B.");
    const m = merge3([{ store: "a", file: "x", text: a }, { store: "b", file: "x", text: b }], base);
    expect(m.conflicts).toHaveLength(0);
    expect(m.text).toContain("Note from A.");
    expect(m.text).toContain("Note from B.");
    expect(m.text).toContain("updated_at: 2026-10-10T00:00:00Z");
    expect(m.text).not.toContain("updated_at: 2026-10-09T00:00:00Z");
    expect(headerOk(m.text)).toBe(true);
  });

  test("one side closes the bean, the other only touches the body: both changes land", () => {
    const a = bean("completed", "2026-10-09T00:00:00Z", "Do the thing.");
    const b = bean("todo", "2026-10-08T00:00:00Z", "Do the thing, carefully.");
    const m = merge3([{ store: "a", file: "x", text: a }, { store: "b", file: "x", text: b }], base);
    expect(m.conflicts).toHaveLength(0);
    expect(m.text).toContain("status: completed");
    expect(m.text).toContain("carefully");
  });

  test("the same sentence reworded two ways: a conflict, ours kept, theirs reported", () => {
    const a = bean("todo", "2026-10-08T00:00:00Z", "Do the thing, by the owner.");
    const b = bean("todo", "2026-10-08T00:00:00Z", "Do the thing, by a person.");
    const m = merge3([{ store: "a", file: "x", text: a }, { store: "b", file: "x", text: b }], base);
    expect(m.conflicts).toHaveLength(1);
    expect(m.conflicts[0].kept).toContain("by the owner");
    expect(m.conflicts[0].other).toContain("by a person");
    expect(m.text).not.toContain("<<<<<<<");
  });
});

describe("resolveDiff3", () => {
  test("text without conflict markers passes through", () => {
    expect(resolveDiff3("a\nb").text).toBe("a\nb");
  });
});

describe("headerOk", () => {
  test("a duplicated key is invalid", () => {
    expect(headerOk("---\ntitle: t\nstatus: todo\nstatus: completed\n---\n")).toBe(false);
  });
});

describe("settleStatus", () => {
  const copy = (store: string, status: string, updated: string) => ({ store, file: "x.md", text: bean(status, updated, "Body.") });

  test("a stale layer copy never reopens a bean the branch stores closed (9rq1)", () => {
    const copies = [
      copy("cat-harness-tools", "in-progress", "2026-10-28T00:00:00Z"),
      copy("folio-assistant", "completed", "2026-10-27T00:00:00Z"),
      copy("cat-harness", "completed", "2026-10-27T00:00:00Z"),
    ];
    expect(settleStatus(copies[0].text, copies)).toContain("status: completed\n");
  });
  test("completed against scrapped: the copy updated last wins", () => {
    const copies = [copy("folio-assistant", "completed", "2026-10-20T00:00:00Z"), copy("cat-harness", "scrapped", "2026-10-25T00:00:00Z")];
    expect(settleStatus(copies[0].text, copies)).toContain("status: scrapped\n");
  });
  test("copies that agree, or an unknown status, leave the text alone", () => {
    const same = [copy("a", "todo", "2026-10-20T00:00:00Z"), copy("b", "todo", "2026-10-21T00:00:00Z")];
    expect(settleStatus(same[0].text, same)).toBe(same[0].text);
    const odd = [copy("a", "todo", "2026-10-20T00:00:00Z"), copy("b", "parked", "2026-10-21T00:00:00Z")];
    expect(settleStatus(odd[0].text, odd)).toBe(odd[0].text);
  });
});

describe("withConflictNotes", () => {
  test("every other copy's hunk is kept, under a dated section per store", () => {
    const text = bean("todo", "2026-10-20T00:00:00Z", "Ours.");
    const out = withConflictNotes(text, [
      { where: "(three-way hunk)", kept: "Ours.", other: "Theirs, with ``` inside.", otherStore: "cat-harness" },
      { where: "(merged header does not parse, or repeats a key)", kept: "", other: "", otherStore: "-" },
    ], "2026-10-30");
    expect(out.startsWith(text.trimEnd())).toBe(true);
    expect(out).toContain("## Merged from the cat-harness copy (bean dedupe, 2026-10-30)");
    expect(out).toContain("````text\nTheirs, with ``` inside.\n````");
    expect(headerOk(out)).toBe(true);
  });
  test("no conflicts: the text is unchanged", () => {
    const text = bean("todo", "2026-10-20T00:00:00Z", "Ours.");
    expect(withConflictNotes(text, [], "2026-10-30")).toBe(text);
  });
});
