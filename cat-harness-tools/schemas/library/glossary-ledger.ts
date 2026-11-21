/**
 * The swimlane glossary's retirement ledger: its tag and its shape.
 *
 * @module schemas/glossary-ledger
 * @graphNode schema
 *
 * Harness state: `glossary-export` writes it and it is hosted in cat-harness
 * (`glossaryHomeFor`). A role's own names are authored on the role
 * (`otherNames`, `formerNames`). The old tag `folio-glossary-ledger/v1` is
 * still accepted on read, so a dependent instance's committed ledger is not
 * refused.
 */
import { z } from "zod";

/** The schema's name and its own semver; a reader accepts any tag of the same MAJOR version. */
export const LEDGER_SCHEMA_NAME = "glossary-ledger";
export const LEDGER_SCHEMA_VERSION = "1.0.0";
export const LEDGER_SCHEMA = `${LEDGER_SCHEMA_NAME}/${LEDGER_SCHEMA_VERSION}`;
/** The tag before 2026-09-29. Read, never written; drop after one release. */
export const LEGACY_LEDGER_SCHEMA = "folio-glossary-ledger/v1";

/**
 * The form of a ledger key: the term IRI's local part, as the knowledge-graph
 * export mints it (#1168 B10b, owner 2026-09-30: "BPMN id + pattern" and a QA
 * gate). A role is `role/<role id>`; a lane whose performer varies is
 * `process/<bpmn:process id>/lane/<bpmn:lane id>` — the Lane node's own
 * identity in kg-export — never its display name, so renaming a lane does
 * not mint a new term: the old name becomes a `formerLabels` entry.
 *
 * Since work item folio-assistant-dkqd (2026-11-04) the glossary also defines
 * the words for what a harness keeps: a graph kind is `kind/<kind word>`, a
 * node kind `node-kind/<kind id>`, and the harness itself `harness/<name>`.
 */
export const LEDGER_KEY =
  /^(?:role\/[a-z0-9][a-z0-9-]*|process\/[A-Za-z_][\w.-]*\/lane\/[A-Za-z_][\w.-]*|(?:kind|node-kind|harness)\/[a-z][a-z0-9-]*)$/;

export const LedgerEntrySchema = z.object({
  prefLabel: z.string().describe("The current label — what the term is shown as, and what a retired term keeps."),
  formerLabels: z
    .array(z.string())
    .optional()
    .describe("Labels this key carried before, oldest first — published as skos:hiddenLabel, so the old name still finds the term."),
  firstSeen: z.string().describe("ISO date this key was first written."),
  retiredOn: z.string().nullable().describe("ISO date it stopped being used, or null while it still is."),
});

export const LedgerSchema = z.object({
  // Only the new tag: the old one is accepted by `readLedger` alone, so the
  // schema bootstrap publishes never states a platform name.
  $schema: z.literal(LEDGER_SCHEMA),
  instance: z.string().min(1).describe("Which Knowledge Graph's glossary this is: its name, never a path."),
  concepts: z
    .record(z.string().regex(LEDGER_KEY, "a ledger key is role/<id>, process/<process id>/lane/<lane id>, kind/<kind>, node-kind/<kind> or harness/<name>"), LedgerEntrySchema)
    .describe("Keyed by the term IRI's local part, never the absolute IRI, so the file survives a change of address."),
});
