<!-- GENERATED from who-iris/processes/iris-cdn-sign-publish.bpmn by cat-harness-tools/scripts/bpmn-checklist.ts. Do not edit: change the diagram and regenerate (bun run cat bpmn:checklist). -->

# Checklist — Sign and publish an IRIS CDN release

> **Generated, and not the authority.** This is `who-iris/processes/iris-cdn-sign-publish.bpmn` (process `Process_IrisCdnSignPublish`) walked as a state machine. The diagram and the workflow engine decide; this list only reads them. Follow the `next:` line of each step rather than the order on the page, and record each step with the call it names, so the engine's committed state — not this list — says which edge was taken.

Turn a candidate payload into a signed release on Cloudflare: each changed library item gets a detached JWS over its own manifest, and the BagIt bag (RFC 8493) whose tagmanifest pins every item manifest and signature is signed once with a detached JWS (RFC 7515 Appendix F, ES256 per RFC 7518), the k

## Begin — A candidate payload (`Start_Candidate`)

- Begin here.
- Call `workflow_start` with `process: "Process_IrisCdnSignPublish"` and the subject this run is about; keep the instance id it returns.
- next: → `Task_BuildBag` (Write the BagIt tag files (sorted, no dates))

### 1. Write the BagIt tag files (sorted, no dates) (`Task_BuildBag`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-signing`.
- What: scripts/iris-cdn/bag.ts tagFiles: manifest-sha256.txt sorted by path, bag-info.txt with Payload-Oxum and no Bagging-Date.
- Record it: `workflow_complete` with `node: "Task_BuildBag"`.
- next: → `Task_Diff` (Diff against the published manifest)

### 2. Diff against the published manifest (`Task_Diff`)

- Who: the `Build pipeline` lane (role `build-pipeline`).
- Skill: `iris-cdn-signing`.
- Record it: `workflow_complete` with `node: "Task_Diff"`.
- next: → `GW_Empty` (Anything changed?)

### Decide — Anything changed? (`GW_Empty`)

- Call `workflow_complete` with `node: "GW_Empty"` and `outcome` set to the label that holds:
  - «no» → `End_Unchanged` (Unchanged: no commit)
  - «yes» → `Task_Upload` (Store new objects (never overwrite))

## Done — Unchanged: no commit (`End_Unchanged`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 3. Store new objects (never overwrite) (`Task_Upload`)

- Who: the `Release signer` lane (role `release-signer`).
- Skill: `iris-cdn-exporter`.
- What: Content-addressed: an object whose SHA-256 is already stored is skipped.
- Record it: `workflow_complete` with `node: "Task_Upload"`.
- next: → `Task_SignItems` (Sign each changed item manifest (ES256))

### 4. Sign each changed item manifest (ES256) (`Task_SignItems`)

- Who: the `Release signer` lane (role `release-signer`).
- Skill: `iris-cdn-signing`.
- What: A signature on each library item: items/<handle>/manifest-sha256.txt lists the item record and its files; its detached JWS sits beside it.
- Record it: `workflow_complete` with `node: "Task_SignItems"`.
- next: → `Task_Sign` (Sign the release tag manifest (ES256))

### 5. Sign the release tag manifest (ES256) (`Task_Sign`)

- Who: the `Release signer` lane (role `release-signer`).
- Skill: `iris-cdn-signing`.
- What: scripts/iris-cdn/signing.ts signDetached.
- Record it: `workflow_complete` with `node: "Task_Sign"`.
- next: → `Task_PublishTags` (Commit tag files and signature, last)

### 6. Commit tag files and signature, last (`Task_PublishTags`)

- Who: the `Release signer` lane (role `release-signer`).
- Skill: `iris-cdn-signing`.
- What: One commit to the Cloudflare git repository, after every payload object is in place, so a reader never sees a manifest naming bytes that are not there yet.
- Record it: `workflow_complete` with `node: "Task_PublishTags"`.
- next: → `Task_Verify` (Resolve did:web; verify JWS and digests)

### 7. Resolve did:web; verify JWS and digests (`Task_Verify`)

- Who: the `Verifier` lane (role `verifier`).
- Skill: `iris-cdn-signing`.
- What: scripts/iris-cdn/run.ts checkRelease: every tag file against tagmanifest-sha256.txt, then scripts/iris-cdn/signing.ts verifyDetached against the DID document fetched from its did:web URL.
- Record it: `workflow_complete` with `node: "Task_Verify"`.
- next: → `GW_Verified` (Verified?)

### Decide — Verified? (`GW_Verified`)

- Call `workflow_complete` with `node: "GW_Verified"` and `outcome` set to the label that holds:
  - «yes» → `End_Published` (Release published and verified)
  - «no / unknown» → `Task_Revert` (Revert to the previous release)

## Done — Release published and verified (`End_Published`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.

### 8. Revert to the previous release (`Task_Revert`)

- Who: the `Verifier` lane (role `verifier`).
- Skill: `iris-cdn-signing`.
- Record it: `workflow_complete` with `node: "Task_Revert"`.
- next: → `End_Failed` (Failed; previous release still served)

## Done — Failed; previous release still served (`End_Failed`)

- The instance completes here. `workflow_next` then reports nothing enabled — that, not this line, is the record of completion.
