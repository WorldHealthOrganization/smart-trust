Feature: Country Onboarding and Delivery 

  As the TNG onboarding bot (tng-bot-dev)
  I want to ingest participant secrets, configure repositories, and verify signed tags
  So that onboarding requests are automatically processed and PRs are created

  Background:
    Given the tng-participants-dev repository is checked out
    And Python 3.8 is configured with dependencies from scripts/requirements.txt
    And the bot is configured with GIT_USER, GIT_EMAIL, and BOT_TOKEN_GITHUB
    And the tng-participants-secrets repository is checked out to "participants-secrets/"
    And GPG is configured with EXT_SECRETS_GPG_PRIVATE_KEY and EXT_SECRETS_GPG_PRIVATE_KEY_PW

  @secrets @gpg @decryption
  Scenario Outline: Ingest and decrypt participant secrets
    When files matching "participants-secrets/dev/*.pgp" are found
    And each filename matches the pattern "^[A-Z]{3}$"
    Then "<file_name>.pgp" is decrypted into "decrypted/<file_name>.txt"

    Examples:
      | file_name |
      | ESP       |
      | FRA       |
      | USA       |

  @secrets @gpg @decryption @negative
  Scenario Outline: Decryption fails
    When "<file_name>.pgp" is invalid or passphrase "<passphrase>" is incorrect
    Then no decrypted file is created and workflow must fail

    Examples:
      | file_name | passphrase   |
      | BAD       | wrong_pass   |
      | XXX       | empty_pass   |

  @countries-json
  Scenario: Generate countries.json
    Given decrypted participant files exist
    When each file is JSON-escaped via jq
    Then "scripts/countries.json" is generated mapping country codes to secrets

  @countries-json @negative
  Scenario: Countries.json generation fails
    Given no decrypted files exist
    When JSON generation is attempted
    Then workflow must fail with "No input files"

  @config @base64
  Scenario Outline: Decode participant config
    Given "temp/country" contains "<country_code>"
    And "temp/base64" contains base64-encoded JSON
    When config.py decodes the content
    Then repo URL and GPG keys are prepared
    And TA signing material is created under "sign/cas/TA/"

    Examples:
      | country_code |
      | ESP          |
      | FRA          |

  @config @base64 @negative
  Scenario: Config decoding fails
    Given "temp/base64" contains malformed base64
    When config.py runs
    Then workflow must fail with "Invalid base64 input"

  @repo @clone @tags
  Scenario: Clone participant repository and checkout latest tag
    Given "temp/repo" contains the repo URL
    When repo.py clones the repository
    And tags are listed and sorted
    Then the latest tag is checked out
    And its commit SHA is written to "temp/tag"

  @repo @clone @tags @negative
  Scenario: Repository cloning fails
    Given repo URL is invalid
    When repo.py runs
    Then workflow must fail with "Repository Cloning failed"

  @verify @gpg @signed-tags
  Scenario: Verify GPG-signed tags
    Given participant GPG keys are in "temp/gpg"
    And tag SHA is in "temp/tag"
    When verify.py imports keys and runs "git verify-tag --raw"
    Then "GOODSIG" is extracted to "temp/verifyResult"
    And keys are cleaned up from the keyring

  @verify @gpg @signed-tags @negative
  Scenario: Verification fails
    Given tag SHA is available
    When "git verify-tag --raw" produces no GOODSIG
    Then workflow must fail with "Bad verification"

  @onboarding @pr
  Scenario: Create onboarding PR
    Given onboarding files are prepared under "<country_code>/onboarding"
    And disallowed domains are removed
    And signing is performed if ENV != PROD
    When git commit and push succeed
    Then a PR is created for "<country_code>/onboardingRequest"

    Examples:
      | country_code |
      | ESP          |
      | FRA          |

  @onboarding @pr @negative
  Scenario: Onboarding PR creation fails
    Given onboarding files are incomplete or contain private keys
    When enforce_no_private_key detects sensitive content
    Then workflow must abort with "Private key content found"