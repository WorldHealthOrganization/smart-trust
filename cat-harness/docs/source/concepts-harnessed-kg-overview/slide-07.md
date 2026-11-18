**BPMN execution skill:** given a process, context, state and role, use one or
more skills to execute a task.

- **Deterministic end:** managed agent execution of a single task. The tool is
  any open-source BPMN engine, and state and swimlanes are strictly enforced.
- **Agentic end:** agents work across most or all tasks. The tool is an agentic
  swarm with ungoverned state. Agents "relax" swimlanes, and mechanical plus
  agentic QA/QC reports mitigate it.

![BPMN execution, from deterministic to agentic: a blue-to-green bar; on the left the folio lifecycle flat, with one task at a time; on the right the same lanes in perspective with work items scattered across every lane and cat-robots beneath.]({{ '/assets/img/bpmn-execution-spectrum.webp' | relative_url }})

**What the two halves place where.** On the deterministic side the human and
the agentic actor stand *beside* the flat diagram's lanes, with one sticky note
on the authoring task and one work item on the test task: one task at a time, each
state marker where its task is. On the agentic side the human rides *above* the
board, a row of agents hangs *beneath* it, and work items lie in every lane.

**Sources:** [BPMN execution](agentic-harness.html);
[`specification-compiled-agents`]({{ '/methodologies/index.html' | relative_url }}) (which cites this deck).

> **Partly built:** no BPMN engine is wired in, and the agentic QA/QC report
> does not exist yet. The mechanical one does: `bun run cat prov:qaqc`.
