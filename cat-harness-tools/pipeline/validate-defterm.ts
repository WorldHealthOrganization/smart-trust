/**
 * Glossary-term validation (Phase B of the `\defterm` / `\refterm` rollout).
 *
 * AST-driven — no grep over raw markdown. Walks each block's parsed mdast
 * tree (cached by `parseMdCached`) looking for `textDirective` nodes whose
 * `name` is `defterm` or `refterm`. Validates declaration, coverage,
 * resolution, uniqueness, and (opt-in) bare-text mention coverage against
 * the folio-wide glossary index.
 *
 * @module pipeline/validate-defterm
 */
import { visit } from "unist-util-visit";
import type { TextDirective } from "mdast-util-directive";
// Ambient: registers the directive node types on the mdast unions.
import type {} from "mdast-util-directive";
import type {} from "mdast-util-math";
import type { Block, ValidationIssue } from "../schemas/types.ts";
import { parseMdCached } from "./markdown-ast";

/** Resolve the slug for a defterm/refterm node. */
function nodeSlug(node: TextDirective): { slug: string; label: string } {
  const label = (node.children ?? [])
    .map((c) => ("value" in c && typeof c.value === "string" ? c.value : ""))
    .join("")
    .trim();
  const explicit = node.attributes && (node.attributes.id || node.attributes["#"]);
  const slug = (explicit ? String(explicit) : label).trim();
  return { slug, label };
}

/**
 * Per-block summary of glossary directives found in its `.md` body.
 * Keys are slugs; values are first-occurrence positions for diagnostics.
 */
export interface BlockTermUsage {
  defs: Map<string, { label: string }>;
  refs: Map<string, { label: string }>;
  /** Plain text concatenation of paragraph text nodes (for coverage scan). */
  plainText: string;
}

/**
 * Walk a block's mdast and collect every `:defterm[…]` / `:refterm[…]`
 * directive plus the joined plain-text body.
 */
function collectBlockUsage(md: string): BlockTermUsage {
  const tree = parseMdCached(md);
  const defs = new Map<string, { label: string }>();
  const refs = new Map<string, { label: string }>();
  const textParts: string[] = [];

  visit(tree, (node, _index, parent) => {
    if (node.type === "textDirective") {
      if (node.name === "defterm") {
        const { slug, label } = nodeSlug(node);
        if (slug && !defs.has(slug)) defs.set(slug, { label });
      } else if (node.name === "refterm") {
        const { slug, label } = nodeSlug(node);
        if (slug && !refs.has(slug)) refs.set(slug, { label });
      }
    } else if (node.type === "text" && parent && parent.type !== "textDirective") {
      // Skip text nodes inside directives (already counted as label). Math
      // and code need no test: they are mdast literal nodes with no `text`
      // children to reach.
      textParts.push(node.value);
    }
  });

  return { defs, refs, plainText: textParts.join(" ") };
}

/**
 * Build a folio-wide index: slug → list of block labels declaring it.
 */
export function buildGlossaryIndex(
  blocks: Iterable<{ name: string; block: Block }>,
): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const { name, block } of blocks) {
    // `defines` is absent from `diagram`/`equation`/`table` in both the TS
    // union and the Zod schema, so the `in` test is real — the cast was not.
    const defines = "defines" in block ? block.defines : undefined;
    if (!defines) continue;
    for (const slug of defines) {
      const list = index.get(slug) ?? [];
      list.push(name);
      index.set(slug, list);
    }
  }
  return index;
}

export interface DeftermValidationOptions {
  /** Enable `term-mention-coverage` (warns on bare-text known-term mentions). */
  strict?: boolean;
  /**
   * The `blocks` map is in reading order (paper chapters in order, each
   * chapter's `sections[].blocks[]` in order). Enables `defterm-forward-ref`.
   * Off by default: a flat-mode map has no meaningful order.
   */
  readingOrder?: boolean;
  /**
   * Chapter directory names whose definitions are exempt from
   * `defterm-forward-ref`. A glossary chapter is back matter, so every term
   * it defines is "later" than every body use by design. Default
   * `["glossary"]`.
   */
  forwardRefExemptDirs?: string[];
  /**
   * Block kinds whose OWN prose is exempt from `defterm-forward-ref`. A
   * `prose` block is pure exposition (chapter overviews, section intros,
   * transitions), and naming what the next block defines is its job. Default
   * `["prose"]`. Owner ruling 2026-11-21 (qou thread "Turn the Lean build
   * green on main", option "Narrow the check").
   */
  forwardRefExemptKinds?: string[];
}

/** Shortest phrase `defterm-forward-ref` will look for in bare prose. */
const FORWARD_REF_MIN_PHRASE = 4;

function lastPathSegment(dir: string | undefined): string | undefined {
  if (!dir) return undefined;
  const parts = dir.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1];
}

/**
 * Run all glossary-term validation rules against a set of loaded blocks.
 *
 * @param blocks  Map of root-name → block (and its `.md` content).
 * @param opts    Strict-mode toggle.
 * @returns       Validation issues to merge into the main pipeline output.
 */
export function validateDefterms(
  blocks: Map<string, { block: Block; md: string | undefined; dir?: string }>,
  opts: DeftermValidationOptions = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Build per-block usage and global index in one pass.
  const usageByBlock = new Map<string, BlockTermUsage>();
  for (const [name, { md }] of blocks) {
    if (!md) {
      usageByBlock.set(name, { defs: new Map(), refs: new Map(), plainText: "" });
      continue;
    }
    try {
      usageByBlock.set(name, collectBlockUsage(md));
    } catch (e) {
      issues.push({
        level: "warning",
        block: name,
        message: `defterm: mdast parse failed (${e instanceof Error ? e.message : String(e)})`,
      });
      usageByBlock.set(name, { defs: new Map(), refs: new Map(), plainText: "" });
    }
  }

  const blockEntries = [...blocks.entries()].map(([name, { block }]) => ({ name, block }));
  const glossaryIndex = buildGlossaryIndex(blockEntries);

  // ── Rule: defterm-unique ──
  for (const [slug, owners] of glossaryIndex) {
    if (owners.length > 1) {
      // Report on every owner so all participating authors are notified.
      for (const owner of owners) {
        issues.push({
          level: "warning",
          block: owner,
          message: `defterm-unique: term "${slug}" declared by multiple blocks (${owners.join(", ")})`,
        });
      }
    }
  }

  // ── Rule: defterm-declared, defterm-marked ──
  for (const [name, { block }] of blocks) {
    const usage = usageByBlock.get(name)!;
    const defines = ("defines" in block ? block.defines : undefined) ?? [];
    const declaredSet = new Set(defines);

    // defterm-declared (error): every :defterm[X] must appear in defines[]
    for (const slug of usage.defs.keys()) {
      if (!declaredSet.has(slug)) {
        issues.push({
          level: "error",
          block: name,
          message: `defterm-declared: :defterm[${slug}] is not listed in defines[] of this block`,
          file: `${name}.md`,
        });
      }
    }

    // defterm-marked (error): every defines[] entry must have a defterm node.
    // Promoted warning → error 2026-07-07: as a warning this accumulated
    // silently (17 unmarked terms piled up across the QOU corpus, only
    // surfaced by a whole-paper validate). An unmarked defines[] term means
    // the glossary/hyperref for that term is never emitted, so the block
    // under-delivers on its own metadata — a hard authoring bug, not advisory.
    for (const slug of defines) {
      if (!usage.defs.has(slug)) {
        issues.push({
          level: "error",
          block: name,
          message: `defterm-marked: defines[] entry "${slug}" has no :defterm[${slug}] in this block's .md`,
          file: `${name}.md`,
        });
      }
    }
  }

  // ── Rule: refterm-resolves ──
  for (const [name] of blocks) {
    const usage = usageByBlock.get(name)!;
    for (const slug of usage.refs.keys()) {
      if (!glossaryIndex.has(slug)) {
        issues.push({
          level: "error",
          block: name,
          message: `refterm-resolves: :refterm[${slug}] does not match any block's defines[]`,
          file: `${name}.md`,
        });
      }
    }
  }

  // ── Rule: term-mention-coverage (strict only) ──
  if (opts.strict && glossaryIndex.size > 0) {
    // Build a phrase tokenizer keyed on the canonical visible labels of each
    // declared slug. We accept either the slug-as-words form (hyphens → spaces)
    // or any visible label observed at a defterm site.
    const phrases = new Map<string, string>(); // lowercase phrase → slug
    for (const slug of glossaryIndex.keys()) {
      phrases.set(slug.replace(/-/g, " "), slug);
    }
    for (const usage of usageByBlock.values()) {
      for (const [slug, { label }] of usage.defs) {
        if (label) phrases.set(label.toLowerCase(), slug);
      }
    }

    // Sort phrases longest-first so multi-word phrases match before substrings,
    // and pre-compile the word-boundary regex for each phrase once. Building
    // the RegExp inside the per-block loop is wasteful since the phrase set
    // is constant for the entire validation pass.
    const compiledPhrases = [...phrases.entries()]
      .sort((a, b) => b[0].length - a[0].length)
      .map(([phrase, slug]) => ({
        phrase,
        slug,
        re: new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`),
      }));

    for (const [name] of blocks) {
      const usage = usageByBlock.get(name)!;
      if (!usage.plainText) continue;
      const wrappedSlugs = new Set<string>(usage.refs.keys());
      const definedHere = new Set<string>(usage.defs.keys());
      const haystack = usage.plainText.toLowerCase();

      for (const { phrase, slug, re } of compiledPhrases) {
        if (definedHere.has(slug)) continue; // defterm site, skip
        if (wrappedSlugs.has(slug)) continue; // at least one refterm present
        if (re.test(haystack)) {
          issues.push({
            level: "warning",
            block: name,
            message: `term-mention-coverage: bare-text mention of "${phrase}" should be wrapped in :refterm[${slug}]`,
            file: `${name}.md`,
          });
        }
      }
    }
  }

  // ── Rule: defterm-forward-ref (warning; reading order only) ──
  // A term mentioned in prose before the block that defines it, in reading
  // order. Two forms: a bare-text mention of the term, and a :refterm link
  // to a block that comes later. Definitions in an exempt chapter (the
  // glossary, which is back matter) never fire. Bean `qou-ommr`; owner
  // ruling 2026-11-21: warn only, body-defined terms only.
  if (opts.readingOrder) {
    issues.push(...forwardRefIssues(blocks, usageByBlock, opts));
  }

  return issues;
}

function forwardRefIssues(
  blocks: Map<string, { block: Block; md: string | undefined; dir?: string }>,
  usageByBlock: Map<string, BlockTermUsage>,
  opts: DeftermValidationOptions,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const exempt = new Set(opts.forwardRefExemptDirs ?? ["glossary"]);
  const exemptKinds = new Set(opts.forwardRefExemptKinds ?? ["prose"]);
  const order = [...blocks.keys()];
  const pos = new Map(order.map((n, i) => [n, i]));

  // slug -> first defining block in reading order, with its visible label.
  const firstDef = new Map<string, { at: number; name: string; label: string }>();
  for (const name of order) {
    for (const [slug, { label }] of usageByBlock.get(name)!.defs) {
      if (!firstDef.has(slug)) firstDef.set(slug, { at: pos.get(name)!, name, label });
    }
  }

  const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const [slug, def] of firstDef) {
    if (exempt.has(lastPathSegment(blocks.get(def.name)!.dir) ?? "")) continue;
    // The visible label is the term as the author wrote it; the slug is an
    // identifier. Match the slug only when there is no label, so
    // `:defterm[descent homomorphism]{#descent}` does not fire on every
    // ordinary use of the word "descent".
    const phrases = [def.label ? def.label.toLowerCase() : slug.replace(/-/g, " ").toLowerCase()]
      .filter((x) => x.length >= FORWARD_REF_MIN_PHRASE)
      .map((x) => new RegExp(`(?<![\\w-])${escape(x)}(?![\\w-])`));
    for (let i = 0; i < def.at; i++) {
      const name = order[i];
      if (exemptKinds.has(String((blocks.get(name)!.block as { kind?: unknown }).kind))) continue;
      const usage = usageByBlock.get(name)!;
      if (usage.refs.has(slug)) {
        issues.push({
          level: "warning",
          block: name,
          message: `defterm-forward-ref: :refterm[${slug}] points forward to ${def.name}, which defines it later in reading order`,
          file: `${name}.md`,
        });
        continue;
      }
      const hay = usage.plainText.toLowerCase();
      if (hay && phrases.some((re) => re.test(hay))) {
        issues.push({
          level: "warning",
          block: name,
          message: `defterm-forward-ref: "${def.label || slug}" is used before ${def.name} defines it (reading order)`,
          file: `${name}.md`,
        });
      }
    }
  }
  return issues;
}
