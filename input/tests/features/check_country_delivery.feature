Feature: Check Country Delivery
  As the TNG onboarding bot (tng-bot-dev)
  I want to periodically check each country's delivery repository for new signed tags
  So that new onboarding requests are automatically processed and PRs are created

  Background:
    Given the tng-participants-dev or tng-participants-uat repository is checked out
    And GIT_USER, GIT_EMAIL, and BOT_TOKEN_GITHUB Environment variables are set
    And the tng-participants-secrets repository is checked out to "participants-secrets/"

  @secrets @gpg @decryption
  Scenario Outline: Ingest and decrypt participant secrets
    Given GPG is configured with the private key from secret EXT_SECRETS_GPG_PRIVATE_KEY
    And GPG passphrase is available from secret EXT_SECRETS_GPG_PRIVATE_KEY_PW
    And files matching "participants-secrets/dev/*.pgp" are found
    And each filename matches the pattern "^[A-Z]{3}$" (3-letter country code)
    When the PGP-encrypted files are decrypted using the GPG private key and passphrase
    Then the decrypted content is written to "decrypted/<country_code>.txt"

    Examples:
      | country_code |
      | ESP          |
      | FRA          |
      | USA          |

  @secrets @gpg @decryption @negative
  Scenario Outline: Decryption fails
    When "<file_name>.pgp" is invalid or passphrase "<passphrase>" is incorrect
    Then no decrypted file is created and workflow must fail

    Examples:
      | file_name | passphrase |
      | BAD       | wrong_pass |
      | XXX       | empty_pass |

  @countries-json
  Scenario: Generate countries.json from decrypted secrets
    Given decrypted participant files exist in "decrypted/*.txt"
    When each file is read and its content is JSON-escaped via jq
    And a "scripts/countries.json" file is generated
    And a JSON object of each 3-letter country code and its decoded secret content is written to "scripts/countries.json"
    Then the "scripts/countries.json" file contains an object list of all countries with their corresponding secrets

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

  @repo @clone @tags
  Scenario: Access participant repository and check for signed tags
    Given the repo URL is available in "temp/repo"
    When the repository is cloned using the tng-bot-dev account credentials
    Then the remote tags are listed via "git ls-remote --tags"
    And tags are sorted by commit date
    And the latest tag is checked out
    And the latest tag's commit hex SHA is written to "temp/tag"

  @verify @gpg @signed-tags
  Scenario: Verify GPG-signed tags
    Given participant GPG keys are in "temp/gpg"
    And tag SHA is in "temp/tag"
    When verify.py imports keys and runs "git verify-tag --raw"
    Then "GOODSIG" is extracted to "temp/verifyResult"
    And keys are cleaned up from the keyring

  @verify @gpg @signed-tags @negative
  Scenario: GPG verification of signed-tags fails
    Given tag SHA is available
    When "git verify-tag --raw" produces no GOODSIG
    Then workflow must fail with "Bad verification"

  @onboarding @pr
  Scenario Outline: Create onboarding PR
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
