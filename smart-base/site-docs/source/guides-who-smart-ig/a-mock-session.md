> **You:** Generate the FHIR profile and value set for the immunization data
> dictionary from the L2 DAK, then build the IG.
>
> **Assistant:** *(loads `l3-fhir-authoring`)* Authored `ImmunizationRecord`
> profile + `AntigenCodes` value set as FSH. *(runs SUSHI)* Compiled to FHIR R4.
> *(loads `fhir-validation`)* Validator: 0 errors, 2 warnings. *(loads
> `ig-publication`)* Built the IG with the HL7 publisher — site is in `output/`.
>
> **You:** Show me the QA report.
>
> **Assistant:** *(loads `quality-control`)* QA: broken links 0, profile
> conformance ✓, terminology bindings resolved ✓.
