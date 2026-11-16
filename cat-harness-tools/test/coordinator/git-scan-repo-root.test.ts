/**
 * `gitScan` over THIS checkout's corpus, moved here from
 * `cat-harness/schemas/git-scan.test.ts` (owner, 2026-10-06: "Throwaway
 * repository, plus moving the real-repo checks"). The pattern it reads — a
 * `manifest.jsonld` under any `library/<entry>/` — matches library entries in
 * every layer of the checkout, and the two-sided control below is about that real
 * corpus — what the old bare walk admitted, and that git's corpus loses none of
 * it. Standing alone, cat-harness's parent is not a repository, so git cannot
 * be asked there at all. `gitScan`'s logic stays in that file, over throwaway
 * repositories. The path is composed from ORIGIN_DIR, the directory the test
 * was written in, so nothing it reads changed.
 */
import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";

import { gitScan } from "../../schemas/sdlc/git-corpus.ts";

/** The directory this test was written in (`cat-harness/schemas/`). */
const ORIGIN_DIR = join(import.meta.dir, "../../../cat-harness/schemas");

describe("check-source-licence's corpus, over this repository", () => {
  test("it reads git's corpus, and the pattern it reads is unchanged", async () => {
    // The conversion's own two-sided control, kept as a test rather than left
    // in a session log. NARROWING is the point; LOSING is the risk, and only
    // the second assertion can catch it.
    //
    // Measured when the conversion landed, with a `manifest.jsonld` planted
    // under the gitignored `_kg/`: the old corpus (a bare walk behind a
    // hand-written `node_modules`/`ingest-staging` denylist) returned 35, the
    // new one 34, and the difference was exactly the planted file. The
    // denylist was an UNDER-APPROXIMATION of `.gitignore` — it named the two
    // ignored trees somebody had been bitten by, and a third swept in
    // silently.
    const { Glob } = await import("bun");
    const root = resolve(ORIGIN_DIR, "../..");
    const P = "**/library/*/manifest.jsonld";
    const bare = [...new Glob(P).scanSync({ cwd: root, onlyFiles: true })]
      .filter((p) => !p.includes("node_modules") && !p.includes("ingest-staging"))
      .sort();
    const git = gitScan(root, P);
    expect(git.source).toBe("git");
    // Nothing the old denylist admitted may be lost by the conversion.
    expect(git.files.filter((p) => !bare.includes(p))).toEqual([]);
    // And not vacuous: the corpus is non-empty, so the line above is a claim.
    expect(git.files.length).toBeGreaterThan(0);
  });
});
