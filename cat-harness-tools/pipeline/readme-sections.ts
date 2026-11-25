#!/usr/bin/env bun
/**
 * readme-sections.ts — generated README sections, injected only where the
 * folio asked for them.
 *
 * ## What this replaces, and why it is not a smaller change
 *
 * `scripts/generate-readme.sh` assembled a whole README and ended in
 * `cp "$OUT" README.md`. What it assembled was one folio's content held in
 * the platform: the title `# Quantum Observable Universe`, three
 * `litlfred/qou` CI badges, a Knot Registry of Alexander-Briggs indices, a
 * Project Structure table naming `content/quantum-observable-universe/lean/`,
 * a Published Artefacts table of `litlfred.github.io/qou` URLs, and a CC BY
 * 4.0 licence block. Run it in any other folio and the author loses their
 * README and gains that one.
 *
 * Only a handful of its sections were actually *derived from the tree* — the
 * contents table, Lean coverage, Lean modules, the simulator list, the
 * workflow list. The rest was prose, and prose about a folio belongs to that
 * folio. So the fix is not to parameterise the prose; it is to stop the
 * platform owning the file. Each generated section is delimited by its own
 * marker pair, and a section is written **only where its markers already
 * appear**. A folio opts in by adding them. There is no code path that
 * touches a byte outside a marked region, which is the property the
 * predecessor could not have.
 *
 * ## Adding a section
 *
 * Append to {@link SECTIONS}: a marker name, a one-line summary for
 * `--list`, and a renderer. A renderer returns Markdown plus any notes worth
 * printing to the operator — "this folio has no simulators" is a note, not an
 * empty table. Nothing else needs touching; the CLI, the MCP tool and the
 * staleness check all read the registry.
 *
 * Lean sections live here rather than in a paper-only module because the
 * registry is one list and a document folio simply never carries their
 * markers. They render nothing and cost nothing where Lean is absent.
 *
 * @module pipeline/readme-sections
 * @covers docs
 */

import { folioDir } from "../schemas/kg/cat-harness.js";
import { mountScopeFor } from "../schemas/kg/remote-mount.js";
import { isBuiltAtPublish } from "../schemas/kg/built-at-publish.ts";
import { spawnSync } from "child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { basename, dirname, join, relative, resolve } from "path";

/**
 * Is `dir` the root of a git submodule? A submodule's `.git` is a FILE (a
 * `gitdir:` pointer), a checkout's own is a directory — the one marker that
 * holds whether or not the submodule has been initialised with history.
 */
export function isSubmoduleRoot(dir: string): boolean {
  const git = join(dir, ".git");
  return existsSync(git) && statSync(git).isFile();
}

/**
 * Does another repository own `dir`'s bytes — a submodule, or a REMOTE MOUNT,
 * the submodule's successor (bean `nn8e`, #2462)? A mount has no `.git` of
 * its own; the lock that laid it down is what says so.
 */
export function isForeignRoot(dir: string): boolean {
  return isSubmoduleRoot(dir) || mountScopeFor(dir) !== undefined;
}

import { discoverPapers, injectSection, loadReadmeConfig, renderToc, type ReadmeTocConfig } from "./readme-toc";
import { findContentRepoRoot } from "./repo-root";
import { optionalPipelinePlugin } from "./pipeline-plugins";
import { readEffectiveConfig } from "../schemas/kg/harness-config.ts";
import { AGENT_INSTRUCTIONS_ROLE, assetRolePurpose, INSTANCE_README_ROLE, declaredAssetPath, layerRootsIn, readDeclaration, workPlanGraphsIn } from "../schemas/kg/cat-harness.ts";
import { generatedBanner } from "@litlfred/bootstrap-tools/scripts/generated-by.ts";
import { frontMatter, nodeSummary } from "../scripts/front-matter.ts";
import { isSkillMd, skillMdDirs } from "../scripts/known-skills.ts";
import { groupOf, optInRootsOf, switchedOffGroups } from "../schemas/kg/opt-in-roots.ts";
import { committedSkillIndex, type CommittedSkillPackage } from "../scripts/lib/switched-off-skills.ts";
import { filesSection, processesSection, rolesSection } from "@litlfred/bootstrap-tools/scripts/readme-graph-sections.ts";

// ── Section contract ────────────────────────────────────────────────────────

export interface SectionContext {
  root: string;
  cfg: ReadmeTocConfig;
  /** Fetch the publish ref when it is missing locally. Only the TOC uses it. */
  fetch: boolean;
  /**
   * Lean coverage statistics, when the science layer is installed.
   *
   * Resolved ONCE by {@link runReadmeSync} and passed in, rather than imported
   * at the top of this file. The registry is deliberately one list — see the
   * module header — but `computeStats` lives in the science layer, so
   * importing it here made the GENERIC section registry depend on it, and a
   * folio without that layer must still be able to sync its TOC.
   *
   * `undefined` means NOT INSTALLED, which the coverage section reports
   * through {@link undetermined} — leaving whatever the README already has,
   * rather than replacing a correct table with "no Lean found".
   */
  leanCoverage?: LeanCoverageStats;
  /**
   * The README being synced, as it stands when this section renders — with
   * every section registered BEFORE it already injected.
   *
   * Only `readme:toc` reads it: a table of the README's own headings is the
   * one section whose input is the file itself. Supplied by
   * {@link syncSections}; `undefined` when a caller renders a section on its
   * own, which the TOC reports as undetermined rather than as a README with
   * no headings.
   */
  readme?: string;
  /**
   * The most bytes the file being synced may hold, when it has a reader that
   * stops reading (an AGENTS.md: {@link AGENTS_MD_BYTE_BUDGET}). Only the skill
   * index reads it. `undefined` means no budget.
   */
  byteBudget?: number;
}

/**
 * What {@link SectionContext.leanCoverage} provides, if anything does.
 *
 * The shape is written out here rather than imported from the science layer,
 * because `import type` is still an import as far as the repository partition
 * is concerned — it is what a consumer must be able to read WITHOUT that layer
 * installed. It is the subset this section renders, not the whole `Stats`
 * record: `computeStats` also returns `paper`, `generated_at`, `total_blocks`
 * and `by_kind`, which the table does not show and this contract therefore
 * does not demand.
 */
export type LeanCoverageStats = (
  paperDir: string,
  folioRoot: string,
) => {
  provable: { total: number; with_lean_file: number; sorry_free: number; percent_sorry_free: number };
  conjectures: { total: number; with_lean_file: number; class_axiomatized: number; percent_class_axiomatized: number };
  definitions: { total: number; with_lean_file: number };
};

export interface SectionOutput {
  markdown: string;
  /** Operator-facing remarks: what was empty, what could not be read. */
  notes: string[];
  /**
   * "I could not determine this" — leave whatever the README already has.
   *
   * Distinct from an empty result, and the distinction is the whole point.
   * The folio this was built against configured its simulators under
   * `folio-assistant/simulators`, a directory that only existed once the
   * platform submodule was checked out. In a clone without it, "the directory
   * is not there" was rendered as "this folio has no simulators", and a
   * correct nine-row table was replaced by a sentence saying it did not
   * exist. Same rule as the TOC's unreadable publish ref: not-looked-at is
   * never reported as nothing-found.
   *
   * That folio now owns its simulators outright, so the submodule case is
   * gone — but a configured directory can be absent for other reasons (a
   * sparse or partial checkout, a folio mid-migration), and this state is
   * what keeps any of them from being reported as "no simulators".
   */
  skip?: boolean;
}

export interface ReadmeSection {
  /** Marker name; the README carries `<!-- <marker>:begin -->` … `:end`. */
  marker: string;
  /** One line, shown by `--list`. */
  summary: string;
  render(ctx: SectionContext): SectionOutput;
}

/** Escape the cell separator so a title containing `|` cannot break a table. */

/** Does the checkout at `repo` track anything under `rel`? Independent of what is mounted. */
function trackedByCheckout(repo: string, rel: string): boolean {
  // input-site: tree #61aef05a — what this checkout's index tracks under a path: git's answer, which the cone replays
  const r = spawnSync("git", ["ls-files", "--", rel], { cwd: repo, encoding: "utf-8" });
  return r.status === 0 && r.stdout.trim() !== "";
}

function cell(text: string): string {
  return text.replace(/[\\|]/g, "\\$&");
}

/** An italic line standing in for a table with no rows — a determined answer. */
function empty(what: string): SectionOutput {
  return { markdown: `_No ${what} in this folio._\n`, notes: [`no ${what} found`] };
}

/** An undetermined answer: keep whatever the README already shows. */
function undetermined(why: string): SectionOutput {
  return { markdown: "", notes: [`left unchanged — ${why}`], skip: true };
}

// ── Lean helpers ────────────────────────────────────────────────────────────

/**
 * A paper's Lake library name, for prefixing module names.
 *
 * Read from the paper's `lakefile.toml`, because the predecessor hardcoded
 * `QOU.` and stamped it onto the modules of every folio. When no lakefile
 * names a library, modules are listed **unprefixed** rather than under an
 * invented namespace: a wrong namespace is a worse answer than none, since it
 * is the string a reader would paste into an `import`.
 */
export function leanLibName(root: string, paper: string): string | undefined {
  for (const candidate of [
    join(folioDir(root),  paper, "lean", "lakefile.toml"),
    join(folioDir(root),  paper, "lakefile.toml"),
  ]) {
    if (!existsSync(candidate)) continue;
    const src = readFileSync(candidate, "utf-8");
    const name = src.match(/\[\[lean_lib\]\][\s\S]*?name\s*=\s*"([^"]+)"/)?.[1];
    if (name) return name;
  }
  return undefined;
}

/** The directory holding a paper's Lean sources, if it has one. */
function leanDir(root: string, paper: string): string | undefined {
  const dir = join(folioDir(root),  paper, "lean");
  return existsSync(dir) ? dir : undefined;
}

/** Papers that carry Lean sources. Empty in a document folio. */
function papersWithLean(root: string): { dir: string; title: string; lean: string }[] {
  return discoverPapers(root)
    .map((p) => ({ ...p, lean: leanDir(root, p.dir) }))
    .filter((p): p is { dir: string; title: string; lean: string } => p.lean !== undefined);
}

// ── The sections ────────────────────────────────────────────────────────────

const tocSection: ReadmeSection = {
  marker: "folio:toc",
  summary: "One chapter table per paper, with publish-ref-verified PDF links.",
  render({ root, cfg, fetch }) {
    const toc = renderToc(root, cfg, fetch);
    const notes: string[] = [];
    if (toc.publishRefUnavailable) {
      notes.push(
        `publish ref '${cfg.publishRef}' not readable here — PDF column omitted. ` +
          `Re-run with --fetch, or: git fetch --depth 1 origin ` +
          `${cfg.publishRef}:refs/remotes/origin/${cfg.publishRef}`,
      );
    } else if (toc.missingPdfs.length > 0) {
      notes.push(
        `${toc.missingPdfs.length} chapter(s) have no published PDF and render '—': ` +
          toc.missingPdfs.map((m) => `${m.paper}/${m.chapter}`).join(", "),
      );
    }
    return { markdown: toc.markdown, notes };
  },
};

const leanCoverageSection: ReadmeSection = {
  marker: "folio:lean-coverage",
  summary: "Formalisation coverage per paper: provable claims, conjectures, definitions.",
  render({ root, leanCoverage }) {
    // No science layer, no coverage — and NOT an empty table. An absent
    // toolchain is "could not determine", so a README already carrying a
    // correct table keeps it. Exactly the distinction this file was written
    // around: an empty directory is a determined empty; a missing one is not.
    if (!leanCoverage) return undetermined("the science layer is not installed here");
    const papers = papersWithLean(root);
    if (papers.length === 0) return empty("papers with Lean sources");

    const folioRoot = folioDir(root);
    const rows: string[] = [];
    const notes: string[] = [];
    for (const paper of papers) {
      let stats;
      try {
        stats = leanCoverage(paper.dir, folioRoot);
      } catch (e) {
        // A paper whose stats will not compute is named, not skipped: a table
        // silently missing a row reads as a paper with no Lean at all.
        notes.push(`${paper.dir}: coverage unavailable (${e instanceof Error ? e.message : e})`);
        rows.push(`| ${cell(paper.title)} | _coverage unavailable_ | — | — | — |`);
        continue;
      }
      const p = stats.provable;
      const c = stats.conjectures;
      const d = stats.definitions;
      rows.push(
        `| ${cell(paper.title)} | Provable claims | ${p.total} | ${p.with_lean_file} | ` +
          `**${p.sorry_free} sorry-free (${p.percent_sorry_free}%)** |`,
        `| | Conjectures (open) | ${c.total} | ${c.with_lean_file} | ` +
          `**${c.class_axiomatized} class-axiomatised (${c.percent_class_axiomatized}%)** |`,
        `| | Definitions | ${d.total} | ${d.with_lean_file} | — |`,
      );
    }

    return {
      markdown:
        ["| Paper | Block kind | Total | With Lean sibling | Fully formalized |",
         "|-------|------------|------:|------------------:|-----------------:|",
         ...rows].join("\n") + "\n",
      notes,
    };
  },
};

const leanModulesSection: ReadmeSection = {
  marker: "folio:lean-modules",
  summary: "Lean modules per paper, namespaced by the paper's Lake library.",
  render({ root }) {
    const papers = papersWithLean(root);
    if (papers.length === 0) return empty("papers with Lean sources");

    const out: string[] = [];
    const notes: string[] = [];
    for (const paper of papers) {
      const lib = leanLibName(root, paper.dir);
      if (!lib) notes.push(`${paper.dir}: no [[lean_lib]] in a lakefile — modules listed unprefixed`);
      const prefix = lib ? `${lib}.` : "";
      const libDir = lib && existsSync(join(paper.lean, lib)) ? join(paper.lean, lib) : paper.lean;

      const entries = readdirSync(libDir, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile() && e.name.endsWith(".lean"))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
      const subdirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));

      if (papers.length > 1) out.push(`**${paper.title}**`, "");
      if (files.length === 0 && subdirs.length === 0) {
        out.push(`_No Lean modules under \`${lib ?? "lean"}/\`._`, "");
        continue;
      }
      out.push("| Module | Source |", "|--------|--------|");
      for (const f of files) out.push(`| \`${prefix}${basename(f, ".lean")}\` | \`${f}\` |`);
      for (const d of subdirs) {
        const count = readdirSync(join(libDir, d)).filter((f) => f.endsWith(".lean")).length;
        out.push(`| \`${prefix}${d}.*\` | \`${count} files\` |`);
      }
      out.push("");
    }
    return { markdown: out.join("\n").trimEnd() + "\n", notes };
  },
};

const simulatorsSection: ReadmeSection = {
  marker: "folio:simulators",
  summary: "Interactive simulators, from the folio's configured simulators directory.",
  render({ root }) {
    // The directory is config, not convention: the predecessor read
    // `folio-assistant/simulators` literally, which is only where a folio that
    // embeds the platform under that name puts them. The fallback is now the
    // folio-root convention, because simulators are the FOLIO's content — a
    // default naming the platform is how they came to live in the platform in
    // the first place.
    let dir = "simulators";
    const eff = readEffectiveConfig(root);
    // The index entry when one lists the layer, else `<name>.config.json`.
    if (eff.state === "ok") {
      try {
        const parsed = eff.config as {
          simulators?: { dir?: string };
        };
        if (parsed.simulators?.dir) dir = parsed.simulators.dir;
      } catch {
        // Reported by the tools that own the config; fall back to the default.
      }
    }

    const abs = join(root, dir);
    if (!existsSync(abs)) {
      // Not `empty`: the directory being absent from THIS checkout says
      // nothing about whether the folio has simulators — it may be a sparse or
      // partial checkout, or a folio that has not declared its directory.
      return undetermined(
        `simulators directory '${dir}' is not present in this checkout ` +
          `(is it declared in ${eff.from ?? "this instance's config"}, ` +
          "and is the checkout complete?)",
      );
    }
    const files = readdirSync(abs)
      .filter((f) => f.endsWith(".html"))
      .sort();
    if (files.length === 0) return empty("simulators");

    const rows = files.map((f) => {
      const raw = basename(f, ".html");
      const pretty = raw
        .split(/[_-]/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return `| ${cell(pretty)} | [\`${dir}/${f}\`](${dir}/${f}) |`;
    });
    return {
      markdown: ["| Simulator | File |", "|-----------|------|", ...rows].join("\n") + "\n",
      notes: [],
    };
  },
};

const workflowsSection: ReadmeSection = {
  marker: "folio:workflows",
  summary: "GitHub Actions workflows, described by their own `name:` field.",
  render({ root }) {
    // `root` is the FOLIO's root, supplied by the caller — this module
    // generates a folio's README, not this layer's. `.github/` sits at that
    // root. The `repoRootFor` sweep of 2026-09-19 treated this like the ~57
    // sites where `root` meant this layer, and sent it to the folio's
    // PARENT. The platform assuming it is the folio is the boundary this
    // repository exists to keep.
    const dir = join(root, ".github", "workflows");
    if (!existsSync(dir)) return empty("`.github/workflows` directory");
    const files = readdirSync(dir)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .sort();
    if (files.length === 0) return empty("workflows");

    const rows: string[] = [];
    const notes: string[] = [];
    for (const f of files) {
      // The `name:` the workflow gives itself, never a lookup table. The
      // predecessor carried a hardcoded map of one folio's twelve workflow
      // filenames and consulted it FIRST, so a folio that reused a filename
      // got the other folio's description, and every workflow outside the map
      // got whatever its YAML said — two different sources in one column.
      let name = "";
      try {
        name = readFileSync(join(dir, f), "utf-8")
          .match(/^name:\s*(.+)$/m)?.[1]
          ?.trim()
          .replace(/^["']|["']$/g, "") ?? "";
      } catch {
        notes.push(`${f}: unreadable`);
      }
      if (!name) notes.push(`${f}: no \`name:\` field — description left blank`);
      rows.push(`| \`${f}\` | ${cell(name)} |`);
    }
    return {
      markdown: ["| Workflow | Purpose |", "|----------|---------|", ...rows].join("\n") + "\n",
      notes,
    };
  },
};

// ── Harness instances ───────────────────────────────────────────────────────

/**
 * Two entries per layer, because two different readers arrive.
 *
 * The owner, 2026-09-20:
 *
 * > find beans related to readme, associated to harness instances, they must
 * > add to main one. should provide both Agent links (agents.md , memories)
 * > AND human docuemntaion (docs/) link for each harness.
 *
 * ## Why this is generated rather than written
 *
 * The same instruction carried its own constraint — *"be careful to do this to
 * minimize drift, maybe tool to use json/jsonld queries for aaplicable KGs"* —
 * and this repository has paid for the other shape repeatedly: a hardcoded
 * list of instances in two gates (bean `6tkl`), a hardcoded skills catalogue,
 * a comment asserting a committed artefact that was gitignored. **A table of
 * instances written by hand is wrong the day a layer is added**, and
 * nobody finds out, because a README is the one file no check reads.
 *
 * So every cell here is resolved from the layer's own `harness.json`: its
 * declared assets for the two file links, its declared `graphs` for the two
 * directory links. Nothing is composed from a convention — `join(root,
 * "AGENTS.md")` would render a link to a file that may not be declared, and
 * the whole point of the criterion in `check:subgraph-coverage` is that an
 * undeclared file is one no checker has a reason to look at.
 *
 * ## A gap is rendered AS a gap
 *
 * A layer with no `agent-instructions` asset gets an em dash and a
 * footnote count, never a blank cell and never a guessed path. Eight of eleven
 * layers were in that state when this was written, and a table that quietly
 * omitted them would have read as though the work were done. Same rule as
 * every other section here: not-looked-at is never reported as nothing-found,
 * and a KNOWN gap is not reported as an absence either.
 */
const instancesSection: ReadmeSection = {
  marker: "cat-harness:instances",
  summary: "Every harness instance in this repository, with its agent entry and its human entry",
  render(ctx) {
    // `ctx.root` and NOT `repoRootFor(ctx.root)`: this section indexes the
    // layers held by the layer whose README is being written, and
    // `repoRootFor` is `instanceRoot/..` — correct for a nested layer
    // asking "which repository am I in", and one level too far for the
    // repository root itself, which is exactly the layer that carries this
    // section. Called that way it enumerated the CONTAINING directory and
    // rendered a one-row table listing this repository as its own child.
    const repo = ctx.root;
    const roots = layerRootsIn(repo);
    // Zero layers is UNDETERMINED, not "this repository has none": the
    // reader is holding a README that sits in a repository which, by
    // construction, contains at least the layer that declared it.
    if (roots.length === 0) {
      return { markdown: "", notes: ["no instance declares a <name>.json — nothing was read"], skip: true };
    }

    const notes: string[] = [];
    const rows: string[] = [];
    let mute = 0;
    let undocumented = 0;
    let notOnDisk = 0;
    let atPublish = 0;

    for (const root of roots) {
      const rel = relative(repo, root);
      const here = rel === "" ? "." : rel;
      let decl;
      try {
        decl = readDeclaration(root);
      } catch (e) {
        notes.push(`${here}: declaration unreadable — ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
      if (decl === undefined) continue;

      // A declared `src` or `path` is relative to the root its SCOPE names —
      // this layer's by default, the repository's when `scope` says so —
      // which is the one rule `rootForScope` exists to hold. Composing
      // `./<instance>/<path>` instead rendered cat-harness's `memory/` as
      // `./cat-harness/memory/`, and it is declared `scope: "repository"`, so
      // the real directory is at the repository root and the link was dead.
      // A dead link in a generated table is worse than a missing row: the row
      // asserts the entry exists.
      const link = (label: string, target: string, scope?: string): string => {
        const base = scope === "repository" || rel === "" ? "" : `./${rel}/`;
        return `[${label}](${base}${target})`;
      };

      // A file link is the DECLARED src, never a composed path.
      const asset = (role: string): { src: string; scope?: string } | undefined => {
        const a = (decl.assets ?? []).find((x) => x.role === role);
        return a === undefined ? undefined : { src: a.src, scope: a.scope };
      };
      // A directory link is any directory this layer declares as holding
      // that graph typology. Several is possible and all of them are rendered:
      // picking one would be this file choosing on the layer's behalf.
      //
      // A declared directory that is NOT ON DISK is not linked, and is
      // counted instead. An index checkout lays a layer down as a remote
      // mount, and a mount may take only some of its directories
      // (`overrides.<name>.directories`) — a layer's declared `docs/` may
      // not be mounted. Linking it rendered a dead link in a generated row, which
      // asserts the entry exists; dropping it silently would hide the gap.
      const dirs = (kind: string): Array<{ path: string; scope?: string }> =>
        (decl.directories ?? [])
          .filter((d) => (d.graphTypologies ?? []).includes(kind))
          .map((d) => ({ path: d.path, scope: d.scope }))
          .filter((d) => {
            // A directory BUILT AT PUBLISH is never committed, and whether it
            // is on disk depends on which writers ran before this render (in
            // CI, `smart:pages` writes smart-trust's `docs/` before the tests
            // that check this file is current). Linking it on presence made
            // the committed README depend on the run; it is counted instead.
            if (d.scope !== "repository" && isBuiltAtPublish(decl.builtAtPublish ?? [], d.path)) {
              atPublish += 1;
              return false;
            }
            const base = d.scope === "repository" ? repo : root;
            if (existsSync(join(base, d.path))) return true;
            notOnDisk += 1;
            return false;
          });

      const agents = asset(AGENT_INSTRUCTIONS_ROLE);
      const readme = asset(INSTANCE_README_ROLE);
      const memory = dirs("memory");
      const docs = dirs("docs");

      if (agents === undefined) mute += 1;
      // DECLARES no `docs` graph — not "has none on disk", which the count
      // above reports separately.
      if (!(decl.directories ?? []).some((d) => (d.graphTypologies ?? []).includes("docs"))) undocumented += 1;

      const agentCell = [
        agents === undefined ? undefined : link("AGENTS.md", agents.src, agents.scope),
        ...memory.map((m) => link("memory", m.path, m.scope)),
      ].filter((x) => x !== undefined);
      const humanCell = [
        readme === undefined ? undefined : link("README", readme.src, readme.scope),
        ...docs.map((d) => link("docs", d.path, d.scope)),
      ].filter((x) => x !== undefined);

      rows.push(
        `| \`${cell(decl.name ?? here)}\` | ${cell(here)} | ` +
          `${agentCell.length === 0 ? "—" : agentCell.join(" · ")} | ` +
          `${humanCell.length === 0 ? "—" : humanCell.join(" · ")} |`,
      );
    }

    if (rows.length === 0) {
      return { markdown: "", notes: [...notes, "every declaration was unreadable"], skip: true };
    }

    // The gaps are stated under the table rather than left as em dashes a
    // reader has to count. `check:subgraph-coverage` is named because it is
    // the thing that will tell them WHICH layer, and a README that reports
    // a number without saying where to get the list is the "count in prose"
    // failure this repository already has a rule about.
    const gaps: string[] = [];
    if (mute > 0) {
      gaps.push(
        `**${mute} of ${rows.length}** declare no \`agent-instructions\` asset — readable by a person, ` +
          "mute to an agent. `bun run cat check:subgraph-coverage` names them.",
      );
    }
    if (undocumented > 0) {
      gaps.push(
        `**${undocumented} of ${rows.length}** declare no \`docs\` graph of their own; their reader-facing ` +
          "documentation is the harness layer's site.",
      );
    }

    if (notOnDisk > 0) {
      gaps.push(
        `**${notOnDisk}** declared \`memory\` or \`docs\` director${notOnDisk === 1 ? "y is" : "ies are"} not on disk in this ` +
          "checkout — a mount that lays down only some of an instance's directories — so " +
          `${notOnDisk === 1 ? "it is" : "they are"} not linked.`,
      );
    }

    if (atPublish > 0) {
      gaps.push(
        `**${atPublish}** declared \`memory\` or \`docs\` director${atPublish === 1 ? "y is" : "ies are"} built at publish, ` +
          `never committed, so ${atPublish === 1 ? "it is" : "they are"} not linked from a committed file.`,
      );
    }

    return {
      markdown:
        [
          "| Instance | Path | For an agent | For a person |",
          "|----------|------|--------------|--------------|",
          ...rows,
        ].join("\n") +
        "\n" +
        (gaps.length === 0 ? "" : "\n" + gaps.map((g) => `> ${g}`).join("\n>\n") + "\n") +
        "\n" +
        `*\`AGENTS.md\` — ${assetRolePurpose(AGENT_INSTRUCTIONS_ROLE)}*  \n` +
        `*\`README\` — ${assetRolePurpose(INSTANCE_README_ROLE)}*\n`,
      notes,
    };
  },
};

// ── Cold start ──────────────────────────────────────────────────────────────

/**
 * What an arriving agent does first — five pointers, and the skill list is a
 * QUERY rather than an answer.
 *
 * The owner, 2026-09-20, on what the root README owes a cold agent:
 *
 * > • point to the bootstreap md overview of skill/tasks
 * > • point to kg-navation, instruct them where to find the list of skills in
 * >   materialed corpus (be careful to do this to minimize drift, maybe tool
 * >   to use json/jsonld queries for aaplicable KGs)
 * > • tell them to determine if active KG (beans/tods) or static (point to
 * >   process on determining context)
 * > • if active: see agent shoud can determine their role, process, task,
 * >   context/memoty (point to BPMN processes), then check for active beans
 * >   and (new/updated process) priotize and ask use which beans to work on
 *
 * ## The drift constraint is the design, not a caveat
 *
 * *"be careful to do this to minimize drift"* — so **this section never
 * lists skills.** It names the two calls that ask the graph, and the fallback
 * for an agent with no MCP server. A README that lists skills is wrong the
 * day a skill is added and nothing says so, because a README is the one file
 * no check reads. This repository has paid for that shape repeatedly: a
 * hardcoded layer list in two gates (`6tkl`), a hardcoded skills
 * catalogue, a comment asserting a committed artefact that was gitignored.
 *
 * The one thing it DOES compute is the active-vs-static verdict, because
 * that is a fact about this checkout rather than a list that can rot — see
 * {@link workPlanGraphsIn}, which derives it from each kind's `recordsWork`.
 */
const coldStartSection: ReadmeSection = {
  marker: "cat-harness:cold-start",
  summary: "What an arriving agent does first — five pointers, skills reached by query",
  render(ctx) {
    const repo = ctx.root;
    const roots = layerRootsIn(repo);
    if (roots.length === 0) {
      return { markdown: "", notes: ["no instance declares a <name>.json — nothing was read"], skip: true };
    }

    const { plan, unreadable } = workPlanGraphsIn(repo);
    const notes: string[] = [];
    // THREE states. An unreadable declaration means the absence of a work
    // plan is unproven, and rendering STATIC over it would tell an arriving
    // agent there is nothing here — the one thing this section must not get
    // wrong. Same rule as every other section in this file: not-looked-at is
    // never reported as nothing-found.
    if (plan.length === 0 && unreadable.length > 0) {
      for (const u of unreadable) notes.push(`declaration unreadable: ${relative(repo, u) || "."}`);
      return {
        markdown: "",
        notes: [...notes, "active-vs-static could not be determined — region left untouched"],
        skip: true,
      };
    }
    const active = plan.length > 0;
    for (const u of unreadable) notes.push(`declaration unreadable, not counted: ${relative(repo, u) || "."}`);

    // The verdict, computed, with the evidence beside it — a bare ACTIVE is a
    // claim, and the whole point of deriving it is that a reader can check.
    const verdict = active
      ? `**This repository is an ACTIVE knowledge graph.** ` +
        plan
          .map((p) => `\`${cell(p.instance)}\` declares ${p.kinds.map((k) => `\`${k}\``).join(" and ")}`)
          .join("; ") +
        ` — work somebody is partway through, which you can pick up.`
      : `**This repository is a STATIC knowledge graph.** No instance declares a graph that records work ` +
        `(beans, todos, a BPMN instance mid-flight), so there is nothing here to pick up — it is here to be read.`;

    // The work plan is LINKED only where the checkout TRACKS it. In an index
    // checkout it is kept on its state branch and mounted by the
    // session-start hook, so a fresh clone has no `beans/` and the link was
    // dead in the one section an arriving agent reads first. Asked of git,
    // not of the disk: "is it on disk" changes with whether `state:mount` ran,
    // so the generated README differed between a session and CI (whose job
    // mounts state first) and `index:render:check` could not hold in both
    // (measured 2026-10-09).
    const workPlan = trackedByCheckout(repo, "beans")
      ? "[`beans/`](beans/)"
      : "`beans/` (kept on its state branch: `bun run cat state:mount` puts it on disk)";

    const lines = [
      "**Read this before you do anything else.**",
      "",
      verdict,
      "",
      "| | |",
      "|---|---|",
      "| **0. Did the session-start hook run?** | It runs only when the session **starts inside this checkout**. If the repository was attached or cloned partway through the session, or the session opened in another directory, it did not run, and nothing says so: the work plan, the remote-mounted layers and the platform tools are then simply missing. Run its commands by hand from the checkout root, in order (`jq -r '.hooks.SessionStart[].hooks[].command' .claude/settings.json` lists them), before anything else. See [`remote-mount`](cat-harness/skills/kg/kg-core/remote-mount.md#when-the-session-start-hook-did-not-run). |",
      "| **1. What the harness is, from nothing** | [`bootstrap/README.md`](bootstrap/README.md) — the overview of skills and tasks, written to assume no MCP server, no `beans`, no build. |",
      "| **2. How to find the graph, and the skills in it** | [`kg-navigation`](cat-harness/skills/kg/kg-navigation/kg-navigation.md). **Ask for the skill list; never read one from here** — `skill_list` for what exists, `skill_fetch` to load one. No MCP? Resolve the `kg` graph from `<name>.json` and read the directory it names. |",
      "| **3. Whether this graph is active or static** | The verdict above is computed, not asserted: an instance is ACTIVE when it declares a graph typology whose `recordsWork` is true. Static? Then determine your context instead — [`process-state`](cat-harness/skills/process/workflow/process-state.md). |",
      active
        ? "| **4. It is active, so** | Work out your role, process and task from the BPMN under [`processes/`](cat-harness/processes/) — the diagrams are executable, not illustrations. Then read the work plan in " +
          workPlan +
          ", prioritise it, and **ask which items to work on**. That last step is an interaction rule, not a formality. |"
        : "| **4. It is static, so** | There is no work plan to prioritise and no process to resume. Determine your context from [`process-state`](cat-harness/skills/process/workflow/process-state.md) and work from what you were asked to do. |",
      "",
      "*Why no list of skills: a README is the one file no check reads, so a list in it is wrong the day a skill is added and nothing says so. The two calls above ask the graph instead.*",
      "",
    ];

    if (!active) {
      notes.push("no work-plan graph declared — rendered the STATIC branch");
    }
    return { markdown: lines.join("\n"), notes };
  },
};

// ── The README's own table of contents ──────────────────────────────────────

/**
 * The marker for the heading TOC. NOT `folio:toc`, which is a different
 * thing that happens to share the word: that one is the folio's CONTENTS —
 * papers and chapters, with publish-ref-verified PDFs — and says nothing
 * about the README it sits in. This one is the README's own h2/h3 outline.
 */
export const README_TOC_MARKER = "readme:toc";

export interface ReadmeHeading {
  /** 1–6. */
  level: number;
  /** The heading as GitHub renders it: inline markup stripped. */
  text: string;
  /** The anchor GitHub assigns, deduplicated across the whole file. */
  anchor: string;
  /** 1-based line of the heading (the text line, for a setext heading). */
  line: number;
}

/**
 * The anchor GitHub gives a heading's text — `github-slugger`'s rule, which
 * is what github.com and the GitHub-flavoured renderers use.
 *
 * Lowercase; drop every character that is not a letter, mark, digit,
 * connector (`_`), space or hyphen; each space becomes `-`. Spaces are NOT
 * collapsed — `A & B` is `a--b` on GitHub, and a TOC that tidied it to `a-b`
 * would link to nothing.
 */
export function githubSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** A heading's source text as it renders: links to their text, markup dropped. */
function renderedHeadingText(src: string): string {
  return src
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/`+([^`]*?)`+/g, "$1")
    .replace(/(\*\*|__)(?=\S)([\s\S]*?\S)\1/g, "$2")
    .replace(/(^|[^\w*])\*(?=\S)([^*]*?\S)\*/g, "$1$2")
    .replace(/(^|\W)_(?=\S)([^_]*?\S)_(?=\W|$)/g, "$1$2")
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1")
    .trim();
}

/**
 * Every heading in a Markdown document, in order, with GitHub's anchors.
 *
 * Skips what GitHub does not render as a heading: lines inside a fenced code
 * block (```` ``` ```` or `~~~`, closed only by a fence of the same character
 * at least as long), inside an HTML comment, and anything indented four or
 * more spaces. Handles ATX (`## x`) and setext (`x` over `---`/`===`).
 *
 * `excludeRegion` names a marker whose region is skipped — the TOC's own, so
 * a generated TOC is never an input to itself. The region only ever holds a
 * list, so skipping it cannot shift another heading's anchor.
 */
export function extractHeadings(markdown: string, excludeRegion?: string): ReadmeHeading[] {
  const lines = markdown.split(/\r?\n/);
  const headings: ReadmeHeading[] = [];
  const seen = new Map<string, number>();
  let fence: { ch: string; len: number } | undefined;
  let inComment = false;
  let inExcluded = false;
  /** The current paragraph's lines, for a setext underline. */
  let para: { start: number; lines: string[] } | undefined;

  // github-slugger's dedupe, step for step: a repeat becomes `-1`, `-2`, …,
  // and a suffixed anchor that collides with a LITERAL heading (`a`, `a-1`,
  // `a`) is bumped past it rather than issued twice.
  const push = (level: number, raw: string, line: number): void => {
    const text = renderedHeadingText(raw);
    const original = githubSlug(text);
    let anchor = original;
    while (seen.has(anchor)) {
      const n = seen.get(original)! + 1;
      seen.set(original, n);
      anchor = `${original}-${n}`;
    }
    seen.set(anchor, 0);
    headings.push({ level, text, anchor, line });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (excludeRegion !== undefined) {
      if (line.includes(`<!-- ${excludeRegion}:begin -->`)) { inExcluded = true; para = undefined; continue; }
      if (inExcluded) { if (line.includes(`<!-- ${excludeRegion}:end -->`)) inExcluded = false; continue; }
    }

    if (fence) {
      const close = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (close && close[1][0] === fence.ch && close[1].length >= fence.len) fence = undefined;
      continue;
    }
    if (inComment) {
      if (line.includes("-->")) inComment = false;
      continue;
    }

    const open = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (open) {
      fence = { ch: open[1][0], len: open[1].length };
      para = undefined;
      continue;
    }
    const commentStart = line.lastIndexOf("<!--");
    if (commentStart !== -1 && line.indexOf("-->", commentStart) === -1) {
      inComment = true;
      para = undefined;
      continue;
    }

    const atx = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/);
    if (atx) {
      push(atx[1].length, atx[2] ?? "", i + 1);
      para = undefined;
      continue;
    }

    const setext = line.match(/^ {0,3}(=+|-+)[ \t]*$/);
    if (setext && para) {
      push(setext[1][0] === "=" ? 1 : 2, para.lines.join(" "), para.start);
      para = undefined;
      continue;
    }

    if (line.trim() === "") { para = undefined; continue; }
    // Only a plain paragraph line can be the text of a setext heading; a list
    // item, quote, table row or HTML line followed by `---` is not one.
    if (/^ {4,}|^\s*([-*+>|<]|\d+[.)])/.test(line)) { para = undefined; continue; }
    if (para) para.lines.push(line.trim());
    else para = { start: i + 1, lines: [line.trim()] };
  }
  return headings;
}

/** Link text in a list item: a bracket in the heading must not close the link. */
function linkText(text: string): string {
  return text.replace(/([[\]])/g, "\\$1");
}

/**
 * The README's h2/h3 outline as a nested list of in-page links.
 *
 * h1 is left out because a README's h1 is its title, and a TOC that begins by
 * linking to the line above it is noise. Anchors are deduplicated over EVERY
 * heading in the file — h1 and h4+ included — because GitHub counts them all.
 */
export function renderReadmeToc(readme: string): SectionOutput {
  const headings = extractHeadings(readme, README_TOC_MARKER).filter((h) => h.level === 2 || h.level === 3);
  if (headings.length === 0) {
    return { markdown: "_This README has no sections yet._\n", notes: ["no h2/h3 headings found"] };
  }
  const base = Math.min(...headings.map((h) => h.level));
  const lines = headings.map(
    (h) => `${"  ".repeat(h.level - base)}- [${linkText(h.text)}](#${h.anchor})`,
  );
  return { markdown: lines.join("\n") + "\n", notes: [] };
}

const readmeTocSection: ReadmeSection = {
  marker: README_TOC_MARKER,
  summary: "The README's own table of contents: its h2/h3 headings, as GitHub anchors.",
  render({ readme }) {
    if (readme === undefined) return undetermined("no README text was supplied to render from");
    return renderReadmeToc(readme);
  },
};

// ── Skills this layer publishes ──────────────────────────────────────────

/** The marker for the per-repository skill index (bean `e0uk`). */
export const SKILLS_INDEX_MARKER = "skills:index";

/** One line of a skill's summary: its first sentence, capped at a word, never empty-as-said. */
export function skillSummaryLine(text: string | undefined, cap = 200): string | undefined {
  if (text === undefined) return undefined;
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat === "") return undefined;
  const sentence = flat.match(/^(.+?[.!?])(\s|$)/)?.[1] ?? flat;
  if (sentence.length <= cap) return sentence;
  const cut = sentence.slice(0, cap - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > cap / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The body's first prose paragraph: not front matter, a heading, a quote, a list, a table or a fence. */
export function firstParagraph(text: string): string | undefined {
  let body = text;
  if (body.startsWith("---")) {
    const end = body.indexOf("\n---", 3);
    if (end !== -1) body = body.slice(body.indexOf("\n", end + 1) + 1);
  }
  let inFence = false;
  for (const para of body.split(/\n\s*\n/)) {
    const t = para.trim();
    if (t.startsWith("```") || t.startsWith("~~~")) {
      const fences = (t.match(/^(```|~~~)/gm) ?? []).length;
      if (fences % 2 === 1) inFence = !inFence;
      continue;
    }
    if (inFence || t === "" || /^(#|>|[-*+] |\d+\. |\||<|!\[)/.test(t)) continue;
    return t;
  }
  return undefined;
}

/**
 * What a skill says it is for. Its `description:` first; a heading only when
 * it says more than the name (a heading that IS the name tells an agent
 * nothing it has not just read); otherwise the first prose paragraph.
 */
export function skillPurpose(text: string, name: string): { summary?: string; from: "description" | "heading" | "paragraph" | "none" } {
  const fm = frontMatter(text);
  if (fm.description) return { summary: skillSummaryLine(fm.description), from: "description" };
  const heading = nodeSummary(text);
  if (heading !== undefined && heading.replace(/`/g, "").trim() !== name) return { summary: skillSummaryLine(heading), from: "heading" };
  const para = skillSummaryLine(firstParagraph(text));
  return para === undefined ? { from: "none" } : { summary: para, from: "paragraph" };
}

/**
 * The byte budget an AGENTS.md is held to: Codex reads the first 32 KiB of
 * `AGENTS.md` by default (`project_doc_max_bytes`). Past it the full list
 * moves to {@link SKILLS_INDEX_FILE} and AGENTS.md keeps the directories.
 */
export const AGENTS_MD_BYTE_BUDGET = 32_768;

/** Where the full list goes when it does not fit in AGENTS.md: beside it, at the layer root. */
export const SKILLS_INDEX_FILE = "SKILLS.md";

/** The layer's own skills, grouped by declared directory. */
export function ownSkillIndex(root: string): { packages: { dir: string; rows: string[]; optIn?: string }[]; total: number; notes: string[] } {
  const notes: string[] = [];
  const packages: { dir: string; rows: string[]; optIn?: string }[] = [];
  const groups = optInRootsOf(root);
  let total = 0;
  for (const parts of skillMdDirs(root, "instance")) {
    const abs = join(root, ...parts);
    if (!existsSync(abs)) continue;
    const files = readdirSync(abs)
      .filter((f) => f.endsWith(".md") && isSkillMd(join(abs, f)))
      .sort();
    if (files.length === 0) continue;
    const dir = parts.join("/");
    // A skill inside an opt-in sub-graph is absent wherever the group is
    // switched off, so the list names it without linking it.
    const optIn = groupOf(abs.replace(/[\\/]+$/, ""), groups)?.id;
    const rows = files.map((f) => {
      const text = readFileSync(join(abs, f), "utf-8");
      const name = frontMatter(text).name ?? f.slice(0, -3);
      const { summary, from } = skillPurpose(text, name);
      if (from !== "description") notes.push(`${dir}/${f}: no \`description:\` in front matter (summary from ${from})`);
      const label = `\`${cell(name)}\``;
      return `| ${optIn === undefined ? `[${label}](${dir}/${f})` : label} | ${summary === undefined ? "_(no description)_" : cell(summary)} |`;
    });
    total += rows.length;
    packages.push(optIn === undefined ? { dir, rows } : { dir, rows, optIn });
  }
  // A group the mounting root switched off and the mount LEFT OUT has no files
  // here, so the list cannot be regenerated for it — and dropping it would
  // call the layer's own index stale for a part only consent removed. Its
  // sections are kept verbatim from the committed index, which the layer's
  // own CI regenerates with every group on (card Q-OPTIN-DIRS A).
  let leftOut: Set<string>;
  try {
    leftOut = new Set(switchedOffGroups(root).leftOut.map((g) => g.id));
  } catch {
    leftOut = new Set();
  }
  if (leftOut.size === 0) return { packages, total, notes };
  const committed = committedSkillIndex(root);
  const carried = committed.filter((p) => p.optIn !== undefined && leftOut.has(p.optIn));
  if (carried.length === 0) return { packages, total, notes };
  const merged = mergeCarriedPackages(packages, committed, (p) => p.optIn !== undefined && leftOut.has(p.optIn));
  const kept = carried.reduce((n, p) => n + p.rows.length, 0);
  notes.push(`${kept} skill(s) in ${carried.length} director(ies) of opt-in sub-graph(s) the mount left out (${[...new Set(carried.map((p) => p.optIn))].join(", ")}) kept from the committed index`);
  return { packages: merged, total: total + kept, notes };
}

/**
 * The regenerated packages with the committed ones `carry` selects put back
 * where the committed index had them; a regenerated directory the committed
 * index does not know stays after the one it followed.
 */
export function mergeCarriedPackages(
  regen: readonly { dir: string; rows: string[]; optIn?: string }[],
  committed: readonly CommittedSkillPackage[],
  carry: (p: CommittedSkillPackage) => boolean,
): { dir: string; rows: string[]; optIn?: string }[] {
  const byDir = new Map(regen.map((p) => [p.dir, p]));
  const known = new Set(committed.map((p) => p.dir));
  const out: { dir: string; rows: string[]; optIn?: string }[] = [];
  const used = new Set<string>();
  let ri = 0;
  for (const c of committed) {
    if (carry(c)) {
      if (!byDir.has(c.dir)) out.push(c.optIn === undefined ? { dir: c.dir, rows: [...c.rows] } : { dir: c.dir, rows: [...c.rows], optIn: c.optIn });
      continue;
    }
    const r = byDir.get(c.dir);
    if (r === undefined || used.has(r.dir)) continue;
    for (; ri < regen.length && regen[ri] !== r; ri++) {
      const q = regen[ri]!;
      if (!known.has(q.dir) && !used.has(q.dir)) {
        out.push(q);
        used.add(q.dir);
      }
    }
    out.push(r);
    used.add(r.dir);
    ri++;
  }
  for (const q of regen) if (!used.has(q.dir)) out.push(q);
  return out;
}

const INDEX_FOOTER =
  "`bun run cat readme:sync` rewrites this list and `readme:sync:check` fails when it is stale. " +
  "Skills this repository inherits are listed by the repositories that publish them.";

/** The marker after a directory in an opt-in sub-graph: its skills are unlinked, since the group may be switched off. */
function optInNote(p: { optIn?: string }): string {
  return p.optIn === undefined ? "" : ` (opt-in \`${p.optIn}\`)`;
}

/** The full list: every skill with its one-line purpose. */
export function renderFullSkillIndex(idx: ReturnType<typeof ownSkillIndex>): string {
  const n = idx.total;
  const lines = [
    `_${n} skill${n === 1 ? "" : "s"} in ${idx.packages.length} director${idx.packages.length === 1 ? "y" : "ies"}, generated from each skill's front matter. ${INDEX_FOOTER}_`,
    "",
  ];
  for (const p of idx.packages) {
    lines.push(`**\`${p.dir}/\`** (${p.rows.length})${optInNote(p)}`, "", "| Skill | What it is for |", "|---|---|", ...p.rows, "");
  }
  return lines.join("\n");
}

/** The short form for an AGENTS.md the full list would push past its budget. */
export function renderCompactSkillIndex(idx: ReturnType<typeof ownSkillIndex>, budget: number): string {
  const n = idx.total;
  return [
    `_${n} skill${n === 1 ? "" : "s"} in ${idx.packages.length} directories. The full list, with what each skill is for, is in ` +
      `[\`${SKILLS_INDEX_FILE}\`](${SKILLS_INDEX_FILE}): here it would take this file past ${Math.round(budget / 1024)} KiB, ` +
      `the most of an \`AGENTS.md\` some agents read. ${INDEX_FOOTER}_`,
    "",
    "| Directory | Skills |",
    "|---|---|",
    ...idx.packages.map((p) => `| ${p.optIn === undefined ? `[\`${p.dir}/\`](${p.dir}/)` : `\`${p.dir}/\`${optInNote(p)}`} | ${p.rows.length} |`),
    "",
  ].join("\n");
}

/** Bytes of `text` once the region of `marker` holds `body` (the same write `injectSection` makes). */
export function sizeWithRegion(text: string, marker: string, body: string): number {
  return Buffer.byteLength(injectSection(text, body, marker).content, "utf-8");
}

/** Whether the AGENTS.md text `agentsText` would get the directory table rather than the full list. */
export function skillIndexIsCompact(root: string, agentsText: string, budget = AGENTS_MD_BYTE_BUDGET): boolean {
  if (!agentsText.includes(`<!-- ${SKILLS_INDEX_MARKER}:begin -->`)) return false;
  const idx = ownSkillIndex(root);
  return idx.total > 0 && sizeWithRegion(agentsText, SKILLS_INDEX_MARKER, renderFullSkillIndex(idx)) > budget;
}

/**
 * The skills THIS layer publishes, so an agent opened in this repository
 * alone sees them without an MCP server or a query.
 *
 * The owner, 2026-10-24 09:49Z: *"all repos should have agentic advice (e.g.
 * based on the skills that they publish)"*; option D, phase 1 (bean `e0uk`).
 *
 * The cold-start section above never lists skills, because "a README is the
 * one file no check reads". This section is the answer to that reason rather
 * than an exception to it: it is generated from each skill's own front
 * matter, and `readme:sync:check` fails CI the day it goes stale. It lists
 * the layer's OWN skills (`scope: "instance"`), never what it inherits, so
 * a skill added upstream changes no downstream file.
 *
 * With {@link SectionContext.byteBudget} set (the AGENTS.md target), a full
 * list that would take the file past it renders the directory table instead,
 * and the caller writes the full list to {@link SKILLS_INDEX_FILE}.
 */
const skillsIndexSection: ReadmeSection = {
  marker: SKILLS_INDEX_MARKER,
  summary: "The skills this instance publishes (its own, not inherited), from each skill's front matter",
  render({ root, readme, byteBudget }) {
    let idx: ReturnType<typeof ownSkillIndex>;
    try {
      idx = ownSkillIndex(root);
    } catch (e) {
      return undetermined(`the instance's skill directories could not be resolved: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (idx.total === 0) {
      return { markdown: "_This instance publishes no skills._\n", notes: ["no skills found in the declared skill directories"] };
    }
    const full = renderFullSkillIndex(idx);
    if (byteBudget !== undefined && readme !== undefined && sizeWithRegion(readme, SKILLS_INDEX_MARKER, full) > byteBudget) {
      return {
        markdown: renderCompactSkillIndex(idx, byteBudget),
        notes: [...idx.notes, `the full list would pass ${byteBudget} bytes; the directories are listed and the full list is in ${SKILLS_INDEX_FILE}`],
      };
    }
    return { markdown: full, notes: idx.notes };
  },
};

/**
 * `readme:toc` is registered LAST, and the order is load-bearing: it reads the
 * README as the sections before it have left it, so a heading another section
 * generates (a `folio:toc` paper title) is in the outline on the same run
 * rather than one run later — which would make `--check` fail on a README
 * that was just synced.
 */
export const SECTIONS: readonly ReadmeSection[] = [
  tocSection,
  coldStartSection,
  skillsIndexSection,
  instancesSection,
  leanCoverageSection,
  leanModulesSection,
  simulatorsSection,
  workflowsSection,
  processesSection,
  filesSection,
  rolesSection,
  readmeTocSection,
];

// ── Sync ────────────────────────────────────────────────────────────────────

export interface SyncResult {
  /** Markers found in the README and rewritten. */
  written: string[];
  /** Registered markers the README does not carry — skipped, not an error. */
  absent: string[];
  /** Markers present but left untouched because the section could not determine an answer. */
  skipped: string[];
  /** Whether any marked region's content changed. */
  changed: boolean;
  notes: string[];
  content: string;
}

/**
 * Rewrite every registered section the README actually carries.
 *
 * A registered marker the README omits is *absent*, not an error: sections are
 * opt-in per folio, and a document folio carrying only `folio:toc` is the
 * normal case, not a misconfiguration.
 */
export function syncSections(
  readme: string,
  ctx: SectionContext,
  only?: string[],
): SyncResult {
  const written: string[] = [];
  const absent: string[] = [];
  const skipped: string[] = [];
  const notes: string[] = [];
  let content = readme;
  let changed = false;

  for (const section of SECTIONS) {
    if (only && !only.includes(section.marker)) continue;
    if (!content.includes(`<!-- ${section.marker}:begin -->`)) {
      absent.push(section.marker);
      continue;
    }
    const out = section.render({ ...ctx, readme: content });
    if (out.skip) {
      notes.push(...out.notes.map((n) => `${section.marker}: ${n}`));
      skipped.push(section.marker);
      continue;
    }
    // A section bootstrap-tools owns (`kg:processes`, `kg:files`, `kg:roles`)
    // says what generated it, exactly as bootstrap-tools' own writer does —
    // two writers of one region that disagree on its first line make each
    // other's `--check` red. Its `from` is what marks it as the tools'.
    const from = (section as { from?: unknown }).from;
    const markdown =
      typeof from === "string"
        ? `${generatedBanner("scripts/readme-sections.ts", `${from} (section \`${section.marker}\`)`, "edit outside the markers, or change what it is generated from", "section")}\n\n${out.markdown}`
        : out.markdown;
    const injected = injectSection(content, markdown, section.marker);
    content = injected.content;
    changed = changed || injected.changed;
    written.push(section.marker);
    notes.push(...out.notes.map((n) => `${section.marker}: ${n}`));
  }
  return { written, absent, skipped, changed, notes, content };
}

/** Shared by the CLI and the `readme_sync` MCP tool. */
/**
 * Load the science layer's coverage computation, if it is installed.
 *
 * Through the `lean-coverage` pipeline slot, which a higher layer fills
 * (bean `squu`). This used to import `scripts/lean-coverage.ts` by a variable
 * path under THIS layer's root, which named no file to the partition but
 * would have found nothing once that script moves to the science layer, and
 * reported "could not determine" for a reason nobody could see. `undefined` on
 * any failure, which the coverage section renders as "could not determine"
 * rather than as an empty table.
 */
async function loadLeanCoverage(): Promise<LeanCoverageStats | undefined> {
  try {
    const fn = optionalPipelinePlugin("lean-coverage")?.computeStats;
    return typeof fn === "function" ? (fn as LeanCoverageStats) : undefined;
  } catch {
    return undefined;
  }
}

export async function runReadmeSync(opts: {
  root?: string;
  check?: boolean;
  fetch?: boolean;
  only?: string[];
  readmePath?: string;
  linkStyle?: ReadmeTocConfig["linkStyle"];
}): Promise<{ text: string; exitCode: number }> {
  const root = opts.root ?? findContentRepoRoot();
  const leanCoverage = await loadLeanCoverage();
  const cfg = loadReadmeConfig(root);
  if (opts.linkStyle) cfg.linkStyle = opts.linkStyle;

  if (opts.only) {
    const known = SECTIONS.map((s) => s.marker);
    const unknown = opts.only.filter((m) => !known.includes(m));
    if (unknown.length > 0) {
      return {
        text: `Unknown section(s): ${unknown.join(", ")}. Known: ${known.join(", ")}`,
        exitCode: 2,
      };
    }
  }

  // ASKED, not composed. This layer's README is declared
  // `scope: "repository"` — it sits at the top of the checkout, one directory
  // above the layer — so `join(root, "README.md")` named nothing and the
  // gate failed with "No README" on a file that exists. The composed path is
  // still the fallback, for a layer that declares no README asset.
  const readmePath =
    opts.readmePath ?? declaredAssetPath(root, INSTANCE_README_ROLE) ?? join(root, "README.md");
  if (!existsSync(readmePath) || !statSync(readmePath).isFile()) {
    return { text: `No README at ${readmePath}.`, exitCode: 2 };
  }

  const ctx = { root, cfg, fetch: opts.fetch ?? false, leanCoverage };
  const check = opts.check ?? false;
  const readme = syncOneFile(readmePath, ctx, opts.only, check);

  // The layer's AGENTS.md is a second target for the skill index ONLY
  // (bean `e0uk`: the index belongs where every vendor's agent reads). Only
  // that marker, because other regions of an AGENTS.md (the root's
  // `cat-harness:cold-start`) have their own writer, `index-render.ts`, and two
  // writers of one region make each other's `--check` red. Skipped when the
  // caller named one file with `--readme`, or `--only` leaves the index out.
  const agentsPath =
    opts.readmePath === undefined
      ? declaredAssetPath(root, AGENT_INSTRUCTIONS_ROLE) ?? join(root, "AGENTS.md")
      : undefined;
  const wantsIndex = opts.only === undefined || opts.only.includes(SKILLS_INDEX_MARKER);
  if (
    !wantsIndex ||
    agentsPath === undefined ||
    resolve(agentsPath) === resolve(readmePath) ||
    !existsSync(agentsPath) ||
    !statSync(agentsPath).isFile() ||
    !readFileSync(agentsPath, "utf-8").includes(`<!-- ${SKILLS_INDEX_MARKER}:begin -->`)
  ) {
    return readme;
  }
  const agentsText = readFileSync(agentsPath, "utf-8");
  const agents = syncOneFile(agentsPath, { ...ctx, byteBudget: AGENTS_MD_BYTE_BUDGET }, [SKILLS_INDEX_MARKER], check);
  const out = { text: `${readme.text}\n${agents.text}`, exitCode: Math.max(readme.exitCode, agents.exitCode) };

  // The full list, when AGENTS.md could only take the directories. Created on
  // a write; under --check a missing one is a failure, since AGENTS.md links it.
  const indexPath = join(dirname(agentsPath), SKILLS_INDEX_FILE);
  const compact = skillIndexIsCompact(root, agentsText);
  if (!compact && !existsSync(indexPath)) return out;
  if (!existsSync(indexPath)) {
    if (check) {
      return { text: `${out.text}\n${indexPath} is missing; AGENTS.md links it. Run: bun run cat readme:sync`, exitCode: 1 };
    }
    writeFileSync(
      indexPath,
      `# Skills\n\nThe skills this repository publishes. Generated; edit each skill's front matter, not this file.\n\n<!-- ${SKILLS_INDEX_MARKER}:begin -->\n<!-- ${SKILLS_INDEX_MARKER}:end -->\n`,
    );
  }
  const index = syncOneFile(indexPath, ctx, [SKILLS_INDEX_MARKER], check);
  return { text: `${out.text}\n${index.text}`, exitCode: Math.max(out.exitCode, index.exitCode) };
}

/** Sync (or check) the marked regions of one file; the README's wording is kept for both targets. */
function syncOneFile(
  path: string,
  ctx: SectionContext,
  only: string[] | undefined,
  check: boolean,
): { text: string; exitCode: number } {
  const current = readFileSync(path, "utf-8");
  const result = syncSections(current, ctx, only);

  if (result.written.length === 0 && result.skipped.length === 0) {
    return {
      text:
        `${path} carries no generated-section markers, so nothing was written.\n` +
        `Add a marker pair where a section should go, e.g.:\n` +
        `  <!-- folio:toc:begin -->\n  <!-- folio:toc:end -->\n` +
        `Available: ${SECTIONS.map((s) => s.marker).join(", ")}`,
      exitCode: 0,
    };
  }

  const summary =
    `sections: ${result.written.join(", ") || "none"}` +
    (result.skipped.length ? `; left unchanged: ${result.skipped.join(", ")}` : "");
  if (check) {
    return result.changed
      ? {
          text: [`${path} is out of date (${summary}). Run: bun run cat readme:sync`, ...result.notes].join("\n"),
          exitCode: 1,
        }
      : { text: [`${path} is up to date (${summary}).`, ...result.notes].join("\n"), exitCode: 0 };
  }

  if (result.changed) writeFileSync(path, result.content);
  return {
    text: [
      result.changed
        ? `${path} updated (${summary}).`
        : `${path} already current (${summary}).`,
      ...result.notes,
    ].join("\n"),
    exitCode: 0,
  };
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  if (argv.includes("--list")) {
    for (const s of SECTIONS) console.log(`${s.marker.padEnd(22)} ${s.summary}`);
    process.exit(0);
  }

  const style = flag("link-style");
  if (style && !["blob", "pages", "raw"].includes(style)) {
    console.error(`--link-style must be blob, pages or raw (got '${style}')`);
    process.exit(2);
  }
  const only = flag("only")?.split(",").map((s) => s.trim()).filter(Boolean);

  // `--all`: every layer under `--dir` (default: this checkout), each
  // against its OWN declared README. Added with `readme:toc`, which the owner
  // asked for on every harness's README: a generated region only the root,
  // cat-harness and bootstrap were checked for is a hand-kept list in every
  // other one — correct the day it was synced and silently wrong after.
  if (argv.includes("--all")) {
    const repo = resolve(flag("dir") ?? ".");
    const roots = layerRootsIn(repo);
    if (roots.length === 0) {
      console.error(`no instance declares a <name>.json under ${repo} — nothing was read`);
      process.exit(2);
    }
    let worst = 0;
    for (const root of roots) {
      // A SUBMODULE is another repository, and it owns its own README (owner
      // D3, 2026-10-01: each layer hosts the generated outputs about
      // itself). Writing into it leaves a change this checkout cannot commit,
      // and checking it compares the other repository's generator against
      // this one's — they disagree on bootstrap-tools/README.md (bean `kye5`).
      // Said, not silently dropped: a skipped README is not a current one.
      if (resolve(root) !== repo && isForeignRoot(root)) {
        console.log(`${relative(repo, root)}/README.md skipped — a submodule or remote mount; its own repository generates and checks it (bean kye5).`);
        continue;
      }
      try {
        const r = await runReadmeSync({
          root,
          check: argv.includes("--check"),
          fetch: argv.includes("--fetch"),
          only,
          linkStyle: style as ReadmeTocConfig["linkStyle"] | undefined,
        });
        (r.exitCode === 0 ? console.log : console.error)(r.text);
        worst = Math.max(worst, r.exitCode);
      } catch (e) {
        console.error(`${relative(repo, root) || "."}: ${e instanceof Error ? e.message : String(e)}`);
        worst = 2;
      }
    }
    process.exit(worst);
  }

  try {
    const result = await runReadmeSync({
      // `--dir` names the LAYER whose README is being synced, and it is not
      // a convenience. The Tool node has declared a `dir` input since it was
      // written; the CLI never accepted one, so the two disagreed and the flag
      // was silently ignored. It became load-bearing when the repository's
      // README and cat-harness's were split (issue #592): before that,
      // cat-harness declared the root's file with `scope: "repository"`, so
      // "this instance's README" and "the repository's README" were one file
      // and the difference could not show. They are now two, and
      // `findContentRepoRoot()` resolves to whichever layer carries a
      // `folio/` — which is cat-harness, not the root.
      root: flag("dir") === undefined ? undefined : resolve(flag("dir")!),
      check: argv.includes("--check"),
      fetch: argv.includes("--fetch"),
      only,
      readmePath: flag("readme"),
      linkStyle: style as ReadmeTocConfig["linkStyle"] | undefined,
    });
    (result.exitCode === 0 ? console.log : console.error)(result.text);
    process.exit(result.exitCode);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  }
}
