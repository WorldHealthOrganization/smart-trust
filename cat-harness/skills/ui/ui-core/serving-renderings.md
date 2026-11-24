---
satisfies:
  - "req:serving-a-rendering#declared-media-type"
---

# Serving a rendering — endpoints, MIME types, and what each host can enforce

A **rendering** is what a layer publishes about itself. Running it produces
**one or more endpoints under that layer's stub**, and every endpoint has a
media type that says what it is.

This skill is about serving: the rendering already knows what it produced, and
the server must say so, or a `.jsonld` arrives at a client as `text/plain`.

## One stub, several endpoints, per layer in the tree

`artefactStub()` in `schemas/kg/cat-harness.ts` is the stem: `stub` when declared,
otherwise `name`. Every artefact a layer publishes is named with it, so a
reader who knows the repository knows the filename.

The dependency tree is **a set of overlaying layers**, and each renders under
its own stub, so an overlying layer depending on `cat-harness` means both are
present, and both publish.

```
<base>/<name>/<stub>.jsonld      the knowledge graph        application/ld+json
<base>/<name>/<stub>.json        the same bytes             application/json
<base>/<name>/<kind>/<id>        each subject's page        text/html
<base>/<name>/<stub>.schema.json its declaration's schema   application/schema+json
<base>/<stub>/                   the viewer                 text/html
```

So `…/folio-assistant/harness.jsonld` is the *cat-harness* layer's
rendering, served from a tree whose root happens to be `folio-assistant`. A
consumer asking for one layer's graph must not be handed another's because
the paths collided.

**The graph sits under the layer's own directory, the host's included.**
There is one rule for every layer, with subjects beside their document, so a
subject's page `<base>/<name>/<kind>/<id>` sits next to the document that names
it. Where each document goes:
[`instance-publication`](../../kg/kg-core/instance-publication.md) §"What each
layer publishes".

**`<stub>/` is a directory because an extensionless URL has to be.** GitHub
Pages resolves `<base>/<stub>` only to a directory index, so the viewer is what
makes the bare stub openable. It climbs to the site root and reads the
document's own path, `<name>/<stub>.jsonld` (`exportIdentity`'s `docPath`).
It never composes a neighbour's name, because that relation is not stable
across layouts.

**One function computes all of this**, `renderingPath()` in
`schemas/kg/cat-harness.ts`. A path a consumer dereferences — or mints as an
`$id` — is never written out as a template literal elsewhere, so moving the
renderings is one edit rather than a hunt for copies.

## Every endpoint declares its media type

The declaration is part of the rendering, not of the server. A server is one
consumer of it; an MCP server is another; a `Link:` header generator is a third.
Writing the type at each of them is three places to disagree.

| extension | media type | why not the obvious one |
|---|---|---|
| `.jsonld` | `application/ld+json` | **not** `application/json`. A JSON-LD processor keys off this type to know the document carries a `@context` |
| `.schema.json` | `application/schema+json` | `application/json` parses, but loses that it is a schema |
| `.json` | `application/json` | |

## What each host can enforce — three states, and they are not degrees

**A local HTTP deployment enforces it.** It reads the declared type and sets
`Content-Type`. This is where the declaration is honoured exactly.

**An MCP server enforces it.** When it serves a rendered artefact it uses the
declared default media type rather than guessing from the extension — the
declaration is right there, and guessing is how `.jsonld` becomes
`application/octet-stream`.

**GitHub Pages does not, and cannot be made to.** Pages serves by its own
extension table with no per-file configuration: no `.htaccess`, no headers
file, no way to say `application/ld+json`. An unknown extension is served as
`application/octet-stream` or `text/plain` depending on the extension.

That third row is **not a failure to fix**. It is a property of the host, and
the honest handling is the one this repository applies everywhere else:

- **Do not pretend.** A tool reporting "served with the declared type" must not
  say so for a Pages URL it did not check.
- **Do not fall back to a guess that looks authoritative.** "Probably
  `application/json`" is worse than "this host does not declare one", because
  the first is quoted and the second is investigated.
- **Report "could not enforce" as its own state**, distinct from "enforced" and
  from "enforced wrongly".

The architectural boundary between what a static host and a local dynamic server
can enforce is part of deployment awareness — see `deployment-awareness` (opt-in `cat-harness.platform-ui`)
for the four deployment surfaces, their constraints on tool usage, and why render-time
escaping is the required line of defence on static hosts.

## Consequences a consumer must expect

A client fetching `<stub>.jsonld` from Pages **will** receive the wrong
`Content-Type`. A strict JSON-LD processor may refuse it. That is a known and
accepted cost of publishing there, and the remedy is the local deployment.

**`<stub>.json` is an alias, not a rename.** The same bytes are served at BOTH
extensions: `.jsonld` stays canonical and is what every `@id` in the document
names, while `.json` is the one path by which a correct `Content-Type` can come
out of a static host. Renaming the artefact to `.json` instead would trade a
wrong type for a wrong *name*, and the name is the part a reader uses.

What that does **not** license is a `.json` whose bytes differ, or an `@id`
pointing at it. Two documents asserting the same IRIs is the defect
`--base-url` exists to prevent, and an alias is only an alias while it is
byte-identical — which is why the staging build copies it *after* stamping,
so the two cannot disagree about which build they came from.

## Running one — `serve-rendering`

The media types and the per-host rules are the contract, in code; the server
is one implementation that reads it.

```sh
bun run cat serve:rendering --dir docs/_site            # one site at /
bun run cat serve:local --repos <repo-a>,<repo-b>       # several, fetched from gh-pages
```

The default address is **`http://127.0.0.1:4007`** (port 4000 is `jekyll
serve`'s). Use `127.0.0.1`, not
`localhost`: the two are different origins, so cookies, storage and service
workers split between them, and `localhost` may resolve to IPv6 `::1` first.
The server sends `localhost` and `[::1]` requests to `127.0.0.1`.

### Several sites on one origin, as Pages lays them out

`--mount /<repo>=<dir>` (repeatable) serves each built site under its own
prefix, so root-relative links and IRI paths line up with
`https://<owner>.github.io/<repo>/`. It copies the Pages behaviours links
depend on: `<dir>` redirects to `<dir>/`, `/page` serves `page.html`, and a
miss serves the site's own `404.html`. `branches/<branch>/` previews in a
gh-pages checkout need no extra rule.

### Published IRIs open the local copy

For each mounted repo, text responses have the published base
`<origin>/<repo>` replaced by the local one as they are served. Files on disk
never change. Whole path segments only (`/a` never touches `/ab`), and a
repo that is not mounted keeps its live links. `<origin>` is the declared
`canonicalUrl`'s origin; `--iri-origin` overrides it and `--iri
/<prefix>=<base>` adds a base on another host. `Accept: application/ld+json`
on an extensionless IRI serves its `.jsonld` sibling, which Pages cannot do.

**Rewriting changes bytes.** Check signatures and digests with
`--no-rewrite`; a rewritten response carries `X-Rendering-Rewritten: iri`.

### One command — `serve:local`

`--repos a,b` fetches each repo's `gh-pages` branch into a cache (shallow,
blob-less, sparse, updated each run) and serves them all. `branches/` is left
out unless `--staging <branch>` names a preview; a repo with no published
main site lists its previews. `--site <repo>=<dir>` serves a site you built
yourself, for changes not yet published. `--offline` uses the cache as it is.

`RENDERING_MEDIA_TYPES` and `renderingMediaType()` in `schemas/kg/cat-harness.ts`
are the table, beside `renderingPath()`, because where a rendering LIVES and
what it IS are the same kind of fact, and a table in code is one no consumer
has to re-derive from prose.

Obligations are `skills/requirements/serving-a-rendering.json`, so a second
implementation is checkable against the requirement rather than against this
one's source.

### What a general-purpose static server actually gets wrong

Less than is often assumed, and overstating it is how a working setup gets
ruled out: Python's `mimetypes` and `Bun.file().type` both resolve `.jsonld`
to `application/ld+json`.

The gap is **one row**: `.schema.json` resolves to `application/json` in every
OS table, because `.json` is the suffix that matches and nothing knows the
compound extension means a schema. Hence longest-extension-first, and hence a
declared table rather than the filesystem's.

### Containment is part of the contract

A symlink inside the served root can point at a file outside it: the URL is
clean, so a lexical path check passes, and `resolve()` never touches the
filesystem. Real paths must be compared. This matters most for the
`self-sovereign` topology, whose published directory sits beside data nobody
intends to publish.

The server binds **loopback** unless told otherwise, for the same reason.
