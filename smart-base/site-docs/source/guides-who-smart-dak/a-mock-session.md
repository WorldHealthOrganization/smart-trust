> **You:** Plan the L2 DAK for the immunization guideline — I need the
> "administer vaccine" process and the "is the client due" decision.
>
> **Assistant:** *(loads `content-plan`)* Proposed: 1 BPMN process
> `administer-vaccine`, 1 DMN decision `client-due-for-vaccine`, 4 core data
> elements (client id, antigen, dose number, date administered), 1 value set
> (antigen codes). Scaffold it?
>
> **You:** Yes.
>
> **Assistant:** *(loads `bpmn-authoring`, `dmn-authoring`, `l2-dak-authoring`)*
> Created the BPMN with start → check eligibility → administer → record, the DMN
> table keyed on age/last-dose, and the data dictionary. *(calls
> `content_validate`)* All artifacts valid.
