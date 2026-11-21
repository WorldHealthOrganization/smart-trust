---
title: "Draft issue for SMART Base: a generic persona is a role, realised by systems"
description: "A DRAFT issue for the upstream WHO SMART Base IG, for the owner to file. Not filed."
status: draft
---

# Draft issue for SMART Base: a generic persona is a role

> **DRAFT, for the owner to file** against the upstream SMART Base IG
> (`WorldHealthOrganization/smart-base`). It has not been filed. The ingested
> copy in this repository is read-only and has not been edited.
> Approved for drafting by the owner on 2026-10-03
> ([#1984](https://github.com/litlfred/folio-assistant/issues/1984), bean `5blc`),
> as proposal 3 on [`dth-terms.md`](dth-terms.md#what-actor-means-and-what-each-layer-could-change).

## Title

State that a generic persona is a role, and that a system persona is realised
by deployed systems (aligning with the DPI-H Reference Architecture §3.7.2)

## Body

**What SMART Base says today.** The description of
`StructureDefinition/GenericPersona` reads: *"Logical Model for representing
Generic Personas from a DAK. Depiction of the human and system actors."*
`StructureDefinition/SGActor` is *"Structure and constraints for
ActorDefinition resources used in SMART Guidelines"*. Neither says whether a
persona is a **role** or a **participant**.

**Why this needs saying now.** WHO's draft *Reference Architecture and
Guidance for DPI-H* (DRAFT V1.0) cites SMART Guidelines as its worked example
of defining actors (§4.3.2, PDF pp. 106–107, line 292). It describes DAK
personas as *"depersonalised, context-free descriptions of the human and
system actors"*. Its conformance model (§3.7.2, PDF pp. 90–94, line 1015)
defines an actor as *"an abstract information-processing role"* that a
concrete system *realises* (line 1019). A DAK persona is depersonalised, so it
is already a role in that sense. Saying so would let a country connect its DAK
personas to the RA's conformance model without translating.

**Proposed change.** Descriptive text only; no element, binding or code
changes.

1. In `GenericPersona` (and the narrative introducing personas), add: *A
   generic persona is a role: a set of responsibilities, independent of any
   particular person or product. It corresponds to an actor in the sense of
   the DPI-H Reference Architecture §3.7.2.*
2. For system personas (the `DAK.Persona.System.*` instances, e.g.
   `DAK.Persona.System.ClientRegistry`, `DAK.Persona.System.EMR`), add: *A
   system persona is realised by the systems an implementation deploys. One
   deployed system may realise several system personas, and one system persona
   may be realised by several systems (the RA's realisation relationship,
   §3.7.2).*
3. In `SGActor`, add one sentence: *An ActorDefinition constrained by this
   profile expresses a generic persona, and is therefore a role, not a
   participant.*

**What this does not change.** No persona is renamed. The `SGPersonaTypes`
codes and the ActorDefinition structure are untouched. The change is
definitional text that ties two WHO publications together.
