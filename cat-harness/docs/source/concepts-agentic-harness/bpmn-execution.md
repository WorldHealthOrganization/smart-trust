The skill this spectrum is about:

> **BPMN Execution Skill:** given a Process, Context, State and Role, utilize
> one or more Skills in order to execute a Task.

![BPMN execution, from deterministic to agentic. A colour bar runs from "deterministic" (blue, left: managed agent execution of a single task) to "agentic" (green, right: agents across most or all tasks). Left, under a gear-and-engine icon: "BPMN Execution Tool: one of any open-source BPMN engines, state and swimlanes strictly enforced", over a flat swimlane diagram of the folio lifecycle with one sticky note, one work item cluster, a person and a cat-robot beside the lanes. Right, under a cat-robot icon: "BPMN Execution Tool: agentic swarm with ungoverned state. Agents 'relax' swimlanes, mitigated by mechanical + agentic QA/QC reports", over the same diagram tilted in perspective, work items scattered across every lane and many cat-robots beneath it.]({{ '/assets/img/bpmn-execution-spectrum.webp' | relative_url }})

**One skill, two kinds of Tool.** The skill is the same at both ends: take the
process, the context, the current state and the role, pick the skills, and do
the task. What changes is the **Tool** that runs it, and a Tool is swappable
behind a skill in the way every other Tool here is.

| | deterministic end | agentic end |
|---|---|---|
| **Tool** | any open-source BPMN 2.0 engine | an agentic swarm |
| **Scope of an agent** | one task at a time, handed to it by the engine | most or all tasks |
| **State** | held by the engine, strictly | ungoverned: the swarm holds it |
| **Swimlanes** | enforced: only the lane's role may perform its task | relaxed: an agent may act across lanes |
| **What keeps it honest** | the engine refuses a step before it happens | mechanical + agentic QA/QC reports find it after it happened |

**The two ends differ in *when* a rule is checked, not in *which* rule.** The
same process, the same roles and the same permissions govern both. The engine
checks them **before** a task starts and refuses; the swarm acts and a QA/QC
report checks them **after**, from the record of what was done. That needs the
rules and the record to be data a report can read:
[W3C ODRL 2.2](https://www.w3.org/TR/odrl-model/) is the permission language
and [W3C PROV-O](https://www.w3.org/TR/prov-o/) the execution log.

**Most real runs sit between the ends**, and per task rather than per process:
the [previous section](#deterministic-and-agentic) already counts which
gateways are computed and which are judgement calls. A signing step can be
engine-enforced inside an otherwise agentic run, and that is a property of the
task, not of the whole diagram.

**Partly built.** No BPMN engine is wired in. The mechanical QA/QC report is
`bun run cat prov:qaqc`: it writes each workflow instance's history as a PROV-O
log and re-checks every step against the ODRL policies, as advice (the
`task-authorization` skill). The agentic QA/QC report does not exist yet.
