/**
 * `structure.json` is named in code only by its accessor.
 *
 * @module scripts/check-structure-accessor
 * @covers library
 *
 * `structure.json` has two variants, `pdf-structure/v1` and
 * `notebook-structure/v1`, read through one accessor
 * (`schemas/content/document-structure.ts`: `readStructure`, `structureOf`). A
 * reader that builds the path itself learns one variant and misreads the
 * other. So the quoted token `"structure.json"` on a CODE line is refused
 * outside the accessor and a short allowlist, each entry carrying its reason:
 * {@link ALLOWED} for this layer and below, and each layer's own
 * `gateExemptions.files` for its files. Use `STRUCTURE_FILENAME` and
 * `readStructure`.
 *
 * Matched: the exact quoted token — `"structure.json"` or `'structure.json'`
 * — on a line that is not a comment. Prose (a longer message, a doc comment)
 * is not matched. Test files are exempt.
 *
 * An unlisted file is a failure, and so is a STALE entry (an allowlisted file
 * that no longer contains the token).
 *
 * Exit: 0 clean, 1 a finding, 2 could not list the corpus (never a pass).
 */
import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { readDeclaration } from "../schemas/kg/cat-harness.ts";
import { gitCorpus } from "../schemas/sdlc/git-corpus.ts";
import { layerRootsIn } from "../schemas/kg/instance-roots.ts";

const REPO = resolve(import.meta.dir, "..", "..");

/** This gate's name, as a layer's `gateExemptions.files[].gate` names it. */
export const GATE = "check:structure-accessor";

/**
 * Files of THIS layer and below that may spell the token, and why.
 * Repo-relative. A file of a layer above is not named here: that layer
 * declares it, in `gateExemptions.files` of its own declaration, and
 * {@link declaredAllowed} reads it (owner, 2026-10-16, item 6b of the
 * folio-assistant#2598 wrong-direction triage).
 */
// declared-path-literal: these are the allowlist's KEYS — named source files
// this gate exempts, compared against git's corpus listing, not directories
// any declaration resolves.
export const ALLOWED: Readonly<Record<string, string>> = {
  "cat-harness-tools/schemas/content/document-structure.ts": "the accessor itself: it defines STRUCTURE_FILENAME",
};

/**
 * Every present layer's declared entries for this gate, repo-relative —
 * `<instance root>/<file>` — with the declared reason.
 */
export function declaredAllowed(repo: string = REPO): Record<string, string> {
  const out: Record<string, string> = {};
  for (const root of layerRootsIn(repo)) {
    for (const e of readDeclaration(root)?.gateExemptions?.files ?? []) {
      if (e.gate !== GATE) continue;
      out[relative(repo, resolve(root, e.file)).split("\\").join("/")] = e.reason;
    }
  }
  return out;
}

const TOKEN = /["']structure\.json["']/;
const COMMENT = /^\s*(\*|\/\/|\/\*)/;

export interface Finding {
  file: string;
  line: number;
  text: string;
}

/** The code lines that spell the token, per file. */
export function scan(files: readonly string[], read: (f: string) => string): Map<string, Finding[]> {
  const out = new Map<string, Finding[]>();
  for (const f of files) {
    const lines = read(f).split("\n");
    const hits: Finding[] = [];
    lines.forEach((text, i) => {
      if (!COMMENT.test(text) && TOKEN.test(text)) hits.push({ file: f, line: i + 1, text: text.trim() });
    });
    if (hits.length) out.set(f, hits);
  }
  return out;
}

if (import.meta.main) {
  const all = gitCorpus(REPO, ["*.ts"]);
  if (all === undefined) {
    console.error("could not determine: git would not list the corpus, so nothing was checked — that is not a pass.");
    process.exit(2);
  }
  const files = all
    .map((p) => relative(REPO, p))
    .filter((p) => !p.endsWith(".test.ts") && !p.endsWith(".d.ts") && !p.includes("node_modules/"));
  const hits = scan(files, (f) => readFileSync(resolve(REPO, f), "utf-8"));
  const allowed = { ...declaredAllowed(), ...ALLOWED };
  const unlisted = [...hits.keys()].filter((f) => !(f in allowed));
  const stale = Object.keys(allowed).filter((f) => !hits.has(f));
  for (const f of unlisted) {
    for (const h of hits.get(f)!) console.error(`✗ ${f}:${h.line}  ${h.text}`);
  }
  for (const f of stale) console.error(`✗ stale allowlist entry: ${f} no longer names structure.json — remove it`);
  if (unlisted.length || stale.length) {
    console.error(
      "\nRead a library entry's structure through schemas/content/document-structure.ts (readStructure / structureOf) " +
        "and name the file as STRUCTURE_FILENAME. A reader that builds the path and parses it itself learns one " +
        "variant and misreads the next (bean rkqp).",
    );
    process.exit(1);
  }
  console.log(`✓ structure.json is named only by its accessor and ${Object.keys(allowed).length - 1} reasoned exception(s).`);
}
