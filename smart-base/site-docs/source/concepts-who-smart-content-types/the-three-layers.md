WHO SMART Guidelines names **five** knowledge layers. FHIR content lives in
the first three, and those three are the clearest available vocabulary for
FHIR content generally:

| layer | what it holds | form |
|---|---|---|
| **L1** Narrative | narrative guidance — the publication a recommendation comes from | prose, figures, tables |
| **L2** Operational | the Digital Adaptation Kit — its ten components, from health interventions to test scenarios | BPMN, DMN, structured tables |
| **L3** Machine readable | the FHIR Implementation Guide | FSH → FHIR resources |
| L4 Executable | reference applications and services that execute the static algorithms | software |
| L5 Dynamic | dynamic algorithms trained and optimised on data — the precision-health model | models, analytics |

The five names and their meanings are from the WHO *Digital transformation
handbook for primary health care* (2024), §1.2 pp. 20–21
(`who-iris/library/9789240093362-eng`). Its ref. 18 is the primary source:
Mehl G. et al., *WHO SMART guidelines: optimising country-level use of
guideline recommendations in the digital age*, Lancet Digital Health
2021;3(4):e213–e216 (`smart-base/library/mehl-2021-who-smart-guidelines`,
CC BY 3.0 IGO), which presents the same five as "knowledge layers (L1–L5)".

**This page stops at L3.** L4 and L5 are software and trained models. They
consume what L1–L3 publish, but they are not authored as FHIR content, so
nothing in this platform validates them as content.

**They are knowledge layers, not stages.** All three are live at once: an L2 decision
table and the L3 `PlanDefinition` derived from it are both published and both
can change. Treating L2 as scaffolding that L3 replaces lets the two drift
apart unnoticed. A repository layer may also hold any one of the three
knowledge layers without the others: an L1 corpus with no DAK, or an IG with no L1.

**The SMART knowledge layers are not the platform's layers.** `cat-harness`, the content
core and the science layer are layers of *this software*; each depends on the
one before and inherits its skills and directories. L1–L5 are *knowledge
layers*, layers of guideline knowledge. A WHO folio holds L1–L3 *content*; the platform layers
author and check it, and none of them is "the L2 layer". The deck that sets
the two side by side is `cat-harness/library/content/kg-folio-asst-2026-09-30`
(slide 1).
