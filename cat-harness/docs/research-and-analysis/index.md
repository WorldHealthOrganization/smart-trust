---
title: "Research and analysis"
kind: research
summary: >-
  Index of research and analysis — surveys of prior art, measurements and comparisons that inform a decision without proposing one.
parent: ""
has_children: true
---

# Research and analysis

Findings gathered to inform a decision, **not** a proposal of what to build.
The sibling [Proposals]({{ '/proposals/' | relative_url }}) section sets out options and what each
costs; this one records what was found out — about other projects, about
tools a skill could be satisfied by, about the repository itself.

Every page here follows the design-record rules in the `placement` skill: it
is **dated**, it says what it was true **of** and where each fact came from,
and it names what it **could not establish**. A survey of other projects goes
stale faster than anything else in `docs/`, so read its date before its
conclusions.

A finding that changes how agents work does not stay here: its rule moves into
the skill it governs, and this page keeps the evidence.

| page | question |
|---|---|
| [Prior art](prior-art.html) | Are other open-source projects taking a similar approach? Eighteen projects across skills, work plans, roles and processes, agent frameworks, and documents with and without formal backing, each checked against its own repository on 2026-09-23. **None combines all of it**; the nearest per axis are Superpowers, Beads, BMAD-METHOD, Camunda and leanblueprint. Includes a work items ↔ Beads health comparison (rechecked 2026-10-24) |
| [Table-of-contents extraction](toc-extraction.html) | Which way of inferring a PDF's table of contents works when the PDF has no outline? Five methods scored on 2026-10-06 against the 13 corpus PDFs that carry one, outline hidden as the answer key. **Layout — a printed contents page, else heading styles from font metrics — reaches title F1 0.88, the consensus of all methods 0.92 — 0.83 on 20 held-out PDFs — against 0.30** for the text patterns it replaced; Grobid measured at 0.59 (CRF models); Nougat handed to an agent with network access |
| [Forced along a BPMN vs managing it](bpmn-forced-vs-managed.html) | When the same BPMN diagram (`test-plan-execution.bpmn` + `qa-report-signing.bpmn`) is run over the same 10-case task bank under token-machine step enforcement (`forced`) vs handing the full diagram in context (`self-managed`), do outcomes change, and at what compute?. **Not yet answered: the two-arm runner exists, but so far (2026-10-26) it has been run only with a simulated agent (a hand-written step script), not a model.** That run shows the token machine refuses every scripted shortcut, the forced arm's per-turn prompt is about 31× smaller (byte-count estimate), and the `folio-test-run/v1` two-hash split works; its outcome rates hold by construction and are not evidence about models |
