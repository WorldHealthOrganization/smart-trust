/**
 * bootstrap's `logger` contract, held to what can be checked from bootstrap's
 * own files: the shape of the message the Logger must record, and where the
 * diagram lets a message reach it.
 *
 * The contract (bootstrap `skills/logger.md`) is the other side of
 * `log-message`: the author composes, the Logger records. In bootstrap the
 * Logger is the discussion the human actor is already in, so nothing here
 * can send it a line and read the line back; responsibilities 2–4 (attribute
 * it to the named actor, put it where a person reads it, report a failure to
 * record) are about that runtime, and a harness that installs a log sink
 * tests them against its Tool. What a file CAN hold the Logger to is below,
 * one `describe` per line of the contract it quotes.
 *
 * bootstrap runs nothing, so its contract's tests live here, beside
 * `knowledge-graph-data-store.test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseXml, type El } from "./export-graph.ts";

const BOOTSTRAP = join(import.meta.dir, "..", "..", "bootstrap");
const read = (rel: string) => readFileSync(join(BOOTSTRAP, rel), "utf-8");

const local = (name: string) => name.slice(name.indexOf(":") + 1);
function all(el: El, f: (e: El) => boolean, out: El[] = []): El[] {
  if (f(el)) out.push(el);
  for (const c of el.children) all(c, f, out);
  return out;
}

/** The message fields `log-message` defines: its table's first column, and which are optional. */
function authorFields(): { required: string[]; optional: string[] } {
  const md = read("skills/log-message.md");
  const table = /\| field \| what it answers \| shape \|\n\|[-| ]+\|\n((?:\|.*\|\n)+)/.exec(md)?.[1];
  expect(table).toBeDefined();
  const rows = table!.trim().split("\n").map((r) => r.split("|").map((c) => c.trim()));
  const name = (r: string[]) => /`([^`]+)`/.exec(r[1]!)![1]!;
  return {
    required: rows.filter((r) => !/optional/.test(r[3]!)).map(name),
    optional: rows.filter((r) => /optional/.test(r[3]!)).map(name),
  };
}

describe("1. record a complete message unchanged — the message it must accept", () => {
  test("contractNamesFiveFields", () => {
    const contract = read("skills/logger.md");
    const line = (/1\. \*\*Record a complete message unchanged\.\*\*([\s\S]*?)\n\n/.exec(contract)?.[1] ?? "").replace(/\s+/g, " ");
    const required = /five fields `log-message` requires \(([^)]*)\)/.exec(line)?.[1];
    expect(required).toBeDefined();
    const named = [...required!.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    const fields = authorFields();
    expect(named).toEqual(fields.required);
    expect(fields.required).toEqual(["timestamp", "actor", "process", "task", "message"]);
    expect(fields.optional).toEqual(["body"]);
    expect(line).toMatch(/`body` when given/);
  });
});

describe("Not its responsibility: composing the message, or judging whether it is complete", () => {
  const xml = parseXml(read("processes/log-message.bpmn"));
  const lanes = all(xml, (e) => local(e.name) === "lane");
  const loggerLane = lanes.find((l) => l.attrs["partitionElementRef"] === "logger");
  const flows = all(xml, (e) => local(e.name) === "sequenceFlow");
  const kindOf = new Map(all(xml, (e) => typeof e.attrs["id"] === "string").map((e) => [e.attrs["id"]!, local(e.name)]));

  test("loggerLaneHasNoGateway", () => {
    expect(lanes.filter((l) => l.attrs["partitionElementRef"] === "logger")).toHaveLength(1);
    const held = loggerLane!.children.filter((c) => local(c.name) === "flowNodeRef").map((c) => c.text.trim());
    expect(held.length).toBeGreaterThan(0);
    for (const id of held) expect(kindOf.get(id)).toMatch(/^(task|serviceTask|scriptTask|manualTask|sendTask|receiveTask)$/);
  });

  test("loggerOnlyOnCompleteBranch", () => {
    const held = new Set(loggerLane!.children.filter((c) => local(c.name) === "flowNodeRef").map((c) => c.text.trim()));
    const into = flows.filter((f) => held.has(f.attrs["targetRef"]!) && !held.has(f.attrs["sourceRef"]!));
    expect(into.length).toBeGreaterThan(0);
    for (const f of into) {
      const gateway = all(xml, (e) => e.attrs["id"] === f.attrs["sourceRef"])[0]!;
      expect(local(gateway.name)).toBe("exclusiveGateway");
      expect(gateway.attrs["name"]).toMatch(/all five present/i);
      expect(f.attrs["name"]).toBe("yes");
    }
  });

  test("incompleteEndsOutsideLogger", () => {
    const held = new Set(loggerLane!.children.filter((c) => local(c.name) === "flowNodeRef").map((c) => c.text.trim()));
    const no = flows.filter((f) => f.attrs["name"] === "no");
    expect(no).toHaveLength(1);
    const end = no[0]!.attrs["targetRef"]!;
    expect(kindOf.get(end)).toBe("endEvent");
    expect(held.has(end)).toBe(false);
  });
});
