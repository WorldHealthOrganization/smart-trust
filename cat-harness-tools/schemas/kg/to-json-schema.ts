/**
 * JSON Schema conversion — one wrapper over zod 4's native `z.toJSONSchema`.
 *
 * `zod-to-json-schema` reads zod 3's internal `_def` shape; under zod 4 it
 * silently returns `{ "$schema": … }` and nothing else. `z.toJSONSchema` emits
 * full `properties`, `required`, `additionalProperties: false` for strict
 * objects, and inlines shared definitions under `reused: "inline"`. One
 * difference from older published documents: `z.string().datetime()` gains a
 * `pattern` beside its `format`, so the schema enforces what it previously
 * only annotated.
 *
 * ## `named`
 *
 * `named` reproduces the old `zodToJsonSchema(S, { name })` output,
 * `{ $ref: "#/definitions/<name>", definitions: { <name>: … } }`, once here
 * rather than at each call site, since the shape is part of a published
 * document.
 *
 * @graphNode none — a function library. It defines no schema of its own; it
 * CONVERTS schemas defined elsewhere, so it has nothing to contribute to the
 * published graph and a node for it would describe a verb rather than a type.
 */
import { z } from "zod";

/** Convert, inlining every shared definition. */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema, { io: "input", reused: "inline" }) as Record<string, unknown>;
}

/**
 * Convert and wrap under `definitions`, as `zodToJsonSchema`'s `name` option
 * did. The `$ref` is what a consumer dereferences, so the two keys travel
 * together or the document is unresolvable.
 */
export function namedJsonSchema(schema: z.ZodType, name: string): Record<string, unknown> {
  const body = toJsonSchema(schema);
  delete body.$schema;
  return { $ref: `#/definitions/${name}`, definitions: { [name]: body } };
}
