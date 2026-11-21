/**
 * WHICH COPY a route-keyed `--check` compares against, on REAL git repositories.
 *
 * The first test is the one that made adopting this safe: over the REAL
 * repository, where no declaration sets `storage`, the `checkout` verdict must
 * equal the direct on-disk comparison **file for file**. If it did not, the
 * cutover would be changing live verdicts while claiming to change none.
 *
 * The rest pin the two states `main` has nothing for: `both`, the window where
 * the same bytes live in two places on purpose, and `unknown`, which is neither
 * stale nor a pass.
 *
 * @module scripts/tests/route-authority.test
 */
import { afterEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { existsSync, readFileSync, readdirSync } from "../../test/support/site-fs.ts";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

import { MANIFEST_SCHEMA } from "../branch-store.js";
import { authorityOf, compareRoute } from "../route-authority.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { siteNotBuilt } from "../../test/support/checkout.ts";

const NOGPG = ["-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t"];
const REPO = resolve(dirname(HARNESS_ROOT));
const BRANCH = "cat/fixture/route";
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

/**
 * @param manifest what the branch's root manifest says; `null` seeds NO branch,
 *   which is the unreachable case.
 */
function fixture(
  manifest: Record<string, unknown> | null,
  onBranch: Record<string, string>,
  inCheckout: Record<string, string>,
  opts: { storage?: boolean } = {},
): string {
  const base = mkdtempSync(join(tmpdir(), "route-authority-"));
  made.push(base);
  const bare = join(base, "remote.git");
  git(base, "init", "-q", "--bare", "-b", "main", bare);
  git(bare, "config", "uploadpack.allowFilter", "true");
  git(bare, "config", "uploadpack.allowAnySHA1InWant", "true");
  const url = `file://${bare}`;

  if (manifest !== null) {
    const seed = join(base, "seed");
    mkdirSync(seed);
    git(seed, "init", "-q", "-b", "seed");
    const files: Record<string, string> = {
      "manifest.json": JSON.stringify(manifest),
      ...Object.fromEntries(Object.entries(onBranch).map(([n, t]) => [`${ROUTE}/${n}`, t])),
    };
    for (const [p, t] of Object.entries(files)) {
      mkdirSync(dirname(join(seed, p)), { recursive: true });
      writeFileSync(join(seed, p), t);
    }
    git(seed, "add", "-A");
    git(seed, "commit", "-q", "-m", "seed");
    git(seed, "push", "-q", url, `HEAD:refs/heads/${BRANCH}`);
  }

  const root = join(base, "co");
  mkdirSync(root);
  git(root, "init", "-q", "-b", "main");
  git(root, "remote", "add", "origin", url);
  writeFileSync(
    join(root, "fixture.json"),
    JSON.stringify({
      $schema: "cat-harness-declaration/1.0.0",
      name: "fixture",
      directories: [
        {
          id: ID,
          path: ROUTE,
          graphTypologies: ["auto-docs"],
          ...(opts.storage === false ? {} : { storage: { branch: BRANCH, keyedBy: "route" } }),
        },
      ],
    }),
  );
  mkdirSync(join(root, ROUTE), { recursive: true });
  for (const [n, t] of Object.entries(inCheckout)) {
    mkdirSync(dirname(join(root, ROUTE, n)), { recursive: true });
    writeFileSync(join(root, ROUTE, n), t);
  }
  return root;
}

const seeded = (authoritative: boolean, keyedBy = "route") => ({
  $schema: MANIFEST_SCHEMA,
  keyedBy,
  status: "seed",
  authoritative,
});

describe("with no `storage`, the verdict is the on-disk comparison it replaces", () => {
  const umlPages = join(REPO, "cat-harness/docs/uml/overview");
  // Standing alone the uml pages are not built: `uml:overview` writes them at
  // publish and `docs/uml/overview/` is gitignored (bean w1gy F18).
  test.skipIf(
    siteNotBuilt("the uml overview pages gen-uml-overview writes at publish (gitignored)", umlPages),
  )("file for file, over the REAL repository's uml pages", () => {
    // THE falsifier for adopting this at all. Every directory in this repository
    // resolves `checkout` today, so if these two disagreed the cutover would be
    // changing live verdicts while claiming to change none.
    const root = umlPages;
    expect(existsSync(root)).toBe(true);
    const pages = new Map<string, string>();
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const abs = join(d, e.name);
        if (e.isDirectory()) walk(abs);
        else pages.set(abs.slice(REPO.length + 1).split(sep).join("/"), readFileSync(abs, "utf8"));
      }
    };
    walk(root);
    expect(pages.size).toBeGreaterThan(50);

    const v = compareRoute("uml-overview-pages", pages, REPO);
    expect(v.authority).toBe("checkout");
    expect(v.state).toBe("current");
    expect(v.stale).toEqual([]);

    // The same question asked the old way, over the same map.
    const direct = [...pages].filter(([p, t]) => readFileSync(join(REPO, p), "utf8") !== t).map(([p]) => p);
    expect(v.stale).toEqual(direct);
  });

  test("...and one changed byte makes it stale, naming that path only", () => {
    const root = fixture(null, {}, { "a.md": "A\n", "b.md": "B\n" }, { storage: false });
    const v = compareRoute(ID, new Map([[`${ROUTE}/a.md`, "CHANGED\n"], [`${ROUTE}/b.md`, "B\n"]]), root);
    expect(v.authority).toBe("checkout");
    expect(v.state).toBe("stale");
    expect(v.stale).toEqual([`${ROUTE}/a.md`]);
  });
});

describe("`both` — the cutover window, which nothing on main compares", () => {
  test("authority is `both` while the manifest says authoritative: false", () => {
    const root = fixture(seeded(false), { "a.md": "A\n" }, { "a.md": "A\n" });
    expect(authorityOf(ID, root).authority).toBe("both");
  });

  test("the checkout decides staleness, and a disagreement between the copies is REPORTED", () => {
    // The blind spot this closes: `9ofm` added `not-cut-over` for a TIP-keyed
    // directory and `offCheckoutFindings` skips `route`, so during the window a
    // drift between the two copies is invisible today.
    const root = fixture(seeded(false), { "a.md": "OLD\n" }, { "a.md": "A\n" });
    const v = compareRoute(ID, new Map([[`${ROUTE}/a.md`, "A\n"]]), root);
    expect(v.authority).toBe("both");
    expect(v.state).toBe("current");
    expect(v.drift).toEqual([`${ROUTE}/a.md`]);
  });

  test("...and no drift is reported when the two copies agree", () => {
    const root = fixture(seeded(false), { "a.md": "A\n" }, { "a.md": "A\n" });
    const v = compareRoute(ID, new Map([[`${ROUTE}/a.md`, "A\n"]]), root);
    expect(v.drift).toBeUndefined();
  });
});

describe("`branch` — after the flip", () => {
  test("a page stale ON THE BRANCH is stale even when the checkout agrees", () => {
    // The whole point of the flip: once the branch is authoritative, the
    // checkout's copy is not evidence.
    const root = fixture(seeded(true), { "a.md": "OLD\n" }, { "a.md": "A\n" });
    const v = compareRoute(ID, new Map([[`${ROUTE}/a.md`, "A\n"]]), root);
    expect(v.authority).toBe("branch");
    expect(v.state).toBe("stale");
    expect(v.stale).toEqual([`${ROUTE}/a.md`]);
  });

  test("current when the branch holds exactly the generator's output", () => {
    const root = fixture(seeded(true), { "a.md": "A\n" }, { "a.md": "whatever\n" });
    const v = compareRoute(ID, new Map([[`${ROUTE}/a.md`, "A\n"]]), root);
    expect(v.state).toBe("current");
  });
});

describe("`unknown` is neither stale nor a pass", () => {
  test("a declared branch that does not exist", () => {
    // Done-when 3, in the bean's own words: "a branch it cannot fetch reports
    // unknown, never a pass". Resolving it to the checkout would be the vacuous
    // pass, and it is the easy mistake: the files ARE on disk.
    const root = fixture(null, {}, { "a.md": "A\n" });
    const v = compareRoute(ID, new Map([[`${ROUTE}/a.md`, "A\n"]]), root);
    expect(v.state).toBe("unknown");
    expect(v.state).not.toBe("current");
    expect(v.reason).toBeTruthy();
  });

  test("a manifest claiming the WRONG keying is corrupt, not current", () => {
    const root = fixture(seeded(true, "tip"), { "a.md": "A\n" }, { "a.md": "A\n" });
    const v = compareRoute(ID, new Map([[`${ROUTE}/a.md`, "A\n"]]), root);
    expect(v.state).toBe("unknown");
    expect(v.reason).toContain("keyed by tip");
  });
});
