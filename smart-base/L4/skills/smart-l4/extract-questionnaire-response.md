---
name: extract-questionnaire-response
description: >
  The point-of-care system turns a completed QuestionnaireResponse into the
  FHIR resources it stands for, by the extraction its SDC Questionnaire
  declares (StructureMap-based, definition-based or observation-based
  $extract), and saves them. Input is the response and its Questionnaire;
  output is a transaction Bundle. Generic for any DAK form.
input: L4/schemas/skills/extract-questionnaire-response/input.schema.json
output: L4/schemas/skills/extract-questionnaire-response/output.schema.json
---

# Extract resources from a questionnaire response

> Skill id: `extract-questionnaire-response` · Package: `authoring-who-smart-guidelines` ·
> Task `Task_Extract` of
> [`questionnaire-data-capture.bpmn`](../../processes/questionnaire-data-capture.bpmn)
> (`Process_QuestionnaireDataCapture`), lane `point-of-care-system`.

**Performed by a system**: the app or EHR the health worker filled the form
in. It decides nothing clinical; it carries out the mapping the form
declares.

The operation is SDC
[`$extract`](https://hl7.org/fhir/uv/sdc/extraction.html). Which of its
methods applies is declared by the Questionnaire, never chosen here:

| the Questionnaire declares | method |
|---|---|
| `sdc-questionnaire-targetStructureMap` (profile `sdc-questionnaire-extr-smap`) | StructureMap-based: the map's FHIR Mapping Language, as WHO's immunization DAK maps `IMMZ.C4` to a Patient and `IMMZ.D1` to a Bundle |
| `sdc-questionnaire-itemExtractionContext` / `definitionExtract` | definition-based |
| `sdc-questionnaire-observationExtract` | observation-based |

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/extract-questionnaire-response/input.schema.json)
and [`output.schema.json`](../../schemas/skills/extract-questionnaire-response/output.schema.json).

- **In:** the completed `questionnaireResponse` and the `questionnaire` it
  answers.
- **Out:** a transaction `bundle` of the extracted resources, each linked to
  the response by a Provenance or `derivedFrom` where the method provides
  one; `issues` when the map or the definitions could not be applied.

## Preconditions

- The response is `completed` ([`complete-sdc-questionnaire`](complete-sdc-questionnaire.md)).
- The Questionnaire declares an extraction. One that declares none is not
  extracted: the process's gateway stores the response as it is.

## Success criteria

- The Bundle is what the declared method produces from this response, and
  nothing else: no resource is added by guesswork.
- It validates against the profiles the DAK names, and it is saved as one
  transaction (offline, it is queued whole and synchronised later).
- A failure leaves the response stored and returns the `issues`; nothing is
  half-written.
