#!/usr/bin/env bun
/**
 * Render the `external-schema` graph — which specifications this repository
 * depends on, at which edition, and what in it would move if one bumped.
 *
 * @module cat-harness/scripts/gen-external-schemas-viz
 * @covers external-schema
 *
 * It reads the registry through `external-schemas.ts` (`loadSpecs`, which
 * finds it from the declaration and refuses a malformed record;
 * `undeclaredNamespaces` and `unusedNamespaces`), never with its own reader,
 * so it cannot render a record the checker never validated.
 *
 * It adds who DECLARES each specification — the blast radius of a version
 * bump. Each user declares the spec (`scripts/spec-users.ts`): a
 * `@conformsTo` tag, a `conformsTo:` front-matter list, an `xmlns` binding, or
 * — for a graph kind's files — the declaration of the module that types them.
 * A declaration naming a spec no record has is a finding.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/gen-external-schemas-viz.ts
 *   bun run cat-harness-tools/scripts/gen-external-schemas-viz.ts --check
 */
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";

import { baseDocsDir } from "./compose-docs.js";
import {
  jsonLdNamespacesInUse,
  loadSpecs,
  namespaceMentions,
  namespacesInUse,
} from "./external-schemas.js";
import { OWN_XML_NAMESPACES } from "../schemas/kg/namespaces.js";
import { specUsers, type SpecUse, type SpecUseForm, type SpecUsers } from "./spec-users.js";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import { BASE_GRAPH_TYPOLOGIES, defaultGraphTypologies } from "../schemas/kg/graph-typology-registry.js";
import {
  undeclaredNamespaces,
  unusedNamespaces,
  type ExternalSchema,
} from "../schemas/kg/external-schema.js";
import { checkoutInstanceRoots, pageParts, visualiserFor, visualiserPageDir, visualiserSitePath, withRenderedByFrontMatter } from "./viewer-declarations.js";
import { readDeclaration, siteDirFor, sourceLinks } from "../schemas/kg/cat-harness.ts";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.js";
import { detectRepoUrl } from "../src/core/git-refs.js";
import { darkRules } from "./lib/scheme-css.js";
import { HARNESS_ROOT, REPO_ROOT } from "./lib/roots.ts";
import { declaredDirectory, localSiteDir } from "./lib/local-site-dir.ts";
import { siteTarget } from "./lib/site-target.ts";

/** This generator's Tool node (`tools/viewers.ts`), named on every page it draws. */
const VIEWER_TOOL = "external-schemas-viewer";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
// The checkout holding the harness and this layer (`REPO_ROOT`), not a guess
// three levels up: `../../../cat-harness` matched ANY directory of that name
// above the checkout (a sibling clone in a scratch directory), and the page
// then counted the uses of a different tree — 0 of 281 here.
const REPO = existsSync(join(INSTANCE_ROOT, "cat-harness"))
  ? INSTANCE_ROOT
  : REPO_ROOT ?? resolve(INSTANCE_ROOT, "..");

/** The graph typology this renders. A KIND, never a path. */
const KIND = "external-schema";

/** Every declared user of every spec, read from the users (bean `u63y`). */
export function declaredUsers(specs: readonly ExternalSchema[], repoRoot = REPO): SpecUsers {
  // The checkout's corpus, mounts included. A bare `git ls-files` listed only
  // what the checkout's own git tracks; in the index checkout every layer
  // is a remote mount that git ignores, so no declaration was found and every
  // specification read as unused.
  const files = (gitCorpus(repoRoot) ?? []).map((f) => relative(repoRoot, f).split(sep).join("/")).sort();
  // BASE's kinds, read THROUGH the registry: since bean riit (step 1c) a
  // kind's validator refs are `validators/` nodes the registry joins on, so
  // the code list alone carries none and the `kind` form would vanish.
  const joined = Object.fromEntries(
    Object.keys(BASE_GRAPH_TYPOLOGIES).flatMap((k) => {
      const def = defaultGraphTypologies.get(k);
      return def ? [[k, def]] : [];
    }),
  );
  const targetRoot = existsSync(join(repoRoot, "cat-harness", "schemas"))
    ? repoRoot
    : declaredDirectory(repoRoot, "schemas") !== undefined
    ? repoRoot
    : INSTANCE_ROOT;
  const kindsInstance = existsSync(join(targetRoot, "cat-harness")) ? "cat-harness" : ".";
  return specUsers(targetRoot, files, specs, joined, kindsInstance);
}

/**
 * Where the page goes: the declared directory's own name (#1168 B7a-2b,
 * `conventionalPage`). Never a literal — `site-dir-single-answer` refuses one.
 */
export function pageRelPath(repo = REPO): string | undefined {
  // The route cat-harness DECLARES for this Tool's visualiser (owner,
  // 2026-10-09): `<locale>/<harness>/<id>/index.md`, never chosen here.
  try {
    const handlerRoot = existsSync(join(repo, "cat-harness")) ? join(repo, "cat-harness") : INSTANCE_ROOT;
    return visualiserSitePath(handlerRoot, VIEWER_TOOL).rel;
  } catch {
    return undefined;
  }
}

/** The base docs layer — the same answer `compose-docs.ts` uses. */

const DARK_TAG_RULES = darkRules(
  ".xs-ok { color: #34d399; } .xs-na { color: #a1a1aa; } .xs-missing { color: #f87171; }",
);

const CSS = `
h2, h3 { scroll-margin-top: 2rem; }
.xs-tag{display:inline-block;padding:.05rem .4rem;border-radius:3px;font-size:.72rem;
  font-weight:600;white-space:nowrap;border:1px solid currentColor}
.xs-ok{color:#0d6e5e}
.xs-na{color:#5b5f66}
.xs-missing{color:#a8200f}
${DARK_TAG_RULES}
.table-wrapper{position:relative;overflow-x:auto;-webkit-overflow-scrolling:touch;
  mask-image:linear-gradient(to right,black calc(100% - 2rem),transparent 100%);
  -webkit-mask-image:linear-gradient(to right,black calc(100% - 2rem),transparent 100%)}
.xs-scroll-cue{display:none;font-size:.75rem;opacity:.75;margin:-.5rem 0 .75rem;font-style:italic}
@media (max-width: 640px){.xs-scroll-cue{display:block}}
.xs-grid{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0}
.xs-stat{flex:1 1 8rem;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:.5rem .7rem}
.xs-stat b{display:block;font-size:1.25rem;line-height:1.2}
.xs-stat span{font-size:.75rem;opacity:.75}
`;

/** How a user declared the spec, in words. */
const FORM: Record<SpecUseForm, string> = {
  tag: "`@conformsTo` tag",
  "front-matter": "`conformsTo:` front matter",
  xmlns: "`xmlns` binding",
  kind: "through the module that types it",
};

/** What each `use` value claims, in one line, so the column is readable. */
const USE_MEANS: Record<string, string> = {
  conforms: "this repository's artefacts are valid against it",
  reads: "this repository parses documents written in it",
  cites: "it is referenced, and nothing here is validated against it",
};

/**
 * One row per `xmlns` directory rather than per diagram — `processes/*.bpmn`
 * is how a reader thinks of 70 files that all bind BPMN — and the rest as-is.
 */
function collapse(uses: readonly SpecUse[]): SpecUse[] {
  const out: SpecUse[] = [];
  const dirs = new Map<string, number>();
  for (const u of uses) {
    if (u.form !== "xmlns") {
      out.push(u);
      continue;
    }
    const dir = u.user.slice(0, u.user.lastIndexOf("/") + 1);
    const ext = u.user.slice(u.user.lastIndexOf("."));
    const key = `${dir}*${ext}`;
    dirs.set(key, (dirs.get(key) ?? 0) + 1);
  }
  for (const [glob, n] of [...dirs].sort()) out.push({ spec: "", user: `${glob} (${n})`, form: "xmlns" });
  return out.sort((a, b) => a.user.localeCompare(b.user));
}

function cell(v: string): string {
  return v.replace(/[\\|]/g, "\\$&").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * `fileHref`, when given, turns a dependent's repository path into a link to
 * that file (bean `qgjh`: references are links wherever the target resolves).
 * It returns `undefined` for a path that is not a file here, which stays code.
 */
export function page(
  specs: readonly ExternalSchema[],
  users: SpecUsers,
  inUse: readonly string[],
  fileHref: (repoPath: string) => string | undefined = () => undefined,
  broaderInUse: readonly string[] = [],
  /**
   * Set for ONE LAYER'S page (`<route>/instance/<name>/`): that layer's
   * own records, under its own title. The namespace reconciliation is left
   * out there and linked to instead. It compares the corpus against the
   * REGISTRY, so over a single layer's records it would report every
   * namespace the corpus uses as undeclared.
   */
  subject?: { instance: string; title: string; directory: string; fullHref: string },
): string {
  const userCell = (u: string): string => {
    const h = fileHref(u);
    return h === undefined ? `\`${cell(u)}\`` : `[\`${cell(u)}\`](${h})`;
  };
  const allInUse = [...new Set([...inUse, ...broaderInUse])].sort();
  // One row per user and spec; a `.bpmn` per diagram would bury the rest, so
  // `xmlns` users are counted per directory.
  const bySpec = new Map<string, SpecUse[]>();
  for (const u of users.uses) bySpec.set(u.spec, [...(bySpec.get(u.spec) ?? []), u]);
  const undeclaredSpecs = specs.filter((s) => !bySpec.has(s.id));
  const undeclared = undeclaredNamespaces(allInUse, specs);
  const unreg = unusedNamespaces(allInUse, specs);
  const mentioned = namespaceMentions(unreg);
  const unused = unreg.filter((ns) => !mentioned.has(ns));
  const terms = specs.reduce((n, s) => n + s.terms.length, 0);
  const describedCount = specs.flatMap((s) => s.terms).filter((t) => !t.operative.includes("not yet described")).length;
  const pendingCount = terms - describedCount;
  const termsLabel = pendingCount > 0 ? `operative terms in graph (${describedCount} described, ${pendingCount} pending)` : `operative terms in graph`;

  const b: string[] = [
    "---",
    ...(subject
      ? [
          `title: ${JSON.stringify(`External schemas — ${subject.title}`)}`,
          `description: ${JSON.stringify(`The specifications ${subject.title} declares in its own external-schema directory: the edition of each, what would move if one bumped, and the terms it branches on.`)}`,
          "generated: gen-external-schemas-viz.ts, built at publish — never committed",
          "nav_exclude: true",
        ]
      : [
          'title: "External schemas"',
          'description: "The specifications this repository depends on — the edition of each, what would move if one bumped, and the terms it actually branches on."',
          "generated: gen-external-schemas-viz.ts — do not hand-edit; run `bun run cat external-schemas:viz`",
        ]),
    "---",
    `<style>${CSS}</style>`,
    "",
    ...(subject
      ? [
          `The records **${cell(subject.title)}** (\`${cell(subject.instance)}\`) holds in \`${cell(subject.directory)}\`, read at this build's pins. ` +
            `The platform's own registry, and the namespaces the whole corpus uses compared against it, are on [the full page](${subject.fullHref}).`,
          "",
        ]
      : []),
    "A specification here is **referenced, not held**: the edition is named and",
    "the terms this repository actually acts on are materialised into the graph,",
    "but the document itself stays at the authority. That split is the owner's:",
    "*\"dont need to materalize, but should reference specific version being",
    'used"*, and *"some schema that is operational should be in KG"*.',
    "",
    "So each record answers three questions — **which edition**, **what here",
    "depends on it**, and **which of its terms this repository branches on**.",
    "",
    '<div class="xs-grid">',
    `<div class="xs-stat"><b>${specs.length}</b><span>specifications</span></div>`,
    `<div class="xs-stat"><b>${terms}</b><span>${termsLabel}</span></div>`,
    `<div class="xs-stat"><b>${users.uses.length}</b><span>declared uses</span></div>`,
    `<div class="xs-stat"><b>${users.unknown.length}</b><span>declarations naming no record</span></div>`,
    "</div>",
    "",
    "## The specifications",
    "",
    '<p class="xs-scroll-cue" role="note" aria-hidden="true">Scroll table horizontally to view all columns &rarr;</p>',
    "",
    "| specification | authority | edition | how it is used |",
    "|---|---|---|---|",
  ];

  for (const s of specs) {
    b.push(
      `| **[${cell(s.title)}](#${s.id})**<br>\`${cell(s.id)}\` | ${cell(s.authority)} | ` +
        `[${cell(s.version)}](${s.specUrl}) | \`${cell(s.use)}\` — ${cell(USE_MEANS[s.use] ?? "")} |`,
    );
  }

  b.push(
    "",
    "## Who declares each specification",
    "",
    "A user declares the specification it depends on; the record names no user.",
    "That is data-modelling step 8 — the dependent holds the pointer — and it is",
    "why this list cannot drift from the code: a file that stops declaring stops",
    "being listed. Four forms are read: a `@conformsTo` tag, a `conformsTo:`",
    "front-matter list, an `xmlns` binding, and a graph typology whose typing module",
    "declares the spec (bean `u63y`).",
    "",
  );
  if (users.unknown.length > 0) {
    b.push(
      `**${users.unknown.length} declaration(s) name a specification no record has.**`,
      "",
      "| user | names |",
      "|---|---|",
      ...users.unknown.map((u) => `| \`${cell(u.user)}\` | \`${cell(u.spec)}\` |`),
      "",
    );
  } else {
    b.push("Every declaration names a record on this page.", "");
  }
  if (undeclaredSpecs.length > 0) {
    b.push(
      `**${undeclaredSpecs.length} record(s) nothing declares.** A version bump would move nothing that says so:`,
      "",
      ...undeclaredSpecs.map((s) => `- [\`${cell(s.id)}\`](#${s.id})`),
      "",
    );
  }

  // Reported either way. "Nothing undeclared" and "the reconciliation did not
  // run" are different facts, and a section that appeared only on a finding
  // could not tell them apart.
  if (!subject) b.push("## Namespaces the corpus uses against the ones it declares", "");
  if (!subject) b.push(
    `Read from diagram files (BPMN and DMN), metadata records, and JSON-LD contexts — **${allInUse.length}** namespace IRI(s)`,
    "are in use across the corpus. Derived rather than listed, so an artefact that adopts a new",
    "vocabulary shows up here instead of going unnoticed.",
    "",
  );
  if (subject) {
    // The reconciliation is the registry's (see `subject`), so it is not drawn here.
  } else if (undeclared.length === 0) {
    b.push("Every namespace the corpus declares is covered by a record above.", "");
  } else {
    b.push(
      `**${undeclared.length} in use and not declared here** — a vocabulary this`,
      "repository writes and has said nothing about.",
      "",
      ...undeclared.map((n) => `- \`${cell(n)}\``),
      "",
    );
  }
  if (!subject && unused.length > 0) {
    b.push(
      `**${unused.length} declared and not in use.** Not a defect on its own: a`,
      "record may cover a namespace only some artefacts carry. It is here because",
      "a registry nobody prunes is one that stops describing the repository.",
      "",
      ...unused.map((n) => `- \`${cell(n)}\``),
      "",
    );
  }

  b.push("## Each specification", "");
  for (const s of specs) {
    const rows = collapse(bySpec.get(s.id) ?? []);
    b.push(
      // The record id IS the heading's id (kramdown `{#…}`), one element. A
      // separate `<a id>` beside the heading collided with kramdown's own slug
      // whenever a title slugified to its id: "HL7 FHIR" -> `hl7-fhir`, twice
      // on one page. `check:duplicate-ids` caught it on the staged site
      // (bean `uknu`); the other records only escaped by their wording.
      `### ${cell(s.title)} {#${s.id}}`,
      "",
      `\`${cell(s.id)}\` — ${cell(s.authority)}, edition [${cell(s.version)}](${s.specUrl}) — ` +
        `\`${cell(s.use)}\`, meaning ${cell(USE_MEANS[s.use] ?? "")}.`,
      "",
      "**Namespaces.**",
      "",
      ...s.namespaces.map((n) => `- \`${cell(n)}\``),
      "",
    );
    if (s.note) {
      const paras = s.note
        .split(/\n\s*\n/)
        .map((p) => p.replace(/[\\|]/g, "\\$&").trim())
        .filter(Boolean);
      if (paras.length > 0) {
        b.push(`**Note.** ${paras[0]}`, "");
        for (const p of paras.slice(1)) {
          b.push(p, "");
        }
      }
    }

    if (rows.length === 0) {
      b.push("**What depends on it.** Nothing here declares it.", "");
    } else {
      b.push("**What depends on it.**", "", "| user | declared by |", "|---|---|");
      for (const r of rows) b.push(`| ${userCell(r.user)} | ${FORM[r.form]}${r.via ? ` (${userCell(r.via)})` : ""} |`);
      b.push("");
    }

    if (s.terms.length === 0) {
      // A DETERMINED ZERO, said as one. `omg-dd-1.0` declares no operative
      // terms because this repository conforms to DD without branching on any
      // of its elements — which is a different fact from a record nobody has
      // filled in, and an empty table would render them alike.
      b.push(
        "**No operative terms.** This repository conforms to the specification",
        "without branching on any of its terms, so none is materialised into the",
        "graph. That is a determined zero, not an unfilled field.",
        "",
      );
    } else {
      const pendingInSpec = s.terms.filter((t) => t.operative.includes("not yet described")).length;
      b.push(
        `**Operative terms (${s.terms.length}).** The terms this repository acts on —`,
        "derived by the tooling from the corpus, never hand-listed, and deliberately",
        "a subset of the edition rather than a transcription of it.",
        "",
      );
      if (pendingInSpec === s.terms.length) {
        b.push(
          "*All terms below are derived from the corpus; operational semantics are pending individual per-term descriptions.*",
          "",
        );
      } else if (pendingInSpec > 0) {
        b.push(
          "*Terms marked pending description are derived from the corpus and await detailed operational description.*",
          "",
        );
      }
      b.push(
        "| term | what it means here |",
        "|---|---|",
        ...s.terms.map((t) => {
          const meaning = t.operative.includes("not yet described") ? "*(pending description)*" : t.operative;
          return `| \`${cell(t.term)}\` | ${cell(meaning)} |`;
        }),
        "",
      );
    }
  }

  return b.join("\n").trimEnd() + "\n";
}

/**
 * The pages the visualiser's `instance` sub-graph owes: one per OTHER
 * layer in the checkout that declares an `external-schema` directory, at
 * `<route>/<subgraphUnder>/<instance>/index.md`, holding that layer's own
 * records. The harness's own directory is the full page and gets none.
 *
 * Built at publish (the harness's `builtAtPublish`): each reads a layer above
 * the harness at the checkout's pins, so no commit of the harness can hold one
 * current. `--check` therefore judges only the committed full page.
 *
 * Empty when the visualiser declares no `subgraphs: "instance"`.
 */
export function instancePages(repo: string, docsBase: string, fileHref: (repoPath: string) => string | undefined = () => undefined): { pages: Map<string, string>; under?: string } {
  const pages = new Map<string, string>();
  const handlerRoot = existsSync(join(repo, "cat-harness")) ? join(repo, "cat-harness") : INSTANCE_ROOT;
  let v;
  try {
    v = visualiserFor(handlerRoot, VIEWER_TOOL);
  } catch {
    return { pages };
  }
  if (v.subgraphs !== "instance") return { pages };
  const under = v.subgraphUnder?.[KIND];
  const full = pageParts({ harness: v.harness, visualiser: v.id });
  for (const root of checkoutInstanceRoots(repo)) {
    const decl = readDeclaration(root);
    if (decl === undefined || decl.name === v.harness) continue;
    const dirs = (decl.directories ?? []).filter((d) => (d.graphTypologies ?? []).includes(KIND) && typeof d.path === "string");
    if (dirs.length === 0) continue;
    const specs = dirs.flatMap((d) => loadSpecs(join(root, d.path!)));
    const sub = under ? `${under}/${decl.name}` : decl.name;
    const depth = sub.split("/").length;
    const directory = dirs.map((d) => relative(repo, join(root, d.path!)).split(sep).join("/")).join(", ");
    const text = page(specs, declaredUsers(specs, repo), [], fileHref, [], {
      instance: decl.name,
      title: decl.title ?? decl.name,
      directory,
      fullHref: "../".repeat(depth),
    });
    pages.set(join(visualiserPageDir(docsBase, { ...full, subgraph: sub }), "index.md"), withRenderedByFrontMatter(text, VIEWER_TOOL));
  }
  return { pages, ...(under ? { under: visualiserPageDir(docsBase, { ...full, subgraph: under }) } : {}) };
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const specs = loadSpecs();

  if (specs.length === 0) {
    // The third state above the page's own three: the registry was not found
    // or is empty. Refuse rather than publish a page that says zero, which is
    // what a graph nobody located looks like from the outside.
    console.error("::error::gen-external-schemas-viz: the external-schema registry yielded no records");
    process.exit(2);
  }

  const PAGE = pageRelPath(REPO);
  if (PAGE === undefined) {
    console.error(`::error::gen-external-schemas-viz: no visualiser declared for graph typology '${KIND}'`);
    process.exit(1);
  }

  const users = declaredUsers(specs);
  // The page says which directories it draws (#1168 B7a-2).
  // A dependent links to its file on the repository host, and only when that
  // file exists here: a directory or a path gone since stays code.
  const targetRoot = INSTANCE_ROOT;
  const repoUrl = detectRepoUrl(targetRoot);
  const fileHref = (repoPath: string): string | undefined => {
    const abs = join(targetRoot, repoPath);
    return existsSync(abs) && statSync(abs).isFile() ? sourceLinks(repoUrl, repoPath, "main")?.viewHref : undefined;
  };
  const bpmnInUse = namespacesInUse();
  const jsonLd = jsonLdNamespacesInUse();
  const externalBpmn = bpmnInUse.filter((ns) => !(OWN_XML_NAMESPACES as readonly string[]).includes(ns));
  const combined = [...new Set([...externalBpmn, ...jsonLd.keys()])].sort();
  const unreg = unusedNamespaces(combined, specs);
  const mentioned = namespaceMentions(unreg);
  const inUse = [...new Set([...combined, ...mentioned])].sort();

  const rendered = withRenderedByFrontMatter(
    page(specs, users, inUse, fileHref),
    VIEWER_TOOL,
  );
  const docsBase = siteTarget(localSiteDir(INSTANCE_ROOT) ?? baseDocsDir(REPO));
  const out = join(docsBase, PAGE);

  // BUILT AT PUBLISH (owner, 2026-10-14, "B1"). The page lists every
  // declared user of every specification in the CHECKOUT (`declaredUsers`
  // reads the whole corpus, mounts included), so it moves with the index's
  // pins: a layer above adding one BPMN file made cat-harness's committed page
  // stale. When the layer declares the route
  // `builtAtPublish` with this script as its writer, `derive:publish` runs it
  // and `--check` has no committed bytes to compare (the `methodologies:viz`
  // rule).
  const builtHere = isBuiltAtPublish(
    readDeclaration(INSTANCE_ROOT)?.builtAtPublish ?? [],
    posix.join(siteDirFor(INSTANCE_ROOT), PAGE),
  );

  if (check && builtHere) {
    console.log(
      `✓ external-schemas viewer: ${PAGE} is built at publish (builtAtPublish), not committed — nothing to compare; \`bun run cat external-schemas:viz\` writes it`,
    );
  } else if (check) {
    const current = existsSync(out) ? readFileSync(out, "utf-8") : "";
    if (current !== rendered) {
      console.error(
        `::error::gen-external-schemas-viz: ${PAGE} is stale — run \`bun run cat external-schemas:viz\``,
      );
      process.exit(1);
    }
    console.log(`✓ external-schemas viewer is current — ${specs.length} specification(s); per-instance pages are built at publish and not judged here`);
  } else {
    mkdirSync(join(out, ".."), { recursive: true });
    writeFileSync(out, rendered);
    console.log(`external-schemas viewer: ${specs.length} specification(s) → ${PAGE}`);
    console.log(`  ${users.uses.length} declared use(s), ${users.unknown.length} naming no record`);
    const inst = instancePages(REPO, docsBase, fileHref);
    if (inst.under !== undefined) rmSync(inst.under, { recursive: true, force: true });
    for (const [p, text] of inst.pages) {
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, text);
      console.log(`  instance page → ${relative(docsBase, p)}`);
    }
  }
}
