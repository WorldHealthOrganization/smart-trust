1. **Plan** — `content-plan`: enumerate the processes, decisions, and data
   elements the guideline implies; identify actors (business analyst, clinical
   SME, terminologist).
2. **Author business processes** — ask the agent to draft BPMN for each clinical
   workflow (`bpmn-authoring`); it produces valid BPMN 2.0.
3. **Author decision logic** — capture recommendations as DMN decision tables
   (`dmn-authoring`), linked to the data dictionary.
4. **Author the data dictionary** — define core data elements with types,
   cardinality, and terminology bindings (`l2-dak-authoring`).
5. **Manage terminology** — define code systems / value sets and bind them
   (`terminology-management`).
6. **Validate & review** — `content-validate` then `content-review` against the
   DAK criteria.
