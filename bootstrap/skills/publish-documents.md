---
name: publish-documents
description: >
  The primary step of initializing a Knowledge Graph harness: every JSON
  Schema and JSON-LD document it names an address for (schemas, vocabulary,
  diagram vocabulary, graph export, each with its @context) is published AT
  that address, and the address answers. Checked first, right after the
  declaration is read.
---

# The documents at their addresses: the primary step

**A Knowledge Graph harness is its JSON and JSON-LD.** Its schemas say what
a declaration and every node may be; its vocabulary says what each term
means; its graph says what it holds. Each names itself with an IRI: a JSON
Schema with `$id`, a JSON-LD document with `@id`. **An IRI that answers 404
is a broken promise** to everything that points at it. So this is the first
step checked once the declarations are read, before any directory, README or
site step.

## Which documents

Read from the files, never from a list:

- every JSON file whose top-level `$id` lies under the declaration's
  `iriBase` is a JSON Schema published at that `$id`;
- every JSON-LD file whose top-level `@id` lies under `iriBase` is published
  at that `@id`. For bootstrap that is the vocabulary (`ns.jsonld`, at
  `<iriBase>v<major>/ns/`) and the diagram vocabulary (`processes/ns.jsonld`,
  at `<iriBase>v<major>/processes/ns/`, the namespace every diagram binds);
- the graph export, built when the site is published, at the address its own
  `@id` names ([`bootstrap-graph-publication`](bootstrap-graph-publication.md)).

Each document carries its `@context` inline, so publishing the document
publishes its context. A harness whose documents name an external context
publishes that context the same way, at its own IRI.

**No `iriBase`, no addresses.** A layer that declares none has nothing
here to publish, and says so rather than reporting a pass over nothing.

## Where each goes

At the path its IRI names, with `iriBase` removed. An address ending in `/`
(`…/v0/ns/`) gets the document as `index.jsonld` there, with an `index.json`
copy beside it. A `.jsonld` gets a `.json` copy with the same bytes beside it,
because many hosts serve `.jsonld` as a download. The `.jsonld` stays the real one: it is what the
`@id` names.

## Two checks, four states

| step | checks | done | not done | could not determine |
|---|---|---|---|---|
| `schemas:staged` | the site build puts each document at its address | every one is there, byte for byte | one is missing, or another file holds its address | the build could not run |
| `schemas:published` | each address answers | every one answers | one answers 404 | 403, 407, 5xx or no answer: that is about the way from here (a proxy, an access rule), not about the address |

## The site is the vehicle

The documents get to their addresses by the Pages site
([`publish-site`](publish-site.md)): its workflow stages each one where its
IRI says, and lists them all under "Published documents" on the README page (`README.html`).
When `schemas:published` is not done, the site steps are how it gets done.
The site is not the goal: a site that answers while one schema address does
not has not finished initializing the harness.

Where a toolset is available, its site check (`site.ts --check`) lists every address
and what is staged at it, and `init.ts` reports both steps first.
