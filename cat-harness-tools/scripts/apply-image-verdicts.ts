#!/usr/bin/env bun
/**
 * Apply an agent's INSPECTION of the extracted images to their sidecars.
 *
 * `pdf-images.py` classifies by geometry, which only says whether an image is
 * the whole page or something on it; no geometry tells a logo from a chart.
 * The finer roles come from looking, recorded as an `inspection` basis naming
 * who looked, when, and what they saw. The schema refuses `logo` or
 * `decorative` on a geometry basis (`schemas/content/document-image.ts`).
 *
 * ## The verdicts are DATA, not code
 *
 * `library/image-verdicts.json` holds one agent's judgement, reviewable line
 * by line. This script applies it mechanically and adds nothing of its own.
 *
 * ## Every narrative lands as a DRAFT
 *
 * An agent may write a description; only a human may accept one
 * (`schemas/content/narrative.ts`). This script cannot produce a `confirmed`
 * narrative; `scripts/narratives.ts` is where a person does that, and it
 * refuses to run non-interactively.
 *
 * ## Applying to a STAGED entry
 *
 * `ingest --promote` refuses an entry whose `image-descriptions` requirement
 * is unmet, so descriptions must be writable before promotion.
 * `--staging <entry-dir> --library <lib-dir>` writes into the staged entry;
 * the verdicts are still read from `<lib-dir>/image-verdicts.json`, keyed by
 * the doc id, which is the same before and after promotion.
 *
 * **`--library` is required with `--staging`, and is not guessed**: a staging
 * directory does not say which library the document is promoted into (the
 * same rule `ingest` enforces for its own `--library`).
 *
 * ## Exit codes
 *
 * The whole-corpus mode exits 1 when it finds no verdict file anywhere. In
 * staging mode no verdicts yet is the expected state and exits 0; the
 * `image-descriptions` requirement is what refuses the promotion. An ORPHANED
 * verdict (naming an image the sidecar does not have) fails in either mode.
 *
 * ## Vector figures
 *
 * `pdf-vector-figures.py` renders the drawn figures `pdf-images.py` cannot
 * see, and assigns them no role. Their verdicts arrive through the same
 * `image-verdicts.json`, keyed `vfig-pNNN`, as the same `inspection` basis.
 * A vector verdict may also carry `shows`: the declared figure numbers the
 * render holds; `image-descriptions` counts a figure as reached by this arm
 * only through `shows`. A render nobody has judged is REPORTED, never a
 * failure, in either mode; `image-descriptions` names what is uncovered.
 *
 *   bun run cat-harness-tools/scripts/apply-image-verdicts.ts            # apply
 *   bun run cat-harness-tools/scripts/apply-image-verdicts.ts --check    # report only
 *   bun run cat-harness-tools/scripts/apply-image-verdicts.ts \
 *     --staging ingest-staging/<doc-id> --library ../agent-skills/library
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";

import { AttributionSchema } from "../schemas/content/attribution.ts";
import {
  DESCRIBABLE_ROLES,
  ImagesSidecarSchema,
  SETTLED_BY_COMPUTATION,
  requiresInspection,
  type ImageRole,
} from "../schemas/content/document-image.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import {
  VECTOR_FIGURES_FILE,
  VectorFiguresSidecarSchema,
  isVectorFigureId,
} from "../schemas/content/vector-figure.ts";
import { HARNESS_ROOT } from "./lib/roots.ts";
import { DEFAULT_NARRATIVE_LANG } from "./lib/narrative-display.ts";
import { libraryEntryDir } from "./lib/library-entry-graphs.ts";

const ROOT = resolve(HARNESS_ROOT);

/**
 * The library directory as the layer DECLARES it, not as convention
 * assumes it. `harness.json` is the list; hardcoding the path is how a
 * consumer comes to scan a directory that is not there after a relocation —
 * which this repository has already done once, moving the whole layer
 * under `cat-harness/`.
 */
// EVERY declared library, not the first — a verdict names a document, and
// looking for it in one of several libraries would report "no such document"
// about one that is right there. `directoriesForGraph(...)[0]` until `a02m`.
//
// declared-path-literal: the convention fallback, at the call site so the
// choice is visible. An absent directory is reported below, not assumed empty.
const LIBRARIES: string[] = (() => {
  const declared = corpusDirectoriesForGraph(ROOT, "library");
  return declared.length > 0 ? declared : [join(ROOT, "library")];
})();

interface Verdict {
  role: ImageRole;
  saw: string;
  draft: string;
  /**
   * The language `draft` is written in, as a BCP 47 tag. Defaults to
   * {@link DEFAULT_NARRATIVE_LANG} (bean `cat-tools-e1lo`).
   */
  lang?: string;
  /**
   * The same description in other languages, keyed by BCP 47 tag, e.g. the
   * six UN languages (owner, 2026-11-11). Each becomes its own `draft`
   * narrative beside `draft`, since a slot holds one narrative per language
   * (bean `cat-tools-e1lo`). A key equal to `lang` is refused, never merged.
   */
  translations?: Record<string, string>;
  /** Vector figures only: the declared figure numbers this render shows. */
  shows?: string[];
  /**
   * Who looked at THIS image, when that was not the document's inspector —
   * bean `ay3x`. The per-document `attribution` was enough while one session
   * judged a document's images; `9789240101197-eng` has raster verdicts from
   * one session and vector verdicts from another, and a per-document entry
   * would re-attribute one set to the other. Most specific wins.
   */
  inspected_by?: unknown;
  inspected_at?: string;
}
interface VerdictFile {
  inspected_by: unknown;
  inspected_at: string;
  /**
   * Who looked at ONE document's images, when that was not `inspected_by`.
   *
   * The file-wide pair was the only attribution until bean `scfh`, so every
   * document added to a library's verdicts inherited the first inspector and
   * the first date: appending a deck inspected on 2026-09-30 would have
   * recorded it as inspected on 2026-09-22 by someone else. An attribution
   * that is wrong is worse than none, because it is the part a reader trusts.
   */
  attribution?: Record<string, { inspected_by: unknown; inspected_at: string }>;
  verdicts: Record<string, Record<string, Verdict>>;
}

/**
 * The draft narratives one verdict yields: `draft` in `lang`, then one per
 * `translations` entry. A translation in the verdict's own language would put
 * two narratives of one language in a slot, which the schema refuses; it is
 * refused here first, with the verdict's language named.
 */
export function draftsOf(v: Verdict, who: unknown, when: string) {
  const lang = v.lang ?? DEFAULT_NARRATIVE_LANG;
  const out = [{ text: v.draft, lang, state: "draft" as const, drafted_by: who, drafted_at: when }];
  for (const [tag, text] of Object.entries(v.translations ?? {})) {
    if (tag === lang) throw new Error(`a translation keyed "${tag}" repeats the verdict's own language`);
    out.push({ text, lang: tag, state: "draft" as const, drafted_by: who, drafted_at: when });
  }
  return out;
}

/**
 * The drafts a verdict yields, with the narratives already held in the
 * languages the verdict does not supply — kept only when the held narrative
 * in the verdict's own language is the same text, since a translation of a
 * description that has changed describes something else.
 *
 * `image-verdicts.json` holds the English verdict and, for most documents,
 * no `translations`: the other five languages were drafted into the
 * sidecars afterwards. Rebuilding a sidecar from the verdicts alone dropped
 * them on every re-ingest and on every bare run of this script (the content
 * re-ingest pilot, 2026-11-14: 15 images on two entries, and 10 other
 * entries by a bare run).
 */
export function draftsKeeping(v: Verdict, who: unknown, when: string, held: unknown) {
  const fresh = draftsOf(v, who, when);
  const list = (Array.isArray(held) ? held : held ? [held] : []) as Array<{ lang?: string; text?: string }>;
  const lang = v.lang ?? DEFAULT_NARRATIVE_LANG;
  const same = list.some((n) => (n.lang ?? DEFAULT_NARRATIVE_LANG) === lang && typeof n.text === "string" && n.text.trim() === v.draft.trim());
  if (!same) return fresh;
  const have = new Set(fresh.map((n) => n.lang));
  return [...fresh, ...list.filter((n) => n.lang !== undefined && !have.has(n.lang))] as typeof fresh;
}

/** The attribution for one document: its own, else the file's. */
export function attributionFor(vf: VerdictFile, docId: string): { by: unknown; at: string } {
  const own = vf.attribution?.[docId];
  return own ? { by: own.inspected_by, at: own.inspected_at } : { by: vf.inspected_by, at: vf.inspected_at };
}

/** A narrative slot that holds some written text, else `undefined` (a fresh sidecar's "not-authored" placeholder holds none). */
function withText(slot: unknown): unknown {
  const list = (Array.isArray(slot) ? slot : slot ? [slot] : []) as Array<{ text?: unknown }>;
  return list.some((n) => typeof n?.text === "string" && n.text.trim() !== "") ? slot : undefined;
}

/** The narratives a sidecar held, by image or render id; empty when there is none or it will not parse. */
function heldNarratives(text: string | undefined, key: "images" | "figures"): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (!text) return out;
  try {
    for (const x of ((JSON.parse(text) as Record<string, unknown>)[key] ?? []) as Array<{ id?: string; narrative?: unknown }>) {
      if (x?.id && x.narrative !== undefined) out.set(x.id, x.narrative);
    }
  } catch {
    // An unreadable earlier sidecar holds nothing to keep.
  }
  return out;
}

export interface ApplyResult {
  docId: string;
  applied: number;
  /** Images in the sidecar with no verdict. Never silently skipped. */
  unjudged: string[];
  /** Verdicts naming an image the sidecar does not have. */
  orphaned: string[];
}

/**
 * Rewrite one sidecar from the verdicts. Pure: returns the new body and the
 * counts, so `--check` and the real run cannot diverge.
 */
export function applyTo(
  sidecarText: string,
  docVerdicts: Record<string, Verdict>,
  by: unknown,
  at: string,
  /** The sidecar the entry held before a re-ingest rebuilt this one: its narratives are kept (see {@link draftsKeeping}). */
  priorText?: string,
): { text: string; result: Omit<ApplyResult, "docId"> } {
  const parsed = ImagesSidecarSchema.parse(JSON.parse(sidecarText));
  const prior = heldNarratives(priorText, "images");
  const images = parsed.images ?? [];
  const unjudged: string[] = [];
  const seen = new Set<string>();

  const next = images.map((img) => {
    const v = docVerdicts[img.id];
    if (!v) {
      // A page scan needs no inspection — geometry settles it — and neither
      // does `chrome`, which the capture's own producer settles. Anything else
      // without a verdict is REPORTED, because an image nobody looked at is
      // not the same as one judged unremarkable.
      //
      // Asked as "is this role already settled" rather than "is it a page
      // scan": the literal was right while geometry was the only computable
      // basis, and adding `chrome` to the enum without changing it here would
      // have reported 104 navigation icons as awaiting inspection.
      if (!SETTLED_BY_COMPUTATION.includes(img.role)) unjudged.push(img.id);
      return img;
    }
    seen.add(img.id);
    const page = img.basis?.page;
    if (page === undefined) {
      // No page means no geometry ran; an inspection basis still needs one,
      // and inventing it would be the fabrication this module exists against.
      unjudged.push(img.id);
      return img;
    }
    const who = AttributionSchema.parse(v.inspected_by ?? by);
    const when = v.inspected_at ?? at;
    const narrative = DESCRIBABLE_ROLES.includes(v.role)
      ? draftsKeeping(v, who, when, withText((img as { narrative?: unknown }).narrative) ?? prior.get(img.id))
      : undefined;
    return {
      ...img,
      role: v.role,
      basis: { method: "inspection" as const, by: who, at: when, saw: v.saw, page },
      ...(narrative ? { narrative } : {}),
    };
  });

  // A `vfig-` verdict belongs to the vector sidecar, which {@link applyToVector}
  // writes; it is not an orphan of this one.
  const orphaned = Object.keys(docVerdicts).filter((id) => !seen.has(id) && !isVectorFigureId(id));
  const out = { ...parsed, images: next };
  // Validated on the way OUT as well as in: the refinements are the point of
  // the exercise, and a writer that skips them can emit what a reader refuses.
  ImagesSidecarSchema.parse(out);
  return {
    text: JSON.stringify(out, null, 2) + "\n",
    result: { applied: seen.size, unjudged, orphaned },
  };
}

/**
 * Rewrite one VECTOR sidecar from the `vfig-` verdicts — bean `ay3x`.
 *
 * Same contract as {@link applyTo}: pure, validated in and out, and the
 * judgement arrives as an `inspection` basis naming who looked. `unjudged`
 * lists the renders with no verdict; the caller REPORTS them and does not
 * fail on them (see the header).
 */
export function applyToVector(
  sidecarText: string,
  docVerdicts: Record<string, Verdict>,
  by: unknown,
  at: string,
  priorText?: string,
): { text: string; result: Omit<ApplyResult, "docId"> } {
  const parsed = VectorFiguresSidecarSchema.parse(JSON.parse(sidecarText));
  const prior = heldNarratives(priorText, "figures");
  const figures = parsed.figures ?? [];
  const unjudged: string[] = [];
  const seen = new Set<string>();
  const next = figures.map((f) => {
    const v = docVerdicts[f.id];
    if (!v) {
      if (f.file !== null) unjudged.push(f.id);
      return f;
    }
    seen.add(f.id);
    const { shows: _shows, narrative: held, ...rest } = f;
    const who = AttributionSchema.parse(v.inspected_by ?? by);
    const when = v.inspected_at ?? at;
    return {
      ...rest,
      role: v.role,
      basis: { method: "inspection" as const, by: who, at: when, saw: v.saw, page: f.page },
      ...(v.shows && v.shows.length > 0 ? { shows: v.shows } : {}),
      ...(DESCRIBABLE_ROLES.includes(v.role)
        ? {
            narrative: draftsKeeping(v, who, when, withText(held) ?? prior.get(f.id)),
          }
        : {}),
    };
  });
  const orphaned = Object.keys(docVerdicts).filter((id) => isVectorFigureId(id) && !seen.has(id));
  const out = { ...parsed, figures: next };
  VectorFiguresSidecarSchema.parse(out);
  return {
    text: JSON.stringify(out, null, 2) + "\n",
    result: { applied: seen.size, unjudged, orphaned },
  };
}

/**
 * Apply the `vfig-` verdicts to the vector sidecar in `entryDir`, if any.
 * Returns the result, or undefined when the entry has no vector sidecar AND no
 * vector verdicts. A vector verdict with no sidecar to land in is orphaned.
 */
function applyVectorIn(
  entryDir: string,
  docVerdicts: Record<string, Verdict>,
  by: unknown,
  at: string,
  check: boolean,
  priorDir?: string,
): Omit<ApplyResult, "docId"> | undefined {
  const path = join(entryDir, VECTOR_FIGURES_FILE);
  const vectorIds = Object.keys(docVerdicts).filter(isVectorFigureId);
  if (!existsSync(path)) {
    return vectorIds.length ? { applied: 0, unjudged: [], orphaned: vectorIds } : undefined;
  }
  const prior = priorDir && existsSync(join(priorDir, VECTOR_FIGURES_FILE)) ? readFileSync(join(priorDir, VECTOR_FIGURES_FILE), "utf-8") : undefined;
  const { text, result } = applyToVector(readFileSync(path, "utf-8"), docVerdicts, by, at, prior);
  if (!check) writeFileSync(path, text, "utf-8");
  return result;
}

/** The value after `--flag`, or `undefined`. */
function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Apply one document's verdicts to its STAGED sidecar — bean `8suc`.
 *
 * Deliberately NOT a special case inside {@link run}: that one walks every
 * declared library and every document in each, and its "no verdicts anywhere"
 * and "unjudged image" rules are both wrong here (see the header). Two callers
 * with opposite error semantics sharing one body is how one of them ends up
 * with the other's exit code.
 *
 * The transformation itself is {@link applyTo}, unchanged and shared, so a
 * staged sidecar and a promoted one cannot be written differently.
 */
export function runStaging(entryDir: string, libDir: string, check: boolean): number {
  const docId = basename(entryDir);
  const sidecar = join(entryDir, "images.json");
  if (!existsSync(sidecar)) {
    // Not the absent-verdicts case: the sidecar is written by `pdf-images.py`
    // before this ever runs, so its absence means an arm did not run at all.
    console.error(`✗ ${docId}: no images.json at ${sidecar} — run scripts/pdf-images.py first`);
    return 1;
  }
  const vf = join(libDir, "image-verdicts.json");
  if (!existsSync(vf)) {
    console.log(`· no image-verdicts.json in ${libDir} yet — nothing to apply for ${docId}`);
    return 0;
  }
  const verdicts = JSON.parse(readFileSync(vf, "utf-8")) as VerdictFile;
  const docVerdicts = verdicts.verdicts[docId];
  if (!docVerdicts) {
    console.log(`· no verdicts for ${docId} yet — nothing to apply`);
    return 0;
  }
  const who = attributionFor(verdicts, docId);
  // The entry as it is filed now, when this is a re-ingest: its narratives in
  // other languages are carried onto the rebuilt sidecars.
  const filed = libraryEntryDir(libDir, docId) ?? join(libDir, docId);
  const priorImages = existsSync(join(filed, "images.json")) ? readFileSync(join(filed, "images.json"), "utf-8") : undefined;
  const { text, result } = applyTo(readFileSync(sidecar, "utf-8"), docVerdicts, who.by, who.at, priorImages);
  // Computed in check mode first so an orphan in EITHER sidecar refuses before
  // anything is written — a half-applied judgement is worse than none.
  const vector = applyVectorIn(entryDir, docVerdicts, who.by, who.at, true, filed);
  const orphans = [...result.orphaned, ...(vector?.orphaned ?? [])];
  if (orphans.length > 0) {
    console.error(`✗ ${docId}: ${orphans.length} verdict(s) name an image the sidecars do not have:`);
    for (const id of orphans) console.error(`      ${id}`);
    return 1;
  }
  if (!check) {
    writeFileSync(sidecar, text, "utf-8");
    applyVectorIn(entryDir, docVerdicts, who.by, who.at, false, filed);
  }
  if (vector) {
    console.log(
      `  ${vector.applied} vector verdict(s) applied` +
        (vector.unjudged.length ? `, ${vector.unjudged.length} render(s) awaiting inspection` : ""),
    );
  }
  const rest = result.unjudged.length
    ? `, ${result.unjudged.length} image(s) still unjudged`
    : "";
  console.log(`  ${result.applied} verdict(s) applied to ${relative(process.cwd(), sidecar)}${rest}`);
  // Unjudged is NOT an error here — `image-descriptions` is the gate, and it
  // reports them with the detail a promotion refusal needs.
  return 0;
}

function run(): number {
  const check = process.argv.includes("--check");
  const staging = flag("--staging");
  if (staging !== undefined) {
    const lib = flag("--library");
    if (lib === undefined) {
      console.error("✗ --staging requires --library: a staging directory does not say which");
      console.error("  library the document is being promoted into, and guessing one would read");
      console.error("  a judgement that belongs to a different corpus (bean `v1hw`).");
      return 1;
    }
    return runStaging(staging, lib, check);
  }
  // The verdict file sits BESIDE the documents, so with several libraries
  // there may be several — each judging its own. Every one is applied; a
  // missing one in a library that has no verdicts yet is not an error, but
  // finding NONE anywhere is, because then there is nothing to apply and
  // exiting 0 would report a completed pass over no work.
  const verdictFiles = LIBRARIES.map((d) => join(d, "image-verdicts.json")).filter((f) => existsSync(f));
  if (verdictFiles.length === 0) {
    console.error(
      `✗ no image-verdicts.json in any declared library (${LIBRARIES.join(", ")}) — nothing to apply`,
    );
    return 1;
  }
  // Every inspection-only role in the file must really need inspection; a
  // verdict assigning `figure` adds nothing geometry did not already say, and
  // silently accepting one would let this file overwrite a measurement.
  let bad = 0;
  // Accumulated across the verdict FILES rather than read back off one of them
  // afterwards: with several libraries there is no single `verdicts` left in
  // scope at the end, and picking the last one would report a count for one
  // library beside a total for all of them.
  let inspected = 0;
  const results: ApplyResult[] = [];
  const awaiting: string[] = [];
  for (const vf of verdictFiles) {
    const libDir = dirname(vf);
    const verdicts = JSON.parse(readFileSync(vf, "utf-8")) as VerdictFile;
    inspected += Object.values(verdicts.verdicts)
      .flatMap((d) => Object.values(d))
      .filter((v) => requiresInspection(v.role)).length;
    for (const [docId, docVerdicts] of Object.entries(verdicts.verdicts)) {
      // Resolved against the library the verdict file is IN, not searched
      // across all of them: a verdict belongs to its own library, and looking
      // elsewhere would let one library's judgement rewrite another's sidecar.
      // The entry wherever it is filed in that library (bean `6fez`).
      const entryDir = libraryEntryDir(libDir, docId) ?? join(libDir, docId);
      const path = join(entryDir, "images.json");
      if (!existsSync(path)) {
        console.error(`✗ ${docId}: no images.json — run scripts/pdf-images.py first`);
        bad++;
        continue;
      }
      const who = attributionFor(verdicts, docId);
      const { text, result } = applyTo(readFileSync(path, "utf-8"), docVerdicts, who.by, who.at);
      const vector = applyVectorIn(entryDir, docVerdicts, who.by, who.at, true);
      if (!check) writeFileSync(path, text, "utf-8");
      if (!check && !vector?.orphaned.length) applyVectorIn(entryDir, docVerdicts, who.by, who.at, false);
      results.push({ docId, ...result, applied: result.applied + (vector?.applied ?? 0), orphaned: [...result.orphaned, ...(vector?.orphaned ?? [])] });
      // Reported, not counted toward the failure — see "Vector figures are
      // judged HERE too" in the header.
      if (vector?.unjudged.length) awaiting.push(`${docId}: ${vector.unjudged.length}`);
    }
  }

  let unjudged = 0;
  let orphaned = 0;
  for (const r of results) {
    const roles = r.unjudged.length ? `  ${r.unjudged.length} unjudged` : "";
    const orph = r.orphaned.length ? `  ${r.orphaned.length} orphaned` : "";
    console.log(`  ${r.docId.padEnd(24)} ${String(r.applied).padStart(3)} applied${roles}${orph}`);
    for (const id of r.unjudged) console.log(`      unjudged: ${id}`);
    for (const id of r.orphaned) console.log(`      orphaned verdict: ${id} (no such image)`);
    unjudged += r.unjudged.length;
    orphaned += r.orphaned.length;
  }

  const total = results.reduce((n, r) => n + r.applied, 0);
  if (awaiting.length) console.log(`  · vector renders awaiting inspection — ${awaiting.join("; ")}`);
  console.log();
  console.log(`  ${total} verdict(s) applied, ${inspected} of them inspection-only roles`);
  if (unjudged || orphaned) {
    console.error(`✗ ${unjudged} image(s) with no verdict, ${orphaned} verdict(s) with no image`);
    return 1;
  }
  if (bad) return 1;
  console.log(check ? "✓ every image is judged and every verdict lands" : "✓ written");
  return 0;
}

if (import.meta.main) process.exit(run());
