/**
 * A node of the trashcan — what `fsh-guts/` holds, and what may leave it.
 *
 * This is the shape of the document served at `<base-url>/fsh-guts.jsonld`.
 *
 * **It is reachable BY NAME and never by an edge.** `UNPUBLISHED_GRAPH_TYPOLOGIES`
 * strips `fsh-guts` from every other published graph, so a consumer may fetch
 * this document deliberately and must never ARRIVE at it by following a link.
 * That is why it is a separate document rather than a subgraph of the main
 * export.
 *
 * **Logs are inside `fsh-guts/` and must NOT be published.** `fsh-guts/logs/`
 * is git-ignored, but that is not enough: {@link isFshGutsNode} admits a file
 * only if it DECLARES itself `folio-fsh-guts/v1`, so a log entry is excluded
 * by what it says it is, not by where the build ran.
 *
 * @module schemas/fsh-guts
 * @graphNode schema
 */

import { existsSync, readFileSync } from "node:fs";

import { z } from "zod";

import { type ResolvedDirectory, resolveDirectories } from "./cat-harness.ts";
import { type FrontMatter, parseFrontMatter, scalar } from "./front-matter.ts";
import { checkoutDirectories } from "./harness-config.ts";
import { BeanIdSchema } from "../tools/tool-types.ts";

/** The `$schema` tag every node of the trashcan carries. */
export const FSH_GUTS_SCHEMA_ID = "folio-fsh-guts/v1";

export const FshGutsNodeSchema = z.object({
  $schema: z.literal(FSH_GUTS_SCHEMA_ID),
  title: z.string().min(1),
  /**
   * OPEN, deliberately. A proposal, a webpage, a todo, a retired diagram, a
   * script nobody calls — the trashcan does not get to be fussy about what is
   * thrown into it, and a closed enum would mean a schema change stands
   * between an agent and not deleting something.
   */
  kind: z.string().min(1),
  /** When it was moved here. */
  movedOn: z.string().min(1).optional(),
  /**
   * Where it used to live.
   *
   * The field that earns the schema. Without it a MOVED node is an orphan — a
   * reader sees what it says and not where it came from, which is exactly the
   * "abandonment or accident" ambiguity the never-delete rule exists to
   * prevent.
   *
   * Optional because not every node was moved. One written here as working
   * material has no prior location, and a `movedFrom` naming a path it never
   * occupied would be a fabricated provenance — evidence-shaped and false.
   * Such a node answers with {@link issue} or {@link bean} instead.
   *
   * **The disjunction is enforced by a test, not here, and that is
   * deliberate.** This schema also CLASSIFIES: `isFshGutsNode` uses it to
   * decide what belongs in the export. A refinement rejecting a node with no
   * provenance would not flag it — it would classify it as not-a-node and
   * drop it silently from the published document, which is the failure mode
   * the whole directory exists to avoid.
   */
  movedFrom: z.string().min(1).optional(),
  /** The issue that superseded it, or that it was written for. */
  issue: z.union([z.string(), z.number()]).optional(),
  /**
   * The work-plan item this was written under, where there is one.
   *
   * Declared rather than left to pass through as an unknown key: `z.object`
   * strips what it does not name, so an undeclared `bean:` in front matter
   * reads fine in the source and is absent from the exported node. A typed
   * bean id since #1168 B8; `fsh-guts-bean-refs.test.ts` resolves every one.
   */
  bean: BeanIdSchema.optional(),
  summary: z.string().min(1).optional(),
})
  /**
   * `kind` is OPEN, so the field set cannot be closed.
   *
   * A schema that invites any `kind` and then silently discards whatever
   * makes that kind distinct is answering half the question. `bean` above is
   * the evidence: it had to be declared one field at a time, and its own
   * comment records the symptom — read fine in the source, absent from the
   * exported node.
   *
   * `staging-preview` (bean `6pfo`) is the case that forced the general fix.
   * Its record carries a nested `staging` block that no amount of declaring
   * scalar fields here would hold.
   *
   * **This does not widen what COUNTS as a node.** Classification is still
   * `$schema === folio-fsh-guts/v1` and nothing else, so a `folio-log/v1`
   * entry is excluded exactly as before — by what it says it is.
   */
  .passthrough();

export type FshGutsNode = z.infer<typeof FshGutsNodeSchema>;

/**
 * Read a file's front matter and say whether it is a node of this graph.
 *
 * DECLARATION, not location and not extension. A file sitting in `fsh-guts/`
 * that says nothing is not a node of the graph; a log entry that says
 * `folio-log/v1` is positively something else. That is what keeps logs out of
 * the published document on a machine where they happen to exist.
 */
export function isFshGutsNode(fm: FrontMatter): boolean {
  return scalar(fm, "$schema") === FSH_GUTS_SCHEMA_ID;
}

/**
 * Parse one file, or `undefined` with a reason if it is not a node.
 *
 * A reason rather than a bare `undefined`, because "not a node of this graph"
 * and "a node that will not parse" want different responses from a caller and
 * the second must not be reported as a clean skip.
 */
export function readFshGutsNode(
  text: string,
): { node: FshGutsNode; body: string } | { node?: undefined; reason: string } {
  const { fm, body } = parseFrontMatter(text);
  if (!isFshGutsNode(fm)) {
    // TWO carriers, because the trashcan holds two kinds of file. A markdown
    // node declares itself in YAML front matter; a JSON one declares itself
    // at the top level, which is how `folio-log/v1` and
    // `folio-workflow-instance/v1` do it.
    //
    // Reading only the front matter still EXCLUDED a log entry — the right
    // outcome — but reported "declares no $schema", which is false: a log
    // entry declares emphatically, just not in YAML. The whole design rests
    // on declaration, so a wrong reason is worse than a terse one. It would
    // have sent the next reader looking for a missing tag that is there.
    const declared = scalar(fm, "$schema") ?? jsonSchemaTag(text);

    // A JSON node of THIS graph is now read rather than only named.
    //
    // `schemas/kg/front-matter.ts` parses to a FLAT map, so a nested block in
    // YAML comes back as `[]` — measured. A record a workflow writes and a
    // tool reads cannot use that carrier, and `staging-preview` (bean `6pfo`)
    // is the first that needs it.
    //
    // **The log exclusion is untouched, and deliberately so.** This branch
    // fires only when the top-level `$schema` IS `folio-fsh-guts/v1`; a
    // `folio-log/v1` entry falls straight through to the reason below, as it
    // always did. The rule was never "markdown is in, JSON is out" — it was
    // and remains "a file is what it declares itself to be".
    if (declared === FSH_GUTS_SCHEMA_ID) return readJsonNode(text);

    return {
      reason: declared
        ? `declares itself \`${declared}\`, which is not ${FSH_GUTS_SCHEMA_ID}`
        : `declares no $schema, so it is not a node of this graph`,
    };
  }
  const parsed = FshGutsNodeSchema.safeParse({ ...fm, $schema: FSH_GUTS_SCHEMA_ID });
  if (!parsed.success) {
    return {
      reason: `declares ${FSH_GUTS_SCHEMA_ID} but does not satisfy it: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ")}`,
    };
  }
  return { node: parsed.data, body };
}

/**
 * Read a JSON node of this graph.
 *
 * Reached only once the top-level `$schema` has been confirmed as
 * {@link FSH_GUTS_SCHEMA_ID}, so this never decides membership — it only
 * parses a file already established to be ours.
 *
 * `body` is empty: a JSON node's content IS its fields. The markdown carrier
 * splits prose from metadata because a person wrote the prose; here there is
 * no prose to split off, and inventing one from the fields would be a body
 * nobody authored.
 */
function readJsonNode(
  text: string,
): { node: FshGutsNode; body: string } | { node?: undefined; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    // Unreachable via readFshGutsNode — jsonSchemaTag already parsed it — but
    // a reason beats a throw if this is ever called directly.
    return { reason: `is not JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
  const parsed = FshGutsNodeSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      reason: `declares ${FSH_GUTS_SCHEMA_ID} but does not satisfy it: ${parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
        .join("; ")}`,
    };
  }
  return { node: parsed.data, body: "" };
}

/**
 * The `$schema` of a JSON document, when the text is one.
 *
 * Used BOTH to admit a JSON node of this graph and to name what a file is in
 * a skip reason. It was only the second until `staging-preview` needed a
 * carrier that survives a nested block.
 */
function jsonSchemaTag(text: string): string | undefined {
  try {
    const v = JSON.parse(text) as unknown;
    if (v && typeof v === "object" && typeof (v as { $schema?: unknown }).$schema === "string") {
      return (v as { $schema: string }).$schema;
    }
  } catch {
    // Not JSON. The caller's message for "declares nothing" is correct.
  }
  return undefined;
}

/**
 * The `kind` of the note that FREEZES the directory beside it.
 *
 * Stage 13 of [`sub-kg-lifecycle`](../skills/kg/graph-management/sub-kg-lifecycle.md):
 * after a cutover the host keeps its copy of the separated graph as one
 * fsh-guts relocation, `<name>/` beside a note `<name>.md`. That copy is
 * another repository's state at one commit — thousands of files that are
 * never refreshed, never rendered and never judged here. **The subtree is ONE
 * retired item, and the note is the node that describes it.**
 *
 * Recognised by DECLARATION, like every other node of this graph: a
 * directory is frozen because the sibling note says `kind: separated-instance`,
 * never because of the directory it sits in. A subtree with no note, or a note
 * of another kind, is walked like any other directory — so its files must
 * declare themselves, and a copy dropped in without its note fails loudly
 * rather than vanishing from every check.
 */
export const FROZEN_SUBTREE_KIND = "separated-instance";

/**
 * What a frozen subtree's note must say: where the copy came from and when,
 * the repository that now holds the live graph, and the commit the copy
 * matches. Stage 13 names these four; without the last two a reader cannot
 * tell which repository to change instead, or how stale the copy is.
 */
export const FROZEN_SUBTREE_FIELDS = ["movedFrom", "movedOn", "repository", "matchesCommit"] as const;

/** The parsed note that freezes `dir`, or `undefined` if `dir` is not a frozen subtree. */
export function frozenSubtreeNote(dir: string): FshGutsNode | undefined {
  const note = `${dir.replace(/\/+$/, "")}.md`;
  if (!existsSync(note)) return undefined;
  let text: string;
  try {
    text = readFileSync(note, "utf-8");
  } catch {
    return undefined;
  }
  const read = readFshGutsNode(text);
  return read.node?.kind === FROZEN_SUBTREE_KIND ? read.node : undefined;
}

/** Is `dir` (absolute) a frozen subtree — one item, described by its note, never walked? */
export function isFrozenSubtree(dir: string): boolean {
  return frozenSubtreeNote(dir) !== undefined;
}

/**
 * Split a list of paths relative to `base` into the files a scanner judges and
 * the frozen subtrees it reports as one item each.
 *
 * For readers that already hold a file LIST rather than walking — a glob, or
 * the state branch's mount marker — so the rule is the same whether the
 * corpus was walked or listed. A path is dropped when some ancestor directory
 * of it is frozen; the note itself is a sibling, so it stays.
 */
export function withoutFrozenSubtrees(
  base: string,
  rels: readonly string[],
): { live: string[]; frozen: string[] } {
  const verdict = new Map<string, boolean>();
  const frozenAncestor = (rel: string): string | undefined => {
    const parts = rel.split("/");
    for (let i = 1; i < parts.length; i++) {
      const d = parts.slice(0, i).join("/");
      let f = verdict.get(d);
      if (f === undefined) {
        f = isFrozenSubtree(`${base.replace(/\/+$/, "")}/${d}`);
        verdict.set(d, f);
      }
      if (f) return d;
    }
    return undefined;
  };
  const live: string[] = [];
  const frozen = new Set<string>();
  for (const rel of rels) {
    const d = frozenAncestor(rel);
    if (d === undefined) live.push(rel);
    else frozen.add(d);
  }
  return { live, frozen: [...frozen].sort() };
}

/** The graph typology a trashcan directory declares. */
export const FSH_GUTS_KIND = "fsh-guts";

/**
 * Every `fsh-guts` directory that `root` declares; if it declares none, those
 * of the checkout stacked on it. Since placement PR0a the repository's
 * `fsh-guts/` is declared by the ROOT layer, not by the platform whose
 * tools read and write it.
 *
 * **The one place "where is the trashcan" is answered.** Before bean `9c7h`
 * the same resolution was written out twice (`logDirs`, the export's
 * `fshGutsDirs`) and `sample-import-run.ts` spelled `fsh-guts/samples` as a
 * literal. When the contents move to `cat/cat-harness/fsh-guts` (a
 * `keyedBy: "tip"` store read through `scripts/branch-store.ts`), this is the
 * seam the cutover changes, not each caller.
 *
 * A LIST, and callers must not quietly take the first (the `kgRoots`
 * contract): a writer that needs one directory asks {@link fshGutsDirectory}.
 * An unreadable declaration yields nothing rather than a guess.
 */
export function fshGutsDirectories(root: string): ResolvedDirectory[] {
  const isGuts = (d: ResolvedDirectory) => (d.graphTypologies as readonly string[]).includes(FSH_GUTS_KIND);
  try {
    const own = resolveDirectories([{ name: "(local)", root, own: true }]).filter(isGuts);
    return own.length > 0 ? own : checkoutDirectories(root, { stackedOn: root }).filter(isGuts);
  } catch {
    return [];
  }
}

/**
 * The ONE trashcan a writer lands in. More than one is an error and never
 * "the first", and none is an error too: a writer with nowhere declared must
 * not invent `fsh-guts/` beside the real one (the `dh4f` defect, written).
 */
export function fshGutsDirectory(root: string): string {
  const all = fshGutsDirectories(root).map((d) => d.absPath);
  if (all.length === 1) return all[0];
  throw new Error(
    all.length === 0
      ? `no \`${FSH_GUTS_KIND}\` directory is declared for ${root}, so there is nowhere to relocate into`
      : `\`${FSH_GUTS_KIND}\` is declared ${all.length} times (${all.join(", ")}), so there is no single trashcan to write to`,
  );
}
