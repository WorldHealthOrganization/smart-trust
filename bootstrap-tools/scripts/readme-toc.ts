/**
 * `kg:toc` — a README's table of contents, generated from its own headings.
 *
 * @module bootstrap-tools/scripts/readme-toc
 * @covers code
 *
 * A hand-kept contents list is wrong the day a
 * heading is renamed, and nothing says so, because a README is the one file
 * no check reads. So the list is a README section like the others: opt-in by
 * the `<!-- kg:toc:begin -->` / `:end` pair, rewritten by `readme-sections`,
 * and checked by its `--check`.
 *
 * What it lists: every level-2 heading, with its level-3 headings nested
 * under it — outside fenced code (a `#` line in a shell block is not a
 * heading) and outside the TOC's own region. Each link is the anchor GitHub
 * gives the heading, deduplicated as GitHub does (`-1`, `-2` …, counted over
 * EVERY heading in the file, whatever its level), so a README read on GitHub
 * and the same README on its site both land.
 *
 * It reads the README as the other sections have already rewritten it, so a
 * heading a generated section adds is listed in the same run.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { GraphSection } from "./readme-graph-sections.ts";
import { githubSlug, plainHeading } from "./readme-book.ts";

export const TOC_MARKER = "kg:toc";

const FENCE = /^\s{0,3}(`{3,}|~{3,})/;
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;

/** Every heading outside fenced code and outside the TOC region: level, text, GitHub anchor. */
export function headingsOf(md: string): { level: number; text: string; anchor: string }[] {
  const begin = `<!-- ${TOC_MARKER}:begin -->`;
  const end = `<!-- ${TOC_MARKER}:end -->`;
  const out: { level: number; text: string; anchor: string }[] = [];
  const seen = new Map<string, number>();
  let fence: string | undefined;
  let inToc = false;
  for (const line of md.split("\n")) {
    if (line.includes(begin)) inToc = true;
    if (inToc) {
      if (line.includes(end)) inToc = false;
      continue;
    }
    const f = FENCE.exec(line);
    if (fence !== undefined) {
      if (f && f[1]![0] === fence[0] && f[1]!.length >= fence.length) fence = undefined;
      continue;
    }
    if (f) {
      fence = f[1]!;
      continue;
    }
    const h = HEADING.exec(line);
    if (!h) continue;
    const base = githubSlug(h[2]!);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.push({ level: h[1]!.length, text: plainHeading(h[2]!), anchor: n === 0 ? base : `${base}-${n}` });
  }
  return out;
}

/** The table of contents for `md`: level-2 headings, with level-3 nested under them. */
export function tocOf(md: string): string {
  const lines: string[] = [];
  let under2 = false;
  for (const h of headingsOf(md)) {
    if (h.level === 2) {
      lines.push(`- [${h.text}](#${h.anchor})`);
      under2 = true;
    } else if (h.level === 3) {
      lines.push(`${under2 ? "  " : ""}- [${h.text}](#${h.anchor})`);
    }
  }
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export const tocSection: GraphSection = {
  marker: TOC_MARKER,
  summary: "The README's table of contents: its level-2 and level-3 headings, linked by GitHub's anchors",
  from: "this README's own headings",
  render(ctx) {
    const md = ctx.readme ?? (existsSync(join(ctx.root, "README.md")) ? readFileSync(join(ctx.root, "README.md"), "utf-8") : undefined);
    if (md === undefined) return { markdown: "", notes: ["left unchanged — no README to read headings from"], skip: true };
    const toc = tocOf(md);
    return toc ? { markdown: toc, notes: [] } : { markdown: "_This README has no sections yet._\n", notes: ["no level-2 or level-3 headings"] };
  },
};
