/**
 * The onboarding path: intent triage, the repo scan, and the Pages report.
 *
 * What is worth testing here is not that the code runs — it is that the three
 * places where a wrong answer would be *confidently* wrong stay honest:
 *
 *   1. `folio-intent.dmn` returns `ask` on both ambiguous filesystem states,
 *      and never invents a branch. An agent cannot route past a question the
 *      table did not ask.
 *   2. `scan-repo-content` leaves what it cannot classify in a third bucket
 *      rather than filing it on a guess.
 *   3. `pages-bootstrap` distinguishes a measured 404 from a failed check.
 *
 * Each of those is a case where the tempting shortcut produces output that
 * looks exactly like a correct answer, which is why they get tests and the
 * formatting does not.
 *
 * (1) and (3) read `folio-intent.dmn` and `pages-live-gate.dmn`, which
 * folio-assistant-core owns, so those tests live beside them in
 * `folio-assistant-core/scripts/tests/getting-started.test.ts` (bean `ho66`).
 *
 * "this repo's own address is derived from the remote" is a check of THIS
 * repository's configuration — it expects `litlfred.github.io/folio-assistant`
 * — so it lives in the checkout's root test home, as
 * `test/getting-started-repo-root.test.ts` (owner, 2026-10-06: "Throwaway
 * repository, plus moving the real-repo checks"). The derivation itself is
 * asserted here over a throwaway repository whose `origin` is known.
 */

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import { classify, scanRepo } from "../../scan-repo-content.js";
import { derivePagesUrl, parseRemote } from "../../pages-bootstrap.js";
import { gitFixtureRepo } from "../../../test/support/git-fixture.js";
import { HARNESS_ROOT } from "../../lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);

describe("scan-repo-content — the third bucket", () => {
  test("a directory convention beats the extension", () => {
    // An author who filed a .md under references/ meant it as a reference.
    expect(classify("references/smith-2019.md").bucket).toBe("library");
    expect(classify("docs/chapter-1.pdf").bucket).toBe("content");
  });

  test("source material and prose land where they should on extension alone", () => {
    expect(classify("smith-2019.pdf").bucket).toBe("library");
    expect(classify("outline.md").bucket).toBe("content");
  });

  test("what it cannot place is reported, not filed on a guess", () => {
    const c = classify("src/index.ts");
    expect(c.bucket).toBe("unclassified");
    expect(c.why).toContain(".ts");
  });

  test("every classification carries a reason an author can argue with", () => {
    for (const p of ["a.pdf", "notes/b.md", "c.xyz", "Makefile"]) {
      expect(classify(p).why.length).toBeGreaterThan(0);
    }
  });

  test("scanning this repo writes nothing and leaves source code unclassified", () => {
    const r = scanRepo(INSTANCE_ROOT);
    expect(r.source).toBe("git");
    expect(r.entries.length).toBeGreaterThan(0);
    // Source code is not the author's subject matter, and a scanner that
    // claimed it would be proposing to import the platform into the folio.
    expect(r.totals.unclassified.files).toBeGreaterThan(0);
    // Groups are per directory, because the author answers per directory.
    expect(r.groups.every((g) => g.examples.length <= 5)).toBe(true);
  });
});

describe("pages-bootstrap — deriving the address", () => {
  test("parses every shape a GitHub remote comes in", () => {
    for (const remote of [
      "git@github.com:litlfred/folio-assistant.git",
      "https://github.com/litlfred/folio-assistant.git",
      "https://github.com/litlfred/folio-assistant",
      "ssh://git@github.com/litlfred/folio-assistant.git",
    ]) {
      expect(parseRemote(remote)).toEqual({ owner: "litlfred", repo: "folio-assistant" });
    }
  });

  test("an unparseable remote yields no URL rather than a guessed one", () => {
    expect(parseRemote("not a url")).toBeUndefined();
    // A wrong URL is worse than none: it is what the author pastes to somebody else.
    const r = derivePagesUrl("/nonexistent-directory-for-this-test");
    expect(r.url).toBeUndefined();
  });

  test("a repository's address is derived from its remote", () => {
    // Over a throwaway repository whose `origin` is
    // `https://github.com/example/demo.git`. This repository's own address is
    // checked in `test/getting-started-repo-root.test.ts`.
    const fx = gitFixtureRepo();
    try {
      const r = derivePagesUrl(fx.root);
      expect(r.url).toBe("https://example.github.io/demo/");
      expect(r.urlSource).toBe("git remote");
    } finally {
      fx.cleanup();
    }
  });
});
