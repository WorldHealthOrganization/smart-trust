/**
 * A Tool's id: lowercase letters, digits and hyphens. It is also the MCP tool
 * name stem and the name of the Tool's folder (`tool-folders.ts`).
 *
 * Its own module, importing nothing but zod, so a schema that NAMES a Tool —
 * a remote mount's chosen `tools` — can hold the same rule without importing
 * `tool.ts`, whose imports reach `cat-harness.ts`, which imports
 * `remote-mount.ts`: a cycle that leaves `MountDefaultsSchema` uninitialised
 * when it is read.
 *
 * @module schemas/tool-id
 * @graphNode none — one field rule of the Tool node, whose schema is `tool.ts`
 */
import { z } from "zod";

export const ToolIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9-]*$/, "a tool id is lowercase letters, digits and hyphens");
