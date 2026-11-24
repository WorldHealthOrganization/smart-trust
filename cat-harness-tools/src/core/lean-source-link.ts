/**
 * lean-source-link — where a block's Lean declaration link points.
 *
 * Owner ruling, 2026-10-20 (bean `og5t`, option A, "GitHub source"): a block's
 * Lean declaration link goes to the declaration's line in its `.lean` file on
 * GitHub, resolved from the block's `lean.ref` at the pinned commit. Not a
 * doc-gen4 page (qou publishes none since its 2026-09-27 Pages deprecation),
 * and not no link.
 *
 * The commit, not a branch: a branch moves, and the line number moves with it,
 * so a branch link points at the wrong line as soon as the file is edited. A
 * commit link keeps the line it was resolved against.
 *
 * Nothing here reads files or runs git; the server supplies the source text,
 * the path it came from, the repository URL and the commit.
 */
import { ownerRepo } from "./git-refs.ts";
import { sourceUrl } from "./edit-links.ts";

/**
 * The keywords that introduce a named Lean declaration. A declaration may be
 * preceded by attributes (`@[simp]`) and modifiers (`private`,
 * `noncomputable`, …), which {@link declarationLine} skips.
 */
const DECL_KEYWORDS = [
  "theorem", "lemma", "def", "abbrev", "structure", "class", "instance",
  "inductive", "axiom", "opaque", "example",
] as const;

const MODIFIERS = ["private", "protected", "noncomputable", "partial", "unsafe", "nonrec"] as const;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The 1-based line on which `declName` is declared in `source`, or `undefined`.
 *
 * `declName` is matched as written and, when it is dotted, by its last segment
 * too — `QOU.Torsion.lifting_exists` is usually declared as `lifting_exists`
 * inside `namespace QOU.Torsion`. The fully written form is tried first, so a
 * file that declares both `foo` and `Bar.foo` resolves the qualified one.
 *
 * The name must end at a word boundary: `foo` does not match `foo_bar`.
 */
export function declarationLine(source: string, declName: string): number | undefined {
  if (!declName) return undefined;
  const lines = source.split(/\r?\n/);
  const last = declName.split(".").pop()!;
  const names = declName === last ? [declName] : [declName, last];
  const prefix =
    String.raw`^\s*(?:@\[[^\]]*\]\s*)*(?:(?:${MODIFIERS.join("|")})\s+)*` +
    String.raw`(?:${DECL_KEYWORDS.join("|")})\s+`;
  for (const name of names) {
    const re = new RegExp(prefix + escapeRe(name) + String.raw`(?![\w'.!?])`);
    const i = lines.findIndex((l) => re.test(l));
    if (i >= 0) return i + 1;
  }
  return undefined;
}

/**
 * The GitHub URL of `path` at `commit`, at `line` when known.
 *
 * `undefined` unless the repository is on github.com and the commit is a full
 * or abbreviated SHA: the ruling is a GitHub source link, and a link for any
 * other host, or at a moving ref, would be a different link from the one ruled
 * on.
 */
export function leanSourceUrl(
  repoUrl: string | undefined,
  commit: string | undefined,
  path: string,
  line?: number,
): string | undefined {
  if (!repoUrl || !commit || !path) return undefined;
  if (!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(repoUrl)) return undefined;
  if (!/^[0-9a-f]{7,40}$/.test(commit)) return undefined;
  const repo = ownerRepo(repoUrl);
  if (!repo) return undefined;
  return sourceUrl({ repo, branch: commit }, path.replace(/^\.\//, ""), line);
}
