#!/usr/bin/env bun
/**
 * Generate `bootstrap`'s JSON Schema from the Zod in `bootstrap-tools/schemas/`.
 *
 * @module scripts/gen-bootstrap-schemas
 * @covers schemas
 * @graphNode none — a generator over the bootstrap schemas, not a schema itself
 *
 * ## Why the source and the output are in different layers
 *
 * `bootstrap/README.md` promises a Bootstrapping Agent **no harness, no server, no
 * tools and no work plan**, and that what it reads is "a file you read, not
 * something you run". That directory holds `.md`, `.json` and `.bpmn` and no
 * executable code. So the Zod lives in `bootstrap-tools/schemas/` and the
 * JSON lands in `bootstrap/`, which knows nothing of how it got there.
 *
 * ## Zod is one authoring tool; the output is the contract
 *
 * What must not change with the tool is what this writes: bootstrap's
 * `schemas/*.schema.json`, byte for byte. A different authoring tool (another
 * language, a hand-written schema) is judged the same way, by
 * `schemas:check`.
 *
 * ## The `$id`s are a contract, so they are stated rather than derived
 *
 * They are already published, and the filenames are cited from
 * `discussion.bpmn`, a harness's tool registry, the generated skill docs
 * and `.pot` catalogues in five languages. Deriving them from a base URL
 * would make a relocation silently repoint a consumer's `$ref`.
 *
 * ## What this has to put back, and why it is not optional
 *
 * The converter drops `.refine()` entirely: no `allOf`, no `if`/`then`, no
 * message. The output document's two conditionals would therefore vanish, and
 * the published schema would start ACCEPTING what it currently REJECTS — a
 * contract weakened invisibly. So the conditionals are re-applied from
 * `JSON_SCHEMA_CONDITIONALS`, and
 * `bootstrap-tools/schemas/discussion.test.ts` proves it with documents
 * that must fail.
 *
 * Usage:
 *   bun run schemas                    # write
 *   bun run schemas:check              # fail if stale
 *   bun run schemas -- --root <dir>    # the bootstrap checkout at <dir>
 */
import { generatedNote, leadingFrontMatter } from "./generated-by.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import { z } from "zod";

import { readKnowledgeGraphDeclaration, supportsContent } from "../schemas/declaration.ts";


import {
  DiscussionInputSchema,
  DiscussionOutputObjectSchema,
  JSON_SCHEMA_CONDITIONALS,
} from "../schemas/discussion.ts";
import {
  BOOTSTRAP_TERM_DEFINED_BY,
  BOOTSTRAP_TERM_SHAPES,
  BOOTSTRAP_TERM_USES,
  BOOTSTRAP_TERMS,
  BOOTSTRAP_TERMS_SUBJECT,
  KnowledgeGraphDeclarationSchema,
} from "../schemas/graph.ts";
import { renderSchemaPage, type PageDocument } from "./bootstrap-schema-page.ts";
import { ModelRegistrySchema } from "../schemas/model-registry.ts";
import { bootstrapRelease, releaseIri } from "../schemas/release-iri.ts";

import {
  REQUIREMENT_JSON_SCHEMA_CONDITIONALS,
  RequirementSchema,
} from "../schemas/requirement.ts";
import {
  REQUIREMENT_SET_JSON_SCHEMA_CONDITIONALS,
  RequirementSetSchema,
} from "../schemas/requirement-set.ts";

const ROOT = join(import.meta.dir, "..", "..");
const check = process.argv.includes("--check");

/**
 * Where `bootstrap` actually is, resolved from its own declaration.
 *
 * The LAYER is the part that can move — it is discovered by declared name
 * rather than assumed to sit at `bootstrap/`, so a relocation moves the
 * output with it. What is not resolved is the `skills/<file>` tail, and that
 * is deliberate: those filenames are half of a published `$id` and are cited
 * from `discussion.bpmn`, a harness's tool registry, the generated skill
 * docs and `.pot` catalogues in five languages. A filename that followed a
 * directory rename would silently repoint every one of them.
 */
function bootstrapRoot(): string {
  // `--root <dir>` names the bootstrap checkout; beside bootstrap-tools by
  // default, which is where it sits in this repository and in a checkout of
  // the pair. No sibling scan: the tool is handed the checkout it works on.
  const at = process.argv.indexOf("--root");
  const dir = at >= 0 && process.argv[at + 1] ? process.argv[at + 1]! : join(ROOT, "bootstrap");
  const decl = readKnowledgeGraphDeclaration(dir);
  if (decl?.name === "bootstrap") {
    // A toolset handles the content majors it lists, and refuses others.
    const tools = readKnowledgeGraphDeclaration(join(import.meta.dir, ".."));
    if (!tools || !supportsContent(tools, "bootstrap", decl.version)) {
      throw new Error(
        `bootstrap ${decl.version ?? "(no version)"} is not a major these tools support ` +
          `(bootstrap-tools.json \`supports.bootstrap\`). Use a bootstrap-tools release that lists it.`,
      );
    }
    return dir;
  }
  throw new Error(
    `${dir} holds no declaration naming itself \`bootstrap\` — cannot place the generated schemas. ` +
      "Pass the bootstrap checkout as --root <dir>.",
  );
}

const BOOTSTRAP = bootstrapRoot();

/**
 * Every `$id` below is minted from bootstrap's declared iriBase and version,
 * never typed — read from the checkout `--root` names, the same one the
 * documents are written into.
 */
const RELEASE = bootstrapRelease(BOOTSTRAP);

/** Where each document is published, and the `$id` it is published at. */
const TARGETS = [
  {
    // declared-path-literal: the convention fallback, at the call site. The
    // documents moved from `skills/` to `schemas/` on 2026-09-21 and their
    // `$id` stayed at `skills/discussion/…`, a path no file sits at — so
    // publishing files where they sit could never serve it. Owner, 2026-09-29:
    // the `$id` becomes the file's path, before 0.1.0 is ever served, and
    // `check:node-iris` now fails on any identifier that is not its file's
    // path. (The translation catalogues cite the FILENAME, not the `$id`,
    // checked before changing it.)
    file: "schemas/discussion.input.schema.json",
    id: releaseIri(RELEASE, "schemas/discussion.input.schema.json", "agent"),
    title: "Discussion Input",
    description:
      "The occasion for asking: what the agent already knows, and which unknown is still open. Deliberately small — a Bootstrapping Agent has read one README and can look nothing up, so an input it cannot populate is an input that stops the process.",
    schema: DiscussionInputSchema,
    conditionals: [] as readonly unknown[],
    terms: {} as Readonly<Record<string, string>>,
  },
  {
    // declared-path-literal: as above — path moved, `$id` deliberately not.
    file: "schemas/discussion.output.schema.json",
    id: releaseIri(RELEASE, "schemas/discussion.output.schema.json", "agent"),
    title: "Discussion Output",
    description:
      "What the exchange determined: which harness, which repositories, on whose word, and by what means. This document existing and conforming is what finishes the task — not that a conversation took place.",
    schema: DiscussionOutputObjectSchema,
    conditionals: JSON_SCHEMA_CONDITIONALS as readonly unknown[],
    terms: {} as Readonly<Record<string, string>>,
  },
  {
    // bootstrap's own terms, and the shape of a `<name>.json` declaration
    // (owner, 2026-09-23: "bootstrap = self definitional … all terms have a
    // schema"). `bootstrap/README.md` links each term's first use here.
    file: "schemas/graph.schema.json",
    id: releaseIri(RELEASE, "schemas/graph.schema.json", "agent"),
    title: "Knowledge Graph declaration",
    description:
      BOOTSTRAP_TERMS.KnowledgeGraph +
      " This schema is the shape of that declaration, and its `$defs` define every term bootstrap uses.",
    schema: KnowledgeGraphDeclarationSchema,
    conditionals: [] as readonly unknown[],
    terms: BOOTSTRAP_TERMS as Readonly<Record<string, string>>,
  },
  {
    // The shape of `models/models.json`. Its Zod source moved out of bootstrap
    // on 2026-09-23 and lives in bootstrap-tools (bean iwtn, FR-7: bootstrap
    // holds no code); this document is what a reader with nothing installed opens.
    file: "schemas/model-registry.schema.json",
    id: releaseIri(RELEASE, "schemas/model-registry.schema.json", "agent"),
    title: "Model Registry",
    description:
      "Which languages a model is good at, and whether a person checked. Only `human-validated` is ever acted on, and only a person can grant it.",
    schema: ModelRegistrySchema,
    conditionals: [] as readonly unknown[],
    terms: {} as Readonly<Record<string, string>>,
  },
  {
    // What a harness, or something built with one, must do (issue #1164).
    // Bootstrap publishes it because a harness states its requirements before
    // anything above bootstrap has loaded; the Zod is in bootstrap-tools (FR-7, 319n).
    file: "schemas/requirement.schema.json",
    id: releaseIri(RELEASE, "schemas/requirement.schema.json", "agent"),
    title: "Requirement",
    description:
      "What a harness, or something built with one, must do, said so it can be checked: a titled set of numbered statements, each with a level (SHALL, SHOULD, MAY, SHALL NOT), one sentence, and — optional for now, required once existing statements are migrated — at least one success criterion saying how it is judged met (test, inspection, review or analysis). A test run points at a statement as `req:<slug>#<key>`, or at one criterion as `req:<slug>#<key>/<criterion>`; the requirement does not list its tests. Statement keys are unique within a requirement, criterion keys within a statement.",
    schema: RequirementSchema,
    conditionals: REQUIREMENT_JSON_SCHEMA_CONDITIONALS as readonly unknown[],
    terms: {} as Readonly<Record<string, string>>,
  },
  {
    // The requirements DOCUMENT: a set of requirement statements at one stage,
    // with the sign-offs that moved it there (litlfred/folio-assistant#2405,
    // FR-010 to FR-012). Beside the Requirement it gathers, for the same reason.
    file: "schemas/requirement-set.schema.json",
    id: releaseIri(RELEASE, "schemas/requirement-set.schema.json", "agent"),
    title: "Requirement Set",
    description:
      "A requirements document: a set of requirement statements (by `req:` reference, each with its own decision) at one stage of its life — draft, proposed, approved, planned, in-progress, delivered, accepted, or rejected, cancelled, superseded — with its work plan and the sign-offs that moved it there. A sign-off is a recorded decision: who (kind, id, actor), when, about what, the outcome (approve, amend, reject, defer, cancel), the stage it moves the set to, why, and a link to where it was made. `approved` and `accepted` need a human sign-off; from `planned` on, the set names its work plan; `cancelled` needs a reason. The set's stage and each member's own status are independent.",
    schema: RequirementSetSchema,
    conditionals: REQUIREMENT_SET_JSON_SCHEMA_CONDITIONALS as readonly unknown[],
    terms: {} as Readonly<Record<string, string>>,
  },
] as const;

/**
 * Remove every `additionalProperties` the exporter added, at any depth.
 *
 * Recursive rather than top-level-only, because the nested objects — a
 * repository reference, a participant, an exchange entry — each get one too,
 * and the documents this replaces carried none anywhere.
 */
export function stripAdditionalProperties(node: unknown): void {
  if (Array.isArray(node)) {
    for (const v of node) stripAdditionalProperties(v);
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  delete o.additionalProperties;
  for (const v of Object.values(o)) stripAdditionalProperties(v);
}

/** One document, rendered. */
export function render(t: (typeof TARGETS)[number]): string {
  // `$refStrategy: "none"` inlines every shared definition, which is correct
  // for a document a consumer dereferences by `$id`: it gets something
  // self-contained. The cost — a referenced type is not a named thing in the
  // output — is the same one `harness-schema-export` accepts, and it is why
  // the schema GRAPH is read from the `.ts` rather than from this.
  const body = z.toJSONSchema(t.schema, { io: "input", reused: "inline" }) as Record<
    string,
    unknown
  >;

  // The converter emits its own `$schema`; the draft is stated below so the
  // published document does not change dialect when the library does.
  delete body.$schema;

  // STRICTNESS IS KEPT, DELIBERATELY — bean `z634`, decided 2026-09-21.
  //
  // `z.object()` is strict, so the converter emits `additionalProperties:
  // false` on every object. The port that introduced this file STRIPPED it,
  // and that was right THEN: the hand-written documents it replaced carried
  // none at any depth, and porting a shape is not the moment to change what
  // validates.
  //
  // The bean pre-registered the test that settles it — *"does anything
  // actually produce these documents today? If nothing does, the
  // compatibility risk is zero and this is free."* Measured 2026-09-21, and
  // all three answers agree:
  //
  //   producers of a discussion document, anywhere in the repo   NONE
  //   `skills/discussion.md` on whether extra keys are permitted SILENT
  //   age of the published `$id`                                 1 day
  //
  // So nothing can break, and what strictness buys is exactly the failure
  // these documents are most exposed to: they are written by AGENTS, and an
  // agent that types `assumtion` for `assumption` gets SILENCE today. Under
  // `additionalProperties: false` the key is rejected, and the `assumed`
  // conditional then fires and names the missing field.
  //
  // `stripAdditionalProperties` is kept, exported and tested rather than
  // deleted: it is the one-line reversal if a consumer ever appears, and a
  // deleted function is a decision that cannot be undone by reading this
  // comment.

  const doc: Record<string, unknown> = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: t.id,
    $comment: generatedNote("scripts/gen-bootstrap-schemas.ts", "its Zod source", "change the Zod"),
    title: t.title,
    description: t.description,
    ...body,
  };

  // THE PART ZOD CANNOT CARRY. Appended after the shape so it reads in the
  // published file the way it reads in the schema: the object, then the rules
  // that relate its fields.
  if (t.conditionals.length) doc.allOf = t.conditionals;

  // The glossary, as schema: one `$defs` entry per term, each a definition a
  // README links to. A term with no structure of its own (Role, Skill) is a
  // definition only, which JSON Schema expresses as a title and a description.
  const terms = Object.entries(t.terms);
  if (terms.length) {
    // The subject area the terms belong to, as data beside them, so a layer
    // that reads them as a glossary need not hard-code it.
    if (t.terms === BOOTSTRAP_TERMS) doc.subject = BOOTSTRAP_TERMS_SUBJECT;
    // A term with a shape of its own (GraphTypology: bootstrap's kinds, open to a
    // Harness's) carries it beside the definition, so the list is published
    // where the term is, not only inline in the field that uses it.
    const shapes = t.terms === BOOTSTRAP_TERMS ? (BOOTSTRAP_TERM_SHAPES as Record<string, z.ZodType>) : {};
    doc.$defs = Object.fromEntries(
      terms.map(([name, definition]) => {
        const shape = shapes[name];
        const extra = shape ? (z.toJSONSchema(shape, { io: "input", reused: "inline" }) as Record<string, unknown>) : {};
        delete extra.$schema;
        // Two annotations beside the definition, both read by the drawn page
        // and by anyone else: which earlier terms it uses (authored, in order),
        // and the schema that defines it — a `#` pointer into this document,
        // or the standard it builds on (owner, 2026-09-29).
        const annotations =
          t.terms === BOOTSTRAP_TERMS
            ? {
                uses: [...(BOOTSTRAP_TERM_USES[name as keyof typeof BOOTSTRAP_TERM_USES] ?? [])],
                isDefinedBy: BOOTSTRAP_TERM_DEFINED_BY[name as keyof typeof BOOTSTRAP_TERM_DEFINED_BY],
              }
            : {};
        return [name, { title: name, ...extra, description: definition, ...annotations }];
      }),
    );
  }

  return `${JSON.stringify(doc, null, 2)}\n`;
}

/**
 * The drawn page, `schemas/README.md`, rendered from the documents above in
 * the same run, so the staleness check covers it too. How each document is
 * presented: the file it describes, and names for boxes that are defined
 * terms (a declaration's `directories` hold Subgraphs, its `assets` Assets).
 */
const PAGE_PRESENTATION: Readonly<Record<string, Omit<PageDocument, "file" | "schema">>> = {
  "Knowledge Graph declaration": {
    describes: "<name>.json",
    boxNames: { directories: "Subgraph", assets: "Asset" },
  },
  // The file this schema describes, as the page shows it to a reader; the
  // page is text, and nothing resolves this string as a path.
  "Model Registry": { describes: "models/models.json" },
};

const outputs: { file: string; title: string; text: string }[] = TARGETS.map((t) => ({
  file: t.file,
  title: t.title,
  text: render(t),
}));
outputs.push({
  title: "Schemas, drawn",
  // declared-path-literal: the drawn page sits beside the schemas it draws,
  // in the same declared `schemas/` directory as every TARGETS file above.
  file: "schemas/README.md",
  text: renderSchemaPage(
    outputs.map((o) => ({
      file: o.file.replace(/^schemas\//, ""),
      schema: JSON.parse(o.text),
      ...PAGE_PRESENTATION[o.title],
    })),
    // The document whose `$defs` hold the terms: the one titled for them.
    outputs.find((o) => o.title === "Knowledge Graph declaration")!.file.replace(/^schemas\//, ""),
  ),
});

let stale = 0;
let wrote = 0;

/**
 * The drawn page shares its file with the directory README `subgraph-readmes`
 * writes (`schemas/README.md` IS that directory's README). This generator owns
 * everything but the `kg:subgraph` region and the page's leading front matter
 * (`subgraph-readmes` writes a `generated:` key there), which it carries over unchanged:
 * two generators, one file, neither overwriting the other.
 */
const SUBGRAPH_BEGIN = "<!-- kg:subgraph:begin -->";
const SUBGRAPH_END = "<!-- kg:subgraph:end -->";
function keepSubgraphRegion(file: string, text: string): string {
  if (!file.endsWith("README.md")) return text;
  const prev = existsSync(join(BOOTSTRAP, file)) ? readFileSync(join(BOOTSTRAP, file), "utf8") : "";
  const i = prev.indexOf(SUBGRAPH_BEGIN);
  const j = prev.indexOf(SUBGRAPH_END);
  const region = i !== -1 && j > i ? prev.slice(i, j + SUBGRAPH_END.length) : `${SUBGRAPH_BEGIN}\n${SUBGRAPH_END}`;
  // And the front matter that writer puts above it when the page is wholly
  // generated, which is also its to keep or drop.
  const fm = leadingFrontMatter(prev)?.block ?? "";
  return `${fm}${region}\n\n${text}`;
}

for (const t of outputs) {
  const path = join(BOOTSTRAP, t.file);
  const next = keepSubgraphRegion(t.file, t.text);
  const prev = existsSync(path) ? readFileSync(path, "utf8") : null;

  if (prev === next) {
    console.log(`  = ${relative(ROOT, path)}`);
    continue;
  }
  if (check) {
    // A red here means somebody changed the Zod and did not regenerate — a
    // real omission every time, which is the standard this repository holds a
    // staleness gate to.
    console.error(`  ✗ ${relative(ROOT, path)} is stale`);
    stale++;
    continue;
  }
  writeFileSync(path, next);
  console.log(`  ✓ ${relative(ROOT, path)}`);
  wrote++;
}

if (check && stale) {
  console.error(`\n${stale} bootstrap schema(s) stale — run \`bun run bootstrap:schemas\`.`);
  process.exit(1);
}
console.log(
  check
    ? "\nbootstrap schemas are up to date"
    : `\n${wrote} written, ${outputs.length - wrote} unchanged`,
);
