/**
 * A recorded meeting or talk as a library entry, and its transcripts.
 *
 * Two records:
 *
 * - `recording.json` (`folio-recording/v1`) says what the recording is: its
 *   title, date and spoken language, and which bytes were looked at
 *   (`source`, the same `_tech_meta` block every rung writes). It is the
 *   entry's kind marker, as `referenced.json` is for a recorded source.
 * - `transcript/<lang>.json` (`folio-transcript/v1`) holds one transcript per
 *   language: the source-language transcript a recogniser produced, and each
 *   translation of it.
 *
 * ## A transcript is a narrative
 *
 * A transcript carries the narrative review state
 * (`schemas/content/narrative.ts`): who drafted it, and whether a human has
 * confirmed it. It is validated by parsing it AS a narrative (its segments
 * joined): anything written names its drafter, an agent names its model, and
 * only a human confirms.
 *
 * ## The recogniser is recorded, not inferred
 *
 * A source-language transcript names the recogniser that produced it: the
 * tool, its version, the model file and that file's sha256. The same audio
 * through a different model is a different transcript.
 *
 * ## A translation says what it was translated from
 *
 * `translated_from` names the source-language transcript's language and the
 * sha256 of that file's segments, so a translation of a since-corrected
 * transcript reads as stale. Segment timings are the source's, one for one:
 * a translation re-times nothing.
 *
 * @module schemas/library/recording
 * @graphNode schema
 */
import { z } from "zod";

import { AttributionSchema } from "../content/attribution.js";
import { LANGUAGE_TAG, NARRATIVE_STATES, NarrativeSchema } from "../content/narrative.js";
import { FileSourceSchema } from "./referenced-source.js";

export const RECORDING_SCHEMA_ID = "folio-recording/v1" as const;
export const TRANSCRIPT_SCHEMA_ID = "folio-transcript/v1" as const;

/** The entry's kind marker, beside `structure.json` and `referenced.json`. */
export const RECORDING_FILENAME = "recording.json" as const;
/** The directory that holds one transcript per language. */
export const TRANSCRIPT_DIR = "transcript" as const;

const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a sniffed mimetype that is a recording: audio or video. */
export function isRecordingMimetype(mime: unknown): boolean {
  return typeof mime === "string" && /^(audio|video)\//.test(mime);
}

export const RecordingSchema = z
  .object({
    $schema: z.literal(RECORDING_SCHEMA_ID),
    identity: z
      .object({
        title: z.string().min(1),
        /** The day it was recorded, as `YYYY-MM-DD`. */
        date: z.string().regex(DATE),
        /** The spoken language, BCP 47. The source-language transcript is `transcript/<language>.json`. */
        language: z.string().regex(LANGUAGE_TAG),
        /** Who speaks, as the recording's own metadata or the people in it name themselves. */
        speakers: z.array(z.string().min(1)).optional(),
      })
      .strict(),
    source: FileSourceSchema,
    /** Length in seconds, read by `ffprobe`, or null when nothing could read it. */
    duration_s: z.number().positive().nullable(),
  })
  .strict();
export type Recording = z.infer<typeof RecordingSchema>;

export const TranscriptSegmentSchema = z
  .object({
    start_ms: z.number().int().min(0),
    end_ms: z.number().int().min(0),
    text: z.string().min(1),
    /** Absent when the recogniser does not separate speakers. */
    speaker: z.string().min(1).optional(),
  })
  .strict()
  .refine((s) => s.end_ms >= s.start_ms, { message: "a segment ends before it starts", path: ["end_ms"] });
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export const RecogniserSchema = z
  .object({
    /** The Tool node that ran, e.g. `transcribe-whisper-cpp`. */
    tool: z.string().min(1),
    /** The tool's revision, e.g. a commit. */
    version: z.string().min(1),
    /** The model file, e.g. `ggml-base.bin`. */
    model: z.string().min(1),
    model_sha256: z.string().regex(SHA256),
    /** The command line, as run. */
    invocation: z.string().min(1).optional(),
  })
  .strict();

export const TranscriptSchema = z
  .object({
    $schema: z.literal(TRANSCRIPT_SCHEMA_ID),
    lang: z.string().regex(LANGUAGE_TAG),
    /** The sha256 of the recording this transcribes: `recording.json` `source.sha256`. */
    recording_sha256: z.string().regex(SHA256),
    /** Present on the source-language transcript only. */
    recogniser: RecogniserSchema.optional(),
    /** Present on a translation only. */
    translated_from: z
      .object({
        lang: z.string().regex(LANGUAGE_TAG),
        /** sha256 of {@link segmentsCanonical} of the source transcript's segments when this was translated. */
        segments_sha256: z.string().regex(SHA256),
      })
      .strict()
      .optional(),
    state: z.enum(NARRATIVE_STATES),
    drafted_by: AttributionSchema.optional(),
    drafted_at: z.string().optional(),
    confirmed_by: AttributionSchema.optional(),
    confirmed_at: z.string().optional(),
    rejected_by: AttributionSchema.optional(),
    rejected_at: z.string().optional(),
    rejection_reason: z.string().min(1).optional(),
    segments: z.array(TranscriptSegmentSchema).min(1),
  })
  .strict()
  .refine((t) => (t.recogniser === undefined) !== (t.translated_from === undefined), {
    message: "a transcript names its recogniser, a translation names what it was translated from: exactly one",
    path: ["recogniser"],
  })
  .refine((t) => t.translated_from === undefined || t.translated_from.lang !== t.lang, {
    message: "a translation is into another language than its source",
    path: ["translated_from", "lang"],
  })
  .refine((t) => t.segments.every((s, i) => i === 0 || s.start_ms >= t.segments[i - 1]!.start_ms), {
    message: "segments are in time order",
    path: ["segments"],
  })
  .superRefine((t, ctx) => {
    // The narrative's own rules, by parsing the transcript as one.
    const r = NarrativeSchema.safeParse(asNarrative(t));
    if (!r.success) for (const i of r.error.issues) ctx.addIssue({ ...i, path: i.path });
  });
export type Transcript = z.infer<typeof TranscriptSchema>;

/** The transcript read as a narrative: its segments' text, joined. */
export function asNarrative(t: Pick<Transcript, "lang" | "state" | "segments"> & Record<string, unknown>) {
  const { $schema: _s, recording_sha256: _r, recogniser: _g, translated_from: _f, segments, ...review } = t;
  return { ...review, text: segments.map((s) => s.text.trim()).join(" ") };
}

/**
 * What a transcript says and when, as one string: each segment's start, end
 * and text, as compact JSON. A translation records the sha256 of this for its
 * source (`translated_from.segments_sha256`), so a corrected source makes its
 * translations stale. Hashing is left to the caller, which has a hash.
 */
export function segmentsCanonical(segments: readonly TranscriptSegment[]): string {
  return JSON.stringify(segments.map((s) => [s.start_ms, s.end_ms, s.text]));
}
