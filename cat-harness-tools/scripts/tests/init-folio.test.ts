/**
 * `folio_init` — the scaffolder.
 *
 * The failures worth guarding against are not "did it write files" but the
 * three that produce a folio which *looks* right and does not work: a layout
 * whose manifests cannot find each other, a re-run that silently replaces an
 * author's work, and a document folio scaffolded with paper defaults.
 *
 * The end-to-end test is the load-bearing one: it scaffolds into a temp dir,
 * links the platform, and renders. A layout mistake shows up there and
 * nowhere else, because every individual file is syntactically fine.
 *
 * The tests of this file that read the whole checkout (scaffolds against the
 * adapters folio-assistant-core and folio-assistant-sci hold) live in
 * `test/init-folio-checkout.test.ts` (bean `7zz1`): standing alone,
 * cat-harness has none of it.
 */
import { describe, test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, symlinkSync, mkdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";

import { spawnSync } from "child_process";

import { parse as parseYaml } from "yaml";
import { notApplicableAlone } from "../../test/support/checkout.js";

import {
  enclosingRepoRoot,
  folioTemplates,
  initFolio,
  initInstance,
  INSTANCE_STATE_GRAPHS,
  isValidSlug,
  remotePlatformLayers,
  renderTemplate,
  slugify,
  templatesDir,
  templatesDirs,
  TEMPLATE_PLACEHOLDER_RE,
  type InitFolioOptions,
} from "../init-folio";
import { layerConfigFilename } from "../../schemas/kg/harness-config.js";
import { IndexConfigSchema, checkIgnoreBlock } from "../../schemas/kg/index-config.ts";
import { instanceDeclarationFilename, readDeclaration } from "../../schemas/kg/cat-harness.js";
import { releaseIris } from "@litlfred/bootstrap-tools/schemas/release-iri.ts";
import { declarationChain, resolveSkillDirs } from "../../schemas/kg/harness-config.js";
import { nodeOfKind, parseTodoGraph } from "../../schemas/sdlc/todo-graph.js";
import { defaultGraphTypologies } from "../../schemas/kg/graph-typology-registry.js";
import { instanceStateBranch } from "../../schemas/kg/subgraph-source.js";
import { HARNESS_ROOT } from "../lib/roots.ts";
import { dirname } from "node:path";

/**
 * The scaffold names its config after the folio's SLUG, not after the temp
 * directory it happens to land in. A fixture helper that composes the name
 * from `basename(dir)` is right for a fixture that declares itself and wrong
 * here, because `folio_init` is the thing under test and it writes the
 * declaration too.
 */
const SLUG = "cold-chain-guidance";
const SCAFFOLD_CONFIG = layerConfigFilename(SLUG);
const scaffoldConfigIn = (dir: string): string => join(dir, SCAFFOLD_CONFIG);
/**
 * The scaffold's config as written: INLINE in its `index.config.json` entry
 * (bean `ymvt` — the index is the one config, and no `<slug>.config.json` is
 * written), minus the index's own keys.
 */
function scaffoldConfig(dir: string): Record<string, unknown> {
  const idx = JSON.parse(readFileSync(join(dir, "index.config.json"), "utf-8")) as { instances: Array<Record<string, unknown>> };
  const entry = idx.instances.find((e) => e.name === SLUG);
  if (entry === undefined) throw new Error(`index.config.json lists no ${SLUG}`);
  const { name: _n, source: _s, import: _i, _comment: _c, ...config } = entry;
  return config;
}

/**
 * The platform as a folio links it: the REPOSITORY root, which contains
 * `cat-harness/`.
 *
 * Bean `b963`. This read `resolve(HARNESS_ROOT)`, which was the
 * repository root while these tests lived at `scripts/tests/` and silently
 * became the `cat-harness/` directory when they moved to
 * `cat-harness/scripts/tests/`. The test went on passing — by modelling a
 * layout that no longer exists, and thereby asserting that `init-folio` should
 * emit the pre-split paths.
 *
 * What a folio actually does is `git submodule add …/folio-assistant.git
 * folio-assistant`, so the linked directory is the repository root and the
 * platform's code is under `cat-harness/` inside it.
 */
const REPO_ROOT = resolve(dirname(HARNESS_ROOT));

/** This layer's own root: where its reusable workflows (`.github/workflows/folio-*.yml`) are. */
const TOOLS_ROOT = resolve(import.meta.dir, "../..");

/**
 * A paper folio's templates include the `paper` profile, which a layer ABOVE
 * this one holds (folio-assistant-sci, move M11). A checkout without it has no
 * paper profile to scaffold from, so a test that scaffolds a paper folio is
 * not applicable there (bean w1gy F18). A templates lookup that throws guards
 * nothing: the tests then fail on it by name.
 */
const NO_PAPER_PROFILE = ((): boolean => {
  let held: boolean;
  try {
    held = templatesDirs().some((d) => existsSync(join(d, "paper")));
  } catch {
    return false;
  }
  return !held && notApplicableAlone("the `paper` folio-template profile, which folio-assistant-sci (a higher instance) holds");
})();
const dirs: string[] = [];

function tmp(): string {
  const base = mkdtempSync(join(tmpdir(), "folio-init-base-"));
  dirs.push(base);
  const d = join(base, "folio");
  mkdirSync(d);
  return d;
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

function opts(dir: string, over: Partial<InitFolioOptions> = {}): InitFolioOptions {
  return {
    targetDir: dir,
    contentType: "document",
    slug: "cold-chain-guidance",
    title: "Cold Chain Guidance",
    authors: ["A. Author"],
    link: "sibling",
    assistantPath: "folio-assistant",
    skipVcs: true,
    ...over,
  };
}

/**
 * Pre-write the scaffold's CONFIG with a `subgraphSources` override keeping
 * both state graphs in the checkout. `folio_init` leaves an existing file
 * alone, so the override is what the resolver reads — the real config layer,
 * not a test-only switch.
 */
function writeDirectoryOverride(dir: string): void {
  writeFileSync(
    scaffoldConfigIn(dir),
    JSON.stringify({ subgraphSources: { beans: { kind: "directory" }, todos: { kind: "directory" } } }, null, 2) + "\n",
  );
}

/**
 * Composed-only inputs. folio-assistant-sci holds the `paper` template
 * profile (move M11) and declares the paper adapter; folio-assistant-core
 * declares the document adapter. A checkout of the platform alone declares
 * neither, so the remote mounts derived from the checkout's adapters, and a
 * paper scaffold, have nothing to derive from. The derivation itself is
 * pinned standing alone by the fixture tests in "remote link mode".
 */
const NO_PAPER_LAYER = notApplicableAlone(
  "folio-assistant-sci, which holds the `paper` folio-templates member (move M11) and declares the paper adapter",
);
const NO_CONTENT_ADAPTERS = notApplicableAlone(
  "folio-assistant-core and folio-assistant-sci, whose declared document and paper adapters the remote mounts are derived from",
);

describe("slug validation", () => {
  test("accepts lowercase hyphen-joined words", () => {
    expect(isValidSlug("cold-chain-guidance")).toBe(true);
    expect(isValidSlug("qou")).toBe(true);
    expect(isValidSlug("l2-dak")).toBe(true);
  });

  test("rejects what breaks as a directory, a module name or a URL path", () => {
    for (const bad of ["Cold Chain", "cold_chain", "-lead", "trail-", "double--hyphen", "", "a/b", "Ünïcode"]) {
      expect(isValidSlug(bad)).toBe(false);
    }
  });

  test("a reserved slug is refused rather than silently undiscovered", () => {
    // content/schema/ and pipeline/ have platform meanings; a document
    // there would never be found by discovery, with no error to explain why.
    const d = tmp();
    expect(() => initFolio(opts(d, { slug: "schema" }))).toThrow(/reserved/);
    expect(() => initFolio(opts(d, { slug: "pipeline" }))).toThrow(/reserved/);
  });

  test("an invalid slug names all three things it has to be", () => {
    const d = tmp();
    expect(() => initFolio(opts(d, { slug: "Cold Chain" }))).toThrow(/directory name/);
  });

  test("slugify derives one from a title", () => {
    expect(slugify("Cold Chain Guidance")).toBe("cold-chain-guidance");
    expect(slugify("WHO ANC (2016) — Recommendations!")).toBe("who-anc-2016-recommendations");
  });
});

describe("required inputs", () => {
  test("an empty author list is refused, not defaulted", () => {
    const d = tmp();
    expect(() => initFolio(opts(d, { authors: [] }))).toThrow(/author/i);
  });
});

describe("what gets written", () => {
  test("a DOCUMENT folio's staging caller is ON and builds with build-document-site (fyu2)", () => {
    const d = tmp();
    const r = initFolio(opts(d, { contentType: "document" }));
    const wf = readFileSync(join(d, ".github/workflows/staging.yml"), "utf-8");
    expect(wf).toContain("uses: litlfred/folio-assistant/.github/workflows/folio-staging.yml@main");
    expect(wf.split("\n").some((l) => /^\s*pull_request:/.test(l))).toBe(true);
    expect(wf).toContain("folio-assistant-core/scripts/build-document-site.ts --out _site");
    // A reviewer's tagged comment refreshes the preview's review comments (423d).
    expect(wf.split("\n").some((l) => /^\s*issue_comment:/.test(l))).toBe(true);
    expect(wf).toContain("issues: read");
    // A push to main publishes main's site: the before side of every preview (5uuf).
    expect(wf).toMatch(/^\s*push:\n\s*branches: \[main\]$/m);
    expect(r.notes.join(" ")).not.toContain("wired but OFF");
    expect(readFileSync(join(d, ".gitignore"), "utf-8")).toContain("_site/");
  });

  test("a new folio declares a todos graph with a feedback directory, so a review decision has somewhere to go (423d, c4rz)", () => {
    // Kept in the checkout (a `directory` override), so its files are on disk;
    // the branch default puts the same files in the seed — see `hp54` below.
    const d = tmp();
    writeDirectoryOverride(d);
    initFolio(opts(d, { contentType: "document" }));
    const g = parseTodoGraph(JSON.parse(readFileSync(join(d, "todos", "todos.json"), "utf-8")));
    const fb = nodeOfKind(g, "todo-feedback");
    expect(fb?.path).toBe("feedback");
    expect(scaffoldConfig(d).feedbackDir).toBe("todos/feedback");
    // Declared AND present: a declared-but-absent directory is the dh4f defect.
    for (const n of g.directories) expect(existsSync(join(d, "todos", n.path))).toBe(true);
  });

  test("a folio in a SUBFOLDER of a repository gets no workflow GitHub would never read, and is told why (zdfa)", () => {
    const repo = tmp();
    expect(spawnSync("git", ["init", "-q"], { cwd: repo }).status).toBe(0);
    const sub = join(repo, "guides", "handbook");
    expect(enclosingRepoRoot(sub)).not.toBeNull();
    const r = initFolio(opts(sub, { contentType: "document", skipVcs: false, link: "sibling" }));
    expect(existsSync(join(sub, ".github/workflows/staging.yml"))).toBe(false);
    expect(r.notes.join(" ")).toContain("cannot stage a folio below it");
    // Never a repository nested inside another by accident.
    expect(existsSync(join(sub, ".git"))).toBe(false);
    expect(r.notes.join(" ")).toContain("no git init");
  });

  test("a folio at its repository's root is not enclosed (zdfa)", () => {
    const d = tmp();
    expect(enclosingRepoRoot(d)).toBeNull();
    expect(spawnSync("git", ["init", "-q"], { cwd: d }).status).toBe(0);
    expect(enclosingRepoRoot(d)).toBeNull();
  });

  test.skipIf(NO_PAPER_PROFILE)("a PAPER folio's staging caller is OFF: dispatch-only, and its build refuses until set (ojcx)", () => {
    const d = tmp();
    const r = initFolio(opts(d, { contentType: "paper" }));
    const wf = readFileSync(join(d, ".github/workflows/staging.yml"), "utf-8");
    expect(wf.split("\n").some((l) => /^\s*pull_request:/.test(l))).toBe(false);
    expect(wf.split("\n").some((l) => /^\s*issue_comment:/.test(l))).toBe(false);
    expect(wf.split("\n").some((l) => /^\s*push:/.test(l))).toBe(false);
    expect(wf).toContain("exit 1");
    expect(r.notes.join(" ")).toContain("Staging previews are wired but OFF");
  });

  test("every file the layout needs, and no subject matter", () => {
    const d = tmp();
    const r = initFolio(opts(d));
    // The config is inline in the index (bean `ymvt`), never a legacy file.
    expect(existsSync(scaffoldConfigIn(d))).toBe(false);
    for (const f of [
      "index.config.json",
      ".mcp.json",
      ".beans.yml",
      "folio/schema/builders.ts",
      "folio/schema/types.ts",
      "folio/cold-chain-guidance/cold-chain-guidance.ts",
      "folio/cold-chain-guidance/introduction/introduction.ts",
      "folio/cold-chain-guidance/introduction/overview.ts",
      "folio/cold-chain-guidance/introduction/overview.md",
      "uploads/README.md",
      // declared-path-literal: a file the scaffold writes in the NEW folio, not a harness file; it only
      // resolved against cat-harness while the harness kept a README at library/.
      "library/README.md",
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".github/workflows/staging.yml",
    ]) {
      expect(r.created).toContain(f);
      expect(existsSync(join(d, f))).toBe(true);
    }
  });

  test("the builder shim is the only place the platform path is written", () => {
    const d = tmp();
    initFolio(opts(d, { assistantPath: "vendor/fa" }));
    expect(readFileSync(join(d, "folio/schema/builders.ts"), "utf-8")).toContain(
      "../../vendor/fa/cat-harness-tools/schemas/builders",
    );
    // Manifests reach the platform only through the shim, so re-linking the
    // platform is a two-file edit rather than a sweep over the corpus.
    const manifest = readFileSync(join(d, "folio/cold-chain-guidance/cold-chain-guidance.ts"), "utf-8");
    expect(manifest).toContain("../schema/builders");
    expect(manifest).not.toContain("vendor/fa");
  });

  test("AGENTS.md tells a document folio which kinds it may not use", () => {
    const d = tmp();
    initFolio(opts(d));
    const agents = readFileSync(join(d, "AGENTS.md"), "utf-8");
    expect(agents).toContain("normative-statements");
    for (const k of ["theorem", "lemma", "proof"]) expect(agents).toContain(k);
  });

  test("CLAUDE.md and GEMINI.md are stubs pointing at AGENTS.md", () => {
    const d = tmp();
    initFolio(opts(d));
    for (const f of ["CLAUDE.md", "GEMINI.md"]) {
      const body = readFileSync(join(d, f), "utf-8");
      expect(body).toContain("AGENTS.md");
      expect(body.length).toBeLessThan(400);
    }
  });

  test.skipIf(NO_PAPER_PROFILE)("a paper folio gitignores Lean artifacts; a document folio does not", () => {
    const pap = tmp();
    initFolio(opts(pap, { contentType: "paper" }));
    expect(readFileSync(join(pap, ".gitignore"), "utf-8")).toContain(".lake/");

    const doc = tmp();
    initFolio(opts(doc));
    expect(readFileSync(join(doc, ".gitignore"), "utf-8")).not.toContain(".lake/");
  });
});

/**
 * Bean `52dz`. Seven workflows sat in the platform's `.github/workflows/`
 * where they could never run — each needed a folio — and the owner ruled they
 * become templates `folio_init` writes: the three QA ones for every folio,
 * the four Lean ones (and what they call) for a paper folio only.
 */
describe("workflow templates (52dz)", () => {
  const GENERIC = ["qa-sweep.yml", "qa-sweep-nightly.yml", "section-title-audit.yml", "site-publish.yml"];
  const LEAN = ["blueprint.yml", "lean-build.yml", "lean-build-sidecar.yml", "lean_ci.yml"];
  const LEAN_SUPPORT = [
    ".github/actions/lake-cache-restore/action.yml",
    ".github/scripts/axiom_report.py",
    ".github/scripts/extract_proof_objects.py",
    ".github/scripts/update_proof_status.py",
    ".github/scripts/generate_dependency_graph.py",
    ".github/scripts/folio_lean/config.py",
  ];

  /** Every file the scaffold wrote under `.github/`. */
  function githubFiles(r: { created: string[] }): string[] {
    return r.created.filter((f) => f.startsWith(".github/"));
  }

  test("a DOCUMENT folio gets the three generic workflows and none of the Lean ones", () => {
    const d = tmp();
    const r = initFolio(opts(d));
    for (const wf of GENERIC) {
      expect(r.created).toContain(`.github/workflows/${wf}`);
      expect(existsSync(join(d, ".github/workflows", wf))).toBe(true);
    }
    for (const wf of LEAN) expect(existsSync(join(d, ".github/workflows", wf))).toBe(false);
    // Nor the scripts and action only the Lean workflows call.
    for (const f of LEAN_SUPPORT) expect(existsSync(join(d, f))).toBe(false);
  });

  test.skipIf(NO_PAPER_PROFILE)("a PAPER folio gets the generic workflows AND the Lean ones, with what they call", () => {
    const d = tmp();
    const r = initFolio(opts(d, { contentType: "paper" }));
    for (const wf of [...GENERIC, ...LEAN]) {
      expect(r.created).toContain(`.github/workflows/${wf}`);
      expect(existsSync(join(d, ".github/workflows", wf))).toBe(true);
    }
    for (const f of LEAN_SUPPORT) {
      expect(r.created).toContain(f);
      expect(existsSync(join(d, f))).toBe(true);
    }
  });

  test.skipIf(NO_PAPER_PROFILE)("the Lean workflows' local action and scripts are ones the scaffold wrote", () => {
    // `uses: ./.github/actions/<x>` and `python3 .github/scripts/<y>` resolve in
    // the FOLIO, so each must be something this scaffold put there.
    const d = tmp();
    initFolio(opts(d, { contentType: "paper" }));
    for (const wf of LEAN) {
      const body = readFileSync(join(d, ".github/workflows", wf), "utf-8");
      for (const m of body.matchAll(/uses:\s*\.\/(\.github\/actions\/[\w-]+)/g)) {
        expect(existsSync(join(d, m[1]!, "action.yml")), `${wf} uses ${m[1]}`).toBe(true);
      }
      for (const m of body.matchAll(/python3\s+(\.github\/scripts\/[\w-]+\.py)/g)) {
        expect(existsSync(join(d, m[1]!)), `${wf} runs ${m[1]}`).toBe(true);
      }
    }
  });

  test.skipIf(NO_PAPER_PROFILE)("nothing written names one folio's papers, and no placeholder is left", () => {
    for (const contentType of ["document", "paper"] as const) {
      const d = tmp();
      // A non-default platform path, so a placeholder that was never
      // substituted cannot pass by coinciding with the default.
      const r = initFolio(opts(d, { contentType, assistantPath: "vendor/fa" }));
      const written = githubFiles(r);
      expect(written.length).toBeGreaterThan(0);
      for (const f of written) {
        const body = readFileSync(join(d, f), "utf-8");
        expect(body.toLowerCase(), `${f} names qou`).not.toContain("qou");
        expect([...body.matchAll(TEMPLATE_PLACEHOLDER_RE)].map((m) => m[0]), `${f} placeholders`).toEqual([]);
      }
      // ...and the substitution happened: the folio the caller sweeps is the
      // scaffold's content root.
      expect(readFileSync(join(d, ".github/workflows/qa-sweep.yml"), "utf-8")).toContain('folio: "folio"');
      // GitHub's own `${{ … }}` expressions survive substitution untouched.
      expect(readFileSync(join(d, ".github/workflows/qa-sweep-nightly.yml"), "utf-8")).toContain(
        "${{ inputs.axes }}",
      );
    }
  });

  test("every platform file a scaffolded folio runs EXISTS in the index (bean cat-tools-yylt)", () => {
    // The test above checks that the placeholder was SUBSTITUTED. It went on
    // passing while every path it substituted pointed at
    // `cat-harness/content/…` and `cat-harness/scripts/…`, which 70lx had
    // emptied. So resolve each one against the index this test runs in.
    for (const contentType of ["document", "paper"] as const) {
      const d = tmp();
      const r = initFolio(opts(d, { contentType, assistantPath: "vendor/fa" }));
      const named = new Set<string>();
      for (const f of r.created) {
        const abs = join(d, f);
        if (!existsSync(abs) || statSync(abs).isDirectory()) continue;
        for (const m of readFileSync(abs, "utf-8").matchAll(/vendor\/fa\/([\w./-]+?\.(?:ts|py|sh|bat|mjs))\b/g)) named.add(m[1]!);
      }
      // The document workflows are thin callers: what they run is the
      // reusable workflow they name, which must exist in this repository.
      for (const f of r.created) {
        const abs = join(d, f);
        if (!existsSync(abs) || statSync(abs).isDirectory()) continue;
        for (const m of readFileSync(abs, "utf-8").matchAll(/litlfred\/cat-harness-tools\/(\.github\/workflows\/[\w.-]+\.yml)@/g)) named.add(m[1]!);
      }
      expect(named.size, `${contentType}: no platform path found to check`).toBeGreaterThan(0);
      const missing = [...named].filter((p) => !existsSync(join(p.startsWith(".github/") ? TOOLS_ROOT : REPO_ROOT, p)));
      expect(missing, `${contentType} names platform files that do not exist`).toEqual([]);
    }
  });

  test("the QA working copy is ignored, so a folio commits no derived verdict (bean 5qy8)", () => {
    const d = tmp();
    initFolio(opts(d, { contentType: "document" }));
    expect(readFileSync(join(d, ".gitignore"), "utf-8")).toMatch(/^test\/results\/$/m);
  });

  test("a freshly initialised folio publishes QA sweep verdicts to its own qa-reports branch (beans 5qy8, 7mwa)", () => {
    const d = tmp();
    initFolio(opts(d, { contentType: "document" }));
    for (const wf of ["qa-sweep.yml", "qa-sweep-nightly.yml"]) {
      const raw = readFileSync(join(d, ".github/workflows", wf), "utf-8");
      const doc = parseYaml(raw) as { permissions?: Record<string, string> };
      expect(doc.permissions?.contents, `${wf} permissions.contents`).toBe("write");
      expect(raw, `${wf} calls the reusable QA workflow`).toMatch(/uses: litlfred\/cat-harness-tools\/\.github\/workflows\/folio-qa-sweep(-nightly)?\.yml@main/);
      const reusable = readFileSync(join(TOOLS_ROOT, ".github/workflows", `folio-${wf}`), "utf-8");
      expect(reusable, `folio-${wf} publishes via qa-store.ts`).toContain("scripts/qa-store.ts\" publish");
    }
  });

  test("an unknown placeholder is refused, not written through", () => {
    const values = { assistant: "a", folio: "f", platform_git: "g", platform_repo: "r" };
    expect(renderTemplate("run: {{assistant}}/x ${{ github.ref }}", values)).toBe("run: a/x ${{ github.ref }}");
    expect(() => renderTemplate("run: {{nope}}", values)).toThrow(/unknown template placeholder/);
  });

  test.skipIf(NO_PAPER_PROFILE)("every template parses as YAML, before and after substitution", () => {
    const values = { assistant: "folio-assistant", folio: "folio", platform_git: "g", platform_repo: "o/r" };
    const ymls = folioTemplates("paper").filter((t) => t.target.endsWith(".yml"));
    // Guard against a green run over nothing if the directory moves.
    expect(ymls.length).toBeGreaterThanOrEqual(GENERIC.length + LEAN.length + 1);
    for (const t of ymls) {
      const raw = readFileSync(t.source, "utf-8");
      expect(() => parseYaml(raw), t.source).not.toThrow();
      const doc = parseYaml(renderTemplate(raw, values)) as Record<string, unknown>;
      expect(typeof doc.name, `${t.source} has a name`).toBe("string");
    }
  });

  test("the templates come from the declared directory, not a path written in code", () => {
    // `folio-templates` is looked up by id. This layer's own member holds the
    // profile every folio gets.
    const dir = templatesDir();
    expect(existsSync(join(dir, "document"))).toBe(true);
    expect(templatesDirs()[0]).toBe(dir);
    expect(folioTemplates("document").every((t) => !t.target.includes("lean"))).toBe(true);
  });

  test.skipIf(NO_PAPER_LAYER)("the paper profile is a member a dependent layer holds, found across the checkout", () => {
    // Move M11: folio-assistant-sci holds it, found across the checkout,
    // never by its name.
    expect(templatesDirs().some((d) => existsSync(join(d, "paper")))).toBe(true);
  });
});

describe("re-running is safe", () => {
  test("existing files are skipped, not overwritten", () => {
    const d = tmp();
    initFolio(opts(d));
    writeFileSync(join(d, "AGENTS.md"), "# my own guidance\n", "utf-8");

    const second = initFolio(opts(d));
    expect(second.created).toEqual([]);
    expect(second.skipped).toContain("AGENTS.md");
    expect(readFileSync(join(d, "AGENTS.md"), "utf-8")).toBe("# my own guidance\n");
  });

  test("force overwrites, and says so", () => {
    const d = tmp();
    initFolio(opts(d));
    writeFileSync(join(d, "AGENTS.md"), "# my own guidance\n", "utf-8");

    const second = initFolio(opts(d, { force: true }));
    expect(second.skipped).toEqual([]);
    expect(readFileSync(join(d, "AGENTS.md"), "utf-8")).toContain("This is a **folio**");
  });

  test("a dry run writes nothing but reports everything", () => {
    const d = tmp();
    const r = initFolio(opts(d, { dryRun: true }));
    expect(r.created.length).toBeGreaterThan(10);
    expect(existsSync(scaffoldConfigIn(d))).toBe(false);
    expect(existsSync(join(d, "folio"))).toBe(false);
  });

  test("a missing platform is reported, not left to fail at import time", () => {
    const d = tmp();
    const r = initFolio(opts(d));
    expect(r.notes.join(" ")).toContain("does not exist yet");
  });
});

describe("the scaffolded folio actually builds", () => {
  test("renders to Markdown with no issues, through its own shim", async () => {
    const d = tmp();
    initFolio(opts(d));
    // Link the platform where harness.config.json says it is. Everything below
    // then resolves exactly as it would in a real folio.
    symlinkSync(REPO_ROOT, join(d, "folio-assistant"));

    const { buildDocumentMarkdown } = await import("../../pipeline/render-markdown");
    const result = await buildDocumentMarkdown(
      join(d, "folio/cold-chain-guidance/cold-chain-guidance.ts"),
    );

    expect(result.issues).toEqual([]);
    expect(result.blockCount).toBe(1);
    expect(result.chapterSlugs).toEqual(["introduction"]);
    expect(result.markdown).toContain("# Cold Chain Guidance");
    expect(result.markdown).toContain("## Introduction");
    expect(result.markdown).toContain("### Overview");
    // The starter block is listed in a section, so it renders. A scaffold that
    // wrote the files but forgot the blocks[] entry would pass every other
    // assertion here and produce an empty document.
    expect(result.markdown).toContain("unit of authorship");
    expect(result.markdown).not.toContain("Missing block");
  });

  test("the scaffolded document folio conforms to its own declared profile", async () => {
    const d = tmp();
    initFolio(opts(d));
    symlinkSync(REPO_ROOT, join(d, "folio-assistant"));

    const { checkFolioProfile } = await import("../../pipeline/profile-check");
    const r = checkFolioProfile(d);
    expect(r.profile).toBe("document");
    // Through the scaffold's OWN index entry: a layer an
    // `index.config.json` lists is configured by its entry (cd041e2b), and
    // init-folio writes that index naming the scaffold, so the profile is
    // declared there rather than read from `<slug>.config.json` alone.
    expect(r.declaredBy).toContain(`index.config.json entry "${SLUG}"`);
    expect(r.blocksChecked).toBe(1);
    expect(r.violations).toEqual([]);
  });
});

/**
 * Bean `mer2`, owner's ruling 2026-10-01: split the operation. An instance-init
 * writes the instance-level artefacts with NO content type, and `initFolio` is
 * that plus the adapter's scaffold. This is what makes the MVP the owner ruled
 * in `tndo` expressible for a layer that carries no adapter.
 */
describe("a contentless instance (mer2)", () => {
  const instanceOpts = (dir: string) => ({
    targetDir: dir,
    slug: SLUG,
    title: "Cold Chain Guidance",
    link: "submodule" as const,
    skipVcs: true,
  });

  // The instance-level set the ruling lists, hardcoded rather than derived from
  // the scaffolder, so the test fails if initiation stops writing any of them.
  const INSTANCE_LEVEL = [
    instanceDeclarationFilename(SLUG),
    "index.config.json",
    ".mcp.json",
    ".claude/settings.json",
    ".gitignore",
    ".beans.yml",
    "README.md",
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    // Bean folio-assistant-63q4 (owner, 2026-10-15): initiation turns on the
    // publishing of the layer's JSON-LD context.
    ".github/workflows/publish-context.yml",
    // Bean folio-assistant-7mwa (owner, 2026-11-03, "2. Each layer
    // publishes"): and the publishing of its QA results to its own store.
    ".github/workflows/publish-qa.yml",
  ];

  test("writes every instance-level artefact, and nothing an adapter owns", () => {
    const d = tmp();
    const r = initInstance(instanceOpts(d));
    for (const f of INSTANCE_LEVEL) {
      expect(r.created).toContain(f);
      expect(existsSync(join(d, f))).toBe(true);
    }
    // declared-path-literal: asserting the scaffold did NOT create the folio layout.
    for (const absent of ["folio", "uploads", "library"]) {
      expect(existsSync(join(d, absent))).toBe(false);
    }
    expect(r.created.some((f) => f.startsWith("folio/"))).toBe(false);
    // The two publishers, the context and the QA store: no staging or QA-sweep workflow.
    expect(r.created.filter((f) => f.startsWith(".github/")).sort()).toEqual([
      ".github/workflows/publish-context.yml",
      ".github/workflows/publish-qa.yml",
    ]);
  });

  test("the publish-qa workflow calls the tools layer's QA publisher for THIS instance, on main and on pull requests", () => {
    const d = tmp();
    initInstance(instanceOpts(d));
    const wf = parseYaml(readFileSync(join(d, ".github/workflows/publish-qa.yml"), "utf-8")) as {
      on: { push: { branches: string[] }; pull_request: unknown };
      permissions: Record<string, string>;
      jobs: { publish: { uses: string; with: Record<string, string> } };
    };
    expect(wf.on.push.branches).toEqual(["main"]);
    expect("pull_request" in wf.on).toBe(true);
    expect(wf.permissions).toEqual({ contents: "write" });
    expect(wf.jobs.publish.uses).toBe("litlfred/cat-harness-tools/.github/workflows/layer-qa-publish.yml@main");
    expect(wf.jobs.publish.with).toEqual({ instance: SLUG });
  });

  test("the publish-context workflow calls the harness's reusable workflow for THIS instance, on push to main", () => {
    const d = tmp();
    initInstance(instanceOpts(d));
    const wf = parseYaml(readFileSync(join(d, ".github/workflows/publish-context.yml"), "utf-8")) as {
      on: { push: { branches: string[] } };
      permissions: Record<string, string>;
      jobs: { publish: { uses: string; with: Record<string, string> } };
    };
    expect(wf.on.push.branches).toEqual(["main"]);
    expect(wf.permissions).toEqual({ contents: "write" });
    expect(wf.jobs.publish.uses).toBe("litlfred/cat-harness-tools/.github/workflows/layer-publish-context.yml@main");
    expect(wf.jobs.publish.with).toEqual({ instance: SLUG });
  });

  test("no GitHub origin: no iriBase is invented, and the note says how to add one", () => {
    const d = tmp();
    const r = initInstance(instanceOpts(d));
    const decl = readDeclaration(d) as { iriBase?: string; version?: string };
    expect(decl.iriBase).toBeUndefined();
    expect(decl.version).toBeUndefined();
    expect(r.notes.join("\n")).toContain("No iriBase was declared");
  });

  test("a GitHub origin gives iriBase https://<owner>.github.io/<repo>/, and the note says to switch Pages on", () => {
    const d = tmp();
    spawnSync("git", ["init", "-q"], { cwd: d });
    spawnSync("git", ["remote", "add", "origin", "https://github.com/LitlFred/new-layer.git"], { cwd: d });
    const r = initInstance(instanceOpts(d));
    const decl = readDeclaration(d) as { iriBase?: string; version?: string };
    expect(decl.iriBase).toBe("https://litlfred.github.io/new-layer/");
    // An iriBase without a version breaks releaseIris, and with it the IG publish.
    expect(decl.version).toBe("0.1.0");
    expect(releaseIris(decl)?.agent).toBe("https://litlfred.github.io/new-layer/v0/");
    expect(r.notes.join("\n")).toContain("Deploy from a branch: gh-pages, / (root)");
  });

  test("an origin that is not github.com derives no iriBase", () => {
    const d = tmp();
    spawnSync("git", ["init", "-q"], { cwd: d });
    spawnSync("git", ["remote", "add", "origin", "http://proxy@127.0.0.1:1234/git/litlfred/new-layer"], { cwd: d });
    initInstance(instanceOpts(d));
    expect((readDeclaration(d) as { iriBase?: string }).iriBase).toBeUndefined();
  });

  test("--iri-base is declared as given", () => {
    const d = tmp();
    initInstance({ ...instanceOpts(d), iriBase: "https://example.org/x/" });
    const decl = readDeclaration(d) as { iriBase?: string; version?: string };
    expect(decl.iriBase).toBe("https://example.org/x/");
    expect(decl.version).toBe("0.1.0");
    expect(() => releaseIris(decl)).not.toThrow();
  });

  test("inside another repository no workflow is written (GitHub would never read it), and the note says why", () => {
    const outer = tmp();
    spawnSync("git", ["init", "-q"], { cwd: outer });
    const d = join(outer, "inner");
    const r = initInstance(instanceOpts(d));
    expect(existsSync(join(d, ".github"))).toBe(false);
    expect(r.notes.join("\n")).toContain("no publish-context workflow was written");
  });

  test("the config names no adapter and the declaration no folio directory", () => {
    const d = tmp();
    initInstance(instanceOpts(d));
    const config = scaffoldConfig(d);
    expect(config.contentType).toBeUndefined();
    expect(config.adapter).toBeUndefined();
    expect(config.adapterModule).toBeUndefined();
    const decl = readDeclaration(d);
    expect(decl?.name).toBe(SLUG);
    // No `folio` entry — only the graphs every layer keeps off main (hp54),
    // the trashcan among them so its first cutover has somewhere to deposit.
    expect(decl?.directories.map((e) => e.id)).toEqual(["beans", "todos", "fsh-guts"]);
  });

  test("a folio's instance half is the instance's — the two cannot drift", () => {
    const bare = tmp();
    const folio = tmp();
    initInstance(instanceOpts(bare));
    const r = initFolio(opts(folio));
    // Except the context publisher: a folio's gh-pages is its staging site's,
    // which the folio's own publish workflow writes.
    for (const f of INSTANCE_LEVEL.filter((x) => !x.endsWith("publish-context.yml") && !x.endsWith("publish-qa.yml"))) expect(r.created).toContain(f);
    // The files with no content-type dependence are byte-identical.
    for (const f of [".mcp.json", ".claude/settings.json", ".beans.yml"]) {
      expect(readFileSync(join(folio, f), "utf-8")).toBe(readFileSync(join(bare, f), "utf-8"));
    }
  });

  // Done-when 3: assert what was PRODUCED — a declaration that loads and
  // graphs that resolve — rather than inferring success from no throw.
  describe.each([
    ["instance", (d: string) => initInstance(instanceOpts(d))],
    ["document folio", (d: string) => initFolio(opts(d))],
    ["paper folio", (d: string) => initFolio(opts(d, { contentType: "paper" }))],
  ] as const)("%s", (label, run) => {
    test.skipIf(label === "paper folio" && NO_PAPER_PROFILE)("probe — its declaration loads and every declared directory exists", () => {
      const d = tmp();
      run(d);
      const decl = readDeclaration(d);
      expect(decl).toBeDefined();
      // Every declared directory exists — except one whose content is declared
      // OFF the checkout (hp54), which is mounted, never written.
      for (const dir of decl!.directories) {
        if (dir.source?.kind === "branch") continue;
        expect(existsSync(join(d, dir.path))).toBe(true);
      }
    });
  });

  test.skipIf(NO_PAPER_PROFILE)("a folio's probe sees the content type it asked for, not a fallback", () => {
    const d = tmp();
    initFolio(opts(d, { contentType: "paper" }));
    const config = scaffoldConfig(d);
    expect(config.contentType).toBe("paper");
    expect(config.adapter).toBe("paper");
  });

  test("the CLI scaffolds an instance with no --type and no --author", () => {
    const d = tmp();
    const r = spawnSync(
      "bun",
      ["run", join(REPO_ROOT, "cat-harness-tools/scripts/init-folio.ts"), "--instance", "--dir", d, "--title", "Cold Chain Guidance", "--skip-vcs"],
      { encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("no content type");
    expect(existsSync(join(d, instanceDeclarationFilename(SLUG)))).toBe(true);
    // declared-path-literal: asserting the scaffold did NOT create the folio layout.
    expect(existsSync(join(d, "folio"))).toBe(false);
  });

  test("the CLI refuses --instance with a --type, rather than silently dropping it", () => {
    const d = tmp();
    const r = spawnSync(
      "bun",
      ["run", join(REPO_ROOT, "cat-harness-tools/scripts/init-folio.ts"), "--instance", "--type", "paper", "--dir", d, "--title", "X", "--skip-vcs"],
      { encoding: "utf-8" },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("--instance takes no --type");
  });
});

/**
 * Bean `zmdo`, measured 2026-10-04: a scaffolded layer's declaration chain
 * was the layer ALONE — 0 skill directories reachable, for a contentless
 * layer and a document folio alike — because neither scaffold said what it
 * stands on. The config now names one layer and the layers' own `needs` carry
 * the rest.
 */
describe("a scaffold says what it stands on (zmdo)", () => {
  const chainNames = (d: string) => declarationChain(d).map((c) => c.name);
  const skillRoots = (d: string) => resolveSkillDirs(d).map((x) => x.split("/").slice(-2).join("/"));

  test("a contentless instance stands on cat-harness, and reaches its skills through the stack", () => {
    const d = tmp();
    initInstance({ targetDir: d, slug: SLUG, title: "Cold Chain Guidance", link: "submodule", skipVcs: true });
    const config = scaffoldConfig(d);
    expect(config.dependencies).toEqual({ folioAssistant: [{ name: "cat-harness", path: "folio-assistant/cat-harness" }] });
    symlinkSync(REPO_ROOT, join(d, "folio-assistant"));
    const chain = chainNames(d);
    expect(chain).toContain("cat-harness");
    expect(chain).toContain("bootstrap");
    expect(chain).not.toContain("folio-assistant-core");
    expect(skillRoots(d)).toContain("cat-harness/skills");
  });
});

/**
 * Bean `hp54`, measured 2026-10-06: `folio_init` wrote `beans/` and `todos/`
 * into the checkout and declared neither, so a folio's work plan landed on
 * `main` with nothing able to say so. Each state graph now goes through the
 * ONE resolver: `branch` → declared, not written; `directory` → written AND
 * declared.
 */
describe("state graphs follow their resolved source (hp54)", () => {
  test("by default both are declared on cat/<instance>/<id>, tip-keyed, and NOT written", () => {
    const d = tmp();
    const r = initFolio(opts(d));
    const decl = readDeclaration(d)!;
    for (const id of ["beans", "todos", "fsh-guts"]) {
      const e = decl.directories.find((x) => x.id === id);
      expect(e?.source).toEqual({ kind: "branch", branch: `cat/${SLUG}/${id}`, keyedBy: "tip" });
      expect(existsSync(join(d, id))).toBe(false);
      expect(r.created.some((f) => f.startsWith(`${id}/`))).toBe(false);
      const g = r.stateGraphs.find((x) => x.id === id)!;
      expect(g.source.kind).toBe("branch");
      expect(g.declared).toBe(true);
      // The branch's content travels in the seed, so it starts from the same files.
      expect(g.seed).toContain(`refs/heads/cat/${SLUG}/${id}`);
      expect(g.seed).toContain("manifest.json");
    }
    expect(r.stateGraphs.find((x) => x.id === "todos")!.seed).toContain("todos/todos.json");
    // beans:claim reads the bean graph's declaration FROM THE BRANCH, so the seed must carry it.
    expect(r.stateGraphs.find((x) => x.id === "beans")!.seed).toContain("beans/beans.json");
    // The mount must never be committed to main.
    const ignore = readFileSync(join(d, ".gitignore"), "utf-8");
    expect(ignore).toContain("/beans/**");
    expect(ignore).toContain("/todos/**");
    // The trashcan a cutover deposits into, so the first cutover is not refused for want of one.
    expect(ignore).toContain("/fsh-guts/**");
    expect(r.stateGraphs.find((x) => x.id === "fsh-guts")!.seed).toContain("fsh-guts/retired/.gitkeep");
    expect(r.notes.join("\n")).toContain("NOT written into the checkout");
  });

  test("a `directory` source (config override) is written AND declared", () => {
    const d = tmp();
    writeDirectoryOverride(d);
    const r = initInstance({ targetDir: d, slug: SLUG, title: "X", link: "submodule", skipVcs: true });
    for (const id of ["beans", "todos"]) {
      expect(existsSync(join(d, id))).toBe(true);
      expect(readDeclaration(d)!.directories.some((x) => x.id === id)).toBe(true);
      const g = r.stateGraphs.find((x) => x.id === id)!;
      expect(g.source.kind).toBe("directory");
      expect(g.source.declaredIn).toBe("config");
      expect(g.seed).toBeUndefined();
    }
    expect(r.created).toContain("beans/beans.json");
    expect(r.created).toContain("todos/todos.json");
    expect(readFileSync(join(d, ".gitignore"), "utf-8")).not.toContain("/beans/**");
  });

  test("an existing declaration that does not name a state graph is reported, not rewritten", () => {
    const d = tmp();
    writeFileSync(join(d, instanceDeclarationFilename(SLUG)), JSON.stringify({ name: SLUG, directories: [] }) + "\n");
    const r = initInstance({ targetDir: d, slug: SLUG, title: "X", link: "submodule", skipVcs: true });
    expect(r.skipped).toContain(instanceDeclarationFilename(SLUG));
    for (const g of r.stateGraphs) expect(g.declared).toBe(false);
    expect(r.notes.join("\n")).toContain('does not declare "beans"');
  });

  test("every registry kind with a newInstanceSource is a state graph the scaffold writes", () => {
    const listed = new Set<string>(INSTANCE_STATE_GRAPHS.map((g) => g.kind));
    for (const kind of defaultGraphTypologies.names()) {
      const def = defaultGraphTypologies.get(kind)!;
      if (!def.newInstanceSource) continue;
      // Kept on its own tip from the first commit — `state` (beans, todos), or
      // `context` for the trashcan, which only a confirmed act writes.
      expect(["state", "context"]).toContain(def.holds);
      expect(listed.has(kind)).toBe(true);
    }
    for (const kind of listed) expect(defaultGraphTypologies.get(kind)?.newInstanceSource?.kind).toBe("branch");
  });

  test("the branch convention refuses an instance name that would make an invalid ref", () => {
    expect(instanceStateBranch("demo-x", "beans")).toBe("cat/demo-x/beans");
    expect(() => instanceStateBranch("a..b", "beans")).toThrow();
  });
});

describe("remote link mode (--link remote, bean c4lg)", () => {
  const PLATFORM = ["cat-harness", "cat-harness-tools", "bootstrap", "bootstrap-tools"];
  const adapter = (contentType: string, instance: string) => ({ contentType, instance, root: `/x/${instance}`, module: `../${instance}/a.ts`, className: "A" });

  test("the remote mounts for a content type come from the declaring instance and its needs, never from a hard-coded name", () => {
    const adapters = [adapter("paper", "layer-b"), adapter("document", "layer-a")];
    const needs: Record<string, string[]> = { "/x/layer-a": ["bootstrap", "cat-harness"], "/x/layer-b": ["bootstrap", "cat-harness-tools", "layer-a"] };
    const closure = (root: string) => needs[root] ?? [];
    expect(remotePlatformLayers(undefined, adapters, closure)).toEqual(PLATFORM);
    expect(remotePlatformLayers("document", adapters, closure)).toEqual([...PLATFORM, "layer-a"]);
    expect(remotePlatformLayers("paper", adapters, closure)).toEqual([...PLATFORM, "layer-a", "layer-b"]);
  });

  test("a content type no instance declares mounts the platform alone — no invented layer", () => {
    expect(remotePlatformLayers("document", [], () => ["never-called"])).toEqual(PLATFORM);
    expect(remotePlatformLayers("paper", [adapter("other", "layer-o")], () => [])).toEqual(PLATFORM);
  });

  test.skipIf(NO_CONTENT_ADAPTERS)("initFolio with link: 'remote' writes pinned source.remote mounts, site.landing, .gitignore index-mounts block, and root-relative shims", () => {
    const d = tmp();
    const r = initFolio({
      targetDir: d,
      contentType: "document",
      slug: SLUG,
      title: "Cold Chain Guidance",
      authors: ["A. Author"],
      link: "remote",
      skipVcs: true,
    });
    const rawIdx = JSON.parse(readFileSync(join(d, "index.config.json"), "utf-8"));
    const idx = IndexConfigSchema.parse(rawIdx);
    expect(idx.site?.landing).toBe(SLUG);

    const localEntry = idx.instances.find((e) => e.name === SLUG);
    expect(localEntry?.source).toEqual({ local: { at: "." } });

    const remoteNames = idx.instances.filter((e) => e.source !== undefined && "remote" in e.source).map((e) => e.name);
    expect(remoteNames).toEqual([
      "cat-harness",
      "cat-harness-tools",
      "bootstrap",
      "bootstrap-tools",
      "folio-assistant-core",
    ]);
    for (const entry of idx.instances) {
      if (entry.source && "remote" in entry.source) {
        expect(entry.source.remote.repository).toBe(`litlfred/${entry.name}`);
        expect(entry.source.remote.ref).toMatch(/^[0-9a-f]{40}$/);
        expect(entry.source.remote.overrides?.[entry.name]?.whole).toBe(true);
      }
    }

    expect(checkIgnoreBlock(d, idx)).toEqual({ state: "current" });
    const gitignoreText = readFileSync(join(d, ".gitignore"), "utf-8");
    expect(gitignoreText).toContain("/cat-harness/");
    expect(gitignoreText).toContain("/cat-harness-tools/");
    expect(gitignoreText).toContain("/folio-assistant-core/");

    const builders = readFileSync(join(d, "folio/schema/builders.ts"), "utf-8");
    expect(builders).toContain('export * from "../../cat-harness-tools/schemas/builders";');

    const wf = readFileSync(join(d, ".github/workflows/staging.yml"), "utf-8");
    expect(wf).toContain("bun run folio-assistant-core/scripts/build-document-site.ts --out _site");
    expect(r.notes.join("\n")).toContain("Linked via remote mounts in index.config.json");
  });

  test.skipIf(NO_CONTENT_ADAPTERS)("CLI --link remote scaffolds a paper folio with folio-assistant-sci included in remote mounts", () => {
    const d = tmp();
    const cli = spawnSync(
      "bun",
      [
        "run",
        join(REPO_ROOT, "cat-harness-tools/scripts/init-folio.ts"),
        "--dir",
        d,
        "--type",
        "paper",
        "--slug",
        SLUG,
        "--title",
        "Cold Chain Guidance",
        "--author",
        "A. Author",
        "--link",
        "remote",
        "--skip-vcs",
      ],
      { encoding: "utf-8" },
    );
    expect(cli.status).toBe(0);
    const idx = IndexConfigSchema.parse(JSON.parse(readFileSync(join(d, "index.config.json"), "utf-8")));
    expect(idx.site?.landing).toBe(SLUG);
    const remoteNames = idx.instances.filter((e) => e.source !== undefined && "remote" in e.source).map((e) => e.name);
    expect(remoteNames).toContain("folio-assistant-sci");
    expect(checkIgnoreBlock(d, idx)).toEqual({ state: "current" });
  });
});
