A Knowledge Graph is **managed in git repositories, comprised of self-documenting
JSON-LD**, and rendered into whatever formats a downstream knowledge product,
public-health system, clinical system or personal-health application needs.
That makes a repository the unit of distribution, and repositories come in four
classes. A class is defined by what it is ALLOWED to do, not by what it happens
to contain.

### Content repositories

Where the Knowledge Graph itself lives. A Content repository:

- MAY define Schemas for the Content types of a Knowledge Graph's nodes.
- MAY instantiate instances of those Content types.
- MAY define the Skills needed to publish and consume those instances.
- MAY designate a Skill as mechanical, as human, or as either.
- **MUST constrain a Skill's inputs and outputs with Schemas.**

That last clause is the only absolute requirement in the model. A Skill is a
**Capability with defined inputs and outputs**; a Tool claims to satisfy a
Skill; a Test claims to exercise one. If the Skill's boundary is not written
down as a Schema, "does this Tool satisfy that Skill?" has no answer anyone can
check, and the agentic-to-deterministic comparison the Tool and Test classes
exist for cannot be run at all.

### Tool repositories

Where the mechanisms live, out of the Content repository on purpose. A Tool
repository:

- MAY implement a Skill through coordinated use of Tools — scripts, retrieving
  and running software, remote or local services, containers.
- MAY expose Tools to agents as MCP services.
- MAY expose a Tool for local execution.
- MAY configure Tools for a test harness.
- MAY define **more than one Tool for one Skill**.

The last one is the point of the separation rather than an allowance. Several
Tools for one Skill is what lets the same Capability be exercised at different
points on the spectrum from fully deterministic to fully agentic, and compared.

### Test repositories

Where adjudication, quality control and compliance testing live. A Test
repository:

- MAY contain test data.
- MAY contain test-data generation templates and configuration data.
- MAY define Test Plans.
- MAY define test-language dialects such as Gherkin.
- MAY make test data available to a test harness, or to a subject-matter expert
  or author for review.

### Consumer applications

The downstream end. A consumer application:

- MAY use a Knowledge Graph's Schemas and instance data from a Content repository.
- MAY execute decision logic or indicator calculation from a Content
  repository.
- MAY use Test and Tool repositories when building, preparing for a
  connectathon, or compliance-testing.

### Three relations run between repositories

Each edge has its own carrier in the declaration:

| relation | runs | carried by |
|---|---|---|
| **depends** | Content → Content | `needs` in the declaration — the layer stack, foundation first |
| **references** | Tool → Content, Test → Content | `remoteGraphs` — a graph this layer knows about and does not hold |
| **utilizes** | Tool → Tool, Test → Tool, App → Content, App → Test | `dependencies` in the config — what this layer USES, overlaid |
| **associated** | any harness ↔ any harness | `associatedHarnesses` — a harness this one knows, and where it is published; never loaded or materialized (skill `associate-harness`) |

**Associated is a fourth, and it fixes no order**: it is how a folio in another repository, such as `ihris`, is listed without being built here.

**The three answer different questions**, so collapsing them loses information a consumer needs. *Depends* is about layering: it fixes an order, so
a cycle in it is a defect. *References* is about knowing a graph exists without
holding it, so it crosses a repository boundary by definition. *Utilizes* is
about consumption at run time, and a consumer application may utilize a Content
repository it has no dependency on whatsoever.
