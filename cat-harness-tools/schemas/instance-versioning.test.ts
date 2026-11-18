import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CatHarnessDeclarationSchema, ExactVersionSchema } from "./kg/cat-harness.ts";
import { dependsOnFor } from "./kg/depends-on.ts";
import { applyBump, clearsFloor, comparable, diffSurface, surfaceOf } from "./kg/version-bump.ts";
import { auditVersionBumps, releaseTags } from "../scripts/check-version-bump";
import { auditPublishable, formatReport } from "../scripts/check-publishable";

/**
 * A minimal valid declaration, extended per test.
 *
 * Built by a helper rather than inlined so that a test asserting ONE rule
 * cannot be passing because of a second violation elsewhere in its fixture —
 * the same reason `qa-report.test.ts` does it.
 */
/**
 * A minimal VALID declaration — which now includes an id and a version,
 * because every asset carries both (owner, 2026-09-23). A test overriding one
 * to `undefined` is asserting the requirement, not building a fixture.
 */
function decl(over: Record<string, unknown> = {}): unknown {
  return {
    name: "example",
    version: "0.1.0",
    directories: [],
    remoteGraphs: [],
    ...over,
  };
}

/** The issue paths a failed parse reported, sorted — never the message text. */
function failedPaths(value: unknown): string[] {
  const r = CatHarnessDeclarationSchema.safeParse(value);
  if (r.success) return [];
  return r.error.issues.map((i) => i.path.join(".")).sort();
}

describe("publication is a STATE, and `published` is refused (§3.1, superseded 2026-09-23)", () => {
  /**
   * These tests replaced four that asserted the OPPOSITE, and the inversion is
   * the point rather than an inconvenience.
   *
   * §3.1 shipped `publishable?: boolean` with three states and REFUSED an id
   * or a version to anything that had not declared `true`. The owner ruled on
   * 2026-09-23 that every asset carries both and sits in `draft`, so the
   * refusals are gone and their tests with them. What survives unchanged is
   * the DISCIPLINE those tests were protecting — that a model must be able to
   * say what is true — and it is what condemned the old model: all 17
   * layers reported `undecided` while the answer was known for every one.
   *
   * `skills/kg/kg-core/instance-publication.md`.
   */
  test("absent `publication` is legal and means draft", () => {
    expect(CatHarnessDeclarationSchema.safeParse(decl()).success).toBe(true);
  });

  test("`publication.state: \"draft\"` is legal and says nothing extra", () => {
    expect(CatHarnessDeclarationSchema.safeParse(decl({ publication: { state: "draft" } })).success).toBe(true);
  });

  /**
   * THE FALSIFIER for the whole ruling, pinned at the schema.
   *
   * If this ever parses, a flag nothing can verify has been made settable by
   * hand — which is precisely the ceremony §3.1 was right to write against,
   * rebuilt one name over. A gate would not do: a gate that merely grumbles
   * about an unbacked flag is a gate somebody switches off.
   */
  test("`publication.state: \"published\"` FAILS TO PARSE — the process does not exist", () => {
    expect(failedPaths(decl({ publication: { state: "published" } }))).toEqual(["publication.state"]);
  });

  test("`publication.host` still parses beside the state — they are two facets, not rivals", () => {
    const ok = decl({ publication: { host: "github-pages", state: "draft" } });
    expect(CatHarnessDeclarationSchema.safeParse(ok).success).toBe(true);
    // And either alone, since absent host is its own third state.
    expect(CatHarnessDeclarationSchema.safeParse(decl({ publication: { host: "github-pages" } })).success).toBe(true);
  });
});

describe("a version is universal but GATE-enforced; an id is held (§3.2, owner 2026-09-23)", () => {
  /** A throwaway layer tree. Never the real corpus — that is a sibling's timeout. */
  function tree(instances: Record<string, unknown>): string {
    const root = mkdtempSync(join(tmpdir(), "vertest-"));
    for (const [name, body] of Object.entries(instances)) {
      const dir = join(root, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(body));
    }
    return root;
  }

  test("a declaration with neither still parses — the type permits absence", () => {
    expect(CatHarnessDeclarationSchema.safeParse(decl({ id: undefined, version: undefined })).success).toBe(true);
  });

  /**
   * THE ASYMMETRY, pinned, because it is the part that reads as a weakening
   * and is not one.
   *
   * §3.1 shipped `id` and `version` REFUSED unless `publishable: true`. The
   * owner reversed that on 2026-09-23 — every asset carries a version — and
   * requiring it in the TYPE breaks 376 tests across 20+ files, every fixture
   * that builds a declaration without one. So the requirement moved to
   * `check:publishable`, which fails the layer BY NAME rather than as a
   * parse error inside a fixture.
   *
   * `auditPublishable` raising a `major` on a versionless layer is the
   * assertion that makes "universal" true; without it this file would be
   * pinning permission rather than a property.
   */
  test("the GATE is what refuses a missing version, and names the instance", () => {
    const root = tree({ alpha: { name: "alpha", directories: [] } });
    try {
      const { findings } = auditPublishable(root);
      const missing = findings.filter((f) => f.detail.includes("version"));
      expect(missing).toHaveLength(1);
      expect(missing[0]!.severity).toBe("major");
      expect(missing[0]!.detail).toContain("alpha");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an instance WITH a version raises nothing — falsifiable in both directions", () => {
    const root = tree({ alpha: { name: "alpha", version: "0.1.0", directories: [] } });
    try {
      expect(auditPublishable(root).findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  /**
   * `id` is HELD, not dropped. The owner ruled the namespace
   * `io.github.litlfred.folio-assistant.<name>` and then ruled that a fork
   * edits ONE reference in `bootstrap/README.md` — so a namespace written into
   * 17 declarations is 17 places, and an id must be DERIVED from that single
   * reference once bean `iwtn` creates it.
   *
   * Until then no layer declares one, and NOTHING should start requiring
   * it. This test fails the moment something does.
   */
  test("no instance declares an `id` yet, and an absent one is legal", () => {
    expect(failedPaths(decl({ id: undefined }))).toEqual([]);
  });

  /**
   * `canonicalUrl` stays unrequired for the reason §3.4 gives: it plays FHIR's
   * `uri` role, so a layer without one cannot be EXPRESSED as a dependency
   * — reported by `dependsOnFor` as a `no-uri` gap, which is a fact about the
   * RECORD rather than a reason to refuse the declaration. Only 3 of the
   * layers here carry one.
   */
  test("`canonicalUrl` is NOT required — a draft without one is legal", () => {
    expect(CatHarnessDeclarationSchema.safeParse(decl({ canonicalUrl: undefined })).success).toBe(true);
  });
});

describe("versions are exact — ranges cannot be expressed in FHIR `dependsOn` (§2 rule 2)", () => {
  test.each(["1.0.0", "0.0.1", "10.20.30", "1.2.3-rc.1", "1.2.3+build.5", "current", "dev"])("accepts %s", (ok) => {
    expect(ExactVersionSchema.safeParse(ok).success).toBe(true);
  });
  test.each(["^1.2.3", "~1.2.3", ">=1.0.0", "1.2.*", "1.x", "1.2", "1.0.0 || 2.0.0", "latest", ""])("refuses %p", (bad) => {
    expect(ExactVersionSchema.safeParse(bad).success).toBe(false);
  });
});

/**
 * The gate's two CROSS-INSTANCE rules, which no single parse can hold.
 *
 * Each runs over a throwaway tree rather than the repository, so the
 * assertions stay true when the repository's own layers change — the
 * failure mode a test reading live data walks into (`yag0`, where the
 * assertion was derived from the very data it was meant to check).
 */
describe("check:publishable — the rules a per-declaration schema cannot see", () => {
  function tree(instances: Record<string, unknown | string>): string {
    const root = mkdtempSync(join(tmpdir(), "pubtest-"));
    for (const [name, body] of Object.entries(instances)) {
      const dir = join(root, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${name}.json`), typeof body === "string" ? body : JSON.stringify(body));
    }
    return root;
  }

  test("a duplicate id is a major finding — an id is an identity, so two is two packages under one name", () => {
    const pub = (name: string) => ({
      name,
      id: "org.example.shared",
      version: "1.0.0",
      canonicalUrl: `https://example.org/${name}`,
      directories: [],
    });
    const root = tree({ alpha: pub("alpha"), beta: pub("beta") });
    try {
      const { findings } = auditPublishable(root);
      const dup = findings.filter((f) => f.detail.includes("org.example.shared"));
      expect(dup).toHaveLength(1);
      expect(dup[0]!.severity).toBe("major");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("distinct ids raise nothing — the duplicate rule is falsifiable in both directions", () => {
    const pub = (name: string) => ({
      name,
      id: `org.example.${name}`,
      version: "1.0.0",
      canonicalUrl: `https://example.org/${name}`,
      directories: [],
    });
    const root = tree({ alpha: pub("alpha"), beta: pub("beta") });
    try {
      expect(auditPublishable(root).findings).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  /**
   * UNKNOWN is a fact about the RUN; draft is a fact about the repository.
   * A gate that folded the first into the second would report a clean census
   * over a layer it never read — the `dh4f` shape. The states changed with
   * the 2026-09-23 ruling; this distinction did not, and is the reason the
   * `unknown` row survived a rewrite that removed every other state.
   */
  test("an unreadable declaration is `unknown`, never counted as draft", () => {
    const root = tree({ broken: "{ this is not json" });
    try {
      const { rows, findings } = auditPublishable(root);
      const broken = rows.find((r) => r.where === "broken");
      expect(broken?.state).toBe("unknown");
      expect(broken?.problem).toBeDefined();
      expect(findings.some((f) => f.where === "broken" && f.severity === "major")).toBe(true);
      expect(formatReport({ rows, findings })).toContain("UNKNOWN is not draft");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an all-draft census says it is DECIDED — the opposite of what it used to say", () => {
    // The old assertion was "EVERY INSTANCE IS UNDECIDED … not a pass". That
    // wording was right for a model that could not express what was true. Now
    // draft IS the answer, so the same all-one-state census means the corpus
    // is settled and waiting on a PROCESS, not on a decision.
    const inst = (name: string) => ({ name, id: `org.example.${name}`, version: "0.1.0", directories: [] });
    const root = tree({ alpha: inst("alpha"), beta: inst("beta") });
    try {
      const report = auditPublishable(root);
      expect(report.rows.every((r) => r.state === "draft")).toBe(true);
      expect(report.findings).toEqual([]);
      expect(formatReport(report)).toContain("EVERY INSTANCE IS DRAFT, and that is now a DECIDED state");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("`publication.state: \"published\"` FAILS TO PARSE — refused, not reported", () => {
    // The falsifier for the whole ruling, pinned. If this ever passes, the
    // defect §3.1 was written against has been rebuilt one name over.
    const root = tree({
      alpha: {
        name: "alpha",
        id: "org.example.alpha",
        version: "0.1.0",
        publication: { state: "published" },
        directories: [],
      },
    });
    try {
      const { rows } = auditPublishable(root);
      expect(rows[0]!.state).toBe("unknown");
      expect(rows[0]!.problem).toBeDefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * §3.4's record, and — the point of the section — the gaps it cannot fill.
 *
 * Every layer now carries an id and a version, so a gap is never about
 * PERMISSION any more — it is about the record being inexpressible. §3.4's
 * record is `{packageId, version, uri}` and `canonicalUrl` plays `uri`, so an
 * edge to something without one cannot be written down. `dependsOn: []` in
 * that case would state that the layer depends on nothing, which is false.
 * Each case below is a DIFFERENT gap reason with a different remedy, which is
 * why it is an enum rather than a boolean.
 */
describe("dependsOn — §3.4's record, and what it reports instead", () => {
  function tree(instances: Record<string, unknown | string>): string {
    const root = mkdtempSync(join(tmpdir(), "depstest-"));
    for (const [name, body] of Object.entries(instances)) {
      const dir = join(root, name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${name}.json`), typeof body === "string" ? body : JSON.stringify(body));
    }
    return root;
  }

  // Every layer carries an id and a version now, so this helper no longer
  // says "published" — it says "has a canonicalUrl", which is what §3.4's
  // record actually needs. Owner's ruling, 2026-09-23.
  const published = (name: string, over: Record<string, unknown> = {}) => ({
    name,
    id: `org.example.${name}`,
    version: "1.0.0",
    canonicalUrl: `https://example.org/${name}`,
    directories: [],
    ...over,
  });

  test("a publishable instance depending on a publishable one emits the FHIR triple", () => {
    const root = tree({ base: published("base"), top: published("top", { needs: ["base"] }) });
    try {
      const out = dependsOnFor(join(root, "top"));
      expect(out.records).toEqual([
        { packageId: "org.example.base", version: "1.0.0", uri: "https://example.org/base" },
      ]);
      expect(out.gaps).toEqual([]);
      expect(out.unavailable).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a dependency with no `canonicalUrl` is a gap, not an omission — and says which reason", () => {
    // §3.4's record is `{packageId, version, uri}`. The dependency HAS an id
    // and a version — everything does now — so the only thing that can stop
    // the record being expressed is the missing `uri`, which `canonicalUrl`
    // plays. That is a fact about the RECORD, where the old `undecided` was a
    // fact about permission.
    const root = tree({
      base: { name: "base", id: "org.example.base", version: "1.0.0", directories: [] },
      top: published("top", { needs: ["base"] }),
    });
    try {
      const out = dependsOnFor(join(root, "top"));
      expect(out.records).toEqual([]);
      expect(out.gaps).toHaveLength(1);
      expect(out.gaps[0]!.reason).toBe("no-uri");
      // The emptiness is explained rather than left to read as "depends on nothing".
      expect(out.unavailable).toContain("none expressible as a record");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("an id and a version are NOT enough — the gap is specifically the uri", () => {
    // Pins the distinction the rewrite turns on. Under the old model a
    // dependency could be complete-but-forbidden; now it can only be
    // incomplete, and this asserts WHICH field is missing rather than that
    // something is.
    const root = tree({
      base: { name: "base", id: "org.example.base", version: "2.5.0", directories: [] },
      top: published("top", { needs: ["base"] }),
    });
    try {
      const gap = dependsOnFor(join(root, "top")).gaps[0]!;
      expect(gap.detail).toContain("canonicalUrl");
      expect(gap.detail).not.toContain("publishable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a name matching no instance is `unresolved` — external and misspelled are not the same", () => {
    const root = tree({ top: published("top", { needs: ["nowhere"] }) });
    try {
      const out = dependsOnFor(join(root, "top"));
      expect(out.gaps).toHaveLength(1);
      expect(out.gaps[0]).toMatchObject({ name: "nowhere", reason: "unresolved" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a publishable instance with no dependencies is a DETERMINED empty — no `unavailable`", () => {
    const root = tree({ solo: published("solo", { needs: [] }) });
    try {
      const out = dependsOnFor(join(root, "solo"));
      expect(out.records).toEqual([]);
      expect(out.gaps).toEqual([]);
      expect(out.unavailable).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  /**
   * These two replaced a pair asserting that the block was withheld on
   * PERMISSION — undecided, or `publishable: false`. Neither state exists now.
   * The block is still withheld, and the reason is a fact about the RECORD:
   * §3.4's is `{packageId, version, uri}`, and without a `canonicalUrl` there
   * is no `uri` to write.
   */
  test("an instance with NO canonicalUrl withholds the block and says why — it does not emit an empty one", () => {
    const root = tree({
      top: { name: "top", id: "org.example.top", version: "1.0.0", needs: [], directories: [] },
    });
    try {
      const out = dependsOnFor(join(root, "top"));
      expect(out.records).toEqual([]);
      expect(out.unavailable).toContain("canonicalUrl");
      // The distinction that survived the rewrite: withheld-on-purpose and
      // cannot-be-expressed are different, and the message says which.
      expect(out.unavailable).toContain("cannot be expressed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("having an id and a version is not enough — the withholding is specifically the uri", () => {
    const root = tree({
      top: { name: "top", id: "org.example.top", version: "3.1.4", directories: [] },
    });
    try {
      const out = dependsOnFor(join(root, "top"));
      expect(out.unavailable).toBeDefined();
      expect(out.unavailable).not.toContain("publishable");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * §4 — the bump computed from the exported-surface diff.
 *
 * §4.1's falsifier was run before this existed: 18 patch / 1 minor / 1 major
 * over the last 20 commits on `main` (`--first-parent`). These tests are the
 * rules that measurement licensed, plus the two edges it did not exercise.
 */
describe("version bump — computed from the surface, not claimed by a commit message (§4)", () => {
  const s = (type: string, id: string) => ({ type, id });

  test("a removal is MAJOR, and outranks a simultaneous addition", () => {
    const before = [s("Skill", "a"), s("Skill", "b")];
    const after = [s("Skill", "a"), s("Skill", "c")];
    const d = diffSurface(before, after);
    expect(d.bump).toBe("major");
    // Both halves are carried, so a caller can see this for the RENAME it is
    // rather than inferring "capability withdrawn" from the verdict.
    expect(d.added).toEqual([s("Skill", "c")]);
    expect(d.removed).toEqual([s("Skill", "b")]);
  });

  test("an addition alone is MINOR", () => {
    expect(diffSurface([s("Skill", "a")], [s("Skill", "a"), s("Tool", "t")]).bump).toBe("minor");
  });

  test("no change is PATCH — prose included, which is 18 of the 20 measured commits", () => {
    expect(diffSurface([s("Skill", "a")], [s("Skill", "a")]).bump).toBe("patch");
  });

  /**
   * The reason the surface is keyed on `{type, id}` rather than on the id.
   * A node keeping its id while changing its type is a different thing under
   * the same name — exactly what a consumer must be told — and an id-only key
   * would score it `patch`.
   */
  test("a node whose TYPE changed under the same id is major, not patch", () => {
    expect(diffSurface([s("Skill", "x")], [s("Tool", "x")]).bump).toBe("major");
  });

  test("surfaceOf takes every node with an @id, dedupes, and sorts", () => {
    const doc = {
      "@graph": [
        { "@id": "b", "@type": "Skill" },
        { "@id": "a", "@type": "Skill" },
        { "@id": "a", "@type": "Skill" },
        { "@type": "Skill" }, // no @id — not a subject a consumer can resolve
      ],
    };
    expect(surfaceOf(doc)).toEqual([s("Skill", "a"), s("Skill", "b")]);
  });

  test("a node with an @id but no @type is scored under `?`, never dropped", () => {
    expect(surfaceOf({ "@graph": [{ "@id": "x" }] })).toEqual([{ type: "?", id: "x" }]);
  });

  test("a multi-typed node is keyed on its types SORTED, so array order is not a change", () => {
    const one = surfaceOf({ "@graph": [{ "@id": "x", "@type": ["B", "A"] }] });
    const two = surfaceOf({ "@graph": [{ "@id": "x", "@type": ["A", "B"] }] });
    expect(diffSurface(one, two).bump).toBe("patch");
  });

  test("a document with no @graph is an empty surface, not a crash", () => {
    expect(surfaceOf({})).toEqual([]);
    expect(surfaceOf(null)).toEqual([]);
  });

  describe("applyBump", () => {
    test("bumps the right field and zeroes the ones below it", () => {
      expect(applyBump("1.2.3", "major")).toBe("2.0.0");
      expect(applyBump("1.2.3", "minor")).toBe("1.3.0");
      expect(applyBump("1.2.3", "patch")).toBe("1.2.4");
    });

    /**
     * `current` and `dev` are a branches/ choice (§3.3). Inventing a release
     * number for one would be this module asserting a publication nobody made.
     */
    test("a pseudo-version comes back unchanged rather than coerced", () => {
      expect(applyBump("current", "major")).toBe("current");
      expect(applyBump("dev", "minor")).toBe("dev");
    });
  });

  /**
   * §4.1: the gate holds the declared version to a FLOOR, never to an exact
   * value. The asymmetry is deliberate — under-bumping breaks a consumer
   * silently, over-bumping costs them a version number.
   */
  describe("clearsFloor — a floor, not an expectation", () => {
    test("equal to the floor passes", () => {
      expect(clearsFloor("1.3.0", "1.3.0")).toBe(true);
    });
    test("ABOVE the floor passes — the author may always bump further", () => {
      expect(clearsFloor("2.0.0", "1.3.0")).toBe(true);
      expect(clearsFloor("1.4.0", "1.3.0")).toBe(true);
    });
    test("below the floor fails — that is the whole gate", () => {
      expect(clearsFloor("1.2.9", "1.3.0")).toBe(false);
      expect(clearsFloor("1.0.0", "2.0.0")).toBe(false);
    });
    test("compares NUMERICALLY, so 0.10.0 is above 0.9.0", () => {
      expect(clearsFloor("0.10.0", "0.9.0")).toBe(true);
      expect(clearsFloor("0.9.0", "0.10.0")).toBe(false);
    });
    test("an uncomparable pair is NOT a pass — the caller reports it undetermined", () => {
      expect(clearsFloor("current", "1.0.0")).toBe(false);
      expect(comparable("current", "1.0.0")).toBe(false);
      expect(comparable("1.0.0", "1.2.3")).toBe(true);
    });
  });

  /**
   * REPLACED, and the replacement runs over a THROWAWAY TREE rather than this
   * repository.
   *
   * The old test asserted `rows` was empty because no layer declared
   * `publishable: true`. Every layer now carries a version, so the gate has
   * 17 real rows and the old assertion inverted. Re-pointing it at the real
   * corpus would also have made it walk the whole tree every run — it was
   * already taking 6.5s against a 5s timeout while failing, and a test that
   * makes its own file time out is that test's defect, not the suite's.
   */
  test("every instance carrying a version means the gate has rows to score", () => {
    const root = mkdtempSync(join(tmpdir(), "bumptest-"));
    try {
      for (const name of ["alpha", "beta"]) {
        const dir = join(root, name);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          join(dir, `${name}.json`),
          JSON.stringify({ name, id: `org.example.${name}`, version: "0.1.0", directories: [] }),
        );
      }
      const report = auditVersionBumps(root);
      expect(report.rows.map((r) => r.name).sort()).toEqual(["alpha", "beta"]);
      // A populated report says nothing about a floor being cleared; that is
      // a separate judgement the rows carry.
      expect(report.note).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("release tags — `<name>-v` everywhere, plain `v` only in a standalone repository (owner 2026-09-30, Q4)", () => {
  function repoWithTags(tags: string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "release-tags-"));
    const git = (...a: string[]) => spawnSync("git", a, { cwd: dir, encoding: "utf-8" });
    git("init", "-q");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x");
    for (const t of tags) git("tag", t);
    return dir;
  }

  test("a standalone repository's plain tags are its releases, newest first", () => {
    const dir = repoWithTags(["v0.1.0", "v0.10.0", "v0.9.0", "vnext"]);
    expect(releaseTags(dir, "bootstrap", true).map((t) => t.tag)).toEqual(["v0.10.0", "v0.9.0", "v0.1.0"]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("in a repository of several instances a plain tag names no instance, so it is not read", () => {
    const dir = repoWithTags(["v1.0.0", "bootstrap-v0.2.0"]);
    expect(releaseTags(dir, "bootstrap").map((t) => t.tag)).toEqual(["bootstrap-v0.2.0"]);
    rmSync(dir, { recursive: true, force: true });
  });

  test("both spellings of one version are one release", () => {
    const dir = repoWithTags(["v0.1.0", "bootstrap-v0.1.0"]);
    expect(releaseTags(dir, "bootstrap", true).map((t) => t.version)).toEqual(["0.1.0"]);
    rmSync(dir, { recursive: true, force: true });
  });
});
