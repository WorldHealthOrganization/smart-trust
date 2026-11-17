/**
 * Tests for the contribution registry and its loader — issue #223, Phase 0.1.
 *
 * The gate the migration plan sets for this phase: a synthetic two-repo
 * fixture where the dependency contributes one block kind, one skill and one
 * MCP tool, and the root resolves all three — plus a test asserting a kind
 * collision is REFUSED rather than silently overlaid.
 */
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ContributionRegistry,
  ContributionCollisionError,
  composedKindOwner,
  type FolioContribution,
} from "./content/contributions.ts";
import { loadContributions } from "./kg/harness-config.ts";
import { CONTENT_ADAPTERS, adapterForKind } from "./content/block-kinds.ts";
import { writeDeclaration, writeInstanceConfig } from "../test/support/instance-fixture.js";

// Under the system temp directory, not beside this file (bean `dlqu`): an
// in-tree scratch directory is visible to every test that enumerates the
// checkout, and under `bun test --parallel` those run at the same time.
const TMP = mkdtempSync(join(tmpdir(), "test_contributions-"));

beforeAll(() => {
  // ── The gate fixture: a root folio with one dependency that contributes
  //    a block kind, an adapter vocabulary and a QA checker — as DECLARED
  //    NODES (bean riit). Until riit a dependency returned these from a
  //    `contributes:` module; the loader no longer reads one, and a fixture
  //    still built that way measured nothing (the four cases below were red on
  //    main for that reason, not for a loader defect).
  const dep = join(TMP, "dep-sci");
  mkdirSync(join(dep, "skills", "authoring-math"), { recursive: true });
  writeFileSync(join(dep, "skills", "authoring-math", "SKILL.md"), "# math\n", "utf-8");
  for (const d of ["block-kinds", "content-adapters", "qa-checkers", "checks"]) mkdirSync(join(dep, d), { recursive: true });
  writeFileSync(
    join(dep, "block-kinds", "knot-diagram.json"),
    JSON.stringify({ $schema: "folio-block-kind/v1", kind: "knot-diagram", adapter: "sci", labelPrefix: "knot", folioType: "dep-sci:KnotDiagram" }),
  );
  writeFileSync(
    join(dep, "content-adapters", "sci.json"),
    JSON.stringify({ $schema: "folio-content-adapter/v1", adapter: "sci", typed: false, companionRoles: ["md", "ts"], vocabulary: "adapters/sci/index.ts" }),
  );
  writeFileSync(
    join(dep, "qa-checkers", "knot-well-formed.json"),
    JSON.stringify({ $schema: "folio-qa-checker/v1", criterion: "knot-well-formed", check: "checks/knots.ts#KNOT_CHECKERS" }),
  );
  writeFileSync(join(dep, "checks", "knots.ts"), `export const KNOT_CHECKERS = { "knot-well-formed": () => ({ result: "pass", hits: [] }) };\n`);
  writeDeclaration(dep, {
    name: "dep-sci",
    directories: [
      { id: "kinds", path: "block-kinds/", graphTypologies: ["block-kinds"] },
      { id: "adapters", path: "content-adapters/", graphTypologies: ["content-adapters"] },
      { id: "checkers", path: "qa-checkers/", graphTypologies: ["qa-checkers"] },
      { id: "skills", path: "skills/", graphTypologies: ["skills"] },
    ],
  });

  mkdirSync(join(TMP, "skills"), { recursive: true });
  writeInstanceConfig(TMP, JSON.stringify({ contentType: "document", dependencies: { folioAssistant: [{ name: "dep-sci", path: dep }] } }),
    "utf-8",
  );

  // ── A dependency whose qa-checker node names a table file that is not there.
  const broken = join(TMP, "dep-broken");
  mkdirSync(join(broken, "qa-checkers"), { recursive: true });
  writeFileSync(
    join(broken, "qa-checkers", "gone.json"),
    JSON.stringify({ $schema: "folio-qa-checker/v1", criterion: "gone", check: "checks/nope.ts#GONE" }),
  );
  writeDeclaration(broken, { name: "dep-broken", directories: [{ id: "checkers", path: "qa-checkers/", graphTypologies: ["qa-checkers"] }] });
  const brokenRoot = join(TMP, "root-broken");
  mkdirSync(brokenRoot, { recursive: true });
  writeInstanceConfig(brokenRoot, JSON.stringify({ dependencies: { folioAssistant: [{ name: "dep-broken", path: broken }] } }),
    "utf-8",
  );
});

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

describe("ContributionRegistry", () => {
  const sci = (): FolioContribution => ({
    name: "folio-asst-sci",
    blockKinds: [{ kind: "knot-diagram", adapter: "sci" }],
    adapter: { name: "sci", module: "./index.ts" },
    tools: [{ name: "lean", register: () => {} }],
  });

  it("accepts a contribution and reports what it added", () => {
    const r = new ContributionRegistry();
    r.register(sci());
    expect(r.kindOwner("knot-diagram")).toBe("sci");
    expect(r.adapterModule("sci")).toBe("./index.ts");
    expect(r.contributedTools()).toEqual(["lean"]);
  });

  it("is idempotent for the same contributor — a DIAMOND is not a collision", () => {
    // base -> kg -> core and sci -> core, so a depth-first walk reaches core
    // twice. Without this rule every realistic dependency tree throws a false
    // collision on first load, and the obvious fix (dropping the collision
    // check) is the one that must not be made.
    const r = new ContributionRegistry();
    r.register(sci());
    expect(() => r.register(sci())).not.toThrow();
    expect(r.contributedKinds()).toHaveLength(1);
  });

  it("REFUSES a kind claimed by a different contributor, naming both", () => {
    const r = new ContributionRegistry();
    r.register(sci());
    let err: unknown;
    try {
      r.register({ name: "smart-base", blockKinds: [{ kind: "knot-diagram", adapter: "dak" }] });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ContributionCollisionError);
    expect((err as Error).message).toContain("folio-asst-sci");
    expect((err as Error).message).toContain("smart-base");
  });

  it("refuses a kind the platform already owns", () => {
    // Shadowing `theorem` from a config file two repos away would change what
    // every existing folio validates against.
    const r = new ContributionRegistry();
    expect(() => r.register({ name: "rogue", blockKinds: [{ kind: "theorem", adapter: "mine" }] }))
      .toThrow(ContributionCollisionError);
  });

  it("refuses an adapter name the platform already owns", () => {
    const r = new ContributionRegistry();
    expect(() => r.register({ name: "rogue", adapter: { name: CONTENT_ADAPTERS[0]!, module: "./x.ts" } }))
      .toThrow(ContributionCollisionError);
  });

  // ── What a contributed kind carries (bean 1335) ──────────────────

  it("carries a contributed kind's builder, label prefix and JSON-LD types", () => {
    const r = new ContributionRegistry();
    r.register({
      name: "smart-base",
      blockKinds: [
        { kind: "decision-table", adapter: "dak", builder: "decisionTable", labelPrefix: "dt", folioType: "x:DT", docoType: "doco:Table" },
        { kind: "persona", adapter: "dak", labelPrefix: "pers" },
      ],
    });
    expect(r.kindEntry("decision-table")).toEqual({
      adapter: "dak",
      builder: "decisionTable",
      labelPrefix: "dt",
      folioType: "x:DT",
      docoType: "doco:Table",
    });
    // An omitted builder is the kind's own name; an omitted docoType is none.
    expect(r.kindEntry("persona")?.builder).toBe("persona");
    expect(r.kindEntry("persona")?.docoType).toBeUndefined();
    expect([...r.contributedBuilders()]).toEqual([["decisionTable", "decision-table"], ["persona", "persona"]]);
    expect(r.contributedLabelPrefixes().sort()).toEqual(["dt", "pers"]);
    // A built-in kind is not the registry's to describe.
    expect(r.kindEntry("theorem")).toBeUndefined();
  });

  it("refuses a contributed builder that is a built-in builder", () => {
    // `export default theorem(` must not be able to mean two kinds.
    const r = new ContributionRegistry();
    expect(() => r.register({ name: "rogue", blockKinds: [{ kind: "my-thm", adapter: "x", builder: "theorem" }] }))
      .toThrow(ContributionCollisionError);
  });

  it("refuses one builder claimed for two contributed kinds", () => {
    const r = new ContributionRegistry();
    r.register({ name: "a", blockKinds: [{ kind: "k-one", adapter: "x", builder: "kOne" }] });
    expect(() => r.register({ name: "b", blockKinds: [{ kind: "k-two", adapter: "y", builder: "kOne" }] }))
      .toThrow(ContributionCollisionError);
  });

  it("accepts `dak` as a contributed adapter now that core does not build it in", () => {
    const r = new ContributionRegistry();
    r.register({ name: "smart-base", adapter: { name: "dak", module: "./x.ts", companionRoles: ["ts", "dmn"] } });
    expect(r.contributedAdapters()).toEqual(["dak"]);
    expect(r.adapterCompanionRoles("dak")).toEqual(["ts", "dmn"]);
    // An adapter nobody contributed is not "no roles" — it is unknown.
    expect(r.adapterCompanionRoles("nobody")).toBeUndefined();
  });

  it("refuses a tool group claimed by a different contributor", () => {
    const r = new ContributionRegistry();
    r.register(sci());
    expect(() => r.register({ name: "other", tools: [{ name: "lean", register: () => {} }] }))
      .toThrow(ContributionCollisionError);
  });

  it("runs every contributed tool registrar against the server", () => {
    const seen: string[] = [];
    const r = new ContributionRegistry();
    r.register({ name: "a", tools: [{ name: "lean", register: () => seen.push("lean") }] });
    r.register({ name: "b", tools: [{ name: "fsh", register: () => seen.push("fsh") }] });
    r.registerTools({});
    expect(seen.sort()).toEqual(["fsh", "lean"]);
  });
});

describe("composedKindOwner", () => {
  it("consults the platform first, the registry second", () => {
    const r = new ContributionRegistry();
    r.register({ name: "sci", blockKinds: [{ kind: "knot-diagram", adapter: "sci" }] });
    expect(composedKindOwner("theorem", r, adapterForKind)).toBe(adapterForKind("theorem")!);
    expect(CONTENT_ADAPTERS as readonly string[]).toContain(adapterForKind("theorem")!);
    expect(composedKindOwner("knot-diagram", r, adapterForKind)).toBe("sci");
  });

  it("returns undefined for an unknown kind — never a guess", () => {
    // Same contract as adapterForKind: the caller decides what unknown means.
    expect(composedKindOwner("nonsense", new ContributionRegistry(), adapterForKind)).toBeUndefined();
  });
});

describe("loadContributions — the Phase 0.1 gate", () => {
  it("a dependency contributes a block kind, an adapter and a QA checker", async () => {
    // MCP tools are no longer contributed here: a Tool node declares its own
    // registrar (bean zmdo), so the loader carries kinds, adapters, checkers
    // and plugins only.
    const r = await loadContributions<FolioContribution, ContributionRegistry>(TMP, new ContributionRegistry());
    expect(r.kindOwner("knot-diagram")).toBe("sci");
    expect(r.adapterModule("sci")).toBe("adapters/sci/index.ts");
    expect(r.qaCheckerEntry("knot-well-formed")).toBeDefined();
  });

  it("the dependency's declared name wins over whatever the module claims", async () => {
    // A contributor that could rename itself could impersonate another
    // contributor's namespace and turn a collision into a silent merge. Under
    // nodes there is no module to make the claim; the entry's name is the only
    // one, and this holds that it stays so.
    const r = await loadContributions<FolioContribution, ContributionRegistry>(TMP, new ContributionRegistry());
    expect(r.contributedKinds()[0]?.contributor).toBe("dep-sci");
  });

  it("the dependency entry's ROOT wins too, so a checker hashes the right bytes", async () => {
    // Not the same field as `name`: this one says where the contributor's
    // FILES are, and a contributed checker's source file is resolved against
    // it to be freshness-hashed.
    const r = await loadContributions<FolioContribution, ContributionRegistry>(TMP, new ContributionRegistry());
    const entry = r.qaCheckerEntry("knot-well-formed");
    expect(entry?.root).toBe(join(TMP, "dep-sci"));
    expect(entry?.label).toBe("dep-sci/checks/knots.ts");
  });

  it("a declared checker whose code is missing fails loudly", async () => {
    // A stated intention that silently did nothing is the exact failure mode
    // AGENTS.md records under "move wiring and script together".
    await expect(loadContributions<FolioContribution, ContributionRegistry>(join(TMP, "root-broken"), new ContributionRegistry())).rejects.toThrow(/does not exist/);
  });

  it("a folio with no dependencies loads an empty registry, not an error", async () => {
    const bare = join(TMP, "bare");
    mkdirSync(bare, { recursive: true });
    writeInstanceConfig(bare, JSON.stringify({ contentType: "document" }));
    const r = await loadContributions<FolioContribution, ContributionRegistry>(bare, new ContributionRegistry());
    expect(r.contributedKinds()).toEqual([]);
  });
});

describe("contributed QA checkers", () => {
  const checker = (result: "pass" | "fail") => () => ({ result, hits: [] });
  /** A contribution carries its root, as `loadContributions` pins it. */
  const from = (name: string, criterion: string, result: "pass" | "fail" = "pass") => ({
    name,
    root: `/deps/${name}`,
    qaCheckers: [{ criterion, check: checker(result), sourceFile: "pipeline/checkers.ts" }],
  });

  it("a dependency's checker is reachable by the criterion it answers", () => {
    const r = new ContributionRegistry();
    r.register(from("smart-base", "dak-bpmn-has-process"));
    expect(r.qaChecker("dak-bpmn-has-process")).toBeDefined();
    expect(r.contributedQaCheckers()).toEqual([
      {
        criterion: "dak-bpmn-has-process",
        contributor: "smart-base",
        label: "smart-base/pipeline/checkers.ts",
      },
    ]);
  });

  it("an unimplemented criterion is undefined, never a default pass", () => {
    const r = new ContributionRegistry();
    expect(r.qaChecker("nobody-implements-this")).toBeUndefined();
    expect(r.qaCheckerEntry("nobody-implements-this")).toBeUndefined();
  });

  it("the entry carries where the bytes are, so the verdict can go stale", () => {
    // The whole reason `sourceFile` is required. A checker the sweep can run
    // but cannot hash is a checker whose verdicts are fresh forever.
    const r = new ContributionRegistry();
    r.register(from("smart-base", "dak-bpmn-has-process"));
    expect(r.qaCheckerEntry("dak-bpmn-has-process")).toEqual({
      check: expect.any(Function),
      sourceFile: "pipeline/checkers.ts",
      root: "/deps/smart-base",
      label: "smart-base/pipeline/checkers.ts",
    });
  });

  it("qaCheckers without a root is refused, naming the contributor", () => {
    const r = new ContributionRegistry();
    expect(() =>
      r.register({
        name: "smart-base",
        qaCheckers: [{ criterion: "dak-bpmn-has-process", check: checker("pass"), sourceFile: "x.ts" }],
      }),
    ).toThrow(/"smart-base" supplies qaCheckers but no root/);
  });

  it("two contributors claiming one criterion throws, naming both", () => {
    const r = new ContributionRegistry();
    r.register(from("smart-base", "shared"));
    expect(() => r.register(from("folio-asst-sci", "shared", "fail"))).toThrow(
      /both "smart-base" and "folio-asst-sci"/,
    );
  });

  it("the same contributor re-registering is a no-op, so a diamond loads", () => {
    const r = new ContributionRegistry();
    const c = from("smart-base", "shared");
    r.register(c);
    expect(() => r.register(c)).not.toThrow();
    expect(r.contributedQaCheckers()).toHaveLength(1);
  });
});

describe("contributed renderers", () => {
  const tex = {
    format: "latex",
    adapters: ["paper"],
    render: () => "\\begin{theorem}x\\end{theorem}",
    validate: (s: string) => ({ valid: s.includes("\\end"), errors: [] }),
  };

  it("a render target is reachable by format and by adapter", () => {
    const r = new ContributionRegistry();
    r.register({ name: "folio-asst-sci", renderers: [tex] });
    expect(r.renderer("latex")).toBeDefined();
    expect(r.renderersFor("paper")).toHaveLength(1);
  });

  it("an adapter with no contributed target gets a DETERMINED empty", () => {
    // Not the same as having no registry: this caller knows there is nothing,
    // rather than knowing nothing.
    const r = new ContributionRegistry();
    r.register({ name: "folio-asst-sci", renderers: [tex] });
    expect(r.renderersFor("dak")).toEqual([]);
  });

  it("a target may render without validating, and says so by omission", () => {
    // `validate` absent means NO STRUCTURAL CHECK, which a caller must report
    // as not-checked rather than as a pass.
    const r = new ContributionRegistry();
    r.register({
      name: "folio-assist-core",
      renderers: [{ format: "markdown", adapters: ["document"], render: () => "# x" }],
    });
    expect(r.renderer("markdown")?.validate).toBeUndefined();
    expect(r.renderer("markdown")?.render).toBeDefined();
  });

  it("two contributors claiming one format throws, naming both", () => {
    const r = new ContributionRegistry();
    r.register({ name: "folio-asst-sci", renderers: [tex] });
    expect(() =>
      r.register({ name: "other", renderers: [{ ...tex, render: () => "" }] }),
    ).toThrow(/both "folio-asst-sci" and "other"/);
  });

  it("the same contributor re-registering is a no-op, so a diamond loads", () => {
    const r = new ContributionRegistry();
    const c = { name: "folio-asst-sci", renderers: [tex] };
    r.register(c);
    expect(() => r.register(c)).not.toThrow();
    expect(r.contributedRenderers()).toHaveLength(1);
  });

  it("the listing names the format, its adapters and its contributor", () => {
    const r = new ContributionRegistry();
    r.register({ name: "folio-asst-sci", renderers: [tex] });
    expect(r.contributedRenderers()).toEqual([
      { format: "latex", adapters: ["paper"], contributor: "folio-asst-sci" },
    ]);
  });
});
