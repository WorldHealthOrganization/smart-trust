/**
 * Tool nodes are real, well-formed, and reachable from the graph.
 *
 * Five Tool nodes were DESCRIBED across four skills and the harness analysis
 * before any existed. This is what makes the skill/Tool separation checkable
 * rather than asserted.
 *
 * The tests of this file that read the whole checkout (discovers skills across
 * every layer in the checkout) live in `test/tools-checkout.test.ts` (bean
 * `7zz1`): standing alone, cat-harness has none of it.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { tools } from "../../../tools/discover.js";
import { ToolDefinitionSchema, alternativesWithoutSelection, deriveAlternatives } from "../../../schemas/tools/tool.js";
import { TOOL_TYPES, toolTypeDocumentIri, toolTypeIri, toolTypeNameOf } from "../../../schemas/tools/tool-types.js";
import { checkTools, danglingStorageTools, knownSkills, contractRequires } from "../../check-tools.js";
import { knownSkills as canonicalKnownSkills } from "../../known-skills.js";
import { buildExport } from "../../kg-export.js";
import { buildToolTypeFiles, buildToolTypes, buildToolSchema, buildSkillIoContracts, skillIoIri, staleSkillIoIds } from "../../harness-schema-export.js";
import { repoRootFor } from "../../../schemas/kg/cat-harness.js";
import { scriptsOf } from "../../../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT, TOOLS_ROOT } from "../../lib/roots.ts";
import { hostSchemaBase } from "../../lib/host-schema.ts";

const BASE = "https://example.invalid/fa";
/** Where the host's schemas sit under `BASE`: its own directory, `<base>/<name>` (#676). */
const HOST = hostSchemaBase(BASE);

/**
 * The LAYER root, not `process.cwd()`.
 *
 * `contractRequires(root, …)` resolves `<root>/schemas/skills/<skill>/` — a
 * layer path. `process.cwd()` is the REPOSITORY root when the suite runs,
 * and the two were the same directory until the move (bean `wggr`), so passing
 * the cwd was right by coincidence rather than by argument.
 *
 * It is also the root the canonical `knownSkills` is asked for below, which is
 * the same question one level along: skill discovery resolves a layer's
 * declaration, so handing it a repository root would scan the wrong tree the
 * moment the two differ.
 */
const INSTANCE = resolve(HARNESS_ROOT);

/**
 * The Tool audit, run ONCE at module scope.
 *
 * Bean `sff8`. Five tests called `checkTools()` and each paid the full scan, putting
 * two of them among the repository's highest timeout exposure — measured by
 * `check:test-budgets` at **4.45 s and 3.27 s of a 5000 ms default budget** (89 % and
 * 65 %), named before either had gone red.
 *
 * Safe to share because nothing in this file mutates the corpus: all five calls are
 * no-arg, and no test writes a fixture, so five runs could only ever produce the same
 * answer. Module scope also belongs to no test's timeout, which is the remedy `sff8`
 * settled on over a raised budget — a number decays as the corpus grows.
 */
const CHECKED = checkTools();

/**
 * A STAGING-based export, built once — the base the `io IRIs` test needs.
 *
 * Bean `sff8`. It was `await buildExport({ baseUrl: branches/ })` in the test body at
 * 4.23 s of a 5000 ms budget (85 %), and 2.6 s once `checkTools` above stopped being
 * re-run five times. Hoisted for the same reason as the rest: module scope belongs to
 * no test's timeout.
 *
 * The base is deliberately a STAGING-shaped URL rather than the canonical one — the
 * whole assertion is that a minted IRI follows the publication base rather than the
 * declaration, so a canonical base here would make the test pass without testing
 * anything.
 */
const STAGING_BASE = "https://example.invalid/fa/STAGING/demo";
const STAGING_EXPORT = await buildExport({ baseUrl: STAGING_BASE });

describe("tools", () => {
  test("there are tools to check — otherwise everything below is vacuous", () => {
    expect(tools().length).toBeGreaterThanOrEqual(4);
  });

  test("every satisfies edge agrees with its skill's own input contract", () => {
    // A `satisfies` edge asserts the Tool is one concrete way to exercise the
    // skill. If the skill's contract requires an input the Tool has no port
    // for, the Tool cannot exercise it and the edge is false.
    //
    // This caught two edges written in #295 and both were wrong:
    // `translation-validate` claimed `content-validate` (whose contract wants
    // `targetPath`; validating a .po against a .pot is a different thing), and
    // `workflow-complete` claimed `dmn-authoring` (whose contract wants
    // `decisionName`/`inputVariables` — what you supply to WRITE a table, not
    // to answer one).
    expect(CHECKED.unmetContracts).toEqual([]);
  });

  test("where a Tool input and a contract property share a name, their types agree", () => {
    // The type half of the comparison (#1168, B3b). Weak — most contract
    // properties are bare strings — but it catches an `array` contract served
    // by a `string` port, which the name check alone passes.
    expect(CHECKED.mistypedContracts).toEqual([]);
  });

  test("a contract that is present but unreadable is never counted as agreement", () => {
    // The third state. `undefined` (no contract) and `[]` (a contract
    // requiring nothing) are different answers and the checker keeps them
    // apart; an unreadable file is reported rather than passed.
    expect(CHECKED.unreadableContracts).toEqual([]);
    expect(contractRequires(INSTANCE, "no-such-skill-exists")).toBeUndefined();
    const req = contractRequires(INSTANCE, "content-validate");
    expect(req).toContain("targetPath");
  });

  test("every skill I/O contract publishes at the address its own $id claims", () => {
    // All 44 carried `github.com/<owner>/<repo>/schemas/...` — a 403, because
    // GitHub's browse route needs `/blob/<ref>/`. Born that way on 2026-03-24
    // and never dereferenced since.
    const contracts = buildSkillIoContracts({ baseUrl: BASE });
    expect(contracts.length).toBeGreaterThan(0);
    for (const c of contracts) {
      const id = c.schema.$id as string;
      expect(id).toBe(skillIoIri(HOST, c.skill, c.io));
      // The published path must be exactly what the IRI's tail says, or the
      // deploy writes the file somewhere the identity does not name.
      expect(`${HOST}/${c.published}`).toBe(id);
    }
  });

  test("no source $id has drifted from where it publishes", () => {
    expect(staleSkillIoIds()).toEqual([]);
  });

  test("every io port references a type the shared vocabulary declares", () => {
    expect(CHECKED.unknownTypes).toEqual([]);
  });

  test("io references are absolute IRIs into the published types document", () => {
    // Relative would resolve differently depending on where a consumer fetched
    // the Tool, so two consumers could disagree about what a tool accepts.
    const doc = buildToolTypes({ baseUrl: BASE });
    const defs = new Set(Object.keys(doc.$defs as Record<string, unknown>));
    expect(defs.size).toBe(Object.keys(TOOL_TYPES).length);
    for (const t of tools()) {
      for (const p of [...t.io.inputs, ...t.io.outputs]) {
        expect(p.schema.startsWith("https://")).toBe(true);
        // Its own document, `<base>/tool-types/<Name>.schema.json` (bean `tdir`).
        expect(defs.has(toolTypeNameOf(p.schema) ?? "")).toBe(true);
      }
    }
  });

  test("a Tool reachable only over MCP is rejected", () => {
    // The harness assumes no MCP server, so a Tool whose ONLY arm is `mcp` is
    // not usable by the layer that defines it — and projecting it would emit a
    // server that proxies itself. Rejected at parse time, not at review.
    const mcpOnly = {
      id: "mcp-only", title: "x", description: "y",
      install: { none: true as const },
      invoke: { mcp: { tool: "something" } },
      io: { inputs: [], outputs: [] },
      satisfies: ["todo-manager"],
    };
    expect(ToolDefinitionSchema.safeParse(mcpOnly).success).toBe(false);
    // The same Tool WITH a shell arm is fine — mcp is an extra, not a defect.
    expect(ToolDefinitionSchema.safeParse({ ...mcpOnly, invoke: { ...mcpOnly.invoke, shell: "x" } }).success).toBe(true);
  });

  test("a Tool satisfying nothing is rejected", () => {
    const orphan = {
      id: "orphan", title: "x", description: "y",
      install: { none: true as const }, invoke: { shell: "x" },
      io: { inputs: [], outputs: [] }, satisfies: [],
    };
    expect(ToolDefinitionSchema.safeParse(orphan).success).toBe(false);
  });

  test("the beans pair satisfies exactly the same skills", () => {
    // The point of two beans Tools: an agent in a fresh container with no CLI
    // must still find a mechanism. If the fallback covered fewer skills it
    // would be the degraded mode `skills-and-tools` says it is not.
    const byId = new Map(tools().map((t) => [t.id, t]));
    const cli = byId.get("beans-cli")!;
    const manual = byId.get("beans-manual")!;
    expect([...manual.satisfies].sort()).toEqual([...cli.satisfies].sort());
  });

  test("the generated schemas carry an absolute $id", () => {
    // Under the host's own directory, beside its document (#676).
    expect(buildToolSchema({ baseUrl: BASE }).$id).toBe(`${BASE}/cat-harness/tool.schema.json`);
    expect(buildToolTypes({ baseUrl: BASE }).$id).toBe(`${BASE}/cat-harness/tool-types.schema.json`);
  });

  test("each type is its own document, whose $id is the IRI a port names (bean tdir)", () => {
    const files = buildToolTypeFiles({ baseUrl: BASE });
    expect(files.map(([p]) => p).sort()).toEqual(Object.keys(TOOL_TYPES).map((n) => `tool-types/${n}.schema.json`).sort());
    const combined = buildToolTypes({ baseUrl: BASE }).$defs as Record<string, Record<string, unknown>>;
    for (const [path, doc] of files) {
      const name = toolTypeNameOf(path)!;
      expect(doc.$id).toBe(toolTypeDocumentIri(HOST, name));
      expect(doc.$id).toBe(`${HOST}/${path}`);
      // The same Zod, printed twice: the body is the combined document's.
      const { $schema: _a, $id: _b, title: _c, ...body } = doc;
      const { $schema: _d, ...inline } = combined[name];
      expect(body).toEqual(inline);
    }
    // And every port in the repository names one of them.
    for (const t of tools()) {
      for (const p of [...t.io.inputs, ...t.io.outputs]) expect(toolTypeNameOf(p.schema)).toBeDefined();
    }
  });

  test("skill discovery is the ONE definition, not a second scan", () => {
    // REGRESSION, 2026-09-20. This module had its own `knownSkills`: the first
    // declared `cat-harness` root and its immediate subdirectories. It
    // disagreed with `known-skills.ts` in both directions at once, and each
    // direction is a different way for the check to be wrong.
    const s = knownSkills();
    const canonical = canonicalKnownSkills(INSTANCE);
    expect([...canonical].filter((n) => !s.has(n))).toEqual([]);
    expect([...s].filter((n) => !canonical.has(n))).toEqual([]);

    // The two halves, named, so a re-divergence says WHICH failure returned
    // rather than only that the sets differ.
    //
    // Admitted 36 non-skills: `skills/memory/` then held agent-memory nodes, every
    // one a `.md` in a declared directory. A directory scan cannot tell them
    // apart; `isSkillMd` does, by their `$schema:` line. Under the old scan a
    // Tool could have satisfied a memory entry and passed.
    expect(s.has("the-complement")).toBe(false);
    // Missed 2 real ones: `bootstrap/skills/` holds skills DIRECTLY rather
    // than in packages, and a scan of a root's subdirectories never looks at
    // the root. Both read as dangling, which is how this was found.
    //
    // THOSE TWO NO LONGER BELONG TO THIS LAYER, and the assertion is
    // inverted rather than deleted — bean `pve3`, the owner's ruling of
    // 2026-09-21 ("neither"). `cat-harness/harness.json` no longer declares
    // `bootstrap/skills/`, so bootstrap's skills are published through
    // its OWN graph and this layer does not overlay them. Deleting the
    // lines would lose the regression they were written for; flipping them
    // keeps it, because the failure mode being guarded is a SCAN that
    // disagrees with the declaration, in either direction.
    expect(s.has("confirm-harness")).toBe(false);
    expect(s.has("log-message")).toBe(false);
    // And they are still REACHABLE, which is what makes the removal a
    // relocation rather than a loss. `check-tools`' `satisfiableSkills` reads
    // every declared layer for exactly this reason.
    expect(canonicalKnownSkills(join(INSTANCE, "../bootstrap")).has("log-message")).toBe(true);
  });

  test("io IRIs follow the publication base, not the declaration", () => {
    // A staging build published tool-types.schema.json at the branches/ url while
    // its Tool nodes referenced the CANONICAL one — a document that did not
    // exist yet, because the same PR introduced it. The refs looked resolvable
    // and 404'd. Found by fetching the published artefacts rather than assuming
    // they agreed.
    //
    // The rule this pins: anything that mints an IRI takes its base from the
    // same source as the document it will be published beside.
    const STAGING = STAGING_BASE;
    const g = STAGING_EXPORT;
    const toolNodes = g["@graph"].filter((n) => String(n["@type"]).endsWith("Tool"));
    expect(toolNodes.length).toBeGreaterThanOrEqual(4);

    for (const t of toolNodes) {
      const io = t.io as { inputs: Array<{ schema: string }>; outputs: Array<{ schema: string }> };
      for (const port of [...io.inputs, ...io.outputs]) {
        // Minted by toolTypeIri against the staging base, whichever form it
        // has in this phase (fragment now, per-type document next; bean tdir).
        // Under the host's directory at that base (#676), where the schema
        // export writes the vocabulary.
        expect(port.schema.startsWith(`${hostSchemaBase(STAGING)}/tool-types`)).toBe(true);
        expect(port.schema).toBe(toolTypeIri(hostSchemaBase(STAGING), toolTypeNameOf(port.schema)!));
      }
    }
  });

  test("tools() honours an explicit base", () => {
    const B = "https://example.invalid/other";
    for (const t of tools(B)) {
      for (const p of [...t.io.inputs, ...t.io.outputs]) {
        expect(p.schema.startsWith(`${hostSchemaBase(B)}/tool-types`)).toBe(true);
      }
    }
  });
});

describe("substitutable Tools are DERIVED, and say how to choose (#1168, B9a)", () => {
  const all = tools("https://example.org/");
  const byId = new Map(all.map((t) => [t.id, t]));
  const alts = deriveAlternatives(all);
  const pairs = [...alts].flatMap(([a, bs]) => bs.filter((b) => a < b).map((b) => `${a} ~ ${b}`)).sort();

  test("the derived pairs are exactly the substitutable ones", () => {
    // Every pair that was declared by hand before the field was removed, and
    // nothing else. A new pair here is either a real alternative (add it, and
    // its `selection`) or a Tool typed more loosely than what it reads (type
    // it). The release pair is stated at the level of the release — a package
    // in, a tag out — so the rule pairs it (owner, 2026-09-30).
    expect(pairs).toEqual([
      "beans-cli ~ beans-manual",
      // One Tool node per forge operation (cat-harness#385, bean `4dbr` step
      // 2): the GitHub and GitLab forms of each operation read and write the
      // same things, and each carries a `selection` naming the forge.
      "github-branches ~ gitlab-branches",
      "github-pr-comment ~ gitlab-mr-comment",
      "github-pr-files ~ gitlab-mr-files",
      "github-pr-list ~ gitlab-mr-list",
      "github-pr-view ~ gitlab-mr-view",
      // folio-assistant-core 458bb7a: both rewrite generated table blocks of a
      // document, and each carries a `selection` saying which to pick. Core's
      // Tools load only where core is mounted, so standalone has no such pair.
      ...(byId.has("glossary-table") && byId.has("references-render") ? ["glossary-table ~ references-render"] : []),
      "ingest-extended ~ ingest-stdlib",
      // cat-harness 9cc0a6f4 (#991): both keep work context in memory, and
      // each carries a `selection`: a running note while working, a
      // checkpoint before stopping. Present only where cat-harness has them.
      ...(byId.has("memory-checkpoint") && byId.has("memory-note") ? ["memory-checkpoint ~ memory-note"] : []),
      "package-release-manual ~ release-please",
      // Two runtimes for one server (bean `0hi8`: "at least two tools satisfy
      // it"): same ports, same skill, and a `selection` on each that says Bun
      // or Python. Substitutable by design, so it belongs in this list.
      "serve-rendering ~ serve-rendering-py",
      "transcribe-faster-whisper ~ transcribe-vosk",
      "transcribe-faster-whisper ~ transcribe-whisper-cpp",
      "transcribe-vosk ~ transcribe-whisper-cpp",
    ]);
  });

  test("the relation is symmetric by construction", () => {
    for (const [a, bs] of alts) for (const b of bs) expect(alts.get(b) ?? []).toContain(a);
  });

  test("every Tool with an alternative carries all three selection fields", () => {
    for (const id of alts.keys()) {
      const t = byId.get(id)!;
      // `limits` is the one an author is tempted to skip. Without it an agent
      // reaches for the tool and discovers the boundary by failing.
      for (const k of ["when", "limits", "cost"] as const) {
        expect(`${t.id}.${k}`).toBe(t.selection?.[k] ? `${t.id}.${k}` : `${t.id}.${k} MISSING`);
      }
    }
  });

  test("check-tools reports a Tool with an alternative and no selection", () => {
    // The falsifier: the real set is clean, so the check is proved on it by
    // counting zero, and on a broken copy by counting one.
    expect(CHECKED.unselectableAlternatives).toEqual([]);
    const base = byId.get("ingest-stdlib")!;
    const { selection: _drop, ...without } = base;
    const broken = [...all.filter((t) => t.id !== base.id), without as typeof base];
    expect(alternativesWithoutSelection(broken)).toEqual([{ tool: "ingest-stdlib", alternatives: ["ingest-extended"] }]);
  });

  test("sharing a skill does NOT imply substitutability", () => {
    // The measurement that refuted deriving this from `satisfies` ALONE: 12 of
    // 25 skills carry more than one Tool and nearly all are COMPLEMENTARY.
    // The `process-state` tools are steps, not choices, and their different
    // I/O signatures are what keep them apart.
    const processState = all.filter((t) => t.satisfies.includes("process-state"));
    expect(processState.length).toBeGreaterThan(1);
    for (const t of processState) expect(alts.get(t.id) ?? []).toEqual([]);
  });

  test("an empty signature is interchangeable with nothing", () => {
    const empty = { ...byId.get("ingest-stdlib")!, io: { inputs: [], outputs: [] } };
    expect(deriveAlternatives([empty, { ...empty, id: "other" }]).size).toBe(0);
  });

  test("the ingest pair is derived, and splits on the dependency boundary", () => {
    const std = byId.get("ingest-stdlib");
    const ext = byId.get("ingest-extended");
    expect([std?.id, ext?.id]).toEqual(["ingest-stdlib", "ingest-extended"]);
    // The whole point of the pair: one needs nothing, the other needs a
    // toolchain. `install.none` states "needs nothing" rather than leaving it
    // to absence, which is the distinction that flag exists for.
    expect(std?.install.none).toBe(true);
    expect(ext?.install.cli).toBeTruthy();
    expect(std?.satisfies).toEqual(ext?.satisfies);
    // Each names the other as where its limits are picked up.
    expect(std?.selection?.limits).toContain("ingest-extended");
    expect(ext?.selection?.limits).toContain("ingest-stdlib");
  });
});

describe("the gates Tool — one node over a derived list", () => {
  const all = tools(BASE);
  const gates = all.find((t) => t.id === "gates");

  test("the node exists, or nothing below is testing anything", () => {
    expect(gates?.id).toBe("gates");
  });

  test("its command is a real script, not a guess at one", () => {
    // `invoke.shell` is prose to the schema. The failure it cannot catch is a
    // node naming a script that was renamed or never existed, which an agent
    // discovers by running it.
    const pkg = { scripts: scriptsOf(repoRootFor(INSTANCE)) };
    expect(gates?.invoke.shell).toBe("bun run cat gates");
    expect(pkg.scripts.gates).toContain("scripts/gates.ts");
  });

  test("every flag it declares is one `gates.ts` actually reads", () => {
    // The drift this pins is the cheap one: a node advertising an option the
    // script ignores fails silently, running the default and reporting
    // success.
    const src = readFileSync(resolve(TOOLS_ROOT, "scripts", "gates.ts"), "utf-8");
    // `arg` is a union of flag / positional / stdin, so narrow rather than
    // reach through it — a positional input would otherwise be read as an
    // absent flag and silently drop out of the comparison.
    const flags = (gates?.io.inputs ?? [])
      .map((i) => (i.arg && "flag" in i.arg ? i.arg.flag : undefined))
      .filter((f): f is string => f !== undefined);
    expect(flags).toEqual(["--all", "--list"]);
    for (const f of flags) expect(src).toContain(`process.argv.includes("${f}")`);
  });

  test("there is exactly ONE gate Tool, and the list stays derived", () => {
    // Route B of `folio-assistant-3lbz` reads naturally as one node per gate.
    // That would make `tools/` a second answer to "what are the gates", free
    // to disagree with `gates.ts` — which computes the list from the workflow
    // — the moment either changes. The node count is the assertion: if a
    // later change starts minting per-gate nodes, this fails and the author
    // has to argue for it rather than drift into it.
    const gateish = all.filter((t) => t.id === "gates" || t.id.startsWith("gate-"));
    expect(gateish.map((t) => t.id)).toEqual(["gates"]);
  });

  test("it says why it exists where CI does not, which is the whole business case", () => {
    // `tools/` is inherited across layers and `.github/workflows/` is not.
    // An agent choosing this tool downstream has no CI to fall back on, so
    // `selection.when` has to carry that rather than leave it to the reader.
    for (const k of ["when", "limits", "cost"] as const) {
      expect(`${k}: ${gates?.selection?.[k] ? "present" : "MISSING"}`).toBe(`${k}: present`);
    }
    expect(gates?.selection?.when).toContain("INHERITED");
    expect(gates?.requires?.network).toBe(false);
  });
});

describe("storage.tool names a declared Tool (bean j9cs)", () => {
  test("the repository's own declarations name only declared Tools", () => {
    expect(danglingStorageTools()).toEqual([]);
  });

  test("a store naming no declared Tool is reported, with where it was declared", () => {
    const repo = mkdtempSync(join(tmpdir(), "storage-tool-"));
    mkdirSync(join(repo, "inst"), { recursive: true });
    writeFileSync(
      join(repo, "inst", "inst.json"),
      JSON.stringify({
        name: "inst",
        directories: [
          { id: "site", path: "site/", graphTypologies: ["basic-cdn-site"], storage: { branch: "gh-pages", keyedBy: "route", tool: "no-such-tool" } },
          { id: "ok", path: "ok/", graphTypologies: ["basic-cdn-site"], storage: { branch: "gh-pages", keyedBy: "route", tool: "gh-pages" } },
        ],
      }),
    );
    expect(danglingStorageTools(repo)).toEqual([{ instance: "inst", directory: "site", tool: "no-such-tool" }]);
  });
});
