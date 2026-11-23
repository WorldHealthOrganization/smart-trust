Ingestion never edits corpus content. It produces L1 records; authoring and
review consume them through the ordinary flow in
[the publication workflow](../process/publication-workflow.html), where a change to a
content block goes through validation, findings, and an editor's decision.

One coupling: a drop into `uploads/` **during** an editing
session starts ingestion in the background. The editor is not blocked, and the
new source becomes citeable when the gate passes — not before.
