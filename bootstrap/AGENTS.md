# AGENTS.md — bootstrap

You are in a repository that may not be set up as anything yet. Read
[`README.md`](README.md) next: it is the whole of what bootstrap asks of you,
and this file does not repeat it.

What you can rely on here is files, and nothing else:

- no program is installed, and nothing in this directory runs;
- every term the README uses is defined in
  [`schemas/graph.schema.json`](schemas/graph.schema.json);
- the steps you follow are drawn in
  [`processes/initialize-harness.bpmn`](processes/initialize-harness.bpmn),
  and each step names the `.md` instructions to read in [`skills/`](skills/).

If you find yourself reaching for a rule about content, review, translation or
quality checks, **stop**: that rule belongs to the Harness you are about to set
up, not to bootstrap. Set it up first, then read its own instructions.

---

*A declared file of bootstrap ([`bootstrap.json`](bootstrap.json), role
`agent-instructions`). It is copied into repositories being set up, so it
carries where it came from and can be checked against this copy.*

## The skills this layer publishes

<!-- skills:index:begin -->

_13 skills in 1 directory, generated from each skill's front matter. `bun run cat readme:sync` rewrites this list and `readme:sync:check` fails when it is stale. Skills this repository inherits are listed by the repositories that publish them._

**`skills/`** (13)

| Skill | What it is for |
|---|---|
| [`bootstrap-graph-emission`](skills/bootstrap-graph-emission.md) | What bootstrap's own Knowledge Graph must be when it is written out as a data file, `.jsonld` with a `.json` copy. |
| [`bootstrap-graph-publication`](skills/bootstrap-graph-publication.md) | Where bootstrap's Knowledge Graph file is published, why its `@id` must be exactly that address, why a `.json` copy sits beside the `.jsonld`, and why the file is not kept in the repository. |
| [`bootstrap-kg-navigation`](skills/bootstrap-kg-navigation.md) | Read and navigate a knowledge graph with nothing installed — no MCP server, no tools, no harness. |
| [`confirm-harness`](skills/confirm-harness.md) | Narrow the harnesses and locations this could be, then have the Requestor settle it. |
| [`discussion`](skills/discussion.md) | Settle which harness, and which repositories, when no file says: the output is a document conforming to `discussion.output.schema.json`. |
| [`human-agent-discussion`](skills/human-agent-discussion.md) | Ask a person (or a sibling agent) for what no file holds. |
| [`initialization-steps`](skills/initialization-steps.md) | Walk every initialization step the declarations name (the instance's own and each one it needs), check each before doing anything, do what can be done, ask for what only a person can do, and report… |
| [`knowledge-graph-data-store`](skills/knowledge-graph-data-store.md) | The contract a Knowledge Graph Data Store keeps: serve a declaration, its graph and its instructions exactly as committed, say plainly when a file is absent, and keep a new instance's declaration… |
| [`log-message`](skills/log-message.md) | Say what you are doing, to the Logger, in a form a reader can act on. |
| [`logger`](skills/logger.md) | The contract a Logger keeps: accept a complete log message, record it unchanged where a person can read it, attributed to the actor the message names. |
| [`publish-documents`](skills/publish-documents.md) | The primary step of initializing a Knowledge Graph harness: every JSON Schema and JSON-LD document it names an address for (schemas, vocabulary, diagram vocabulary, graph export, each with its… |
| [`publish-site`](skills/publish-site.md) | Give an instance a site: its Knowledge Graph rendered for publication at its site address, and the address answering. |
| [`root-readme`](skills/root-readme.md) | Write the repository's root README when there is none, carrying a link to the harness that was installed and the overall install status. |

<!-- skills:index:end -->
