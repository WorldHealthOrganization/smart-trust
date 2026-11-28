---
name: qa-report-signing
---

# QA report signing — two routes, chosen by the performer's reach

A QA report becomes **evidence** when a third party can establish what was
measured and who vouches for it. `folio-test-run/v1` (`schemas/sdlc/test-run.ts`)
answers the first: a data hash and a process hash, each all-or-nothing, plus
the `skill` it tests, whose contract its recorded `cases` are checked against
(`test-run-conforms`). This skill answers the second, and it has **two
routes** because the participant doing the signing may not be able to reach
anything: some machine actors are air-gapped, an API cannot be called from
one, and a human actor signs instead. The subject signed is the **QA report**.

**This skill builds on [`signing`](signing.md).** That skill holds what is
true of any signature: who signs, what is signed, which suites a trust anchor
accepts, key custody, the route, and what a verifier must check and record.
This one keeps only what is particular to QA reports: the run hashes, the
`qa-reports` branch, and the line between attestation and certification.
Where the two overlap, `signing` is the rule.

## The process is executable — do not hand-roll the branch

`sdlc/processes/qa-report-signing.bpmn`, with the branch computed by
`decisions/signing-route.dmn`. Run it with `workflow_start` /
`workflow_next` / `workflow_complete` like every other diagram here. The
gateway **refuses a hand-supplied outcome**: the route is a consequence of
declared facts, not a preference.

## Reach is a property of the ACTOR, and `unknown` is a third state

`schemas/process/actor-reach.ts`.

1. **One vocabulary, two levels.** An actor's `reach` uses the same scale as
   the deployment's `network` — `internet`, `egress-restricted`,
   `air-gapped`. There is no second scale, because two spellings of one fact
   drift apart.
2. **Composition is asymmetric.** An air-gapped deployment forces every actor
   air-gapped. A connected one forces nothing — a connected site may hold an
   isolated signing host. So an actor that declares no reach inside a
   connected deployment is **`unknown`**, not `internet`.
3. **`unknown` routes to the human.** A gateway that read could-not-determine
   as "use the API" would fail closed on the wire and open in the record: the
   call fails and what survives is an unsigned report that nothing marks as
   unsigned. Could-not-check is never green.

## Reach is declared, not a capability

There is no `network-egress` capability. A capability is an **environment
probe** — `detection: { method: "command", … }`, a thing you run to find out.
Reach is an **architectural fact**, declared by whoever built the site. On an
air-gapped host a failed probe is indistinguishable from an outage, and the
safe reading of an outage ("retry later") is the unsafe reading of an air gap.
A capability would also carry the same fact as `reach` in a second place, free
to disagree.

What *is* a probe is whether an endpoint is configured: `signing-api`, an
`env-var` detection. The DMN table reads **both**, because they answer
different questions — *can this host call out* and *is there anything to
call*. A configured endpoint on an air-gapped host is still uncallable.

## Declaration and execution are different mechanisms

`qa-report-signing.ts` declares:

```ts
requiredCapabilities: [
  { capabilityId: "signing-api", degradation: "fallback",
    fallbackRole: "publication-manager" },
],
```

`fallbackRole` says **which lane takes over** when no capability can do it. It
does not route anything, and nothing executes it; the gateway is what
executes.

They must agree — the declaration is what a reader and `check:fallback-roles`
can see without executing anything; the gateway is what happens. Where they
disagree, the diagram is what ran, and the declaration is the bug.

## Recording the attestation

Record what [`signing`](signing.md) §6 requires (suite, key, anchor, result,
when checked) and, above all, **which route signed it**, not only that it is
signed. The two are not interchangeable: one attests that a service with a key
saw these hashes, the other that a person holding release authority did.

## Where the signed report goes: the `qa-reports` branch, next to its run

A QA report is a **derived** record — it can be rebuilt from the tree and the
data it hashed — so it is kept where every derived QA result is kept: the
orphan **`qa-reports`** branch, in the entry keyed by the commit it judged
(`main/<sha>/` or `pr/<n>/<sha>/`), written through `scripts/qa-store.ts` and
never by a hand `git push`. The signature and the route that produced it
travel **with** the report, in the same entry, because a signature separated
from the bytes it covers attests nothing a reader can check.
`Task_RecordAttestation` in `qa-report-signing.bpmn` ends there.

**What does not go there.** A **certification** — an accountable role's
Decision taken on a test report's rollup — is a separate node, and it stays
on `main` beside the attestations: it is a judgement, the same class as
`test/attestations/`, and no regeneration can reproduce it. That decision
belongs to the test-plan process, which calls this one to sign; this skill
only signs.

A read of a signed report follows the store's rules: a **miss is never read
as "unsigned and fine"**, and a store that cannot answer is UNKNOWN, which
routes like unknown reach — to a person, never to a pass.
