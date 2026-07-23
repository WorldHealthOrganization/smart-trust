# =============================================================================
# gpg_country_config_decryption.feature  (revised)
#
# OPPORTUNITIES TO STRENGTHEN THIS SPEC
#   (The coverage and intent here are already right — these are refinements so
#    each check stays observable, unambiguous, and survives a refactor.)
#   It leans on shell internals rather than observable outputs:
#     - "mkdir -p decrypted creates the directory"        -> tests a command
#     - "the for-loop over *.pgp does not execute"         -> tests control flow
#     - "each gpg --decrypt command includes flags: ..."   -> tests CLI flags
#     - "~/.gnupg permissions are 700" / "gpg.conf ..."    -> internal, env-dependent
#   Small factual slip: "gpg --list-keys succeeds WITH passphrase" — listing keys
#   needs no passphrase. Scope creep: a DECRYPT feature asserting on the
#   downstream countries.json step. Precision gap: uppercase-only pattern but
#   lowercase examples, with case-sensitivity left undefined. It also never
#   checked the decrypted CONTENT was correct, only that a file existed.
#
# SUGGESTED DIRECTION
#   Test the STAGE'S OUTPUT: given encrypted secrets in, assert the decrypted
#   files that come out (names AND content), and the failure behaviour on bad
#   input. Nothing about gpg flags, mkdir, or loops. countries.json belongs to
#   check_country_delivery.feature.
# =============================================================================
@secrets @gpg @decryption
Feature: Decrypt participant secrets (Country Delivery pipeline stage)
  Given encrypted country secrets, the decrypt stage produces one decrypted
  file per valid 3-letter uppercase country code, and fails cleanly on bad input.

  Background:
    Given the decrypt stage has the GPG private key and its passphrase
    And encrypted files are present in "participants-secrets/dev/"

  Scenario: Only files named with a 3-letter uppercase code are decrypted
    Given the following encrypted files exist:
      | file       | decrypted | reason                     |
      | AND.pgp    | yes       | 3 uppercase letters        |
      | FRA.pgp    | yes       | 3 uppercase letters        |
      | README.pgp | no        | not a 3-letter code        |
      | AB.pgp     | no        | 2 letters                  |
      | ABCD.pgp   | no        | 4 letters                  |
      | and.pgp    | no        | lowercase (case-sensitive) |   # stronger: pins the case rule the original left undefined
    When the decrypt stage runs
    Then "decrypted/AND.txt" and "decrypted/FRA.txt" are created
    And no other files are created in "decrypted/"

  Scenario: Decrypted content round-trips the original secret
    # stronger: the original only checked a file EXISTS. Prove decryption is correct
    # by round-tripping a known plaintext.
    Given "AND.pgp" was produced by encrypting the secret "andorra-secret"
    When the decrypt stage runs
    Then "decrypted/AND.txt" contains exactly "andorra-secret"

  @negative
  Scenario: A wrong passphrase fails the stage and writes nothing
    Given the provided passphrase is incorrect
    When the decrypt stage runs
    Then the stage fails
    And no files are written to "decrypted/"

  @negative
  Scenario: A corrupt or non-PGP input fails the stage
    Given "AND.pgp" is not a valid PGP message
    When the decrypt stage runs
    Then the stage fails
    And no files are written to "decrypted/"

  Scenario: No encrypted input yields no decrypted output, and the stage succeeds
    # stronger: replaces "the for-loop does not execute" (unobservable). The behaviour
    # is simply: nothing in -> nothing out, stage still succeeds.
    Given no ".pgp" files exist in "participants-secrets/dev/"
    When the decrypt stage runs
    Then "decrypted/" is empty
    And the stage succeeds
