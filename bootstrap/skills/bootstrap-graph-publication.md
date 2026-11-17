---
name: bootstrap-graph-publication
description: >
  Where bootstrap's Knowledge Graph file is published, why its `@id` must be
  exactly that address, why a `.json` copy sits beside the `.jsonld`, and why
  the file is not kept in the repository. Also what each subject in it is
  named: a path under the Harness's address, never a `#fragment` of the file.
consulted: true
---

# Publishing bootstrap's Knowledge Graph

## One address, and it must be the file's own name

    @id         <base>/bootstrap/bootstrap.jsonld
    served at   <base>/bootstrap/bootstrap.jsonld

The file names itself with its `@id`. If the address it is published at
differs, the `@id` leads nowhere. So the publisher derives the published path
from the `@id`, never the other way round, and there is exactly **one**
publisher: bootstrap's toolset, never bootstrap itself (FR-7). Only the
published build adds the commit and time it was made from (PROV, at the top
level).

The address follows the general pattern for anything a Harness publishes:
`<base>/<harness name>/<file>`, with `bootstrap` as the Harness name.

## Each subject's own address

The file names itself; it also names everything in it. A **subject** — a
Skill, a Process, a step or lane of a Process, a Role, a Subgraph, an Asset,
anything the Knowledge Graph holds except an arrow — is named by a path
under the Harness's address, **never by a `#fragment` of the file**:

    <base>/bootstrap/<kind>/<id>                       a subject
    <base>/bootstrap/bootstrap.jsonld#<kind>/<id>      not this
    <base>/bootstrap/bootstrap.jsonld/<kind>/<id>      not this either: a
                                                       host cannot serve a file
                                                       and a folder under one name

So a Skill is `<base>/bootstrap/skill/publish-site`: the folder the file sits
in, then the kind, then the id. Any other Harness does the same under its own
address, `<base>/<harness name>/<kind>/<id>`.

**The parts of a Process.** A step and a lane are subjects; an arrow is not:

    <base>/bootstrap/process/<process>/node/<step>     a step: its own address
    <base>/bootstrap/process/<process>/lane/<lane>     a lane: its own address
    <base>/bootstrap/process/<process>#flow/<arrow>    an arrow: a fragment of
                                                       the Process's own page

An arrow is the only `#fragment` allowed for anything a Knowledge Graph
holds. A path, because a fragment never reaches the server (following it
fetches the whole file, so the subject cannot have a page of its own), and
because paths nest (`…/process/<process>/node/<step>`) where fragments do not.

Vocabulary terms take paths too: `ns.jsonld` is the document at
`<iriBase>v<major>/ns/`, and each term is `…/ns/<Term>`.

**Every address has to load.** A static host does no redirects and no
content negotiation, so each subject gets **a file of its own**: a small page
at its path carrying it as JSON-LD, with a `.jsonld` beside it. The publisher
writes those files in the same change that starts using the path.

## The `.json` copy

    <base>/bootstrap/bootstrap.json

Many web hosts serve `.jsonld` as a download, so the `.json` copy is for a
person who clicks a link. **The `.jsonld` is the real one**: it is what the `@id` names, and
what a program following the `@id` receives.

## Not kept in the repository

The file is built when the site is published and is not committed. No step
of the [README](../README.md) asks a reader to open it, and a committed copy
could go out of date with nothing to notice.

## Related

- [`bootstrap-graph-emission`](bootstrap-graph-emission.md): what the file
  contains, and the four properties it holds
- [`publish-documents`](publish-documents.md): every address a Harness names
  must answer
