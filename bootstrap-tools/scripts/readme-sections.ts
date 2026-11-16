#!/usr/bin/env bun
/**
 * Write — or with `--check`, verify — the generated sections of a layer's
 * `README.md`: `kg:processes`, `kg:files`, `kg:roles` and `kg:toc`.
 *
 * @module bootstrap-tools/scripts/readme-sections
 * @covers code
 *
 * The writers are in `readme-graph-sections.ts` and `readme-toc.ts`; this is
 * the command that runs them where bootstrap-tools stands alone, so a stale
 * section is noticed without a hosting harness.
 *
 * A section is written only between its own `<!-- <marker>:begin -->` and
 * `:end` markers, in the same form a hosting harness writes, so the two
 * cannot disagree: a blank line, the body, a blank line. A README without a
 * section's markers has not opted into it, and is left alone. A section that
 * says it could not determine its content (`skip`) leaves the region as it is.
 *
 * Each region opens with the generated-by notice (`generatedBanner`): a README with marker sections is only PARTLY generated, so the
 * notice is on each region a tool wrote, saying "this section", rather than
 * once at the top of a page that is mostly a person's — which would be false,
 * and would have to be written outside the markers, where this tool may not
 * write.
 *
 * Usage: bun run bootstrap-tools/scripts/readme-sections.ts [--root ./bootstrap] [--check]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generatedBanner } from "./generated-by.ts";
import { filesSection, processesSection, rolesSection, type GraphSection } from "./readme-graph-sections.ts";
import { tocSection } from "./readme-toc.ts";

/** In the order they are written. The table of contents is last, so it lists what the others wrote. */
export const SECTIONS: readonly GraphSection[] = [processesSection, filesSection, rolesSection, tocSection];

/** `readme` with `body` between the marker's begin and end; unchanged when it has no such region. */
export function inject(readme: string, body: string, marker: string): string {
  const begin = `<!-- ${marker}:begin -->`;
  const end = `<!-- ${marker}:end -->`;
  const start = readme.indexOf(begin);
  const stop = readme.indexOf(end);
  if (start === -1 || stop === -1 || stop < start) return readme;
  return readme.slice(0, start + begin.length) + "\n\n" + body.trimEnd() + "\n\n" + readme.slice(stop);
}

/** The README with every opted-in section rendered, and what was written or left. */
export function syncReadme(root: string, readme: string): { content: string; written: string[]; notes: string[] } {
  let content = readme;
  const written: string[] = [];
  const notes: string[] = [];
  for (const s of SECTIONS) {
    if (!content.includes(`<!-- ${s.marker}:begin -->`)) continue;
    const out = s.render({ root, readme: content });
    notes.push(...out.notes.map((n) => `${s.marker}: ${n}`));
    if (out.skip) continue;
    const banner = generatedBanner("scripts/readme-sections.ts", `${s.from} (section \`${s.marker}\`)`, "edit outside the markers, or change what it is generated from", "section");
    content = inject(content, `${banner}\n\n${out.markdown}`, s.marker);
    written.push(s.marker);
  }
  return { content, written, notes };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const at = args.indexOf("--root");
  const root = at >= 0 && args[at + 1] ? args[at + 1]! : join(import.meta.dir, "..", "..", "bootstrap");
  const file = join(root, "README.md");
  if (!existsSync(file)) {
    console.error(`✗ ${file} does not exist — there is no README to write sections into, and that is not a pass.`);
    process.exit(2);
  }
  const before = readFileSync(file, "utf-8");
  const { content, written, notes } = syncReadme(root, before);
  for (const n of notes) console.log(`  · ${n}`);
  if (args.includes("--check")) {
    if (content !== before) {
      console.error(`✗ ${file}: generated sections are stale (${written.join(", ")}) — run without --check`);
      process.exit(1);
    }
    console.log(`✓ README sections current: ${written.join(", ") || "none opted in"}`);
  } else {
    if (content !== before) writeFileSync(file, content);
    console.log(`${content === before ? "=" : "✓"} README sections: ${written.join(", ") || "none opted in"}`);
  }
}
