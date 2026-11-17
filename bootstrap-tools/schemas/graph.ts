/**
 * bootstrap's own terms, and the shape of the file that declares a Knowledge
 * Graph. Generated into `bootstrap/schemas/graph.schema.json`.
 *
 * @module schemas/graph
 * @graphNode schema
 *
 * ## Why bootstrap defines its own terms (owner, 2026-09-23)
 *
 * *"bootstrap = self definitional. no semantic leakage, no graph leakage …
 * all terms have a schema in glossary."* Before this file, the words
 * `bootstrap/README.md` is built on (Actor, Role, Process, Skill) were
 * defined in a harness's vocabulary module, and their published
 * definitions linked to that harness's pages. So bootstrap, the one layer that
 * must be readable with nothing else present, could not define the words it
 * uses. Now it does, here, and `vocabulary.ts` reads these definitions
 * rather than holding its own copies. That is the allowed direction: a
 * harness may read bootstrap, never the reverse.
 *
 * ## A Knowledge Graph has zero or more named Subgraphs
 *
 * Also the owner's words: *"a graph schema can contain zero or more named
 * dirs=subgraphs"*. {@link KnowledgeGraphDeclarationSchema} is the minimal
 * shape every `<name>.json` declaration shares: a name, and its Subgraphs
 * under `directories`. It passes through everything else, because a Harness
 * above bootstrap adds fields bootstrap has no opinion on. A test holds every
 * declaration in this repository to it, so the two cannot drift apart.
 *
 * ## Each definition is one or two plain sentences
 *
 * The reader is an agent or a person who has opened nothing else. Every term
 * used inside a definition is itself defined here, or is ordinary English.
 * No term names a particular Harness above bootstrap, or an outside standard
 * by an acronym it does not spell out.
 */
import { z } from "zod";

/**
 * The subject area bootstrap's terms belong to, published as `subject` beside
 * them in `graph.schema.json`. A layer that translates terms reads it to keep
 * a fixed translation of these words to text about the same subject: a
 * Reference here is one Node naming another, not a citation (owner,
 * 2026-11-07: "do it in the schema").
 */
export const BOOTSTRAP_TERMS_SUBJECT = "harness-vocabulary";

/** Every term bootstrap uses, with its definition. The generator emits each as a `$defs` entry. */
export const BOOTSTRAP_TERMS = {
  // ORDERED, and the order is the point: each definition uses only terms
  // defined above it, and never itself (owner, 2026-09-29: "logically tight,
  // non self-referential definitions"). BOOTSTRAP_TERM_USES below records
  // which, and `graph.test.ts` holds the two together and checks the order
  // with `checkDeclaredOrder`. Primitives, not defined here: file, directory,
  // JSON document, JSON Schema, JSON-LD (with its named graphs), IRI, BPMN
  // (process, flow node, gateway, event, lane, call activity), program, and a
  // repository at one version.
  //
  // Version 3, owner-approved 2026-09-29. Tool is NOT here: "no tools in
  // bootstrap" — a Harness defines it. Extension and Subkind are both kept.
  Node: "One file, or one part of a file addressable by an IRI fragment, named by an IRI.",
  Reference: "A Node's naming of another Node by its IRI.",
  NodeSchema: "A schema a Node can be checked against: a JSON Schema, or a published external schema such as BPMN's.",
  NodeKind: "A name paired with a Node Schema.",
  Subkind:
    "A Node Kind whose Node Schema requires everything another Node Kind's does, so every Node that satisfies it satisfies the other too.",
  NodeInstance: "A Node that names its Node Kind, in `$schema` or front matter, and satisfies that kind's Node Schema.",
  GraphTypology: "A named set of Node Kinds.",
  Declaration: "A JSON document, `<name>.json`, that gives a name and lists directory entries and file entries.",
  Extension:
    "A field of a Declaration, or of one of its entries, that is not defined here. A reader that does not recognise the field ignores it, and the rest of the Declaration keeps its meaning.",
  Subgraph: "A directory entry of a Declaration: an id, a directory, and the Graph Typologies its Node Instances' kinds belong to.",
  Asset: "A file entry of a Declaration: one file about the repository itself, whose `role` field says what it is for.",
  KnowledgeGraph:
    "The Node Schemas, Node Instances and Assets one Declaration lists, as of one version of the repository. Published as JSON-LD, the statements of each Subgraph's Node Instances form one named graph.",
  Dependency:
    "A Declaration's `needs` entry naming another Knowledge Graph. References may point from this graph's Node Instances into the named one, never back.",
  Content:
    "Node Instances that describe the subject matter of a Knowledge Graph, such as records, documents, catalogues and their terms, rather than how to work with it.",
  Task: "A unit of work, stated by what it needs to begin and what it produces.",
  Actor: "A person, an agent or a program that can carry out Tasks.",
  Skill:
    "A Node Instance stating a responsibility an Actor carries out to complete a Task: as natural-language instructions to follow, as a contract to be tested against, or both.",
  Role: "A Node Instance naming a part an Actor takes on to carry out Tasks, and listing the Skills that part needs.",
  ProcessNode: "A BPMN flow node: an activity (a task or call activity), a gateway, or an event.",
  SequenceFlow: "A directed connection in a BPMN process from one Process Node to the next.",
  Process:
    "A Node Instance holding a BPMN process that coordinates Tasks: its Process Nodes, joined by Sequence Flows, sit in lanes that each name a Role.",
  Harness:
    "A Knowledge Graph whose Subgraphs hold Skills, Roles or Processes: what an Actor uses to work with a Knowledge Graph, including itself.",
} as const;

export type BootstrapTerm = keyof typeof BOOTSTRAP_TERMS;

/**
 * Which earlier terms each definition uses — AUTHORED, not inferred.
 *
 * The editorial relation, in the sense `uses[]` has everywhere in this
 * repository: what a reader must already know to follow the definition. A
 * matcher over the text in `graph.test.ts` is kept as a GUARD that this list
 * and the prose agree, never as the source, because a word can appear in a
 * definition without being used as a term (Process Node's "a task" is BPMN's
 * word, not bootstrap's Task).
 */
export const BOOTSTRAP_TERM_USES: Readonly<Record<BootstrapTerm, readonly BootstrapTerm[]>> = {
  Node: [],
  Reference: ["Node"],
  NodeSchema: ["Node"],
  NodeKind: ["NodeSchema"],
  Subkind: ["NodeKind", "NodeSchema", "Node"],
  NodeInstance: ["Node", "NodeKind", "NodeSchema"],
  GraphTypology: ["NodeKind"],
  Declaration: [],
  Extension: ["Declaration"],
  Subgraph: ["Declaration", "GraphTypology", "NodeInstance"],
  Asset: ["Declaration"],
  KnowledgeGraph: ["NodeSchema", "NodeInstance", "Asset", "Declaration", "Subgraph"],
  Dependency: ["Declaration", "KnowledgeGraph", "Reference", "NodeInstance"],
  Content: ["NodeInstance", "KnowledgeGraph"],
  Task: [],
  Actor: ["Task"],
  Skill: ["NodeInstance", "Actor", "Task"],
  Role: ["NodeInstance", "Actor", "Task", "Skill"],
  ProcessNode: [],
  SequenceFlow: ["ProcessNode"],
  Process: ["NodeInstance", "Task", "ProcessNode", "SequenceFlow", "Role"],
  Harness: ["KnowledgeGraph", "Subgraph", "Skill", "Role", "Process", "Actor"],
};

/** JSON Schema draft-07 — the meta-schema a bootstrap Node Schema is written in. */
const JSON_SCHEMA = "http://json-schema.org/draft-07/schema#";
/** BPMN 2.0, the published standard a Process conforms to. */
const BPMN = "https://www.omg.org/spec/BPMN/2.0/";

/**
 * The schema that DEFINES each term, by IRI (owner, 2026-09-29: "definitions
 * should link to IRI of schemas defining them"). `#/$defs/<Term>` is this
 * document's own entry; an outside IRI is a standard bootstrap builds on and
 * does not restate. Published beside each definition as `rdfs:isDefinedBy`
 * and in the Terms table.
 */
export const BOOTSTRAP_TERM_DEFINED_BY: Readonly<Record<BootstrapTerm, string>> = {
  Node: "https://www.w3.org/TR/json-ld11/#node-objects",
  Reference: "https://www.rfc-editor.org/rfc/rfc3987",
  NodeSchema: JSON_SCHEMA,
  NodeKind: "#/properties/nodeSchemas",
  Subkind: "#/$defs/Subkind",
  NodeInstance: "#/$defs/NodeInstance",
  GraphTypology: "#/$defs/GraphTypology",
  Declaration: "#",
  Extension: "#/$defs/Extension",
  Subgraph: "#/$defs/Subgraph",
  Asset: "#/$defs/Asset",
  KnowledgeGraph: "#",
  Dependency: "#/$defs/Dependency",
  Content: "#/$defs/Content",
  Task: `${BPMN}#task`,
  Actor: "http://www.w3.org/ns/prov#Agent",
  Skill: "#/$defs/Skill",
  Role: "#/$defs/Role",
  ProcessNode: `${BPMN}#flowNode`,
  SequenceFlow: `${BPMN}#sequenceFlow`,
  Process: `${BPMN}#process`,
  Harness: "#",
};

/**
 * The Graph Typologies bootstrap's own Declaration uses, one plain sentence each.
 *
 * Defined HERE so bootstrap can say what its own Subgraphs hold without a
 * Harness present. They were defined only in a harness's registry
 * (`graph-typology-registry.ts`), which now reads these sentences as its
 * summaries rather than holding its own (bean `r3gy`, D1). A Harness adds
 * kinds of its own; to a reader that knows only bootstrap, those are
 * Extensions.
 */
export const BOOTSTRAP_GRAPH_TYPOLOGIES = {
  skills: "A Subgraph of Skills: the instructions an Actor follows to carry out a Task.",
  schemas: "A Subgraph of Node Schemas: files that state the shape other files must have.",
  scenarios: "A Subgraph of Roles: the responsibilities an Actor takes on, and who takes them on.",
  processes:
    "A Subgraph of Processes: BPMN diagrams that coordinate Tasks, and the decision tables their gateways compute from.",
  models:
    "A Subgraph describing the language models an Actor may be: which languages each is good at, and whether a person checked.",
} as const;

export type BootstrapGraphTypology = keyof typeof BOOTSTRAP_GRAPH_TYPOLOGIES;

/** One entry of a Subgraph's `graphTypologies`: one of bootstrap's, or an Extension. */
export const GraphTypologySchema = z
  .union([
    ...(Object.entries(BOOTSTRAP_GRAPH_TYPOLOGIES) as [string, string][]).map(([k, d]) => z.literal(k).describe(d)),
    z
      .string()
      .min(1)
      .describe(`A Graph Typology a Harness defines. To a reader that knows only bootstrap it is an Extension: ${BOOTSTRAP_TERMS.Extension}`),
  ])
  .describe(BOOTSTRAP_TERMS.GraphTypology);


/**
 * A path a declaration names: relative, inside the declaring directory. No
 * leading slash or backslash, no drive letter, no `..` segment (bean `dnrj`).
 * bootstrap's graph.schema.json carries the same pattern, so the generator
 * must emit it.
 */
const RELATIVE_INSIDE = /^(?![/\\]|[A-Za-z]:)(?!.*(?:^|[/\\])\.\.(?:[/\\]|$)).+$/;

export const SubgraphSchema = z
  .object({
    id: z.string().min(1).describe("The Subgraph's name, unique within its Knowledge Graph."),
    path: z.string().min(1).regex(RELATIVE_INSIDE).describe("The directory, relative to the declaration."),
    graphTypologies: z.array(GraphTypologySchema).min(1).describe("The Graph Typologies it holds."),
    title: z.string().optional().describe("A short name for people, shown as its README's heading."),
    description: z.string().optional().describe("What it holds, in a sentence or two, shown under that heading."),
  })
  .passthrough()
  .describe(BOOTSTRAP_TERMS.Subgraph);

export const AssetSchema = z
  .object({
    id: z.string().min(1),
    src: z.string().min(1).regex(RELATIVE_INSIDE).describe("The file, relative to the declaration."),
    role: z.string().min(1).describe("The part the file plays, such as `instance-readme`."),
  })
  .passthrough()
  .describe(BOOTSTRAP_TERMS.Asset);

/** A `needs` entry: the other Knowledge Graph's name. */
export const DependencySchema = z.string().min(1).describe(BOOTSTRAP_TERMS.Dependency);

/** The shape every `<name>.json` shares. Loose on purpose: a Harness above bootstrap adds fields. */
export const KnowledgeGraphDeclarationSchema = z
  .object({
    name: z.string().min(1).describe("The Knowledge Graph's name. The declaration file is `<name>.json`."),
    version: z
      .string()
      .regex(/^\d+\.\d+\.\d+$/)
      .optional()
      .describe("Its version, as MAJOR.MINOR.PATCH (semantic versioning)."),
    iriBase: z
      .string()
      .url()
      .optional()
      .describe(
        "The address its IRIs are minted under, before the major version. An identifier a program reads and a page meant for a person are both `<iriBase>v<major>/…`; the exact release is the pin's, not the address's.",
      ),
    title: z.string().optional(),
    description: z.string().optional(),
    directories: z.array(SubgraphSchema).optional().describe("Its Subgraphs: zero or more."),
    needs: z.array(DependencySchema).optional().describe("Its Dependencies: the Knowledge Graphs it may refer into."),
    nodeSchemas: z
      .record(z.string().min(1), z.string().min(1))
      .optional()
      .describe(
        "Its Node Kinds: each `$schema` value its Node Instances may carry, paired with the Node Schema that defines it — an IRI, or a path relative to this Declaration.",
      ),
    assets: z.array(AssetSchema).optional(),
  })
  // Every other field is an Extension: a Harness above bootstrap adds its
  // own (`stickies`, and a sticky's `theme`, are one harness's), and a reader
  // that does not know one ignores it rather than rejecting the file.
  .passthrough()
  .describe(`A Declaration. Any field not listed here is an Extension: ${BOOTSTRAP_TERMS.Extension}`);

/**
 * A term whose `$defs` entry carries a shape as well as its definition, so the
 * term a README links to is the same object the declaration is checked
 * against — not a description of it beside the real thing.
 */
export const BOOTSTRAP_TERM_SHAPES: Readonly<Partial<Record<BootstrapTerm, z.ZodType>>> = {
  GraphTypology: GraphTypologySchema,
  Subgraph: SubgraphSchema,
  Asset: AssetSchema,
  Dependency: DependencySchema,
};
