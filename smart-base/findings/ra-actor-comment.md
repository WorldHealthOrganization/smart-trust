---
title: "Draft public comment: the two senses of \"actor\" in the DPI-H Reference Architecture"
description: "A DRAFT comment on WHO's Reference Architecture and Guidance for DPI-H, DRAFT V1.0, for the owner to send. Not posted anywhere."
status: draft
---

# Draft public comment: the two senses of "actor"

> **DRAFT, for the owner to send.** Nothing here has been posted or submitted.
> Approved for drafting by the owner on 2026-10-03
> ([#1984](https://github.com/litlfred/folio-assistant/issues/1984), bean `5blc`),
> as proposal 2 on [`dth-terms.md`](dth-terms.md#what-actor-means-and-what-each-layer-could-change).

**Document:** *Reference Architecture and Guidance for Digital Public
Infrastructure for the Health Sector — A Digital Transformation Handbook for
Digital Public Infrastructure for Health (DPI-H)*, DRAFT V1.0.
Line numbers are the draft's own; page numbers are PDF pages.

## Summary

The draft uses "actor" in two different senses, and its glossary defines
neither. In §3.7.2 an actor is an abstract role that systems realise. In
§4.3.2 actors are the human and system participants in a transaction, named
alongside "the roles they play". A reader who meets §4.3.2 first takes an
actor to be a participant; §3.7.2 then defines it as the opposite, a role
that participants fill. We suggest three small changes that keep both
passages' intent and remove the ambiguity.

## The two senses, as written

1. **§3.7.2 "The model", PDF pp. 90–94, line 1015.**
   *"An actor is an abstract information-processing role — for example a
   Document Source or a Patient Demographics Consumer."*
   Line 1019: *"the system realises the actor."* §3.7.6, Table 3.7.2
   (PDF pp. 97–99, lines 1234–1240) lists "Actor (abstract role)" separately
   from "System realising an actor", and line 1234 calls the system an
   *"Application Component (system in an actor role)"*. This is the IHE sense:
   the actor is the role, and the system is what plays it.

2. **§4.3.2 "Actors and Roles: Defining Who Participates", PDF pp. 106–107,
   lines 286–287.** *"An implementable specification also defines the actors
   — both human and system — that participate in each transaction, and the
   roles they play."* Here the actors are the participants, and roles are
   something else that they play. Line 300's examples — *"the registrant, the
   verifying authority, and the consuming system"* — are roles in the §3.7.2
   sense.

3. **Glossary (front matter, PDF pp. 1–19).** There is no entry for "actor".
   The term is defined only in the body, at §3.7.2.

## Suggested changes

1. **Add a glossary entry for "actor"** that gives the §3.7.2 sense as the
   document's own: *an abstract information-processing role, independent of
   any product that fulfils it; a system realises an actor (see §3.7.2).*

2. **In §4.3.2, say "participants" where the human and system parties are
   meant.** For example, at lines 286–287: *"…also defines the participants
   — both human and system — in each transaction, and the actors (roles)
   they take."* The sentence then agrees with §3.7.2 and with the IHE usage
   Table 3.7.2 maps to.

3. **In §4.3.2, link the SMART Guidelines example to the §3.7.2 model.** The
   section already cites WHO SMART Guidelines as a worked example (line 292).
   One sentence would connect them: a SMART Guidelines generic persona, and
   the FHIR ActorDefinition that expresses it, is an actor in the §3.7.2
   sense, and a deployed system persona is realised by the systems an
   implementation deploys.

## Why it matters

Conformance is claimed *by a system, for an actor* (§3.7.2). If a country
reading §4.3.2 records its registrants and consuming systems as "actors" in
the participant sense, its conformance statements will name participants
where §3.7 expects roles. The two passages then cannot be read together
without a translation the document never gives.
