/**
 * Asking a repository what it is, and getting a SET back.
 *
 * @module smart-base/schemas/content-types-stack.test
 *
 * The thing this replaces is one line of shell in `getting-started.md`:
 *
 * ```sh
 * test -f harness.config.json && echo isFolio=true
 * ```
 *
 * One filename, one boolean, no type behind it — and wrong about the first
 * repository anybody asks it about, since `smart-base` is a DAK *and* a SUSHI
 * project at once. Bean `79t3`.
 *
 * Fixtures throughout. An assertion about what THIS repository is would pin
 * today's markers and go green the day somebody added one, which is a fact
 * about the subject rather than about the code.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  ContentTypeConflictError,
  ContentTypeRegistry,
  describeRepository,
} from "../platform/index.js";
import { registerBaseContentTypes } from "../platform/index.js";
import { registerDakContentTypes } from "./dak-content-type";
import { describeRepositoryClosure } from "../platform/index.js";
import { writeInstanceConfig } from "../platform/index.js";
import {  } from "../platform/index.js";

const roots: string[] = [];
afterEach(() => {
  for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true });
});

/**
 * A root `index.config.json` declaring a DAK: the `dak` section of
 * `contentTypes` IS the marker (owner, 2026-10-24, bean `cz17`).
 */
function dakIndex(section: string): string {
  return JSON.stringify({ $schema: "folio-index-config/v1", instances: [], contentTypes: { dak: JSON.parse(section) } });
}

/** A repository carrying the given marker files, by filename → contents. */
function repo(markers: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "ctype-"));
  roots.push(root);
  mkdirSync(root, { recursive: true });
  for (const [name, body] of Object.entries(markers)) {
    writeFileSync(join(root, name), body);
  }
  return root;
}

/**
 * A registry carrying every type a full stack would register, isolated from
 * the shared default.
 *
 * TWO calls, and the split is load-bearing rather than cosmetic: `harness` is
 * core's, `dak` and `sushi` are the WHO layer's, and
 * `check:partition:edges` refuses core importing `dak.ts` because `smart-base`
 * depends on core. A test that registered them from one module would be
 * testing an arrangement the import graph rejects.
 */
function base(): ContentTypeRegistry {
  const r = new ContentTypeRegistry();
  registerBaseContentTypes(r);
  registerDakContentTypes(r);
  return r;
}

describe("a repository is a SET of types, not a boolean", () => {
  test("noMarkerIsEmptySet", () => {
    // The distinction the boolean could not make: this registry found no
    // marker it knows. A consumer reading that as "not a folio" has confused
    // what was looked for with what is there.
    const d = describeRepository(repo({ "README.md": "# hi\n" }), base());
    expect(d.types).toEqual([]);
    expect(d.disagreements).toEqual([]);
  });

  test("oneMarkerOneMembership", () => {
    const d = describeRepository(repo({ ["x.json"]: '{"name":"x"}' }), base());
    expect(d.types.map((t) => t.id)).toEqual(["harness"]);
    // The IRI is the whole point: the filename asserts membership, the type
    // says what membership MEANS. A marker with no resolvable type is `blv9`.
    expect(d.types[0]!.type).toMatch(/^https?:\/\//);
    expect(d.types[0]!.marker).toBe("x.json");
  });

  test("twoMarkersTwoMemberships", () => {
    // `smart-base` is a DAK and a SUSHI project simultaneously. This is the
    // measured shape of the repository `79t3` cites, and the reason the answer
    // had to become a set.
    const root = repo({
      "index.config.json": dakIndex('{"name":"base","canonicalUrl":"http://smart.who.int/base"}'),
      "sushi-config.yaml": "canonical: http://smart.who.int/base\n",
    });
    expect(describeRepository(root, base()).types.map((t) => t.id).sort()).toEqual([
      "dak",
      "sushi",
    ]);
  });

  test("threeMarkersAtOnce", () => {
    const root = repo({
      ["x.json"]: '{"name":"x"}',
      "index.config.json": dakIndex('{"name":"x"}'),
      "sushi-config.yaml": "canonical: http://example.org/x\n",
    });
    expect(describeRepository(root, base()).types).toHaveLength(3);
  });
});

describe("a marker that is present and unreadable is its OWN state", () => {
  test("unparseableMarkerParsedFalse", () => {
    // Not absent, and not a clean membership either. Dropping it would under-
    // report what the repository asserts; reporting it as parsed would hand a
    // consumer facts nothing backs. The third state says which.
    // `x.config.json`: an unparseable file is only identifiable as a HARNESS
    // marker by its suffix, and since the declaration suffix became a bare
    // `.json` (2026-09-21) that identification belongs to the config name.
    const d = describeRepository(repo({ ["x.config.json"]: "{ not json" }), base());
    expect(d.types).toHaveLength(1);
    expect({ parsed: d.types[0]!.parsed, facts: d.types[0]!.facts }).toEqual({
      parsed: false,
      facts: {},
    });
  });

  test("yamlMarkerParsedFalse", () => {
    // `sushi-config.yaml` is the assertion whether or not this module can read
    // it. Reporting the membership costs nothing and losing it would be a
    // silent under-count; the facts wait on a YAML parser, which is a separate
    // decision with a real import cost.
    const d = describeRepository(repo({ "sushi-config.yaml": "canonical: http://x/\n" }), base());
    expect(d.types.map((t) => ({ id: t.id, parsed: t.parsed }))).toEqual([
      { id: "sushi", parsed: false },
    ]);
  });

  test("markerWithoutFactsContributesNone", () => {
    // `x.config.json`, not `x.json`. A body with no `name` is a CONFIG — the
    // declaration suffix became a bare `.json` on 2026-09-21 and a declaration
    // is recognised by its stem equalling its own `name`, which `{}` has not
    // got. Writing this as `x.json` makes it no marker at all, and the test
    // then fails on an empty set rather than on the fact it is about.
    const d = describeRepository(repo({ ["x.config.json"]: "{}" }), base());
    expect(d.types[0]!.facts).toEqual({});
    expect(d.disagreements).toEqual([]);
  });
});

describe("two markers stating one fact differently are REPORTED, not resolved", () => {
  test("disagreementFoundBothClaimsKept", () => {
    // `79t3` question 2, and its own "Done when" already answered it:
    // "a disagreement between two markers REPORTED rather than silently
    // resolved". Ranking the markers would make a repository's truth depend on
    // which layer happened to load first.
    const root = repo({
      ["x.json"]: '{"name":"x","canonicalUrl":"http://one.example/"}',
      "index.config.json": dakIndex('{"name":"x","canonicalUrl":"http://two.example/"}'),
    });
    const d = describeRepository(root, base());
    expect(d.disagreements).toHaveLength(1);
    expect(d.disagreements[0]!.fact).toBe("canonicalUrl");
    expect(d.disagreements[0]!.claims).toEqual({
      harness: "http://one.example/",
      dak: "http://two.example/",
    });
  });

  test("nothingResolvedNeitherClaimDropped", () => {
    // Stated as its own assertion because "reports it" and "reports it and
    // also quietly picks one" look identical from a caller that only reads
    // `types`. Both claims survive in full.
    const root = repo({
      ["x.json"]: '{"name":"x","canonicalUrl":"http://one.example/"}',
      "index.config.json": dakIndex('{"name":"x","canonicalUrl":"http://two.example/"}'),
    });
    const d = describeRepository(root, base());
    const byId = Object.fromEntries(d.types.map((t) => [t.id, t.facts["canonicalUrl"]]));
    expect(byId).toEqual({ harness: "http://one.example/", dak: "http://two.example/" });
  });

  test("agreementIsSilence", () => {
    const root = repo({
      ["x.json"]: '{"name":"x","canonicalUrl":"http://same.example/"}',
      "index.config.json": dakIndex('{"name":"x","canonicalUrl":"http://same.example/"}'),
    });
    expect(describeRepository(root, base()).disagreements).toEqual([]);
  });

  test("comparesCanonicalWithCanonicalUrl", () => {
    // The two files beside each other in `smart-base` spell one fact two ways.
    // Reading only our spelling would make every such disagreement invisible,
    // which is the failure mode this whole section exists to prevent.
    const root = repo({
      ["x.json"]: '{"name":"x","canonicalUrl":"http://ours.example/"}',
      "index.config.json": dakIndex('{"name":"x","canonical":"http://theirs.example/"}'),
    });
    expect(describeRepository(root, base()).disagreements.map((x) => x.fact)).toEqual([
      "canonicalUrl",
    ]);
  });
});

describe("the registry refuses a conflicting redefinition and tolerates a diamond", () => {
  test("reRegisteringSameIsNoOp", () => {
    const r = base();
    expect(() => registerBaseContentTypes(r)).not.toThrow();
    expect(() => registerDakContentTypes(r)).not.toThrow();
    // Derived from what the two registrars actually register, not pinned: a
    // literal list makes "a type was added" and "registration broke"
    // indistinguishable, and the failure lands on the change that was correct.
    // What is defended is that re-registering adds nothing.
    const before = r.ids().sort();
    registerBaseContentTypes(r);
    registerDakContentTypes(r);
    expect(r.ids().sort()).toEqual(before);
    expect(before.length).toBeGreaterThan(0); // not vacuous
  });

  test("reRegisteringDifferentThrows", () => {
    const r = base();
    expect(() =>
      r.register("dak", { filename: "elsewhere.json", type: "http://x/", summary: "no" }),
    ).toThrow(ContentTypeConflictError);
  });
});

describe("the set is closed under the dependency tree", () => {
  /**
   * `79t3`: *"declaring `folio-assistant` implies `cat-harness`, because
   * folio-assistant depends on it."*
   *
   * `describeRepositoryClosure` lives in `harness-config.ts` rather than
   * beside `describeRepository`, because the dependency resolver is there and
   * importing it into the type registry would make the registry depend on the
   * thing that should depend on it. Tested from here anyway — the behaviour is
   * about content types, and splitting the test from its subject to mirror a
   * module boundary helps nobody.
   */
  function instance(name: string, markers: Record<string, string>): string {
    const root = mkdtempSync(join(tmpdir(), `closure-${name}-`));
    roots.push(root);
    for (const [f, body] of Object.entries(markers)) writeFileSync(join(root, f), body);
    return root;
  }

  function dependsOn(root: string, depName: string, depPath: string): void {
    // Through the helper: the config is named after the layer now, and
    // these roots pin their own name in `harness.json` (`{"name":"mine"}`),
    // which `declareInstance` honours rather than overwrites.
    writeInstanceConfig(
      root,
      JSON.stringify({
        contentType: "paper",
        dependencies: { folioAssistant: [{ name: depName, path: depPath }] },
      }),
    );
  }

  test("closureAttributesDependencyTypes", () => {
    const dep = instance("dep", { "index.config.json": dakIndex('{"name":"who"}') });
    const root = instance("root", { ["mine.json"]: '{"name":"mine"}' });
    dependsOn(root, "who-adapter", dep);

    const c = describeRepositoryClosure(root, base());
    expect(c.types.map((t) => ({ id: t.id, by: t.by, own: t.own }))).toEqual([
      { id: "dak", by: "who-adapter", own: false },
      // The root carries `harness.json` AND the `harness.config.json` that
      // `dependsOn` just wrote, so it is a harness and a folio.
      { id: "harness", by: "(root)", own: true },
      { id: "folio", by: "(root)", own: true },
    ]);
  });

  test("ownSeparatesRootFromDependency", () => {
    // The distinction a flattened set destroys, and the case the bean cites:
    // a folio depending on a WHO adapter is not itself a DAK.
    const dep = instance("dep2", { "index.config.json": dakIndex('{"name":"who"}') });
    const root = instance("root2", { ["mine.json"]: '{"name":"mine"}' });
    dependsOn(root, "who-adapter", dep);

    const c = describeRepositoryClosure(root, base());
    expect(c.types.filter((t) => t.own).map((t) => t.id).sort()).toEqual(["folio", "harness"]);
    expect(c.types.some((t) => t.id === "dak" && t.own)).toBe(false);
  });

  test("typeAssertedByBothAppearsTwice", () => {
    // Two repositories each making the claim is what the tree says. Merging
    // them would answer "is this tree a DAK" and lose "which of them is".
    const dep = instance("dep3", { "index.config.json": dakIndex('{"name":"who"}') });
    const root = instance("root3", { "index.config.json": dakIndex('{"name":"mine"}') });
    dependsOn(root, "who-adapter", dep);

    const c = describeRepositoryClosure(root, base());
    expect(c.types.filter((t) => t.id === "dak").map((t) => t.by)).toEqual([
      "who-adapter",
      "(root)",
    ]);
  });

  test("noDependenciesClosureIsRoot", () => {
    const root = instance("solo", { ["mine.json"]: '{"name":"mine"}' });
    const c = describeRepositoryClosure(root, base());
    expect(c.types.map((t) => ({ id: t.id, by: t.by }))).toEqual([
      { id: "harness", by: "(root)" },
    ]);
  });

  test("differentReposCanonicalsNotDisagreement", () => {
    // They are two repositories. Reporting it as a conflict would make every
    // non-trivial dependency tree look broken, which is the false positive
    // that gets a check switched off within a week.
    const dep = instance("dep4", { "index.config.json": dakIndex('{"canonicalUrl":"http://theirs/"}') });
    const root = instance("root4", { ["x.json"]: '{"canonicalUrl":"http://ours/"}' });
    dependsOn(root, "who-adapter", dep);

    expect(describeRepositoryClosure(root, base()).disagreements).toEqual([]);
  });

  test("disagreementWithinInstanceReported", () => {
    const dep = instance("dep5", {
      // `name` is REQUIRED, and it is what makes this a declaration rather
      // than a file that happens to be called `harness.json`. The fixture got
      // away without one while nothing walked into a dependency as a
      // layer; `readHarnessConfig` now resolves the config through the
      // declaration, and a present-but-invalid declaration throws by design
      // (AGENTS.md: "Absent declaration is fine … a present-but-unreadable one
      // throws"). The subject here is two markers disagreeing about
      // `canonicalUrl`, and a valid declaration carries both facts fine.
      ["who-adapter.config.json"]: '{"name":"who-adapter","canonicalUrl":"http://a/"}',
      "index.config.json": dakIndex('{"canonicalUrl":"http://b/"}'),
    });
    const root = instance("root5", { ["mine.json"]: '{"name":"mine"}' });
    dependsOn(root, "who-adapter", dep);

    const c = describeRepositoryClosure(root, base());
    expect(c.disagreements.map((d) => ({ fact: d.fact, instance: d.instance }))).toEqual([
      { fact: "canonicalUrl", instance: "who-adapter" },
    ]);
  });
});
