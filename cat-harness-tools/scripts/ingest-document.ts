#!/usr/bin/env bun
/**
 * One entry point from `uploads/` to `library/<bib-slug>/`.
 *
 * It picks one of the rungs — `pdf-structure.py` (embedded outline),
 * `pdf-pages.py` (no outline, page granularity), `pdf-ocr.py` (no usable text
 * layer) and `pdf-tables.py` — by a stated rule, so two ingests of the same
 * document agree. Every rung keeps its own flags and behaviour; this only
 * probes the PDF, picks, and runs.
 *
 * ## The rule
 *
 *   toc_source: outline                       -> pdf-structure
 *   toc_source: none, source.text_source: embedded -> pdf-structure, which
 *       infers the contents and keeps them only if they pass its trust tests,
 *       else writes PAGE granularity
 *   a junk outline, text layer                         -> pdf-pages
 *   toc_source: none, source.text_source: ocr      -> pdf-ocr, then pdf-pages --from-ocr
 *
 * **An inferred chapter tree is never trusted unchecked**: `pdf-structure`'s
 * three tests decide between the inferred contents and PAGE granularity, and
 * say which in `toc_source` / `granularity`.
 *
 * ## Third state
 *
 * `--dry-run` reports the chosen rung and the evidence for it, writing nothing.
 * A PDF this cannot probe is reported as `undetermined` and NOT ingested.
 *
 * Usage:
 *   bun run cat ingest uploads/FILE.pdf
 *   bun run cat ingest uploads/FILE.pdf --dry-run
 *   bun run cat ingest uploads/FILE.pdf --refresh-meta   # technical facts only
 *   bun run cat ingest uploads/FILE.pdf --refresh-title  # re-resolve the title
 *   bun run cat ingest uploads/FILE.pdf --library <instance>
 *   bun run cat ingest uploads/FILE.pdf --title "WHO Editorial Style Manual"
 *   bun run cat ingest uploads/FILE.pdf --lang-hint fr,en   # OCR languages (default: dc.language.iso)
 *   bun run cat ingest uploads/FILE.pdf --promote --qa-later  # image narratives written afterwards
 *   bun run cat ingest uploads/FILE.md --text   # Markdown/MDX/XML: text has no magic bytes, so the caller says so
 *   bun run cat ingest ../qou/uploads/FILE.pdf --instance ../qou   # a content folio's library
 *
 * `--title` passes a KNOWN title through to the PDF rungs. Absent it, the
 * catalogue's Dublin Core `dc.title` is passed when the layer has a
 * catalogue node for this entry, so a scan does not carry its OCR's misreading
 * as `doc_title`.
 *
 * `--library` is REQUIRED (not defaulted) when the repository declares more
 * than one library: a document filed into the wrong corpus reads as ingested.
 *
 * Exit: 0 ingested (or dry-run reported), 1 ingestion failed, 2 could not probe.
 *
 * @module scripts/ingest-document
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ARCHIVE_MIMETYPES } from "../schemas/library/archive-contents.ts";
import { QA_ONLY, checkEntry, type Requirement } from "./check-l1-complete.ts";
import { catalogueRecordFor, dcValue } from "../pipeline/library-title.ts";
import { TABULAR_MIMETYPES } from "../schemas/library/tabular-records.ts";
import { SLIDE_MIMETYPES } from "../schemas/ui/pdf-structure.ts";
import { refreshLibraryIndex } from "./lsi.ts";
import { IntakeSchema } from "../schemas/library/intake.ts";
import { LICENCE_FILENAME, buildEntryNodes, readLicence } from "../pipeline/gen-library-jsonld.ts";
import { STRUCTURE_FILENAME } from "../schemas/content/document-structure.ts";
import { corpusDirectoriesForGraph } from "../schemas/kg/harness-config.js";
import { readDeclaration } from "../schemas/kg/cat-harness.ts";
import { resolveWorkingInstanceRoot } from "./lib/roots.ts";
import { COVER_FILENAME } from "./library-graph.ts";
import { runEntryArms } from "./entry-extraction.ts";
import { optionalPipelinePlugin } from "../pipeline/pipeline-plugins.ts";

/**
 * This module's own layer root — where its `harness.json` is.
 *
 * `libraryRoot` defaulted to `resolve(".")`, the CWD, which read as "the
 * instance you are standing in" and was right while the layer and the
 * repository were one directory. After the move (bean `wggr`) the CWD is the
 * REPOSITORY root, which declares nothing, so `directoriesForGraph` returned
 * undefined and the ingest refused — correctly, by its own rule, for the wrong
 * reason: "this instance declares no `library` graph" was a true sentence
 * about a directory that is not this layer.
 *
 * Derived from the module's location rather than from the caller's, because
 * this script BELONGS to this layer. A caller who means a different one
 * passes `root`, which is what the parameter is for.
 *
 * ## `--instance <dir>`: ingest into a CONTENT layer's library
 *
 * Without it this is the layer being worked on — cat-harness, unless a
 * separated layer's repository MOUNTS the harness, when it is that layer
 * (`resolveWorkingInstanceRoot`, bean `j3ls`: from a separated content layer the staging tree
 * landed inside the mounted harness). With it, the
 * staging tree and the destination library are resolved against `<dir>`, which
 * must hold a layer declaration (`<name>.json`). This is the case of a
 * content folio such as `litlfred/qou`, checked out beside the harness: before
 * the flag the only route was to re-implement this module's steps against the
 * folio's paths (qou's `scripts/library-ingest.ts` did exactly that, importing
 * `planFor` / `withDerivedArms` / `checkEntry` / `buildEntryNodes`), which is
 * the second implementation of "how a document is ingested" this module exists
 * to prevent. `--harness` cannot serve: it accepts only a directory whose
 * declaration names `cat-harness`.
 *
 * Refused, never guessed, when `<dir>` declares nothing: filing into a
 * directory no declaration names is filing where nothing scans it.
 */
const INSTANCE_ROOT = resolveInstanceRoot(process.argv);

/** `--instance <dir>` or `--instance=<dir>`, else the working layer. Exported for tests. */
export function resolveInstanceRoot(
  argv: readonly string[],
  fallback: string = resolveWorkingInstanceRoot({ argv: [] }).root,
): string {
  let chosen: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--instance" && i + 1 < argv.length) chosen = argv[++i];
    else if (a.startsWith("--instance=")) chosen = a.slice("--instance=".length);
  }
  if (chosen === undefined || chosen === "") return resolve(fallback);
  const root = resolve(chosen);
  if (readDeclaration(root) === undefined) {
    throw new Error(
      `--instance names ${root}, which holds no instance declaration (<name>.json) — ` +
        "ingesting there would file the document where nothing scans it",
    );
  }
  return root;
}

/**
 * A python helper beside this module, as an ABSOLUTE path.
 *
 * Three call sites spelled `'scripts/<name>.py'` relative to the CWD inside a
 * python source string, which is the least visible place a path can hide: not
 * TypeScript, not YAML, not a config file, and unreachable by every scan here.
 * Each failed SILENTLY — the import raised, python exited non-zero, and the
 * caller's `exitCode !== 0` guard turned that into `null` or `undetermined`,
 * which reads as "this file could not be identified" rather than "the helper
 * is missing".
 *
 * One function so the next relocation is one line, and so that a reader
 * grepping for `.py` finds the resolution rather than three copies of it.
 *
 * **It did not reach the RUNG TABLE, and that is how this recurred.** Seven
 * more call sites spelled `"scripts/<name>.py"` inside the `steps` arrays
 * below — every rung that actually ingests a document — so the helper existed,
 * the comment above said the problem was solved, and `bun run cat ingest` could
 * not ingest anything. Fixed 2026-09-20, when ingesting the agent-skill
 * corpus hit it on the first real document.
 *
 * These seven failed LOUDLY (`can't open file`, exit 2, "stopping"), unlike
 * the three above, so nothing was mis-filed. That is luck, not design: the
 * `steps` runner checks the exit code, and the helpers it invokes are the ones
 * whose absence the three silent call sites were taught to report honestly.
 */
function pyHelper(name: string): string {
  return join(dirname(fileURLToPath(import.meta.url)), name);
}

/**
 * The same resolution for a TypeScript arm, under a name that does not lie.
 *
 * `pyHelper` is a path join and would work here verbatim — but a call reading
 * `pyHelper("l1-blocks.ts")` tells the next reader this file shells out to
 * Python for something it does not, and a helper named for the wrong language
 * is the kind of small untruth that survives because it never fails.
 */
function tsHelper(name: string): string {
  return pyHelper(name);
}

/**
 * Where L1 source content lives, READ from `harness.json` rather than written
 * out. Each rung takes it as `-o`, so the literal would otherwise appear four
 * times in this file alone -- and `check:declared-paths` caught exactly that
 * in the first draft, as it did for the bean store an hour earlier.
 */
export function libraryRoot(root = INSTANCE_ROOT, choice?: string): string {
  // A WRITE target, and the one place picking the first was never defensible:
  // with several declared libraries the first is not an answer to "where does
  // this document go", it is a coin toss that files it somewhere plausible.
  //
  // THREE states, and the middle one arrived with bean `frs5`, which moved the
  // corpus into the IRIS replica's and the formal-math layer's directories:
  //
  //   none declared   -> throw: ingesting into a guessed directory files the
  //                     document where nothing scans it
  //   exactly one     -> that one, and `--library` is not needed
  //   several         -> the CALLER must say, by name. Not a default, not the
  //                     first: a WHO publication landing in the science
  //                     library reads as ingested and is in the wrong corpus,
  //                     and nothing downstream can tell.
  const declared = corpusDirectoriesForGraph(root, "library");
  if (declared.length === 0) {
    throw new Error(
      "this instance declares no `library` graph in its `<name>.json` — " +
        "ingesting into a guessed directory would file the document where nothing scans it",
    );
  }

  const named = (abs: string): string => relative(root, abs) || abs;

  if (declared.length === 1) return named(declared[0]!);

  if (choice === undefined) {
    throw new Error(
      `this repository declares ${declared.length} libraries, so the destination must be said ` +
        `rather than guessed. Pass --library <name>, one of: ` +
        declared.map((d) => named(d)).join(", "),
    );
  }

  // Matched EXACTLY, on either spelling a caller would reasonably use: the
  // relative path the declaration resolves to (`../<instance>/library`) or the
  // layer directory holding it (`<instance>`). Both work and neither is a
  // second vocabulary to learn.
  //
  // IT WAS A SUBSTRING MATCH, and that is a guess wearing the clothes of a
  // match. Measured 2026-09-20: `--library c` matched exactly one declared
  // library — the formal-math layer's was the only one whose path contained a `c`
  // — so a one-character typo filed a document into the science corpus and
  // printed success. In the one function whose stated job is refusing to
  // guess a write target, and directly under a comment saying ambiguity
  // refuses "the whole point of this function": the ambiguity check was real
  // and what fed it was not.
  //
  // A loose match cannot be rescued by the ambiguity guard, because the
  // failure is a UNIQUE wrong hit. Exactness is the only form where "matches
  // one" means what it reads as.
  const instanceOf = (d: string): string => {
    const rel = named(d);
    const parts = rel.split("/").filter((p) => p.length > 0 && p !== "..");
    // `../<instance>/library` -> `<instance>`; a bare `library` is this layer's.
    return parts.length > 1 ? parts[parts.length - 2]! : ".";
  };
  const hits = declared.filter((d) => named(d) === choice || instanceOf(d) === choice);
  if (hits.length === 1) return named(hits[0]!);
  throw new Error(
    hits.length === 0
      ? `--library ${choice} matches none of: ${declared.map((d) => named(d)).join(", ")}`
      : `--library ${choice} is ambiguous between: ${hits.map((d) => named(d)).join(", ")}`,
  );
}

/** `--library <name>` from argv, or undefined. */
export function libraryChoice(argv: string[]): string | undefined {
  const i = argv.indexOf("--library");
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Which rung a document needs, and the evidence that chose it. */
export interface Plan {
  rung: "archive" | "tabular" | "notebook" | "slides" | "referenced" | "text" | "pdf-structure" | "pdf-pages" | "pdf-ocr+pdf-pages" | "pdf-ocr+pdf-structure" | "undetermined";
  why: string;
  /** Commands to run, in order, each as argv. */
  steps: string[][];
}

/**
 * The EARLY licence verdict — bean `7bg9`, owner's ruling 2026-09-20: before
 * any derivation, because `library/` is `holds: content` and anything derived
 * first is committed, so refusing it afterwards is a deletion nobody may take
 * unasked.
 *
 * It sees only the upload itself, as the ruling requires: the `licence`
 * record in the `intake.json` beside it (`schemas/library/source-licence.ts`, the same
 * record a library manifest carries) and whether a LICENSE file sits beside
 * it. It never reads a licence out of extracted text — that is a later check's
 * to find — so with nothing recorded the verdict is `undetermined`, and
 * undetermined is REPORTED, never rendered as cleared. It does not stop the
 * pipeline: the ruling lets undetermined proceed, and a refusal needs a
 * compatibility rule this step does not have.
 */
export interface EarlyLicence {
  verdict: "stated" | "unknown" | "undetermined";
  detail: string;
}
export function earlyLicence(upload: string): EarlyLicence {
  const dir = dirname(resolve(upload));
  const intakePath = join(dir, "intake.json");
  if (existsSync(intakePath)) {
    const parsed = IntakeSchema.safeParse(JSON.parse(readFileSync(intakePath, "utf-8")));
    // A malformed intake is not "no licence": say it could not be read.
    if (!parsed.success) return { verdict: "undetermined", detail: `intake.json does not validate — ${parsed.error.issues[0]?.message ?? "invalid"}` };
    const l = parsed.data.licence;
    if (l?.status === "stated") return { verdict: "stated", detail: `${l.id} (${l.basis})` };
    if (l?.status === "unknown") return { verdict: "unknown", detail: `searched ${l.searched!.length} place(s), none stated one` };
  }
  const sibling = ["LICENSE", "LICENCE", "LICENSE.md", "LICENCE.md", "LICENSE.txt", "LICENCE.txt"].find((f) => existsSync(join(dir, f)));
  if (sibling) return { verdict: "undetermined", detail: `a ${sibling} sits beside the upload — a person reads it and records the licence in intake.json` };
  return { verdict: "undetermined", detail: "nothing recorded: no intake.json licence and no LICENSE beside the upload" };
}

/**
 * Carry the upload's licence into the staged entry (bean `7bg9`, the step
 * after the early verdict). The early step READ the licence from the upload;
 * this writes it as the entry's `licence.json` — the AUTHORED sidecar
 * `gen-library-jsonld` carries into `manifest.jsonld` (`licenceRecord`, and `dcterms:license` when stated)
 * (folio-assistant#1530), which is what `check:source-licence` reads. Not into
 * the manifest itself: the manifest is generated, and a record written there
 * is erased by the next `gen:jsonld`.
 *
 * Never overwrites. A `licence.json` already beside the entry is a finding
 * somebody made (issue #1023); if it disagrees with the intake the two are
 * REPORTED as a conflict and the sidecar is left as it is — which one is right
 * is a person's call, not this step's.
 */
export type LicenceCarry =
  | { outcome: "carried"; status: string }
  | { outcome: "kept"; detail: string }
  | { outcome: "conflict"; detail: string }
  | { outcome: "nothing"; detail: string };
export function carryIntakeLicence(upload: string, stagedEntry: string): LicenceCarry {
  const intakePath = join(dirname(resolve(upload)), "intake.json");
  if (!existsSync(intakePath)) return { outcome: "nothing", detail: "no intake.json beside the upload" };
  const parsed = IntakeSchema.safeParse(JSON.parse(readFileSync(intakePath, "utf-8")));
  if (!parsed.success || parsed.data.licence === undefined)
    return { outcome: "nothing", detail: parsed.success ? "intake.json records no licence" : "intake.json does not validate" };
  const from = parsed.data.licence;
  if (!existsSync(stagedEntry)) return { outcome: "nothing", detail: "no staged entry to carry it into" };
  const existing = readLicence(stagedEntry);
  if (existing !== undefined) {
    return JSON.stringify(existing) === JSON.stringify(from)
      ? { outcome: "kept", detail: `${LICENCE_FILENAME} already carries the same licence` }
      : { outcome: "conflict", detail: `${LICENCE_FILENAME} says ${JSON.stringify(existing)}, intake says ${JSON.stringify(from)} — left as ${LICENCE_FILENAME} has it` };
  }
  writeFileSync(join(stagedEntry, LICENCE_FILENAME), `${JSON.stringify(from, null, 2)}\n`);
  return { outcome: "carried", status: from.status };
}

/**
 * The rung produces `structure.json` and `sections/`. THESE produce the rest.
 *
 * ## Why this is here rather than in a printed instruction
 *
 * `ingest` staged a document and then told the agent to *"run the remaining
 * arms"*. `l1-blocks`' own header records what that cost: *"a pipeline that
 * cannot terminate, and it was invisible because both ends looked healthy"* —
 * staging exits 0 and says `✓ staged`, while `mayPromote` requires every
 * requirement met, so nothing could ever cross into `library/`.
 *
 * **AND THE INSTRUCTION COULD NOT BE MADE CORRECT.** The two arms take
 * OPPOSITE `-o` conventions, measured 2026-09-23 by running both:
 *
 * | arm | `-o` wants | given the other |
 * |---|---|---|
 * | `pdf-images.py` | the library ROOT — *"the sidecar lands in `<out>/<doc-id>/`"* | writes `<slug>/<slug>/images.json`, and the entry's own stays absent |
 * | `l1-blocks.ts` | the ENTRY directory | throws *"no structure.json — this is not a staged entry"* |
 *
 * So no single value of `-o` is right for both, and the one sentence #1035
 * corrected became right for `pdf-images` and wrong for `l1-blocks` in the
 * same stroke. A sequence in code has no such sentence to get wrong: each arm
 * is handed the directory it actually wants, once, here.
 *
 * ## PDF rungs only, and that is stated rather than assumed
 *
 * `archive` and `tabular` produce a different shape — `check-l1-complete`'s
 * `PAGED_ONLY` list exists because not every requirement applies to every
 * kind — and neither was measured here. Adding them on the assumption that
 * "more arms cannot hurt" is how a gate starts reporting a requirement over
 * content it was never about. They keep the behaviour they had.
 */
export function withDerivedArms(
  plan: Plan,
  pdf: string,
  stagingRoot: string,
  staging: string,
  library: string,
): Plan {
  // A notebook gets the ONE arm that reads what a rung wrote rather than the
  // source: `l1-blocks.ts` builds blocks from `sections/`. The image arms read
  // a PDF and do not apply; the notebook rung writes its own `images.json`.
  if (plan.rung === "notebook" || plan.rung === "text") {
    return { ...plan, steps: [...plan.steps, ["bun", "run", tsHelper("l1-blocks.ts"), "-o", staging], aspectsArm(staging)] };
  }
  const PDF_RUNGS = ["pdf-structure", "pdf-pages", "pdf-ocr+pdf-pages", "pdf-ocr+pdf-structure"];
  // A deck writes the same `structure.json` + `sections/` a paged PDF does, and
  // its own `images.json` (the images are package members, so there is no
  // raster layer to recover and no vector labels to read). So it takes the two
  // arms that read what the rung wrote, and not the two that read a PDF.
  // Measured on the #1614 deck, not assumed: bean `scfh`.
  // A RECORDED source holds no text, so there is nothing for the paged arms to
  // read; its only derived artefact is the manifest (bean `scfh`).
  if (plan.rung === "referenced") {
    return {
      ...plan,
      steps: [...plan.steps, ["bun", "run", tsHelper("../pipeline/gen-library-jsonld.ts"), "--entry", staging]],
    };
  }
  if (plan.rung === "slides") {
    return {
      ...plan,
      steps: [
        ...plan.steps,
        ["bun", "run", tsHelper("l1-blocks.ts"), "-o", staging],
        aspectsArm(staging),
        ["bun", "run", tsHelper("apply-image-verdicts.ts"), "--staging", staging, "--library", library],
      ],
    };
  }
  if (!PDF_RUNGS.includes(plan.rung)) return plan;
  return {
    ...plan,
    steps: [
      ...plan.steps,
      // The author's LaTeX over the text layer, where the two provably say the
      // same thing — `latex-math-overlay.py`'s three gates. Straight after the
      // rung, because it rewrites the `sections/` the rung wrote and every arm
      // below that reads them should read the overlaid text. It takes the
      // ENTRY, and the library so that a re-ingest finds the `source/`
      // `arxiv-source.py` fetched into the promoted entry (staging is fresh,
      // and promotion's `cpSync` merges rather than replaces, so the source
      // survives). No source, or page granularity, is a reported skip and
      // exits 0: most uploads are not arXiv papers.
      ["python3", pyHelper("latex-math-overlay.py"), staging, "--library", library],
      // `pdf-images.py` reads the PDF, so it takes the SOURCE and the library
      // ROOT. `pdf` is passed in rather than read back off `plan.steps[0]`:
      // the rung's last argument happens to be the PDF today, and a sequencer
      // that depends on that breaks silently the first time a rung grows a
      // trailing flag.
      ["python3", pyHelper("pdf-images.py"), "-o", stagingRoot, pdf],
      // The OTHER layer of the same pages — bean `a8wy`, under `m4xy`. Same
      // conventions as the arm above, and for the same reason: it reads the
      // PDF, so it takes the source and the library ROOT.
      //
      // It is an ARM rather than something an agent runs when a document looks
      // like it needs it, because the case it exists for is invisible without
      // it: `9789240120747-eng` declares six captioned figures, places zero
      // images, and `image-descriptions` reported "0 image(s), 0 describable
      // and all described" over it. Nothing in that line asks anybody to look.
      //
      // Order against `apply-image-verdicts.ts` does not matter — the two
      // write different files — but it sits beside `pdf-images.py` because
      // the two answer the same question about the same page.
      ["python3", pyHelper("pdf-vector-labels.py"), "-o", stagingRoot, pdf],
      // The step ABOVE the labels — bean `ay3x`, owner ruling 2026-10-03:
      // group the page's drawings, relate the labels to them, and render the
      // region so somebody can look. It assigns no role; a verdict does. Like
      // `pdf-images.py` it opens its sidecar with `"w"`, so it must run BEFORE
      // `apply-image-verdicts.ts`, which lays the committed `vfig-` judgements
      // back over it — the same ordering reason given for the fourth arm below.
      ["python3", pyHelper("pdf-vector-figures.py"), "-o", stagingRoot, pdf],
      // `l1-blocks.ts` reads what the rung already wrote, so it takes the
      // ENTRY directory and no source at all. See the table above.
      ["bun", "run", tsHelper("l1-blocks.ts"), "-o", staging],
      // Footnotes and the marks that call them (owner, 2026-11-11, "also foot
      // notes/marks"). After `l1-blocks.ts`, because each note names the block
      // that holds its page; it reads the PDF's layout, never changes a block,
      // and writes `footnotes.json` (`schemas/content/document-footnotes.ts`).
      ["python3", pyHelper("pdf-footnotes.py"), staging, pdf],
      // TABLES — `pdf-tables.py`, named as a rung in this file's header and
      // never run until 2026-11-14 (owner: "not sure all have biblio,
      // glossary, table, figure ... fully extracted"). It writes the CSVW
      // drafts a paged entry's tables live in, keeps a transcription the
      // destination already holds, and is GUARDED: any failure is recorded as
      // `not-extracted` in `extraction.json` and the arm exits 0.
      ["bun", "run", tsHelper("pdf-tables-csvw.ts"), "--staging", staging, "--library", library, pdf],
      aspectsArm(staging),
      // ── The fourth arm, and it must come AFTER `pdf-images.py` — bean `8suc`
      //
      // `pdf-images.py` opens the sidecar with `"w"`: no existence check, no
      // merge. So it overwrites any narrative already applied, and ordering
      // this arm last is not a tidiness choice — put it earlier and every
      // re-run silently wipes the judgements it just wrote.
      //
      // That same overwrite is why this is an ARM rather than a step an agent
      // runs by hand between invocations. Applying verdicts manually works
      // exactly once; the next `ingest` erases them, and erases them quietly,
      // because the sidecar is still valid and still parses. Running it here
      // makes a re-run RE-APPLY instead — the file is rebuilt from the PDF and
      // then the committed judgement is laid back over it.
      //
      // It takes the destination library because the verdicts live there and
      // a staging directory does not say which library that is (`v1hw`). An
      // absent verdicts file exits 0: the first ingest necessarily runs before
      // anybody has looked at the images, and `image-descriptions` is the gate
      // that refuses the promotion, not this.
      ["bun", "run", tsHelper("apply-image-verdicts.ts"), "--staging", staging, "--library", library],
      // THE COVER — owner, 2026-10-16: a card's picture was the first figure,
      // and for one paper that was a black game screenshot from page 11. Page
      // 1, rendered by `pdf-cover.py`, is the determined answer (its header
      // says why), and `avatarOf` takes `cover.png` before any figure. Last,
      // because nothing here reads it.
      ["python3", pyHelper("pdf-cover.py"), pdf, "-o", join(staging, COVER_FILENAME), "--width", "300"],
      // THE EXTRACTION RECORD — last, because it reads what every arm above
      // wrote: per kind (contents, sections, figures, tables, …) found N,
      // partial, none or not extracted, so a viewer can tell
      // "this document has none" from "nothing looked"
      // (`schemas/library/entry-extraction.ts`).
      extractionArm(staging, library, plan),
    ],
  };
}

/**
 * The extraction-record arm. It names the rung that wrote `structure.json`
 * (the script of the plan's last rung step that writes one), so the contents
 * and captions it records say which tool found them.
 */
export function extractionArm(staging: string, library: string, plan: Plan): string[] {
  const rung = [...plan.steps].reverse().find((s) => /(?:pdf-structure|pdf-pages)\.py$/.test(s[1] ?? ""));
  return [
    "bun",
    "run",
    tsHelper("entry-extraction.ts"),
    "--staging",
    staging,
    "--library",
    library,
    ...(rung?.[1] ? ["--structure-tool", rung[1]] : []),
  ];
}

/**
 * The Stage B ASPECTS over what the rung wrote — requirements and normative
 * statements first (owner, 2026-11-01: requirement extraction "should be a
 * general part of L1 ingestion for DAK and DTH").
 *
 * An aspect is gated by MOUNTING, not here: the DAK layer's requirement
 * aspect runs where that layer is mounted and nowhere else, and with no
 * aspect mounted the arm writes nothing and exits 0. It merges into the
 * entry's `candidates.json`, which `--promote`'s `buildEntryNodes` turns into
 * one typed node per item, `derivedFrom` its L1 section. It takes the ENTRY,
 * as `l1-blocks.ts` does, because it reads `sections/`.
 */
export function aspectsArm(staging: string): string[] {
  return ["python3", pyHelper("extract-candidates.py"), "--aspects-only", staging];
}

/**
 * The slug a document lands under — asked of `scripts/_pdf_doc_id.py`, never
 * recomputed here.
 *
 * That module is the ONE definition, and bean `rlp5` is why: three routes to
 * `slugify` existed before it, one of them a 26-line loader that read the
 * function out of another file by path because a copy would drift. A fourth
 * spelling in TypeScript would be exactly that drift, and my first draft of
 * this file was one — it turned `WPR-RDO-2020-003-eng` into
 * `wpr-rdo-2020003-eng`, which is not the slug that document already has.
 */
export function bibSlug(file: string): string {
  const py =
    "import sys, importlib.util as u\n" +
    `spec = u.spec_from_file_location('d', ${JSON.stringify(pyHelper("_pdf_doc_id.py"))})\n` +
    "m = u.module_from_spec(spec); spec.loader.exec_module(m)\n" +
    // `derive_doc_id_from_pdf`, NOT `derive_doc_id`. The latter takes the
    // extracted front matter as an argument and this call site has none, so it
    // fell through to the basename slug for every arXiv paper while
    // `pdf-structure.py` — which DOES have the front matter — named the same
    // file `arxiv-<id>v<n>`. The two then disagreed about which directory the
    // document was in, and `--promote` reported the entry incomplete rather
    // than missing.
    "print(m.derive_doc_id_from_pdf(sys.argv[1]))\n";
  // input-site: spawned #ae0c4e79 — python3 on a document this tool was handed; the cone audits the child from its read set
  const r = Bun.spawnSync(["python3", "-c", py, file]);
  // The answer is the LAST line: MuPDF writes its own warnings to stdout
  // ("MuPDF error: format error: cmsOpenProfileFromMem failed", a broken
  // colour profile in 10665/67211 and 67212), and the whole stream once became
  // the slug, so the entry was staged under a directory named after the error.
  const out = new TextDecoder().decode(r.stdout).trim().split("\n").at(-1)?.trim() ?? "";
  if (r.exitCode !== 0 || !out) {
    throw new Error(
      `cannot determine the doc id for ${file}: scripts/_pdf_doc_id.py did not answer. ` +
        `Guessing one would file the document under a slug nothing else uses.`,
    );
  }
  return out;
}

/** What the PDF itself says: does it carry an outline, and readable text? */
export interface Probe {
  /** Raw entry count. Kept because "there is an outline, and it is junk" is
   *  a different fact from "there is no outline", and the reader needs both. */
  outline: number | null;
  /**
   * Entries that could actually carry a chapter tree. `undefined` on a probe
   * from before this field existed, which callers read as "unknown", never 0.
   *
   * Bean `8shg`. A raw count routes on the wrong question. `milnorlink.pdf`
   * carries 35 entries and NONE of them is a heading: 19 are bare page labels
   * (`p. 177`, `p. 178`, …) and 16 have no resolvable destination, because
   * the outline is JSTOR's journal wrapper — this article's pages, then
   * thirteen OTHER articles from the same issue that are not in the file.
   * Routing on `> 0` sent it to `pdf-structure`, which would have produced a
   * section tree of page numbers plus thirteen phantom chapters.
   */
  outlineUsable?: number | null;
  chars: number | null;
  /** Alphabetic characters and non-space characters over the same pages, for {@link textLayerUnreadable}. */
  letters?: number;
  nonspace?: number;
  /** Arabic-script words, and how many carry a reversed lam-alef or lam-yeh ligature. */
  arabicWords?: number;
  arabicLigatureReversed?: number;
  /** Letters by script (latin, arabic, cyrillic, han), for the wrong-script check in {@link textLayerUnreadable}. */
  scriptLetters?: Partial<Record<Script, number>>;
  /**
   * Every page whose text layer fails `scripts/_text_quality.py` (1-based page,
   * reason), over the WHOLE document, and the page count. See {@link pagesToOcr}.
   */
  pagesFailing?: [number, string][];
  pagesTotal?: number;
  error?: string;
}

/** Below this share of letters among non-space characters, a text layer is mojibake (pdf-ocr.py's MIN_ALPHA_RATIO). */
export const MIN_LETTER_RATIO = 0.55;
/** Above this share of Arabic words with a reversed ligature, the text layer is not trusted. */
export const MAX_ARABIC_LIGATURE_REVERSED = 0.02;
/** Below this share of letters in the script the document's languages are written in, the text layer is in the wrong script. */
export const MIN_EXPECTED_SCRIPT_RATIO = 0.2;

export type Script = "latin" | "arabic" | "cyrillic" | "han";
/** The script each non-Latin language is written in. A language absent here is not checked. */
const LANGUAGE_SCRIPT: Record<string, Script> = {
  ar: "arabic", fa: "arabic", ur: "arabic", ps: "arabic",
  ru: "cyrillic", uk: "cyrillic", bg: "cyrillic", sr: "cyrillic", kk: "cyrillic", mn: "cyrillic",
  zh: "han", ja: "han",
};

/**
 * Why a text layer with plenty of characters is still not text, or `undefined`. Pure.
 *
 * Owner, 2026-11-10: "rules may assume LTR languages". Two failures, both
 * measured on the IRIS pilot, routed a document to `pdf-structure` because
 * the character count alone looked healthy:
 *
 * - **Mojibake.** The Arabic edition of resolution WHA71.7 (10665/279510)
 *   uses a font with no Unicode mapping: thousands of characters, almost none
 *   of them letters. Its sections came out as control characters.
 * - **Reversed Arabic ligatures.** The Arabic Global strategy on digital
 *   health (10665/344249) maps its lam-alef ligature to alef-lam, so
 *   "الاستراتيجيات" reads "االستراتيجيات" and "على" reads "عىل": about 7.5% of
 *   its Arabic words. A word cannot begin with two alefs before a lam, nor end
 *   alef-maksura then lam, so these two shapes are counted. The ordinary
 *   definite article "ال" is not, since it is indistinguishable from a
 *   reversed ligature in the middle of a word; the count is a lower bound.
 *
 * Either sends the document to the OCR rung, which reads the page image in
 * the hinted language.
 */
export function textLayerUnreadable(p: Probe, langs: readonly string[] = []): string | undefined {
  if (p.nonspace && p.letters !== undefined && p.nonspace >= OCR_THRESHOLD_CHARS && p.letters / p.nonspace < MIN_LETTER_RATIO) {
    return `${p.letters} letters in ${p.nonspace} non-space characters (< ${MIN_LETTER_RATIO}): the text layer is mojibake, a font with no Unicode mapping`;
  }
  if (p.arabicWords && p.arabicWords >= 50 && (p.arabicLigatureReversed ?? 0) / p.arabicWords > MAX_ARABIC_LIGATURE_REVERSED) {
    return `${p.arabicLigatureReversed} of ${p.arabicWords} Arabic words carry a reversed lam-alef or lam-yeh ligature (> ${MAX_ARABIC_LIGATURE_REVERSED * 100}%): the text layer scrambles right-to-left ligatures`;
  }
  // Wrong script. The Arabic edition of "Preparing for the introduction of HPV
  // vaccines" (10665/69384) maps its Arabic glyphs onto Latin-1 code points:
  // plenty of letters, so neither check above fires, but they read
  // "¤EG 14 øe IóàªŸG". Checked only when every language the document is
  // known to be in is written in one non-Latin script.
  const scripts = [...new Set(langs.map((l) => LANGUAGE_SCRIPT[l.toLowerCase().split(/[-_]/)[0] ?? ""]))];
  const want = scripts.length === 1 ? scripts[0] : undefined;
  if (want && p.scriptLetters && p.letters && p.letters >= OCR_THRESHOLD_CHARS) {
    const got = p.scriptLetters[want] ?? 0;
    if (got / p.letters < MIN_EXPECTED_SCRIPT_RATIO) {
      return `${got} of ${p.letters} letters are ${want} (< ${MIN_EXPECTED_SCRIPT_RATIO * 100}%), but the document is in ${langs.join(", ")}: the text layer maps its glyphs to the wrong script`;
    }
  }
  return undefined;
}

/**
 * Is an outline entry capable of being a chapter?
 *
 * Two disqualifiers, both measured on the corpus rather than imagined:
 * no resolvable destination (PyMuPDF reports page `-1`), and a title that is
 * only a page reference. Neither names a division of the document.
 */
export function usableOutlineEntries(
  entries: readonly { title: string; page: number }[],
): number {
  return entries.filter(
    (e) => e.page >= 1 && !/^pp?\.?\s*\d+$/i.test(e.title.trim()),
  ).length;
}

/**
 * Ask the PDF directly. Returns nulls rather than guesses when the backend is
 * unavailable -- "could not probe" is a third state, not "no outline".
 */
/**
 * A vector arm that ANSWERED "undetermined" rather than failed — bean `turh`.
 *
 * `pdf-vector-labels.py` and `pdf-vector-figures.py` exit 2 when they cannot
 * say anything about the pages (a scan has no text layer to read a caption
 * from), and they WRITE their sidecar saying so first. That is an answer the
 * library should keep, and the OCR rung always produces it: before this, every
 * scanned document stopped at the labels arm, so a scan could not be
 * re-ingested at all.
 *
 * Exit 2 is ALSO what Python gives for a helper it cannot open (the seven loud
 * failures noted above), so the code alone proves nothing. The sidecar does:
 * it counts as an answer only when this step wrote it, after the step began.
 * Returns the sidecar's path, or `undefined` for a real failure.
 */
export function recordedUndetermined(step: readonly string[], exitCode: number, startedMs: number): string | undefined {
  if (exitCode !== 2) return undefined;
  const sidecar = VECTOR_ARM_SIDECARS[basename(step[1] ?? "")];
  const o = step.indexOf("-o");
  if (sidecar === undefined || o < 0 || step[o + 1] === undefined) return undefined;
  const root = step[o + 1]!;
  if (!existsSync(root)) return undefined;
  for (const doc of readdirSync(root)) {
    const f = join(root, doc, sidecar);
    if (existsSync(f) && statSync(f).mtimeMs >= startedMs - 1000) return f;
  }
  return undefined;
}

/**
 * The tabular-csvw step answered "not a table I take" — bean `urat`.
 *
 * `tabular-csvw.ts` exits 2 only when the slot's reader returns `null`: it
 * wrote nothing, and said so. Its other failures (usage, a slot nothing
 * fills, an extractor that throws) exit 1. So exit 2 from THIS step is an
 * answer, as the vector arms' sidecar is, and the ingest goes on to stage
 * the entry, whose tabular requirement then reads unmet.
 */
export function tableNotTaken(step: readonly string[], exitCode: number): boolean {
  return exitCode === 2 && basename(step[2] ?? "") === "tabular-csvw.ts";
}

/** The vector arms whose exit 2 may be an answer, and the sidecar each writes. */
const VECTOR_ARM_SIDECARS: Record<string, string> = {
  "pdf-vector-labels.py": "vector-labels.json",
  "pdf-vector-figures.py": "vector-figures.json",
};

export function probe(pdf: string, langs: readonly string[] = []): Probe {
  // `pymupdf`, NOT `fitz`. The legacy alias still imports, and that is the
  // trap: it prints a deprecation warning TO STDOUT before anything else, so
  // the JSON parse below saw `warning: The \`fitz\` API is deprecated…` and
  // reported "probe produced no JSON". Invisible until the backend is
  // installed — with nothing installed, `fitz` simply failed to import and
  // the honest "no PDF backend" masked it. `pdf-pages.py` and
  // `pdf-structure.py` already used the canonical name; this was the holdout.
  const py = `
import sys, json
try:
    import pymupdf
except Exception as e:
    print(json.dumps({"error": f"no PDF backend: {e}"})); sys.exit(0)
try:
    d = pymupdf.open(sys.argv[1])
    sys.path.insert(0, sys.argv[2])
    from _text_quality import failing_pages
    langs = [l for l in sys.argv[3].split(",") if l]
    failing = [[n, why] for n, why in failing_pages([pg.get_text() for pg in d], langs)]
    text = "".join(d[i].get_text() for i in range(min(len(d), 20)))
    chars = len(text)
    nonspace = sum(1 for c in text if not c.isspace())
    letters = sum(1 for c in text if c.isalpha())
    # Arabic-script words, and those whose lam-alef or lam-yeh ligature came
    # out of the text layer in reversed order (see arabicLigatureReversed).
    ALEFS = (chr(0x627), chr(0x623), chr(0x625), chr(0x622))
    LAM, YEH = chr(0x644), chr(0x649)
    arabic = [w for w in text.split() if any(0x600 <= ord(c) <= 0x6FF for c in w)]
    reversed_lig = sum(1 for w in arabic if (len(w) > 2 and w[0] == ALEFS[0] and w[1] in ALEFS and w[2] == LAM) or w.endswith(YEH + LAM))
    def script_of(c):
        o = ord(c)
        if o < 0x250: return "latin"
        if 0x600 <= o <= 0x6FF or 0x750 <= o <= 0x77F or 0xFB50 <= o <= 0xFEFF: return "arabic"
        if 0x400 <= o <= 0x52F: return "cyrillic"
        if 0x3400 <= o <= 0x9FFF or 0x3040 <= o <= 0x30FF: return "han"
        return None
    scripts = {}
    for c in text:
        if c.isalpha():
            k = script_of(c)
            if k: scripts[k] = scripts.get(k, 0) + 1
    toc = d.get_toc()
    # Facts only. Whether an entry can carry a chapter is decided ONCE, by
    # usableOutlineEntries() above, rather than restated here: a rule spelled
    # in two languages is two rules, and this one had already diverged.
    # The Python copy lived in a JS template literal, where a regex
    # metacharacter escape is an INVALID string escape and JS drops the
    # backslash. Python therefore received a pattern that matched nothing,
    # and 35 entries of journal furniture were reported as 19 usable
    # chapters -- silent, and wrong in the unsafe direction. Bean 8shg.
    # (This comment is escape-free on purpose: the first draft of it
    # contained the very sequences it describes, and broke the parse.)
    print(json.dumps({
        "outline": len(toc),
        "toc": [[t[1], t[2]] for t in toc],
        "chars": chars,
        "letters": letters,
        "nonspace": nonspace,
        "arabicWords": len(arabic),
        "arabicLigatureReversed": reversed_lig,
        "scriptLetters": scripts,
        "pagesFailing": failing,
        "pagesTotal": len(d),
    }))
except Exception as e:
    print(json.dumps({"error": str(e)}))
`;
  // input-site: spawned #8cb1d510 — python3 on a document this tool was handed; the cone audits the child from its read set
  const r = Bun.spawnSync(["python3", "-c", py, pdf, dirname(pyHelper("_text_quality.py")), langs.join(",")]);
  const raw = parseProbe(new TextDecoder().decode(r.stdout)) as Probe & {
    toc?: [string, number][];
  };
  if (raw.toc === undefined) return raw;
  const { toc, ...rest } = raw;
  return {
    ...rest,
    outlineUsable: usableOutlineEntries(toc.map(([title, page]) => ({ title, page }))),
  };
}

/**
 * The probe's answer, read out of stdout that may not be only JSON.
 *
 * Takes the LAST line that parses, because a library is free to print to
 * stdout before the payload and one did: PyMuPDF's `fitz` alias emits a
 * deprecation warning there, which turned a working probe into
 * "probe produced no JSON". Parsing the whole stream assumes the tool is the
 * only thing writing to it, and that assumption is not ours to make.
 *
 * Still a third state when nothing parses — an unparseable probe is
 * `undetermined`, never "no outline".
 */
export function parseProbe(stdout: string): Probe {
  const lines = stdout.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]) as Probe;
    } catch {
      // keep walking back
    }
  }
  return { outline: null, chars: null, error: "probe produced no JSON" };
}

/**
 * Text below this over the first 20 pages means extraction found nothing worth
 * having and OCR is the rung. 200 is deliberately low: the cost of OCR-ing a
 * readable document is time, the cost of page-splitting an unreadable one is a
 * library entry full of empty sections that still reads as ingested.
 */
export const OCR_THRESHOLD_CHARS = 200;

/**
 * What the file IS, or `null` when nothing could determine it.
 *
 * `_tech_meta.sniff_effective_mimetype`, asked rather than reimplemented —
 * THE SAME call that fills `source.mimetype_sniffed` (bean `nso8`), so the
 * routing decision and the recorded fact cannot disagree. They did for one
 * commit: this called the magic-bytes-only `sniff_mimetype`, so every `.xlsx`
 * routed as `application/zip` to the archive rung while its own `source` block
 * correctly called it a workbook.
 */
export function sniffMimetype(file: string): string | null {
  // ABSOLUTE, from this module's own location. It was `'scripts/_tech_meta.py'`
  // — a relative path inside a PYTHON SOURCE STRING inside a TypeScript file,
  // resolved against the CWD, and invisible to every path scan this repository
  // has. The move (bean `wggr`) put the helper under `cat-harness/scripts/`.
  //
  // It failed SILENTLY, which is the part worth fixing beyond the path: the
  // import raised, python exited non-zero, and the `exitCode !== 0` guard below
  // returned `null` — "nothing could determine what this file is". So every
  // `.xlsx` would have routed to the ARCHIVE rung and been listed as a bag of
  // XML parts, which is precisely the defect bean `twqe` records and this
  // function was written to fix.
  const helper = pyHelper("_tech_meta.py");
  const py =
    "import sys, json, importlib.util as u\n" +
    `spec = u.spec_from_file_location('t', ${JSON.stringify(helper)})\n` +
    "m = u.module_from_spec(spec); spec.loader.exec_module(m)\n" +
    "print(json.dumps(m.sniff_effective_mimetype(sys.argv[1])[0]))\n";
  // input-site: spawned #ae0c4e79 — python3 on a document this tool was handed; the cone audits the child from its read set
  const r = Bun.spawnSync(["python3", "-c", py, file]);
  if (r.exitCode !== 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(r.stdout)) as string | null;
  } catch {
    return null;
  }
}


/** The delimiter `scripts/tabular-records.py` finds in this file, or `null`. */
export function tabularDelimiter(file: string): string | null {
  const py =
    "import sys, json, importlib.util as u\n" +
    `spec = u.spec_from_file_location('t', ${JSON.stringify(pyHelper("tabular-records.py"))})\n` +
    "m = u.module_from_spec(spec); spec.loader.exec_module(m)\n" +
    "print(json.dumps(m.is_tabular_text(sys.argv[1])))\n";
  // input-site: spawned #ae0c4e79 — python3 on a document this tool was handed; the cone audits the child from its read set
  const r = Bun.spawnSync(["python3", "-c", py, file]);
  if (r.exitCode !== 0) return null;
  try {
    return JSON.parse(new TextDecoder().decode(r.stdout)) as string | null;
  } catch {
    return null;
  }
}

/**
 * Is this file a Jupyter notebook, by its CONTENT? A reason-free boolean,
 * because an unreadable file or one that is not JSON is simply not a notebook
 * and falls through to the next question, as a non-CSV does.
 */
export function isNotebook(file: string): boolean {
  try {
    const j = JSON.parse(readFileSync(file, "utf-8")) as { nbformat?: unknown; cells?: unknown };
    return typeof j.nbformat === "number" && Array.isArray(j.cells);
  } catch {
    return false;
  }
}

export function planFor(
  pdf: string,
  p: Probe | undefined = undefined,
  lib: string = libraryRoot(),
  mimetype: string | null | undefined = undefined,
  /** `--text`: the caller says the source is text (Markdown, MDX, XML). */
  text = false,
  /** The languages the document is known to be in (`--lang-hint`, else `dc.language.iso`). */
  langs: readonly string[] = [],
): Plan {
  // CONTENT decides the rung, before anything opens the file as a PDF.
  //
  // Bean `twqe`. Handing this a zip used to answer `undetermined` with
  // `why: "no PDF backend: No module named 'fitz'"` — the refusal was right
  // and the DIAGNOSIS was wrong: it reported a missing tool when the fact was
  // that the file is not a PDF, and a reader would go install PyMuPDF and fail
  // again. The probe opens everything as a PDF, so it could not say otherwise.
  //
  // Sniffed, not by extension, for the reason `nso8` gives: the name is a
  // claim by whoever made the file. A `.pdf` that is really a zip belongs on
  // the archive rung, and this is the only thing that can tell.
  const mime = mimetype === undefined ? sniffMimetype(pdf) : mimetype;

  // Text — Markdown, MDX, XML — has no magic bytes, so it is routed only when
  // the CALLER says so (`--text`), never from the extension: the decision the
  // l1-document-ingestion skill left open ("Routing a dropped `.md` is a
  // separate decision"), taken 2026-10-14 after a Markdown source reached
  // `library/` through `text-structure.ts` alone and never got its KG nodes
  // (litlfred/dth-hrh). Through here it takes the same derived arm a notebook
  // does and `--promote` writes its nodes, as for every other rung.
  if (text) {
    if (mime !== null && !/^(text\/|application\/(xml|json))/.test(mime)) {
      return { rung: "undetermined", why: `--text given, but the file sniffs as ${mime}: not text`, steps: [] };
    }
    return {
      rung: "text",
      why: "--text given: read by its own headings (a Markdown file at its ATX headings, any other text as one verbatim section)",
      steps: [["bun", "run", tsHelper("text-structure.ts"), "-o", lib, "--doc-id", bibSlug(pdf), "--base", dirname(resolve(pdf)), pdf]],
    };
  }

  // A spreadsheet before an archive, because an .xlsx IS a zip and would
  // otherwise be listed as a bag of XML parts rather than read as a workbook.
  // The magic bytes cannot tell them apart — both are genuinely `PK\x03\x04`
  // — so `_tech_meta.sniff_zip_package` asks the CONTAINER, which declares
  // itself via `[Content_Types].xml` or ODF's `mimetype` member. Bean `p67i`;
  // the defect was introduced by `twqe`'s routing and caught before it shipped.
  if (mime !== null && (TABULAR_MIMETYPES as readonly string[]).includes(mime)) {
    // Every workbook is read as CSVW through the `tabular-csvw` slot, which
    // core fills (bean `urat`, owner 2026-10-20). Core has no CSVW reader for
    // ODS yet, so for one the slot answers "not a table I take" and the step
    // SKIPs; the staged entry then lists its tabular record as unmet. The v1
    // writer this used to call wrote nothing for ODS either, and stopped the
    // ingest saying "not a CSV or spreadsheet" (5c-ii, option 1).
    const ods = mime === "application/vnd.oasis.opendocument.spreadsheet";
    return {
      rung: "tabular",
      why: `the package declares ${mime} — a workbook, read for its sheets and headers${ods ? " (no CSVW reader for ODS yet: the step SKIPs)" : ""}`,
      steps: [["bun", "run", tsHelper("tabular-csvw.ts"), "-o", lib, pdf]],
    };
  }

  // A Jupyter notebook is JSON text, so it has no magic bytes either, and the
  // same rule applies: ask the content, never the `.ipynb` extension. It is a
  // notebook when it parses as JSON with a numeric `nbformat` and a `cells`
  // array. Checked BEFORE the delimited-text test, which a notebook's lines
  // could satisfy by accident. Bean `rkqp`: the notebook variant of the shared
  // document-structure base (`schemas/content/document-structure.ts`).
  if (mime === null && isNotebook(pdf)) {
    return {
      rung: "notebook",
      why: "JSON with a numeric nbformat and a cells array — a Jupyter notebook, read by its own headings",
      steps: [["bun", "run", pyHelper("notebook-structure.ts"), "-o", lib, pdf]],
    };
  }

  // A CSV has NO magic bytes, so routing one is not a sniff and must not
  // become an extension guess. `is_tabular_text` asks the only content
  // question there is: do the first rows split into the same number of fields,
  // more than one? Prose, a single column and anything ragged all answer no.
  if (mime === null && tabularDelimiter(pdf) !== null) {
    return {
      rung: "tabular",
      why: "no magic bytes, but the rows split consistently — delimited text",
      steps: [["bun", "run", tsHelper("tabular-csvw.ts"), "-o", lib, pdf]],
    };
  }

  // A deck before an archive, for the same reason a workbook is: a .pptx and
  // an .odp are zips that DECLARE what they are, and listing one as a bag of
  // XML parts would file the slides as data. Bean `scfh`, issue #1614.
  if (mime !== null && (SLIDE_MIMETYPES as readonly string[]).includes(mime)) {
    return {
      rung: "slides",
      why: `the package declares ${mime} — a slide deck, one section per slide, titles read from title placeholders only`,
      steps: [["python3", pyHelper("slides-structure.py"), "-o", lib, pdf]],
    };
  }

  // A recording (bean `1r0p`). Its transcript comes from a recogniser that
  // does not run here, and its title, date and language from its meeting
  // record, so this refuses with the route rather than opening it as a PDF.
  if (mime !== null && /^(audio|video)\//.test(mime)) {
    return {
      rung: "undetermined",
      why:
        `sniffed ${mime} — a recording. File it with scripts/recording-transcript.py: \`record\` with an identity file, ` +
        "then `transcript` with a recogniser's output (skill `audio-transcription`)",
      steps: [],
    };
  }

  if (mime !== null && (ARCHIVE_MIMETYPES as readonly string[]).includes(mime)) {
    return {
      rung: "archive",
      why: `sniffed ${mime} — an archive. Its entries are listed as data, not extracted`,
      steps: [["python3", pyHelper("archive-contents.py"), "-o", lib, pdf]],
    };
  }
  return planForPdf(pdf, p ?? probe(pdf, langs), lib, langs);
}

function planForPdf(pdf: string, p: Probe, lib: string, langs: readonly string[] = []): Plan {
  if (p.error || p.outline === null || p.chars === null) {
    return {
      rung: "undetermined",
      why:
        p.error === undefined
          ? "the PDF could not be probed"
          : p.error.startsWith("no PDF backend")
            ? `${p.error} — get it: bun run cat software:ensure pymupdf (skill finding-software)`
            : p.error,
      steps: [],
    };
  }
  // An outline was found but we cannot tell whether any of it is usable: a
  // probe predating `outlineUsable` returns it absent, and absent is UNKNOWN.
  // Routing on the raw count here would reinstate exactly the bug below;
  // calling it "no outline" would be a different lie. So: third state.
  if (p.outline > 0 && (p.outlineUsable === undefined || p.outlineUsable === null)) {
    return {
      rung: "undetermined",
      why:
        `${p.outline} outline entries, but how many can carry a chapter is unknown ` +
        `(this probe did not report it). Re-probe rather than guess a rung`,
      steps: [],
    };
  }
  const ocrPages = pagesToOcr(p);
  if (ocrPages && ((p.outlineUsable ?? 0) > 0 || !ocrPages.most)) {
    return {
      rung: "pdf-ocr+pdf-structure",
      why:
        `${ocrPages.why} — OCR reads every page and pdf-structure takes the OCR text for those pages ` +
        `only, keeping the ${(p.outlineUsable ?? 0) > 0 ? "outline and the " : ""}text layer of the rest`,
      steps: [
        ["python3", pyHelper("pdf-ocr.py"), "-o", lib, pdf],
        ["python3", pyHelper("pdf-structure.py"), "-o", lib, "--ocr", pdf],
      ],
    };
  }
  if ((p.outlineUsable ?? 0) > 0) {
    return {
      rung: "pdf-structure",
      why:
        `${p.outlineUsable} of ${p.outline} embedded outline entries can carry a ` +
        `chapter — the structure is READ, not inferred`,
      steps: [["python3", pyHelper("pdf-structure.py"), "-o", lib, pdf]],
    };
  }
  // The case bean `8shg` exists for. An outline is PRESENT and carries nothing
  // usable, which is not the same as absent and must not be reported as it:
  // `milnorlink.pdf` has 35 entries of JSTOR journal furniture. Falls through
  // to the text-layer rungs, and says why so the next reader does not re-open
  // this as "the outline was ignored" — which is how this bean was opened.
  const junkOutline =
    p.outline > 0
      ? `an outline of ${p.outline} entries, none of which can carry a chapter ` +
        `(page labels and entries with no destination) — present, but not a structure. `
      : "";
  const unreadable = textLayerUnreadable(p, langs) ?? (ocrPages?.most ? ocrPages.why : undefined);
  if (unreadable) {
    return {
      rung: "pdf-ocr+pdf-pages",
      why: `${junkOutline}${unreadable} — OCR reads the page images instead`,
      steps: [
        ["python3", pyHelper("pdf-ocr.py"), "-o", lib, pdf],
        ["python3", pyHelper("pdf-pages.py"), "-o", lib, "--from-ocr", pdf],
      ],
    };
  }
  if (p.chars < OCR_THRESHOLD_CHARS) {
    return {
      rung: "pdf-ocr+pdf-pages",
      why:
        `${junkOutline || "no outline, and "}${p.chars} characters over the first pages ` +
        `(< ${OCR_THRESHOLD_CHARS}) — there is no usable text layer`,
      steps: [
        ["python3", pyHelper("pdf-ocr.py"), "-o", lib, pdf],
        ["python3", pyHelper("pdf-pages.py"), "-o", lib, "--from-ocr", pdf],
      ],
    };
  }
  // No outline at all, but a text layer: `pdf-structure` decides (issue #2302,
  // bean `z3rf`). It uses the INFERRED contents only when they pass all three
  // trust tests (the `6xaz` concentration check, mean confidence >= 0.6, at
  // most 25% empty sections) and otherwise writes one section per page in
  // `pdf-pages`' shape. Routing here to `pdf-pages` made that decision
  // unreachable: #2388 merged the tests, and `bun run cat ingest` never ran them.
  //
  // A JUNK outline still goes to `pdf-pages`: `pdf-structure` would read the
  // outline it found (bean `8shg`), not infer one.
  if (!junkOutline) {
    return {
      rung: "pdf-structure",
      why:
        `no outline, ${p.chars} characters of text layer — pdf-structure infers the contents and ` +
        `uses them only if they pass its trust tests, else PAGE granularity (issue #2302)`,
      steps: [["python3", pyHelper("pdf-structure.py"), "-o", lib, pdf]],
    };
  }
  return {
    rung: "pdf-pages",
    why: `${junkOutline}${p.chars} characters of text layer — PAGE granularity. A chapter tree is NOT inferred (bean 6xaz)`,
    steps: [["python3", pyHelper("pdf-pages.py"), "-o", lib, pdf]],
  };
}

/**
 * A title already known for the document, and where it came from (bean `turh`).
 *
 * `--title` first: the caller has looked. Then the catalogue's Dublin Core
 * `dc.title`, through the same `catalogueRecordFor` the manifest's title
 * resolver reads (`pipeline/library-title.ts`), so ingest and the manifest ask
 * one source the same way. `undefined` when neither has one — the rungs then
 * resolve a title from the PDF as before, and nothing is guessed here.
 *
 * It existed only by hand before: `who-pub-tps-931` had to be rebuilt with
 * `pdf-pages.py --from-ocr --title "WHO Editorial Style Manual"`, because the
 * ingest path could not carry the catalogue's title to the rung.
 */
export function knownTitle(
  argv: readonly string[],
  instanceRoot: string,
  slug: string,
): { title: string; from: string } | undefined {
  const i = argv.indexOf("--title");
  const given = i >= 0 ? (argv[i + 1] ?? "").trim() : "";
  if (given) return { title: given, from: "--title" };
  const cat = catalogueRecordFor(instanceRoot, slug);
  const t = cat ? dcValue(cat.rec, "title") : "";
  return cat && t ? { title: t, from: `${cat.file} dc.title` } : undefined;
}

/** The rungs that take `--title`: both write `structure.json` and the sections' `doc_title`. */
const TITLE_RUNGS = new Set(["pdf-structure.py", "pdf-pages.py", "text-structure.ts"]);

/** `plan` with `--title` handed to each rung that takes one. Pure. */
export function withKnownTitle(plan: Plan, title: string | undefined): Plan {
  if (!title) return plan;
  return {
    ...plan,
    steps: plan.steps.map((s) =>
      // A Python rung is `python3 <script>`; a TypeScript one is `bun run <script>`.
      (TITLE_RUNGS.has(basename(s[1] ?? "")) || TITLE_RUNGS.has(basename(s[2] ?? ""))) && !s.includes("--title") ? [...s, "--title", title] : s,
    ),
  };
}

/**
 * The document's languages, as ISO 639 codes, for the OCR rung.
 *
 * Owner, 2026-11-10: "make sure OCR is language aware". Tesseract's script
 * detection cannot tell French from English or Persian from Arabic, so the
 * catalogue's `dc.language.iso` is handed to `pdf-ocr.py --lang-hint`, which
 * narrows each page to the hinted languages in the script it shows. An
 * explicit `--lang-hint fr,en` wins. Absent both, nothing is passed and the
 * rung detects by script alone, as before.
 */
export function knownLanguages(
  argv: readonly string[],
  instanceRoot: string,
  slug: string,
): { langs: string[]; from: string } | undefined {
  const i = argv.indexOf("--lang-hint");
  const given = i >= 0 ? (argv[i + 1] ?? "").split(",").map((x) => x.trim()).filter(Boolean) : [];
  if (given.length) return { langs: given, from: "--lang-hint" };
  const cat = catalogueRecordFor(instanceRoot, slug);
  if (!cat) return undefined;
  const fields = Array.isArray(cat.rec.fields) ? (cat.rec.fields as { element?: unknown; qualifier?: unknown; values?: { value?: unknown }[] }[]) : [];
  const langs = [
    ...new Set(
      fields
        .filter((f) => f.element === "language" && f.qualifier === "iso")
        .flatMap((f) => (Array.isArray(f.values) ? f.values : []))
        .map((v) => (typeof v.value === "string" ? v.value.trim() : ""))
        .filter(Boolean),
    ),
  ];
  return langs.length ? { langs, from: `${cat.file} dc.language.iso` } : undefined;
}

/**
 * `plan` with `--lang-hint` handed to the OCR rung and to `pdf-structure`,
 * whose page check needs the document's languages (`_text_quality.py`). Pure.
 */
export function withLanguageHint(plan: Plan, langs: readonly string[] | undefined): Plan {
  if (!langs || langs.length === 0) return plan;
  return {
    ...plan,
    steps: plan.steps.map((s) =>
      ["pdf-ocr.py", "pdf-structure.py"].includes(basename(s[1] ?? "")) && !s.includes("--lang-hint") && !s.includes("--lang")
        ? [...s, "--lang-hint", langs.join(",")]
        : s,
    ),
  };
}

/** At least this share of pages failing the page check sends a document with no outline to OCR whole. */
export const MOST_PAGES_FAILING = 0.5;

/**
 * Which pages' text layers fail the page check, and whether that is most of
 * the document, or `undefined` when none does. Pure.
 *
 * Owner, 2026-11-11 (who-iris, card Q-ODD-1 = A): "force OCR when a page's
 * text layer fails a quality check". {@link textLayerUnreadable} judges the
 * first 20 pages as one text, and is never asked at all when the PDF has a
 * usable outline: the French WER 75(02) (10665/231031, accents mapped to
 * Greek letters on all 5 pages), the Persian cervical-screening guideline
 * (10665/94830, 43 of 68 pages in the wrong Arabic code points) and the
 * French article with an Arabic abstract (10665/117378) all kept their broken
 * text. The page check (`scripts/_text_quality.py`) runs over every page.
 */
export function pagesToOcr(p: Probe): { pages: number[]; most: boolean; why: string } | undefined {
  const f = p.pagesFailing ?? [];
  if (f.length === 0) return undefined;
  const total = p.pagesTotal ?? f.length;
  const most = f.length >= MOST_PAGES_FAILING * total;
  const list = f.slice(0, 8).map(([n]) => n).join(", ") + (f.length > 8 ? ", …" : "");
  return { pages: f.map(([n]) => n), most, why: `${f.length} of ${total} pages fail the text-layer check (pages ${list}; page ${f[0]![0]}: ${f[0]![1]})` };
}

/**
 * Recompute `source` on an entry that already exists, from the upload.
 *
 * Bean `nso8` says the technical facts must be "produced by the ingest path
 * rather than backfilled", which is why this lives HERE rather than in a
 * migration script: it is the same entry point calling the same
 * `scripts/_tech_meta.py` the rungs call, applied to a document ingested
 * before those fields existed. A separate backfiller would be a second
 * implementation of the one thing `_tech_meta.py` exists to keep single.
 *
 * It needs no PDF backend — every field is computed from the file's bytes —
 * so it works where a full re-ingest cannot. It **merges**, never replaces:
 * `pages`, `text_source` and `extractor` are the rung's knowledge and this
 * has no way to recompute them.
 */
export function refreshMeta(pdf: string, libRoot = libraryRoot()): string {
  const slug = bibSlug(pdf);
  // Against INSTANCE_ROOT, same reason as the promote path below: `libraryRoot`
  // is INSTANCE-relative, and a bare `resolve` reads the CWD.
  const structure = join(resolve(INSTANCE_ROOT, libRoot), slug, STRUCTURE_FILENAME);
  if (!existsSync(structure)) throw new Error(`${structure}: no such entry to refresh`);
  // The indent is READ OFF the file, never chosen here. `pdf-structure.py`
  // writes `indent=1` and `pdf-pages.py` writes `indent=2`, so a refresh that
  // picked either would reformat every entry the other rung authored: adding
  // three fields to `9789241548960-eng` re-wrote 4 349 lines, which buries the
  // change it was making and fights every later diff. A metadata refresh is
  // not a licence to reformat a file it did not write.
  const py =
    "import sys, json, importlib.util as u\n" +
    `spec = u.spec_from_file_location('t', ${JSON.stringify(pyHelper("_tech_meta.py"))})\n` +
    "m = u.module_from_spec(spec); spec.loader.exec_module(m)\n" +
    "p = sys.argv[2]\n" +
    "raw = open(p).read()\n" +
    "lines = raw.split('\\n')\n" +
    "ind = next((len(l) - len(l.lstrip(' ')) for l in lines[1:] if l.startswith(' ')), 2)\n" +
    "d = json.loads(raw)\n" +
    "d['source'] = {**d.get('source', {}), **m.tech_meta(sys.argv[1])}\n" +
    "open(p, 'w').write(json.dumps(d, indent=ind) + ('\\n' if raw.endswith('\\n') else ''))\n" +
    "print(d['source']['mimetype_source'])\n";
  // input-site: spawned #24f26d86 — python3 on a document this tool was handed; the cone audits the child from its read set
  const r = Bun.spawnSync(["python3", "-c", py, pdf, structure]);
  if (r.exitCode !== 0) {
    throw new Error(`refreshing ${slug}: ${new TextDecoder().decode(r.stderr).trim()}`);
  }
  return `${slug}: ${new TextDecoder().decode(r.stdout).trim()}`;
}

/**
 * `--refresh-title`: re-resolve an existing entry's title from its PDF (bean
 * `w6fu`, owner's ruling 2026-10-02 on #1838).
 *
 * The title rule is `_pdf_title.py`'s, shared with both PDF rungs, so a
 * refresh and a fresh ingest agree. It replaces the title only with one an
 * independent source corroborates, records every candidate it saw, keeps the
 * text walk's title as `title_raw` and never touches an editor's
 * `title_correction`. Like {@link refreshMeta} it reads the file's indent off
 * the file rather than choosing one.
 */
export function refreshTitle(pdf: string, libRoot = libraryRoot()): string {
  const slug = bibSlug(pdf);
  const structure = join(resolve(INSTANCE_ROOT, libRoot), slug, STRUCTURE_FILENAME);
  if (!existsSync(structure)) throw new Error(`${structure}: no such entry to refresh`);
  // input-site: spawned #700cd046 — python3 on a document this tool was handed; the cone audits the child from its read set
  const r = Bun.spawnSync(["python3", pyHelper("_pdf_title.py"), "--refresh", structure, pdf]);
  if (r.exitCode !== 0) {
    throw new Error(`refreshing the title of ${slug}: ${new TextDecoder().decode(r.stderr).trim()}`);
  }
  const out = JSON.parse(new TextDecoder().decode(r.stdout)) as {
    before: string | null;
    after: string | null;
    source: string;
    verified: boolean;
  };
  return `${slug}: ${JSON.stringify(out.before)} -> ${JSON.stringify(out.after)} [${out.source}${out.verified ? "" : ", unverified"}]`;
}

/**
 * Which half of the pipeline is being asked for — bean `pn6j`.
 *
 * Exported for the same reason as {@link mayPromote}: the first version read
 * `argv.includes("--promote")` inline at two call sites, and a mutation that
 * dropped the guard survived, because a source-text test still matched the
 * OTHER occurrence. A decision worth testing is a decision worth naming.
 */
export function ingestMode(argv: readonly string[]): "stage" | "promote" {
  return argv.includes("--promote") ? "promote" : "stage";
}

/**
 * May this staged entry cross into `library/`? — bean `pn6j`.
 *
 * Pure and exported so the decision can be mutation-tested on its own. The
 * first version of this lived inline in the CLI and was covered only by tests
 * that grep the source, which catch a RENAME and miss an inversion — the two
 * mutations that survived were `if (unmet.length)` → `if (false)` and
 * dropping the `--promote` guard, both of which read fine textually.
 *
 * `not-derivable` does NOT block. It is the third state: no arm builds that
 * requirement yet, and refusing every document until every arm exists would
 * make the gate unusable, which is how a gate gets switched off. Only `unmet`
 * — a defect in THIS entry, fixable by re-running a rung — refuses.
 */
export function mayPromote(requirements: readonly Requirement[], qaLater = false): boolean {
  // An empty list is "nothing was examined", never "everything passed":
  // `every` over `[]` is true, so the refusal is stated rather than left to
  // `checkEntry` always returning something.
  if (requirements.length === 0) return false;
  return requirements.every((r) => r.state !== "unmet" || (qaLater && QA_ONLY.has(r.name)));
}

/**
 * `--qa-later`: promote with the QA-only requirements ({@link QA_ONLY}, today
 * `image-descriptions`) still unmet, and say so. Off by default, so a person
 * ingesting one document by hand still meets the full gate.
 *
 * Owner, 2026-11-10: items catalogued by reference have their
 * library KG derived in bulk ("retrieve PDF/source document locally, run KG
 * ingestion routines/derivative KGs ... do all 144"). One of them, the Global
 * strategy on digital health, places 125 images; the narratives are written
 * later, by a person or an agent, which is the reason `QA_ONLY` exists
 * (owner, 2026-10-15: "make QA check"). The unmet requirement stays recorded
 * in the entry's QA verdicts and on the library page.
 */
export function qaLater(argv: readonly string[]): boolean {
  return argv.includes("--qa-later");
}

/**
 * The command that promotes what was just staged — the caller's OWN arguments
 * with `--promote` added, never a path recomposed here.
 *
 * It was recomposed, relative to the layer root, and `bun run` runs from
 * the repository root: measured 2026-10-06 (bean `apui`), the printed line was
 * `ingest-document.ts ../uploads/X.pdf --promote`, which answers
 * "../uploads/X.pdf: not there". It also dropped `--library`, which a repo
 * declaring several libraries refuses to guess — so the line was wrong twice,
 * and either fix alone still left it failing. Echoing argv is right by
 * construction: the shell that ran the staging step is the one that will run
 * this, with the same working directory.
 */
export function promoteCommand(argv: readonly string[]): string {
  const quote = (a: string) => (/[\s"'$`\\]/.test(a) ? JSON.stringify(a) : a);
  const kept = argv.filter((a) => a !== "--promote" && a !== "--dry-run");
  return ["bun", "run", "cat", "ingest", ...kept.map(quote), "--promote"].join(" ");
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const dry = argv.includes("--dry-run");
  const chosenLibrary = libraryChoice(argv);
  // The positional is the first argument that is neither a flag NOR a flag's
  // VALUE. `argv.find((a) => !a.startsWith("--"))` was enough while every flag
  // was boolean; `--library <instance>` breaks it, because `<instance>` does not
  // start with `--` and would be ingested as a filename — producing "<instance>:
  // not there" while the real argument sat untouched two places along.
  const takesValue = new Set(["--library", "--reference", "--title", "--instance"]);
  let pdf: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      if (takesValue.has(a)) i++;
      continue;
    }
    pdf = a;
    break;
  }
  if (!pdf) {
    console.error("usage: bun run cat ingest <uploads/FILE.pdf> [--dry-run] [--library <name>]");
    process.exit(1);
  }
  if (!existsSync(pdf)) {
    console.error(`${pdf}: not there`);
    process.exit(1);
  }
  if (argv.includes("--refresh-meta")) {
    console.log(refreshMeta(pdf));
    process.exit(0);
  }
  if (argv.includes("--refresh-title")) {
    console.log(refreshTitle(pdf, libraryRoot(INSTANCE_ROOT, chosenLibrary)));
    process.exit(0);
  }
  const slug = bibSlug(pdf);
  // ── Staged, then PROMOTED — bean `pn6j`, owner's decision 2026-09-20 ─────
  //
  // The arms write into `-o <dir>`, so the only change needed to gate this is
  // which directory. They used to be handed `library/` itself, which meant a
  // document that failed L1 completeness was already filed by the time
  // anything could say so — the gate ran, printed, and the entry stayed. Its
  // gap was then discovered by whoever next needed the missing artefact,
  // which is the failure `pn6j` was written to prevent.
  //
  // Refuse-to-promote rather than move-back, which is why no standing rule is
  // touched: nothing is ever moved OUT of `library/` and nothing is deleted,
  // so `deletion-requires-confirmation` does not apply. A rejected document
  // simply never arrives, and its staged output is left in place for
  // inspection rather than cleaned up — an agent tidying away the evidence of
  // its own refusal is the same act under another name.
  // NOT dot-prefixed. This repository moved `.beans/` and `.harness/` out
  // from behind dots in 2026-09-18 for exactly this reason — the artefacts a
  // person looks for first were the hardest to find — and its own dot-prefix
  // guard rejects such a segment. A staging tree holding a REFUSED document is
  // precisely something somebody will come looking for.
  // The staging LIBRARY ROOT, not the entry directory. `planFor`'s third
  // argument is what `libraryRoot()` returns, and every arm creates
  // `<lib>/<slug>/` beneath it. Passing the entry directory produced
  // `ingest-staging/<slug>/<slug>/`, so `checkEntry` read an empty parent and
  // reported EVERY requirement unmet — a refusal that looked exactly like a
  // correct one. Shipped in #495 and caught by running a CSV through the live
  // pipeline; the milnorlink checks passed over it because the incomplete
  // case is refused either way and the complete case was staged by hand,
  // directly into the entry directory.
  const stagingRoot = join(resolve(INSTANCE_ROOT), "ingest-staging");
  const staging = join(stagingRoot, slug);
  // Resolved ONCE, before anything is written: `libraryRoot()` refuses when
  // several libraries are declared and none was chosen (bean `a02m`/`frs5`),
  // and that refusal belongs before the arms run rather than after they have
  // produced a staging tree nobody can file.
  //
  // Note the two are DIFFERENT roots and always were: the arms write beneath
  // `stagingRoot`, and `destination` is where a passing entry is promoted TO.
  // Conflating them is the defect the comment above records.
  //
  // It is resolved BEFORE the plan now, because the verdict arm needs it
  // (bean `8suc`). The refusal it may raise was already required to come
  // before the arms ran, so nothing about the ordering guarantee changes.
  const destination = libraryRoot(INSTANCE_ROOT, chosenLibrary);
  // `--reference IDENTITY.json`: record the source and hold none of its text
  // (bean `scfh`). Chosen by the caller, never inferred: whether a licence
  // permits posting a copy is a reading of the licence, not of the bytes.
  const reference = argv.includes("--reference") ? argv[argv.indexOf("--reference") + 1] : undefined;
  const known = knownTitle(argv, resolve(INSTANCE_ROOT), slug);
  const languages = knownLanguages(argv, resolve(INSTANCE_ROOT), slug);
  const plan = withDerivedArms(
    reference
      ? {
          rung: "referenced",
          why: "--reference given — recorded with its outline and sha256, text withheld",
          steps: [["python3", pyHelper("referenced-source.py"), "-o", stagingRoot, pdf, "--identity", reference]],
        }
      : withLanguageHint(
          withKnownTitle(planFor(pdf, undefined, stagingRoot, undefined, argv.includes("--text"), languages?.langs), known?.title),
          languages?.langs,
        ),
    pdf,
    stagingRoot,
    staging,
    // ABSOLUTE, like every other argument the arms receive. `destination` is
    // instance-relative by contract, and a bare `resolve()` on it would
    // resolve against the CWD — the `frs5` defect, which sent a promotion
    // outside the checkout entirely once a library could live in a sibling.
    resolve(INSTANCE_ROOT, destination),
  );
  console.log(`${basename(pdf)} -> ${destination}/${slug}/`);
  console.log(`  rung: ${plan.rung}`);
  console.log(`  why:  ${plan.why}`);
  if (known) console.log(`  title: ${known.title} (from ${known.from})`);
  if (languages) console.log(`  languages: ${languages.langs.join(", ")} (from ${languages.from})`);
  // Before any arm runs — the licence step is EARLY by ruling (bean 7bg9).
  const lic = earlyLicence(pdf);
  console.log(`  licence: ${lic.verdict} — ${lic.detail}`);
  if (plan.rung === "undetermined") {
    console.error("\nNOT ingested. This is not a pass — a document filed under");
    console.error("the wrong rung reads as ingested while its structure is wrong.");
    process.exit(2);
  }
  if (dry) {
    for (const s of plan.steps) console.log(`  would run: ${s.join(" ")}`);
    process.exit(0);
  }
  for (const s of ingestMode(argv) === "promote" ? [] : plan.steps) {
    console.log(`\n$ ${s.join(" ")}`);
    // input-site: inert #23cfbd9b — when a step started, stamped into the record of an undetermined step; never a check's input
    const started = Date.now();
    const r = Bun.spawnSync(s, { stdout: "inherit", stderr: "inherit" });
    if (r.exitCode !== 0) {
      const recorded = recordedUndetermined(s, r.exitCode, started);
      if (recorded !== undefined) {
        console.log(`  ${basename(s[1] ?? "")}: UNDETERMINED, recorded in ${recorded} — continuing`);
        continue;
      }
      if (tableNotTaken(s, r.exitCode)) {
        console.log(`  ${basename(s[2] ?? "")}: NOT READ — no tabular-csvw reader takes this file; the staged entry lists its tabular record as unmet`);
        continue;
      }
      console.error(`\n${s[1]} failed (exit ${r.exitCode}) — stopping.`);
      process.exit(1);
    }
  }
  // ── Staging STOPS here unless `--promote` ───────────────────────────────
  //
  // Measured while building this: `planFor` runs ONE rung. `pdf-pages.py`
  // alone yields 20 page files and none of `structure.json`, `sections/`,
  // `blocks/`, `manifest.jsonld` or `images.json` — so gating right here
  // refused the document on SEVEN unmet requirements, and would refuse every
  // document ever ingested. A gate that always refuses is a gate somebody
  // switches off, which is worse than no gate at all.
  //
  // So promotion is its own step. The arms accumulate in `ingest-staging/`,
  // and `--promote` is the one moment anything crosses into `library/`. That
  // is what "refuse to promote" has to mean when ingestion is a pipeline
  // rather than a single command.
  if (ingestMode(argv) === "stage") {
    // The licence the upload recorded becomes the entry's licence.json, which
    // gen-library-jsonld carries into the manifest's licence — never overwriting one
    // already there (bean 7bg9).
    const carried = carryIntakeLicence(pdf, staging);
    if (carried.outcome === "carried") console.log(`  licence: carried into the staged entry as licence.json (${carried.status})`);
    else if (carried.outcome === "conflict") console.log(`  licence CONFLICT: ${carried.detail}`);
    const staged = checkEntry(staging);
    const pending = staged.requirements.filter((r) => r.state === "unmet");
    console.log(`\n✓ staged at ${relative(resolve(INSTANCE_ROOT), staging)}/`);
    if (pending.length) {
      console.log(`  ${pending.length} requirement(s) still to satisfy before it can be promoted:`);
      for (const r of pending) console.log(`    ${r.name.padEnd(22)} ${r.detail}`);
    }
    // THE "RUN THE REMAINING ARMS" SENTENCE IS GONE, and deleting it is the
    // point rather than a tidy-up.
    //
    // It told the agent one `-o` for arms that take OPPOSITE conventions:
    // `pdf-images.py` wants the library ROOT ("the sidecar lands in
    // <out>/<doc-id>/") and `l1-blocks.ts` wants the ENTRY directory, which it
    // proves by throwing "no structure.json — this is not a staged entry".
    // **No value of `-o` was correct for both**, so the correction shipped in
    // #1035 made the line right for one arm and wrong for the other in the
    // same stroke. `withDerivedArms` now hands each the directory it wants and
    // there is no sentence left to get wrong.
    //
    // What remains is the honest report: `checkEntry` has just run over the
    // fully-armed entry, so `pending` is what is ACTUALLY still missing, named
    // per requirement. An empty `pending` is a document ready to promote and
    // says so; it is never inferred from "the arms exited 0", because an arm
    // can succeed and still leave a requirement unmet.
    if (pending.length === 0) {
      console.log(`  every requirement met — ready to promote.`);
    }
    console.log(`\nNext: ${promoteCommand(argv)}`);
    process.exit(0);
  }

  // THE GATE, and the only place anything enters `library/`.
  const verdict = checkEntry(staging);
  const unmet = verdict.requirements.filter((r) => r.state === "unmet");
  if (!mayPromote(verdict.requirements, qaLater(argv))) {
    console.error(`\n✗ NOT promoted — ${unmet.length} requirement(s) unmet:`);
    for (const r of unmet) console.error(`    ${r.name.padEnd(22)} ${r.detail}`);
    console.error(`\nStaged output is at ${relative(resolve(INSTANCE_ROOT), staging)}/ and was`);
    console.error("left in place. Fix the cause and re-run; nothing was filed under");
    console.error(`${destination}/, so nothing reads as ingested.`);
    // Reported, never acted on: the owner chose reporting-only over opening a
    // bean here (2026-09-20). `beans create` dedupes on nothing and once
    // produced 14,688 duplicates, so a gate that mints one per run against
    // that store is a bad trade — and a person seeing this line has the
    // context a bean would only approximate.
    process.exit(1);
  }

  const deferred = unmet.filter((r) => QA_ONLY.has(r.name));
  if (deferred.length) {
    console.log(`\n! promoted with ${deferred.length} QA requirement(s) left for later (--qa-later):`);
    for (const r of deferred) console.log(`    ${r.name.padEnd(22)} ${r.detail}`);
  }

  // Against INSTANCE_ROOT, never the CWD.
  //
  // `libraryRoot` returns an INSTANCE-RELATIVE path — that is its contract, and
  // it is what every `-o` argument wants. `resolve()` with one argument
  // resolves against `process.cwd()`, so running this from the repository root
  // (which is where `bun run` puts you) turned `../<instance>/library` into
  // `/home/user/<instance>/library` — OUTSIDE THE CHECKOUT. It then copied the
  // staged tree there, deleted the staging directory, and printed `✓ promoted`.
  //
  // Latent before bean `frs5` and load-bearing after it: while the only
  // library was this layer's own, the relative path was `library` and the
  // mistake resolved to a wrong directory inside the repo. Once a library
  // could sit in a SIBLING layer the path gained a `../` and the same line
  // started escaping the repository altogether.
  const out = join(resolve(INSTANCE_ROOT, destination), slug);
  // The entry's JSON-LD nodes, minted for where it is GOING (bean `apui`).
  //
  // The arms wrote a manifest in staging, and staging belongs to whichever
  // layer holds `ingest-staging/` — so a document promoted into a sibling's
  // library arrived naming the wrong layer, and `gen-library-jsonld
  // --check` called 37 of its nodes stale. That left the path as four
  // commands, two of them corpus-wide generators run by hand. This is the same
  // `buildEntryNodes` the corpus walk calls, scoped to ONE entry: the
  // single-document promotion never rewrites anybody else's nodes.
  //
  // Built BEFORE the copy, so an entry whose nodes cannot be built is refused
  // like any other unmet requirement instead of being filed half-described.
  const nodes = buildEntryNodes(slug, staging, out);
  if (nodes.state === "unreadable") {
    console.error(`\n✗ NOT promoted — its JSON-LD nodes could not be built (${nodes.rung} input present, not readable).`);
    console.error(`Staged output is left at ${relative(resolve(INSTANCE_ROOT), staging)}/.`);
    process.exit(1);
  }
  mkdirSync(dirname(out), { recursive: true });
  // Only ever INTO the library. `renameSync` would fail across a filesystem
  // boundary, and a staged tree the arms just wrote is small enough that the
  // copy is not worth a fallback path nobody tests.
  cpSync(staging, out, { recursive: true });
  rmSync(staging, { recursive: true, force: true });
  if (nodes.state === "built") {
    for (const f of nodes.files) {
      mkdirSync(dirname(join(out, f.path)), { recursive: true });
      writeFileSync(join(out, f.path), f.content);
    }
  }
  console.log(`\n${existsSync(out) ? "✓" : "✗"} ${destination}/${slug}/  (L1 complete, promoted)`);
  console.log(
    nodes.state === "built"
      ? `  · ${nodes.files.length} JSON-LD node(s) written for this entry`
      : "  · no JSON-LD input in this entry — nothing to generate (determined)",
  );
  for (const r of verdict.requirements.filter((r) => r.state === "not-derivable")) {
    console.log(`  · ${r.name}: ${r.detail}`);
  }
  // A higher layer's extraction arms over the PROMOTED entry — the reference
  // list and the glossary (owner, 2026-11-14), which read `sections/` where
  // they now are. Through the optional `library-entry-arms` slot, because
  // those readers live in a layer above this one. Guarded: each records its
  // own `extraction.json` step, a failure included, and none stops this.
  try {
    const entryDir = resolve(INSTANCE_ROOT, destination, slug);
    const ran = runEntryArms(optionalPipelinePlugin("library-entry-arms"), {
      instanceRoot: resolve(INSTANCE_ROOT),
      library: resolve(INSTANCE_ROOT, destination),
      entry: entryDir,
      slug,
    });
    for (const { kind, step } of ran) console.log(`  · ${kind}: ${step.state}${step.count !== undefined ? ` (${step.count})` : ""}${step.note ? ` — ${step.note}` : ""}`);
  } catch (e) {
    console.log(`  · extraction arms not run: ${e instanceof Error ? e.message : String(e)}`);
  }
  // The library changed, so its LSI index is stale by construction. Advisory:
  // an index is not part of L1 (skill `lsi-indexing`, option B of bean `ansc`).
  for (const line of refreshLibraryIndex(resolve(INSTANCE_ROOT, destination), slug)) console.log(line);
}
