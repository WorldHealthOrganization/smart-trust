/**
 * Audit script: find remarks without formal backing.
 *
 * A "dangling remark" is a remark block that:
 *   1. Has no `interprets` field linking to a provable block
 *   2. Is not a glossary remark (no "glossary" tag)
 *
 * Usage:
 *   cd content && bun run cat-harness-tools/pipeline/find-dangling-remarks.ts [paper-dir]
 *
 * Output: structured report of all remarks, classified as:
 *   - BACKED: has `interprets` field
 *   - GLOSSARY: has "glossary" tag
 *   - DANGLING: neither — needs resolution
 *
 * @module pipeline/find-dangling-remarks
 */

import { readdirSync, existsSync, statSync } from "fs";
import { resolve, join } from "path";
import { requirePaper } from "./repo-root";
// The term list is FOLIO content — which words a paper treats as needing a
// formal backing is a judgement about its own subject. Injected, not inlined.
import { termsNeedingDefinitions } from "./chapter-profile-registry-di";

// ── Types ────────────────────────────────────────────────────────

interface RemarkInfo {
  label: string;
  title?: string;
  file: string;
  interprets?: string;
  tags?: string[];
  uses?: string[];
  status: "backed" | "glossary" | "dangling";
  ambiguousTerms: string[];
}



// ── Discovery ────────────────────────────────────────────────────

function findRemarkFiles(dir: string): string[] {
  const results: string[] = [];

  function recurse(d: string) {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory() && !entry.startsWith(".") && entry !== "node_modules" && entry !== "schema" && entry !== "pipeline") {
        recurse(full);
      } else if (entry.endsWith(".ts") && !entry.startsWith("index") && !entry.startsWith("_")) {
        results.push(full);
      }
    }
  }

  recurse(dir);
  return results;
}

// ── Analysis ─────────────────────────────────────────────────────

async function analyzeRemark(filePath: string): Promise<RemarkInfo | null> {
  try {
    const mod = await import(resolve(filePath));
    const block = mod.default;
    if (!block || block.kind !== "remark") return null;

    const tags: string[] = block.tags ?? [];
    const interprets: string | undefined = block.interprets;

    let status: RemarkInfo["status"];
    if (interprets) {
      status = "backed";
    } else if (tags.includes("glossary")) {
      status = "glossary";
    } else {
      status = "dangling";
    }

    // Check .md for ambiguous physics terms
    const mdPath = filePath.replace(/\.ts$/, ".md");
    const ambiguousTerms: string[] = [];
    if (existsSync(mdPath)) {
      const { readFileSync } = await import("fs");
      const mdContent = readFileSync(mdPath, "utf-8").toLowerCase();
      const usedLabels = new Set<string>(block.uses ?? []);

      for (const [term, expectedDef] of Object.entries(termsNeedingDefinitions())) {
        if (mdContent.includes(term.toLowerCase())) {
          // Check if the expected definition is in uses[]
          const hasRef = Array.from(usedLabels).some((u) =>
            expectedDef.split(" or ").some(d => u.includes(d.replace(/^def:|^prop:/, "")))
          );
          if (!hasRef) {
            ambiguousTerms.push(term);
          }
        }
      }
    }

    return {
      label: block.label,
      title: block.title,
      file: filePath,
      interprets,
      tags,
      uses: block.uses,
      status,
      ambiguousTerms,
    };
  } catch {
    return null;
  }
}

// ── Main ─────────────────────────────────────────────────────────

async function main() {
  const paperDir = requirePaper(process.argv[2]);
  const contentDir = resolve(import.meta.dir, "..", paperDir);

  if (!existsSync(contentDir)) {
    console.error(`Directory not found: ${contentDir}`);
    process.exit(1);
  }

  console.log(`\n## Remark Audit: ${paperDir}\n`);

  const tsFiles = findRemarkFiles(contentDir);
  const remarks: RemarkInfo[] = [];

  for (const f of tsFiles) {
    const info = await analyzeRemark(f);
    if (info) remarks.push(info);
  }

  // Sort by status
  const dangling = remarks.filter(r => r.status === "dangling");
  const backed = remarks.filter(r => r.status === "backed");
  const glossary = remarks.filter(r => r.status === "glossary");

  // Report
  if (dangling.length > 0) {
    console.log(`### Dangling Remarks (${dangling.length}) — need \`interprets\` or promotion\n`);
    for (const r of dangling) {
      const relPath = r.file.replace(contentDir + "/", "");
      console.log(`- **${r.label}** (${relPath}): ${r.title ?? "(no title)"}`);
      if (r.ambiguousTerms.length > 0) {
        console.log(`  - Ambiguous terms: ${r.ambiguousTerms.join(", ")}`);
      }
      console.log(`  - Suggested: promote core claim to prop/lem, or add \`interprets\``);
    }
    console.log();
  }

  if (backed.length > 0) {
    console.log(`### Backed Remarks (${backed.length})\n`);
    for (const r of backed) {
      console.log(`- **${r.label}** → interprets **${r.interprets}** ✓`);
    }
    console.log();
  }

  if (glossary.length > 0) {
    console.log(`### Glossary Remarks (${glossary.length})\n`);
    for (const r of glossary) {
      console.log(`- **${r.label}** (glossary) ✓`);
    }
    console.log();
  }

  // Summary
  const totalAmbiguous = remarks.reduce((n, r) => n + r.ambiguousTerms.length, 0);
  console.log(`### Summary\n`);
  console.log(`- Total remarks: ${remarks.length}`);
  console.log(`- Backed: ${backed.length} | Glossary: ${glossary.length} | Dangling: ${dangling.length}`);
  console.log(`- Ambiguous physics terms found: ${totalAmbiguous}`);

  if (dangling.length > 0) {
    process.exit(1);  // Non-zero exit for CI
  }
}

main().catch(e => { console.error(e); process.exit(1); });
