/**
 * The staging stamp: absent outside a build, declared inside one.
 *
 * Two properties, and the second is the one that was broken. A stamp that is
 * *written* but not *declared* looks correct in every plain-JSON reading and
 * vanishes the moment a JSON-LD processor touches the document — the `ovkk`
 * defect, which is why `context-declares-staging` below asserts against the
 * exported `@context` rather than against the writer.
 *
 * The tests here that read the aggregate repository's own root
 * (`.github/workflows/feature-staging.yml`) live in
 * `test/staging-stamp-workflows.test.ts` (bean
 * `ho66`): standing alone, cat-harness has no such root to read.
 */
import { describe, expect, it } from "bun:test";

import { stagingStamp, stagingFields, STAGING_KEY } from "../../staging-stamp.js";
import { buildDeclarationSchema, buildToolSchema, buildToolTypes } from "../../harness-schema-export.js";
import { buildExport } from "../../kg-export.js";

/**
 * The export, built ONCE at module scope.
 *
 * Bean `sff8`. `check:test-budgets` named this test at **4.02 s of a 5000 ms default
 * budget (80 %)** before it had ever gone red — it was 7th on that list — and it
 * timed out at **5097 ms** on the next loaded suite run, exactly as ranked. That is
 * the instrument doing the job it was built for: the name arrived before the failure.
 *
 * Same remedy as the five before it: module scope belongs to no test's timeout. Not a
 * raised budget, which `sff8` rules out because a number decays as the corpus grows.
 */
const EXPORTED = await buildExport({});

describe("stagingStamp", () => {
  it("is absent, not fabricated, when there is no build", () => {
    expect(stagingStamp({})).toBeUndefined();
    // A branch with no commit is not half a stamp, it is no stamp: the
    // question a reader has is which commit, and the rest cannot answer it.
    expect(stagingStamp({ KG_BRANCH: "feat/x", GITHUB_RUN_ID: "42" })).toBeUndefined();
    expect(stagingFields({})).toEqual({});
    // Not merely undefined — the KEY must be absent, or a structural
    // comparison would read a local export as a build artefact with a hole.
    expect(Object.keys(stagingFields({}))).toHaveLength(0);
  });

  it("prefers the workflow's branch name over the ref it ran on", () => {
    // They differ on a `pull_request` event, where GITHUB_REF_NAME is the merge
    // ref — not something a reviewer can check out.
    const s = stagingStamp({
      GITHUB_SHA: "abc123",
      KG_BRANCH: "feat/x",
      GITHUB_REF_NAME: "338/merge",
      GITHUB_RUN_ID: "77",
    });
    expect(s).toEqual({ branch: "feat/x", sha: "abc123", pr: "338/merge", run: "77" });
  });

  it("falls back to the ref when the workflow set no branch", () => {
    const s = stagingStamp({ GITHUB_SHA: "abc123", GITHUB_REF_NAME: "feat/y" });
    expect(s).toEqual({ branch: "feat/y", sha: "abc123", pr: "feat/y", run: "" });
  });

  it("stamps nothing on a build of main: build.json names that commit once (bean g196)", () => {
    // Every main deploy rewrote ~8,000 graph pages and data files for this
    // stamp alone, so it must stay off the published site.
    for (const ref of ["main", "master"]) {
      expect(stagingStamp({ GITHUB_SHA: "abc123", GITHUB_REF_NAME: ref, GITHUB_RUN_ID: "9" })).toBeUndefined();
      expect(Object.keys(stagingFields({ GITHUB_SHA: "abc123", GITHUB_REF_NAME: ref }))).toHaveLength(0);
    }
  });

  it("still stamps a preview whose branch happens to be called main", () => {
    // A fork's `main` opened as a pull request: the staging workflow names
    // the branch, and that makes it a preview whatever the name.
    const s = stagingStamp({ GITHUB_SHA: "abc123", KG_BRANCH: "main", GITHUB_REF_NAME: "12/merge", GITHUB_RUN_ID: "5" });
    expect(s).toEqual({ branch: "main", sha: "abc123", pr: "12/merge", run: "5" });
  });
});

describe("the JSON-LD export declares the stamp it carries", () => {
  it("context-declares-staging: `staging` is a term, with its four fields scoped under it", () => {
    const ctx = EXPORTED as unknown as { "@context": Record<string, unknown> };
    const term = ctx["@context"][STAGING_KEY] as { "@id"?: string; "@context"?: Record<string, unknown> };
    expect(term).toBeDefined();
    expect(typeof term["@id"]).toBe("string");
    // Scoped, not global: `branch`/`sha`/`pr`/`run` are words a graph node
    // could use for something else, and a global term would give that other
    // use this meaning.
    for (const f of ["branch", "sha", "pr", "run"]) {
      expect(term["@context"]?.[f]).toBeTypeOf("string");
      expect(ctx["@context"][f]).toBeUndefined();
    }
  });
});

describe("the schema documents are stamped at write time, not in the builders", () => {
  it("a builder's output is the same in a build and outside one", () => {
    // `build*` says what a declaration IS — the same answer in every run. A run
    // id folded in there would make two calls in one process return documents
    // that differ.
    for (const build of [buildDeclarationSchema, buildToolSchema, buildToolTypes]) {
      expect(build({ baseUrl: "https://example.test" })[STAGING_KEY]).toBeUndefined();
    }
  });
});
