/**
 * `publishRoute` on REAL git repositories: a bare remote over `file://` and a
 * checkout whose declaration sets `storage: { keyedBy: "route" }`.
 *
 * Same practice as `branch-mount.test.ts` — a rejected push and a real tip are
 * things a remote does, so a stub would only test the stub.
 *
 * Owner's choice, 2026-10-04, of three shapes put to them: a route-keyed branch
 * had NO writer, because `mountTip`/`pushMount` open the store with no
 * `keyedBy` and so default to `tip` — measured `corrupt` against the real
 * `cat/cat-harness/uml-overview`. Bean `xsrv`.
 *
 * **The load-bearing test is the WHOLESALE half.** `write` is a splice — "every
 * path not named is carried across untouched" — and a route's contract is that
 * its one generator replaces it wholesale. A `publish` that only writes would
 * serve a page the generator stopped emitting for ever, and it would render
 * perfectly while doing it, which is why no other check would catch it.
 *
 * @module scripts/tests/route-publish.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { MANIFEST_SCHEMA, publishRoute } from "../../branch-store.js";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const BRANCH = "cat/fixture/uml-overview";
const ROUTE = "docs/uml/overview";
const ID = "uml-pages";

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", [...NOGPG, ...args], { cwd, encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} → ${r.status}\n${r.stderr}`);
  return r.stdout;
}

const made: string[] = [];
afterEach(() => {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
});

interface Fixture {
  root: string;
  opts: { repoRoot: string; store: { storeDir: string; sleep: () => void; log: () => void } };
  /** Write a file into the CHECKOUT at a route-relative name. */
  local: (name: string, text: string) => void;
  removeLocal: (name: string) => void;
  /** The remote's blob at the tip, as text; undefined when the path is absent. `under` defaults to the route. */
  remote: (name: string, under?: string) => string | undefined;
  tip: () => string;
  /** Put a file on the BRANCH behind the publisher's back. `under` defaults to the route. */
  pushToBranch: (name: string, text: string, under?: string) => void;
}

/**
 * @param keyedBy what the DECLARATION claims. `"tip"` is the refusal case.
 * @param onBranch the route's contents at the seeded tip.
 * @param inCheckout the route's contents in the working tree.
 */
function fixture(
  keyedBy: "route" | "tip" | "commit",
  onBranch: Record<string, string>,
  inCheckout: Record<string, string>,
  opts: { gitignore?: string } = {},
): Fixture {
  const base = mkdtempSync(join(tmpdir(), "route-publish-"));
  made.push(base);
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const url = `file://${bare}`;

  // The seeded route branch: a root manifest whose `keyedBy` the store must agree
  // with, plus the route's files at paths mirroring the checkout.
  const seed = join(base, "seed");
  mkdirSync(seed);
  git(seed, "init", "-q", "-b", "seed");
  const files: Record<string, string> = {
    "manifest.json": JSON.stringify({ $schema: MANIFEST_SCHEMA, keyedBy, status: "seed", authoritative: false }),
    "README.md": "# a route store\n",
    ...Object.fromEntries(Object.entries(onBranch).map(([n, t]) => [`${ROUTE}/${n}`, t])),
  };
  for (const [p, t] of Object.entries(files)) {
    mkdirSync(dirname(join(seed, p)), { recursive: true });
    writeFileSync(join(seed, p), t);
  }
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "seed");
  git(seed, "push", "-q", url, `HEAD:refs/heads/${BRANCH}`);

  const root = join(base, "co");
  mkdirSync(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "remote", "add", "origin", url);
  if (opts.gitignore !== undefined) writeFileSync(join(root, ".gitignore"), opts.gitignore);
  // The declaration. The stem MUST equal `name` or `findDeclarationFile` does not
  // find it, and the fixture would read as a layer with no declaration at all.
  writeFileSync(
    join(root, "fixture.json"),
    JSON.stringify({
      $schema: "cat-harness-declaration/1.0.0",
      name: "fixture",
      directories: [{ id: ID, path: ROUTE, graphTypologies: ["auto-docs"], storage: { branch: BRANCH, keyedBy } }],
    }),
  );
  for (const [n, t] of Object.entries(inCheckout)) {
    mkdirSync(dirname(join(root, ROUTE, n)), { recursive: true });
    writeFileSync(join(root, ROUTE, n), t);
  }
  // `resolveDirectories` is existence-filtered, so the route must be on disk even
  // when the fixture means it to be empty.
  mkdirSync(join(root, ROUTE), { recursive: true });

  const remote = (name: string, under: string = ROUTE): string | undefined => {
    const r = spawnSync("git", ["--git-dir", bare, "cat-file", "blob", `refs/heads/${BRANCH}:${under}/${name}`], { encoding: "utf-8" });
    return r.status === 0 ? r.stdout : undefined;
  };
  return {
    root,
    opts: { repoRoot: root, store: { storeDir: join(base, "store.git"), sleep: () => {}, log: () => {} } },
    local: (name, text) => {
      mkdirSync(dirname(join(root, ROUTE, name)), { recursive: true });
      writeFileSync(join(root, ROUTE, name), text);
    },
    removeLocal: (name) => unlinkSync(join(root, ROUTE, name)),
    remote,
    tip: () => git(bare, "rev-parse", `refs/heads/${BRANCH}`).trim(),
    pushToBranch: (name, text, under = ROUTE) => {
      // input-site: inert #8140d8da — a unique scratch name or throwaway token; no assertion depends on its value
      const w = join(base, `w-${Math.random().toString(36).slice(2)}`);
      mkdirSync(w);
      git(w, "init", "-q", "-b", "x");
      git(w, "remote", "add", "origin", url);
      git(w, "fetch", "-q", "origin", BRANCH);
      git(w, "checkout", "-q", "-B", "x", "FETCH_HEAD");
      mkdirSync(dirname(join(w, under, name)), { recursive: true });
      writeFileSync(join(w, under, name), text);
      git(w, "add", "-A");
      git(w, "commit", "-q", "-m", "sibling");
      git(w, "push", "-q", url, `HEAD:refs/heads/${BRANCH}`);
    },
  };
}

describe("publishRoute replaces the route WHOLESALE", () => {
  test("a path the checkout no longer holds is REMOVED from the branch", () => {
    // THE test. `write` is a splice, so without the deletion half `gone.md` is
    // served for ever — and it renders, so nothing else would notice.
    const f = fixture("route", { "a.md": "A\n", "gone.md": "orphan\n" }, { "a.md": "A\n" });
    expect(f.remote("gone.md")).toBe("orphan\n");
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("pushed");
    expect("counts" in r && r.counts).toEqual({ written: 0, deleted: 1, unchanged: 1 });
    expect(f.remote("gone.md")).toBeUndefined();
    // ...and the file that did not change is still there, untouched.
    expect(f.remote("a.md")).toBe("A\n");
  });

  test("changed and new files are written; byte-identical ones are not in the push at all", () => {
    const f = fixture("route", { "a.md": "A\n", "same.md": "S\n" }, { "a.md": "A2\n", "same.md": "S\n", "new.md": "N\n" });
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("pushed");
    expect("counts" in r && r.counts).toEqual({ written: 2, deleted: 0, unchanged: 1 });
    expect(f.remote("a.md")).toBe("A2\n");
    expect(f.remote("new.md")).toBe("N\n");
  });

  test("nothing to do is `unchanged`, and the tip does not move", () => {
    // Reachable only because identical files are left OUT of the changes; a
    // publish that always wrote would push a no-op commit every run.
    const f = fixture("route", { "a.md": "A\n" }, { "a.md": "A\n" });
    const before = f.tip();
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("unchanged");
    expect(f.tip()).toBe(before);
  });
});

describe("what it refuses, naming the reason", () => {
  test("a TIP-keyed directory — refused by the DECLARATION's keying, not by the branch's", () => {
    // Asserting on the directory id rather than on the word "tip", because BOTH
    // guards say "is keyed by tip, not route": `resolveTipLocation` names the
    // DIRECTORY, `verifiedTip` names the BRANCH. The first version of this test
    // only matched "tip" and so passed when `resolveTipLocation` was relaxed to
    // "any" — a vacuous assertion, found by mutation and not by reading.
    const f = fixture("tip", { "a.md": "A\n" }, { "a.md": "A2\n" });
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("refused");
    expect(r.reason).toContain(`directory ${ID}`);
    expect(r.reason).toContain("not route");
  });

  test("a COMMIT-keyed directory — the case only the declaration guard can reach", () => {
    // `commit` is qa-store's per-prefix layout and is not a BranchKeying at all,
    // so `BranchStore.open` could never be asked for it: if the guard were
    // dropped this would throw rather than refuse. That makes the guard provably
    // non-redundant, which mutant B left open.
    const f = fixture("commit", { "a.md": "A\n" }, { "a.md": "A2\n" });
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("refused");
    expect(r.reason).toContain(`directory ${ID}`);
  });

  test("a route the checkout does not hold — a route is published FROM the working tree", () => {
    const f = fixture("route", { "a.md": "A\n" }, { "a.md": "A\n" });
    rmSync(join(f.root, ROUTE), { recursive: true, force: true });
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("refused");
  });
});

describe("no `expect` is ever sent, which is what route keying means", () => {
  test("a sibling's write to ANOTHER path survives, and to the SAME path is overwritten", () => {
    // Both halves of "the newer generation wins". A tip-keyed push would make the
    // second half a `conflict`; here the generator is the one writer and a lost
    // write costs a rerun, so last-write-wins is correct rather than tolerated.
    const f = fixture("route", { "a.md": "A\n" }, { "a.md": "A2\n" });
    // ANOTHER path: a sibling route on the same branch, which this publish does not own.
    const OTHER = "docs/uml/other";
    f.pushToBranch("x.md", "the other route's\n", OTHER);
    // The SAME path: a sibling's write to the route's own a.md.
    f.pushToBranch("a.md", "a sibling's a.md\n");
    // And a path under the route the checkout does not hold. The publisher never
    // saw sibling.md in its read... but it DOES see it as a tip path absent from
    // the checkout, so wholesale replacement removes it. That is the contract,
    // and it is worth asserting rather than assuming: anything under a published
    // route is the generator's to own.
    f.pushToBranch("sibling.md", "from elsewhere\n");
    expect(f.remote("a.md")).toBe("a sibling's a.md\n");
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("pushed");
    expect(f.remote("x.md", OTHER)).toBe("the other route's\n");
    expect(f.remote("a.md")).toBe("A2\n");
    expect(f.remote("sibling.md")).toBeUndefined();
  });
});

describe("the checkout's ignore rules are honoured", () => {
  test("a gitignored file under the route is not published", () => {
    const f = fixture("route", {}, { "a.md": "A\n", "logs/run.txt": "scratch\n" }, { gitignore: `${ROUTE}/logs/\n` });
    const r = publishRoute(ID, "publish", f.opts);
    expect(r.state).toBe("pushed");
    expect(f.remote("a.md")).toBe("A\n");
    expect(f.remote("logs/run.txt")).toBeUndefined();
  });
});
