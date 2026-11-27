/**
 * The two records an upload writes: its intake and its Dublin Core record
 * (#1168 B6b-2, bean `d4lb`).
 *
 * Until then the upload handler wrote one untagged `intake.json` carrying
 * `classification`, `format`, and a `pipeline` / `chapters` / `blockCount` /
 * `targetPaper` block that was written once with its starting values and
 * never updated by anything. Now the description goes where descriptions
 * live — a `folio-dublin-core/v1` record beside the intake — and the intake is
 * `folio-intake/v1`, the same shape a hand-written capture has.
 *
 * | upload form field | Dublin Core |
 * |---|---|
 * | title | `dc.title` |
 * | type | `dc.type` |
 * | domain | `dc.subject` |
 * | normativeLevel | `dc.type.normativeLevel` — the owner's choice, 2026-09-24: qualified `dc.type`, since Dublin Core has no element for it |
 * | the detected format | `dc.format` |
 *
 * Both records are parsed by their schemas before they are returned, so the
 * adapter cannot write a file its own registry would reject.
 *
 * ## Why this still imports UP into `folio-assistant-core`, and what it waits on
 *
 * Bean `yj6r` is driving `cat-harness ->` sibling-layer imports to zero, and
 * this file's `schemas/dublin-core.js` import is one of the two that remain. The
 * bean's remedy is right and was not taken here, on measurement rather than
 * taste: the consumer moves UP, the schema stays — but this file's consumer is
 * `./index.js`, the 51 KB `DocumentContentAdapter`, and hoisting the leaf alone
 * only moves the same upward import onto a bigger file.
 *
 * Moving the whole of `adapters/document/` — which the partition rules already
 * classify `core` by prefix, and which `src/builtin-adapters.ts` already
 * declares `layer: "core"` — was measured instead of assumed, on 2026-09-30:
 *
 *     escapes removed by the move      2  (this file and its test)
 *     escapes CREATED by the move     15  (6 in adapters/paper/index.ts,
 *                                          9 across 6 scripts/tests/*.test.ts)
 *
 * so it takes the axis 2 -> 15, the wrong way, on the one measurement the bean
 * exists to drive. The reason is `adapters/paper/index.ts`: `PaperContentAdapter
 * extends DocumentContentAdapter` and pulls five of its tool registrars besides,
 * and `adapters/paper/` is declared `layer: "sci"` by `BUILTIN_ADAPTERS` — a
 * DIFFERENT layer again, one above this one. So the closure is a three-layer
 * move: `document/` up to the core layer's own `adapters/`, `paper/` up to the
 * science layer's, and six test files after their subjects — plus a newly
 * declared `adapters/` directory in each of those two targets and a re-pointed
 * `BUILTIN_ADAPTERS` table, whose `module` strings are resolved by VARIABLE path
 * against this layer's root. That is a tranche with its own ruling to ask
 * for, not a leaf edit, and doing half of it is strictly worse than doing none.
 *
 * (The layer names are deliberately not spelled out above.
 * `check:reference-direction` counts a file naming SEVERAL layers above it as
 * its failing criterion, and a note explaining an upward reference should not
 * itself become one.)
 *
 * Recorded here rather than only in the bean because this is the file the next
 * agent driving the axis opens first, and the cheap half-move is the one that
 * looks obvious from the cluster list alone.
 *
 * @module adapters/document/intake-records
 */
import { DUBLIN_CORE_SCHEMA_TAG, DublinCoreRecordSchema, type DublinCoreRecord } from "../../schemas/dublin-core.js";
import { INTAKE_SCHEMA_TAG, IntakeSchema, type Intake } from "@litlfred/cat-harness-tools/schemas/library/intake.js";

export interface UploadDescription {
  docId: string;
  title: string;
  type: string;
  domain?: string;
  normativeLevel?: string;
  format?: string;
  /** The URL it was fetched from; absent for a file uploaded directly. */
  upstream?: string;
  /** ISO 8601 — when the bytes arrived. */
  capturedAt: string;
  files: { path: string; bytes: number; sha256: string }[];
}

/** The Dublin Core record's filename, beside the intake. */
export const recordFileName = (docId: string): string => `${docId}.dc.json`;

const METHOD = "folio-assistant document adapter: the upload form";

export function uploadRecords(u: UploadDescription): { intake: Intake; record: DublinCoreRecord } {
  const field = (element: string, value: string | undefined, qualifier?: string) =>
    value ? [{ schema: "dc", element, ...(qualifier ? { qualifier } : {}), values: [{ value }] }] : [];
  const record = DublinCoreRecordSchema.parse({
    $schema: DUBLIN_CORE_SCHEMA_TAG,
    id: u.docId,
    fields: [
      ...field("title", u.title),
      ...field("type", u.type),
      ...field("type", u.normativeLevel, "normativeLevel"),
      ...field("subject", u.domain),
      ...field("format", u.format),
    ],
    provenance: { source: u.upstream ?? "upload", retrievedAt: u.capturedAt, method: METHOD },
  });
  const intake = IntakeSchema.parse({
    $schema: INTAKE_SCHEMA_TAG,
    doc_id: u.docId,
    record: recordFileName(u.docId),
    source: { ...(u.upstream ? { upstream: u.upstream } : {}), capturedAt: u.capturedAt, capturedBy: METHOD },
    files: u.files.map((f) => ({ ...f, type: "upload", role: "original-bitstream" })),
  });
  return { intake, record };
}
