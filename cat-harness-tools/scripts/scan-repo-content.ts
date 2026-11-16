#!/usr/bin/env bun
/**
 * Scan an existing repository for material a folio could take over.
 *
 * This runs on the `overlay` branch of the content core's `processes/conduct/getting-started.bpmn`,
 * before anything is scaffolded or moved: **scan, show, ask, then move.**
 *
 * ## Three buckets
 *
 * `library` is external source material — something somebody else wrote, which
 * the folio cites or ingests. `content` is material authored here, which could
 * become folio blocks. `unclassified` is everything it could not place, and it
 * is *reported*, never quietly assigned — a two-bucket classifier would
 * deliver its mistakes as moved files.
 *
 * ## Path and extension only — deliberately
 *
 * It does not read file contents or call a model, so an author can see why
 * any row was placed and disagree with it in one word.
 *
 * ## Outside-content mathematical evidence & refutations
 *
 * In repositories with mathematical and scientific content, crucial evidence
 * often lives OUTSIDE the primary content tree:
 *   - formal proofs (.lean, .v, .thy) under `docs/audits/`, `math/`, `scripts/`
 *   - computation scripts (.py, .sage, .ipynb) under `docs/audits/`, `computations/`
 *   - TeX macros and tables (`macros.tex`, `tables/*.tex`, `preamble.tex`)
 *   - audit refutations (e.g. `docs/audits/skein-mass-relation-is-false.lean`)
 *   - derivation notes under `docs/notes/`, `notes/`, `derivations/`
 *
 * The scanner surfaces these as read-only candidates, classified into 5
 * categories (`math_proof`, `computation_script`, `macro_definition`,
 * `audit_refutation`, `derivation_note`) with source location, rationale, and
 * link status (orphaned evidence is unlinked to any block in the content tree).
 *
 * ## Markers — what the harness COULD declare
 *
 * The fourth section, `markers`, answers "what in this repository could a
 * harness be told to pay attention to" — a harness that points at a repo
 * declares what it attends to rather than taking all of it. For each content
 * marker found — `sushi-config.yaml`, a legacy `dak.json`, `.bpmn` processes,
 * a beans store, `library/`, Lean, folio manifests — it reports the paths,
 * whether `index.config.json` (or a local layer's declaration) ALREADY
 * declares it, and the snippet that would. It suggests; it never declares.
 * The pick is the person's, made on `Task_ChooseHarnessed` in
 * `getting-started.bpmn`. See `lib/content-markers.ts`.
 *
 * ## It never writes
 *
 * No moves, no mkdir, no git. Ingestion is a separate process with its own
 * diagram (`document-ingestion.bpmn`) and its own gate.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/scan-repo-content.ts [dir]             # report
 *   bun run cat-harness-tools/scripts/scan-repo-content.ts [dir] --json      # facts
 *   bun run cat-harness-tools/scripts/scan-repo-content.ts [dir] --markers   # markers only:
 *     "what else could this harness declare?" on a layer that already exists
 *   bun run cat-harness-tools/scripts/scan-repo-content.ts [dir] --markers --json   # markers only, as facts
 *   bun run cat scan:repo [dir] [--markers] [--json]                          # the same, from a layer root
 *
 * `--json` with `--markers` prints the {@link MarkerScan} of
 * `lib/content-markers.ts`; without it, the whole scan, `markers` included.
 *
 * @module scripts/scan-repo-content
 */

import { spawnSync } from "node:child_process";
import { LEGACY_HARNESS_CONFIG } from "../schemas/kg/harness-config.ts";
import { gitCorpus } from "../schemas/sdlc/git-corpus.ts";
import { CONFIG_SUFFIX, isReservedIndexFile } from "../schemas/kg/instance-roots.ts";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { formatMarkers, scanMarkers, type MarkerScan } from "./lib/content-markers.ts";

export type Bucket = "library" | "content" | "unclassified";

export type MathCandidateClassification =
  | "math_proof"
  | "computation_script"
  | "macro_definition"
  | "audit_refutation"
  | "derivation_note";

export type LinkStatus = "linked" | "unlinked";

export interface MathCandidate {
  /** Path relative to the scanned root, with `/` separators. */
  path: string;
  /** Candidate classification for the math/computational artifact. */
  classification: MathCandidateClassification;
  /** Alias for classification (for callers querying `candidate.kind`). */
  kind: MathCandidateClassification;
  /** Alias for path (for callers querying `candidate.location`). */
  location: string;
  /** Rationale for why this file was classified into this candidate category. */
  rationale: string;
  /**
   * Link status relative to the content tree:
   * 'linked' if referenced by any block/manifest/file in the content tree,
   * 'unlinked' if orphaned (not referenced by any content block).
   */
  linkStatus: LinkStatus;
  /** Which files in the content tree link to this artifact, if any. */
  linkedBy?: string[];
  bytes: number;
}

export interface ScanEntry {
  /** Path relative to the scanned root, with `/` separators. */
  path: string;
  bucket: Bucket;
  /** Why it landed there, in a few words an author can argue with. */
  why: string;
  bytes: number;
}

export interface ScanGroup {
  /** Directory the group is keyed on — `.` for the root. */
  dir: string;
  bucket: Bucket;
  files: number;
  bytes: number;
  /** Up to five example paths, so a report never becomes a file listing. */
  examples: string[];
  /** The distinct reasons contributing to this group. */
  why: string[];
}

export interface ScanResult {
  root: string;
  /** Whether the tree came from `git ls-files` or a filesystem walk. */
  source: "git" | "filesystem";
  entries: ScanEntry[];
  groups: ScanGroup[];
  totals: Record<Bucket, { files: number; bytes: number }>;
  /** Paths skipped as folio scaffolding or VCS bookkeeping, counted only. */
  skipped: number;
  /** Mathematical and computational artifacts detected outside the content tree. */
  mathCandidates: MathCandidate[];
  /**
   * Content markers a harness could declare, and whether it already does.
   * Reported, never declared: see the module docs.
   */
  markers: MarkerScan;
}

/** Extensions that are source material whoever authored them. */
const LIBRARY_EXT = new Set([
  ".pdf", ".epub", ".djvu", ".ps",
  ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".odt", ".ods", ".odp",
  ".bib", ".ris", ".enl", ".nbib",
  ".csv", ".tsv", ".parquet",
  ".mp3", ".wav", ".m4a", ".flac", ".mp4", ".mov", ".webm",
  ".tif", ".tiff", ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",
]);

/** Extensions that are prose somebody wrote here. */
const CONTENT_EXT = new Set([".md", ".markdown", ".rst", ".org", ".adoc", ".tex", ".txt"]);

/** Directory names that say "external source" loudly enough to override extension. */
const LIBRARY_DIRS = new Set([
  "library", "sources", "source-material", "papers", "references", "refs",
  "bibliography", "literature", "reading", "scans", "uploads", "attachments",
  "data", "datasets", "corpus", "archive", "pdfs",
]);

/** Directory names that say "authored here". */
const CONTENT_DIRS = new Set([
  "content", "docs", "doc", "documentation", "notes", "drafts", "draft",
  "chapters", "sections", "manuscript", "book", "paper", "papers-src",
  "writing", "posts", "_posts", "articles", "guides", "spec", "specs",
]);

/** Paths that are neither the author's material nor a question — just noise. */
const SKIP_DIRS = new Set([
  ".git", ".github", ".vscode", ".idea", "beans", ".claude",
  // Moved out of `.harness/` on 2026-09-20 and DECLARED, so they are skipped
  // by name rather than by a dot-prefix that no longer exists.
  "interaction", "issue-marks",
  "node_modules", ".venv", "venv", "__pycache__", "dist", "build", "target",
  ".next", ".cache", "coverage", ".lake", ".pytest_cache", "vendor",
]);

const SKIP_FILES = new Set([
  ".gitignore", ".gitattributes", ".gitmodules", ".editorconfig",
  "package-lock.json", "bun.lock", "bun.lockb", "yarn.lock", "pnpm-lock.yaml",
  "poetry.lock", "cargo.lock", "gemfile.lock",
  "license", "licence", "copying", "notice",
]);

/**
 * Files the folio itself owns. Present on a repo that has already been
 * converted; skipping them keeps a re-run from proposing to import the
 * scaffolding it wrote last time.
 */
// The config is matched by SUFFIX now, not by name: it is
// `<instance>.config.json` as of 2026-09-20 and this module scans a
// repository it may not yet have a declaration for. The retired global name
// stays in the set so a re-run over a not-yet-migrated repo still skips it
// rather than proposing to import it as content.
const FOLIO_FILES = new Set([
  LEGACY_HARNESS_CONFIG, "agents.md", "claude.md", "gemini.md", ".mcp.json",
]);

function isSkipped(rel: string): boolean {
  const parts = rel.split("/");
  if (parts.some((p) => SKIP_DIRS.has(p))) return true;
  const base = parts[parts.length - 1]!.toLowerCase();
  // A root `<name>.config.json`, or a reserved `index.*` file the platform
  // owns (`index.config.json`, `index.lock.json`) — the suffix and the
  // reservation come from `instance-roots.ts`, not a local copy.
  if (parts.length === 1 && (base.endsWith(CONFIG_SUFFIX) || isReservedIndexFile(base))) return true;
  if (SKIP_FILES.has(base) || FOLIO_FILES.has(base)) return true;
  // A dotfile sitting at the repo root is configuration, not the author's work.
  if (base.startsWith(".") && parts.length === 1) return true;
  return false;
}

/**
 * Classify one path. Directory convention beats extension, because an author
 * who put a `.md` in `references/` meant it as a reference — and because the
 * directory is a statement of intent while the extension is an accident of
 * tooling.
 */
export function classify(rel: string): { bucket: Bucket; why: string } {
  const parts = rel.split("/");
  const dirs = parts.slice(0, -1).map((d) => d.toLowerCase());
  const ext = extname(rel).toLowerCase();

  const libDir = dirs.find((d) => LIBRARY_DIRS.has(d));
  if (libDir) return { bucket: "library", why: `under ${libDir}/` };

  const contentDir = dirs.find((d) => CONTENT_DIRS.has(d));
  if (contentDir) return { bucket: "content", why: `under ${contentDir}/` };

  if (LIBRARY_EXT.has(ext)) return { bucket: "library", why: `${ext} is source material` };
  if (CONTENT_EXT.has(ext)) return { bucket: "content", why: `${ext} is prose` };

  return {
    bucket: "unclassified",
    why: ext ? `no rule for ${ext}` : "no extension, no directory hint",
  };
}

/** Prefer git's view of the tree: it already honours `.gitignore`. */
export function listFiles(root: string): { files: string[]; source: "git" | "filesystem" } {
  const NUL = String.fromCharCode(0);
  const r = spawnSync("git", ["-C", root, "ls-files", "-z"], { encoding: "buffer" });
  if (r.status === 0 && r.stdout) {
    const files = r.stdout.toString("utf-8").split(NUL).filter(Boolean);
    // A tree its enclosing git IGNORES — a layer remote-mounted into an
    // index checkout — lists nothing here although it holds a whole
    // repository's files. `gitCorpus` counts a mount's files as git's own.
    if (files.length === 0) {
      const corpus = gitCorpus(root);
      if (corpus !== undefined && corpus.length > 0) {
        return { files: corpus.map((f) => relative(root, f).split(sep).join("/")).sort(), source: "git" };
      }
    }
    return { files, source: "git" };
  }
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) out.push(relative(root, full).split(sep).join("/"));
    }
  };
  walk(root);
  return { files: out, source: "filesystem" };
}

/**
 * Classify a file outside the content tree as a mathematical/computational candidate.
 * Returns null if the file is not a recognized math artifact.
 */
export function classifyMathCandidate(
  rel: string,
  absRoot?: string,
): { classification: MathCandidateClassification; kind: MathCandidateClassification; rationale: string } | null {
  const parts = rel.split("/");
  const dirs = parts.slice(0, -1).map((d) => d.toLowerCase());
  const base = parts[parts.length - 1]!.toLowerCase();
  const ext = extname(rel).toLowerCase();
  const nameWithoutExt = ext ? base.slice(0, -ext.length) : base;

  // Read content snippet if file is available on disk (up to 4KB for quick regex check)
  let contentSnippet = "";
  if (absRoot) {
    try {
      const full = join(absRoot, rel);
      if (existsSync(full)) {
        const buf = readFileSync(full, { encoding: "utf-8" });
        contentSnippet = buf.slice(0, 4096);
      }
    } catch {
      // Unreadable or virtual file
    }
  }

  // 1. Audit Refutations: files that refute, falsify, or audit claims/theorems/conjectures
  const isAuditDir = dirs.some((d) => d === "audits" || d === "audit" || d === "verification" || d === "checks");
  const hasRefutationName = /(is[-_]false|false|refut|counterexample|disproof|mismatch|defect|contradiction|invalid|bug)/i.test(nameWithoutExt);
  const hasRefutationContent = /(theorem.*is_false|lemma.*is_false|refut|is[-_]false|counterexample|disproof|contradiction|falsif|does not hold|claim.*false|false claim)/i.test(contentSnippet);

  if (hasRefutationName || (isAuditDir && hasRefutationContent)) {
    const rationale = hasRefutationName
      ? `Audit refutation of mathematical claim (named refutation/counterexample: ${parts[parts.length - 1]})`
      : `Audit refutation or verification defect under ${dirs.join("/")}`;
    return { classification: "audit_refutation", kind: "audit_refutation", rationale };
  }

  // 2. Math Proofs: Formal proofs (Lean, Coq, Isabelle)
  if (ext === ".lean" || ext === ".v" || ext === ".thy") {
    const lang = ext === ".lean" ? "Lean" : ext === ".v" ? "Coq" : "Isabelle";
    return {
      classification: "math_proof",
      kind: "math_proof",
      rationale: `Formal ${lang} proof or theorem outside content tree (${ext})`,
    };
  }

  // 3. Computation Scripts: Python, Sage, Julia, Notebooks, Octave/Matlab
  const isCompExt = ext === ".py" || ext === ".sage" || ext === ".spyx" || ext === ".ipynb" || ext === ".jl" || ext === ".m";
  if (isCompExt) {
    const isCompDir = dirs.some((d) =>
      ["computations", "computation", "calc", "calculations", "simulations", "simulation", "simulators", "math", "analysis", "audits", "audit"].includes(d),
    );
    const hasCompName = /(compute|calc|verify|simulat|orbit|spectrum|mass|integral|matrix|eigen|solve|numerical|formula|model|check)/i.test(nameWithoutExt);
    const hasMathImports = /(import numpy|import scipy|import sympy|import mpmath|import math|from sympy|from scipy|from math|cvxpy|clarabel|sage)/i.test(contentSnippet);

    if (isCompDir || hasCompName || hasMathImports) {
      const why = isCompDir ? `under ${dirs.join("/")}/` : hasCompName ? `computational naming (${parts[parts.length - 1]})` : "contains scientific/math imports";
      return {
        classification: "computation_script",
        kind: "computation_script",
        rationale: `Mathematical computation or numerical verification script outside content tree (${why})`,
      };
    }
  }

  // 4. Macro Definitions: TeX macros, custom commands, environments, or math tables
  if (ext === ".tex" || ext === ".sty" || ext === ".cls") {
    const isMacroDir = dirs.some((d) => ["macros", "tables", "preamble", "defs"].includes(d));
    const hasMacroName = /(macro|preamble|def|defs|command|symbol|table)/i.test(nameWithoutExt);
    const hasMacroContent = /\\(newcommand|renewcommand|def|DeclareMathOperator|begin\{tabular\}|begin\{table\})/i.test(contentSnippet);

    if (isMacroDir || hasMacroName || hasMacroContent) {
      const why = isMacroDir ? `under ${dirs.join("/")}/` : hasMacroName ? `macro/table naming (${parts[parts.length - 1]})` : "contains macro or table definitions";
      return {
        classification: "macro_definition",
        kind: "macro_definition",
        rationale: `TeX macro definitions, preamble commands, or standalone table fragments (${why})`,
      };
    }
  }

  // 5. Derivation Notes: Informal math derivations, working notes, scratchpads
  const isNoteExt = ext === ".md" || ext === ".markdown" || ext === ".txt" || ext === ".rst" || ext === ".org" || ext === ".tex";
  if (isNoteExt) {
    const isNoteDir = dirs.some((d) => ["notes", "derivations", "derivation", "working-notes", "scratch", "audits", "audit"].includes(d));
    const hasNoteName = /(derivation|scratchpad|working[-_]notes|proof[-_]notes|calc[-_]notes|math[-_]notes)/i.test(nameWithoutExt);
    const hasMathCues = /(\$.*?\$|\\\[.*?\\\]|\\begin\{equation\}|derivation|proof of|equation)/i.test(contentSnippet);

    if (isNoteDir || hasNoteName || (hasMathCues && (dirs.includes("docs") || dirs.length === 0))) {
      const why = isNoteDir ? `under ${dirs.join("/")}/` : hasNoteName ? `derivation naming (${parts[parts.length - 1]})` : "contains mathematical derivation cues";
      return {
        classification: "derivation_note",
        kind: "derivation_note",
        rationale: `Mathematical derivation note or scratchpad outside content tree (${why})`,
      };
    }
  }

  return null;
}

/**
 * Scan for mathematical and computational artifacts outside the content tree.
 *
 * Checks files outside `content/` (or `folio/`, etc.) for proofs, computation scripts,
 * TeX macros/tables, audit refutations, and derivation notes, reporting their rationale
 * and whether they are linked by any content block in the primary content tree.
 */
export function scanMathCandidates(root: string, files?: string[]): MathCandidate[] {
  const abs = resolve(root);
  const fileList = files ?? listFiles(abs).files;

  // Identify primary content tree directories if present in this repository
  const PRIMARY_CONTENT_DIRS = ["content", "folio", "manuscript", "paper", "chapters", "sections"];
  const presentContentRoots = new Set<string>();
  for (const dir of PRIMARY_CONTENT_DIRS) {
    if (fileList.some((f) => f.startsWith(`${dir}/`)) || existsSync(join(abs, dir))) {
      presentContentRoots.add(dir);
    }
  }

  const contentFiles: string[] = [];
  const outsideFiles: string[] = [];

  for (const rel of fileList) {
    if (isSkipped(rel)) continue;
    const firstSegment = rel.split("/")[0];
    if (presentContentRoots.size > 0 && presentContentRoots.has(firstSegment)) {
      contentFiles.push(rel);
    } else {
      outsideFiles.push(rel);
    }
  }

  // Load content tree text files to determine link status
  const contentContents: Array<{ path: string; text: string }> = [];
  const TEXT_EXTS = new Set([".md", ".markdown", ".json", ".yaml", ".yml", ".tex", ".lean", ".rst", ".txt", ".ts"]);
  for (const cf of contentFiles) {
    const ext = extname(cf).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    try {
      const text = readFileSync(join(abs, cf), "utf-8");
      contentContents.push({ path: cf, text });
    } catch {
      // Unreadable or virtual file
    }
  }

  const candidates: MathCandidate[] = [];

  for (const rel of outsideFiles) {
    const classified = classifyMathCandidate(rel, abs);
    if (!classified) continue;

    let bytes = 0;
    try {
      bytes = statSync(join(abs, rel)).size;
    } catch {
      // Unreadable or virtual file
    }

    const base = rel.split("/").pop()!;
    const linkedBy: string[] = [];

    for (const { path: cPath, text } of contentContents) {
      if (
        text.includes(rel) ||
        text.includes(`/${rel}`) ||
        text.includes(base)
      ) {
        linkedBy.push(cPath);
      }
    }

    const linkStatus: LinkStatus = linkedBy.length > 0 ? "linked" : "unlinked";

    candidates.push({
      path: rel,
      classification: classified.classification,
      kind: classified.kind,
      location: rel,
      rationale: classified.rationale,
      linkStatus,
      ...(linkedBy.length > 0 ? { linkedBy } : {}),
      bytes,
    });
  }

  return candidates.sort((a, b) => a.path.localeCompare(b.path));
}

export function scanRepo(root: string): ScanResult {
  const abs = resolve(root);
  const { files, source } = listFiles(abs);

  const entries: ScanEntry[] = [];
  let skipped = 0;

  for (const rel of files) {
    if (isSkipped(rel)) {
      skipped++;
      continue;
    }
    const { bucket, why } = classify(rel);
    let bytes = 0;
    try {
      bytes = statSync(join(abs, rel)).size;
    } catch {
      // A file git knows about but the working tree does not (a broken symlink,
      // a sparse checkout). Counted at zero rather than dropped: the author
      // should still see it listed.
    }
    entries.push({ path: rel, bucket, why, bytes });
  }

  const totals: Record<Bucket, { files: number; bytes: number }> = {
    library: { files: 0, bytes: 0 },
    content: { files: 0, bytes: 0 },
    unclassified: { files: 0, bytes: 0 },
  };
  for (const e of entries) {
    totals[e.bucket].files++;
    totals[e.bucket].bytes += e.bytes;
  }

  // Group by (directory, bucket). The author decides per directory, never per
  // file — a 400-row confirmation loop is the accessibility failure in
  // interaction-modality.md §0 with extra steps.
  const byKey = new Map<string, ScanGroup>();
  for (const e of entries) {
    const slash = e.path.lastIndexOf("/");
    const dir = slash === -1 ? "." : e.path.slice(0, slash);
    const key = `${dir}\t${e.bucket}`;
    let g = byKey.get(key);
    if (!g) {
      g = { dir, bucket: e.bucket, files: 0, bytes: 0, examples: [], why: [] };
      byKey.set(key, g);
    }
    g.files++;
    g.bytes += e.bytes;
    if (g.examples.length < 5) g.examples.push(e.path);
    if (!g.why.includes(e.why)) g.why.push(e.why);
  }

  const groups = [...byKey.values()].sort(
    (a, b) => b.files - a.files || a.dir.localeCompare(b.dir),
  );

  const mathCandidates = scanMathCandidates(abs, files);
  const markers = scanMarkers(abs, files);

  return { root: abs, source, entries, groups, totals, skipped, mathCandidates, markers };
}

const human = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
};

export function formatScan(r: ScanResult): string {
  const out: string[] = [];
  out.push(`Scanned ${r.root}`);
  out.push(
    r.source === "git"
      ? "  file list: git ls-files (.gitignore honoured)"
      : "  file list: filesystem walk — not a git repo, so .gitignore was NOT applied",
  );
  out.push("");

  const order: Bucket[] = ["library", "content", "unclassified"];
  const label: Record<Bucket, string> = {
    library: "library/ — source material somebody else wrote",
    content: "folio/ — prose authored here",
    unclassified: "unclassified — I could not tell; you decide",
  };

  for (const b of order) {
    const t = r.totals[b];
    out.push(`${label[b]}: ${t.files} file(s), ${human(t.bytes)}`);
    const gs = r.groups.filter((g) => g.bucket === b).slice(0, 8);
    for (const g of gs) {
      const where = g.dir === "." ? "(repo root)" : `${g.dir}/`;
      out.push(`   ${where} — ${g.files} file(s), ${human(g.bytes)}  [${g.why.join("; ")}]`);
      for (const ex of g.examples.slice(0, 3)) out.push(`      ${ex}`);
      if (g.files > 3) out.push(`      … and ${g.files - 3} more`);
    }
    const rest = r.groups.filter((g) => g.bucket === b).length - gs.length;
    if (rest > 0) out.push(`   … and ${rest} more director${rest === 1 ? "y" : "ies"}`);
    out.push("");
  }

  out.push(`${r.skipped} path(s) skipped as VCS bookkeeping, build output or folio scaffolding.`);
  out.push("");
  if (r.totals.unclassified.files > 0) {
    out.push(
      `${r.totals.unclassified.files} file(s) are unclassified. That is the scan working, not failing —\n` +
        "nothing is filed on a guess. Decide those by directory before anything moves.",
    );
  } else if (r.entries.length > 0) {
    out.push(
      "Nothing was left unclassified. On a real repository that is worth a second look:\n" +
        "suspect the rules rather than celebrate the result.",
    );
  }
  out.push("");

  if (r.mathCandidates && r.mathCandidates.length > 0) {
    const unlinkedCount = r.mathCandidates.filter((c) => c.linkStatus === "unlinked").length;
    out.push(
      `Outside-content mathematical candidates (${r.mathCandidates.length} artifact(s), ${unlinkedCount} unlinked):`,
    );
    out.push(
      "  WARNING: These files live OUTSIDE the content tree. A conversion carrying only the",
    );
    out.push(
      "  content tree drops them — including refutations showing claims that are false.",
    );
    out.push("");
    for (const c of r.mathCandidates) {
      const linkText =
        c.linkStatus === "linked"
          ? `linked by ${(c.linkedBy ?? []).join(", ")}`
          : "UNLINKED (danger of dropping!)";
      out.push(`   [${c.classification}] ${c.path} — ${human(c.bytes)}  [${linkText}]`);
      out.push(`      Rationale: ${c.rationale}`);
    }
    out.push("");
  }

  out.push(formatMarkers(r.markers));
  out.push("");

  out.push("This scan wrote nothing. Next: skills/conduct/conduct-core/repo-conversion.md §2 — three");
  out.push("questions (import or not; library or content; leave in place or reorganise) — and §2a,");
  out.push("which of the markers above the harness should declare. Nothing is declared unpicked.");
  return out.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markersOnly = args.includes("--markers");
  const dir = args.find((a) => !a.startsWith("--")) ?? ".";
  if (!existsSync(dir)) {
    console.error(`No such directory: ${dir}`);
    process.exit(2);
  }
  if (markersOnly) {
    // The post-setup question — "what else could I declare?" — needs no
    // bucket walk, so it does not pay for one.
    const m = scanMarkers(resolve(dir), listFiles(resolve(dir)).files);
    console.log(json ? JSON.stringify(m, null, 2) : formatMarkers(m));
  } else {
    const result = scanRepo(dir);
    console.log(json ? JSON.stringify(result, null, 2) : formatScan(result));
  }
}
