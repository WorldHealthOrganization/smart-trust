/**
 * A layer's QA page reads its results in the browser (owner card, 2026-11-10:
 * "Load in the browser"): what the page carries, and what the script does with
 * each answer GitHub can give.
 *
 * @module scripts/tests/qa-live
 */
import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { QA_LIVE_JS, qaLivePanel, qaLiveSourceOf } from "../qa-live.ts";

const MOUNT = { repository: "litlfred/fhir-harness", ref: "3f8099be93c7fe73dad16483fb8e018fd87e52bd" };
const SUBJECT = { name: "fhir-harness", path: "test/results/", storage: "cat/cat-harness/qa-reports" };

describe("qaLiveSourceOf", () => {
  test("names the layer's repository, pinned commit, branch and entry root", () => {
    expect(qaLiveSourceOf(SUBJECT, MOUNT)).toEqual({
      repository: "litlfred/fhir-harness",
      ref: MOUNT.ref,
      branch: "cat/cat-harness/qa-reports",
      root: "fhir-harness/test/results",
    });
  });
  test("is undefined without a storage branch or a plain pin", () => {
    expect(qaLiveSourceOf({ ...SUBJECT, storage: undefined }, MOUNT)).toBeUndefined();
    expect(qaLiveSourceOf(SUBJECT, undefined)).toBeUndefined();
    expect(qaLiveSourceOf(SUBJECT, { ...MOUNT, ref: "main" })).toBeUndefined();
    expect(qaLiveSourceOf({ ...SUBJECT, storage: 'x"><script>' }, MOUNT)).toBeUndefined();
  });
});

describe("qaLivePanel", () => {
  const html = qaLivePanel(qaLiveSourceOf(SUBJECT, MOUNT)!);
  test("carries the source as data attributes and a no-script link", () => {
    expect(html).toContain('data-repo="litlfred/fhir-harness"');
    expect(html).toContain(`data-ref="${MOUNT.ref}"`);
    expect(html).toContain('data-root="fhir-harness/test/results"');
    expect(html).toContain("<noscript>");
  });
  test("holds nothing Liquid would evaluate", () => {
    expect(html).not.toContain("{{");
    expect(html).not.toContain("{%");
  });
});

/** Runs the page script over one panel with `fetch` answered from `answers` (URL substring → JSON or a status). */
async function runScript(answers: Array<[string, unknown | number]>, click?: string): Promise<string> {
  const texts: string[] = [];
  const rows: Array<{ text: string; fire: () => void }> = [];
  const node = (tag: string): Record<string, unknown> => {
    const kids: Array<Record<string, unknown>> = [];
    const n: Record<string, unknown> = {
      tag,
      kids,
      className: "",
      set textContent(v: string) {
        kids.length = 0;
        if (v) texts.push(v);
      },
      appendChild(c: Record<string, unknown>) {
        kids.push(c);
        return c;
      },
      insertBefore(c: Record<string, unknown>) {
        kids.push(c);
        return c;
      },
      removeChild() {},
      setAttribute() {},
      addEventListener(type: string, fn: () => void) {
        if (type === "click") rows.push({ text: texts.slice(-6).join(" "), fire: fn });
      },
    };
    return n;
  };
  const box = node("div");
  const attrs: Record<string, string> = {
    "data-repo": MOUNT.repository,
    "data-ref": MOUNT.ref,
    "data-branch": SUBJECT.storage,
    "data-root": "fhir-harness/test/results",
  };
  (box as { getAttribute?: (k: string) => string }).getAttribute = (k) => attrs[k]!;
  const urls: string[] = [];
  const document = {
    querySelectorAll: () => [box],
    createElement: (t: string) => node(t),
    createTextNode: (t: string) => {
      texts.push(t);
      return { t };
    },
  };
  const fetch = async (u: string) => {
    urls.push(u);
    const hit = answers.find(([k]) => u.includes(k));
    const v = hit?.[1] ?? 404;
    return typeof v === "number" ? { ok: false, status: v, json: async () => ({}) } : { ok: true, status: 200, json: async () => v };
  };
  runInNewContext(QA_LIVE_JS, { document, fetch, Promise, Error, String, Object });
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  if (click) {
    const before = texts.length;
    rows.find((r) => r.text.includes(click))!.fire();
    return texts.slice(before).join("\n");
  }
  return texts.join("\n") + "\nURLS\n" + urls.join("\n");
}

const RECORD = (id: string, fail: number) => ({
  $schema: "kg-qa/v1",
  subject: { kind: "tool", id, path: `tools/${id}.json` },
  criteria: {
    "tool-b": { result: "n/a", findings: [] },
    "tool-a": { result: fail ? "fail" : "pass", findings: fail ? [{ where: "Task_X", detail: "names no tool" }] : [] },
  },
  totals: { pass: fail ? 0 : 1, fail, "n/a": 1, unknown: 0 },
});

describe("the page script", () => {
  test("draws the pinned commit's entry, failing subjects first", async () => {
    const out = await runScript([
      [`main/${MOUNT.ref}/manifest.json`, { written_at: "2026-11-10T20:58:55Z", producer: { run: "https://github.com/litlfred/fhir-harness/actions/runs/1" } }],
      ["api.github.com", { tree: [{ type: "blob", path: "kg-qa/tools/a.kg-qa.json" }, { type: "blob", path: "kg-qa/tools/b.kg-qa.json" }, { type: "blob", path: "kg-qa.manifest.json" }] }],
      ["a.kg-qa.json", RECORD("a", 0)],
      ["b.kg-qa.json", RECORD("b", 1)],
    ]);
    expect(out).toContain("2 subject(s) audited: 1 with a failing check");
    expect(out).toContain("1 pass, 1 fail, 2 n/a, 0 unknown");
    expect(out).toContain("1 other file(s)");
    expect(out.indexOf("\nb\n")).toBeLessThan(out.indexOf("\na\n"));
    expect(out).not.toContain("ANOTHER commit");
  });
  test("draws the node-view coverage reports as their own table, unknown kept as a word", async () => {
    const out = await runScript([
      [`main/${MOUNT.ref}/manifest.json`, { written_at: "x" }],
      ["api.github.com", { tree: [{ type: "blob", path: "kg-qa/tools/a.kg-qa.json" }, { type: "blob", path: "node-views/fhir-harness.node-views.qa.json" }] }],
      ["a.kg-qa.json", RECORD("a", 0)],
      [
        "node-views.qa.json",
        {
          $schema: "node-view-coverage/v1",
          rows: [
            { directory: "fh-tools", path: "tools/", kind: "tools", viewer: { state: "declared", id: "cat-harness/tools" }, declared: 3, withIri: 3, withJsonld: 2, withPage: 1, listed: 1, deadLinks: ["x/"], rawRepoLinks: 0 },
            { directory: "qa", path: "test/results/", kind: "qa", viewer: { state: "none" }, declared: "unknown", withIri: "unknown", withJsonld: "unknown", withPage: "unknown", listed: "unknown", deadLinks: [], rawRepoLinks: "unknown" },
          ],
        },
      ],
    ]);
    expect(out).toContain("Node-view coverage");
    expect(out).not.toContain("other file(s)");
    expect(out).toContain("fh-tools (tools/)");
    expect(out).toContain("cat-harness/tools");
    expect(out).toContain("qa (test/results/)\nqa\nnone\nunknown");
  });
  test("clicking a row shows its checks, failures first, with their findings", async () => {
    const out = await runScript(
      [
        [`main/${MOUNT.ref}/manifest.json`, { written_at: "x" }],
        ["api.github.com", { tree: [{ type: "blob", path: "kg-qa/tools/b.kg-qa.json" }] }],
        ["b.kg-qa.json", RECORD("b", 1)],
      ],
      "tool-a",
    );
    expect(out).toContain("tools/b.json");
    expect(out).toContain("Full record");
    expect(out).toContain("Task_X: names no tool");
    expect(out.indexOf("tool-a")).toBeLessThan(out.indexOf("tool-b"));
  });
  test("falls back to the newest main entry and says it is another commit's", async () => {
    const out = await runScript([
      ["index.json", { main: { sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" } }],
      ["main/aaaaaaaa", { written_at: "x" }],
      ["api.github.com", { tree: [] }],
    ]);
    expect(out).toContain("ANOTHER commit");
    expect(out).toContain("0 subject(s) audited");
  });
  test("a layer with no branch is 'not available', never an empty table", async () => {
    const out = await runScript([]);
    expect(out).toContain("no QA results are published for this layer yet");
    expect(out).not.toContain("subject(s) audited");
  });
  test("an unreachable GitHub is unknown, not zero", async () => {
    const out = await runScript([[`main/${MOUNT.ref}/manifest.json`, 503]]);
    expect(out).toContain("unknown, not zero");
  });
});
