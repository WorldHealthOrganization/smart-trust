/**
 * The declared merge-conflict patterns and the region resolver (bean `y7b3`).
 *
 * The refusals are the point: each test that resolves has a sibling showing
 * the unsafe neighbour is refused, because a resolver proven only on the
 * cases it handles is proven against its author's optimism.
 */
import { afterAll, describe, expect, test } from "bun:test";

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
// The built site is read through the layer-output overlay (bean cat-tools-sm8r).
import * as siteFs from "../../../test/support/site-fs.ts";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

import { droppedInMerge, droppedLine, droppedPaths, ownedTreeAction, plan, refusable, resolutionFailure, resolveGitlink, stageGitlink, takeBase, takeBaseAction, takeOwnedTree, unmergedStages } from "../../merge-base.js";
import { pathClass } from "../../merge-pipeline-paths.ts";
import { parseLog } from "../../merge-main-comment.js";
import { CATALOGUE_VISUALISER, classify, declaredRouteGlobs, GLOSSARY_RENDERER, PATTERNS, resolveGeneratedRegions } from "../../merge-conflict-patterns.js";
import { repoRootFor, siteDirFor } from "../../../schemas/kg/cat-harness.js";
import { scriptsOf } from "../../../schemas/sdlc/script-table.ts";
import { HARNESS_ROOT } from "../../lib/roots.ts";
import { notApplicableAlone, siteNotBuilt } from "../../../test/support/checkout.ts";

/** This layer and the repository it sits in, for the filesystem-driven sweeps. */
const INSTANCE = resolve(HARNESS_ROOT);
const REPO = repoRootFor(INSTANCE);

/**
 * Whether the checkout knows the route of a visualiser a HIGHER layer
 * declares — its declaration, or the generated page a built site records it
 * by. Standing alone neither is here: the content core declares the glossary,
 * a folio declares its catalogue, and their pages are built at publish and
 * gitignored (bean w1gy F18). A test of the REAL route is then not
 * applicable, and says which; the fixtures above test the derivation itself.
 */
function higherRouteAbsent(pick: (v: { id: string; renderedBy: string }) => boolean, route: string, what: string): boolean {
  return !declaredRouteGlobs(REPO, pick, "**").includes(`cat-harness/docs/${route}**`) && notApplicableAlone(what);
}
const CORE_GLOSSARY_ABSENT = (): boolean =>
  higherRouteAbsent(
    (v) => v.renderedBy === GLOSSARY_RENDERER,
    "folio-assistant-core/glossary/",
    "the route of folio-assistant-core's `glossary` visualiser — its declaration, or the built page `docs/en/folio-assistant-core/glossary/index.md` that records it",
  );

/**
 * The leading `---`-delimited front matter of a markdown file, or `""` when it
 * has none.
 *
 * **Front matter ONLY, and that is not fussiness.** The first cut of
 * `generatedDocsPages` tested the WHOLE file for `generated:
 * scripts/gen-docs-pages.ts`, and the very first merge after it was written
 * found an 18th subject: `docs/reference/skill-instructions/
 * merge-conflict-patterns.md`, the generated body of the skill that DOCUMENTS
 * this pattern, which quotes that front-matter line in a fenced code block. A
 * detector that reads a quotation as a declaration finds its own
 * documentation — *"a docblock that documents a tag necessarily contains the
 * tag"* (`audit-coverage`). That page's own front matter names
 * `gen-skill-docs.ts` and the `skill-instructions` pattern already owns it.
 */
function frontMatter(text: string): string {
  if (!text.startsWith("---\n")) return "";
  const end = text.indexOf("\n---", 3);
  return end === -1 ? "" : text.slice(4, end + 1);
}

/**
 * Every `.md` under this layer's site directory whose own front matter names
 * `gen-docs-pages.ts` as its writer, repo-relative. Read from the TREE rather
 * than listed, so a page added to `docs/source/` makes the `docs-pages` test
 * fail until its slug is declared — the enumeration cannot go quietly stale.
 */
function generatedDocsPages(): string[] {
  const out: string[] = [];
  const walk = (abs: string): void => {
    for (const e of siteFs.readdirSync(abs, { withFileTypes: true }) as import("node:fs").Dirent[]) {
      if (e.name.startsWith(".") || e.name.startsWith("_")) continue;
      const p = join(abs, e.name);
      if (e.isDirectory()) {
        if (e.name === "assets" || e.name === "vendor") continue;
        walk(p);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      if (/^generated:\s*scripts\/gen-docs-pages\.ts/m.test(frontMatter(siteFs.readFileSync(p, "utf8") as string))) {
        out.push(relative(REPO, p));
      }
    }
  };
  walk(join(INSTANCE, siteDirFor(INSTANCE)));
  return out.sort();
}

describe("generated-page globs come from the declared visualisers, not instance names", () => {
  // The glossary and catalogue globs used to spell out the layer that
  // declares each page, which made this lower layer name layers above it
  // (check:reference-direction). They are now read off `visualisers[]`.
  function fixture(visualisers: object[]): string {
    const repo = mkdtempSync(join(tmpdir(), "conflict-routes-"));
    mkdirSync(join(repo, "acme"));
    writeFileSync(join(repo, "acme", "acme.json"), JSON.stringify({ name: "acme", visualisers }));
    return repo;
  }

  test("a glossary visualiser yields its route, English and per locale", () => {
    const repo = fixture([{ id: "terms", renderedBy: GLOSSARY_RENDERER }, { id: "other", renderedBy: "x" }]);
    try {
      const glossary = (v: { renderedBy: string }) => v.renderedBy === GLOSSARY_RENDERER;
      expect(declaredRouteGlobs(repo, glossary, "**")).toEqual(["cat-harness/docs/acme/terms/**"]);
      expect(declaredRouteGlobs(repo, glossary, "index.md", "{ar,es}")).toEqual(["cat-harness/docs/{ar,es}/acme/terms/index.md"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("a catalogue visualiser yields its route; a checkout declaring none yields no glob", () => {
    const repo = fixture([{ id: CATALOGUE_VISUALISER, renderedBy: "x" }]);
    const empty = fixture([]);
    try {
      const catalogue = (v: { id: string }) => v.id === CATALOGUE_VISUALISER;
      expect(declaredRouteGlobs(repo, catalogue, "**")).toEqual(["cat-harness/docs/acme/catalogue/**"]);
      expect(declaredRouteGlobs(empty, catalogue, "**")).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(empty, { recursive: true, force: true });
    }
  });

  test("standing alone, the routes come from the generated pages the harness site holds", () => {
    // check-standalone lays out this layer and its `needs` only: the layer
    // that DECLARES the glossary or catalogue visualiser is absent, but the
    // harness site still holds the pages its generator wrote.
    const repo = mkdtempSync(join(tmpdir(), "conflict-routes-site-"));
    try {
      const page = (rel: string, fm: string) => {
        mkdirSync(join(repo, "cat-harness/docs", rel, ".."), { recursive: true });
        writeFileSync(join(repo, "cat-harness/docs", rel), `---\n${fm}\n---\nbody\n`);
      };
      page("acme/terms/index.md", "generated: acme/scripts/glossary-page.ts — do not hand-edit");
      page("acme/catalogue/index.html", "rendered-by: acme-pages");
      page("acme/notes/index.md", "title: authored, says nothing about a generator");
      const glossary = (v: { renderedBy: string }) => v.renderedBy === GLOSSARY_RENDERER;
      const catalogue = (v: { id: string }) => v.id === CATALOGUE_VISUALISER;
      expect(declaredRouteGlobs(repo, glossary, "**")).toEqual(["cat-harness/docs/acme/terms/**"]);
      expect(declaredRouteGlobs(repo, catalogue, "**")).toEqual(["cat-harness/docs/acme/catalogue/**"]);
      expect(declaredRouteGlobs(repo, (v) => v.id === "notes", "**")).toEqual([]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("standing alone, a page under the page locale records its route too", () => {
    // The glossary pages moved under the page locale on 2026-10-16
    // (`<site>/en/<harness>/<visualiser>/`); a record that read only
    // `<site>/<harness>/<visualiser>/` found none on a current site (w1gy F18).
    const repo = mkdtempSync(join(tmpdir(), "conflict-routes-locale-"));
    try {
      mkdirSync(join(repo, "cat-harness/docs/en/acme/terms"), { recursive: true });
      writeFileSync(join(repo, "cat-harness/docs/en/acme/terms/index.md"), "---\ngenerated: acme/scripts/glossary-page.ts\n---\nbody\n");
      const glossary = (v: { renderedBy: string }) => v.renderedBy === GLOSSARY_RENDERER;
      expect(declaredRouteGlobs(repo, glossary, "**", "en")).toEqual(["cat-harness/docs/en/acme/terms/**"]);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  test("a translated glossary page other than the generated index stays refused", () => {
    const translated = PATTERNS.find((p) => p.id === "translated-glossary")!;
    for (const g of translated.globs) expect(g.endsWith("/index.md")).toBe(true);
  });
});

describe("classify", () => {
  test("measured generated families resolve by their declared strategy", () => {
    expect(classify("cat-harness/test/results/skill-register.qa-results.json").pattern?.id).toBe("qa-results");
    expect(classify("cat-harness/test/results/lsi/cat-harness/skills.lsi.json").strategy).toBe("take-base");
    expect(classify("cat-harness/test/results/translation-qa/docs/installation.fr.translation-qa.json").pattern?.id).toBe("derived-results");
    expect(classify("cat-harness/test/results/translation-qa/docs/installation.fr.translation-qa.json").strategy).toBe("take-base");
    expect(classify("cat-harness/docs/cat-harness/auto-docs/index/index.html").pattern?.id).toBe("auto-docs");
    expect(classify("beans/README.md").strategy).toBe("generated-regions");
  });

  test.skipIf(CORE_GLOSSARY_ABSENT())("the content core's generated glossary is taken, under the page locale and at its old address", () => {
    // The English glossary under the page locale (2026-10-16), and at its old address.
    expect(classify("cat-harness/docs/en/folio-assistant-core/glossary/index.md").pattern?.id).toBe("glossary");
    expect(classify("cat-harness/docs/en/folio-assistant-core/glossary/instance/who-iris/index.md").pattern?.id).toBe("glossary");
    expect(classify("cat-harness/docs/folio-assistant-core/glossary/index.md").pattern?.id).toBe("glossary");
  });

  test("the three generated glossary/skill families classify, and their carry-forward neighbours do not", () => {
    // Bean `8rff`: each was named by no pattern, so `merge:main` refused it
    // and `merge:overlap` counted it as authored — 54 + 50 + 30 pair-path hits
    // across 32 open PRs.
    expect(classify("cat-harness/docs/assets/glossary/bootstrap--kg-skills.skos.jsonld").pattern?.id).toBe(
      "skos-glossary-export",
    );
    expect(classify("folio-assistant-core/glossary/generated/cat-harness/kg-skills.glossary.json").pattern?.id).toBe(
      "glossary-generated",
    );
    expect(classify("cat-harness/docs/reference/skill-instructions/bean-coordination.md").pattern?.id).toBe(
      "skill-instructions",
    );
  });

  test("the glossary LEDGER is refused: it is the one artefact that carries forward", () => {
    // glossary-export.ts reads the prior ledger and preserves a concept's
    // earlier names as skos:hiddenLabel (#1168 B10b). Taking one side would
    // drop a term's history, so `glossary-generated`'s glob must stop at
    // `generated/` and leave the sibling alone. This is the unsafe neighbour
    // the skill's §"Adding a pattern" step 3 asks for.
    expect(classify("cat-harness/glossary/glossary-ledger.json").strategy).toBe("refuse");
    expect(classify("cat-harness/glossary/bootstrap/glossary-ledger.json").strategy).toBe("refuse");
  });

  test("a skill SOURCE is refused while its generated instruction page is taken", () => {
    // The pair that makes `skill-instructions` safe: resolve the generated
    // copy, never the authored skill it is generated from.
    expect(classify("cat-harness/docs/reference/skill-instructions/merge-conflict-patterns.md").strategy).toBe(
      "take-base",
    );
    expect(classify("cat-harness/sdlc/skills/sdlc-core/merge-conflict-patterns.md").strategy).toBe("refuse");
  });

  test("every generated docs page classifies to `docs-pages` — read from the tree, not listed", () => {
    // Bean `8c6v`: 17 pages under `cat-harness/docs/` carry
    // `generated: scripts/gen-docs-pages.ts — do not hand-edit` in their own
    // front matter, and NONE was named by a pattern, so `merge:main` returned
    // `refuse / — none —` and handed back for hand-editing the files that
    // forbid it. `docs/process/publication-workflow.md` was one of the 2 refusals that
    // blocked #1888 after 53 of its 55 conflicts had resolved.
    const pages = generatedDocsPages();
    // 10 since moves M6–M8 (cat-harness#445) took seven pages up to the
    // layers whose processes they show; 8 since `docs/fhir/`'s two pages
    // (fhir-content, ig-publisher) went to fhir-harness. A floor, so an empty
    // walk still fails.
    expect(pages.length).toBeGreaterThanOrEqual(8);
    // Deriving the subjects from the tree is the point: a page added to
    // `docs/source/` lands here and fails until the glob names its slug.
    const unmatched = pages.filter((p) => classify(p).pattern?.id !== "docs-pages");
    expect(unmatched).toEqual([]);
    expect(classify("cat-harness/docs/process/publication-workflow.md").pattern?.id).toBe("docs-pages");
    expect(classify("cat-harness/docs/guides/writing-a-paper.md").pattern?.id).toBe("docs-pages");
  });

  test("the AUTHORED source a docs page is generated from is refused, and so are its authored siblings", () => {
    // The pair that makes `docs-pages` safe, and step 3 of §"Adding a pattern":
    // `gen-docs-pages.ts` READS the blocks under `docs/source/<slug>/`, which
    // are hand-written and genuinely need a person. The glob must not reach
    // them, nor the authored `docs/*.md` pages sitting beside the generated
    // ones in the SAME directory — `cat-harness/docs/*.md` is a mix, which is
    // why the 17 slugs are enumerated instead of globbed.
    expect(
      classify("cat-harness/docs/source/process-publication-workflow/every-workflow-in-the-repo.md").strategy,
    ).toBe("refuse");
    for (const authored of [
      "cat-harness/docs/concepts/architecture.md",
      "cat-harness/docs/start/getting-started.md",
      "cat-harness/docs/index.md",
      "cat-harness/docs/guides/agent-onboarding.md",
      "cat-harness/docs/guides/voices.md",
    ]) {
      expect(classify(authored).strategy).toBe("refuse");
    }
    // Nothing under `content/` may be claimed by it, at any depth.
    const claimed = generatedDocsPages().filter((p) => p.includes("/content/"));
    expect(claimed).toEqual([]);
  });

  // Found on this branch's first merge of `main`: the generated body of the
  // skill documenting `docs-pages` quotes `generated: scripts/gen-docs-pages.ts`
  // in a code fence, so a whole-file detector counted an 18th page. Its OWN
  // front matter names gen-skill-docs.ts, and `skill-instructions` — declared
  // BEFORE `docs-pages`, so it wins the first match — already owns it.
  const quoting = "cat-harness/docs/reference/skill-instructions/merge-conflict-patterns.md";
  // Standing alone the page is not built: gen-skill-docs writes it at publish
  // and `docs/reference/skill-instructions/` is gitignored (bean w1gy F18).
  test.skipIf(
    siteNotBuilt("the skill-instructions page gen-skill-docs writes at publish (gitignored)", join(REPO, quoting)),
  )("the page that QUOTES the generated marker really quotes it", () => {
    expect(siteFs.readFileSync(join(REPO, quoting), "utf8")).toContain("generated: scripts/gen-docs-pages.ts");
  });

  test("a page that QUOTES the generated marker is not a subject of it", () => {
    expect(generatedDocsPages()).not.toContain(quoting);
    expect(classify(quoting).pattern?.id).toBe("skill-instructions");
  });

  test("site-data still owns docs/assets JSON: the new SKOS entry did not widen it", () => {
    // `.skos.jsonld` is not `*.json`, so the two cannot overlap — pinned
    // because `8rff` flagged exactly this as the thing to confirm.
    expect(classify("cat-harness/docs/assets/library/index.json").pattern?.id).toBe("site-data");
  });

  test("a kg-qa sidecar is taken; the attestation store beside it is refused (bean 7mwa)", () => {
    // `qa:resolve-conflicts` and its `qa-sidecar` strategy were retired once
    // cat-harness and folio-assistant-core stopped committing test/results/.
    // The judgement half moved to test/attestations/ (bean 2gst), and that
    // tree must never be taken.
    expect(classify("cat-harness/test/results/kg-qa/skills/x.kg-qa.json").pattern?.id).toBe("derived-results");
    expect(classify("cat-harness/test/attestations/kg-qa/processes/x.attestations.json").strategy).toBe("refuse");
  });

  test("a kg-qa MANIFEST is taken, like the sidecars it indexes", () => {
    // It holds the auditor's script hash and nothing else; found by replaying
    // real merges, where one refused on these files alone.
    expect(classify("fhir-harness/test/results/kg-qa.manifest.json").pattern?.id).toBe("kg-qa-manifest");
    expect(classify("cat-harness/test/results/bootstrap/kg-qa.manifest.json").pattern?.id).toBe("kg-qa-manifest");
  });

  test.skipIf(CORE_GLOSSARY_ABSENT())("the content core's translated glossaries are taken", () => {
    for (const l of ["ar", "es", "fr", "ru", "zh"]) {
      expect(classify(`cat-harness/docs/${l}/folio-assistant-core/glossary/index.md`).pattern?.id).toBe("translated-glossary");
    }
  });

  test("viewer pages are taken; their authored neighbours are not", () => {
    expect(classify("cat-harness/docs/cat-harness/external-schemas/index.md").pattern?.id).toBe("viewer-pages");
    expect(classify("cat-harness/docs/cat-harness/processes/index.md").pattern?.id).toBe("viewer-pages");
    expect(classify("cat-harness/docs/cat-harness/processes/merge-base.md").pattern?.id).toBe("viewer-pages");
    expect(classify("cat-harness/docs/cat-harness/translation-status/index.html").pattern?.id).toBe("viewer-pages");
    expect(classify("cat-harness/docs/cat-harness/methodologies/index.md").pattern?.id).toBe("viewer-pages");
    // The fsh-guts viewer is no longer committed (built at publish, bean 0b8c),
    // so no pattern takes it: a merge cannot meet it, and if one ever did the
    // file would be a tracked copy check:derived-from refuses.
    expect(classify("cat-harness/docs/fsh-guts/index.md").pattern).toBeUndefined();
    // ...and not the archive it renders: fsh-guts/ holds authored, kept content.
    expect(classify("fsh-guts/uploads/Home-_-folio-assistant.md").strategy).toBe("refuse");
    expect(classify("cat-harness/docs/fsh-guts/other.md").strategy).toBe("refuse");
    expect(classify("cat-harness/docs/cat-harness/published-graphs.md").pattern?.id).toBe("handler-index");
    expect(classify("cat-harness/test/health/results/repository.health-report.json").pattern?.id).toBe("health-report");
    // Authored neighbours: a methodology page itself, and the health producer.
    expect(classify("cat-harness/docs/methodologies/prov-o.md").strategy).toBe("refuse");
    expect(classify("cat-harness/test/health/run.ts").strategy).toBe("refuse");
    expect(classify("cat-harness/docs/cat-harness/qa/index.html").pattern?.id).toBe("viewer-pages");
    expect(classify("cat-harness/test/results/witnesses/guides-who-smart-dak/the-l2-artifacts.kg.json").pattern?.id).toBe("qa-witnesses");
    expect(classify("cat-harness/translations/ar/publication-workflow.pot").pattern?.id).toBe("pot-templates");
    // The authored translation beside the template is NOT a template.
    expect(classify("cat-harness/translations/ar/publication-workflow.po").strategy).toBe("refuse");
    // The unsafe neighbours: authored translations, and a locale no generator writes.
    expect(classify("cat-harness/docs/ar/index.md").strategy).toBe("refuse");
    expect(classify("cat-harness/docs/start/fr/getting-started.md").strategy).toBe("refuse");
    expect(classify("cat-harness/docs/de/folio-assistant-core/glossary/index.md").strategy).toBe("refuse");
  });

  test("the PROV-O report is taken; the workflow instances it is derived FROM are refused", () => {
    // The single unclassified path when the runner refused #1892 against 32 it
    // resolved. Generated whole by `prov:qaqc` from the instances under
    // `beans/workflows/`, so any branch that records one rewrites the index.
    expect(classify("cat-harness/docs/prov-qaqc/index.md").pattern?.id).toBe("prov-qaqc");
    expect(classify("cat-harness/docs/assets/prov/x.prov.jsonld").pattern?.id).toBe("prov-qaqc");
    // Instance-agnostic, like `derived-results`: a dependent folio writes the
    // same two shapes under its own root.
    expect(classify("who-iris/docs/prov-qaqc/index.md").pattern?.id).toBe("prov-qaqc");
    // The unsafe neighbours. The INPUT is committed workflow state, not a
    // derivative of it, so taking base would discard a recorded instance.
    expect(classify("beans/workflows/crdm-requirements-1.json").strategy).toBe("refuse");
    // And the generator itself is authored source.
    expect(classify("cat-harness/scripts/prov-qaqc.ts").strategy).toBe("refuse");
  });

  test("artefact-verification.json refuses BY NAME, which an unclassified path does not", () => {
    // The distinction this entry exists for, and the reason it is declared
    // rather than left to the default: a named refusal tells the next sweep WHY
    // (bean `mjl3`), where "no declared pattern" reads as an omission. It looks
    // generated — under scripts/, a .json, key set derived from package.json —
    // and refused on two open PRs at once (#1958, #1955).
    const named = classify("cat-harness/scripts/artefact-verification.json");
    expect(named.strategy).toBe("refuse");
    expect(named.pattern?.id).toBe("artefact-verification");

    // A genuinely unclassified neighbour refuses with NO pattern. If these two
    // ever report the same thing, the entry has stopped carrying its reason.
    const unnamed = classify("cat-harness/scripts/sync-docs-harness.ts");
    expect(unnamed.strategy).toBe("refuse");
    expect(unnamed.pattern).toBeUndefined();
  });

  test("generated VIEWERS of uploads/ are taken; uploads/ itself stays refused", () => {
    // The false positive found on #1764/#1775: `**/uploads/**` caught pages
    // that render uploads/ rather than being uploads.
    expect(classify("cat-harness/docs/cat-harness/uploads-queue/index.html").pattern?.id).toBe("viewer-pages");
    expect(classify("cat-harness/docs/cat-harness/uploads/who-iris/index.html").pattern?.id).toBe("viewer-namespace");
    for (const p of ["beans", "todos", "health", "issue-marks", "swimlane-glossary"]) {
      expect(classify(`cat-harness/docs/cat-harness/${p}/index.html`).pattern?.id).toBe("viewer-pages");
    }
    for (const seg of ["folio", "library", "schemas", "voices"]) {
      expect(classify(`cat-harness/docs/cat-harness/${seg}/index.html`).pattern?.id).toBe("viewer-namespace");
    }
    expect(classify("cat-harness/docs/_includes/generated/navbar-footer.html").pattern?.id).toBe("navbar-include");
    expect(classify("cat-harness/test/results/viewer-nav/viewer-nav.qa.json").pattern?.id).toBe("viewer-nav-qa");
    // The real uploads stay refused, at the root and in any layer.
    expect(classify("uploads/9789240093362-eng.pdf").pattern?.id).toBe("uploads");
    expect(classify("who-iris/uploads/x.pdf").pattern?.id).toBe("uploads");
    // Authored neighbours of the new globs stay refused.
    expect(classify("cat-harness/docs/beans/notes.md").strategy).toBe("refuse");
    expect(classify("cat-harness/site-chrome/_includes/head_custom.html").strategy).toBe("refuse");
  });

  test.skipIf(
    higherRouteAbsent(
      (v) => v.id === CATALOGUE_VISUALISER,
      "who-iris/catalogue/",
      "the route of who-iris's `catalogue` visualiser — its declaration, or the built page `docs/who-iris/catalogue/index.html` that records it",
    ),
  )("a folio's generated catalogue viewer is in the viewer namespace", () => {
    expect(classify("cat-harness/docs/who-iris/catalogue/index.html").pattern?.id).toBe("viewer-namespace");
  });

  test("the standalone baseline is taken from the base; its sibling baseline and its writer are not", () => {
    // Fail-closed: the base's list, nothing regenerated (#1977). The neighbour
    // with the same shape, declared-path-baseline.json, is a different ratchet
    // nobody has measured a pattern for, so it stays refused.
    expect(classify("cat-harness-tools/scripts/standalone-baseline.json").pattern?.id).toBe("standalone-baseline");
    expect(classify("cat-harness-tools/scripts/standalone-baseline.json").strategy).toBe("take-base");
    expect(classify("cat-harness/scripts/declared-path-baseline.json").strategy).toBe("refuse");
    expect(classify("cat-harness-tools/scripts/check-standalone.ts").strategy).toBe("refuse");
  });

  test("a path no pattern names is REFUSED, with no pattern attached", () => {
    const c = classify("cat-harness/scripts/merge-base.ts");
    expect(c.strategy).toBe("refuse");
    expect(c.pattern).toBeUndefined();
  });

  test("authored families are refused BY DECLARATION, with the reason", () => {
    const b = classify("beans/defs/folio-assistant-x--y.md");
    expect(b.strategy).toBe("refuse");
    expect(b.pattern?.why).toContain("Authored");
  });

  test("every pattern says why", () => {
    for (const p of PATTERNS) expect(p.why.length).toBeGreaterThan(20);
  });
});

describe("plan is all-or-nothing input", () => {
  test("one authored conflict among generated ones is reported as refused", () => {
    // A generated page the `glossary` pattern names literally (its lsi
    // route), so the plan is measured in every layout (bean w1gy F18).
    const generated = "cat-harness/docs/en/cat-harness/lsi/index.md";
    const p = plan([generated, "cat-harness/scripts/merge-base.ts"]);
    expect(p.resolvable.map((c) => c.path)).toEqual([generated]);
    expect(p.refused.map((c) => c.path)).toEqual(["cat-harness/scripts/merge-base.ts"]);
  });
});

const README = (hunk: string) =>
  [
    "# Title",
    "",
    "Authored prose.",
    "<!-- kg:subgraph:begin -->",
    "| file | what |",
    hunk,
    "<!-- kg:subgraph:end -->",
    "More authored prose.",
  ].join("\n");

describe("resolveGeneratedRegions", () => {
  test("a hunk inside a generated region takes the base side; authored text survives", () => {
    const text = README("<<<<<<< HEAD\n| defs/ | 1150 files |\n=======\n| defs/ | 1151 files |\n>>>>>>> origin/main");
    const out = resolveGeneratedRegions(text)!;
    expect(out).toContain("| defs/ | 1151 files |");
    expect(out).not.toContain("1150");
    expect(out).toContain("Authored prose.");
    expect(out).not.toContain("<<<<<<<");
  });

  test("diff3 style (a ||||||| base section) resolves the same way", () => {
    const text = README("<<<<<<< HEAD\n| a | 2 |\n||||||| merged common ancestors\n| a | 1 |\n=======\n| a | 3 |\n>>>>>>> origin/main");
    expect(resolveGeneratedRegions(text)).toContain("| a | 3 |");
  });

  test("a hunk in AUTHORED text is refused", () => {
    const text = [
      "<<<<<<< HEAD", "Prose one way.", "=======", "Prose another way.", ">>>>>>> origin/main",
      "<!-- kg:subgraph:begin -->", "x", "<!-- kg:subgraph:end -->",
    ].join("\n");
    expect(resolveGeneratedRegions(text)).toBeUndefined();
  });

  test("a hunk that moves a region boundary is refused: structure, not content", () => {
    const text = README("<<<<<<< HEAD\n| a | 1 |\n<!-- kg:subgraph:end -->\n=======\n| a | 2 |\n>>>>>>> origin/main");
    expect(resolveGeneratedRegions(text)).toBeUndefined();
  });

  test("an unterminated conflict block is refused", () => {
    expect(resolveGeneratedRegions(README("<<<<<<< HEAD\n| a | 1 |\n=======\n| a | 2 |"))).toBeUndefined();
  });

  test("a file with no conflict comes back unchanged", () => {
    const t = README("| a | 1 |");
    expect(resolveGeneratedRegions(t)).toBe(t);
  });
});

/**
 * A modify/delete conflict: `ours` changes the file, `theirs` (the base being
 * merged in) deletes it — or the reverse. Measured 2026-10-02 on #1805, where
 * main deleted auto-docs pages the branch had touched and `checkout --theirs`
 * threw "does not have their version".
 */
function modifyDelete(deletedBy: "theirs" | "ours"): string {
  const dir = mkdtempSync(join(tmpdir(), "merge-base-md-"));
  const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  g("init", "-q", "-b", "branch");
  g("config", "user.email", "t@example.invalid");
  g("config", "user.name", "t");
  writeFileSync(join(dir, "gen.html"), "v1\n");
  g("add", ".");
  g("commit", "-qm", "base");
  g("checkout", "-q", "-b", "main");
  if (deletedBy === "theirs") g("rm", "-q", "gen.html");
  else writeFileSync(join(dir, "gen.html"), "main\n");
  g("commit", "-qam", "main side");
  g("checkout", "-q", "branch");
  if (deletedBy === "ours") g("rm", "-q", "gen.html");
  else writeFileSync(join(dir, "gen.html"), "branch\n");
  g("commit", "-qam", "branch side");
  try { g("merge", "--no-commit", "main"); } catch { /* the conflict is the point */ }
  return dir;
}

describe("take-base when one side deleted the file", () => {
  const dirs: string[] = [];
  const mk = (by: "theirs" | "ours") => { const d = modifyDelete(by); dirs.push(d); return d; };

  test("the stage set decides: no stage 3 means the base deleted it", () => {
    expect(takeBaseAction(new Set([1, 2]))).toBe("delete");
    expect(takeBaseAction(new Set([1, 3]))).toBe("theirs");
    expect(takeBaseAction(new Set([1, 2, 3]))).toBe("theirs");
  });

  test("deleted by the base: the deletion is taken, not a throw", () => {
    const d = mk("theirs");
    expect([...unmergedStages(d, "gen.html")].sort()).toEqual([1, 2]);
    takeBase(d, "gen.html");
    expect(existsSync(join(d, "gen.html"))).toBe(false);
    expect(execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd: d, encoding: "utf-8" })).toBe("");
  });

  test("deleted on the branch, changed on the base: the base's copy is taken", () => {
    const d = mk("ours");
    expect([...unmergedStages(d, "gen.html")].sort()).toEqual([1, 3]);
    takeBase(d, "gen.html");
    expect(readFileSync(join(d, "gen.html"), "utf-8")).toBe("main\n");
    expect(execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd: d, encoding: "utf-8" })).toBe("");
  });

  test("an already-resolved path (no stages) is left alone, never deleted — bean vsv7", () => {
    expect(takeBaseAction(new Set())).toBe("resolved");
    // Both sides changed the file; an earlier step resolved and staged it, as
    // `qa:resolve-conflicts` did before bean 7mwa retired it.
    const d = mk("theirs");
    writeFileSync(join(d, "gen.html"), "resolved earlier\n");
    execFileSync("git", ["add", "--", "gen.html"], { cwd: d });
    expect(unmergedStages(d, "gen.html").size).toBe(0);
    takeBase(d, "gen.html");
    expect(readFileSync(join(d, "gen.html"), "utf-8")).toBe("resolved earlier\n");
  });

  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
});

describe("modify/delete on DECLARED paths: generated resolves, authored refuses (#1854)", () => {
  // Real pattern paths rather than a bare `gen.html`, so classification and
  // the stage handling are exercised together on what git actually reports.
  const GEN = "cat-harness/docs/cat-harness/auto-docs/index/index.html";
  const BEAN = "beans/defs/folio-assistant-x--y.md";
  const mk = (): string => {
    const dir = mkdtempSync(join(tmpdir(), "merge-base-md2-"));
    const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    g("init", "-q", "-b", "branch");
    g("config", "user.email", "t@example.invalid");
    g("config", "user.name", "t");
    for (const p of [GEN, BEAN]) {
      mkdirSync(join(dir, p, ".."), { recursive: true });
      writeFileSync(join(dir, p), "v1\n");
    }
    g("add", ".");
    g("commit", "-qm", "base");
    g("checkout", "-q", "-b", "main");
    g("rm", "-q", GEN, BEAN); // main deletes both
    g("commit", "-qm", "main deletes");
    g("checkout", "-q", "branch");
    for (const p of [GEN, BEAN]) writeFileSync(join(dir, p), "branch\n"); // the branch edits both
    g("commit", "-qam", "branch edits");
    try { g("merge", "--no-commit", "main"); } catch { /* the conflict is the point */ }
    return dir;
  };

  test("the generated page takes main's deletion; the bean is refused", () => {
    const d = mk();
    try {
      const conflicted = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd: d, encoding: "utf-8" })
        .split("\n").filter(Boolean).sort();
      expect(conflicted).toEqual([BEAN, GEN].sort());
      const p = plan(conflicted);
      expect(p.resolvable.map((c) => c.path)).toEqual([GEN]);
      expect(p.resolvable[0]!.pattern?.id).toBe("auto-docs");
      expect(p.refused.map((c) => c.path)).toEqual([BEAN]);
      expect(p.refused[0]!.pattern?.id).toBe("beans");
      for (const c of p.resolvable) takeBase(d, c.path);
      expect(existsSync(join(d, GEN))).toBe(false);
      const left = execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd: d, encoding: "utf-8" });
      expect(left.trim()).toBe(BEAN);
    } finally {
      rmSync(d, { recursive: true, force: true });
    }
  });
});

describe("a merge never drops a path neither side deleted (beans vsv7, 8j9e)", () => {
  const paths = (ds: { path: string }[]) => ds.map((d) => d.path);

  test("a path on both parents and absent from the result is reported", () => {
    expect(droppedPaths(["a", "b", "c"], ["a", "b", "c"], ["a", "b"], ["a"])).toEqual([{ path: "b", heldBy: "both" }]);
  });

  test("a side's DELETION since the merge base may be taken, from either side", () => {
    // base has both files; the branch deleted one and main deleted the other.
    expect(droppedPaths(["a", "deleted-on-branch", "deleted-on-main"], ["a", "deleted-on-main"], ["a", "deleted-on-branch"], ["a"])).toEqual([]);
  });

  test("a path one side ADDED is not a deletion, and dropping it is refused (8j9e)", () => {
    // The vsv7 version let these through: only one parent holds each.
    expect(droppedPaths(["a"], ["a", "added-on-branch"], ["a", "added-on-main"], ["a"])).toEqual([
      { path: "added-on-branch", heldBy: "ours" },
      { path: "added-on-main", heldBy: "theirs" },
    ]);
  });

  test("no merge base (empty) refuses every dropped path: stricter, never looser", () => {
    expect(paths(droppedPaths([], ["a", "x"], ["a"], ["a"]))).toEqual(["x"]);
  });

  test("nothing dropped is an empty list, and the order is stable", () => {
    expect(droppedPaths(["a", "z"], ["z", "a"], ["a", "z"], ["a", "z"])).toEqual([]);
    expect(paths(droppedPaths(["a", "m", "z"], ["z", "a", "m"], ["m", "a", "z"], []))).toEqual(["a", "m", "z"]);
  });

  test("before staging every drop is refused; after the writers, only a drop the disk still holds", () => {
    const dropped = [
      { path: "payload/superseded", heldBy: "theirs" as const }, // a writer replaced it
      { path: "results/x.json", heldBy: "both" as const }, // out of the index, still on disk
    ];
    const onDisk = (p: string) => p === "results/x.json";
    expect(refusable(dropped, "resolved", onDisk)).toEqual(dropped);
    expect(refusable(dropped, "staged", onDisk)).toEqual([dropped[1]!]);
  });

  test("the refusal line has the shape merge-main-comment reads, and says when the disk hides the loss", () => {
    const line = droppedLine({ path: "r/x.json", heldBy: "both" }, true);
    expect(line).toMatch(/^ {2}✗ .* {2}\[/);
    expect(line).toContain("still on disk");
    expect(droppedLine({ path: "r/x.json", heldBy: "theirs" }, false)).toContain("added on the base");
  });
});

/**
 * 8j9e: a GITIGNORED directory whose files are still tracked on both sides,
 * as `cat-harness/test/results/` is on main. Both parents change
 * `results/x.json` (a conflict) and main adds `results/new.json`.
 */
function ignoredTrackedMerge(): { dir: string; g: (...a: string[]) => string } {
  const dir = mkdtempSync(join(tmpdir(), "merge-base-8j9e-"));
  const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  g("init", "-q", "-b", "branch");
  g("config", "user.email", "t@example.invalid");
  g("config", "user.name", "t");
  mkdirSync(join(dir, "results"));
  writeFileSync(join(dir, ".gitignore"), "results/\n");
  writeFileSync(join(dir, "results/x.json"), "{}\n");
  writeFileSync(join(dir, "results/y.json"), "{}\n");
  g("add", ".gitignore");
  g("add", "-f", "results/x.json", "results/y.json");
  g("commit", "-qm", "base: results/ ignored, two files tracked anyway");
  g("checkout", "-q", "-b", "main");
  writeFileSync(join(dir, "results/x.json"), "{\"main\":1}\n");
  writeFileSync(join(dir, "results/new.json"), "{}\n");
  g("add", "-f", "results/x.json", "results/new.json");
  g("commit", "-qm", "main side");
  g("checkout", "-q", "branch");
  writeFileSync(join(dir, "results/x.json"), "{\"branch\":1}\n");
  g("add", "-f", "results/x.json");
  g("commit", "-qm", "branch side");
  try { g("merge", "--no-ff", "--no-commit", "main"); } catch { /* the conflict is the point */ }
  return { dir, g };
}

describe("a gitignored-but-tracked file through a merge and its regeneration (8j9e)", () => {
  test("a writer rewriting a tracked-ignored file: `git add -A` keeps it staged, and the guard passes", () => {
    const { dir, g } = ignoredTrackedMerge();
    try {
      takeBase(dir, "results/x.json");
      // regen rewrites both tracked-but-ignored files on disk
      writeFileSync(join(dir, "results/x.json"), "{\"regen\":1}\n");
      writeFileSync(join(dir, "results/y.json"), "{\"regen\":1}\n");
      g("add", "-A");
      expect(g("diff", "--cached", "--name-only", "HEAD").split("\n").sort()).toEqual(["results/new.json", "results/x.json", "results/y.json"]);
      expect(g("show", ":results/y.json")).toBe("{\"regen\":1}");
      expect(droppedInMerge(dir)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("the #1898 shape: a path an earlier step resolved is `git rm`ed, regen rewrites it, and `add -A` never restages it", () => {
    const { dir, g } = ignoredTrackedMerge();
    try {
      // An earlier step (`qa:resolve-conflicts`, before bean 7mwa) resolves and stages the path first...
      g("checkout", "--ours", "--", "results/x.json");
      g("add", "-f", "--", "results/x.json");
      // ...then the pre-vsv7 take-base read "no stages" as "the base deleted it".
      g("rm", "-q", "--", "results/x.json");
      // regen writes it again; every local check reads this file and passes.
      writeFileSync(join(dir, "results/x.json"), "{\"regen\":1}\n");
      g("add", "-A");
      expect(g("ls-files", "--", "results/x.json")).toBe("");
      expect(existsSync(join(dir, "results/x.json"))).toBe(true);
      const dropped = droppedInMerge(dir);
      expect(dropped).toEqual([{ path: "results/x.json", heldBy: "both" }]);
      expect(droppedLine(dropped[0]!, true)).toContain("still on disk");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a file the base ADDED under the ignored directory and the merge lost is refused too", () => {
    const { dir, g } = ignoredTrackedMerge();
    try {
      takeBase(dir, "results/x.json");
      g("rm", "-q", "--cached", "--", "results/new.json");
      g("add", "-A");
      expect(droppedInMerge(dir)).toEqual([{ path: "results/new.json", heldBy: "theirs" }]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("the base's own deletion of a tracked-ignored file is still taken", () => {
    const dir = mkdtempSync(join(tmpdir(), "merge-base-8j9e-del-"));
    const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    try {
      g("init", "-q", "-b", "branch");
      g("config", "user.email", "t@example.invalid");
      g("config", "user.name", "t");
      mkdirSync(join(dir, "results"));
      writeFileSync(join(dir, ".gitignore"), "results/\n");
      writeFileSync(join(dir, "results/gone.json"), "{}\n");
      writeFileSync(join(dir, "a.txt"), "a\n");
      g("add", ".gitignore", "a.txt");
      g("add", "-f", "results/gone.json");
      g("commit", "-qm", "base");
      g("checkout", "-q", "-b", "main");
      g("rm", "-q", "results/gone.json");
      g("commit", "-qm", "main untracks it");
      g("checkout", "-q", "branch");
      writeFileSync(join(dir, "a.txt"), "b\n");
      g("commit", "-qam", "branch side");
      g("merge", "--no-ff", "--no-commit", "main");
      expect(g("ls-files", "--", "results/gone.json")).toBe("");
      expect(droppedInMerge(dir)).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

// Bean `wczm` item 2. Train 1 (#1869): a branch's submodule pin that
// fast-forwarded main's was silently reverted by taking main's side. A gitlink
// is resolved by ANCESTRY: the descendant wins, diverged pins and pins the
// submodule does not have are refused.
describe("a conflicted submodule gitlink is resolved by ancestry — bean wczm", () => {
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@invalid", GIT_ALLOW_PROTOCOL: "file" };
  const g = (cwd: string, ...a: string[]) => execFileSync("git", ["-c", "protocol.file.allow=always", ...a], { cwd, env, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();

  /** A super-repo whose `sub` pin is set to `oursPin` on a branch and `theirsPin` on main, then merged: a gitlink conflict. */
  function conflict(build: (commit: (msg: string) => string, reset: (to: string) => void) => { base: string; ours: string; theirs: string }) {
    const top = mkdtempSync(join(tmpdir(), "gitlink-"));
    const subSrc = join(top, "sub-src");
    mkdirSync(subSrc);
    g(subSrc, "init", "-q", "-b", "main");
    const commit = (msg: string) => { g(subSrc, "commit", "-q", "--allow-empty", "-m", msg); return g(subSrc, "rev-parse", "HEAD"); };
    const reset = (to: string) => { g(subSrc, "checkout", "-q", "-B", `b-${to.slice(0, 7)}`, to); };
    const pins = build(commit, reset);
    const sup = join(top, "super");
    mkdirSync(sup);
    g(sup, "init", "-q", "-b", "main");
    // SHALLOW, as this repository's submodules and CI's are: with the full
    // history git resolves a fast-forward pin itself and nothing conflicts.
    g(sup, "submodule", "add", "-q", "--depth", "1", `file://${subSrc}`, "sub");
    const pin = (oid: string) => { g(join(sup, "sub"), "fetch", "-q", "--depth", "1", "origin", oid); g(join(sup, "sub"), "checkout", "-q", oid); g(sup, "add", "sub"); g(sup, "commit", "-q", "-m", `pin ${oid.slice(0, 7)}`); };
    pin(pins.base);
    g(sup, "checkout", "-q", "-b", "branch");
    pin(pins.ours);
    g(sup, "checkout", "-q", "main");
    pin(pins.theirs);
    g(sup, "checkout", "-q", "branch");
    try { g(sup, "merge", "--no-ff", "--no-commit", "main"); } catch { /* the conflict is the point */ }
    if (g(sup, "diff", "--name-only", "--diff-filter=U") !== "sub") throw new Error("fixture: expected a gitlink conflict on sub");
    return { top, sup, ...pins };
  }

  test("the branch's pin fast-forwards main's: keep the branch's", () => {
    const c = conflict((commit) => { const a = commit("a"); const b = commit("b"); const d = commit("c"); return { base: a, theirs: b, ours: d }; });
    try {
      const r = resolveGitlink(c.sup, "sub");
      expect(r).toEqual({ take: "ours", pin: c.ours, why: "the branch's pin fast-forwards the base's" });
      stageGitlink(c.sup, "sub", c.ours);
      expect(g(c.sup, "diff", "--name-only", "--diff-filter=U")).toBe("");
      expect(g(c.sup, "ls-files", "-s", "sub").split(/\s+/)[1]).toBe(c.ours);
    } finally { rmSync(c.top, { recursive: true, force: true }); }
  });

  test("main's pin fast-forwards the branch's: take main's", () => {
    const c = conflict((commit) => { const a = commit("a"); const b = commit("b"); const d = commit("c"); return { base: a, ours: b, theirs: d }; });
    try {
      expect(resolveGitlink(c.sup, "sub")).toEqual({ take: "theirs", pin: c.theirs, why: "the base's pin fast-forwards the branch's" });
    } finally { rmSync(c.top, { recursive: true, force: true }); }
  });

  test("diverged pins are refused — either side drops the other's commits", () => {
    const c = conflict((commit, reset) => { const a = commit("a"); const b = commit("b"); reset(a); const d = commit("c"); return { base: a, ours: b, theirs: d }; });
    try {
      const r = resolveGitlink(c.sup, "sub");
      expect(r && "refuse" in r && r.refuse).toContain("diverged");
    } finally { rmSync(c.top, { recursive: true, force: true }); }
  });

  test("a path that is not a gitlink is not this resolver's", () => {
    const c = conflict((commit) => { const a = commit("a"); const b = commit("b"); const d = commit("c"); return { base: a, theirs: b, ours: d }; });
    try {
      expect(resolveGitlink(c.sup, ".gitmodules")).toBeUndefined();
    } finally { rmSync(c.top, { recursive: true, force: true }); }
  });
});

/**
 * #1801, 2026-10-03: the branch adds `results/` to `.gitignore` while the
 * files there stay tracked on both sides. git checks an UNMERGED path against
 * `.gitignore` as if it were new, so a plain `git add` refused, and merge-main
 * went red on every push to main ("exited 1 without a refusal").
 */
function ignoredTrackedConflict(): string {
  const dir = mkdtempSync(join(tmpdir(), "merge-base-ign-"));
  const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
  g("init", "-q", "-b", "branch");
  g("config", "user.email", "t@example.invalid");
  g("config", "user.name", "t");
  mkdirSync(join(dir, "results"));
  writeFileSync(join(dir, "results/x.json"), "{}\n");
  g("add", ".");
  g("commit", "-qm", "base");
  g("checkout", "-q", "-b", "main");
  writeFileSync(join(dir, "results/x.json"), "{\"main\":1}\n");
  g("commit", "-qam", "main side");
  g("checkout", "-q", "branch");
  writeFileSync(join(dir, ".gitignore"), "results/\n");
  writeFileSync(join(dir, "results/x.json"), "{\"branch\":1}\n");
  g("add", ".gitignore");
  g("commit", "-qam", "branch side: ignore results/, still tracked");
  try { g("merge", "--no-commit", "main"); } catch { /* the conflict is the point */ }
  return dir;
}

describe("a conflicted path the branch's .gitignore matches (#1801)", () => {
  const dirs = [ignoredTrackedConflict(), ignoredTrackedConflict()];

  test("the crash, reproduced: a plain `git add` exits 1 on the unmerged ignored path", () => {
    // (git stages it all the same; only the exit status is the failure, and
    // the resolver's git() helper throws on it.)
    const dir = dirs[0]!;
    expect([...unmergedStages(dir, "results/x.json")].sort()).toEqual([1, 2, 3]);
    expect(() => execFileSync("git", ["add", "--", "results/x.json"], { cwd: dir, stdio: "pipe" })).toThrow();
  });

  test("takeBase stages the base's copy anyway, and nothing else", () => {
    const dir = dirs[1]!;
    expect([...unmergedStages(dir, "results/x.json")].sort()).toEqual([1, 2, 3]);
    writeFileSync(join(dir, "results/untracked.json"), "{}\n");
    takeBase(dir, "results/x.json");
    expect(readFileSync(join(dir, "results/x.json"), "utf-8")).toBe("{\"main\":1}\n");
    expect(execFileSync("git", ["diff", "--name-only", "--diff-filter=U"], { cwd: dir, encoding: "utf-8" })).toBe("");
    // -f is scoped to the conflicted path: an ignored untracked neighbour stays out.
    expect(execFileSync("git", ["ls-files", "--", "results/untracked.json"], { cwd: dir, encoding: "utf-8" })).toBe("");
  });

  afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
});

describe("a resolution that fails is reported as a refusal, not an unexplained exit", () => {
  test("the line has the refusal shape merge-main.yml and merge-main-comment read", () => {
    const err = Object.assign(new Error("Command failed"), { stderr: "\nThe following paths are ignored by one of your .gitignore files:\nresults\n" });
    const line = resolutionFailure("results/x.json", "derived-results", err);
    expect(line).toBe("  ✗ results/x.json  [derived-results: could not resolve] — The following paths are ignored by one of your .gitignore files:");
    // merge-main.yml: grep -qE '^  ✗ .*  \['
    expect(/^ {2}✗ .* {2}\[/.test(line)).toBe(true);
    expect(parseLog(`merge-base: 1 conflicted path(s)\n${line}\n`).refused).toContain("results/x.json");
  });
});

/**
 * #2176: the subgraph indexes and content-addressed payloads that
 * `subgraph:jsonld` writes. Both sides change one node, so both rewrite the
 * subgraph index and both move the node's payload to a new hex. Git reports
 * the payload as a RENAME/RENAME, and plain `take-base` cannot resolve that
 * without a drop.
 */
describe("owned-tree: subgraph indexes and content-addressed payloads (#2176)", () => {
  const P = "cat-harness/docs/payload/sha256";
  const IDX = "cat-harness/docs/subgraph/cat-harness/index.jsonld";
  const hex = (s: string) => new Bun.CryptoHasher("sha256").update(s).digest("hex");
  const lines = Array.from({ length: 60 }, (_, i) => `line ${i}`).join("\n") + "\n";
  const body = { base: lines, branch: `${lines}branch edit\n`, main: `${lines}main edit\n` };
  type Side = keyof typeof body;
  const name: Record<Side, string> = { base: hex(body.base), branch: hex(body.branch), main: hex(body.main) };
  const sidecar = (h: string, b: string) => `${JSON.stringify({ sha256: h, bytes: b.length })}\n`;
  const index = (who: string, h: string) => `${JSON.stringify({ "@id": "skill", who, payload: h })}\n`;

  /** The fixture: a base, then a branch and a main that each moved the payload. */
  const mk = () => {
    const dir = mkdtempSync(join(tmpdir(), "merge-base-owned-"));
    const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    const put = (side: Side) => {
      for (const s of Object.keys(body) as Side[]) {
        if (s === side) continue;
        rmSync(join(dir, P, name[s]), { force: true });
        rmSync(join(dir, P, `${name[s]}.json`), { force: true });
      }
      writeFileSync(join(dir, P, name[side]), body[side]);
      writeFileSync(join(dir, P, `${name[side]}.json`), sidecar(name[side], body[side]));
      writeFileSync(join(dir, IDX), index(side, name[side]));
    };
    g("init", "-q", "-b", "branch");
    g("config", "user.email", "t@example.invalid");
    g("config", "user.name", "t");
    mkdirSync(join(dir, P), { recursive: true });
    mkdirSync(join(dir, IDX, ".."), { recursive: true });
    put("base");
    g("add", "-A");
    g("commit", "-qm", "base");
    g("checkout", "-q", "-b", "main");
    put("main");
    g("add", "-A");
    g("commit", "-qm", "main moves the payload");
    g("checkout", "-q", "branch");
    put("branch");
    g("add", "-A");
    g("commit", "-qm", "branch moves the payload");
    try { g("merge", "--no-ff", "--no-commit", "main"); } catch { /* the conflict is the point */ }
    const conflicted = g("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean).sort();
    return { dir, g, conflicted };
  };

  /**
   * What `subgraph:jsonld` does in the merged tree. It writes the index and
   * the payload the merged node needs, and deletes every file it did not
   * write. In this fixture the merged node is main's.
   */
  const regen = (dir: string) => {
    const keep = new Set([name.main, `${name.main}.json`]);
    for (const f of readdirSync(join(dir, P))) if (!keep.has(f)) rmSync(join(dir, P, f));
    writeFileSync(join(dir, P, name.main), body.main);
    writeFileSync(join(dir, P, `${name.main}.json`), sidecar(name.main, body.main));
    writeFileSync(join(dir, IDX), index("main", name.main));
  };

  const onDisk = (dir: string) => (p: string) => existsSync(join(dir, p));

  test("both directories classify as owned-tree, pruned by a writer package.json declares", () => {
    const scripts = scriptsOf(REPO);
    expect(classify(IDX).pattern?.id).toBe("subgraph-index");
    expect(classify("cat-harness/docs/subgraph/index.jsonld").pattern?.id).toBe("subgraph-index");
    expect(classify(`${P}/${name.base}`).pattern?.id).toBe("subgraph-payload");
    expect(classify(`${P}/${name.base}.json`).pattern?.id).toBe("subgraph-payload");
    for (const p of PATTERNS.filter((x) => x.strategy === "owned-tree")) {
      expect(p.prunedBy).toBeDefined();
      expect(scripts[p.prunedBy!]).toBeDefined();
      expect(scripts[`${p.prunedBy!}:check`]).toBeDefined();
    }
    // The navbar's rail data is named by its content hash too (2026-10-06, #2197).
    expect(classify("cat-harness/docs/assets/navbar/rail-1tstgx8dr3c.js").pattern?.id).toBe("navbar-rail-data");
    expect(classify("cat-harness/docs/assets/navbar/navbar.js").strategy).toBe("refuse");
    // `prunedBy` belongs to owned-tree alone.
    expect(PATTERNS.filter((x) => x.prunedBy !== undefined && x.strategy !== "owned-tree")).toEqual([]);
    expect(pathClass(IDX).class).toBe("generated");
    expect(pathClass(`${P}/${name.base}`).class).toBe("generated");
  });

  test("the neighbours stay refused: the authored skill a subgraph is built FROM, and the rest of docs/payload", () => {
    expect(classify("cat-harness/sdlc/skills/sdlc-core/merge-conflict-patterns.md").strategy).toBe("refuse");
    expect(classify("cat-harness/docs/payload/README.txt").strategy).toBe("refuse");
  });

  test("the action reads the parents: base's copy, else the branch's, removed only when neither has it", () => {
    expect(ownedTreeAction(true, true)).toBe("theirs");
    expect(ownedTreeAction(true, false)).toBe("theirs");
    expect(ownedTreeAction(false, true)).toBe("ours");
    expect(ownedTreeAction(false, false)).toBe("delete");
  });

  test("git reports the payload as rename/rename, with marked bytes at the new names", () => {
    const { dir, g, conflicted } = mk();
    try {
      expect(conflicted).toEqual([IDX, `${P}/${name.base}`, `${P}/${name.branch}`, `${P}/${name.main}`].sort());
      expect([...unmergedStages(dir, `${P}/${name.base}`)]).toEqual([1]);
      expect([...unmergedStages(dir, `${P}/${name.branch}`)]).toEqual([2]);
      expect([...unmergedStages(dir, `${P}/${name.main}`)]).toEqual([3]);
      expect(g("show", `:3:${P}/${name.main}`)).toContain("<<<<<<<");
      expect(plan(conflicted).refused).toEqual([]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("the refusal sibling: take-base would drop the branch's payload, and the resolved checkpoint refuses it", () => {
    const { dir, conflicted } = mk();
    try {
      for (const p of conflicted) takeBase(dir, p);
      expect(refusable(droppedInMerge(dir), "resolved", onDisk(dir))).toEqual([{ path: `${P}/${name.branch}`, heldBy: "ours" }]);
      // ...and it wrote marked bytes under main's content-addressed name.
      expect(readFileSync(join(dir, P, name.main), "utf-8")).toContain("<<<<<<<");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("owned-tree completes the merge, passes both #2145 checkpoints, then regenerates", () => {
    const { dir, g, conflicted } = mk();
    try {
      for (const c of plan(conflicted).resolvable) {
        expect(c.strategy).toBe("owned-tree");
        takeOwnedTree(dir, c.path);
      }
      expect(g("diff", "--name-only", "--diff-filter=U")).toBe("");
      // Checkpoint 1: the resolution dropped nothing a parent holds.
      expect(refusable(droppedInMerge(dir), "resolved", onDisk(dir))).toEqual([]);
      // Every kept payload holds the bytes its name hashes: the committed blobs, not marked merges.
      for (const s of ["branch", "main"] as const) {
        const bytes = readFileSync(join(dir, P, name[s]), "utf-8");
        expect(bytes).toBe(body[s]);
        expect(hex(bytes)).toBe(name[s]);
      }
      expect(existsSync(join(dir, P, name.base))).toBe(false);
      expect(readFileSync(join(dir, IDX), "utf-8")).toBe(index("main", name.main));

      // The writer replaces the branch's payload, so the index loses a path the branch added.
      regen(dir);
      g("add", "-A");
      const dropped = droppedInMerge(dir);
      expect(dropped.map((d) => d.path).sort()).toEqual([`${P}/${name.branch}`, `${P}/${name.branch}.json`]);
      // Checkpoint 2: its writer replacing a content-addressed payload is NOT refused...
      expect(refusable(dropped, "staged", onDisk(dir))).toEqual([]);
      // ...though checkpoint 1 would refuse the same drop. That is why there are two.
      expect(refusable(dropped, "resolved", onDisk(dir)).length).toBe(2);
      g("commit", "-q", "--no-edit");
      expect(g("ls-files", P).split("\n").sort()).toEqual([`${P}/${name.main}`, `${P}/${name.main}.json`].sort());
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a payload only the branch has is kept from its commit; an already-resolved path is left alone", () => {
    const { dir } = mk();
    try {
      takeOwnedTree(dir, `${P}/${name.branch}`);
      expect(readFileSync(join(dir, P, name.branch), "utf-8")).toBe(body.branch);
      expect(unmergedStages(dir, `${P}/${name.branch}`).size).toBe(0);
      writeFileSync(join(dir, IDX), "resolved earlier\n");
      execFileSync("git", ["add", "--", IDX], { cwd: dir });
      takeOwnedTree(dir, IDX);
      expect(readFileSync(join(dir, IDX), "utf-8")).toBe("resolved earlier\n");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});

describe("take-base on gitignored-tracked paths without stage-2 error (bean u4up)", () => {
  test("resolves a gitignored-tracked conflict without throwing or stage-2 error", () => {
    const { dir, g } = ignoredTrackedMerge();
    try {
      expect(unmergedStages(dir, "results/x.json")).toEqual(new Set([1, 2, 3]));
      expect(() => takeBase(dir, "results/x.json")).not.toThrow();
      expect(unmergedStages(dir, "results/x.json").size).toBe(0);
      expect(JSON.parse(readFileSync(join(dir, "results/x.json"), "utf-8"))).toEqual({ main: 1 });
      expect(g("diff", "--cached", "--name-only").split("\n")).toContain("results/x.json");
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("modify/delete on a gitignored-tracked path takes base without stage-2 error", () => {
    const dir = mkdtempSync(join(tmpdir(), "merge-base-u4up-"));
    const g = (...a: string[]) => execFileSync("git", a, { cwd: dir, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    try {
      g("init", "-q", "-b", "branch");
      g("config", "user.email", "t@example.invalid");
      g("config", "user.name", "t");
      mkdirSync(join(dir, "results"));
      writeFileSync(join(dir, ".gitignore"), "results/\n");
      writeFileSync(join(dir, "results/x.json"), "{\"base\":1}\n");
      g("add", ".gitignore");
      g("add", "-f", "results/x.json");
      g("commit", "-qm", "init");

      g("checkout", "-q", "-b", "main");
      writeFileSync(join(dir, "results/x.json"), "{\"main\":2}\n");
      g("add", "-f", "results/x.json");
      g("commit", "-qm", "main update");

      g("checkout", "-q", "branch");
      g("rm", "-q", "--", "results/x.json");
      g("commit", "-qm", "branch deleted");

      try { g("merge", "--no-ff", "--no-commit", "main"); } catch { /* expected */ }
      expect(unmergedStages(dir, "results/x.json")).toEqual(new Set([1, 3]));
      expect(() => takeBase(dir, "results/x.json")).not.toThrow();
      expect(unmergedStages(dir, "results/x.json").size).toBe(0);
      expect(JSON.parse(readFileSync(join(dir, "results/x.json"), "utf-8"))).toEqual({ main: 2 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
