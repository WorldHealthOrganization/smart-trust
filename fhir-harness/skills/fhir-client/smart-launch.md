---
name: smart-launch
description: >
  How a browser app performs a SMART on FHIR launch — EHR launch and
  standalone launch — with the SMARTerFHIR library: `SmartLaunchHandler`,
  the `LAUNCH` and `EMR` enums, the scopes it requests per EHR vendor, how the
  redirect URI is computed, and where the token ends up. Written against a
  pinned upstream commit; read before wiring a launch page or a redirect page.
---

# smart-launch

> Skill id: `smart-launch` · Package: `fhir-client` · Layer:
> `fhir-harness`

## Provenance — read this first

| | |
|---|---|
| Library | `@topologyhealth/smarterfhir` **0.4.3** (`package.json`) |
| Source | <https://github.com/TopologyHealth/SMARTerFHIR> |
| Pinned commit | `506463af4bd82848f414649dac608d578c8aae44` (2025-12-02) |
| License | **Apache-2.0** — `LICENSE`, `package.json` and the README agree |
| Built on | `fhirclient` `^2.5.2` (a peer dependency) — SMARTerFHIR wraps its `FHIR.oauth2.authorize` and `FHIR.oauth2.ready` |

Every name below is from `src/` at that commit; each section cites its file.
Upstream ships no skill files, so this skill is authored here. **If the
pinned commit moves, re-read the source before trusting any signature here.** Where the source leaves a behaviour to
`fhirclient`, this skill says so rather than describing `fhirclient` from
memory.

## The public surface

`src/index.ts` exports exactly: `BaseClient`, `ClientFactory`, `EMR`, `LAUNCH`,
`SmartLaunchHandler`, `ClientUtils`. The vendor client classes are **not**
exported; you get one from `ClientFactory`.

- `LAUNCH` (`src/Client/ClientFactory.ts`): `EMR`, `STANDALONE`, `BACKEND`.
- `EMR` (`src/Launcher/SmartLaunchHandler.ts`): `CERNER = "cerner"`,
  `EPIC = "epic"`, `SMART = "smart"`, `ECW = "ecw"`,
  `ATHENA = "platform.athena"`, `ATHENAPRACTICE = "fhirapi.athena"`,
  `MEDITECH = "meditech"`, `NONE = "none"`.
- `new SmartLaunchHandler(clientID: string, clientSecret?: string, scope?: string | string[])`
- `authorizeEMR(launchType: LAUNCH = LAUNCH.EMR, redirectPath?: string, emrType?: EMR): Promise<void>`
- `new ClientFactory().createEMRClient(launchType: LAUNCH.EMR | LAUNCH.STANDALONE): Promise<BaseClient>`

## Steps

The launch is **two pages**: a launch page that sends the browser to the
authorisation server, and a redirect page that turns the returned code into a
client.

1. **Launch page.** Construct a `SmartLaunchHandler` with your registered
   client id, and call `authorizeEMR`.
   - EHR launch: `authorizeEMR(LAUNCH.EMR, redirectPath)`.
   - Standalone launch: `authorizeEMR(LAUNCH.STANDALONE, redirectPath, emrType)`.
2. **What `authorizeEMR` does** (`executeWebLaunch`, then the private
   `launchEMR`):
   - reads `iss` from `window.location.search`, and **throws** if it is absent —
     for *both* launch types;
   - infers the EHR vendor from the `iss` URL unless you pass `emrType`, and
     throws `"EMR type cannot be inferred from the ISS"` when neither yields one;
   - builds the scope string (below), calls `FHIR.oauth2.authorize` with
     `noRedirect: true`, then sets `self.location.href` to the returned URL.
3. **Redirect page.** Call `new ClientFactory().createEMRClient(launchType)`.
   It calls `FHIR.oauth2.ready()` and wraps the result in the vendor client
   chosen by `ClientUtils.getEMRType(client)`; `EMR.NONE` throws
   `"Unsupported provider for EMR Client creation"`.

```ts
import { SmartLaunchHandler, ClientFactory, LAUNCH, EMR } from "@topologyhealth/smarterfhir";

// launch page — the URL must carry ?iss=<FHIR base> (and, for EHR launch, the EHR's launch param)
const handler = new SmartLaunchHandler("my-client-id");      // no secret in a browser app
await handler.authorizeEMR(LAUNCH.EMR, "/redirect");          // browser navigates away

// redirect page
const client = await new ClientFactory().createEMRClient(LAUNCH.EMR);
client.getEMRType();       // e.g. EMR.EPIC
client.getR4Endpoint();    // URL of the FHIR server the token is for
```

## Scopes

Built in `launchEMR` / `generatePreconfiguredScopes`
(`src/Launcher/SmartLaunchHandler.ts`):

- **Always** prefixed with `openid fhirUser`, then de-duplicated and
  space-joined.
- **A `scope` passed to the constructor replaces the vendor defaults** (a
  string is split on spaces), but `openid fhirUser` is still prepended. It does
  **not** add `launch` for you — include it yourself for an EHR launch.
- Otherwise, the vendor defaults:

| `EMR` | EHR launch (`LAUNCH.EMR`) | standalone (`LAUNCH.STANDALONE`) |
|---|---|---|
| `EPIC`, `SMART`, default | `launch online_access` | `launch/practitioner online_access` |
| `CERNER` | the Epic set plus the per-resource `user/<Resource>.read` and `.write` scopes named in `src/Launcher/Config.ts` (`cerner.scopes`, mapped through `scopes.json`) | same, with `launch/practitioner` |
| `ECW` | `launch user/Patient.read user/Encounter.read user/Practitioner.read` | `launch/patient` + the same reads |
| `ATHENA` | `profile offline_access launch user/Patient.read` | `launch/patient` in place of `launch` |
| `ATHENAPRACTICE` | `launch profile offline_access user/Patient.read` | the same without `launch` |
| `MEDITECH` | `launch/patient patient/*.read` | the same |

Scope strings for single resources are produced by `FhirScopePermissions.get`
(`src/Launcher/Scopes.ts`), which renders `<actor>/<Resource>.<action>` with
SMART v1 `.read`/`.write` suffixes only. Note that `FhirScopePermissions` is
not exported from the package root.

## Redirect handling

From `executeWebLaunch`:

- an **absolute** `redirectPath` is used as-is (it may be another domain);
- a relative one is joined to `window.location.origin`, adding a leading `/`
  if missing;
- **no** `redirectPath` means the redirect URI is the bare origin.

Register exactly that computed URI with the EHR. PKCE: `pkceMode: 'ifSupported'`
for every vendor except ECW, which gets `pkceMode: 'unsafeV1'` and
`completeInTarget: true` (`getEMRSpecificAuthorizeParams`).

## Where the token lands

SMARTerFHIR does not store a token itself. The code exchange and the token live
in the `fhirclient` `Client` that `FHIR.oauth2.ready()` returns; SMARTerFHIR
keeps that object as `client.fhirClientDefault` and reads
`fhirClientDefault.state.serverUrl` from it. Where `fhirclient` persists its
state between the two pages, and how it refreshes, is `fhirclient`'s behaviour
and is **not** covered by this source — check `fhirclient`'s own documentation
rather than assuming.

For a **server-side** app that already holds a token response,
`createEMRClientBackend(req, res, serverConfig)` builds the client from a
`FhirClientConfig` — `{ serverUrl, tokenUri, tokenResponse, clientId }`
(`src/types.ts`) — using `fhirclient`'s Node entry point. It performs no
authorisation.

## What the library does NOT do

- **No backend-services launch.** `authorizeEMR(LAUNCH.BACKEND)` throws
  `"Direct Backend Authorization not supported yet."`; no JWT client-assertion
  flow exists in `src/`.
- **No SMART v2 scopes** (`.rs`, `.cruds`) — `FhirScopePermissions` emits only
  `.read`/`.write`.
- **No endpoint discovery of its own.** `ClientUtils.getEndpointsForEmr` is
  `@deprecated` and always throws; the vendor is inferred from the `iss` URL
  text, not from `.well-known/smart-configuration` or a CapabilityStatement
  (the README says "metadata/capabilities"; the code does a substring match).
- **No token storage or refresh logic** — both are `fhirclient`'s.
- **Browser only** for the launch half: `executeWebLaunch` reads `window` and
  writes `self.location`.

## Pitfalls

- **Standalone still needs `?iss=`** (step 2). Put the FHIR base URL in the
  link that opens the page.
- **Vendor inference is a substring match** (`ClientUtils.getEMRType`): the
  `EMR` values are tried longest-first against the whole `iss` string. A
  sandbox or proxy URL that does not contain `epic`, `cerner`, `smart`, … is
  `EMR.NONE`; one that contains two of them picks the longer. Pass `emrType`
  when the host is not self-describing — and note `createEMRClient` re-infers
  from `serverUrl` with no override, so an un-inferable server fails there too.
- **`clientSecret` in a browser is public.** The constructor forwards it to
  `FHIR.oauth2.authorize`; in a SPA that ships it to every user. Pass
  `undefined` for public clients.
- **The authorise promise does not reject on a bad URL.** If `authorize` does
  not return a string, `launchEMR` only `console.error`s
  `"Failed to build authorize URL"` and resolves — check that navigation
  actually happened.
- **Athena Practice's `response_mode=query` appears never to be appended.**
  `addSearchParams` iterates `Object.keys(new URLSearchParams(...))`, which
  yields no keys for a `URLSearchParams`. This is a reading of the source, not a
  runtime observation; verify against the vendor before relying on either
  behaviour.
