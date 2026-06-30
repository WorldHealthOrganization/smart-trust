Feature: GPG country config decryption in Country Delivery Workflow
  The "Check Country Delivery" workflow uses GPG to decrypt
  country secrets from the participants-secrets repo. This feature
  covers the GPG setup, key import, and PGP file decryption steps.
  Background:
    Given the workflow "Check Country Delivery" is triggered
    And the participants-secrets repo is checked out to "participants-secrets/" path
    And secrets "EXT_SECRETS_GPG_PRIVATE_KEY" and "EXT_SECRETS_GPG_PRIVATE_KEY_PW" are available
  # --- GPG Setup ---
  Scenario: GPG home directory is created with proper permissions
    When the "Set up GPG" step runs
    Then directory "~/.gnupg" is created
    And its permissions are set to "700"

  Scenario: GPG is configured for non-interactive use
    When the "Set up GPG" step runs
    Then file "~/.gnupg/gpg.conf" is created
    And it contains "use-agent"
    And it contains "pinentry-mode loopback"

  Scenario: GPG private key is imported successfully
    Given the GPG private key is available in secret "EXT_SECRETS_GPG_PRIVATE_KEY"
    When the "Set up GPG" step runs
    Then the key is imported via "gpg --batch --import"
    And "gpg --list-keys" succeeds with passphrase from "EXT_SECRETS_GPG_PRIVATE_KEY_PW"

  Scenario: GPG setup fails when private key secret is missing
    Given secret "EXT_SECRETS_GPG_PRIVATE_KEY" is not available
    When the "Set up GPG" step runs
    Then the GPG key import step fails
    And "gpg --list-keys" does not list any keys

  # --- PGP Decryption ---
  Scenario: Encrypted PGP files for valid country codes are decrypted
    Given PGP-encrypted files exist in "participants-secrets/dev/"
      | File                | Matches Pattern |
      | AND.pgp             | yes             |
      | XXX.pgp             | yes             |
      | README.pgp          | no              |
      | AB.pgp              | no              |
      | ABCD.pgp            | no              |
    When the "Decrypt files" step runs
    Then files matching pattern "^[A-Z]{3}$" are decrypted to "decrypted/<CODE>.txt"
    And file "decrypted/AND.txt" is created
    And file "decrypted/XXX.txt" is created
    And file "decrypted/README.txt" is not created
    And file "decrypted/AB.txt" is not created
    And file "decrypted/ABCD.txt" is not created

  Scenario: Decryption uses batch mode with loopback pinentry
    When the "Decrypt files" step runs
    Then each gpg --decrypt command includes flags:
      | Flag                  |
      | --batch               |
      | --yes                 |
      | --pinentry-mode loopback |
      | --passphrase          |

  Scenario: Decryption fails when passphrase is wrong
    Given secret "EXT_SECRETS_GPG_PRIVATE_KEY_PW" contains an incorrect passphrase
    When the "Decrypt files" step runs
    Then gpg decryption fails with a bad passphrase error
    And no files are written to "decrypted/"

  Scenario: Decryption succeeds when directory "decrypted/" is freshly created
    Given directory "decrypted/" does not exist
    When the "Decrypt files" step runs
    Then "mkdir -p decrypted" creates the directory
    And decrypted files are written into "decrypted/"

  Scenario: PGP file with non-3-letter name is skipped during decryption
    Given file "participants-secrets/dev/readme.pgp" exists
    And file "participants-secrets/dev/AB.pgp" exists
    And file "participants-secrets/dev/ABCDE.pgp" exists
    And file "participants-secrets/dev/AND.pgp" exists
    When the "Decrypt files" step runs
    Then only "AND.pgp" is decrypted
    And "readme.pgp", "AB.pgp", "ABCDE.pgp" are skipped

  Scenario: No PGP files in participants-secrets/dev/
    Given no .pgp files exist in "participants-secrets/dev/"
    When the "Decrypt files" step runs
    Then the for-loop over "*.pgp" does not execute
    And directory "decrypted/" remains empty
    And subsequent "Generate countries.json" step produces an empty JSON object # Created by A302907 at 30.06.26