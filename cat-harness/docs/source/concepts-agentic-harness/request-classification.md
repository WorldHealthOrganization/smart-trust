Every user request is classified into one of these categories. The
classification determines which workflow the agent enters.

| Category | Description | Workflow entered |
|---|---|---|
| **Content authoring** | Write, edit, extend folio content (chapters, blocks, sections) | Authoring workflow (paper or document) |
| **Content review** | Review, validate, provide feedback on existing content | Content lifecycle / editing-HCI workflow |
| **Content ingestion** | Ingest a source document into the folio | Document ingestion workflow |
| **Feature request** | Request new platform capability (see [crdm-detect](https://github.com/litlfred/cat-harness/blob/main/skills/process/crdm/crdm-detect.md)) | CRDM requirements workflow |
| **Information request** | Ask about the platform, content, or process | No workflow — answer directly |
| **Tool invocation** | Run a specific tool (`content_validate`, `qa_sweep`, etc.) | No workflow — execute and report |
| **Work-plan management** | Create, update, or query work items | No workflow — execute and report |
| **Bug report** | Report broken behaviour in existing features | Triage: fix directly if small, CRDM if redesign needed |

### The feature-request detection rule

The critical classification boundary is between **content authoring** and
**feature request**. The `crdm-detect` skill
([`skills/process/crdm/crdm-detect.md`](https://github.com/litlfred/cat-harness/blob/main/skills/process/crdm/crdm-detect.md))
provides the detailed detection signals. The summary rule:

> If implementing the request would require changes to **folio-assistant**
> (the platform repository) rather than to a **folio repository**, the request
> is a feature, and the agent should enter the CRDM workflow.

When uncertain, the agent asks: "This sounds like it might need a platform
change — is that right, or is this something I can do within the current
content model?"
