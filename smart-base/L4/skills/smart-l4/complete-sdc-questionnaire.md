---
name: complete-sdc-questionnaire
description: >
  A health worker (or a client, on their own device) completes a FHIR R4
  Questionnaire conforming to Structured Data Capture as their device renders
  it, and the result is a QuestionnaireResponse. Generic for any DAK form: a
  registration, a visit, a referral. Input is the Questionnaire as rendered,
  with any pre-populated answers; output is the completed
  QuestionnaireResponse.
input: L4/schemas/skills/complete-sdc-questionnaire/input.schema.json
output: L4/schemas/skills/complete-sdc-questionnaire/output.schema.json
---

# Complete an SDC questionnaire

> Skill id: `complete-sdc-questionnaire` · Package: `authoring-who-smart-guidelines` · Task
> `Task_Complete` of
> [`questionnaire-data-capture.bpmn`](../../processes/questionnaire-data-capture.bpmn)
> (`Process_QuestionnaireDataCapture`), lane `health-worker`.

**Performed by a person**: the health worker, or a client filling in a form
on their own device. Their device's form filler does the rendering; this
skill is what the person does with it and what the result must be.

The meaning of every element is the FHIR R4
[Questionnaire](https://hl7.org/fhir/R4/questionnaire.html) and
[QuestionnaireResponse](https://hl7.org/fhir/R4/questionnaireresponse.html)
and HL7 [Structured Data Capture](https://hl7.org/fhir/uv/sdc/) (SDC): this
skill restates none of it. A DAK's forms are SDC Questionnaires (for example
`sdc-questionnaire-extr-smap` in WHO's immunization and HIV DAKs); a form that
is not cannot be completed by this skill.

## Input and output

The contract is [`input.schema.json`](../../schemas/skills/complete-sdc-questionnaire/input.schema.json)
and [`output.schema.json`](../../schemas/skills/complete-sdc-questionnaire/output.schema.json).

- **In:** the `questionnaire` (a FHIR R4 Questionnaire resource), how it is
  `renderedOn` (form factor, language, whether offline), and, when the form
  is about someone, the `subject` and the SDC `launchContext` values; any
  `prepopulated` QuestionnaireResponse that SDC `$populate` or the device
  filled in before the person saw the form.
- **Out:** the `questionnaireResponse`, and the `issues` the form filler
  raised that the person chose to leave (only for a response saved
  `in-progress`).

## Preconditions

- The Questionnaire is `active` (or `draft`, in a test), and the device
  renders it whole: no item is silently dropped.
- When the form has a `subject`, the person has identified the client.

## What the person does

1. **Read what is shown.** Pre-populated answers are proposals: confirm or
   correct each one; the form filler marks none as confirmed for them.
2. **Answer the enabled items.** An item whose `enableWhen` (or SDC
   `enableWhenExpression`) is false is not shown and gets no answer.
3. **Satisfy the form's checks before submitting**: every enabled `required`
   item is answered; each answer has the item's type and stays within its
   `answerOption`/`answerValueSet`, `maxLength`, and SDC `minValue`,
   `maxValue` and `regex` constraints.
4. **Submit**, which marks the response `completed`. Leaving it unfinished
   saves it `in-progress`, and nothing downstream reads it as complete.

## Success criteria

- `questionnaireResponse.questionnaire` is the Questionnaire's canonical
  (`url|version`); `subject` is the client the form is about.
- `status` is `completed`, every enabled `required` item has an answer, no
  disabled item has one, and every `linkId` is one of the Questionnaire's.
- The response validates against the Questionnaire (SDC
  [form behaviour](https://hl7.org/fhir/uv/sdc/behavior.html)).

## What it does not do

Creating the client's resources from the answers is the system's step,
[`extract-questionnaire-response`](extract-questionnaire-response.md). Authoring
or reviewing the form itself is fhir-harness's `fhir-questionnaire-wireframe`.
