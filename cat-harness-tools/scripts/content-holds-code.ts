/**
 * Does a CONTENT layer hold code? — kg:audit's `content-instance-holds-code`.
 *
 * @module scripts/content-holds-code
 *
 * `kg-separation`: a knowledge graph separates into a CONTENT repository
 * (files to read, no code; a reader needs nothing installed) and a TOOLS
 * repository (`<name>-tools`, the code that writes and checks it). Code
 * tolerated in a content layer is still reported as a failing finding.
 *
 * Which layers are content is read from declarations, never guessed:
 *
 *   1. `separation: "content"` on the layer itself;
 *   2. a declared TOOLS layer names it in `supports` (bootstrap, supported
 *      by bootstrap-tools).
 *
 * A `repository` differing from `livesAt.repository` is NOT a signal (every
 * staged layer has that).
 *
 * Code is a file git accounts for under the layer root whose extension is
 * a programming language's ({@link CODE_EXTENSIONS}), EXCEPT under a
 * directory the layer declares as graph typology `folio`, whose block
 * manifests are authored content written as TypeScript data.
 *
 * States: `n/a` — not declared content. `pass`/`fail` — content, and git
 * listed the files. `unknown` — git could not list them, or a declaration
 * could not be read; never a pass.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

import { findDeclarationFile, instanceDirectories, layerRootsIn, readDeclaration, siblingScopeFor } from "../schemas/kg/cat-harness.js";
import { gitCorpus } from "../schemas/sdlc/git-corpus.js";
import type { KgFinding } from "../schemas/sdlc/kg-qa.js";

/** Extensions read as code. Lower-case, with the dot. */
export const CODE_EXTENSIONS: readonly string[] = [
  ".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".sh", ".bash", ".bat", ".cmd", ".ps1", ".rb", ".go", ".rs", ".java", ".lean",
];

/** Graph typologies whose directories hold authored content written as code-shaped data. */
export const CONTENT_MANIFEST_KINDS: readonly string[] = ["folio"];

/** Why a layer is content, or `undefined` when nothing declares it so. */
export function contentBasis(instanceRoot: string, siblings: readonly string[]): string | undefined {
  const decl = readDeclaration(instanceRoot);
  if (decl === undefined) return undefined;
  if (decl.separation === "content") return `\`${decl.name}\` declares \`separation: "content"\``;
  for (const s of siblings) {
    if (resolve(s) === resolve(instanceRoot)) continue;
    const file = findDeclarationFile(s);
    if (file === undefined) continue;
    // `supports` is bootstrap-tools' field and not part of the harness
    // declaration schema, which strips it — so it is read from the raw file.
    const raw = JSON.parse(readFileSync(join(s, file), "utf-8")) as { name?: string; supports?: Record<string, unknown> };
    if (raw.supports && Object.hasOwn(raw.supports, decl.name)) {
      return `\`${raw.name ?? file}\` declares \`supports.${decl.name}\` — it is the tools half, so \`${decl.name}\` is the content half`;
    }
  }
  return undefined;
}

/** Instance-relative directories whose declared kinds make their `.ts` files content. */
function manifestDirs(instanceRoot: string): string[] {
  return instanceDirectories(instanceRoot)
    .filter((d) => d.graphTypologies.some((k) => CONTENT_MANIFEST_KINDS.includes(k)))
    .map((d) => d.path.replace(/\/+$/, ""));
}

/**
 * The code files in `files` (absolute), instance-relative and sorted.
 * Pure over its inputs so a test can hand it a planted listing.
 */
export function codeFiles(instanceRoot: string, files: readonly string[], exemptDirs: readonly string[] = []): string[] {
  const root = resolve(instanceRoot);
  return files
    .map((f) => relative(root, f).split(sep).join("/"))
    .filter((r) => !r.startsWith("..") && r.length > 0)
    .filter((r) => {
      const dot = r.lastIndexOf(".");
      return dot > r.lastIndexOf("/") && CODE_EXTENSIONS.includes(r.slice(dot).toLowerCase());
    })
    .filter((r) => !exemptDirs.some((d) => r === d || r.startsWith(`${d}/`)))
    .sort();
}

export type ContentCodeVerdict =
  | { state: "n/a" }
  | { state: "unknown"; reason: string }
  | { state: "judged"; basis: string; files: string[] };

/**
 * The verdict for one layer. `lister` defaults to git; a test passes its own.
 */
export function contentInstanceCode(
  instanceRoot: string,
  lister: (dir: string) => string[] | undefined = (d) => gitCorpus(d),
): ContentCodeVerdict {
  let basis: string | undefined;
  try {
    basis = contentBasis(instanceRoot, layerRootsIn(siblingScopeFor(instanceRoot)));
  } catch (e) {
    return { state: "unknown", reason: `a declaration could not be read — ${(e as Error).message.split("\n")[0]}` };
  }
  if (basis === undefined) return { state: "n/a" };
  if (!existsSync(instanceRoot)) return { state: "unknown", reason: `${instanceRoot} does not exist` };
  const listed = lister(instanceRoot);
  if (listed === undefined) {
    return { state: "unknown", reason: "git could not list this instance's files, so whether it holds code is undetermined" };
  }
  return { state: "judged", basis, files: codeFiles(instanceRoot, listed, manifestDirs(instanceRoot)) };
}

/** The verdict as kg-audit findings: one per file, each saying why it fails. */
export function contentCodeFindings(v: Extract<ContentCodeVerdict, { state: "judged" }>): KgFinding[] {
  return v.files.map((f) => ({
    where: f,
    detail:
      `${f} is code in a CONTENT instance (${v.basis}). A content repository holds no code ` +
      `(kg-separation, bootstrap FR-7): move it to the platform if it is generic, or to a ` +
      `\`<name>-tools\` repository once one is authorised. Tolerated for now is still a finding.`,
  }));
}
