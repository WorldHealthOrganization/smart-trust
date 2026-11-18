/**
 * What a Tool is.
 *
 * A **skill** states a capability generically; a **Tool** is one concrete way
 * to exercise it, and names the skills it satisfies. That separation is the
 * SOP in `skills/tools/folio-core/skills-and-tools.md`; this schema makes it
 * checkable.
 *
 * ## Authoritative, and the only authority
 *
 * Zod here, JSON Schema and JSON-LD generated from it — the carrier decision in
 * `skills/kg/kg-core/directory-conventions.md` §"What lives in the `schemas`
 * graph". The TypeScript type is `z.infer`, never declared alongside.
 *
 * ## Three constraints
 *
 * **1. `invoke` must offer an arm the harness can run.** `agentic-harness`
 * assumes no MCP server, so a Tool whose only invocation is `invoke.mcp` is not
 * usable by the layer that defines it — and would also make the MCP projector
 * emit a server that proxies itself. It is rejected at parse time.
 *
 * **2. `io.*.schema` is an absolute IRI**, not a bare string. A relative
 * reference resolves differently depending on where a consumer fetched the
 * Tool. Absolute or nothing — the same rule `kg-export` follows for `@id` and
 * `harness-schema-export` for `$id`.
 *
 * **3. `satisfies` must be non-empty.** A Tool that satisfies no skill is a
 * mechanism nothing asks for. Whether the named skills *exist* is checked by
 * `scripts/check-tools.ts`, which resolves them against the real skill
 * locations.
 *
 * @module schemas/tool
 * @graphNode schema
 */
import { z } from "zod";

import { ToolIdSchema } from "./tool-id.js";
import { ProcessIdSchema, SkillNameSchema } from "./tool-types.js";

/** A lowercase, hyphenated id; `tool-id.ts` says why it is its own module. */
const ToolId = ToolIdSchema;
export { ToolIdSchema };

/**
 * An absolute IRI naming the schema of one input or output.
 *
 * Absolute is the point — see the module note. `zod-to-json-schema` renders
 * `.url()` as `"format": "uri"`, so the constraint survives into the JSON
 * Schema rendering rather than living only in the Zod.
 */
const SchemaRef = z.string().url("io schema references must be absolute IRIs");

export const ToolPortSchema = z.object({
  name: z.string().min(1),
  schema: SchemaRef,
  description: z.string().optional(),
});

/**
 * How a renderer may put one OUTPUT into a page — bean `q2wm`, R17 (#602).
 *
 * The owner, 2026-09-20: *"skill tool hints for XSS restriction"*. A Tool node
 * said nothing about whether its output is markup, a link or plain words, so
 * every consumer decided — and the one that decides wrong is a cross-site
 * scripting hole in a static site with no server to blame.
 *
 * | `as` | a renderer must |
 * |---|---|
 * | `text` (the DEFAULT, and what absent means) | escape it: never markup, never a link |
 * | `url` | pass it through `safeHref` (default-deny on scheme) before any `href`, else render it as text |
 * | `markdown` | render it with raw HTML OFF and every link through `safeHref` |
 * | `json` | show it escaped, as data — never evaluate, never inject |
 *
 * ON THE OUTPUT, not the Tool: one tool may emit a JSON projection and a
 * markup fragment, and a Tool-level flag would have to lie about one of them.
 *
 * Anything but `text` carries a `reason`, because it asks a renderer to do
 * more than escape, and that is a claim somebody made. `url` and `markdown`
 * are allowed only on an output whose schema IS `Url` / `Markdown` — a hint
 * that disagrees with the type it describes is two answers to one question.
 *
 * `renderToolOutput` in `schemas/ui/render-output.ts` is the one implementation;
 * `render-output.test.ts` holds each row of the table above to it.
 */
export const RENDER_AS = ["text", "url", "markdown", "json"] as const;
export type RenderAs = (typeof RENDER_AS)[number];

export const ToolRenderSchema = z
  .object({
    as: z.enum(RENDER_AS),
    reason: z.string().min(1).optional(),
  })
  .strict()
  .refine((r) => r.as === "text" || r.reason !== undefined, {
    message: "a render hint other than `text` must state its reason — it asks a renderer to do more than escape",
  });
export type ToolRender = z.infer<typeof ToolRenderSchema>;

/**
 * The last segment of a schema IRI — `…#Url`, `…/Url` and the per-type
 * document `…/tool-types/Url.schema.json` (bean `tdir`) all give `Url`.
 */
export function schemaTypeName(iri: string): string {
  return (iri.split(/[#/]/).filter(Boolean).pop() ?? iri).replace(/\.schema\.json$/, "");
}

/** A schema type a hint may only be declared on, where it is restricted. */
const RENDER_REQUIRES: Partial<Record<RenderAs, string>> = { url: "Url", markdown: "Markdown" };

export const ToolOutputSchema = ToolPortSchema.extend({
  /** How a renderer may place this output in a page. Absent is `text`. See {@link RENDER_AS}. */
  render: ToolRenderSchema.optional(),
}).superRefine((p, ctx) => {
  const need = p.render ? RENDER_REQUIRES[p.render.as] : undefined;
  if (need !== undefined && schemaTypeName(p.schema) !== need) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["render", "as"],
      message: `render \`${p.render!.as}\` is only for an output whose schema is ${need}; this one is ${schemaTypeName(p.schema)}`,
    });
  }
});
export type ToolOutput = z.infer<typeof ToolOutputSchema>;

/**
 * How one input appears on the command line.
 *
 * **Explicit, per input — never a template and never a convention.** The
 * alternatives were an argv template with `{name}` placeholders, and a rule that
 * every input becomes `--name value`. The template needs substitution, which is
 * the string manipulation this project keeps removing and which fails silently
 * when an optional input is absent (a literal brace in argv). The convention
 * needs a rule every author and reader must know, cannot express a positional,
 * and breaks the moment a flag differs from its input name.
 *
 * This way a reader of the Tool node can see the invocation without running it.
 */
export const ToolArgSchema = z.union([
  z.object({ flag: z.string().regex(/^--?[A-Za-z0-9][A-Za-z0-9-]*$/, "a flag looks like --name or -n") }),
  z.object({ positional: z.number().int().nonnegative() }),
  /** Passed on stdin rather than as a word. The only home for free prose. */
  z.object({ stdin: z.literal(true) }),
]);

export const ToolInputSchema = ToolPortSchema.extend({
  /** Whether a caller must supply it. Explicit, never inferred from a default. */
  required: z.boolean(),
  /**
   * The input is a **list** of the named type rather than one value.
   *
   * ## Why cardinality is a flag and not a type
   *
   * Three of the tools this layer serves take lists — `folio_init.authors`,
   * `stakeholder_map.paths`, `readme_sync.only` — so without this the migration
   * could not describe the surface it was migrating. The alternative was an
   * `ArrayOfRepoPath` beside `RepoPath` in the shared vocabulary, which
   * multiplies the `$defs` by the number of types and, worse, breaks the
   * identity property `tool-types` exists for: two tools taking "a list of repo
   * paths" would have to agree on a *second* name as well as the element one.
   *
   * ## What it means for injection safety
   *
   * Nothing changes, and that is the point. Each element is parsed by the
   * element schema, so a list of an injection-safe type cannot contain an
   * element that is a payload — the element type already made that
   * unrepresentable. `scripts/check-tools.ts` therefore asks the same question
   * of a repeated input as of a scalar one, and needs no new case.
   *
   * ## How it projects
   *
   * A repeated `flag` emits the flag once per element (`--author A --author B`),
   * never one comma-joined word: joining would invent a separator the tool never
   * agreed to and would make a value containing that separator ambiguous. A
   * repeated `positional` emits the elements as trailing words, so at most one
   * repeated positional can appear and it must be last.
   */
  repeated: z.boolean().optional(),
  /**
   * Where this input goes when the tool is invoked. Absent means the input is
   * part of the contract but not passed on the command line — a Tool invoked
   * `manual`ly or `inProcess` has no command line at all.
   */
  arg: ToolArgSchema.optional(),
}).refine((i) => !(i.repeated === true && i.arg !== undefined && "stdin" in i.arg), {
  message: "a repeated input cannot be passed on stdin — stdin is one stream, not a list",
  path: ["repeated"],
});

/**
 * How to obtain the tool. Every arm optional, because a tool may be present
 * already — `beans-manual` needs no install at all, which is a fact about it
 * rather than a gap in its record.
 */
export const ToolInstallSchema = z.object({
  cli: z.string().optional(),
  container: z.string().optional(),
  service: z.string().optional(),
  /** Nothing to install. Stated, so "absent" and "not needed" are distinct. */
  none: z.literal(true).optional(),
});

/**
 * How to run it.
 *
 * `mcp` is one arm among three and never the only one — see the module note
 * and the refinement on the schema below.
 */
export const ToolInvokeSchema = z.object({
  /**
   * The command a caller types, from the repository root.
   *
   * When the command is code of a layer ABOVE the one defining the Tool, it is
   * named by a script KEY, `bun run cat <key> [args…]`, and the implementing
   * layer declares the command for that key in its `package.json`
   * `checkoutScripts` (`schemas/sdlc/script-table.ts`). Owner, 2026-10-15 ("J2"):
   * the definition never names the layer above it, and the key is resolved
   * from that declaration when the command runs.
   */
  shell: z.string().optional(),
  container: z.string().optional(),
  mcp: z.object({ tool: z.string().min(1) }).optional(),
  /**
   * A function in **this layer's own code**.
   *
   * Added because 17 of the 20 tools this repository already serves have no
   * shell equivalent — they are TypeScript registered on the MCP server, and
   * without this arm they cannot be expressed as Tool nodes at all.
   *
   * ## Why the mcp-only refusal does not apply
   *
   * That refinement exists because a Tool reachable only over MCP is not
   * runnable by the harness and projecting it would emit a server that proxies
   * itself. An in-process function is the opposite case on both counts: the
   * harness can call it directly with no server at all, and it is the
   * projection **source** rather than something to proxy. `src/server.ts`
   * already does exactly this projection by hand.
   *
   * `module` locates the code; it is NOT a unique key, because one module
   * registers several tools (`workflow.ts` registers five). The Tool's `id` is
   * the key, and it is the MCP name the module registers.
   */
  inProcess: z
    .object({
      /**
       * INSTANCE-relative path to the module, e.g. `src/tools/workflow.ts`.
       *
       * The layer, not the repository — this said "repo-relative" while giving
       * an example that is instance-relative, and after the move under
       * `cat-harness/` the two stopped being the same thing. The values were
       * right and the word was stale; `check:tools` now resolves this field
       * against the layer root and `invoke.shell` against the repository,
       * because a shell command is typed from the repo root while a module is
       * loaded by the layer's own server. Same convention as
       * `maintains.source`.
       */
      module: z.string().min(1),
      /** The registrar export, when the module has more than one. */
      register: z.string().min(1).optional(),
    })
    .optional(),
  /**
   * The tool is performed by a person following the skill, with no command.
   * `beans-manual` is the case: editing a bean's front matter by hand is a real
   * mechanism with equal standing to the CLI, and modelling it as an absent
   * `shell` would have made it indistinguishable from an unfinished record.
   */
  manual: z.literal(true).optional(),
});

export const ToolRequiresSchema = z.object({
  os: z.array(z.string()).optional(),
  runtime: z.array(z.string()).optional(),
  network: z.boolean().optional(),
});

/**
 * What to reach for when a host this Tool needs refuses it.
 *
 * ## The failure this exists for — bean `6mk7`
 *
 * 2026-10-06: packages.fhir.org was refused, SUSHI could not resolve its
 * dependencies, and the agent concluded SUSHI could not run here.
 * `fhir-cache-seed-npm` existed for exactly that refusal and had for five
 * days; its `selection.when` even said so. Nothing led from the SYMPTOM to it:
 * `selection` is read by an agent already choosing among a skill's Tools,
 * and an agent looking at a refused host is not choosing — it is stuck.
 * The owner's ruling the same day: a field keyed by the host or error, and a
 * gate keeping it non-empty for every network-dependent Tool.
 *
 * ## Why it sits on the Tool that NEEDS the host
 *
 * The dependent holds the pointer, as `satisfies` and `subprocesses` do. A
 * Tool that reaches a host is the one that knows it does, and it is where the
 * gate can ask the question: `requires.network: true` and no `remedies` is a
 * finding (`check:tools`). Declaring remedies on the REMEDY instead would
 * leave every host nobody has a workaround for undeclared, and the absence
 * would look exactly like the gap that caused 6mk7.
 *
 * ## `none` is a value, stated
 *
 * Most refusals have no workaround — a GitHub Pages push needs GitHub. Saying
 * so, with the reason, is the answer an agent needs as much as a Tool id: it
 * stops the agent hunting. Same reason `install.none` and `selection.limits`
 * must be stated rather than omitted.
 *
 * Looked up by {@link remediesFor} and `bun run cat tools:remedy <host|error>`.
 */
export const ToolRemedySchema = z
  .object({
    /** The host this Tool reaches, as it appears in a refusal — `packages.fhir.org`. */
    host: z.string().regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/, "a bare host name, no scheme or path"),
    /** Text an agent sees when the host refuses, if it does not name the host — matched as a substring. */
    error: z.string().min(1).optional(),
    /** The declared Tool that does the job without this host. `check:tools` resolves it. */
    tool: ToolId.optional(),
    /** Stated: no Tool works around this refusal, and why — or what to do instead. */
    none: z.string().min(1).optional(),
  })
  .refine((r) => (r.tool === undefined) !== (r.none === undefined), {
    message: "a remedy names exactly one of `tool` (the Tool that works without this host) or `none` (stated: no workaround, and why)",
  });

export type ToolRemedy = z.infer<typeof ToolRemedySchema>;

/**
 * A published artefact this Tool is AUTHORITATIVE for, and the source it is
 * generated from.
 *
 * ## The relation this exists to declare
 *
 * The owner's requirement, 2026-09-18: *"the zod(.ts) should be tool KG nodes
 * that implement maintaining a json-ld/json schema for public authoritative …
 * it is the CODING convention of cat-harness that the zod/.ts toolchain is
 * used to maintain INTERNAL the json schema"* — with the split *"external =
 * the JSON-LD is definitional. internal = zod/typescript is definitional and
 * json-ld is downstream."*
 *
 * That relation was real and written down nowhere a consumer could read it.
 * `scripts/harness-schema-export.ts` knew that `schemas/kg/cat-harness.ts`
 * produces `<stub>.schema.json`, `schemas/tools/tool.ts` produces
 * `tool.schema.json` and `schemas/tools/tool-types.ts` produces
 * `tool-types.schema.json` — three facts living in one script's local array.
 * A reader of the published graph could not get from a schema module to the
 * artefact it defines, or back.
 *
 * ## Why `source` is a path and `artefact` is not
 *
 * `source` is repo-relative and stable: it names a file in the tree the graph
 * describes. `artefact` is the PUBLISHED path relative to the layer's base,
 * because the base differs per deployment — main, a branches/ preview, a local
 * checkout — and baking one in would make the node wrong everywhere else.
 * `renderingPath()` in `schemas/kg/cat-harness.ts` is what joins the two, and is
 * the single place that knows the layout.
 *
 * ## Declared, then checked both ways
 *
 * `harness-schema-export --check` verifies every declared artefact is actually
 * produced AND every produced artefact is declared. One direction alone is
 * half a guarantee: the first catches a declaration that rotted, the second
 * catches a new artefact nobody declared — which is how the relation drifts
 * back into the script.
 */
export const ToolMaintainsSchema = z.object({
  /** Repo-relative module that defines it, e.g. `schemas/tools/tool.ts`. */
  source: z.string().min(1),
  /**
   * Published path relative to the layer's base, e.g. `tool.schema.json`.
   * No leading slash: it is joined by `renderingPath`, which owns the layout.
   */
  artefact: z.string().min(1).refine((a) => !a.startsWith("/"), {
    message: "artefact is relative to the instance base — a leading slash names the domain root",
  }),
  /**
   * What the artefact IS, for a consumer deciding whether it can read it.
   * Open string: a layer may maintain kinds this vocabulary has not met.
   */
  format: z.string().min(1).optional(),
});

export type ToolMaintains = z.infer<typeof ToolMaintainsSchema>;

/**
 * A DOWNSTREAM output this Tool keeps current, the inputs it is derived from,
 * and where its run outcome can be judged.
 *
 * ## Why this exists
 *
 * Bean `fq5u`, owner 2026-09-29: *"how do we know tools like LSI are run
 * succesfully... not primary to pieple, but downstream. should be part of QA
 * process (dependences = stall QA)"*. A downstream tool's failure was
 * invisible: nothing recorded that it ran — for LSI, only whether its corpus
 * had moved since. The declaration is what makes a Tool a member of the
 * `tool-downstream-fresh` criterion family (`schemas/tools/tool-run.ts`), which
 * reads three states and never renders the absence of a run as green.
 *
 * ## Why this is not `maintains`
 *
 * `maintains` names a PUBLISHED artefact and `check:maintained-artefacts`
 * looks for it in the assembled `_site/`. A downstream output is often not
 * published at all — LSI's index is a committed sidecar under `test/results/`
 * — so folding it into `maintains` would send that check looking for a file
 * the site never carries. They answer different questions: "is the published
 * artefact present" and "did the run that keeps this output current succeed
 * against the current inputs".
 *
 * ## `judgedAt` — the third state, named
 *
 * `checkout`: the Tool writes a `folio-tool-run/v1` record and the audit
 * compares its input fingerprint with the current one. `published`: the output
 * exists only in an assembled site (the search index Jekyll writes), so from a
 * checkout the verdict is `unknown` naming `verifier` — the entry in
 * `publish-verify`'s set that answers it before deployment. Never `pass`.
 */
export const ToolDownstreamSchema = z
  .object({
    /** What the Tool keeps current — repo-relative for `checkout`, site-relative for `published`. */
    output: z.string().min(1),
    /** What it is derived from, so a reader can see what makes it stale. */
    inputs: z.array(z.string().min(1)).min(1),
    judgedAt: z.enum(["checkout", "published"]),
    /** `published` only: the `publish-verify` verifier id that judges the output. */
    verifier: z.string().min(1).optional(),
  })
  .refine((d) => d.judgedAt !== "published" || d.verifier !== undefined, {
    message: "a downstream output judged only in the published tree must name the verifier that judges it",
  });

export type ToolDownstream = z.infer<typeof ToolDownstreamSchema>;

/**
 * Why an agent would reach for THIS Tool rather than a substitutable sibling.
 *
 * ## Why this is not `description`
 *
 * `description` is projected VERBATIM as the MCP tool description
 * (`src/mcp/project.ts`) and into the exported graph (`kg-export.ts`). It
 * answers "what does this do", which is what a caller needs at the moment of
 * calling. Comparative prose — what it costs to have installed, what it cannot
 * do, which sibling covers the rest — is noise there, and putting it there
 * would degrade the surface an LLM reads when choosing among tools.
 *
 * ## Why all three fields are required together
 *
 * A selection record with only `when` is half an answer: it tells an agent to
 * reach for this tool without telling it where the tool stops, so the agent
 * discovers the boundary by failing. `limits` is where a sibling gets named,
 * and it must be STATED even when it is "none" — the same reason
 * `install.none` exists, so "no limits" is distinguishable from an unfinished
 * record.
 *
 * `cost` is not `install`. `install` says how to obtain the tool; `cost` says
 * what having it costs — CI minutes, a wheel that needs a C toolchain, a
 * network round trip. Two tools can be equally easy to install and very
 * differently expensive to keep.
 */
export const ToolSelectionSchema = z.object({
  /** The case this Tool is the right answer to. */
  when: z.string().min(1),
  /** Where it stops, and which sibling picks up — "none" is a real value, stated. */
  limits: z.string().min(1),
  /** What having it available costs. Distinct from `install`; see above. */
  cost: z.string().min(1),
});

export type ToolSelection = z.infer<typeof ToolSelectionSchema>;

export const ToolDefinitionSchema = z
  .object({
    id: ToolId,
    title: z.string().min(1),
    description: z.string().min(1),
    install: ToolInstallSchema,
    invoke: ToolInvokeSchema,
    io: z.object({
      inputs: z.array(ToolInputSchema),
      outputs: z.array(ToolOutputSchema),
    }),
    /** Skills this Tool can satisfy. One skill may have several Tools. */
    satisfies: z.array(SkillNameSchema).min(1, "a Tool must satisfy at least one skill"),
    // No `alternativeTo` (#1168, B9a). Which Tools are alternatives is DERIVED
    // — see `deriveAlternatives` below — so no Tool names another. Owner,
    // 2026-09-30: *"why tools need alternativeTo? skills and tools are
    // associated, the alternatives should be derivable"*.
    /**
     * Why to reach for this one. REQUIRED when the Tool has a derived
     * alternative ({@link deriveAlternatives}); `check-tools` enforces it,
     * since whether a Tool has one is a fact about the whole set.
     */
    selection: ToolSelectionSchema.optional(),
    requires: ToolRequiresSchema.optional(),
    /**
     * One entry per host this Tool reaches, saying what to do when it is
     * refused. See {@link ToolRemedySchema}. REQUIRED non-empty when
     * `requires.network` is true; `check:tools` enforces it, and resolves
     * every `tool` it names.
     */
    remedies: z.array(ToolRemedySchema).optional(),
    /**
     * Published artefacts this Tool is authoritative for. See
     * {@link ToolMaintainsSchema}.
     *
     * Optional because most Tools maintain nothing — they DO something. A Tool
     * that maintains an artefact is the specific case the owner asked for: a
     * zod module whose job is to keep a public JSON Schema true.
     */
    maintains: z.array(ToolMaintainsSchema).optional(),
    /**
     * A downstream output this Tool keeps current, with its declared inputs.
     * See {@link ToolDownstreamSchema}. Optional because most Tools keep no
     * derived output; a run record or a publish verifier naming a Tool that
     * does not declare one is a finding (`downstream-tool-declared`).
     */
    downstream: ToolDownstreamSchema.optional(),
    /**
     * The graph TYPOLOGIES this Tool draws a viewer for — one page per declared
     * directory of the kind, placed by the Tool itself.
     *
     * #1168 B7a, owner 2026-09-24 (*"viz scripts become Tools"*): until then
     * each directory named its viewer page (`coverage.visualiser`), which is
     * the directory pointing at what depends on it. The dependent holds the
     * pointer, so the renderer says what it renders. A kind, not a list of
     * pages, because which directories exist is the declarations' answer and
     * a Tool restating it would be a second list free to drift.
     */
    renders: z.array(z.string().min(1)).optional(),
    /**
     * Process ids of the BPMN this Tool's OWN specific procedure is drawn as.
     *
     * Owner, 2026-09-30 (placement ruling 6): *"in general tools can describe
     * their own specific subprocesses if needed to not bog down general
     * skills"*. A skill states a capability generically; the steps that are
     * true of ONE way of exercising it — this tool's retries, its staging
     * directory, its two-pass mode — belong to the Tool, not to the skill
     * every other Tool also satisfies. So the Tool points at its
     * subprocess, the way it points at the skills it `satisfies`: the
     * dependent holds the pointer, and the general process calls the
     * subprocess (`calledElement`) only where it chose this Tool.
     *
     * Each id is the stem of a `.bpmn` the checkout declares;
     * `check:tools` reports one that resolves to nothing. By convention it
     * lives under the declaring layer's `processes/tools/` concern group
     * (placement PR0c), beside the other tools' procedures rather than
     * among the general processes.
     */
    subprocesses: z.array(ProcessIdSchema).optional(),
  })
  .refine(
    (t) =>
      t.invoke.shell !== undefined ||
      t.invoke.container !== undefined ||
      t.invoke.inProcess !== undefined ||
      t.invoke.manual === true,
    {
      message:
        "invoke needs an arm the harness can run (shell, container, inProcess or manual). " +
        "A Tool reachable only over MCP is not usable by the harness that defines it, " +
        "and projecting it would emit a server that proxies itself. An inProcess function " +
        "is not that case: the harness calls it directly, and it is the projection source.",
      path: ["invoke"],
    },
  );

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ToolInput = z.infer<typeof ToolInputSchema>;
export type ToolPort = z.infer<typeof ToolPortSchema>;

/**
 * Build and validate a Tool node.
 *
 * Tool nodes are authored as `.ts` calling this, so a malformed one fails at
 * `tsc` and in the editor rather than at CI. That is the whole argument for the
 * carrier decision, applied to layers as well as to the schema.
 */
export function defineTool(t: ToolDefinition): ToolDefinition {
  return ToolDefinitionSchema.parse(t);
}

// ─── Alternatives, derived ───────────────────────────────────────────────────

/**
 * What a Tool IS, as far as substituting one for another goes: its full I/O
 * signature and the things it renders and maintains. Two Tools with the same
 * signature take the same inputs, produce the same outputs, and act on the
 * same artefacts — they differ only in mechanism.
 */
export function toolSignature(t: Pick<ToolDefinition, "io" | "renders" | "maintains">): string {
  return JSON.stringify({
    in: t.io.inputs.map((i) => [i.name, i.schema, i.required ?? false]).sort(),
    out: t.io.outputs.map((o) => [o.name, o.schema]).sort(),
    renders: [...(t.renders ?? [])].sort(),
    maintains: (t.maintains ?? []).map((m) => JSON.stringify(m)).sort(),
  });
}

/**
 * The Tools that do the same job by a different mechanism, derived rather
 * than declared (#1168, B9a).
 *
 * Two Tools are alternatives iff they satisfy a common skill AND have the same
 * {@link toolSignature}, and that signature is not empty.
 *
 * Sharing a skill is not enough, and the declared field existed because of
 * that: measured 2026-09-20, most skills with several Tools have COMPLEMENTARY
 * ones — `workflow-start` and `workflow-next` are two steps of one skill, not
 * two ways to do one step. What separates them is the signature: steps take
 * and give different things. Measured 2026-09-30 over 118 Tools, the rule
 * recovers every pair that had been declared by hand and nothing else, once
 * three Tools whose inputs were typed more loosely than what they read were
 * given the precise type.
 *
 * An empty signature is excluded because it says nothing: two Tools that
 * declare no ports would otherwise be interchangeable by default.
 *
 * Symmetric by construction, so there is nothing to keep in step.
 */
export function deriveAlternatives(tools: readonly ToolDefinition[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const sig = new Map(tools.map((t) => [t.id, toolSignature(t)]));
  for (const a of tools) {
    if (a.io.inputs.length + a.io.outputs.length === 0) continue;
    const alts = tools
      .filter((b) => b.id !== a.id && sig.get(b.id) === sig.get(a.id) && b.satisfies.some((s) => a.satisfies.includes(s)))
      .map((b) => b.id)
      .sort();
    if (alts.length > 0) out.set(a.id, alts);
  }
  return out;
}

/**
 * Tools with a derived alternative and no `selection` — a choice a reader can
 * see and cannot make. A fact about the whole set, so `check-tools` asks it
 * here rather than the schema asking it of one node.
 */
export function alternativesWithoutSelection(tools: readonly ToolDefinition[]): Array<{ tool: string; alternatives: string[] }> {
  const alts = deriveAlternatives(tools);
  return tools
    .filter((t) => alts.has(t.id) && t.selection === undefined)
    .map((t) => ({ tool: t.id, alternatives: alts.get(t.id)! }));
}

// ─── Remedies, looked up from a symptom ──────────────────────────────────────

/** One answer to "this was refused — what now?". */
export interface RemedyMatch {
  /** The Tool that needed the host. */
  readonly needed_by: string;
  readonly host: string;
  /** The Tool to reach for, when there is one. */
  readonly tool?: string;
  /** That Tool's command, so the answer is runnable without a second lookup. */
  readonly invoke?: string;
  /** Stated: no workaround, and why. */
  readonly none?: string;
}

/**
 * Every declared remedy whose host appears in `symptom`, or whose `error`
 * text does. `symptom` is what the agent has in hand — a host name, a URL, or
 * a pasted error line — so matching is by containment, case-insensitive.
 * Bean `6mk7`.
 */
export function remediesFor(tools: readonly ToolDefinition[], symptom: string): RemedyMatch[] {
  const s = symptom.toLowerCase();
  const byId = new Map(tools.map((t) => [t.id, t]));
  const out: RemedyMatch[] = [];
  for (const t of tools) {
    for (const r of t.remedies ?? []) {
      const hit = s.includes(r.host.toLowerCase()) || (r.error !== undefined && s.includes(r.error.toLowerCase()));
      if (!hit) continue;
      const remedy = r.tool === undefined ? undefined : byId.get(r.tool);
      out.push({
        needed_by: t.id,
        host: r.host,
        ...(r.tool !== undefined ? { tool: r.tool } : {}),
        ...(remedy?.invoke.shell !== undefined ? { invoke: remedy.invoke.shell } : {}),
        ...(r.none !== undefined ? { none: r.none } : {}),
      });
    }
  }
  return out;
}

/** Tools that declare `requires.network` and no remedy — the `6mk7` gap. */
export function networkToolsWithoutRemedies(tools: readonly ToolDefinition[]): string[] {
  return tools.filter((t) => t.requires?.network === true && (t.remedies ?? []).length === 0).map((t) => t.id);
}

/** `remedies[].tool` values naming no declared Tool. */
export function danglingRemedies(tools: readonly ToolDefinition[]): Array<{ tool: string; host: string; remedy: string }> {
  const ids = new Set(tools.map((t) => t.id));
  return tools.flatMap((t) =>
    (t.remedies ?? [])
      .filter((r) => r.tool !== undefined && !ids.has(r.tool))
      .map((r) => ({ tool: t.id, host: r.host, remedy: r.tool as string })),
  );
}
