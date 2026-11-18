# sign.sh, the YubiKey signing wrapper, exercised with a plain ed25519 key
# file since CI has no YubiKey. Each Scenario names the test that executes it.
Feature: Signing wrapper

  Background:
    Given ssh-keygen is available
    And a sandbox home with an ed25519 signing key and a fresh git repository

  @test:scripts/tests/sign.test.ts::sign.sh::setup_writes_allowed_signers_and_turns_on_commit_signing
  Scenario: Setup writes allowed_signers and turns on commit signing
    When setup runs with --no-github
    Then it exits 0 and .signing/allowed_signers names the user's email for git and file namespaces
    And gpg.format is "ssh" and commit.gpgsign is "true"
    And running setup again leaves allowed_signers unchanged

  @test:scripts/tests/sign.test.ts::sign.sh::a_signed_commit_verifies
  Scenario: A signed commit verifies
    Given setup has run
    When a file is committed
    Then the commit succeeds and git verify-commit passes

  @test:scripts/tests/sign.test.ts::sign.sh::file_signs,_verify_passes,_and_a_changed_file_fails
  Scenario: A signed file verifies until it changes
    Given setup has run
    When a file is signed
    Then a .sig file is written
    And verify exits 0 saying "all 1 signatures verified"
    And after the file is changed verify exits 1 saying "signature does not match"

  @test:scripts/tests/sign.test.ts::sign.sh::a_signature_by_a_key_not_in_allowed_signers_fails
  Scenario: A signature by an unlisted key fails
    Given setup has run and a file is signed with a different key
    When the file is verified
    Then it exits 1 saying the key is "not in" the allowed signers

  @test:scripts/tests/sign.test.ts::sign.sh::a_file_with_no_.sig_fails
  Scenario: A file with no signature fails
    Given setup has run and a file has no .sig
    When the file is verified
    Then it exits 1 saying "no "
