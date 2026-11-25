# The secret scanner, falsified: it must find a credential that announces
# itself, stay quiet on hashes, and never report clean over a root it did not
# read. Each Scenario names the test that executes it.
Feature: Secret leak scanner

  @test:scripts/tests/secret-leaks.test.ts::it_finds_a_credential_that_announces_itself::a_classic_GitHub_PAT
  Scenario: A classic GitHub PAT is found
    Given a source file holding "ghp_" followed by 36 characters
    When the tree is scanned
    Then the only leak is "github-pat-classic"

  @test:scripts/tests/secret-leaks.test.ts::it_finds_a_credential_that_announces_itself::a_private_key_block
  Scenario: A private key block is found
    Given a file holding a BEGIN RSA PRIVATE KEY marker
    When the tree is scanned
    Then the only leak is "private-key-block"

  @test:scripts/tests/secret-leaks.test.ts::it_finds_a_credential_that_announces_itself::an_AWS_access_key_id
  Scenario: An AWS access key id is found
    Given a YAML file holding "AKIA" followed by 16 characters
    When the tree is scanned
    Then the only leak is "aws-access-key-id"

  @test:scripts/tests/secret-leaks.test.ts::it_finds_a_credential_that_announces_itself::a_finding_does_not_itself_leak_the_secret
  Scenario: A finding does not repeat the secret
    Given a file holding a GitHub PAT
    When the tree is scanned
    Then the leak's redacted text does not contain the secret and contains "…"

  @test:scripts/tests/secret-leaks.test.ts::it_is_quiet_on_what_this_corpus_is_actually_full_of::12-char_hashes,_git_SHAs_and_@id_URIs_are_not_findings
  Scenario: Hashes, SHAs and @id URIs are not findings
    Given files holding 12-character field hashes, a git SHA, an @id URI and branch paths
    When the tree is scanned
    Then there are no leaks

  @test:scripts/tests/secret-leaks.test.ts::could-not-scan_is_the_third_state_and_outranks_clean::a_declared_root_that_is_not_there_is_reported,_never_silently_skipped
  Scenario: A missing root is reported as unreadable
    # Gap: asserts only the unreadable list (and zero leaks); no verdict is computed, so "outranks clean" is not checked.
    When the tree is scanned over "src" and "does-not-exist"
    Then the unreadable roots are exactly "does-not-exist"
    And there are no leaks

  @test:scripts/tests/secret-leaks.test.ts::the_pattern_set::every_pattern_is_prefix-anchored_or_a_literal_block_—_none_is_entropy
  Scenario: Every pattern is anchored
    When each secret pattern's source is read
    Then it starts with a word boundary and a literal prefix, or is a BEGIN block, or names api key

  @test:scripts/tests/secret-leaks.test.ts::scan_roots_come_from_the_instances_present_(bean_0r7u)::standalone,_with_no_instance_above,_only_the_fixed_roots_are_scanned
  Scenario: Standalone, only the fixed roots are scanned
    Given an empty directory
    Then the scan roots are .github, cat-harness, beans and package.json

  @test:scripts/tests/secret-leaks.test.ts::scan_roots_come_from_the_instances_present_(bean_0r7u)::an_instance's_skills_and_glossary_graphs_are_added;_its_other_graphs_are_not
  Scenario: An instance's skills and glossary directories are scanned
    Given an instance "acme" declaring skills, glossary and library directories
    Then the scan roots are the fixed roots plus acme/glossary and acme/skills

  @test:scripts/tests/secret-leaks.test.ts::scan_roots_come_from_the_instances_present_(bean_0r7u)::a_directory_under_a_fixed_root_is_not_scanned_twice
  Scenario: A directory under a fixed root is not added again
    Given an instance "cat-harness" declaring a skills directory
    Then the scan roots are only the fixed roots
