---
$schema: folio-methodology/v1
name: zero-trust-architecture
title: Zero trust architecture (NIST SP 800-207) — trust is never granted implicitly, it is evaluated per request at a decision point
origin: >
  NIST Special Publication 800-207, *Zero Trust Architecture*, by Scott Rose,
  Oliver Borchert, Stu Mitchell and Sean Connelly, August 2020,
  doi:10.6028/NIST.SP.800-207. **The primary is held, in full**, at
  `library/nist-sp-800-207`: 59 pages, 55 sections and all 12 figures
  described. The owner supplied it on 2026-10-07 after this container's
  network policy denied both NIST hosts. It is a US-government work: the PDF
  states it *"is not subject to copyright in the United States"* (p. i).
  Every quotation below is from that copy, cited by section id.
evidence:
  - library/nist-sp-800-207
applies-when: >
  **A participant is about to act on something another participant gave it,
  and the question is whether to trust it.** That covers an access decision
  at a boundary, a hand-over between agents, a tool or a dependency graph
  reaching this platform, and the design of a check that decides any of
  these. It answers *how trust is decided*: never by location, per request,
  by policy, at a named decision and enforcement point. It is NOT a method for
  choosing among options (`kepner-tregoe`), for recording a decision
  (`madr`), for a recurring business rule (`dmn`), or for who is involved
  (`raci`). It is also not a threat-modelling or risk-scoring method: it says
  where trust is decided, not how likely an attack is.
---

# Zero trust architecture

**Adopted on the owner's ruling, 2026-10-07** (issue #2389, work item `pk0z`).
The adversarial pass over the earlier draft (work item `1ygp`, finding L3.1) showed
that the draft was mostly this platform's own rules presented as a method. The
owner chose to split it, and asked to *"make it a proper methodology"* and to
*"ingest completely"*. So this node holds **only the method, as SP 800-207
states it**.

This platform applies it in the skill
[`zero-trust-handover`](../skills/conduct/security/zero-trust-handover.md):
the hand-over rules H1–H9, the hand-over screen and the sink-based risk
table. That skill names this node and does not restate it, and this node does
not restate the skill (`methodology-adoption`, §"Node, skill, or both?").

## What the method is

The operative definition (`sec-003-2-zero-trust-basics`):

> *"Zero trust (ZT) provides a collection of concepts and ideas designed to
> minimize uncertainty in enforcing accurate, least privilege per-request
> access decisions in information systems and services in the face of a
> network viewed as compromised."*

The aim is stated as uncertainty to be *reduced*, not removed: *"To lessen
uncertainties (as they cannot be eliminated), the focus is on authentication,
authorization, and shrinking implicit trust zones"* (same section). The
abstract model (Figure 1) puts one **policy decision / enforcement point**
between an untrusted subject and a resource. The *implicit trust zone* behind
that point is what the method shrinks.

## The seven tenets (`sec-004-21-tenets-of-zero-trust`)

NIST calls these *"the ideal goal"*, and says *"not all tenets may be fully
implemented in their purest form for a given strategy."*

1. *"All data sources and computing services are considered resources."*
2. *"All communication is secured regardless of network location."* —
   *"Network location alone does not imply trust."*
3. *"Access to individual enterprise resources is granted on a per-session
   basis."* — *"authentication and authorization to one resource will not
   automatically grant access to a different resource."*
4. *"Access to resources is determined by dynamic policy"*, drawn from the
   observable state of identity, application and asset, and possibly from
   behavioural and environmental attributes.
5. *"The enterprise monitors and measures the integrity and security posture
   of all owned and associated assets. No asset is inherently trusted."*
6. *"All resource authentication and authorization are dynamic and strictly
   enforced before access is allowed"*: a constant cycle of obtaining
   access, assessing threats, adapting and reevaluating trust.
7. *"The enterprise collects as much information as possible about the
   current state of assets, network infrastructure and communications and
   uses it to improve its security posture."*

**The tenets' own scope limit.** They *"apply to work done within an
organization or in collaboration with one or more partner organizations and
not to anonymous public or consumer-facing business processes. An
organization cannot impose internal policies on external actors"* (same
section).

## Six network assumptions (`sec-005-22-a-zero-trust-view-of-a-network`)

1. The whole private network is *"not considered an implicit trust zone"*.
   Assets should *"always act as if an attacker is present"*.
2. Devices on the network may not be owned or configurable by the enterprise.
3. *"No resource is inherently trusted."* Its posture is evaluated by a PEP,
   continually for the life of the session.
4. Not all enterprise resources are on enterprise-owned infrastructure.
5. Remote subjects and assets *"cannot fully trust their local network
   connection"*.
6. Assets and workflows moving between enterprise and nonenterprise
   infrastructure keep a consistent security policy and posture.

## The logical components (`sec-006-3-logical-components-of-zero-trust-architecture`, Figure 2)

- **Policy engine (PE).** *"responsible for the ultimate decision to grant
  access to a resource for a given subject"*. It takes enterprise policy and
  outside inputs into a trust algorithm, and *"makes and logs the
  decision"*.
- **Policy administrator (PA).** Establishes or shuts down the communication
  path and issues session-specific credentials. It *"relies on [the PE's]
  decision"*. The PE and PA together are the policy decision point (PDP).
- **Policy enforcement point (PEP).** *"responsible for enabling, monitoring,
  and eventually terminating connections between a subject and an enterprise
  resource."* It may be split into a client-side agent and a resource-side
  gateway, or be a single portal.
- **The inputs to the PE.** Continuous diagnostics and mitigation, industry
  compliance, threat intelligence, network and system activity logs, data
  access policies, PKI, identity management and SIEM.
- **Two planes.** The components talk on a **control plane** separate from
  the **data plane** that carries application data.

Four deployed variations (`sec-012` to `sec-015`; Figures 3–6) arrange the
same components:
- device agent with a gateway;
- an enclave behind one gateway;
- a resource portal with no agent on the subject;
- application sandboxes on a possibly compromised asset.

## The trust algorithm (`sec-016-33-trust-algorithm`, `sec-017-331-trust-algorithm-variations`, Figure 7)

The PE's decision process. Its inputs are:
- the access request;
- the subject database and its history;
- the asset database and the asset's observable status;
- resource policy requirements;
- threat intelligence and logs.

NIST distinguishes algorithms on two axes:

- **Criteria-based or score-based.** A criteria-based algorithm grants access
  *"only if all the criteria are met"*. A score-based one computes a
  confidence level from *"values for every data source and
  enterprise-configured weights"* and compares it with a threshold.
- **Singular or contextual.** A singular algorithm judges each request alone,
  with the *"risk that an attack can go undetected if it stays within a
  subject's allowed role"*. A contextual one also weighs the subject's recent
  history.

## The threats NIST names for a ZTA itself (`sec-026` to `sec-033`)

- 5.1 subversion of the decision process: *"any configuration changes must
  be logged and subject to audit"*;
- 5.2 denial of service or network disruption;
- 5.3 stolen credentials and insider threat;
- 5.4 visibility on the network;
- 5.5 storage of system and network information;
- 5.6 reliance on proprietary data formats or solutions;
- 5.7 **use of non-person entities (NPE) in ZTA administration**. This is the
  one written about agents (`sec-033-57-use-of-non-person-entities-npe-in-zta-adminis`):

  > *"Artificial intelligence and other software-based agents are being
  > deployed to manage security issues … The associated risk is that an
  > attacker will be able to induce or coerce an NPE to perform some task
  > that the attacker is not privileged to perform. … If an attacker can
  > interact with the agent, they could theoretically trick the agent into
  > allowing the attacker greater access or into performing some task on
  > behalf of the attacker."*

  NIST calls how such agents authenticate *"an open issue"*. Its stated
  mitigation for their errors is *"regular retuning analysis to correct
  mistaken decisions"*. It names false positives and false negatives as
  *"the biggest risk"* of automated enforcement.

## Migration (`sec-042` to `sec-052`, Figure 12)

A ZTA is introduced as a cycle laid against the NIST Risk Management
Framework, not switched on:
1. identify the actors;
2. identify the assets;
3. identify key processes and evaluate the risks of executing them;
4. formulate policies for a candidate;
5. identify candidate solutions;
6. deploy and monitor initially;
7. expand.

*"Incomplete knowledge will most often lead to a business process failure
where the PE denies requests due to insufficient information"*
(`sec-045-73-steps-to-introducing-zta-to-a-perimeter-based`).

## Where this rendering stops, and what is refused

- **The enterprise network machinery is not adopted.** That covers the CDM
  program, TIC 3.0, EINSTEIN, FICAM, micro-segmentation and
  software-defined perimeters (§3.1, §6). This platform is not an enterprise
  network. It adopts the decision structure (a named decision point, a named
  enforcement point, per-request policy, no implicit trust by location) and
  applies it to agents, tools and graphs. Deciding which components map to
  what is the skill's business, not this node's.
- **The score-based trust algorithm is refused.** A score from *"configured
  weights"* reads as a measurement, and the weights are invented. That is
  `methodology-adoption` §"Never quantify a judgement to make it look
  measured". Of NIST's two kinds, only the **criteria-based** trust algorithm
  is adopted.
- **NIST's applicability limit is kept as NIST states it.** The tenets do not
  govern anonymous public participants, and an organisation cannot impose its
  policy on them. How this platform handles text from such participants is
  the skill's business, not this node's.
- **No performance or efficacy claim rests on this source.** SP 800-207 is an
  architecture and guidance document. It reports no evaluation, and none is
  attributed to it here.

## What the source does not establish

- **How an agent should authenticate to the decision components.** NIST
  leaves this *"an open issue"* (5.7), and so does this node.
- **Whether a pattern-based screen of agent input is adequate.** NIST does
  not discuss prompt injection by name. The screen in the skill is this
  platform's mitigation, judged against prior work held separately (CaMeL,
  DataFilter, DefensiveTokens), and is not an application of anything
  800-207 says.
