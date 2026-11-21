Exclusive gateways do not all ask the same kind of question. `Accept, revise or discard?` is the editor's call.
`Build green, no sorries?` is arithmetic over `lean_build` and `proof_status`.

A gateway carrying `<cat-harness.processes:decision ref="decisions/x.dmn#Decision_Id"/>` has its
outcome computed from a **DMN decision table** under
a `decisions/` directory beside the diagram (here,
[`collab/processes/content/decisions/`](https://github.com/litlfred/folio-assistant-core/tree/main/processes/content/decisions)).
The agent supplies facts — `{ failCritical: 0, failMajor: 2 }` — and the table
returns the branch; `workflow_complete` refuses a hand-supplied outcome there,
and records which rule fired.

| Gateway | Table | Reads |
|---|---|---|
| `Build green, no sorries?` | `lean-build-gate.dmn` | `buildOk`, `deferredSorries` |
| `Draft QA green?` | `draft-qa-gate.dmn` | `failCritical`, `failMajor` |

`QC clean?` and `FHIR valid?` are equally mechanical but have no table yet: no
tool emits the facts one would read.
