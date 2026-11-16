Users provide content and source material through multiple channels. The agent
should accept all of them and route them into the appropriate pipeline:

| Channel | Example | Routed to |
|---|---|---|
| **`uploads/` directory** | User drops a Word doc, PDF, Excel file | Document ingestion pipeline |
| **`library/` references** | User references an already-ingested L1 source | Direct citation in content |
| **`content/` edits** | User edits a `.md` block directly | Content authoring workflow |
| **GitHub issue attachments** | User attaches a file to an issue comment | Agent downloads and processes |
| **Chat upload** | User uploads a file in the LLM chat interface | Agent saves to `uploads/` or processes inline |
| **URL reference** | User pastes a link to a document | Agent fetches and ingests if appropriate |

### For CRDM specifically

During requirements gathering, user-provided content is **input to
requirements**, not content to author. The agent should:

1. Read and understand the provided material
2. Extract requirements-relevant information
3. Synthesise it into the needs statement or requirements document
4. Reference the source in the issue comment (with link or attachment)

Example: a user uploads a public consultation feedback Excel spreadsheet. The
agent does not try to ingest it as folio content; it reads the feedback items
and synthesises them into requirements for the review triage tool.
