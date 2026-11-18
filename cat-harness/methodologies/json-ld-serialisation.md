---
$schema: folio-methodology/v1
name: json-ld-serialisation
title: JSON-LD 1.1 — the knowledge graph serialised as Linked Data in plain JSON
origin: >
  W3C, "JSON-LD 1.1 — A JSON-based Serialization for Linked Data", W3C
  Recommendation 16 July 2020 (https://www.w3.org/TR/2020/REC-json-ld11-20200716/),
  editors Gregg Kellogg, Pierre-Antoine Champin and Dave Longley; produced by
  the JSON-LD Working Group. Held as the Working Group's own publication
  snapshot of the REC (github.com/w3c/json-ld-syntax, commit 029777cf), under
  the W3C Software and Document License. The companion Recommendations —
  JSON-LD 1.1 Processing Algorithms and API, and JSON-LD 1.1 Framing — are
  NOT held.
evidence:
  - library/w3c-2020-json-ld-1-1
applies-when: >
  **Choosing how a node of the knowledge graph is written to disk or
  published, so that it is ordinary JSON to a reader with no RDF tooling and
  RDF to one with it.** Use it when adding a generated `.jsonld` sibling, a
  term to a published `@context`, a prefix, or a new exported document. It
  answers *how a node is identified, typed and linked in the serialisation*.
  It does NOT answer what a node means (that is the vocabulary and the
  schemas), whether a relation is true (`uses-editorial-review`), or how a
  table is modelled (CSVW, bound as a vocabulary, not a serialisation).
---

# JSON-LD 1.1 — how this graph is written down

**Adopted by practice long before it was written down.** Thousands of
committed `.jsonld` files, a generated `@context`, four generators and three
CI gates existed with no node saying which parts of the Recommendation the
platform follows and which it declines. This node is that statement. It is
the method; the procedures that perform it live in the code cited in
§"Where it runs".

## Its sources: what is held, what is not

| source | held | what this node takes from it |
|---|---|---|
| JSON-LD 1.1 (W3C REC, 2020-07-16) | ✅ `library/w3c-2020-json-ld-1-1` | the syntax: context, `@id`, `@type`, compact IRIs, aliasing, containers, `@graph`, security considerations |
| JSON-LD 1.1 Processing Algorithms and API | ❌ not held | the expansion algorithm `publish-verify.ts` runs through the `jsonld` npm package — trusted, not read |
| JSON-LD 1.1 Framing | ❌ not held | framing; not adopted (below) |

**A caveat on section references.** The held copy was printed to PDF and
split by outline heading; text often lands in the file of the *preceding*
heading (the keyword-aliasing text of §4.1.6 sits in `sec-036-note.md`).
References below give the spec section the text belongs to, and the held
file it is in. The licence note says the snapshot was not compared byte for
byte with the w3.org copy, and post-REC errata are not included.

## The load-bearing idea, in the Recommendation's words

> "JSON-LD is a lightweight syntax to serialize Linked Data in JSON
> [RFC8259]. Its design allows existing JSON to be interpreted as Linked Data
> with minimal changes. … Since JSON-LD is 100% compatible with JSON, the
> large number of JSON parsers and libraries available today can be reused."
> — Abstract (held in `sec-006-table-of-contents.md`).

> "A JSON-LD document serializes a RDF Dataset [RDF11-CONCEPTS], which is a
> collection of graphs that comprises exactly one default graph and zero or
> more named graphs." — §8 Data Model (`sec-105-8-data-model.md`).

That double reading is the reason for the choice: a consumer with only a
JSON parser reads records; a consumer with a JSON-LD processor reads a graph.

## What this platform adopts

1. **A published, generated context referenced by URL.** The spec's §3.1
   shows a document carrying `"@context": "https://…/person.jsonld"`
   (Example 5, `sec-022-31-the-context.md`). Every emitted node does the
   same with `CONTENT_CONTEXT_URL` (`cat-harness/schemas/kg/jsonld.ts`), and the
   context file `cat-harness/ns/content/v1.jsonld` is generated from the
   TypeScript value `CONTENT_CONTEXT` by
   `cat-harness-tools/scripts/gen-jsonld-context.ts` and gated by
   `gen:jsonld:check`.
2. **`@version: 1.1`.** §4.1.1: *"Explicitly setting the processing mode to
   json-ld-1.1 will prohibit JSON-LD 1.0 processors from incorrectly
   processing a JSON-LD 1.1 document"* (`sec-030`). Both `CONTENT_CONTEXT` and
   `buildContext()` in `cat-harness-tools/scripts/kg-export.ts` set it, the latter
   with that reason stated.
3. **Compact IRIs over declared prefixes.** §4.1.5: *"A compact IRI is a way
   of expressing an IRI using a prefix and suffix separated by a colon"*, and
   *"If the prefix is not defined in the active context … the value is
   interpreted as IRI instead"* (`sec-034`). The context binds
   the content core, `doco`, `deo`, `cito`, `oa`, `prov`, `skos`,
   `dcterms`, `fhir`, `csvw`. That second sentence is exactly the hazard
   `jsonld.ts` documents: a folio label like `paper:thm:bar` has compact-IRI
   shape, would parse as an absolute IRI with scheme `paper`, and join with
   nothing — so `@id` is **minted** by `resolveLabel` and the label is kept
   as a literal in `folio-assistant-core:label`.
4. **`@id` for identity, and the identifier is the file's path.** §3.3
   (`sec-024`) identifies a node with `@id`. The platform adds a rule the
   spec does not make: a published node's `@id` (or `$id`) under a release
   base must name the path its file sits at — `check:node-iris`
   (`bootstrap-tools/scripts/check-node-iris.ts`), CI step *"Every published
   node's identifier is its file's path"*.
5. **`@type` with external vocabulary classes** — e.g. `doco:Section` on
   every held library section (`sections/sec-022.jsonld` in this very
   source).
6. **Type coercion and containers in term definitions.** Edges such as
   `uses`, `cites`, `contains` are declared `"@type": "@id"` with
   `"@container": "@set"` (`CONTENT_CONTEXT`), the pattern of §3.1 Example 4
   and §4.3.2 *"Specifying that a collection is unordered in the context"*
   (`sec-061`). Companion-file paths are deliberately **not** coerced to
   `@id`: `jsonld.ts` records that coercion resolved `../sections/x.md`
   against `@base` into a link to nowhere (work item `589f`).
7. **Keyword aliasing.** §4.1.6: *"Each of the JSON-LD keywords, except for
   @context, may be aliased to application-specific keywords. This feature
   allows legacy JSON content to be utilized by JSON-LD"* (`sec-036-note.md`).
   `kg-export.ts` aliases `id`, `type`, `graph`, and `keywordCollisions()`
   refuses a node carrying both a keyword and its alias.
8. **`@graph`** for a whole-graph export: `kg-export.ts` emits one document
   whose `@graph` holds every node.
9. **A context binds only what its documents use.** A platform rule, not the
   spec's: each layer's context, `<iriBase>ns/context/v1.jsonld`, is
   GENERATED from the prefixes and content-context terms its documents use
   (`jsonld:contexts`, cat-harness-tools `scripts/gen-instance-contexts.ts`),
   so a bound prefix nothing speaks cannot exist. It replaced
   `check:context-emission` and its `FORWARD_DECLARED` reasons (work item
   `folio-assistant-63q4`).

## The voice that holds code to this node

What this node adopts is enforced on CODE through the `linked-data` voice
(the content core's `skills/voices/linked-data/voice.json`, owner 2026-10-01: *"a voice
for a coding agent, in a code authoring or review task"*). It is in force for the
`authoring-agent` and `code-reviewer` roles in `Process_CodeChangeReview` and
`Process_CodeReview`, and each of its seven rules quotes the held text — object
properties as links, link values at release addresses, no `@base` in a remote
context (§4.1.3, the tension recorded below), no context fetched at run time,
coercion belonging to terms, and PROV in PROV-JSONLD's shape.

## What it refuses, with reasons

1. **No `@vocab`.** §4.1.2 (`sec-032`) lets a default vocabulary expand any
   undeclared key. `kg-export.ts` refuses it — *"an undeclared key stays
   undeclared rather than silently resolving against a default namespace and
   minting an IRI nobody chose"* — and `kg-export.test.ts` asserts
   `ctx["@vocab"]` is undefined. An undeclared term is instead surfaced as a
   processor warning (below).
2. **No network fetch of contexts at verification time.** §11 Security
   Considerations: retrieving external contexts can *"provide an opportunity
   for a man-in-the-middle attack. To protect against this, publishers should
   consider caching remote contexts for future use, or use the documentLoader
   to maintain a local version of such contexts"* (held in
   `sec-133-11-security-considerations.md`). `localLoader()` in
   `cat-harness-tools/scripts/publish-verify.ts` does exactly that: our context URL
   maps to the file in the tree, and anything else is refused — *"a document
   that needs the network to be understood is a finding"*.
3. **No framing.** Framed document form (§5.4, `sec-095`) is defined by the
   separate Framing Recommendation, which is not held, and no code here calls
   a frame algorithm. Consumers receive expanded-compatible compacted
   documents and a flat `@graph`; nothing is reshaped by frame.
4. **Labels are never emitted as IRIs** — item 3 above; the reason is the
   spec's own fallback rule.

## A tension recorded, not resolved

`jsonld.ts` says *"`@base` lives in the published context"*, and
`ns/content/v1.jsonld` carries `"@base"`. The held §4.1.3 text reads:
*"Please note that the @base will be ignored if used in external contexts"*
(`sec-033-413-base-iri.md`). Every emitted document references that context
by URL, so it is external, and relative `@id`s such as
`library/w3c-2020-json-ld-1-1/sections/sec-022` would resolve against the
document's own location instead. **Not verified here** — what
`publish-verify`'s expansion reports for these documents was not run for this
node. It is the first thing to check before relying on relative `@id`s
expanding to the `@base` address.

## Where it runs

| concern | file |
|---|---|
| the context, minting `@id`s, block kind → `@type` | `cat-harness/schemas/kg/jsonld.ts` |
| the generated context file | `cat-harness-tools/scripts/gen-jsonld-context.ts` → `cat-harness/ns/content/v1.jsonld` |
| block / library / site siblings | `cat-harness-tools/pipeline/gen-block-jsonld.ts`, `gen-library-jsonld.ts`, `gen-site-jsonld.ts` (`gen:jsonld:check`) |
| whole-graph export, aliasing, no `@vocab` | `cat-harness-tools/scripts/kg-export.ts` |
| expansion under a real processor, offline loader | `cat-harness-tools/scripts/publish-verify.ts` (`jsonld-expand` verifier) |
| prefixes bound vs used | `cat-harness-tools/scripts/gen-instance-contexts.ts` (`jsonld:contexts --check`) |
| every key a declared term, no path under `@id` | `cat-harness-tools/scripts/check-content-keys.ts` |
| identifier = file path | `bootstrap-tools/scripts/check-node-iris.ts` |

## What the source does NOT establish

The Recommendation defines a syntax; it makes no claim that a graph written
in it is correct, complete or well-modelled. A document that expands without
warning has a well-formed serialisation and nothing more. The two platform
rules above (identifier = path; every prefix emitted) are house rules layered
on the standard, not part of it.
