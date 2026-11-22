---
name: bootstrap-kg-navigation
description: >
  Read and navigate a knowledge graph with nothing installed — no MCP server,
  no tools, no harness. Named `bootstrap-` so it
  cannot be confused with a navigation Skill of a Harness that is installed.
consulted: true
---

# Reading a knowledge graph before you have anything

**This skill assumes a text editor and nothing else.** No MCP server, no
skill-fetching tool, no work-plan store, no build. If those exist they are not yours to rely
on yet — see [`AGENTS.md`](../AGENTS.md).

## A graph is files that declare what they are

Three facts carry the whole model, and every one of them is checkable by
reading:

1. **A layer declares the directories it scans**, in its declaration at its
   root. Each entry is an id, a path, and the **kinds of graph** found there.
2. **A directory is a place to look, not a type.** One may hold more than one
   part of a graph, so the directory does not say what its files are —
   **the files do**, in their own front matter or `$schema`.
3. **Ids are stable across a relocation; paths are not.** An override matches
   on an entry's `id`, never its `path`. Matching on path turns one relocated
   graph into two, and every consumer then scans a directory that is not there.

**Two more words you will meet in a declaration.** A field this skill does not
describe is an **Extension**: a Harness added it, and you ignore it. A Harness's
own kind of declaration, which requires everything bootstrap's does and adds
Extensions, is a **Subkind** of bootstrap's: read it as bootstrap's, and it
still means what it says.

**Versions and addresses.** A declaration may state its `version`
(MAJOR.MINOR.PATCH) and an `iriBase`. Every identifier it mints, and every
page meant for a person, is then `<iriBase>v<major>/…`: the address carries
the major alone, so only a breaking release moves it. The exact release you
read is fixed by the pin that brought this repository to you, not by the
address. Bootstrap's own are in its declaration; read them there rather than
trusting a copy.

## Do this, in order

1. **Read the repository's declaration.** If there is none, this repository is not
   a layer yet, and that is the case bootstrap exists for.
2. **Find the entry whose `graphTypologies` name the kind you want.** In
   bootstrap they are named for what they hold: `skills`, `processes`,
   `scenarios` (the Roles), `schemas` and `models`. The entry's `path` is relative to
   the declaration.
3. **Read the files in that directory.** A markdown file declaring `name:` and
   `description:` in front matter is a **skill** — its body is the instruction
   you were looking for. A file declaring `$schema:` is stating that it is
   **something else**, and is not a skill however it is named.
4. **Follow a reference by id, not by path.** A node that names another names
   it by id; resolve it through the declaration rather than guessing a filename.

## What "I could not determine" means here

**An absent declaration and an unreadable one are different:**

| what you found | what it means | what to do |
|---|---|---|
| no declaration | not a layer yet | this is bootstrap's case — continue |
| a declaration that will not parse | a layer asserting something broken | **stop and say so**; do not fall back |
| a declared directory that is not there | the declaration is wrong | **stop and say so** — scanning nothing and reporting a clean run is the defect |
| no declaration for a kind you want | this layer has none of it | that is an answer, not a failure |

## What this skill is NOT

It does not describe what a Harness above bootstrap holds, such as its content
or its checks: those belong to the Harness you have not loaded yet. If you need
one of them to finish bootstrap, **the boundary is in the wrong place** — say
so rather than importing the definition.
