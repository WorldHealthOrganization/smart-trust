/**
 * Theme art arriving as three files — accepted, or refused with a reason.
 *
 * @module schemas/theme-art-intake
 * @graphNode schema
 *
 * Part of document ingestion, not a second process: theme art is an arrival
 * with a different payload, so this adds a **check keyed on the payload** to
 * the same completeness gate.
 *
 * ## The constraints
 *
 * | constraint | why |
 * |---|---|
 * | {@link THEME_ART_LAYOUTS} complete | `resolveThemeBackdrop` refuses an incomplete backdrop wholesale, so the theme renders with no art at all. |
 * | distinct content | byte-identical files for different roles are refused. |
 * | orientation per layout | a portrait crop is not a landscape crop scaled down; the quiet area a sticky's text sits in moves. |
 * | dimensions **measured** | a retyped width makes `images[].width` a false declaration. |
 * | weight and format | large PNGs are refused where webp siblings are expected. |
 * | a declared destination | art outside a declared directory is seen by no gate (`check-declared-assets` walks declared→disk). |
 *
 * ## The contract: success, or a NAMED failure
 *
 * Every {@link ThemeArtFailure} carries the layout it is about, what was
 * found, and **what to do about it**. All failures are collected rather than
 * thrown one at a time, because art arrives as a batch.
 *
 * ## Dimensions are READ, never accepted
 *
 * {@link measureImage} parses the file header. This module takes bytes and
 * emits the declaration; the caller is never asked for a width.
 */
import { z } from "zod";

import { THEME_LAYOUTS, type ThemeLayout } from "../ui/theme.js";

/** The three crops a theme backdrop needs. Re-exported so intake states its own set. */
export const THEME_ART_LAYOUTS = THEME_LAYOUTS;

/**
 * What each layout's shape must be.
 *
 * `card` is square, `laptop` landscape, `mobile` portrait. Expressed as an
 * aspect-ratio **band** rather than a fixed size: the art is authored at
 * whatever resolution the tool produced, and pinning exact dimensions would
 * refuse a perfectly good 2× render. What must not vary is the SHAPE, because
 * the layouts exist to be different shapes — a `mobile` file that is landscape
 * is a laptop crop under the wrong name, and it will be served to a phone.
 *
 * Bands are wide on purpose. Measured against the live declaration, the shipped
 * laptop crops run 1.50–1.78 and the mobile crops 0.56–0.67, so a narrow band
 * would refuse art this repository already ships. The check is *is this the
 * right shape*, not *is this the same size as its neighbour*.
 */
export const LAYOUT_ASPECT_BANDS: Readonly<Record<ThemeLayout, { min: number; max: number }>> = {
  // width / height
  laptop: { min: 1.2, max: 2.4 },
  mobile: { min: 0.4, max: 0.85 },
  card: { min: 0.9, max: 1.12 },
};

/**
 * The weight above which a file is reported as heavy, in bytes.
 *
 * **A report, not a refusal** — and the distinction is the point. A heavy file
 * renders correctly; it just costs the reader. Refusing it would block art that
 * works over a judgement about bandwidth, so this produces a `warning` and the
 * caller decides. The number is the measured gap: the webp siblings are ~100 KB
 * and the arriving PNGs were ~1.6 MB, so 400 KB sits well clear of the good
 * case and well under the bad one.
 */
export const HEAVY_IMAGE_BYTES = 400_000;

/** Formats intake can measure, and therefore accept. */
export const SUPPORTED_ART_FORMATS = ["png", "webp"] as const;
export type ArtFormat = (typeof SUPPORTED_ART_FORMATS)[number];

/** The preferred format, against which everything else is reported as heavier. */
export const PREFERRED_ART_FORMAT: ArtFormat = "webp";

/** One file offered to intake. */
export interface ArtCandidate {
  /** The layout this file is offered AS. Checked, never inferred from the name. */
  layout: ThemeLayout;
  /** Where the file came from, for the report. Not where it will live. */
  sourcePath: string;
  /** The bytes. Read once by the caller so this module does no I/O. */
  bytes: Uint8Array;
}

/** Every way intake can refuse, as a closed set. */
export const THEME_ART_FAILURE_KINDS = [
  "missing-layout",
  "duplicate-layout",
  "identical-content",
  "unreadable",
  "unsupported-format",
  "wrong-orientation",
  "undeclared-destination",
] as const;
export type ThemeArtFailureKind = (typeof THEME_ART_FAILURE_KINDS)[number];

/**
 * One refusal, with what to do about it.
 *
 * `remedy` is required rather than optional, and that is the whole contract: a
 * failure without one is a failure the reporter did not finish thinking about.
 */
export interface ThemeArtFailure {
  kind: ThemeArtFailureKind;
  /** The layout at fault, where the failure is about one. */
  layout?: ThemeLayout;
  /** What was found. */
  detail: string;
  /** What to do about it. */
  remedy: string;
}

/** A non-fatal observation. Art with warnings is still accepted. */
export interface ThemeArtWarning {
  kind: "heavy" | "not-preferred-format";
  layout: ThemeLayout;
  detail: string;
  remedy: string;
}

/** What a file turned out to be. */
export interface MeasuredImage {
  format: ArtFormat;
  width: number;
  height: number;
  bytes: number;
}

/** The declaration intake EMITS — never one it was handed. */
export interface ArtDeclaration {
  role: string;
  layout: ThemeLayout;
  src: string;
  width: number;
  height: number;
}

export const ArtDeclarationSchema = z
  .object({
    role: z.string().min(1),
    layout: z.enum(THEME_LAYOUTS),
    src: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

/** Accepted, with the declaration to write; or refused, with why. */
export type ThemeArtIntakeResult =
  | { ok: true; images: ArtDeclaration[]; warnings: ThemeArtWarning[] }
  | { ok: false; failures: ThemeArtFailure[]; warnings: ThemeArtWarning[] };

/**
 * Read an image's format and dimensions from its header.
 *
 * PNG and WebP only, parsed directly: this repository has no image dependency,
 * and adding one to read two numbers would be a dependency for a header parse.
 * Returns `undefined` for anything it cannot read, which intake reports as
 * `unreadable` rather than guessing — a guessed dimension is the defect this
 * whole module exists to prevent.
 *
 * - **PNG**: 8-byte signature, then the IHDR chunk; width and height are
 *   big-endian u32 at offsets 16 and 20.
 * - **WebP**: RIFF container. Three sub-formats carry the size differently —
 *   `VP8 ` (lossy), `VP8L` (lossless) and `VP8X` (extended) — and all three are
 *   handled, because which one a tool emits is not something the author chose.
 */
export function measureImage(bytes: Uint8Array): MeasuredImage | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (at: number, len: number): string =>
    String.fromCharCode(...bytes.subarray(at, at + len));

  // PNG: \x89PNG\r\n\x1a\n then IHDR.
  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    ascii(1, 3) === "PNG" &&
    ascii(12, 4) === "IHDR"
  ) {
    return {
      format: "png",
      width: view.getUint32(16, false),
      height: view.getUint32(20, false),
      bytes: bytes.length,
    };
  }

  // WebP: "RIFF" ---- "WEBP" then a chunk tag.
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const tag = ascii(12, 4);
    if (tag === "VP8X") {
      // 24-bit little-endian, stored minus one.
      const w = 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16));
      const h = 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16));
      return { format: "webp", width: w, height: h, bytes: bytes.length };
    }
    if (tag === "VP8L") {
      // 14 bits each, minus one, packed little-endian after the 0x2f signature.
      const b = view.getUint32(21, true);
      return {
        format: "webp",
        width: 1 + (b & 0x3fff),
        height: 1 + ((b >> 14) & 0x3fff),
        bytes: bytes.length,
      };
    }
    if (tag === "VP8 " && bytes.length >= 30) {
      return {
        format: "webp",
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
        bytes: bytes.length,
      };
    }
  }
  return undefined;
}

/**
 * A content digest, for the identical-content check.
 *
 * FNV-1a rather than sha256, because this compares files **within one batch**
 * and never stores or publishes the value. A cryptographic digest here would
 * buy resistance to an adversary who is not in this threat model — the failure
 * being caught is an upload slip, where the same file was picked twice.
 */
export function contentDigest(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i += 1) {
    h ^= bytes[i]!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}-${bytes.length}`;
}

/** What {@link ingestThemeArt} needs besides the files. */
export interface ThemeArtIntakeInput {
  /** The image role the set will be declared under, e.g. `landing-engineer`. */
  role: string;
  candidates: readonly ArtCandidate[];
  /**
   * Where the files will live, relative to the instance root.
   *
   * Checked against {@link ThemeArtIntakeInput.declaredDirectories}: art that
   * lands outside a declared directory is a file nothing names, which is exactly
   * how three PNGs sat at the repository root unseen by every gate.
   */
  destinationDir: string;
  /** Declared directory paths, instance-relative. The instance's own declaration supplies these. */
  declaredDirectories: readonly string[];
  /** Extension for the emitted `src`; defaults to the candidate's measured format. */
  fileStem?: (role: string, layout: ThemeLayout) => string;
}

/**
 * Check a set of theme art, and emit its declaration or the reasons it was refused.
 *
 * Pure: it does no I/O and reads no clock, so a caller can test the refusal for
 * a file it never has to create.
 */
export function ingestThemeArt(input: ThemeArtIntakeInput): ThemeArtIntakeResult {
  const failures: ThemeArtFailure[] = [];
  const warnings: ThemeArtWarning[] = [];

  // 1. The destination must be inside something the instance declares. Checked
  //    FIRST, because art that passes every other check and lands nowhere named
  //    is the `0301fbd2` case: correct files, invisible to every gate.
  const dest = normaliseDir(input.destinationDir);
  const inDeclared = input.declaredDirectories.some((d) => {
    const nd = normaliseDir(d);
    return dest === nd || dest.startsWith(`${nd}/`);
  });
  if (!inDeclared) {
    failures.push({
      kind: "undeclared-destination",
      detail: `${input.destinationDir} is not inside any declared directory (${input.declaredDirectories.join(", ") || "none declared"})`,
      remedy:
        "write the art under a declared directory, or add the directory to the instance's `<name>.json` in the same change — a file nothing declares is a file no gate can see",
    });
  }

  // 2. Exactly one candidate per layout, and all three present.
  const byLayout = new Map<ThemeLayout, ArtCandidate[]>();
  for (const c of input.candidates) {
    const seen = byLayout.get(c.layout);
    if (seen) seen.push(c);
    else byLayout.set(c.layout, [c]);
  }
  for (const layout of THEME_ART_LAYOUTS) {
    const got = byLayout.get(layout) ?? [];
    if (got.length === 0) {
      failures.push({
        kind: "missing-layout",
        layout,
        detail: `no file offered for the ${layout} layout`,
        remedy: `supply all three layouts (${THEME_ART_LAYOUTS.join(", ")}) — an incomplete backdrop is refused wholesale by resolveThemeBackdrop, so the theme renders with NO art rather than with two thirds of it`,
      });
    } else if (got.length > 1) {
      failures.push({
        kind: "duplicate-layout",
        layout,
        detail: `${got.length} files offered for the ${layout} layout: ${got.map((g) => g.sourcePath).join(", ")}`,
        remedy: "offer exactly one file per layout; which of these was meant is not something intake can decide",
      });
    }
  }

  // 3. Measure, and check each file's shape against the layout it claims.
  const measured = new Map<ThemeLayout, MeasuredImage>();
  for (const [layout, group] of byLayout) {
    const c = group[0]!;
    const m = measureImage(c.bytes);
    if (!m) {
      failures.push({
        kind: "unreadable",
        layout,
        detail: `${c.sourcePath} is not a readable PNG or WebP`,
        remedy: `supply ${SUPPORTED_ART_FORMATS.join(" or ")} — intake reads dimensions from the header rather than accepting them, and cannot measure what it cannot parse`,
      });
      continue;
    }
    measured.set(layout, m);

    const band = LAYOUT_ASPECT_BANDS[layout];
    const aspect = m.width / m.height;
    if (aspect < band.min || aspect > band.max) {
      failures.push({
        kind: "wrong-orientation",
        layout,
        detail: `${c.sourcePath} is ${m.width}×${m.height} (aspect ${aspect.toFixed(2)}), outside the ${layout} band ${band.min}–${band.max}`,
        remedy: `crop for ${layout} rather than scaling another layout: a ${describeShape(band)} crop moves the quiet area the sticky's text sits in`,
      });
    }

    if (m.bytes > HEAVY_IMAGE_BYTES) {
      warnings.push({
        kind: "heavy",
        layout,
        detail: `${c.sourcePath} is ${Math.round(m.bytes / 1024)} KB, over the ${Math.round(HEAVY_IMAGE_BYTES / 1024)} KB budget`,
        remedy: `convert to ${PREFERRED_ART_FORMAT} — the measured gap between the two formats on this art was about 16×`,
      });
    }
    if (m.format !== PREFERRED_ART_FORMAT) {
      warnings.push({
        kind: "not-preferred-format",
        layout,
        detail: `${c.sourcePath} is ${m.format}`,
        remedy: `${PREFERRED_ART_FORMAT} is preferred; ${m.format} is accepted`,
      });
    }
  }

  // 4. No two layouts may be the same file. A refusal, not a warning: three
  //    layouts exist BECAUSE they are different crops, so the same bytes under
  //    two names means one of them is wrong and intake cannot tell which.
  const byDigest = new Map<string, ThemeLayout[]>();
  for (const [layout, group] of byLayout) {
    const d = contentDigest(group[0]!.bytes);
    const seen = byDigest.get(d);
    if (seen) seen.push(layout);
    else byDigest.set(d, [layout]);
  }
  for (const [, layouts] of byDigest) {
    if (layouts.length > 1) {
      failures.push({
        kind: "identical-content",
        detail: `${layouts.join(" and ")} are byte-identical`,
        remedy:
          "supply a distinct crop per layout — two of three files arriving identical is an upload slip, and intake cannot tell which layout is the one actually missing",
      });
    }
  }

  if (failures.length > 0) return { ok: false, failures, warnings };

  const stem = input.fileStem ?? ((role, layout) => `${role}-${layout}`);
  const images: ArtDeclaration[] = THEME_ART_LAYOUTS.map((layout) => {
    const m = measured.get(layout)!;
    return ArtDeclarationSchema.parse({
      role: input.role,
      layout,
      src: `${dest}/${stem(input.role, layout)}.${m.format}`,
      // MEASURED. The caller is never asked for these, and therefore cannot
      // supply the neighbour's numbers by mistake.
      width: m.width,
      height: m.height,
    });
  });
  return { ok: true, images, warnings };
}

/** A one-line report per finding — the "explanation of failure" the ask names. */
export function formatIntakeReport(result: ThemeArtIntakeResult, role: string): string {
  const lines: string[] = [];
  if (result.ok) {
    lines.push(`✓ ${role}: ${result.images.length} layouts accepted`);
    for (const i of result.images) lines.push(`  · ${i.layout} ${i.width}×${i.height} ${i.src}`);
  } else {
    lines.push(`✗ ${role}: refused, ${result.failures.length} problem(s)`);
    for (const f of result.failures) {
      lines.push(`  · [${f.kind}]${f.layout ? ` ${f.layout}:` : ""} ${f.detail}`);
      lines.push(`      → ${f.remedy}`);
    }
  }
  for (const w of result.warnings) {
    lines.push(`  ! [${w.kind}] ${w.layout}: ${w.detail}`);
    lines.push(`      → ${w.remedy}`);
  }
  return lines.join("\n");
}

/** Trailing slashes off, so `uploads` and `uploads/` are one path. */
function normaliseDir(p: string): string {
  return p.replace(/\/+$/, "");
}

function describeShape(band: { min: number; max: number }): string {
  if (band.max <= 1) return "portrait";
  if (band.min >= 1.2) return "landscape";
  return "square";
}
