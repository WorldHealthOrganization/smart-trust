# Scenario accuracy review: `src/game/scenario.ts` against the WHO SMART Trust IG

Reviewed 2026-10-17 against the local clone at `~/Workspace/GitHub/smart-trust/input/pagecontent/`.

> **Historical.** This review used the single numbered onboarding process ([1]–[80]). Since 2026-11-11 the game refers to smart-trust's smaller business processes (GDHCN.ONB and its sub-processes, GDHCN.TrustDomain.Join) by task id, checked at build time (`src/game/process-refs.json`), and a country chooses zero, one or more trust domains. The step numbers below are the old ones; the findings about content still hold unless a moment changed.

Source keys used in citations (file:line):

- **PF** `concepts_onboarding_process_full.md` (the numbered steps)
- **CL** `concepts_onboarding_checklist.md`
- **CG** `concepts_certificate_governance.md`
- **OB** `concepts_onboarding.md`
- **CO** `concepts.md`

Verdicts: **SUPPORTED** (cited), **SIMPLIFIED** (fine for a game, noted), **UNSUPPORTED/WRONG** (fix given). Game days are illustrative and not reviewed. `[EDITED]` marks text already changed in `scenario.ts` (full list at the end).

## Summary

- 18 moments reviewed, every choice, consequence and step reference.
- No moment teaches something the IG contradicts once the edits below are applied.
- 11 clear-cut wording edits applied (all string-only; `tsc --noEmit` passes).
- 8 items need Carl's call (bottom of this file).

## File header and phases (lines 3–18)

| Claim | Verdict | Source |
|---|---|---|
| Moments map to "Details of the Onboarding Process" and the onboarding checklist; step numbers refer to that page | SUPPORTED | PF:2, PF:25–27 |
| Phases A–E (Apply, Prepare keys, WHO checks and setup, Test and go live, Stay live) | SIMPLIFIED | IG has three sections (PF:25–27) and three stages (OB:32–77). The five-phase cut is a game re-grouping. |
| Role "WHO does this part" | SIMPLIFIED | Some of these steps are done by OPS, the service provider or TSI (PF:39, 47, 75), not WHO staff. Fine for a game. |

## A · Apply

### 1. `soi` Say you want to join (Step 1)

| Claim | Verdict | Source |
|---|---|---|
| Step 1 is a Statement of Interest to WHO | SUPPORTED | PF:34 |
| Sent to gdhcn-support@who.int (correct choice, learn) | SUPPORTED | PF:34 |
| Goal: issue certificates other countries can verify | SUPPORTED | CO:149, CG:12 |
| Gateway: "only accepts signed key material over mTLS" | SUPPORTED | CG:56–61 (mTLS whitelist), CG:81–85 (signed uploads) |
| Gateway: "carries keys, never letters" | SIMPLIFIED | Reasonable reading of CG:12; not stated in those words |
| GitHub: "tng-bot only reads repositories it is invited to, much later" | SUPPORTED | PF:86 (invite at step 11) |
| Business Owner sends the SoI | SIMPLIFIED | IG does not say which representative submits it |

### 2. `eligibility` Prove you are eligible (Steps 2–8)

| Claim | Verdict | Source |
|---|---|---|
| TOP0 to TOP4 wording in the note | SUPPORTED | CO:30–34 |
| WHO checks eligibility and TOP compliance | SUPPORTED | PF:36 (names TOP 0–3; TOP4 is "as may be requested", CO:34) |
| Ministry applies as government health authority | SUPPORTED | CO:15–16, CO:61 |
| Vendor rejected: applicant must be a ministry or officially delegated health agency | SUPPORTED | CO:15–24 |
| Rejection communicated by email; correct and re-apply | SUPPORTED | PF:40, PF:42 |
| Partial TOP acceptance rejected | SUPPORTED | PF:36 |
| Success: invitation plus technical specs for UAT and PROD, DEV optional | SUPPORTED | PF:44–50 |
| Legal representative prepares the response | SIMPLIFIED | CO:43 gives Legal the review of Trust Domain requirements; IG does not assign the application to a role |

### 3. `team` Name your team (Representatives)

| Claim | Verdict | Source |
|---|---|---|
| Role descriptions (Business Owner, Key Master, Legal, Technical) | SUPPORTED | CO:36–46 |
| Letter must name people authorised to provide key material, with contact details | SUPPORTED | PF:100 |
| WHO verifies named people in person or by diplomatic channel | SUPPORTED | PF:104–107 |
| "each with an official health.xc email address" | SIMPLIFIED | IG requires the email in the Letter and to match the GPG key (PF:100, PF:125), not that it be an official domain. Good practice, not a rule. |
| "Four named roles carry onboarding" (learn) | SIMPLIFIED | Glossary defines four (CO:36–46), but the application minimum lists three contacts: Technical, Legal, Business Owner (OB:92). See Carl's call 5. |

## B · Prepare keys

### 4. `tools` Set up the workbench (Onboarding checklist)

| Claim | Verdict | Source |
|---|---|---|
| OpenSSL, cURL, Git, GPG, GitHub account | SUPPORTED | CL:20–61 |
| Versions in the terminal mock meet the minimums (OpenSSL ≥1.1.1, cURL ≥7.68, Git ≥2.28, GPG 2.2–2.4) | SUPPORTED | CL:30, 40, 49, 58 |
| Windows' built-in cURL uses Schannel and can't use your PEM cert/key; use an OpenSSL build | SUPPORTED | CL:618–625, PF:274 |
| Connectivity test run by the participant, from its backend, with its own TLS certificate | SUPPORTED | PF:166–173 |
| ~~"WHO reviews the results"~~ | WRONG, `[EDITED]` | IG has no results review for the connectivity test; OPS supports on failure (PF:207). Now: "The operations team supports you if it fails." |

### 5. `certs` Create your certificates (Step 9)

| Claim | Verdict | Source |
|---|---|---|
| Each environment needs SCA, TLS client and Upload certificates | SUPPORTED | PF:56, CG:101–104 |
| SCA is the trust anchor and issues DSCs | SUPPORTED | CG:14 |
| TLS proves backend identity (mTLS) | SUPPORTED | CG:56 |
| Upload certificate signs uploaded packages | SUPPORTED | CG:81 |
| Separate sets for UAT and PROD; never reuse | SUPPORTED | CG:156 (MUST, for TLS, UP and DSCs), PF:20 ("highly recommended" for all certificates) |
| Letter/application needs SCA, TLS and Upload | SUPPORTED | OB:88–90 |
| "All three are prepared for every environment" | SUPPORTED | PF:56 |

### 6. `sca` Protect the trust anchor (Certificate governance)

| Claim | Verdict | Source |
|---|---|---|
| ~~"root of trust for every certificate Country XC will ever issue"~~ | WRONG, `[EDITED]` | The SCA anchors DSCs only (CG:14, CG:70); TLS and Upload certificates can be self-signed or public CA (CG:59, CG:81). Now: "every Document Signer Certificate". |
| "Whoever holds it can speak for Country XC" | SIMPLIFIED | Fair consequence of CG:71 |
| Offline, multi-person control | SUPPORTED | CG:115 (recommended, "should") |
| Leaked SCA puts every DSC in doubt | SUPPORTED | CG:71, CG:151 |
| ~~"A hardware security module or smart card is recommended"~~ | OVERSTATED, `[EDITED]` | CG:115 says they "can be used to further protect". Now: "adds further protection." |
| Only public keys go to GitHub | SUPPORTED | PF:67 |
| Private key in repo must be treated as compromised: revoke, regenerate | SIMPLIFIED | Standard practice; IG says keep private keys safe and do not share (CL:315) and delete generated key folders before committing (CL:324). It does not prescribe the response. |
| "Private keys never cross the Country XC boundary" / learn | SIMPLIFIED | Game framing of CG:59, CG:83, CL:315 |

### 7. `gpg` Create GPG keys (Step 10)

| Claim | Verdict | Source |
|---|---|---|
| GPG key per authorised person per environment | SUPPORTED | PF:75, PF:96 |
| RSA 4096 | SUPPORTED | PF:79 |
| WHO compares the key's email with the Letter (learn) | SUPPORTED | PF:121, PF:125 |
| Shared team key refused; WHO verifies each person | SUPPORTED | PF:75, PF:104 |
| Shared-key step ref "Step 10" | INCOMPLETE, `[EDITED]` | Refusal happens at WHO's GPG check. Now "Steps 10, 21–22". |
| Gmail key fails later | SUPPORTED but see Carl's call 2 | PF:125; conflicts with CL:192 advice |

### 8. `repos` Set up the private repos (Step 11)

| Claim | Verdict | Source |
|---|---|---|
| Private repo per environment | SUPPORTED | PF:81–85, CL:109 |
| tng-bot for PROD, tng-bot-dev for DEV and UAT | SUPPORTED | PF:86, CL:153 |
| Repos must be private; private hides the uploader's identity | SUPPORTED | PF:85 |
| "Nothing arrived in UAT" (wrong bot) | SIMPLIFIED | IG does not describe the failure; logical outcome |
| Public keys (PEM) in the repos | SUPPORTED | PF:67 |
| Bot permission level omitted | Correct choice | PF:86 says "read", CL:155 says "Write". Leave omitted. |
| Repo names `tng-xc-uat`, `tng-xc-prod` | QUESTIONABLE | CL:119: name "has to contain the ISO 3 letter" code. See Carl's call 3. |

### 9. `tag` Sign the tag (Step 9)

| Claim | Verdict | Source |
|---|---|---|
| Bot clones the latest tag and verifies it against onboarded GPG keys | SUPPORTED | PF:72 |
| Sign with `git tag -s` | SUPPORTED | PF:71, CL:572 |
| Web-created tag can't be verified | SUPPORTED | PF:71 ("platform will use an intermediate key") |
| No tag: nothing to take over | SUPPORTED | PF:72–73 |
| ~~Learn: "Sign the git tag from the terminal"~~ | INCOMPLETE, `[EDITED]` | PF:71 allows "terminal or developer IDE". Now "locally, from the terminal or an IDE". |
| Tag moment placed after repo setup (Step 11) | SIMPLIFIED | IG numbers tagging under step 9 but it needs the repo; order is sensible |

### 10. `invite` Beat the 7-day clock (Steps 12–13)

| Claim | Verdict | Source |
|---|---|---|
| Invitations expire after 7 days; WHO must accept in that window | SUPPORTED | PF:88, PF:90 |
| WHO's handover includes confirmation that invitations were accepted | SUPPORTED | PF:135 (implies the timing link) |
| Letter needs signatures | SUPPORTED | OB:84 ("submit a signed" application), CO:49 |
| Time invitations with the Letter; re-invite on expiry | SIMPLIFIED | Sensible inference; IG only says the invite "loses validity" (PF:88) |

### 11. `letter` Assemble the Letter of Application (Step 14)

| Item | Verdict | Source |
|---|---|---|
| Private repo URLs, UAT and PROD, DEV optional (required) | SUPPORTED | PF:94 |
| SCA private key (not required) | SUPPORTED | CL:315; "never leave Country XC" is game framing |
| GPG public keys per person and environment (required) | SUPPORTED | PF:96 |
| ISO participant code (required) | SUPPORTED | PF:98 |
| GitHub access token (not required) | SUPPORTED | PAT is for the participant's own clone (CL:125–140); bot invited instead (PF:86) |
| ~~"WHO never gets your credentials"~~ | CONFLICTS, `[EDITED]` | TOP0 is literally "sharing of necessary credentials" for mTLS (CO:30), shown on screen in moment 2. Now: "WHO never needs your GitHub login." |
| Contact details with email of authorised people (required) | SUPPORTED | PF:100 |
| SCA, TLS and Upload certificates (required) | SUPPORTED | OB:90 |
| Scanned passports (not required); identity by face to face or diplomatic channel | SUPPORTED | PF:104–111 |
| Statement accepting other participants' keys (required) | SUPPORTED | OB:91 |
| Named Technical, Legal and Business Owner contacts (required) | SUPPORTED | OB:92 |
| Failure: Letter returned, Steps 18–20 | SUPPORTED | PF:113–117 |

## C · WHO checks and setup

### 12. `identity` Prove who you are (Steps 15–23)

| Claim | Verdict | Source |
|---|---|---|
| WHO verifies named people, then checks each GPG key | SUPPORTED | PF:104–125 |
| Face to face with passports, or diplomatic channel | SUPPORTED | PF:106–111 |
| Emailed scan not accepted | SIMPLIFIED | IG lists only two channels (PF:106–107); it does not explicitly reject scans |
| Email mismatch caught at Steps 21–22 | SUPPORTED | PF:121, PF:125 |
| Fix: new GPG key, re-sign tag, resend | SIMPLIFIED | Logical; IG says only "corrective activities" (PF:117) |

### 13. `collect` tng-bot collects your keys (Steps 23–46)

| Claim | Verdict | Source |
|---|---|---|
| WHO passes details to Operations | SUPPORTED | PF:127–135, PF:139 |
| Bot clones latest tag and checks signature | SUPPORTED | PF:72 |
| UAT keys auto-signed and whitelisted | SUPPORTED | PF:143, PF:154 |
| Web tag: signed with GitHub's key, not Kwame's | SUPPORTED | PF:71 (paraphrase of "intermediate key") |
| `[EDITED]` why now says "Sign tags locally, from the terminal or an IDE" | SUPPORTED | PF:71 |

### 14. `airgap` WHO signs PROD offline (Steps 36–50)

| Claim | Verdict | Source |
|---|---|---|
| WHO verifies the PR, then signs PROD keys in an air-gapped process | SUPPORTED | PF:145 |
| Trust Anchor private key never on the online gateway | SUPPORTED | CG:68, CG:90, CO:113 |
| Asking for online signing declined; network relies on that separation | SUPPORTED | CG:68 |
| Reuse caught by WHO's PR check at Steps 39–42 | SIMPLIFIED | PF:147–151 say the PR is checked and corrected, not that the check detects reuse. Rule itself is CG:156. See Carl's call 1. |
| "A test key can't become a production key" | SUPPORTED | CG:156–158 |
| ~~Success: "PROD keys signed offline and whitelisted"~~ | WRONG, `[EDITED]` | PROD whitelisting "continues" only after the dry run passes (PF:231). Now: "PROD keys signed offline. PROD whitelisting finishes, and the PROD gateway opens to you, only after the UAT dry run passes." |

## D · Test and go live

### 15. `connect` Connect to UAT (Steps 60–61)

| Claim | Verdict | Source |
|---|---|---|
| `curl -v https://tng-uat.who.int/trustList --cert … --key …` | SUPPORTED | PF:173 |
| TLS client certificate opens the mTLS connection | SUPPORTED | CG:56–61 |
| Upload certificate refused for the handshake; it signs packages | SUPPORTED | CG:61, CG:81 |
| SCA must stay offline; connections use TLS | SUPPORTED | CG:115 |
| ~~"only signs Document Signer Certificates"~~ | OVERSTATED, `[EDITED]` | SCA key usage also includes CRL signing (CG:186). "only" removed. |
| Schannel cURL fails; corrective action at Step 61; use OpenSSL build | SUPPORTED | CL:620, PF:207, PF:274 |
| Trust list returned | SUPPORTED | PF:175–201 |

### 16. `dryrun` Run the UAT dry run (Steps 62–69)

| Claim | Verdict | Source |
|---|---|---|
| Checklist a) to f) | SUPPORTED | PF:213–223 (c is optional, matches "if needed") |
| Results go to the onboarding team | SUPPORTED | PF:225 |
| Incomplete results sent back | SUPPORTED | PF:227–229 |
| Revoking a DSC is part of the dry run | SUPPORTED | PF:215 |
| "The move you'll need on your worst day" | SIMPLIFIED | Editorial; consistent with CG:147 |
| Pass opens PROD | SUPPORTED | PF:231–235 |

### 17. `prod` Production readiness test (Steps 70–80)

| Claim | Verdict | Source |
|---|---|---|
| DSC created and signed by the SCA | SUPPORTED | PF:247 |
| "offline" | SUPPORTED | CG:115 (recommended) |
| `openssl cms -sign -nodetach …`; signer is the Upload cert | SUPPORTED | PF:256–260, CL:662 |
| TLS or SCA signing the package is rejected | SUPPORTED | CG:81, CG:85 |
| DSC appears in downloaded trust list | SUPPORTED | PF:271 |
| Revoke and re-upload, results sent by mail (72e–f, 73–74) omitted | SIMPLIFIED | Acceptable; dry run already teaches revocation |
| ~~"WHO confirms that onboarding is complete"~~ | WRONG, `[EDITED]` | Confirmation email goes *to* the participant and *to* WHO (PF:291). Now: "A confirmation email tells Country XC and WHO that onboarding is complete." |

## E · Stay live

### 18. `renew` Stay live (Certificate governance)

| Claim | Verdict | Source |
|---|---|---|
| Recommended validity: SCA 4, DSC 2, Upload 1–2, TLS 1–2 years | SUPPORTED | CG:121–124 |
| Participant tracks expiry; no central reminder | SUPPORTED | CG:134 |
| Expired certificates removed from whitelist and trust list | SUPPORTED | CG:132 |
| Upload and TLS renewed in good time, e.g. a month before expiry | SUPPORTED | CG:130 |
| ~~Correct choice: "renew at least a month ahead"~~ | OVERSTATED, `[EDITED]` | CG:130 gives one month as an example for Upload/TLS; for SCA/DSC the month is measured from end of private key usage, not expiry. Now: "renew in good time, for example a month before expiry". |

## Edits applied to `scenario.ts`

String-only changes; no structure, ids, flags or days touched. `npx tsc --noEmit` passes. Original kept in this session's scratchpad.

1. `tools` / skip / why: "WHO reviews the results." → "The operations team supports you if it fails."
2. `sca` / brief: "every certificate" → "every Document Signer Certificate"
3. `sca` / server / why: "is recommended" → "adds further protection"
4. `gpg` / shared / steps: "Step 10" → "Steps 10, 21–22"
5. `tag` / learn: "from the terminal" → "locally, from the terminal or an IDE"
6. `letter` / GitHub token / why: "WHO never gets your credentials." → "WHO never needs your GitHub login."
7. `collect` / webtag / why: "Sign tags from the terminal." → "Sign tags locally, from the terminal or an IDE."
8. `airgap` / success note: rewritten so PROD whitelisting completes after the dry run (PF:231)
9. `connect` / sca / why: dropped "only"
10. `prod` / success note: confirmation email goes to Country XC and WHO
11. `renew` / correct choice: "at least a month ahead" → "in good time, for example a month before expiry"

## Carl's decisions (2026-10-17) and what changed

1. **Reuse caught at Steps 39–42.** Keep as a game device. No change; already listed under simplifications in the README.
2. **GPG email.** Fixed: correct choice now reads "{keymasterEmail}, the address in the Letter and verified on {keymasterFirst}'s GitHub account" (satisfies PF:125 and CL:192 together).
3. **Repo names.** Fixed: new `{code3}` / `{code3Lower}` tokens (ISO 3166-1 alpha-3, `settings.ts`). Repos now read `tng-xxc-uat` / `tng-xxc-prod` for the sample country (CL:119, CL:531) and, for example, `tng-ken-uat` for Kenya. A 3-letter code typed on the title screen is used as is. The ministry sign and email domain keep the 2-letter code.
4. **Expiry dashboard.** Added (CL:773–779):
   - World: a WHO island south of WHO Operations with a screen showing a certificate-expiry panel, clickable as a place ("Certificate expiry dashboard").
   - Desk: new `dashboard` doc kind with a monitor icon, DEV/UAT/PROD tabs and one bar per certificate, coloured by time left.
   - `renew` moment now plays at the dashboard. The brief notes the Upload certificate has 21 days left. The correct choice adds "send WHO the new certificate" (CG:130). The wrong choice's why reads: the dashboard shows dates, but no one sends reminders (CG:134).
5. **Three contacts or four roles.** Game is fine. No change.
6. **When PROD keys are submitted.** Game follows PF, which Carl confirms is correct. No change.
7. **PROD readiness test.** Added the full step 72 list (a to f) as a note on the desk, and the success animation now plays upload, trust list check, revocation, re-upload, results by email (73–74), then the confirmation (77–80). Brief and takeaway updated to match.
8. **Bot permission.** Explained to Carl; still omitted.

## IG defects noticed (for feedback to WHO, not game changes)

- GPG RSA minimum is 4096 at step 10 (PF:79) but 3072 at step 22 (PF:123).
- PF:98 says "3-digit ISO Participant code"; CL:119 says ISO 3-letter.
- PROD readiness upload example posts to `tng-uat.who.int` (PF:267).
- Upload endpoint differs: `/signerCertificate` with `application/cms` (PF:267) vs `/trustedCertificate` with JSON (CL:679).
- Bot permission: read (PF:86) vs Write (CL:155).
