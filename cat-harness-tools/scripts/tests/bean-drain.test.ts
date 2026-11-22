/**
 * The bean-drain Tools: `drain-queue`, `bean-claim-check`, `open-work-lookup`
 * (skill `bean-drain`, beans `n7x7` and `pomp`).
 *
 * The decisions are tested as pure functions, and the claim end to end
 * against two real bare repositories (the two bean copies), with GitHub
 * replaced by a fixed PR list. The f1e1 replay is the case the skill measures:
 * at 07:50Z the bean branch said nothing new, and only the open PR did.
 *
 * @module scripts/tests/bean-drain
 */
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { claimCheck } from "../bean-claim-check.ts";
import { group, mergeCopies } from "../drain-queue.ts";
import {
  agentOf,
  type BeanFile,
  BEAN_REF,
  type Commit,
  DEFAULT_AGENTS,
  exclusionOf,
  type GitHub,
  heldOnBranch,
  lookupOpenWork,
  mentionsBean,
  parseBean,
  type Pull,
  pullsNamingBean,
  recentCommits,
  windowMs,
} from "../lib/bean-drain.ts";

setDefaultTimeout(30_000);

const made: string[] = [];
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true });
});

const H = 3_600_000;
const AGY = "Carl Leitner <litlfred@fenugreek.home>";
const CLOUD = "Claude <noreply@anthropic.com>";
const ME = { agent: "cloud", session: "https://claude.ai/code/session_ME" };

const bean = (over: Partial<BeanFile> = {}): BeanFile => ({
  id: "folio-assistant-f1e1",
  path: "beans/defs/folio-assistant-f1e1--x.md",
  title: "t",
  status: "in-progress",
  type: "feature",
  priority: "normal",
  updatedAt: "2026-10-16T06:30:00Z",
  blockedBy: [],
  body: "",
  ...over,
});

describe("agents and windows", () => {
  test("an author is matched by email, and an unknown one is nobody", () => {
    expect(agentOf(AGY, DEFAULT_AGENTS)?.name).toBe("agy");
    expect(agentOf("litlfred <litlfred@users.noreply.github.com>", DEFAULT_AGENTS)?.name).toBe("cloud");
    expect(agentOf("Someone <x@y>", DEFAULT_AGENTS)).toBeUndefined();
  });
  test("windows are a count and a unit", () => {
    expect(windowMs("24h")).toBe(24 * H);
    expect(windowMs("2d")).toBe(48 * H);
    expect(windowMs("24")).toBeUndefined();
  });
});

describe("parseBean and exclusions", () => {
  const text = `---\n# folio-assistant-bssi\ntitle: 'A ''quoted'' title'\nstatus: todo\ntype: feature\npriority: high\nupdated_at: 2026-10-24T08:30:00Z\nparent: folio-assistant-ahvw\nblocked_by:\n    - folio-assistant-m8gz\n---\n\nbody\n`;
  const b = parseBean("beans/defs/folio-assistant-bssi--x.md", text)!;
  test("front matter fields, the block-style blocked_by list, and the parent", () => {
    expect(b.id).toBe("folio-assistant-bssi");
    expect(b.title).toBe("A 'quoted' title");
    expect(b.blockedBy).toEqual(["folio-assistant-m8gz"]);
    expect(b.parent).toBe("folio-assistant-ahvw");
  });
  test("blocked only while the blocker is open", () => {
    expect(exclusionOf(b, new Set(["folio-assistant-m8gz"]))?.reason).toBe("blocked");
    expect(exclusionOf(b, new Set())).toBeUndefined();
  });
  test("goals, epics, closed, drafts and owner-held beans are left out with a reason", () => {
    expect(exclusionOf(bean({ type: "milestone" }), new Set())?.reason).toBe("goal");
    expect(exclusionOf(bean({ type: "epic" }), new Set())?.reason).toBe("epic");
    expect(exclusionOf(bean({ status: "draft" }), new Set())?.reason).toBe("draft");
    expect(exclusionOf(bean({ body: "\n_2026-10-20_ — Owner said keep parked." }), new Set())?.reason).toBe("owner-held");
  });
});

describe("heldOnBranch reads activity, not status", () => {
  const at = (iso: string): Commit => ({ author: AGY, at: iso, subject: "beans(f1e1): record PRs" });
  test("another agent's commit inside the window holds it", () => {
    const now = Date.parse("2026-10-24T08:00:00Z");
    expect(heldOnBranch(bean(), [at("2026-10-24T07:52:57Z")], DEFAULT_AGENTS, ME, now, 24 * H)?.state).toBe("skip-recent-commit");
  });
  test("the f1e1 replay: at 07:50Z the branch alone says the bean is free", () => {
    // Both copies read in-progress since 2026-10-16 and had no newer commit.
    const now = Date.parse("2026-10-24T07:50:00Z");
    const commits: Commit[] = [{ author: CLOUD, at: "2026-10-16T10:06:45Z", subject: "beans: sync the copies" }];
    expect(heldOnBranch(bean(), commits, DEFAULT_AGENTS, ME, now, 24 * H)).toBeUndefined();
  });
  test("a sibling cloud thread's claim holds it; our own does not", () => {
    const now = Date.parse("2026-10-24T08:20:00Z");
    const sib: Commit = { author: CLOUD, at: "2026-10-24T08:15:00Z", subject: "beans: claim f1e1", session: "https://claude.ai/code/session_OTHER" };
    expect(heldOnBranch(bean(), [sib], DEFAULT_AGENTS, ME, now, 24 * H)?.state).toBe("skip-recent-commit");
    expect(heldOnBranch(bean(), [{ ...sib, session: ME.session }, at("2026-10-24T08:00:00Z")], DEFAULT_AGENTS, ME, now, 24 * H)).toBeUndefined();
  });
  test("the state bot's mirror commits never hold a bean", () => {
    const bot: Commit = { author: "folio-state-bot <folio-state-bot@users.noreply.github.com>", at: "2026-10-24T08:00:00Z", subject: "state: beans from its mount" };
    expect(heldOnBranch(bean(), [bot], DEFAULT_AGENTS, ME, Date.parse("2026-10-24T08:10:00Z"), 24 * H)).toBeUndefined();
  });
});

const pull = (n: number, title: string, ref: string, created: string, body = ""): Pull => ({ number: n, title, body, created_at: created, user: { login: "litlfred" }, head: { ref, sha: "0".repeat(40) } });

describe("open work naming a bean", () => {
  test("a bean id is a word, not a substring", () => {
    expect(mentionsBean("identity: name who is typing (f1e1)", "folio-assistant-f1e1")).toBe(true);
    expect(mentionsBean("feat/f1e1-host", "f1e1")).toBe(true);
    expect(mentionsBean("xf1e1y", "f1e1")).toBe(false);
  });
  test("the f1e1 replay: agy's PR was open before the second start, and it names the bean", () => {
    const pulls = [pull(686, "feat(identity): ... (folio-assistant-f1e1)", "feat/f1e1-host-and-multiuser-identity", "2026-10-24T07:47:35Z")];
    const hits = pullsNamingBean("litlfred/cat-harness-tools", pulls, "f1e1");
    expect(hits.map((h) => h.pr)).toEqual([686]);
  });
  test("an unreadable repository is listed, so no hits is not absence", () => {
    const gh: GitHub = {
      openPulls: () => ({ ok: false, reason: "HTTP 403" }),
      pullFiles: () => ({ ok: true, value: [] }),
      firstCommitAuthor: () => undefined,
      onDefault: () => false,
      defaultPathsUnder: () => [],
    };
    const r = lookupOpenWork({ kind: "path", value: "scripts/x.ts" }, ["a/b"], gh);
    expect(r.hits).toEqual([]);
    expect(r.unread).toEqual(["a/b: HTTP 403"]);
  });
  test("a path found only on an open PR head (pomp case 3)", () => {
    const gh: GitHub = {
      openPulls: () => ({ ok: true, value: [pull(7, "viewer prune", "claude/prune", "2026-10-24T07:00:00Z")] }),
      pullFiles: () => ({ ok: true, value: ["scripts/viewer-prune.ts"] }),
      firstCommitAuthor: () => CLOUD,
      onDefault: () => false,
      defaultPathsUnder: () => [],
    };
    const r = lookupOpenWork({ kind: "prefix", value: "scripts/viewer-" }, ["a/b"], gh);
    expect(r.hits).toEqual([{ repo: "a/b", where: "open-pr", pr: 7, head: "claude/prune", author: CLOUD, createdAt: "2026-10-24T07:00:00Z", match: "file", paths: ["scripts/viewer-prune.ts"] }]);
  });
});

describe("drain-queue merge and grouping", () => {
  test("the newest updated_at wins and a disagreement is listed", () => {
    const a = bean({ status: "completed", updatedAt: "2026-10-24T07:00:00Z" });
    const b = bean({ status: "in-progress", updatedAt: "2026-10-16T06:30:00Z" });
    const m = mergeCopies([{ repo: "fa", beans: [a] }, { repo: "ch", beans: [b] }]);
    expect(m.beans.get(a.id)?.status).toBe("completed");
    expect(m.disagreements).toEqual([{ id: a.id, byCopy: { fa: "completed", ch: "in-progress" }, used: "fa" }]);
  });
  test("a bean goes to its holder, else to the owner of a sibling under the same parent, else spare", () => {
    const e = (id: string, parent?: string) => ({ id, title: id, status: "todo", type: "task", priority: "normal", ...(parent ? { parent } : {}) });
    const parents = new Map<string, string | undefined>([["held", "P"], ["sib", "P"], ["lone", "Q"]]);
    const g = group([e("held", "P"), e("sib", "P"), e("lone", "Q")], { "BPMN thread": ["held"] }, parents);
    expect(g.byOwner).toEqual([{ owner: "BPMN thread", beans: [e("held"), e("sib")].map(({ id }) => ({ id, title: id, status: "todo", type: "task", priority: "normal" })) }]);
    expect(g.spare.map((x) => x.id)).toEqual(["lone"]);
  });
});

// ── End to end: two copies, real git ─────────────────────────────────────

function sh(cwd: string, ...args: string[]): string {
  return shAt(cwd, undefined, ...args);
}

function shAt(cwd: string, date: string | undefined, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}), GIT_AUTHOR_NAME: "Carl Leitner", GIT_AUTHOR_EMAIL: "litlfred@fenugreek.home", GIT_COMMITTER_NAME: "Carl Leitner", GIT_COMMITTER_EMAIL: "litlfred@fenugreek.home" } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

/** A bare remote with one bean on the bean branch, and a clone of it. */
function copy(name: string, status = "todo"): string {
  const root = mkdtempSync(join(tmpdir(), `drain-${name}-`));
  made.push(root);
  const bare = join(root, "remote.git");
  sh(root, "init", "-q", "--bare", bare);
  const work = join(root, "work");
  sh(root, "init", "-q", "-b", BEAN_REF, work);
  mkdirSync(join(work, "beans/defs"), { recursive: true });
  writeFileSync(join(work, "beans/defs/folio-assistant-q9z9--a-bean.md"), `---\n# folio-assistant-q9z9\ntitle: A bean\nstatus: ${status}\ntype: task\npriority: normal\nupdated_at: 2026-10-01T00:00:00Z\n---\n\nBody.\n`);
  sh(work, "add", "-A");
  shAt(work, "2026-10-01T00:00:00Z", "commit", "-q", "-m", "seed");
  sh(work, "remote", "add", "origin", bare);
  sh(work, "push", "-q", "origin", `HEAD:refs/heads/${BEAN_REF}`);
  // Leave the clone on another branch: the claim must not need a checkout of the bean branch.
  sh(work, "checkout", "-q", "-b", "my-feature");
  return work;
}

const noPulls: GitHub = {
  openPulls: () => ({ ok: true, value: [] }),
  pullFiles: () => ({ ok: true, value: [] }),
  firstCommitAuthor: () => undefined,
  onDefault: () => false,
  defaultPathsUnder: () => [],
};

describe("claimCheck end to end", () => {
  // The claim commit is made as whoever runs the tool. A CI runner has no git
  // identity configured, so give the claimant one: the cloud agent.
  // Set in beforeAll, not in the describe body: bun runs every test file in
  // one process and collects describe bodies up front, so an assignment here
  // would leak into other files' tests.
  const saved: Record<string, string | undefined> = {};
  beforeAll(() => {
    for (const k of ["AUTHOR", "COMMITTER"]) for (const f of ["NAME", "EMAIL"]) saved[`GIT_${k}_${f}`] = process.env[`GIT_${k}_${f}`];
    for (const k of ["AUTHOR", "COMMITTER"]) {
      process.env[`GIT_${k}_NAME`] = "Claude";
      process.env[`GIT_${k}_EMAIL`] = "noreply@anthropic.com";
    }
  });
  afterAll(() => {
    for (const k of ["AUTHOR", "COMMITTER"]) for (const f of ["NAME", "EMAIL"]) {
      const key = `GIT_${k}_${f}`;
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  const opts = (copies: string[], gh: GitHub = noPulls) => ({ copies, repos: [], minePrs: [], agents: DEFAULT_AGENTS, me: ME, windowMs: 24 * H, dryRun: false, gh, now: () => new Date() });

  test("a free bean is claimed by a plain commit on BOTH copies, without touching the checkout", () => {
    const a = copy("a");
    const b = copy("b");
    const r = claimCheck("q9z9", opts([a, b]));
    expect(r.state).toBe("claimed");
    for (const w of [a, b]) {
      sh(w, "fetch", "-q", "origin", BEAN_REF);
      const text = sh(w, "show", `FETCH_HEAD:beans/defs/folio-assistant-q9z9--a-bean.md`);
      expect(text).toMatch(/^status: in-progress$/m);
      expect(text).toContain(ME.session);
      expect(sh(w, "log", "-1", "--format=%(trailers:key=Claude-Session,valueonly)", "FETCH_HEAD").trim()).toBe(ME.session);
      expect(sh(w, "log", "-1", "--format=%an <%ae>", "FETCH_HEAD").trim()).toBe(CLOUD);
      expect(sh(w, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("my-feature");
    }
  });

  test("an open PR naming the bean stops the claim, and nothing is written", () => {
    const a = copy("c");
    const gh: GitHub = { ...noPulls, openPulls: () => ({ ok: true, value: [pull(686, "work on q9z9", "feat/q9z9", "2026-10-24T07:47:35Z")] }), firstCommitAuthor: () => AGY };
    const r = claimCheck("q9z9", opts([a], gh));
    expect(r.state).toBe("skip-open-pr");
    expect(r.reason).toContain("#686");
    sh(a, "fetch", "-q", "origin", BEAN_REF);
    expect(sh(a, "show", "FETCH_HEAD:beans/defs/folio-assistant-q9z9--a-bean.md")).toMatch(/^status: todo$/m);
  });

  test("another agent's fresh commit on the bean is a skip", () => {
    const a = copy("d");
    // The seed commit is agy's (see sh) but dated 2026-10-01; add a fresh one.
    sh(a, "fetch", "-q", "origin", BEAN_REF);
    sh(a, "checkout", "-q", "FETCH_HEAD");
    writeFileSync(join(a, "beans/defs/folio-assistant-q9z9--a-bean.md"), `---\n# folio-assistant-q9z9\ntitle: A bean\nstatus: in-progress\ntype: task\npriority: normal\nupdated_at: 2026-10-24T00:00:00Z\n---\n\nBody.\n`);
    sh(a, "commit", "-q", "-am", "beans(q9z9): agy works it");
    sh(a, "push", "-q", "origin", `HEAD:refs/heads/${BEAN_REF}`);
    const r = claimCheck("q9z9", opts([a]));
    expect(r.state).toBe("skip-recent-commit");
    expect(r.reason).toContain("agy");
  });

  test("an unreachable copy is unknown, never free", () => {
    const r = claimCheck("q9z9", opts([join(tmpdir(), "no-such-copy-xyz")]));
    expect(r.state).toBe("unknown");
  });

  test("recentCommits reads a glob pathspec, as the skill's command does", () => {
    const a = copy("e");
    sh(a, "fetch", "-q", "origin", BEAN_REF);
    expect(recentCommits(a, "FETCH_HEAD", "beans/defs/*q9z9--*").length).toBe(1);
  });
});
