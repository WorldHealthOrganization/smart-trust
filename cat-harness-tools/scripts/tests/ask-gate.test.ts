/**
 * `ask-gate.ts` — the asking rule as a fail-open gate on decision cards
 * (bean `hajp`). The refusals are tested, and so is every way it must let a
 * card through.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { judge, optionMarker } from "../ask-gate.ts";

const prompt = (text: string) => ({ type: "user", message: { content: text } });
const toolResult = () => ({ type: "user", message: { content: [{ type: "tool_result", content: "ok" }] } });
const call = (name: string, input: Record<string, unknown>) => ({
  type: "assistant",
  message: { content: [{ type: "tool_use", name, input }] },
});
const post = (text: string) => call("mcp__hearthbot__post_message", { text });
const opts = [{ label: "A. Gate cards" }, { label: "B. Reminder only" }];

describe("judge", () => {
  test("a card with no written question since the last prompt is refused", () => {
    const v = judge(opts, [prompt("explain"), post("**A.** old"), prompt("next"), toolResult()]);
    expect(v.allow).toBe(false);
  });

  test("a written question naming every option lets the card through", () => {
    const v = judge(opts, [prompt("go"), post("**A. Gate** pro con\n\n**B. Reminder** pro con"), toolResult()]);
    expect(v).toEqual({ allow: true });
  });

  test("an option missing from the prose is named in the refusal", () => {
    const v = judge(opts, [prompt("go"), post("**A. Gate** only")]);
    expect(v.allow).toBe(false);
    if (!v.allow) expect(v.reason).toContain("B. Reminder only");
  });

  test("a letter inside a word does not count as naming the option", () => {
    expect(optionMarker("A. x").test("VIA. thing")).toBe(false);
    expect(optionMarker("A. x").test("(A) thing")).toBe(true);
  });

  test("an unlettered label must appear whole", () => {
    expect(judge([{ label: "Close it" }], [prompt("go"), post("I would close it.")])).toEqual({ allow: true });
  });

  test("it fails open on shapes it does not understand", () => {
    expect(judge(undefined, [])).toEqual({ allow: true });
    expect(judge([{}], [prompt("go")])).toEqual({ allow: true });
  });
});

describe("the hook, end to end", () => {
  const script = resolve(import.meta.dir, "../ask-well.sh");
  const run = (stdin: string) => spawnSync("bash", [script], { input: stdin, encoding: "utf8" });

  test("blocks with exit 2 on a bare card", () => {
    const dir = mkdtempSync(join(tmpdir(), "ask-gate-"));
    const t = join(dir, "t.jsonl");
    writeFileSync(t, [prompt("go")].map((l) => JSON.stringify(l)).join("\n"));
    const r = run(JSON.stringify({ tool_name: "mcp__hearthbot__request_decision", tool_input: { options: opts }, transcript_path: t }));
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("ask-gate");
  });

  test("fails open: unreadable transcript, garbage input, other tools", () => {
    expect(run(JSON.stringify({ tool_name: "mcp__hearthbot__request_decision", tool_input: { options: opts }, transcript_path: "/nonexistent" })).status).toBe(0);
    expect(run("not json").status).toBe(0);
    expect(run("").status).toBe(0);
    expect(run(JSON.stringify({ tool_name: "AskUserQuestion", tool_input: {} })).status).toBe(0);
  });
});
