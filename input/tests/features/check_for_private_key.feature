Feature: Check for private key
  Background:
  Private keys are generated alongside with public keys by the participant and are used for signing DSCs and CMS.
  Whereas the public keys are for sharing the private keys should under all circumstances be kept private
  During onboarding the private repo of the participant must be checked for any private key material and if found
  the onboarding request must be rejected

  @security @private-key @scan @edge-cases
  Scenario Outline: Detect various private key formats in participant onboarding files
    Given the onboarding files have been copied from "repo/onboarding" to "<COUNTRY>/onboarding"
    When the directory "<COUNTRY>/onboarding" is recursively scanned for private key headers
    Then files containing "<header>" are flagged as containing private key material
    And the onboarding request is rejected
    Examples:
      | header                      |
      | BEGIN RSA PRIVATE KEY       |
      | BEGIN PRIVATE KEY           |
      | BEGIN EC PRIVATE KEY        |
      | BEGIN DSA PRIVATE KEY       |
      | BEGIN ENCRYPTED PRIVATE KEY |
      | BEGIN OPENSSH PRIVATE KEY   |

  @security @private-key @scan @unhandled-files
  Scenario: Unreadable or binary files are skipped during private key scan
    Given the onboarding files have been copied from "repo/onboarding" to "<COUNTRY>/onboarding"
    And some files are binary or have restricted permissions
    When the directory "<COUNTRY>/onboarding" is recursively scanned for private key headers
    Then unreadable files are silently skipped without raising an error
    And the scan continues with remaining files
    And only readable text files are checked for private key content













https://github.com/WorldHealthOrganization/tng-participants-dev/blob/main/.github/workflows/sys-on-cron-delivery-ext.yml