/**
 * Which skills have a published instruction page, and the link to one.
 *
 * Bean `qgjh`: "emit links wherever the target resolves". Visualisers printed
 * skill ids as code although the page existed. The page set is READ from the
 * directory `gen-skill-docs.ts` writes, never composed from an id, so a link
 * is emitted only where a page is and a skill without one stays code rather
 * than becoming a link that 404s.
 *
 * ONE answer for every visualiser. Two generators deriving it separately is
 * how one page links a skill another shows as code.
 */
import { existsSync, readdirSync } from "node:fs";
import { basename, join, posix, relative, sep } from "node:path";
import { baseDocsDir } from "../compose-docs.js";
import { isSkillMd, skillMdDirs } from "../known-skills.ts";
import { blobUrl, forgeAt } from "./library-source.ts";
import { overlayDirs } from "./layer-output.ts";
import { repoOf } from "../../src/core/edit-links.ts";
import { detectRepoUrl } from "../../src/core/git-refs.ts";
import { parse as parseYaml } from "yaml";

/** Where the instruction pages sit, relative to the base docs layer. */
export const SKILL_PAGES_DIR = "reference/skill-instructions";

/** The base docs layer, the same answer `compose-docs.ts` uses. */

/**
 * The skills with a generated instruction page: in the base docs layer, and,
 * where that layer is MOUNTED, at its output root, where `skills:docs` writes
 * them (bean `cat-tools-sm8r`, item 4).
 */
export function skillPagesOf(repo: string): ReadonlySet<string> {
  const dir = join(baseDocsDir(repo), SKILL_PAGES_DIR);
  return new Set(overlayDirs(dir, repo).flatMap((d) => readdirSync(d).filter((f) => f.endsWith(".md")).map((f) => basename(f, ".md"))));
}

/**
 * The href from a page at `fromPage` (relative to the base docs layer, e.g.
 * `tools/index.md`) to `skill`'s instruction page, or `undefined` when the
 * skill has none.
 */
export function skillPageHref(skill: string, fromPage: string, pages: ReadonlySet<string>): string | undefined {
  if (!pages.has(skill)) return undefined;
  return posix.relative(posix.dirname(fromPage.split("\\").join("/")), `${SKILL_PAGES_DIR}/${skill}.html`);
}


/**
 * The skills with an instruction page, plus where to read each skill that has
 * none: its source file on the forge.
 *
 * Owner, 2026-11-08 (`A_ListHarnesses` on the `discussion` process page):
 * "confirm-harness is not a link to skill … it should be". bootstrap's skills
 * get no instruction page on this site, by ruling (`pve3` in
 * `gen-skill-docs.ts`), so the panel showed them as code with "no page for
 * this one". Their source file IS a page, in bootstrap's own repository, and
 * linking it publishes nothing of bootstrap's here.
 */
export type SkillPages = ReadonlySet<string> & {
  /** skill → its source file's URL on the forge, for a skill with no instruction page. */
  readonly sources?: ReadonlyMap<string, string>;
  /**
   * skill → a page this site renders from its source file, relative to the
   * base docs layer, for a skill with no instruction page (owner,
   * 2026-11-08: "fill in missing"). Wins over `sources`.
   */
  readonly local?: ReadonlyMap<string, string>;
};

/**
 * skill name → its source file's URL, over every skill file `roots` declare.
 * The first root to hold a name wins, as for `skillEdgeIndex`. A file the
 * forge cannot place (no mount, no origin) is left out, so no wrong link is drawn.
 */
export function skillSourcesOf(repo: string, roots: readonly string[]): Map<string, string> {
  return new Map([...skillSourceFilesOf(repo, roots)].map(([n, x]) => [n, x.url]));
}

/** {@link skillSourcesOf}, keeping each skill's file as well as its URL. */
export function skillSourceFilesOf(repo: string, roots: readonly string[]): Map<string, { file: string; url: string }> {
  const out = new Map<string, { file: string; url: string }>();
  const checkoutRepo = repoOf(detectRepoUrl(repo), "") || undefined;
  for (const root of roots) {
    let dirs: string[][];
    try {
      dirs = skillMdDirs(root);
    } catch {
      continue;
    }
    for (const parts of dirs) {
      const dir = join(root, ...parts);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir).sort()) {
        const abs = join(dir, f);
        const name = f.slice(0, -3);
        if (!f.endsWith(".md") || out.has(name) || !isSkillMd(abs)) continue;
        const at = forgeAt(repo, relative(repo, abs).split(sep).join("/"), checkoutRepo);
        if (at) out.set(name, { file: abs, url: blobUrl(at) });
      }
    }
  }
  return out;
}

/** {@link skillPagesOf}, carrying {@link skillSourcesOf} for the skills it lacks. */
export function skillLinksOf(repo: string, roots: readonly string[]): SkillPages {
  const pages = skillPagesOf(repo);
  const sources = new Map([...skillSourcesOf(repo, roots)].filter(([n]) => !pages.has(n)));
  return Object.assign(new Set(pages), { sources });
}

/**
 * Where `skill` links from a page whose site root is `root` (`../../` and so
 * on): its instruction page when it has one, else its source file, else
 * nothing — code, never a guessed link.
 */
export function skillTarget(skill: string, root: string, pages: SkillPages): string | undefined {
  if (pages.has(skill)) return `${root}${SKILL_PAGES_DIR}/${skill}.html`;
  const local = pages.local?.get(skill);
  return local !== undefined ? `${root}${local}` : pages.sources?.get(skill);
}

/** The text after a leading YAML front matter block, and that block's `description`, folded. */
function splitFrontMatter(text: string): { body: string; description?: string } {
  if (!text.startsWith("---")) return { body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { body: text };
  const fm = text.slice(text.indexOf("\n", 3) + 1, end + 1);
  const body = text.slice(text.indexOf("\n", end + 4) + 1);
  let description: string | undefined;
  try {
    const d = (parseYaml(fm) as { description?: unknown } | null)?.description;
    if (typeof d === "string" && d.trim()) description = d.replace(/\s+/g, " ").trim();
  } catch {
    // Unparseable front matter is the skill gates' finding; the page shows the body.
  }
  return { body, ...(description ? { description } : {}) };
}

/**
 * A page for a skill that has no instruction page on this site, rendered from
 * its source file: its description, its body, and a link to the source.
 *
 * Owner, 2026-11-08, on the ⓘ panel's skill links: "fill in missing". The
 * page sits in the processes viewer's own `skills/` directory, so the skill
 * stays out of this site's graph and out of `reference/skill-instructions/`
 * (ruling `pve3` in `gen-skill-docs.ts`); it is a rendering of the file, as
 * the source link is.
 *
 * A relative link in the body is rewritten: to a sibling skill's page here
 * when `localNames` has one, else to the file on the forge, so the page links
 * nothing that 404s. `body` is returned unwrapped; the caller escapes Liquid.
 */
export function sourceSkillPage(
  name: string,
  text: string,
  sourceUrl: string,
  localNames: ReadonlySet<string>,
): { title: string; description?: string; body: string } {
  const { body, description } = splitFrontMatter(text);
  const base = sourceUrl.slice(0, sourceUrl.lastIndexOf("/") + 1);
  const rewrite = (target: string): string => {
    if (/^(?:[a-z][a-z0-9+.-]*:|#|\/)/i.test(target)) return target;
    const [path, frag] = target.split("#", 2) as [string, string | undefined];
    const sib = /^(?:\.\/)?([A-Za-z0-9_.-]+)\.md$/.exec(path);
    if (sib && localNames.has(sib[1]!)) return `${sib[1]}.html${frag ? `#${frag}` : ""}`;
    try {
      return new URL(target, base).href;
    } catch {
      return target;
    }
  };
  const out = body
    .replace(/(\]\()([^)\s]+)(\))/g, (_m, a: string, t: string, b: string) => `${a}${rewrite(t)}${b}`)
    .replace(/(\bhref=")([^"]+)(")/g, (_m, a: string, t: string, b: string) => `${a}${rewrite(t)}${b}`);
  return { title: name, ...(description ? { description } : {}), body: out };
}
