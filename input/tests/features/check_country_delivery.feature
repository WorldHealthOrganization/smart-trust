# =============================================================================
# check_country_delivery.feature  (CORRECTED)
#
# WHERE THE ORIGINAL METHODOLOGY WAS WRONG
#   Almost every step tested a COMMAND or an INTERNAL FILE rather than the
#   pipeline's effect:
#     - "git ls-remote --tags", "tags are sorted by commit date"  -> commands
#     - "repo.py clones ...", "verify.py imports keys and runs ..."-> scripts
#     - "GOODSIG is extracted to temp/verifyResult"                -> internal file
#     - "each file is JSON-escaped via jq"                         -> implementation
#   It also mixed two abstraction levels (some scenarios black-box, some white-box)
#   and left "<country_code>" placeholders in plain scenarios.
#
# CORRECTED APPROACH
#   A pipeline is tested black-box: seed a known input, run the stage (or the
#   whole workflow via workflow_dispatch), assert the EFFECT — a PR is opened,
#   countries.json has the right keys, the working tree is at the latest tag,
#   verification passes/fails, a bad delivery is aborted. Stage details live in
#   their own files (gpg decrypt, private-key scan, DSC upload); this file is the
#   orchestration + the end-to-end.
# =============================================================================
@pipeline @onboarding
Feature: Check Country Delivery pipeline
  The onboarding bot detects a country's new signed tag and turns a valid
  delivery into an onboarding PR — verified by outcomes, not git/gpg commands.

  Background:
    Given Bot is the system under test
    And GitHub is infrastructure at "https://api.github.com"
    And Gateway is infrastructure at "https://tng-dev.example.org"

  # ---------------------------------------------------------------------------
  # END-TO-END — the real "is the pipeline working" test. Trigger the workflow
  # for a fixture participant and assert its boundary effects.
  # ---------------------------------------------------------------------------
  @E2E @happy
  Scenario: A valid delivery is processed into a PR and reaches the trust list
    Given a test participant "XT" with a GPG-signed tag and an encrypted secret
    When the onboarding pipeline runs for "XT"          # workflow_dispatch, then wait
    Then an onboarding PR is opened for "XT"
    And "scripts/countries.json" has a key "XT"
    And "XT" appears in the "DSC" trust list

  # ---------------------------------------------------------------------------
  # STAGE OUTCOMES (fast, isolated) — each asserts a stage's output.
  # ---------------------------------------------------------------------------

  @countries-json
  Scenario: countries.json is produced from the decrypted secrets
    # FIX: original said "each file is read and JSON-escaped via jq". Assert the
    # RESULT: a JSON object keyed by country code with the decoded content.
    Given decrypted secrets exist for countries "ESP", "FRA"
    When the generate-countries step runs
    Then "scripts/countries.json" is a JSON object with keys "ESP", "FRA"
    And each value equals that country's decoded secret

  @countries-json
  Scenario: No decrypted secrets yields an empty countries.json object
    Given no decrypted secrets exist
    When the generate-countries step runs
    Then "scripts/countries.json" is an empty JSON object "{}"

  @repo @tags
  Scenario: The latest signed tag of a participant repo is checked out
    # FIX: original asserted ls-remote / sort-by-date (commands). Assert the
    # OUTCOME: the working tree ends at the latest tag's commit.
    Given a participant repo whose latest signed tag "v3" is at commit "SHA123"
    When the clone-and-checkout step runs
    Then the working tree is at commit "SHA123"

  @repo @tags @negative
  Scenario: An unreachable repo fails the step
    Given the participant repo URL is invalid
    When the clone-and-checkout step runs
    Then the step fails with "Repository Cloning failed"

  @verify @signed-tags
  Scenario: A tag signed by a trusted participant key verifies
    # FIX: original asserted "GOODSIG extracted to temp/verifyResult" (internal).
    Given the latest tag is GPG-signed by a trusted participant key
    When the verify-tag step runs
    Then tag verification succeeds

  @verify @signed-tags @negative
  Scenario: A tag not signed by a trusted key is rejected
    Given the latest tag is not signed by any trusted key
    When the verify-tag step runs
    Then tag verification fails with "Bad verification"

  @onboarding @pr
  Scenario: A valid, verified delivery produces an onboarding PR
    Given a valid, verified delivery for country "ESP"
    When the onboarding step runs
    Then an onboarding PR is opened for "ESP"

  @onboarding @pr @negative @security
  Scenario: A delivery containing private-key material is aborted with no PR
    # Scan detail lives in check_for_private_key.feature; here we assert the
    # pipeline OUTCOME.
    Given a delivery for country "ESP" whose files include private-key material
    When the onboarding step runs
    Then no PR is opened for "ESP"
    And the step aborts with "Private key content found"
