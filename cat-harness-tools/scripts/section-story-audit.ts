#!/usr/bin/env bun
/**
 * section-story-audit.ts — Audit section + chapter narrative compliance.
 *
 * Implements the §Story coherence (STRICT) policy. Walks every chapter /
 * section in the given paper and reports these finding kinds:
 *
 *   missing-section-story        major — section has no opening prose block
 *   section-lead-too-short        minor — section's prose lead has fewer
 *                                          paragraphs than the length-scale
 *                                          table requires (1 / 2 / 3 /
 *                                          4 paras for ≤5 / 6-12 / 13-20 /
 *                                          >20 non-prose blocks).
 *   section-lead-block-title-list minor — section's lead reads as a
 *                                          sequential listing of block
 *                                          titles ("arc runs from X through
 *                                          Y to Z") — generated mechanically,
 *                                          not motivated.
 *   generic-section-name          major — section label matches
 *                                          sec:.*-(part-N|extras|misc-N)$
 *   missing-chapter-intro         major — chapter has no opening narrative
 *   missing-chapter-manifest      major — chapter directory present in the
 *                                          paper manifest but the chapter
 *                                          .ts file is missing or
 *                                          unreadable. File existence only;
 *                                          TS / Zod parse errors are caught
 *                                          by content validation.
 *   abrupt-chapter-ending         minor — chapter's last block is not
 *                                          a closing prose block.
 *
 * The policy's `section-narrative-drift` kind (block ordering breaks the
 * story arc) is not implemented.
 *
 * The audit is read-only and deterministic. It does NOT draft missing leads
 * or intros — that needs editorial judgement; the author picks which findings
 * to fix.
 *
 * Usage:
 *   bun run cat-harness-tools/scripts/section-story-audit.ts                        # default paper
 *   bun run cat-harness-tools/scripts/section-story-audit.ts --paper <dir>          # explicit
 *   bun run cat-harness-tools/scripts/section-story-audit.ts --json                 # JSON output
 *   bun run cat-harness-tools/scripts/section-story-audit.ts --severity major       # major findings only
 *   bun run cat-harness-tools/scripts/section-story-audit.ts --out report.json      # write JSON
 *   bun run cat-harness-tools/scripts/section-story-audit.ts --ref <sha-or-branch>  # blob-URL ref
 *
 * Exit code is the count of MAJOR findings (capped at 255), so this can be
 * wired into CI as a quality gate.
 */

import { folioDirDeferred } from "../schemas/kg/cat-harness.js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { findContentRepoRoot } from "../pipeline/repo-root";
import { requirePaper } from "../pipeline/repo-root";

// Was `import.meta.dir`-relative, i.e. the PLATFORM — but every path below is
// folio content (`content/**`, `computations/**`), and this is used as the cwd
// for those globs. `findContentRepoRoot()` walks up from the real cwd;
// `import.meta.dir` resolves back through a folio's `folio-assistant/` symlink.
const REPO_ROOT = findContentRepoRoot();
const folioDirOf = folioDirDeferred(REPO_ROOT, import.meta.url);

const GENERIC_NAME_RE = /^sec:.*-(part-\d+|extras|misc-\d+)$/;
const BLOCK_TITLE_LIST_TELL =
  /\barc\s+runs\s+from\b|\bsection\s+covers\b.*\bthen\b.*\bfinally\b|\bfirst\s+we\b.*\bnext\s+we\b/i;

interface Finding {
  kind: string;
  severity: "major" | "minor";
  chapter: string;
  section?: string;
  detail: string;
  /** GitHub blob URL to the offending .ts manifest (chapter or section). */
  link: string;
}

interface BlockInfo {
  rootName: string;
  kind: string;
  label?: string;
  title?: string;
}

interface SectionInfo {
  title: string;
  label?: string;
  blocks: string[];
}

interface ChapterInfo {
  dir: string;
  title: string;
  label?: string;
  tabLabel?: string;
  sections: SectionInfo[];
}

function flagValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  if (idx < 0 || idx + 1 >= args.length) return null;
  const next = args[idx + 1];
  if (next.startsWith("--")) return null;
  return next;
}

function parseChapterList(paperManifest: string): string[] {
  const src = readFileSync(paperManifest, "utf-8");
  return [...src.matchAll(/chapterRef\(\s*\{\s*dir:\s*["']([^"']+)["']/gs)].map(m => m[1]);
}

function parseBlockTs(tsPath: string): { kind: string; label?: string; title?: string } | null {
  if (!existsSync(tsPath)) return null;
  const src = readFileSync(tsPath, "utf-8");
  const kindM = src.match(/\bexport\s+default\s+(\w+)\s*\(/);
  if (!kindM) return null;
  const kind = kindM[1];
  const labelM = src.match(/label:\s*["']([^"']+)["']/);
  const titleM = src.match(/title:\s*["']([^"']+)["']/);
  return { kind, label: labelM?.[1], title: titleM?.[1] };
}

function parseChapterManifest(paper: string, dir: string): ChapterInfo | null {
  const ts = join(folioDirOf(), paper, dir, `${dir}.ts`);
  if (!existsSync(ts)) return null;
  const src = readFileSync(ts, "utf-8");

  const titleM = src.match(/title:\s*["']([^"']+)["']/);
  const labelM = src.match(/label:\s*["']([^"']+)["']/);
  const tabLabelM = src.match(/tabLabel:\s*["']([^"']+)["']/);

  // Extract section(...) calls in source order.  Two patterns are
  // recognised: `section({ ... })` (the builder call) and
  // `Object.freeze({ ... })` (a plain object literal that satisfies the
  // Section interface — used in chapter manifests that bypass the
  // builder for tighter immutability).  Both yield the same shape;
  // we union them under a single regex.
  const sections: SectionInfo[] = [];
  // Robust against optional generic type parameters (`section<T>({…})`)
  // and `as const` / `as Section` trailing casts (`Object.freeze({…} as const)`).
  const sectionRe =
    /(?:\bsection|Object\.freeze)(?:<[^>]+>)?\(\s*\{([\s\S]*?)\}(?:\s+as\s+[^)]+)?\s*\)/g;
  let m;
  while ((m = sectionRe.exec(src)) !== null) {
    const body = m[1];
    const sTitle = body.match(/title:\s*["']([^"']+)["']/)?.[1] ?? "(untitled)";
    const sLabel = body.match(/label:\s*["']([^"']+)["']/)?.[1];
    const blocksMatch = body.match(/blocks:\s*\[([\s\S]*?)\]/);
    const blocks: string[] = [];
    if (blocksMatch) {
      // Strip `//` line comments first — apostrophes inside comments
      // (e.g. "paper's existing knot-indexed ...") would otherwise be
      // matched as quote delimiters and yield a spurious first block.
      const stripped = blocksMatch[1].replace(/\/\/[^\n]*/g, "");
      const blocksRe = /["']([^"']+)["']/g;
      let bm;
      while ((bm = blocksRe.exec(stripped)) !== null) {
        blocks.push(bm[1]);
      }
    }
    sections.push({ title: sTitle, label: sLabel, blocks });
  }

  return {
    dir,
    title: titleM?.[1] ?? dir,
    label: labelM?.[1],
    tabLabel: tabLabelM?.[1],
    sections,
  };
}

function isReferenceChapter(ch: ChapterInfo): boolean {
  // Reference-only chapters (per §738 wontfix:reference-chapter): glossary,
  // index, notation, appendices. These are not narrative chapters and
  // shouldn't be flagged for missing-intro / abrupt-ending.
  return (
    ch.dir === "glossary" ||
    ch.dir === "notation" ||
    ch.dir === "index-of-definitions" ||
    ch.dir.startsWith("appendix-")
  );
}

/** Ref used in the GitHub blob URLs the audit emits.  Defaults to the CI
 *  commit SHA / branch when available, falling back to `main` so links
 *  resolve when run locally on a clean checkout.  Can be overridden via
 *  the `--ref` CLI flag (set by the caller before `auditPaper` is run). */
let BLOB_REF: string =
  process.env.GITHUB_SHA ||
  process.env.GITHUB_REF_NAME ||
  "main";

/** Repository slug used in the GitHub blob URLs.  Picks up `$GITHUB_REPOSITORY`
 *  (set automatically in GitHub Actions) so links remain correct when the
 *  audit runs from a fork or mirrored repo.  Falls back to `litlfred/qou`
 *  for local runs against the canonical repository. */
const BLOB_REPO: string = process.env.GITHUB_REPOSITORY || "litlfred/qou";

function setBlobRef(ref: string): void { BLOB_REF = ref; }

function blobUrl(paper: string, chDir: string, basename?: string): string {
  const base = `https://github.com/${BLOB_REPO}/blob/${BLOB_REF}/content/${paper}/${chDir}`;
  return basename ? `${base}/${basename}` : `${base}/${chDir}.ts`;
}

/** Lead-paragraph count: rough estimate via blank-line splits in the .md. */
function leadParagraphCount(mdPath: string): number {
  if (!existsSync(mdPath)) return 0;
  const txt = readFileSync(mdPath, "utf-8").trim();
  if (!txt) return 0;
  // Split on 2+ newlines; count non-empty chunks.
  return txt.split(/\n{2,}/).filter(p => p.trim().length > 0).length;
}

function requiredLeadParas(blockCount: number): number {
  // §738 length-scale table:
  //   ≤ 5   → 1 paragraph
  //   6–12  → 2 paragraphs
  //   13–20 → 3 paragraphs
  //   > 20  → 4 paragraphs
  if (blockCount <= 5) return 1;
  if (blockCount <= 12) return 2;
  if (blockCount <= 20) return 3;
  return 4;
}

function auditPaper(paper: string): Finding[] {
  const findings: Finding[] = [];
  const paperManifest = join(folioDirOf(), paper, `${paper}.ts`);
  if (!existsSync(paperManifest)) {
    throw new Error(`Paper manifest not found: ${paperManifest}`);
  }

  for (const dir of parseChapterList(paperManifest)) {
    const ch = parseChapterManifest(paper, dir);
    if (!ch) {
      findings.push({
        kind: "missing-chapter-manifest",
        severity: "major",
        chapter: dir,
        detail: `Chapter manifest not found at folio/${paper}/${dir}/${dir}.ts`,
        link: blobUrl(paper, dir),
      });
      continue;
    }

    const isRef = isReferenceChapter(ch);

    // Resolve every block's kind (so we know if the first block is prose).
    const blockKinds = new Map<string, BlockInfo>();
    for (const sec of ch.sections) {
      for (const rn of sec.blocks) {
        if (blockKinds.has(rn)) continue;
        const ts = join(folioDirOf(), paper, dir, `${rn}.ts`);
        const info = parseBlockTs(ts);
        if (info) blockKinds.set(rn, { rootName: rn, ...info });
      }
    }

    // §738 chapter-level findings (skip for reference chapters).
    if (!isRef) {
      const firstSec = ch.sections[0];
      if (!firstSec) {
        findings.push({
          kind: "missing-chapter-intro",
          severity: "major",
          chapter: dir,
          detail: "Chapter has no sections at all",
          link: blobUrl(paper, dir),
        });
      } else {
        const firstBlock = firstSec.blocks[0];
        const firstInfo = firstBlock ? blockKinds.get(firstBlock) : undefined;
        const firstIsProse = firstInfo?.kind === "prose";
        // §738 §Story coherence (STRICT): the chapter's first block must
        // be a `prose` lead.  A section *labelled* "Introduction" that
        // nonetheless opens with a definition / proposition is just as
        // much a missing-chapter-intro violation as an un-labelled one —
        // the label is descriptive, not a substitute for the narrative
        // arc.  An unresolved block kind (parse failure) is treated as
        // non-prose so the violation surfaces.
        if (!firstIsProse) {
          findings.push({
            kind: "missing-chapter-intro",
            severity: "major",
            chapter: dir,
            section: firstSec.label,
            detail: `First block is ${firstInfo?.kind ?? "unresolved"} (${firstBlock}), not a prose lead — chapter opens without a narrative intro per §738 §Story coherence`,
            link: blobUrl(paper, dir),
          });
        }
      }

      // §738 abrupt-chapter-ending
      const lastSec = ch.sections[ch.sections.length - 1];
      if (lastSec) {
        const lastBlock = lastSec.blocks[lastSec.blocks.length - 1];
        const lastInfo = lastBlock ? blockKinds.get(lastBlock) : undefined;
        // Unknown block kinds are treated as non-prose so a parse failure
        // surfaces as a finding rather than silently passing the check.
        const lastIsProse = lastInfo?.kind === "prose";
        if (lastBlock && !lastIsProse) {
          const kindStr = lastInfo?.kind ?? "unresolved";
          findings.push({
            kind: "abrupt-chapter-ending",
            severity: "minor",
            chapter: dir,
            section: lastSec.label,
            detail: `Last block is ${kindStr} (${lastBlock}), not a closing prose block`,
            link: blobUrl(paper, dir),
          });
        }
      }
    }

    // Per-section findings.
    for (const sec of ch.sections) {
      // Skip the reference-chapter sections; their sections are catalogue
      // entries, not narrative arcs.
      if (isRef) continue;

      // Skip empty sections — they'll be caught by H4-sparse via the
      // detangler watcher; not our concern here.
      if (sec.blocks.length === 0) continue;

      // generic-section-name
      if (sec.label && GENERIC_NAME_RE.test(sec.label)) {
        findings.push({
          kind: "generic-section-name",
          severity: "major",
          chapter: dir,
          section: sec.label,
          detail: `Label "${sec.label}" matches the generic-name pattern (sec:*-part-N / *-extras / *-misc-N)`,
          link: blobUrl(paper, dir),
        });
      }

      // missing-section-story
      const firstBlock = sec.blocks[0];
      const firstInfo = blockKinds.get(firstBlock);
      const firstIsProse = firstInfo?.kind === "prose";
      // sectionSize = count of non-prose blocks.  Blocks whose kind we
      // couldn't resolve (parse failure / missing .ts) are conservatively
      // counted as non-prose — undercounting them silences a finding,
      // which is worse than over-counting and flagging an extra section.
      const sectionSize = sec.blocks.filter(b => {
        const k = blockKinds.get(b)?.kind;
        return k !== "prose"; // undefined ⇒ non-prose
      }).length;

      if (!firstIsProse && sectionSize > 0) {
        findings.push({
          kind: "missing-section-story",
          severity: "major",
          chapter: dir,
          section: sec.label ?? sec.title,
          detail: `Section "${sec.title}" opens with ${firstInfo?.kind ?? "unresolved"} (${firstBlock}), not a prose lead; ${sectionSize} non-prose blocks`,
          link: blobUrl(paper, dir, `${firstBlock}.ts`),
        });
      }

      // section-lead-too-short — applies across all §738 bands, including
      // the ≤5 band (which requires a 1-paragraph lead). Only meaningful
      // when the section has *some* non-prose content (sectionSize > 0).
      if (firstIsProse && sectionSize > 0) {
        const mdPath = join(folioDirOf(), paper, dir, `${firstBlock}.md`);
        const paras = leadParagraphCount(mdPath);
        const required = requiredLeadParas(sectionSize);
        if (paras < required) {
          findings.push({
            kind: "section-lead-too-short",
            severity: "minor",
            chapter: dir,
            section: sec.label ?? sec.title,
            detail: `Section has ${sectionSize} non-prose blocks (band requires ${required}-para lead); lead has ${paras} para(s)`,
            link: blobUrl(paper, dir, `${firstBlock}.md`),
          });
        }
      }

      // section-lead-block-title-list
      if (firstIsProse) {
        const mdPath = join(folioDirOf(), paper, dir, `${firstBlock}.md`);
        if (existsSync(mdPath)) {
          const txt = readFileSync(mdPath, "utf-8");
          if (BLOCK_TITLE_LIST_TELL.test(txt)) {
            findings.push({
              kind: "section-lead-block-title-list",
              severity: "minor",
              chapter: dir,
              section: sec.label ?? sec.title,
              detail: "Lead reads as a sequential listing of block titles ('arc runs from X through Y') — generated mechanically, not motivated",
              link: blobUrl(paper, dir, `${firstBlock}.md`),
            });
          }
        }
      }

      // section-narrative-drift: block ordering breaks the story arc.
      // §738 §Story coherence (STRICT) requires the narrative order:
      //   definitions → (proposition / lemma / theorem) immediately
      //   followed by its proof → examples / remarks / simulators
      // We catch two common drift signatures:
      //   (a) a `proof` block precedes its target `prop`/`lem`/`thm`/`cor`
      //       block at the same root (e.g. foo-proof appears before foo)
      //   (b) a block whose .ts carries `interprets: "X"` precedes the
      //       interpreted block X in document order
      // The check is conservative — it flags only same-section ordering
      // violations; cross-section drift is the detangler watcher's
      // responsibility.
      const blockPosition = new Map<string, number>();
      sec.blocks.forEach((b, i) => blockPosition.set(b, i));

      // Pre-read every block's .ts once into a typed map.  The previous
      // implementation re-read files inside the inner interprets scan,
      // making the worst case O(N²) disk reads per section.  Hoisting
      // the reads makes the scan O(N) reads + O(N²) memory lookups.
      const blockData = new Map<string, { interprets?: string; label?: string }>();
      for (const rn of sec.blocks) {
        const tsPath = join(folioDirOf(), paper, dir, `${rn}.ts`);
        if (!existsSync(tsPath)) continue;
        const tsSrc = readFileSync(tsPath, "utf-8");
        blockData.set(rn, {
          interprets: tsSrc.match(/interprets:\s*["']([^"']+)["']/)?.[1],
          label: tsSrc.match(/label:\s*["']([^"']+)["']/)?.[1],
        });
      }

      for (const rn of sec.blocks) {
        const pos = blockPosition.get(rn)!;
        // (a) proof-before-target — `foo-proof` precedes `foo`.
        const proofMatch = rn.match(/^(.+)-proof$/);
        if (proofMatch) {
          const target = proofMatch[1];
          const targetPos = blockPosition.get(target);
          if (targetPos !== undefined && targetPos > pos) {
            findings.push({
              kind: "section-narrative-drift",
              severity: "minor",
              chapter: dir,
              section: sec.label ?? sec.title,
              detail: `proof block "${rn}" precedes its target "${target}" in document order — breaks the definitions → claim → proof arc per §738`,
              link: blobUrl(paper, dir, `${rn}.ts`),
            });
          }
        }
        // (b) interprets-before-target — uses the pre-read blockData
        // map to compare positions without re-reading .ts files.
        const data = blockData.get(rn);
        if (!data?.interprets) continue;
        const interpretsLabel = data.interprets;
        for (const otherRn of sec.blocks) {
          const otherPos = blockPosition.get(otherRn)!;
          if (otherPos <= pos) continue;
          const otherData = blockData.get(otherRn);
          if (otherData?.label === interpretsLabel) {
            findings.push({
              kind: "section-narrative-drift",
              severity: "minor",
              chapter: dir,
              section: sec.label ?? sec.title,
              detail: `interpretation block "${rn}" (interprets ${interpretsLabel}) precedes its target "${otherRn}" — breaks document-order arc per §738`,
              link: blobUrl(paper, dir, `${rn}.ts`),
            });
            break;
          }
        }
      }
    }
  }

  return findings;
}

// ── CLI ─────────────────────────────────────────────────────────────

if (import.meta.main) {
  const args = process.argv.slice(2);
  const paper = requirePaper(flagValue(args, "--paper") ?? undefined);
  const severityFilter = flagValue(args, "--severity");
  const outPath = flagValue(args, "--out");
  const jsonOnly = args.includes("--json");
  const refOverride = flagValue(args, "--ref");
  if (refOverride) setBlobRef(refOverride);

  const findings = auditPaper(paper);
  const filtered = severityFilter
    ? findings.filter(f => f.severity === severityFilter)
    : findings;

  const result = {
    paper,
    generated_at: new Date().toISOString(),
    total: findings.length,
    by_severity: {
      major: findings.filter(f => f.severity === "major").length,
      minor: findings.filter(f => f.severity === "minor").length,
    },
    by_kind: findings.reduce<Record<string, number>>((acc, f) => {
      acc[f.kind] = (acc[f.kind] ?? 0) + 1;
      return acc;
    }, {}),
    findings: filtered,
  };

  if (jsonOnly) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Section-story audit — paper: ${paper}`);
    console.log(`Generated: ${result.generated_at}`);
    console.log(`Total findings: ${result.total} (major=${result.by_severity.major}, minor=${result.by_severity.minor})`);
    console.log("\nBy kind:");
    for (const [k, n] of Object.entries(result.by_kind).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(35)} ${n}`);
    }
    if (filtered.length === 0) {
      console.log("\nNo findings matching filter. Story-coherence policy clean.");
    } else {
      console.log(`\nFirst ${Math.min(40, filtered.length)} findings (showing ${severityFilter ?? "all severities"}):`);
      for (const f of filtered.slice(0, 40)) {
        const sev = f.severity === "major" ? "MAJOR" : "minor";
        const loc = f.section ? `${f.chapter}/${f.section}` : f.chapter;
        console.log(`  [${sev}] ${f.kind.padEnd(30)} ${loc}`);
        console.log(`         ${f.detail}`);
        console.log(`         ${f.link}`);
      }
      if (filtered.length > 40) {
        console.log(`  …(${filtered.length - 40} more)`);
      }
    }
  }

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(result, null, 2));
    if (!jsonOnly) console.error(`\nWrote: ${outPath}`);
  }

  // Exit code = major-finding count (capped at 255) so this can gate CI.
  process.exit(Math.min(255, result.by_severity.major));
}

export { auditPaper };
export type { Finding };
