# Corrected feature set — methodology notes

These five features describe stages of the **WHO GDHCN / TNG participant
onboarding pipeline**. The goal is to verify *the pipeline works*, and to feed
the specs into a Gherkin→IPS processor with language plugins. The originals
mostly failed for the **same root reason**, plus a handful of domain/precision
tweaks. This document is the cross-cutting explanation; each `.feature` file
repeats the file-specific notes in its header.

## The main opportunity: assert the *outcome*, not the *mechanism*

The originals already capture the right behaviour; they often assert the *how* to
get there. Moving each to the *what* keeps the same intent but makes it
refactor-proof and unambiguous:

| Original (mechanism) | Why it's brittle | Outcome-level |
|---|---|---|
| `mkdir -p decrypted creates the directory` | tests a shell command | `decrypted/AND.txt` is created |
| `the for-loop over *.pgp does not execute` | unobservable control flow | `decrypted/` is empty; stage succeeds |
| `each gpg --decrypt command includes flags …` | tests CLI construction | (dropped — flags aren't behaviour) |
| `git ls-remote --tags` / `sorted by commit date` | tests commands | working tree is at the latest tag's SHA |
| `GOODSIG is extracted to temp/verifyResult` | tests an internal file | tag verification succeeds |
| `the directory is recursively scanned …` | tests how the scan runs | the request is rejected for private-key material |

**Rule of thumb:** if a refactor that keeps the same behaviour would break the
test, restate it as the outcome it was really guarding.

## Testing a *pipeline* specifically

A pipeline (GitHub Actions running git/gpg/PR steps) is not a passive SUT you
POST to. You test it **black-box**: seed a known input, run the stage (or the
whole workflow), and assert the **effects** at its boundaries — a PR is opened,
`countries.json` has the right keys, the DSC appears in the trust list, a bad
request is rejected. Two viable levels:

- **Stage isolation** (fast): run one stage's script against a fixture, assert
  its output. Most of the originals were *reaching* for this — they just wrote
  the shell internals instead of the output.
- **End-to-end** (slow, nightly): trigger the workflow (`workflow_dispatch`),
  poll to completion, assert PR + artifacts + trust list. See the E2E scenario
  in `check_country_delivery.feature`.

## Other refinements

1. **Status-code-only assertions** (`dsc_upload`): every rejection asserted
   `400` and nothing else, so a negative could pass for the *wrong* reason.
   → assert the rejection **cause**, not just the number. (Also verify the real
   gateway codes — some validation failures are `422`, not `400`.)
2. **Missing preconditions/context**: the authenticated mTLS identity was never
   set, yet the country rules key off it; the "duplicate" scenario said "again"
   with no first upload. → establish every precondition explicitly.
3. **Redundant scenarios**: five byte-identical happy paths differing only by
   tag. → keep one; the value is in the negatives.
4. **Weak E2E assertions**: "appears in the trust list" only checked HTTP 200,
   never containment. → assert the DSC is actually **in** the list (by thumbprint).
5. **Precision / domain errors**: "valid country codes" vs `^[A-Z]{3}$` (format,
   not ISO); **SCA vs CSCA** used interchangeably; **EC ≥ 250** (P-256 is 256);
   **P-512** isn't a curve (P-521 is); unonboarded **`XX`** conflated
   "unknown issuer" with "wrong country"; **`gpg --list-keys` needs no
   passphrase**. → use a second real onboarded country, one consistent term, and
   correct crypto facts.
6. **Scope creep**: a *decryption* feature asserting the downstream
   `countries.json`. → each feature owns one stage; cross-stage effects live in
   the E2E.
7. **Non-determinism**: "randomly tampered", `~/.gnupg` (home-dependent). → flip
   a specific byte; use explicit paths/fixtures.
8. **Two rules per scenario** (`certificate_quality`): TLS-CA rules mixed with
   UP; SCA mixed with DSC — a failure would be ambiguous. → one role per scenario.
9. **Missing positive case** (`private_key`): only rejection was specified; a
   scan with no clean-request case is untested for false positives. → add it.

## Honouring the intent (what you don't lose)

Several original command-level assertions were guarding a real, hard-won lesson.
The outcome versions keep that guarantee — they just express it as an *effect*
instead of a *command*, so the check survives a refactor of the script:

| Original assertion | The lesson it guarded | Kept as an outcome |
|---|---|---|
| `gpg --decrypt … --pinentry-mode loopback` | must not hang on an interactive PIN prompt in CI | decryption completes unattended (no TTY) |
| `mkdir -p decrypted` | the output dir must exist before writing | the decrypted files appear in `decrypted/` |
| `--batch --yes` | must run non-interactively, no prompts | the stage runs to completion without input |
| `git verify-tag --raw` → GOODSIG | only trusted signers are accepted | a tag from an untrusted key is rejected |

Nothing that mattered is dropped — the brittle *wording* is; the *guarantee*
stays, and now it can't silently pass when the script changes.

## Executability note

None of the originals mapped to a step catalog, so nothing ran. The corrected
files use verbs a small set of dialect plugins would provide, each backed by a
service (the same pattern as `hcert-decoder` → `gdhcn-helper`):

- **`certificate`** — X.509 inspection (key size/algorithm, keyUsage, EKU,
  basicConstraints, subject, validity, chain). `gdhcn-helper` already parses
  X.509, so it can host `/cert/inspect`.
- **`trust-network`** — DSC/CMS build + gateway API (`/trustedCertificate`,
  `/trustList/*`) + `should contain/not contain the DSC`.
- **`github`** — seed repo/tag, `workflow_dispatch` trigger, poll run, read PR,
  fetch artifact (for the pipeline outcome/E2E tests).

Your parser has **no `Scenario Outline`/`Examples`** support, so the originals'
outlines are expressed as data-table-driven single scenarios (the plugin
iterates the table) or individual scenarios. Adding Outline support would let
the certificate-quality and DSC-validation matrices collapse back into tables.
