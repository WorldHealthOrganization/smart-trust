/**
 * The id a BPMN `<process>` element declares — `Process_CRDM`,
 * `Process_Editing` — as a typed reference.
 *
 * A process is referred to by the id its diagram declares, which is what
 * BPMN's own `calledElement` names. Not the file stem (`crdm-requirements`),
 * which is {@link ProcessIdSchema} in `tool-types.ts` and names the DIAGRAM
 * FILE.
 *
 * A leaf module — zod only — so a schema low in the import graph
 * (`carried-note.ts`) can use it without reaching `cat-harness.ts`.
 * `process-refs.test.ts` resolves every committed reference against the ids
 * the loaded diagrams declare.
 *
 * @module schemas/process-element-id
 * @graphNode schema
 */
import { z } from "zod";

/** An XML NCName, as BPMN requires of an element id. */
export const ProcessElementIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z_][A-Za-z0-9_.-]*$/, "a BPMN process id is an XML name, e.g. Process_CRDM")
  .describe("A BPMN process element id, e.g. Process_CRDM");
