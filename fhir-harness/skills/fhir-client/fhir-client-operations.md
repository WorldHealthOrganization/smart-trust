---
name: fhir-client-operations
description: >
  Reading, searching and writing FHIR R4 resources through the SMARTerFHIR
  client (`BaseClient` and its vendor subclasses): the launch-context reads,
  `requestResource`, `create` with its automatic subject/encounter/context
  hydration, the per-vendor differences, how errors surface, and the
  operations the library does not have. Written against a pinned upstream
  commit; read before calling a FHIR server from a SMART app built on it.
---

# fhir-client-operations

> Skill id: `fhir-client-operations` · Package: `fhir-client` · Layer:
> `fhir-harness`

## Provenance — read this first

| | |
|---|---|
| Library | `@topologyhealth/smarterfhir` **0.4.3** (`package.json`) |
| Source | <https://github.com/TopologyHealth/SMARTerFHIR> |
| Pinned commit | `506463af4bd82848f414649dac608d578c8aae44` (2025-12-02) |
| License | **Apache-2.0** — `LICENSE`, `package.json` and the README agree |
| Built on | `fhirclient` `^2.5.2`; types from `@types/fhir` (`fhir/r4`) |

Every method below is from `src/Client/BaseClient.ts` and the vendor
subclasses beside it, at that commit. You obtain a client from
`ClientFactory` — see [`smart-launch`](smart-launch.md). **If the pinned
commit moves, re-read the source before trusting a signature here.**

## What a client is

`BaseClient` is abstract; `ClientFactory` returns one of `EpicClient`,
`CernerClient`, `SmartHealthClient`, `ECWClient`, `AthenaClient`,
`AthenaPracticeClient`, `MeditechClient`, chosen from the server URL. It holds
the underlying `fhirclient` `Client` as the public, read-only
`fhirClientDefault`.

## The operations it has

| method | what it does |
|---|---|
| `getPatientRead(): Promise<R4.Patient>` | reads the **launch-context** patient (`fhirClientDefault.patient.read()`) |
| `getEncounterRead(): Promise<R4.Encounter>` | reads the launch-context encounter |
| `getPractitionerRead(): Promise<R4.Practitioner>` | reads the signed-in user; throws `"User is Not a Practitioner"` otherwise |
| `requestResource(resourceID: string, requestOptions?: RequestInit)` | a GET through `fhirClientDefault.request({ url })`; only `requestOptions.headers` is forwarded; the result is **cast** to `R4.Resource` |
| `create<T>(r4Resource: T, patientId?, encounterId?, additionalHeaders?): Promise<T>` | POSTs a new resource after hydration (below) |
| `createPatient(patient: R4.Patient): Promise<R4.Patient>` | `create(patient)` |
| `hydrateResource(fhirClientResource, r4Resource, patientId?, encounterId?)` | fills in missing references without sending anything |
| `createReferenceArrayAuthor(): Promise<Author>` | `{ author: [{ reference: "Practitioner/<user id>" }] }` |
| `getR4Endpoint(): URL`, `getEMRType(): EMR` | the server URL and the vendor |

**Search** has no dedicated method. The only route in SMARTerFHIR is
`requestResource` with a search URL, which returns whatever the server sent —
a `Bundle` — typed as `R4.Resource`. Paging is not handled.

```ts
import * as R4 from "fhir/r4";

const patient = await client.getPatientRead();

// search: a relative URL resolved by fhirclient against the server base
const bundle = (await client.requestResource(
  `Observation?patient=${patient.id}&category=vital-signs`,
)) as R4.Bundle<R4.Observation>;

// write: subject, encounter and (for DocumentReference etc.) context are added if absent
const created = await client.create<R4.Observation>({
  resourceType: "Observation",
  status: "final",
  code: { text: "Body weight" },
  valueQuantity: { value: 70, unit: "kg" },
});
```

## Hydration — what `create` adds for you

Before POSTing, `create` calls `hydrateResource`, which uses the lists in
`src/Resource/resourceUtils.ts`:

- **`subject`** → `Patient/<id>` when the type is in the subject list
  (`Observation`, `Encounter`, `DocumentReference`, `Communication`,
  `QuestionnaireResponse`, …) and the resource has no `subject`.
- **`encounter`** → `Encounter/<id>` when the type is in the encounter list
  (`Observation`, `Condition`, `Procedure`, `MedicationRequest`,
  `ServiceRequest`, …) and has none.
- **`context`** → `{ encounter: [Encounter/<id>], period: { start: now, end: now } }`
  for `ChargeItem`, `DocumentReference`, `MedicationAdministration`,
  `MedicationDispense`, `MedicationStatement`.

The ids come from `patientId` / `encounterId` if you pass them, otherwise from
the launch context; a missing launch-context id throws `"id not found"`. The
test is `'subject' in resource` — a key present with `undefined` counts as
present and is **not** hydrated.

## Per-vendor differences

- **Epic** (`EpicClient`): `create` always sends `Prefer: return=representation`
  and does **not** accept an `additionalHeaders` argument.
- **Cerner** (`CernerClient`): adds `author: [Practitioner/<user>]` when absent;
  `requestResource` always sends `Accept: application/fhir+json` and ignores
  the caller's `requestOptions`.
- The other five subclasses only set `EMR_TYPE`.

## Errors

- `create` failures are re-thrown as `new Error("It failed with:" + reason)` —
  the original error object, and any `OperationOutcome` on it, is flattened into
  a string. Log `reason` before this point if you need the outcome.
- A create response with no `resourceType` is treated as a fetch response and
  its `.body` is returned instead.
- Reads and `requestResource` add no handling: whatever `fhirclient` rejects
  with propagates unchanged. What those errors look like is `fhirclient`'s
  contract and is not specified by this source.

## What the library does NOT do

- **No update, patch, delete, conditional create, or transaction/batch** — the
  only write is `create` (POST). Anything else means dropping to
  `client.fhirClientDefault`, i.e. `fhirclient` directly, outside this library's
  hydration and headers.
- **No read-by-id or search helper, paging or `_include` handling** — use
  `requestResource`.
- **No validation or profile conformance** — `Transformer.toFhirClientType`
  and `toR4FhirType` (`src/Resource/transformer.ts`) copy keys verbatim; they
  do not transform content.
- **R4 only** — every type is from `fhir/r4`.

## Pitfalls

- **On Cerner, `create`'s `patientId` and `encounterId` are ignored for
  hydration.** `CernerClient.hydrateResource` takes two parameters and calls
  `super.hydrateResource` without the ids, so the launch-context patient and
  encounter are used. Set `subject`/`encounter` on the resource yourself when
  they differ.
- **`requestResource` is typed, not checked.** A search returns a `Bundle` and
  an error body may return an `OperationOutcome`; both arrive as
  `R4.Resource`. Test `resourceType` before narrowing.
- **Hydration depends on launch context.** In a launch with no encounter
  context, creating a type from the encounter list throws `"id not found"`
  unless you pass `encounterId` or set `encounter` yourself; with context, the
  launch encounter is attached without comment.
- **The write must be in scope.** Default EHR-launch scopes for Epic and SMART
  are only `launch online_access` plus `openid fhirUser` (see `smart-launch`);
  no resource scope of any kind is requested. Pass the scopes you need to the
  `SmartLaunchHandler` constructor rather than expecting a `create` or a read
  to be authorised by the defaults — what a server grants without them is the
  vendor's policy, not something this source determines.
