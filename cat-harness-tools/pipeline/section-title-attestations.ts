/**
 * Where section-title-audit keeps its title-coherence VERDICTS, and where it
 * puts its derived working copy — bean `folio-assistant-5qy8`.
 *
 * Owner, 2026-10-11 (option 1): *"move section-title-audit's agent slots to
 * `test/attestations/section-title/…`, make the sidecar a derived working copy
 * published to `qa-reports`, and replace its freshness gate with
 * compute-and-judge."*
 *
 * Until then `folio/<paper>/section-title-audit.qa.json` was committed and
 * carried both halves: the machine findings, regenerated every run, and the
 * agent verdicts, which are judgements (ruling D2: judgements stay on main,
 * derived results go to `qa-reports`). Split by provenance:
 *
 * | half | where | written by |
 * |---|---|---|
 * | decided verdicts | `<attestations>/section-title/<paper>/section-title-audit.attestations.json` (`qa-attestations/v1`, family `section-title`) | `--verdict` |
 * | machine findings + every slot's current state | `test/results/section-title/<paper>/section-title-audit.json` | `--write-sidecar` |
 *
 * The derived copy is NOT named `*.qa.json`: the template's schema-sanity step
 * requires `block-qa/v1` of every such file under `test/results/`, and this is
 * not a block verdict.
 *
 * ## Auto-move on first save
 *
 * The attestations convention (owner ruling 2, 2026-10-01): on `miss` or
 * `absent`, a writer reads the prior derived file and MOVES the judgements it
 * still holds into the store as it saves, rather than refusing. Here the prior
 * file is the legacy committed sidecar; its decided `agent` slots move. A
 * `corrupt` or `unknown` store refuses and nothing is written.
 *
 * @module pipeline/section-title-attestations
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  QA_ATTESTATIONS_SCHEMA,
  SECTION_TITLE_FAMILY,
  SectionTitleAttestationsSchema,
  SectionTitleVerdictSchema,
  attestationsHomeFor,
  readAttestationFile,
  type SectionTitleVerdict,
} from "../schemas/sdlc/qa-attestations.js";
import { conventionalFolioDir } from "../schemas/kg/cat-harness.js";

/** chapter directory → section key → decided verdict. */
export type VerdictMap = Record<string, Record<string, SectionTitleVerdict>>;

/** The store file for one paper, and the store root whose absence means "no store yet". */
export function verdictStorePath(contentRoot: string, paper: string): { path: string; storeRoot: string } {
  const home = attestationsHomeFor(contentRoot);
  return { path: join(home.root, SECTION_TITLE_FAMILY, paper, "section-title-audit.attestations.json"), storeRoot: home.storeRoot };
}

/** The derived working copy for one paper — under `test/results/`, the QA working copy `qa:publish` records. */
export function derivedCopyPath(contentRoot: string, paper: string): string {
  return resolve(contentRoot, "test", "results", "section-title", paper, "section-title-audit.json");
}

/** The committed sidecar this replaces. Read once, to move its verdicts; never written. */
export function legacySidecarPath(contentRoot: string, paper: string): string {
  // The CONVENTION, not the declared folio: the legacy sidecar was only ever
  // written at `<root>/folio/<paper>/`, before a folio could declare another
  // root, so the convention is where it is (and `folioDir` would answer a
  // different question, failing where the `folio` kind is unregistered, `ot9a`).
  return resolve(conventionalFolioDir(contentRoot), paper, "section-title-audit.qa.json");
}

export type LoadedVerdicts =
  | { state: "ok"; verdicts: VerdictMap; moved: number; from?: string }
  | { state: "refused"; reason: string };

/** The decided slots of a legacy sidecar's `agent` blocks — `pending` and malformed slots carry no judgement. */
export function verdictsInLegacySidecar(json: unknown): VerdictMap {
  const out: VerdictMap = {};
  const chapters = (json as { chapters?: Record<string, { agent?: Record<string, unknown> }> } | null)?.chapters ?? {};
  for (const [chapter, entry] of Object.entries(chapters)) {
    for (const [key, slot] of Object.entries(entry?.agent ?? {})) {
      // A slot written before `--thorough` existed has no `stale_mode`; the
      // writer always read that as `manifest`, so the move does too.
      const s = slot && typeof slot === "object" && !("stale_mode" in slot) ? { ...slot, stale_mode: "manifest" } : slot;
      const r = SectionTitleVerdictSchema.safeParse(s);
      if (!r.success) continue;
      (out[chapter] ??= {})[key] = s as SectionTitleVerdict;
    }
  }
  return out;
}

/**
 * The paper's decided verdicts. `moved` counts verdicts read out of the legacy
 * sidecar because the store had none — the caller saves them before writing
 * anything derived, so they are never in neither place.
 */
export function loadVerdicts(contentRoot: string, paper: string): LoadedVerdicts {
  const { path, storeRoot } = verdictStorePath(contentRoot, paper);
  const read = readAttestationFile(path, storeRoot);
  if (read.state === "hit") {
    if (read.file.family !== SECTION_TITLE_FAMILY) {
      return { state: "refused", reason: `${path} is a ${read.file.family} file, not ${SECTION_TITLE_FAMILY}` };
    }
    return { state: "ok", verdicts: (read.file as { title_coherence: VerdictMap }).title_coherence, moved: 0 };
  }
  if (read.state === "corrupt" || read.state === "unknown") {
    return { state: "refused", reason: `${path}: ${read.state} — ${read.reason}. Nothing is written over a store that cannot be read.` };
  }
  const legacy = legacySidecarPath(contentRoot, paper);
  if (!existsSync(legacy)) return { state: "ok", verdicts: {}, moved: 0 };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(legacy, "utf8"));
  } catch {
    return { state: "refused", reason: `${legacy} holds the verdicts to move and does not parse — nothing is written` };
  }
  const verdicts = verdictsInLegacySidecar(json);
  const moved = Object.values(verdicts).reduce((n, c) => n + Object.keys(c).length, 0);
  return { state: "ok", verdicts, moved, from: legacy };
}

/** Write the paper's decided verdicts. Validated first: a file the reader would call corrupt is never written. */
export function saveVerdicts(contentRoot: string, paper: string, verdicts: VerdictMap): string {
  const { path } = verdictStorePath(contentRoot, paper);
  const file = {
    $schema: QA_ATTESTATIONS_SCHEMA,
    family: SECTION_TITLE_FAMILY,
    // declared-path-literal: the folio content root, as the subject's path. See `legacySidecarPath`.
    subject: { kind: "paper", id: paper, path: `folio/${paper}` },
    title_coherence: verdicts,
  };
  SectionTitleAttestationsSchema.parse(file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
  return path;
}

/** One slot as the derived copy shows it: a carried verdict, or `pending`. */
export type SlotView = SectionTitleVerdict | {
  title: string;
  depth: number;
  result: "pending";
  reviewer: null;
  reviewed_hash: null;
  stale_mode: "manifest" | "thorough";
  /** Present when a verdict exists but was given against a hash that has since changed. */
  stale_verdict?: SectionTitleVerdict;
};

/**
 * The slot for one section: the stored verdict when it was given against the
 * hash matching ITS recorded mode, else `pending` — carrying the stale verdict
 * so a reviewer sees what was said before.
 */
export function slotFor(
  node: { title: string; depth: number },
  stored: SectionTitleVerdict | undefined,
  hashFor: (mode: "manifest" | "thorough") => string,
  runMode: "manifest" | "thorough",
): SlotView {
  if (stored && stored.reviewed_hash === hashFor(stored.stale_mode)) return stored;
  return {
    title: node.title,
    depth: node.depth,
    result: "pending",
    reviewer: null,
    reviewed_hash: null,
    stale_mode: runMode,
    ...(stored ? { stale_verdict: stored } : {}),
  };
}
