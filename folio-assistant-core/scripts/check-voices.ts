#!/usr/bin/env bun
/**
 * Validate the voice graph — and, above all, that every rule cites something.
 *
 * `loadVoices` already refuses a malformed profile, so this adds the checks a
 * Zod schema cannot make: that a cited `library/` section EXISTS on disk, that a
 * cited KG node exists, and that the quote is long enough to be a quote.
 *
 * The defect it exists to make impossible is PR #210's: three WHO voice profiles
 * with ten plausible rules each and `source: null`. Plausible is not right — its
 * first rule asserted `-ise/-isation` as WHO's spelling baseline, and the WHO
 * Editorial Style Manual says "`-ize` … is preferred" on page 14. Nothing in a
 * type system catches a confident invention; a resolvable citation does.
 *
 *     bun run cat check:voices
 *
 * @module scripts/check-voices
 * @covers voices, voice-vendors
 *
 * ## A vendor voice must SPECIALISE a voice that resolves
 *
 * `voice-vendors` (bean `rkqp`) holds a base voice specialised for one agent
 * vendor: `folio-voice/v1` with `extends` naming the base. The citation checks
 * below read those files like any other voice, and say nothing about the one
 * property that makes them vendor voices — so a vendor voice with no `extends`
 * (a base voice filed in the wrong place) or one whose `extends` names a voice
 * no layer ships, or that cycles, passed. `resolveVoice` reports both
 * failures and had no caller in a gate: `skill-voice-review.ts` skips an
 * unresolvable chain on the stated ground that *"`check:voices` owns"* it,
 * which this file did not do until PR #2094. See {@link vendorVoiceFindings}.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { explainFailure, resolveLibraryRef } from "../schemas/library-ref.js";
import { join, relative, resolve } from "node:path";

import {
  explainVoiceFailure,
  loadVoices,
  resolveVoice,
  unionRules,
  voicesPresent,
  type VoiceProfile,
} from "@litlfred/cat-harness-tools/schemas/content/voices.js";
import {
  declaresInstance,
  defaultGraphTypologies,
  directoriesForGraph,
  instanceRootsIn,
  readDeclaration,
  repoRootFor,
  resolveDirectories,
} from "@litlfred/cat-harness-tools/schemas/kg/cat-harness.ts";
import { isMechanicalRole, readRoleGraph, type RoleGraph } from "@litlfred/cat-harness-tools/schemas/process/role-graph.js";

const ROOT = resolve(import.meta.dir, "..");
/** The checkout, one level out: a cross-layer citation is resolved against sibling layers. */
const REPO_ROOT = resolve(ROOT, "..");

/**
 * Every layer in this checkout that ships a `voices/` directory — FOUND,
 * not assumed to be this one.
 *
 * ## Measured, on the change that needed it
 *
 * This module read `ROOT` and nothing else. Bean `w095` moved the three WHO
 * voices into `who-style-guide/`, and the very next run reported
 *
 *     Voice graph  (1 voices, 12 rules)
 *     ✓ every rule cites a source that resolves
 *
 * and exited 0. **Twenty-five rules across three voices went unchecked and
 * nothing said so** — the `dh4f` defect in the gate whose entire subject is
 * citations that do not resolve. Predicted before the move and confirmed by
 * making it, which is the only way to tell a guess from a finding.
 *
 * It is the same shape as `check-declared-assets`, fixed hours earlier the
 * same day: a checker pinned to one layer in a repository that has eight.
 * The remedy is the same and it is not "add who-style-guide to a list" — a
 * hardcoded list is a declaration nobody declared, and the next layer
 * would be invisible in exactly this way.
 *
 * One level down plus the root itself. Deeper is deliberately NOT walked: a
 * `voices/` inside `node_modules/` or a vendored checkout belongs to somebody
 * else, and auditing another project's citations reports findings nobody here
 * can act on.
 */
function instancesWithVoices(repoRoot: string): string[] {
  const out: string[] = [];
  if (voicesPresent(repoRoot)) out.push(repoRoot);
  for (const e of readdirSync(repoRoot, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".") || e.name === "node_modules") continue;
    const dir = join(repoRoot, e.name);
    if (voicesPresent(dir)) out.push(dir);
  }
  return out.sort();
}

// No `LIBRARY` constant any more, and that is the change rather than a tidy-up.
// This module composed `join(LIBRARY, libraryId, "sections", …)` against the
// VOICE'S OWN layer root, which made a cross-layer citation
// unrepresentable — the blocker on moving the three WHO voices out (beans
// `z7ev`, `w095`), predicted by bean `r1lz` the day before the move was
// decided. `resolveLibraryRef` reads the target layer's own declaration, so
// where a corpus lives is answered once, by the layer that owns it.
const MIN_QUOTE = 24;

/**
 * Resolve a citation, in this layer or another.
 *
 * Delegates to `folio-assist-core`'s `resolveLibraryRef` rather than composing
 * a path. Composing one is what this file did until 2026-09-20 — `join(LIBRARY,
 * …)` against the VOICE'S OWN layer root — which made a cross-layer
 * citation unrepresentable and was the blocker on moving the three WHO voices
 * out (beans `z7ev`, `w095`). Bean `r1lz` predicted it the day before the move
 * was decided.
 *
 * The resolver's four failure kinds are reported as they come back, unmerged:
 * "that layer is not in this checkout", "that layer holds no corpus",
 * "that document was never ingested" and "that section is missing" need four
 * different fixes, and collapsing them sends a reader to the wrong one.
 */
function resolveCitation(
  src: { instance?: string; libraryId: string; sectionId?: string },
  citingRoot: string,
): { ok: true; path: string } | { ok: false; why: string; notMounted: boolean } {
  // The CITING layer, not always `cat-harness`. A BARE citation resolves
  // against whoever wrote it, so hardcoding one root would have answered a
  // catalogue layer's voice's bare reference out of the platform's library —
  // the wrong corpus, reported as a confident resolution.
  const r = resolveLibraryRef(src, citingRoot, REPO_ROOT);
  return r.ok
    ? { ok: true, path: r.path }
    : { ok: false, why: explainFailure(r.failure), notMounted: r.failure.kind === "library-not-mounted" };
}

/**
 * The root of the layer a citation names, or the voice's own when it names
 * none.
 *
 * `undefined` means the name resolves to no layer in this repository, which
 * is a DIFFERENT finding from "the file is not there" and is reported as one:
 * a typo in the layer name and a moved file are fixed in different places.
 */
function instanceRootFor(instance: string | undefined, ownRoot: string): string | undefined {
  if (instance === undefined) return ownRoot;
  const repo = repoRootFor(ownRoot);
  for (const root of instanceRootsIn(repo)) {
    if (declaresInstance(readDeclaration(root), instance)) return root;
  }
  return undefined;
}

/**
 * A layer's role graph, from its declared `scenarios` directory, or
 * `undefined` when it declares none. Cached: every voice addressing a role in
 * the same layer would otherwise re-read the same file.
 */
const roleGraphs = new Map<string, RoleGraph | undefined>();
function roleGraphOf(instanceRoot: string): RoleGraph | undefined {
  if (!roleGraphs.has(instanceRoot)) {
    const dir = resolveDirectories([{ name: "(local)", root: instanceRoot, own: true }]).find(
      (d) => d.id === "scenarios" && d.own && d.scope !== "repository",
    )?.absPath;
    roleGraphs.set(instanceRoot, dir === undefined ? undefined : readRoleGraph(dir));
  }
  return roleGraphs.get(instanceRoot);
}

/**
 * The vendor-voice criterion: each voice found in a declared `voice-vendors`
 * directory declares `extends`, and its chain resolves against the voices
 * every layer ships — no missing base, no cycle.
 *
 * Pure over its inputs so a test can hand it a fixture: `vendors` are the
 * vendor voice files (path, for the message, and the parsed profile), and
 * `shipped` is every loaded voice by id. Lookup is by id because `main`
 * refuses a duplicate id before this runs, so an id names one voice.
 */
export function vendorVoiceFindings(
  vendors: ReadonlyArray<{ where: string; voice: VoiceProfile }>,
  shipped: ReadonlyMap<string, VoiceProfile>,
): string[] {
  const out: string[] = [];
  for (const { where, voice } of vendors) {
    if (!voice.extends) {
      out.push(
        `${where}: vendor voice \`${voice.id}\` declares no \`extends\`, so it specialises nothing — ` +
          `a base voice filed under a vendors directory`,
      );
      continue;
    }
    const r = resolveVoice({ instance: "(local)", voice }, (ref) => {
      const v = shipped.get(ref.voiceId);
      return v === undefined ? undefined : { instance: "(local)", voice: v };
    });
    if (!r.ok) out.push(`${where}: ${explainVoiceFailure(r.failure)}`);
  }
  return out;
}

/**
 * The vendor voice files, read from every declared `voice-vendors` directory —
 * resolved through the declaration rather than a `vendors/` literal. A
 * directory's own declaration file (`vendors.json`) is not a voice. Returns the
 * directories walked too, so the run can print its denominator.
 */
function vendorVoices(repoRoot: string): { dirs: string[]; vendors: Array<{ where: string; voice: VoiceProfile }> } {
  const declFile = defaultGraphTypologies.get("voice-vendors")?.declarationFile;
  const dirs = new Set<string>();
  for (const root of instanceRootsIn(repoRoot)) for (const d of directoriesForGraph(root, "voice-vendors")) if (existsSync(d)) dirs.add(resolve(d));
  const vendors: Array<{ where: string; voice: VoiceProfile }> = [];
  for (const d of [...dirs].sort()) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".json") || e.name === declFile) continue;
      const p = join(d, e.name);
      vendors.push({ where: relative(repoRoot, p), voice: JSON.parse(readFileSync(p, "utf-8")) as VoiceProfile });
    }
  }
  return { dirs: [...dirs].sort(), vendors };
}

function main(): number {
  const instances = instancesWithVoices(REPO_ROOT);
  if (instances.length === 0) {
    // Third state. A checkout with no voice graph anywhere is legitimate;
    // saying "0 problems" over a directory that is not there would be a clean
    // run across nothing.
    console.log("check:voices — no instance in this checkout ships a voices/ directory. Nothing checked.");
    return 0;
  }

  // Each voice keeps the root it was LOADED from, because that is the layer
  // a bare citation resolves against. Flattening them into one list and
  // resolving everything against `ROOT` is the bug this enumeration exists to
  // avoid, one step in.
  const loaded = instances.flatMap((root) =>
    loadVoices(root).map((voice) => ({ voice, root })),
  );
  const voices = loaded.map((l) => l.voice);

  // ── A voice id must IDENTIFY a voice, and that is checked here ──────────
  //
  // Everything below — `rootOf`, `instanceOfSource`, and `unionRules`, which
  // reports a finding as `<voiceId>/<ruleId>` — is keyed on the id alone.
  // `instanceOfSource`'s own comment says why a global map is wrong ("two
  // voices may legitimately derive same-named documents from different
  // layers, and a global map would silently pick one") and then keys on
  // `v.id`, which collides the moment two LAYERS ship a voice of the same
  // name. The loser's citations would then resolve against the winner's
  // layer root: a wrong pass, reported in the same words as a right one.
  //
  // Refusing the duplicate is the fix rather than composite keys, because the
  // id is already load-bearing elsewhere and a duplicate is unworkable there
  // too: `harness.config.json` activates voices by bare id
  // (`{"voices": {"active": ["who-editorial"]}}`), so two voices called
  // `who-editorial` give that line no meaning either. One refusal, at the one
  // place both problems start.
  const seenId = new Map<string, string>();
  for (const { voice, root } of loaded) {
    const prior = seenId.get(voice.id);
    if (prior !== undefined) {
      console.error(
        `check:voices — voice id "${voice.id}" is declared by two instances: ` +
          `${relative(REPO_ROOT, prior) || "."} and ${relative(REPO_ROOT, root) || "."}.\n` +
          `  A voice id is how a citation resolves and how \`<name>.config.json\` ` +
          `activates one, so it has to name exactly one voice. Rename one of them.`,
      );
      return 1;
    }
    seenId.set(voice.id, root);
  }

  const rootOf = new Map(loaded.map((l) => [l.voice.id, l.root]));
  const rules = unionRules(voices);
  const problems: string[] = [];

  /**
   * Which layer holds each declared source, from the VOICE that declares
   * it — so a rule citing that source need not repeat the answer.
   *
   * A voice's `sources[]` is where it says what it was derived from. A rule's
   * `source` says which of those, and where in it. Making every rule restate
   * the layer would put one fact in two places and let them disagree: a
   * voice pointing at one layer with a rule pointing at another is
   * representable, meaningless, and nothing would catch it.
   *
   * This became load-bearing with bean `frs5`, which moved the corpus out of
   * the platform. Before it every citation resolved locally and the layer
   * was never written down at all; after it, the four voices in `cat-harness/`
   * cite documents in two other layers across dozens of rules.
   *
   * Keyed per VOICE, not globally: two voices may legitimately derive
   * same-named documents from different layers, and a global map would
   * silently pick one.
   */
  const instanceOfSource = new Map<string, Map<string, string>>();
  /**
   * Sources HELD ELSEWHERE: the voice names a layer this checkout does not
   * compose, and says where the document is held with a `url`. Owner, 2026-10-31
   * (fa#2781): "report as held elsewhere". Such a citation is not checked here,
   * since there is nothing here to check it against, and it is listed rather
   * than failed. A source with no `url` stays a problem: then nothing says
   * where it is, and an unknown layer is most likely a typo.
   */
  const heldElsewhere = new Map<string, Map<string, string>>(); // voice -> layer -> url
  const elsewhere: string[] = [];
  // Citations into a corpus kept in an opt-in group the mount did not take.
  const notMounted: string[] = [];
  const isHeldElsewhere = (voice: string, instance: string | undefined): string | undefined => {
    if (instance === undefined) return undefined;
    const url = heldElsewhere.get(voice)?.get(instance);
    return url !== undefined && instanceRootFor(instance, rootOf.get(voice)!) === undefined ? url : undefined;
  };
  for (const v of voices) {
    const m = new Map<string, string>();
    for (const srcDecl of v.sources) {
      if (srcDecl.libraryId && srcDecl.instance) m.set(srcDecl.libraryId, srcDecl.instance);
      if (srcDecl.instance && srcDecl.url) {
        (heldElsewhere.get(v.id) ?? heldElsewhere.set(v.id, new Map()).get(v.id)!).set(srcDecl.instance, srcDecl.url);
      }
    }
    instanceOfSource.set(v.id, m);
  }

  for (const { voice, rule } of rules) {
    const src = rule.source;
    const where = `${voice}/${rule.id}`;
    // An explicit `instance` on the rule always wins: inheritance is a default,
    // not an override, so a rule citing a document its voice does not declare
    // can still say where it is.
    const citedInstance =
      src.instance ??
      (src.libraryId ? instanceOfSource.get(voice)?.get(src.libraryId) : undefined);
    if (src.quote.trim().length < MIN_QUOTE) {
      problems.push(`${where}: quote is ${src.quote.trim().length} chars — a citation that short cannot be checked`);
    }
    const elsewhereUrl = isHeldElsewhere(voice, citedInstance);
    if (elsewhereUrl !== undefined && (src.libraryId || src.path)) {
      elsewhere.push(`${where}: cites ${citedInstance}:${src.libraryId ?? src.path}${src.sectionId ? `/${src.sectionId}` : ""}, held at ${elsewhereUrl}`);
    } else if (src.libraryId && src.sectionId) {
      // The resolver's own explanation is used verbatim: it distinguishes four
      // failures this check cannot, and restating them here would make a fifth
      // wording of the same facts, free to drift from the four.
      const res = resolveCitation(
        { instance: citedInstance, libraryId: src.libraryId, sectionId: src.sectionId },
        rootOf.get(voice)!,
      );
      if (!res.ok) {
        const from = citedInstance ? `${citedInstance}:` : "";
        // A corpus in an opt-in group this checkout's mount left out is not a
        // wrong citation: listed with the citations held elsewhere, not failed.
        (res.notMounted ? notMounted : problems).push(`${where}: cites ${from}${src.libraryId}/${src.sectionId} — ${res.why}`);
      }
    } else if (src.path) {
      // A `#anchor` is a section within the file; check the file.
      const file = src.path.split("#")[0]!;
      // Resolved through the CITED layer, exactly as the library branch
      // above does. It did not until 2026-09-21, and the asymmetry was
      // invisible while every path happened to be layer-local: a voice
      // citing a file in another layer could not pass however correctly it
      // declared where that file was. It surfaced the moment `milnor` moved to
      // the science layer carrying one rule that cites a cat-harness module
      // — the rule was right, the checker was not.
      const citedRoot = instanceRootFor(citedInstance, rootOf.get(voice)!);
      if (citedRoot === undefined) {
        problems.push(
          `${where}: cites path ${file} in instance "${citedInstance}", which is not an ` +
            `instance of this repository`,
        );
      } else if (!existsSync(join(citedRoot, file))) {
        const from = citedInstance ? `${citedInstance}:` : "";
        problems.push(`${where}: cites path ${from}${file}, which does not exist there`);
      }
    }
  }

  // Every declared source document must itself be ingested. A voice naming a
  // library id nobody ingested is the `source: null` defect wearing an id.
  for (const v of voices) {
    for (const s of v.sources) {
      const elsewhereUrl = isHeldElsewhere(v.id, s.instance);
      if (elsewhereUrl !== undefined) {
        elsewhere.push(`${v.id}: names source ${s.instance}:${s.libraryId ?? s.path}, held at ${elsewhereUrl}`);
        continue;
      }
      if (s.libraryId) {
        // Document-level: no sectionId, so the resolver checks `structure.json`
        // — "was this ingested at all", which is a different question from
        // "does this section exist" and gets its own finding.
        const res = resolveCitation({ instance: s.instance, libraryId: s.libraryId }, rootOf.get(v.id)!);
        if (!res.ok) (res.notMounted ? notMounted : problems).push(`${v.id}: names source ${s.libraryId} — ${res.why}`);
      }
      // Against the DECLARING layer: a `path` is a node of the voice's own
      // knowledge graph, so looking for it under the platform would report a
      // catalogue layer's voice's own node as missing.
      // Through the NAMED layer when the source names one, exactly as a
      // rule's `path` is resolved above: a voice addressing a role cites the
      // role graph that declares it, which is the dependency's, not its own.
      if (s.path) {
        const citedRoot = instanceRootFor(s.instance, rootOf.get(v.id)!);
        if (citedRoot === undefined) {
          problems.push(`${v.id}: names source ${s.path} in instance "${s.instance}", which is not an instance of this repository`);
        } else if (!existsSync(join(citedRoot, s.path.split("#")[0]!))) {
          problems.push(`${v.id}: names source ${s.instance ? `${s.instance}:` : ""}${s.path}, which does not exist`);
        }
      }
    }
  }

  // ── A voice points at the roles it addresses, and each must resolve ─────
  //
  // `activeIn.roles` is the pointer from the dependent (the voice) to the
  // general node (the role) — #1168, B2. A role id that resolves to nothing
  // scopes the voice to a lane nobody can act in, which switches it off in
  // silence; that is a problem, not a note.
  const addressed = new Map<string, Set<string>>(); // layer root -> role ids some voice addresses
  for (const { voice: v, root } of loaded) {
    for (const ref of v.activeIn?.roles ?? []) {
      const rolesRoot = instanceRootFor(ref.instance, root);
      const graph = rolesRoot === undefined ? undefined : roleGraphOf(rolesRoot);
      const from = ref.instance ? `${ref.instance}:` : "";
      if (rolesRoot === undefined) {
        problems.push(`${v.id}: addresses role ${from}${ref.role}, but "${ref.instance}" is not an instance of this repository`);
      } else if (graph === undefined) {
        problems.push(`${v.id}: addresses role ${from}${ref.role}, but that instance declares no role graph`);
      } else if (!graph.roles.some((r) => r.id === ref.role)) {
        problems.push(`${v.id}: addresses role ${from}${ref.role}, which that instance's role graph does not declare`);
      } else {
        (addressed.get(rolesRoot) ?? addressed.set(rolesRoot, new Set()).get(rolesRoot)!).add(ref.role);
      }
    }
  }

  // ── A vendor voice specialises a base that resolves ─────────────────────
  const shipped = new Map(voices.map((v) => [v.id, v]));
  const { dirs: vendorDirs, vendors } = vendorVoices(REPO_ROOT);
  problems.push(...vendorVoiceFindings(vendors, shipped));

  console.log(`Voice graph  (${voices.length} voices, ${rules.length} rules)\n`);
  // The denominator: which vendor directories were walked, and how many voices
  // they held — a run over no declared vendors directory says so.
  console.log(
    vendorDirs.length === 0
      ? "  vendor voices: no instance declares a `voice-vendors` directory — nothing to resolve\n"
      : `  vendor voices: ${vendors.length} examined across ${vendorDirs.length} declared director(ies); each must extend a voice that resolves\n`,
  );
  for (const v of voices) {
    const mech = v.rules.filter((r) => r.patterns || r.terminology).length;
    const judged = v.rules.filter((r) => r.judgementOnly).length;
    console.log(
      `  ${v.id.padEnd(26)} ${String(v.rules.length).padStart(2)} rules  ` +
        `${String(mech).padStart(2)} with a mechanical half  ${String(judged).padStart(2)} judgement-only`,
    );
  }
  console.log();

  // Coverage, reported and never failed: which roles that READ prose no voice
  // addresses. It was the audit criterion \`role-declares-voice\` while the
  // role carried its voice; now the voice points at the role, from a
  // layer the role graph cannot see, so it is answered here, where both
  // are visible. Only for layers some voice already addresses — a role
  // graph no voice reaches is not this check's to grade.
  for (const [rolesRoot, ids] of addressed) {
    const unaddressed = (roleGraphOf(rolesRoot)?.roles ?? [])
      .filter((r) => !isMechanicalRole(r) && r.persona !== undefined && !ids.has(r.id))
      .map((r) => r.id);
    const name = readDeclaration(rolesRoot)?.name ?? relative(REPO_ROOT, rolesRoot);
    console.log(
      `  ${name}: ${ids.size} role(s) addressed by a voice` +
        (unaddressed.length ? `; ${unaddressed.length} with a persona and no voice: ${unaddressed.join(", ")}` : ""),
    );
  }
  if (addressed.size > 0) console.log();

  // Listed, not failed: the denominator says how much was NOT checked here.
  if (notMounted.length > 0) {
    console.log(`${notMounted.length} citation(s) into a corpus this checkout's mount left out, not checked here:`);
    for (const e of notMounted) console.log(`  ~ ${e}`);
    console.log();
  }
  if (elsewhere.length > 0) {
    console.log(`${elsewhere.length} citation(s) held elsewhere, not checked here (the instance is not in this checkout):`);
    for (const e of elsewhere) console.log(`  ~ ${e}`);
    console.log();
  }

  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    return 1;
  }
  console.log("✓ every rule cites a source that resolves, with a quote long enough to check, and every vendor voice extends a voice that resolves");
  return 0;
}

if (import.meta.main) process.exit(main());
