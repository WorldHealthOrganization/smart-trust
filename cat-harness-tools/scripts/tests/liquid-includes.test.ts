/**
 * Every Liquid tag in `docs/_includes/` is a real tag, or is escaped.
 *
 * ## The failure this exists for, measured 2026-09-19
 *
 * `docs/_includes/head_custom.html` carried, inside an HTML comment, the prose
 * "…the reason this is a JSON island rather than an `{% if %}`". **Liquid
 * parses tags inside HTML comments** — `<!-- -->` means nothing to it — so it
 * saw an `if` tag with an empty expression and the site build died:
 *
 *     Liquid syntax error (_includes/head.html line 70):
 *       Syntax Error in tag 'if' - Valid syntax: if [expression]
 *
 * Two things made it expensive out of proportion to the typo. The error names
 * the THEME's `head.html`, because Liquid attributes an include's line to the
 * includer — so the file in the message is not the file to edit. And the
 * theme is `remote_theme: just-the-docs/just-the-docs`, unpinned and fetched
 * at build time, which makes "the theme changed under us" the first and
 * wrongest hypothesis to reach for.
 *
 * ## Why this check and not a real Liquid parse
 *
 * A real parse is better and was used to confirm both the reproduction and
 * the fix (`ruby -r liquid -e 'Liquid::Template.parse(...)'`, strict mode).
 * It is not what runs here: the Ruby Liquid gem is not a dependency of this
 * repo, CI installs bun and not `github-pages`, and a gate that needs a
 * toolchain CI does not have is a gate that gets skipped.
 *
 * So this checks the property that actually broke — every `{% … %}` is either
 * inside `{% raw %}` or is a known tag carrying the expression its form
 * requires. That is strictly weaker than parsing and strictly stronger than
 * nothing, and it would have caught this in the commit that wrote it.
 */
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { siteLayersFor } from "../../schemas/kg/cat-harness.ts";
import { HARNESS_ROOT } from "../lib/roots.ts";

const INSTANCE_ROOT = resolve(HARNESS_ROOT);
// Every site layer's includes: since slice 1 of the semantic subgraphs the
// chrome (`site-chrome/`) and the harness pages (`docs/`) are two layers.
const INCLUDE_DIRS = siteLayersFor(INSTANCE_ROOT).map((l) => join(INSTANCE_ROOT, l, "_includes")).filter((d) => existsSync(d));

/** Tags that take no expression. Anything else must carry one. */
const NO_EXPRESSION = new Set(["else", "endif", "endfor", "endunless", "endcase", "endraw", "raw", "endcomment", "comment", "endtablerow", "break", "continue"]);

/** Tags that must carry an expression to parse at all. */
const NEEDS_EXPRESSION = new Set(["if", "elsif", "unless", "for", "case", "when", "assign", "include", "cycle", "capture", "increment", "decrement", "tablerow", "echo", "render"]);

interface Tag {
  /** 1-based line the tag starts on. */
  line: number;
  /** The tag's raw body, between the delimiters, trimmed of `-` markers. */
  body: string;
  /** True when this tag sits between a `{% raw %}` and its `{% endraw %}`. */
  raw: boolean;
}

/** Every `{% … %}` in the file, with whether it is inside a raw block. */
export function liquidTags(src: string): Tag[] {
  const out: Tag[] = [];
  const re = /\{%-?([\s\S]*?)-?%\}/g;
  let m: RegExpExecArray | null;
  let inRaw = false;
  while ((m = re.exec(src)) !== null) {
    const body = m[1].trim();
    const name = body.split(/\s+/)[0] ?? "";
    const line = src.slice(0, m.index).split("\n").length;
    if (inRaw) {
      // Inside raw, only `endraw` is a tag; everything else is literal text.
      out.push({ line, body, raw: true });
      if (name === "endraw") inRaw = false;
      continue;
    }
    out.push({ line, body, raw: false });
    if (name === "raw") inRaw = true;
  }
  return out;
}

const files = INCLUDE_DIRS.flatMap((d) =>
  readdirSync(d).filter((f) => /\.(html|js|md)$/i.test(f)).map((f) => join(d, f)),
).sort();

describe("Liquid in docs/_includes", () => {
  it("there are includes to check", () => {
    // Without this the loop below passes over an empty list, which is the
    // shape of failure this file exists to prevent in the first place.
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [relative(INSTANCE_ROOT, f), f] as const))("%s: every tag is real or escaped", (_rel, f) => {
    const src = readFileSync(f, "utf-8");
    const bad: string[] = [];
    for (const t of liquidTags(src)) {
      if (t.raw) continue;
      const [name, ...rest] = t.body.split(/\s+/);
      const expression = rest.join(" ").trim();
      if (NEEDS_EXPRESSION.has(name) && expression.length === 0) {
        bad.push(
          `${f}:${t.line}  {% ${t.body} %} — \`${name}\` needs an expression. If this is ` +
            `PROSE naming the tag, wrap it: {% raw %}…{% endraw %}. Liquid parses tags ` +
            `inside HTML comments.`,
        );
        continue;
      }
      if (!NEEDS_EXPRESSION.has(name) && !NO_EXPRESSION.has(name)) {
        bad.push(
          `${f}:${t.line}  {% ${t.body} %} — \`${name}\` is not a Liquid tag this check ` +
            `knows. Either it is a typo, or add it to NEEDS_EXPRESSION / NO_EXPRESSION in ` +
            `${"scripts/tests/liquid-includes.test.ts"}.`,
        );
      }
    }
    expect(bad).toEqual([]);
  });

  it("catches the exact comment that broke the build", () => {
    // The regression, kept as a case rather than as a memory of one. Written
    // out here because the file that carried it is now fixed, so nothing else
    // in the tree still demonstrates the shape.
    const broken = "<!--\n  a JSON island rather than\n  an `{% if %}`:\n-->\n";
    const bad = liquidTags(broken).filter(
      (t) => !t.raw && t.body.split(/\s+/)[0] === "if" && t.body.split(/\s+/).length === 1,
    );
    expect(bad.map((t) => t.line)).toEqual([3]);
  });

  it("the same comment inside {% raw %} is fine", () => {
    const fixed = "<!--\n  an {% raw %}{% if %}{% endraw %}:\n-->\n";
    const unescaped = liquidTags(fixed).filter((t) => !t.raw);
    // Only the opening `raw` itself is outside; the `if` is inside it.
    expect(unescaped.map((t) => t.body)).toEqual(["raw"]);
  });
});
