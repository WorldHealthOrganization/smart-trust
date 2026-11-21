/**
 * Prose that says which file declares a graph, checked against the files.
 *
 * Bean `hrv2`. `AGENTS.md` told every reader that the `health` graph is
 * *"declared in `folio-assistant.config.json`"*. It is declared in
 * `cat-harness/cat-harness.json`, and the file the sentence names has no
 * `directories` key at all — it is the FOLIO config, a different family
 * entirely.
 *
 * ## Why `check:declaration-filename` could never have caught it
 *
 * That gate hunts the RETIRED name, `harness.json`, so a rename cannot leave
 * broken references behind. `AGENTS.md` does not name the retired file. It
 * names a real, current, openable file that simply does not declare that
 * graph. **A wrong name is not a retired name**, and no amount of extending
 * that check — to markdown or anywhere else — would have seen this.
 *
 * `hrv2` was opened asking whether the retired-name check should scan
 * markdown. That is a fair question with a 162-occurrence backlog behind it,
 * and it is **not this bug**. The two were conflated in the bean and are
 * separated here.
 *
 * ## The vocabulary is DERIVED, not guessed
 *
 * The first draft matched one sentence shape — `declared in X as the Y graph`
 * — and found exactly **one** claim in the corpus: the broken one. A rule
 * fitted to a single example generalises only as far as its phrasing, and the
 * next person to write such a sentence will word it differently, leaving a
 * gate that reports a clean run over a corpus of zero. That is the `dh4f`
 * shape this repository keeps paying for.
 *
 * So a claim is anchored on the GRAPH IDS the declarations actually declare
 * ({@link declaredGraphs}) rather than on wording: a `` `<id>` graph `` with a
 * `` `*.json` `` filename near it is a pairing, and the pairing either agrees
 * with the declarations or does not. Corpus went 1 → 6 on the same tree, and
 * **all six were wrong** — one wrong-but-real, five naming the retired file.
 *
 * Whitespace is flattened before matching, because the sentence that started
 * this wraps across a line break and a line-based scan was blind to the one
 * defect it would have existed for.
 *
 * @module folio-assistant/src/docs/declaration-claims
 */

import { existsSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";

import { findDeclarationFile, layerRootsIn, readDeclaration, rootForScope } from "../../schemas/kg/cat-harness.js";

/** Where a graph id is declared: the ids, each with its declaring file(s). */
export type GraphSources = Map<string, Set<string>>;

/**
 * Every declared graph id in the checkout, with the declaration file naming it.
 *
 * Built through `layerRootsIn` and `readDeclaration` rather than by globbing
 * for `*.json`, so this answers the same question about "which files are
 * declarations" that every other consumer answers — one fact, one place.
 */
export function declaredGraphs(repoRoot: string): GraphSources {
  const out: GraphSources = new Map();
  for (const instance of layerRootsIn(repoRoot)) {
    const file = findDeclarationFile(instance);
    if (file === undefined) continue;
    const decl = readDeclaration(instance);
    for (const entry of decl?.directories ?? []) {
      for (const graph of entry.graphTypologies ?? []) {
        (out.get(graph) ?? out.set(graph, new Set()).get(graph)!).add(join(instance, file));
      }
    }
  }
  return out;
}

/**
 * The text of one markdown block, whitespace flattened.
 *
 * Two rules, and each closes a class MEASURED on this corpus.
 *
 * **A paragraph is a block**, so a sentence wrapping across source lines is
 * still one claim — the defect that opened `hrv2` wraps between
 * *"declared in"* and the filename, and a line-based scan was blind to it.
 *
 * **A table ROW is its own block.** Without that, `AGENTS.md`'s actor/role
 * table pairs the `` `cat-harness` graph `` in the **Skill** row with
 * `scenarios/roles.json` in the **Role** row and reports a contradiction
 * between two facts that were never a claim. Measured: it was the first thing
 * this check found after the real defect was fixed, and it was wrong. The same
 * shape as `k59d`'s *"an arrow is not always a dependency"* guard.
 */
function blocks(markdown: string): string[] {
  const out: string[] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.length) out.push(current.join(" ").replace(/\s+/g, " ").trim());
    current = [];
  };
  for (const line of markdown.split("\n")) {
    if (line.trim() === "") flush();
    else if (line.trimStart().startsWith("|")) {
      flush();
      out.push(line.replace(/\s+/g, " ").trim());
    } else current.push(line);
  }
  flush();
  return out.filter(Boolean);
}

/** One `` `<graph>` graph `` paired with a `` `<file>.json` `` near it. */
export interface Claim {
  /** Repo-relative path of the markdown file making the claim. */
  file: string;
  graph: string;
  /** The filename as the prose spells it — a basename, not a path. */
  claimed: string;
  /** Roughly where, for a reader: the flattened text around the pairing. */
  context: string;
  /** Basenames of the files that really declare this graph. */
  actual: string[];
  agrees: boolean;
  /**
   * The claim names a pattern (`<name>.json`), not a file.
   *
   * Correct by construction and never a contradiction, but counted, because
   * the alternative is a corpus that shrinks every time prose is generalised.
   */
  placeholder: boolean;
}

/** How far from `` `<id>` graph `` a filename still counts as paired with it. */
const NEAR = 120;

// A directory prefix is ALLOWED and then discarded, because prose that names
// `cat-harness/cat-harness.json` is more useful to a reader than the bare
// basename — and a pattern rejecting the path form would make the clearer
// sentence INVISIBLE to this check rather than verified. A silent pass is the
// worse failure, and it was one edit away.
//
// `<` and `>` are here for the same reason, and the near-miss became a real
// one. A GENERIC skill correctly writes `<name>.json`: it describes any
// layer, so substituting this repository's concrete file would be wrong.
// Without the brackets in this class, every such sentence dropped out of the
// corpus — clearing bean `vzur`'s backlog took it 5 claims → 3, and each
// disappearance READ AS A FIX. That is the `dh4f` shape once more: examining
// less and reporting the same tick.
const JSON_FILE = /`([A-Za-z0-9._/<>-]+\.json)`/g;

/**
 * Does this spelling name a PATTERN rather than a file?
 *
 * `<name>.json`, `<instance>.json`, `<slug>.json` and their `.config.json`
 * siblings are how a generic skill has to write it. Such a claim cannot
 * contradict a declaration — there is no file to disagree with — but it is
 * emphatically NOT absent, so it is carried as a third state rather than
 * folded into `agrees`. Counting it as agreement would let a wrong concrete
 * filename be "fixed" by making it vague.
 */
function isPlaceholder(spelling: string): boolean {
  return /^<[A-Za-z0-9._-]+>/.test(spelling);
}

/**
 * Claims in one markdown document.
 *
 * `agrees` is true when the named file is among those declaring the graph,
 * compared by BASENAME: prose says `cat-harness.json`, the declaration lives
 * at `cat-harness/cat-harness.json`, and demanding the full path would fail
 * every correct sentence in the corpus.
 */
export function claimsIn(markdown: string, file: string, graphs: GraphSources): Claim[] {
  const out: Claim[] = [];
  for (const flat of blocks(markdown)) {
    for (const [graph, sources] of graphs) {
      const anchor = new RegExp("`" + graph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "` graph", "g");
      const actual = [...sources].map((s) => basename(s));
      for (const m of flat.matchAll(anchor)) {
        const window = flat.slice(Math.max(0, m.index - NEAR), m.index + m[0].length + NEAR);
        for (const f of window.matchAll(JSON_FILE)) {
          const claimed = basename(f[1]!);
          const placeholder = isPlaceholder(claimed);
          out.push({
            file,
            graph,
            claimed,
            context: window.trim(),
            actual,
            agrees: placeholder || actual.includes(claimed),
            placeholder,
          });
        }
      }
    }
  }
  return out;
}


/**
 * Repo-relative path prefixes whose markdown records what WAS true, not what is.
 *
 * DERIVED from the declarations rather than listed, because each of these is
 * already declared as a place for retired or foreign material and a second
 * hand-written list is the duplicated-fact defect this repository has a rule
 * about:
 *
 * | graph typology | why its prose is not a claim |
 * |---|---|
 * | `fsh-guts` | *"the trashcan that is kept"* — the declared destination for deprecated content. A retired document naming a retired filename is correct history, and rewriting it destroys the record |
 * | `beans`, `bean-defs`, `workflow-state` | a bean records what was true when it was written; the same argument, and the reason a bean is scrapped rather than deleted |
 * | `library` | ingested source material nobody in this repository authored |
 *
 * **PATHS, not basenames**, and the difference was measured: `library` is
 * declared at `agent-skills/library/` and in two content layers' directories
 * (the IRIS replica's and the formal-math layer's) as well as at the root.
 * Pruning a walk by first segment would have skipped the whole of the IRIS
 * replica's directory — three layers
 * silently unexamined, reported as a clean run. The `dh4f` shape arriving
 * through a convenience.
 */
export function historicalPrefixes(repoRoot: string): string[] {
  // `substrate-snapshot` is not history but somebody else's bytes at a pin
  // (`subscriptions/`, read-only): a claim in it describes the upstream's
  // declarations, not ours, so judging it against ours is wrong by
  // construction (folio-assistant#2862: an iHRIS skill naming its own
  // `roles.json`).
  const historical = new Set(["fsh-guts", "beans", "bean-defs", "workflow-state", "library", "substrate-snapshot"]);
  const out = new Set<string>();
  for (const instance of layerRootsIn(repoRoot)) {
    for (const entry of readDeclaration(instance)?.directories ?? []) {
      if (!(entry.graphTypologies ?? []).some((g) => historical.has(g))) continue;
      // RESOLVED BY THE ENTRY'S OWN SCOPE, then made repo-relative. A draft
      // that prefixed every path with its declaring layer produced
      // `cat-harness/beans/` and `cat-harness/fsh-guts/`, neither of which
      // exists — those are `scope: "repository"`. The fix that followed joined
      // EVERY path onto the repository root instead, which is the same mistake
      // the other way: an instance-scoped bean store (the content core's
      // and cat-harness-tools' own `beans/`, separated 2026-10-09) or
      // the IRIS replica's `library/` resolved to a root directory that is not there,
      // and their history was read as live claims. `rootForScope` is the rule
      // the declaration resolver itself uses.
      const abs = resolve(rootForScope(instance, entry.scope), entry.path);
      if (!existsSync(abs)) continue;
      const rel = relative(repoRoot, abs).split(sep).join("/");
      if (rel === "" || rel.startsWith("..")) continue;
      out.add(rel.replace(/\/?$/, "/"));
    }
  }
  // A declared-but-absent directory is NOT silently dropped as a judgement —
  // `check:declared-paths` owns that question and reports it. Filtering here
  // only keeps this function from pruning a walk by a path that is not there.
  //
  // `beans/beans.json` is a bean-graph declaration rather than a layer
  // declaration, so `layerRootsIn` does not reach it. The root declaration
  // already carries `beans/` as the `beans` graph, which is the entry above —
  // stated because a draft looked for `bean-defs` here, found nothing, and let
  // the whole store back into the corpus.
  return [...out].sort();
}
