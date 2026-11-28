/**
 * The integrated QA page of an instance (owner, 2026-11-24: "build integrated
 * page into platform"): what the page carries, and what its script draws from
 * each answer the forge can give — one tile per axis from the manifest's
 * listing, sections drawn on open, records fetched when their row is opened.
 *
 * @module scripts/tests/qa-page
 */
import { describe, expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import { GITHUB_FORGE, QA_PAGE_JS, qaIntegratedPanel, qaLiveSourceOf, type QaForge } from "../qa-page.ts";
import type { QaDeclaration } from "../../schemas/sdlc/qa-axis.ts";
import { QA_AXES, QA_AXIS_TITLES, QA_FORMAT_RULES } from "../../schemas/sdlc/qa-axis.ts";

const MOUNT = { repository: "o/fhir-harness", ref: "3f8099be93c7fe73dad16483fb8e018fd87e52bd" };
const SUBJECT = { name: "fhir-harness", path: "test/results/", storage: "cat/cat-harness/qa-reports" };
const ROOT = "fhir-harness/test/results";

describe("qaLiveSourceOf", () => {
  test("names the layer's repository, pinned commit, branch and entry root", () => {
    expect(qaLiveSourceOf(SUBJECT, MOUNT)).toEqual({ repository: MOUNT.repository, ref: MOUNT.ref, branch: "cat/cat-harness/qa-reports", root: ROOT });
  });
  test("is undefined without a storage branch or a plain pin", () => {
    expect(qaLiveSourceOf({ ...SUBJECT, storage: undefined }, MOUNT)).toBeUndefined();
    expect(qaLiveSourceOf(SUBJECT, undefined)).toBeUndefined();
    expect(qaLiveSourceOf(SUBJECT, { ...MOUNT, ref: "main" })).toBeUndefined();
    expect(qaLiveSourceOf({ ...SUBJECT, storage: 'x"><script>' }, MOUNT)).toBeUndefined();
  });
});

describe("qaIntegratedPanel", () => {
  const src = qaLiveSourceOf(SUBJECT, MOUNT)!;
  const html = qaIntegratedPanel(src, { sections: [{ id: "health", title: "Health", href: "../../health/fhir-harness/" }] });
  test("carries the source as data attributes, a no-script link and the further sections", () => {
    expect(html).toContain(`data-repo="${MOUNT.repository}"`);
    expect(html).toContain(`data-ref="${MOUNT.ref}"`);
    expect(html).toContain(`data-root="${ROOT}"`);
    expect(html).toContain("<noscript>");
    expect(html).toContain('href="../../health/fhir-harness/"');
  });
  test("holds nothing Liquid would evaluate", () => {
    expect(html).not.toContain("{{");
    expect(html).not.toContain("{%");
  });
  test("names no forge host in the script: the forge is data", () => {
    expect(QA_PAGE_JS).not.toContain("github");
    const other: QaForge = { raw: "https://forge.example/{repo}/raw/{branch}/{path}", tree: "https://forge.example/{repo}/src/{branch}/{path}", blob: "https://forge.example/{repo}/src/{ref}/{path}" };
    expect(qaIntegratedPanel(src, { forge: other })).not.toContain("githubusercontent");
  });
});

interface Fake {
  tag: string;
  kids: Fake[];
  text: string;
  attrs: Record<string, string>;
  on: Record<string, () => void>;
  open?: boolean;
  [k: string]: unknown;
}

/** A DOM small enough to run the page script over: text, children, attributes, listeners. */
function fakeDom() {
  const node = (tag: string): Fake => {
    const n: Fake = {
      tag,
      kids: [],
      text: "",
      attrs: {},
      on: {},
      className: "",
      set textContent(v: string) {
        n.kids.length = 0;
        n.text = v ?? "";
      },
      appendChild(c: Fake) {
        n.kids.push(c);
        return c;
      },
      insertBefore(c: Fake, ref: Fake) {
        const i = n.kids.indexOf(ref);
        n.kids.splice(i < 0 ? n.kids.length : i, 0, c);
        return c;
      },
      removeChild(c: Fake) {
        n.kids.splice(n.kids.indexOf(c), 1);
      },
      setAttribute(k: string, v: string) {
        n.attrs[k] = v;
      },
      getAttribute(k: string) {
        return n.attrs[k];
      },
      addEventListener(type: string, fn: () => void) {
        n.on[type] = fn;
      },
    };
    return n;
  };
  const textOf = (n: Fake | { t: string }): string =>
    "t" in n ? (n as { t: string }).t : [(n as Fake).text, ...(n as Fake).kids.map((k) => textOf(k as Fake))].filter(Boolean).join(" ");
  const all = (n: Fake): Fake[] => [n, ...n.kids.filter((k) => "kids" in k).flatMap((k) => all(k))];
  return { node, textOf, all };
}

async function settle() {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0));
}

/** Runs the page script over one panel with `fetch` answered from `answers` (URL substring → JSON or a status). */
async function runScript(answers: Array<[string, unknown | number]>, decl?: QaDeclaration, forge?: QaForge) {
  const { node, textOf, all } = fakeDom();
  const box = node("div");
  const html = qaIntegratedPanel(qaLiveSourceOf(SUBJECT, MOUNT)!, { decl, forge });
  const cfg = /data-config="([^"]*)"/.exec(html)![1]!.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&");
  Object.assign(box.attrs, { "data-repo": MOUNT.repository, "data-ref": MOUNT.ref, "data-branch": SUBJECT.storage, "data-root": ROOT, "data-config": cfg });
  const urls: string[] = [];
  const document = { querySelectorAll: () => [box], createElement: (t: string) => node(t), createTextNode: (t: string) => ({ t, kids: [] }) };
  const fetch = async (u: string) => {
    urls.push(u);
    // A key that is a whole origin matches by host, never as a substring of
    // the URL; any other key is a path fragment of the entry.
    const hit = answers.find(([k]) => (/^https:\/\/[^/]+$/.test(k) ? new URL(u).origin === k : u.includes(k)));
    const v = hit?.[1] ?? 404;
    if (v instanceof Error) throw v;
    return typeof v === "number" ? { ok: false, status: v, json: async () => ({}) } : { ok: true, status: 200, json: async () => v };
  };
  runInNewContext(QA_PAGE_JS, { document, fetch, Promise, Error, String, Object, JSON, RegExp, Array, encodeURIComponent });
  await settle();
  return { box, urls, text: () => textOf(box), all: () => all(box) };
}

const KG = (id: string, fail: number) => ({
  $schema: "kg-qa/v1",
  subject: { kind: "tool", id, path: `tools/${id}.json` },
  criteria: {
    "tool-b": { result: "n/a", findings: [] },
    "tool-a": { result: fail ? "fail" : "pass", findings: fail ? [{ where: "Task_X", detail: "names no tool" }] : [] },
  },
  totals: { pass: fail ? 0 : 1, fail, "n/a": 1, unknown: 0 },
});

const MANIFEST = {
  written_at: "2026-11-24T10:00:00Z",
  producer: { run: "https://ci.example/run/1" },
  listing: [
    { path: `${ROOT}/kg-qa/tools/a.kg-qa.json`, schema: "kg-qa/v1", axis: "kg", subject: "tool:a", counts: { pass: 1, na: 1, unknown: 0, fail: 0 } },
    { path: `${ROOT}/kg-qa/tools/b.kg-qa.json`, schema: "kg-qa/v1", axis: "kg", subject: "tool:b", counts: { pass: 0, fail: 1, na: 1, unknown: 0 } },
    { path: `${ROOT}/rendering/paper.render-qa.json`, schema: "folio-paper-render-qa/v1", axis: "rendering", counts: { pass: 4, warn: 1 } },
    { path: `${ROOT}/odd/thing.json` },
    { path: "other-layer/test/results/x.kg-qa.json", schema: "kg-qa/v1", axis: "kg", counts: { fail: 9 } },
  ],
};

describe("the page script", () => {
  test("one tile per axis from the listing alone: no tree API call, other roots ignored", async () => {
    const r = await runScript([[`main/${MOUNT.ref}/manifest.json`, MANIFEST]]);
    const t = r.text();
    expect(r.urls.some((u) => new URL(u).hostname === "api.github.com")).toBe(false);
    expect(r.urls).toHaveLength(1);
    expect(t).toContain("Knowledge graph fail 2 records: 1 fail · 0 unknown · 1 pass · 2 n/a");
    expect(t).toContain("Rendering warn 1 record: 1 warn · 4 pass");
    expect(t).toContain("Unclassified unknown 1 record: 1 not counted");
    expect(t).not.toContain("9 fail");
    expect(t.indexOf("Rendering")).toBeLessThan(t.indexOf("Knowledge graph"));
  });

  test("a declared axis with nothing published is unknown, never absent or zero", async () => {
    const r = await runScript([[`main/${MOUNT.ref}/manifest.json`, MANIFEST]], { axes: ["lean"] });
    expect(r.text()).toContain("Lean unknown nothing published");
  });

  test("a declared writer's globs put its files on its axis", async () => {
    const r = await runScript([[`main/${MOUNT.ref}/manifest.json`, MANIFEST]], { writers: [{ id: "odd", axis: "compute", run: "true", writes: ["odd/**"] }] });
    expect(r.text()).toContain("Compute unknown 1 record");
    expect(r.text()).not.toContain("Unclassified");
  });

  test("a section's table is drawn on open, and a row fetches its record's checks", async () => {
    const r = await runScript([
      [`main/${MOUNT.ref}/manifest.json`, MANIFEST],
      ["b.kg-qa.json", KG("b", 1)],
    ]);
    const sec = r.all().find((n) => n.tag === "details" && n.id === "qa-axis-kg")!;
    expect(r.text()).not.toContain("tool:b");
    sec.open = true;
    sec.on.toggle!();
    expect(r.text()).toContain("tool:b");
    const row = r.all().find((n) => n.tag === "tr" && n.className === "sv-qa-live-row" && n.kids[0]!.text === "tool:b")!;
    row.on.click!();
    await settle();
    const t = r.text();
    expect(t).toContain("Task_X: names no tool");
    expect(t.indexOf("tool-a")).toBeLessThan(t.indexOf("tool-b"));
    expect(t).toContain("full record");
  });

  test("an entry with no listing falls back to the tree listing, and says so", async () => {
    const r = await runScript([
      [`main/${MOUNT.ref}/manifest.json`, { written_at: "x" }],
      ["https://api.github.com", { tree: [{ type: "blob", path: "kg-qa/tools/a.kg-qa.json" }] }],
    ]);
    expect(r.text()).toContain("predates the published listing");
    expect(r.text()).toContain("Knowledge graph unknown 1 record: 1 not counted");
  });

  test("falls back to the newest main entry and says it is another commit's", async () => {
    const r = await runScript([
      ["index.json", { main: { sha: "a".repeat(40) } }],
      ["main/aaaaaaaa", { written_at: "x", listing: [] }],
    ]);
    expect(r.text()).toContain("ANOTHER commit");
  });

  // The raw host answers 404 both for a branch that is absent and for a
  // repository this browser may not read, so the page asks the forge which.
  const REPO_API = `https://api.github.com/repos/${MOUNT.repository}`;
  const BRANCH_API = `${REPO_API}/branches/`;

  test("a readable repository with no branch says the branch is absent, never an empty page", async () => {
    const r = await runScript([[BRANCH_API, 404], [REPO_API, { private: false }]]);
    expect(r.text()).toContain(`No QA results are published for this instance yet: ${MOUNT.repository} has no ${SUBJECT.storage} branch.`);
    expect(r.text()).not.toContain("signing in");
    expect(r.urls.some((u) => u.startsWith(BRANCH_API))).toBe(true);
  });

  test("a repository the browser cannot read is 'not readable', never 'no branch'", async () => {
    const r = await runScript([]);
    const t = r.text();
    expect(t).toContain("cannot be read here");
    expect(t).toContain("is not readable without signing in (the repository is private, or does not exist for this browser)");
    expect(t).toContain("unknown, not absent");
    expect(t).not.toContain("has no");
    const a = r.all().find((n) => n.tag === "a")!;
    expect(a.href).toBe(`https://github.com/${MOUNT.repository}/tree/${SUBJECT.storage}`);
    expect(a.text).toContain("signed in");
  });

  test("a raw host that refuses outright (401/403) is unreadable, with no probe", async () => {
    for (const status of [401, 403]) {
      const r = await runScript([[`main/${MOUNT.ref}/manifest.json`, status]]);
      expect(r.text()).toContain(`the forge answered HTTP ${status}: the repository is private or this browser has no access`);
      expect(r.urls).toHaveLength(1);
    }
  });

  test("a branch that exists with no index.json says so", async () => {
    const r = await runScript([[BRANCH_API, { name: SUBJECT.storage }], [REPO_API, { private: false }]]);
    expect(r.text()).toContain("exists but holds no index.json");
  });

  test("a rate-limited probe says it cannot tell, rather than guessing", async () => {
    const r = await runScript([[REPO_API, 403]]);
    expect(r.text()).toContain("Could not tell whether");
    expect(r.text()).not.toContain("has no");
  });

  test("a network failure is unknown, not absent", async () => {
    const r = await runScript([[`main/${MOUNT.ref}/manifest.json`, new TypeError("Failed to fetch")]]);
    expect(r.text()).toContain("Could not reach the forge");
    expect(r.text()).toContain("Failed to fetch");
  });

  test("a forge with no repository API cannot tell the two apart, and says both", async () => {
    const { repoApi: _r, branchApi: _b, ...bare } = GITHUB_FORGE;
    const r = await runScript([], undefined, bare);
    expect(r.text()).toContain("either");
    expect(r.text()).toContain("private");
  });

  test("an unreachable forge is unknown, not zero", async () => {
    const r = await runScript([[`main/${MOUNT.ref}/manifest.json`, 503]]);
    expect(r.text()).toContain("unknown, not zero");
  });
});

describe("the page and the publisher share one vocabulary", () => {
  test("the config the page carries is the schema module's", () => {
    const html = qaIntegratedPanel(qaLiveSourceOf(SUBJECT, MOUNT)!);
    const cfg = JSON.parse(/data-config="([^"]*)"/.exec(html)![1]!.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
    expect(cfg.order).toEqual([...QA_AXES]);
    expect(cfg.titles).toEqual(QA_AXIS_TITLES);
    expect(cfg.rules).toEqual(JSON.parse(JSON.stringify(QA_FORMAT_RULES)));
    expect(cfg.forge).toEqual(GITHUB_FORGE);
  });
});
