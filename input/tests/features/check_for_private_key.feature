# =============================================================================
# check_for_private_key.feature  (CORRECTED)
#
# WHERE THE ORIGINAL METHODOLOGY WAS WRONG
#   - Asserted HOW the scan runs ("the directory is recursively scanned for
#     private key headers") instead of the OUTCOME (request rejected).
#   - Used an unresolved "<COUNTRY>" placeholder inside a plain Scenario with no
#     Examples table (it only works in a Scenario Outline).
#   - Had NO positive case: a rejection rule with no "clean request is accepted"
#     scenario is untested for false positives (it could reject everything).
#
# CORRECTED APPROACH
#   Assert the OUTCOME of the scan: a request containing any private-key header
#   is rejected; a clean request passes; unreadable files don't break it.
# =============================================================================
@security @private-key @scan
Feature: Reject onboarding requests that contain private-key material
  A participant's private keys must never enter the trust repo. Given onboarding
  files, the scan stage rejects any request that contains private-key material
  and accepts one that does not.

  Background:
    Given an onboarding request for country "XT"

  Scenario: A request containing any private-key format is rejected
    # The scan must catch every common PEM/OpenSSH private-key header.
    Given the request includes a file containing one of:
      | header                      |
      | BEGIN RSA PRIVATE KEY       |
      | BEGIN PRIVATE KEY           |
      | BEGIN EC PRIVATE KEY        |
      | BEGIN DSA PRIVATE KEY       |
      | BEGIN ENCRYPTED PRIVATE KEY |
      | BEGIN OPENSSH PRIVATE KEY   |
    When the private-key scan runs
    Then the request is rejected as containing private-key material

  Scenario: A clean request (only public certs and metadata) is accepted
    # FIX: the missing positive case — proves the scan doesn't reject valid
    # onboarding (guards against false positives).
    Given the request contains only public certificates and metadata
    When the private-key scan runs
    Then the request passes the private-key scan

  Scenario: Binary and unreadable files are skipped without hiding a real hit
    # FIX: replaces "unreadable files are silently skipped" phrased as internal
    # behaviour — assert both that the scan doesn't error AND that a genuine
    # private key elsewhere is still caught.
    Given the request includes binary and unreadable files
    And one readable text file contains "BEGIN PRIVATE KEY"
    When the private-key scan runs
    Then the scan completes without error
    And the request is still rejected for the text file's private-key material
