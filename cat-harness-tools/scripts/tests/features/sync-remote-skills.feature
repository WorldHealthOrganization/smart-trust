# Materializing a remote package's skills, pinned and read-only (issue #556).
# Each Scenario names the test that executes it.
Feature: Synced remote skills

  @test:scripts/tests/sync-remote-skills.test.ts::a_synced_skill_is_pinned_to_a_commit::a_full_SHA_is_a_pin;_a_branch_or_a_short_SHA_is_not
  Scenario: Only a full SHA is a pin
    Then a 40-hex SHA is a pin
    And "main" and a 12-character SHA are not

  @test:scripts/tests/sync-remote-skills.test.ts::a_synced_skill_is_pinned_to_a_commit::the_schema_refuses_a_syncing_wrapper_on_a_branch,_or_one_that_auto-updates
  Scenario: The schema refuses a syncing wrapper on a branch or auto-updating
    Given a syncing wrapper pinned to a full SHA
    Then the schema reports no issues
    And with ref "main", or with autoUpdate true, it is refused
    And a wrapper with no sync block may name "main"

  @test:scripts/tests/sync-remote-skills.test.ts::check:remote-skills,_offline::materialized_at_the_pin_is_clean
  Scenario: A skill materialized at the pin is clean
    Given a wrapper and its skill materialized with a licence and a record at the pin
    Then the check has no findings

  @test:scripts/tests/sync-remote-skills.test.ts::check:remote-skills,_offline::a_copy_without_its_licence_is_a_finding
  Scenario: A copy without its licence is a finding
    Given the materialized skill's LICENSE is removed
    Then a finding says "no licence file"

  @test:scripts/tests/sync-remote-skills.test.ts::check:remote-skills,_offline::declared_and_not_materialized_is_a_finding
  Scenario: A declared but unmaterialized skill is a finding
    Given a wrapper whose skill is not materialized
    Then a finding says "not materialized"

  @test:scripts/tests/sync-remote-skills.test.ts::check:remote-skills,_offline::materialized_at_a_different_commit_than_the_pin_is_a_finding
  Scenario: A skill materialized at another commit is a finding
    Given the skill's record names another commit
    Then a finding says "re-sync"

  @test:scripts/tests/sync-remote-skills.test.ts::check:remote-skills,_offline::materialized_from_another_package_is_a_finding
  Scenario: A skill materialized from another package is a finding
    Given the skill's record names package "other"
    Then a finding says "declared by"

  @test:scripts/tests/sync-remote-skills.test.ts::check:remote-skills,_offline::an_unpinned_syncing_wrapper_is_a_finding
  Scenario: An unpinned syncing wrapper is a finding
    Given a wrapper with ref "main"
    Then a finding says "not a full commit SHA"

  @test:scripts/tests/sync-remote-skills.test.ts::the_record_check:materialized-fixity_reads::one_sha256_record_per_file,_instance-relative,_pointing_at_the_pinned_upstream_blob
  Scenario: The fixity record has one entry per file
    Given a materialized skill with "alpha.md" and "references/r.md"
    When its record is built
    Then the files are "alpha.md" and "references/r.md"
    And the first has local path "skills/alpha/alpha.md", an upstream blob URL at the pinned SHA, and a 64-hex digest

  @test:scripts/tests/sync-remote-skills.test.ts::the_record_check:materialized-fixity_reads::the_upstream_directory_follows_the_wrapper's_path
  Scenario: The upstream skill directory follows the wrapper's path
    Then path "skills" gives "/c/skills/a" and path "/" gives "/c/a"

  @test:scripts/tests/sync-remote-skills.test.ts::the_licence_travels_with_the_copy::a_skill's_own_licence_wins;_else_the_upstream_root's;_else_none
  Scenario: Which licence travels with a skill
    Given a clone with no licence anywhere
    Then there is no licence
    When the clone's root gets a LICENSE
    Then that one is used, not in the skill
    When the skill gets its own LICENSE.txt
    Then the skill's own one is used

  @test:scripts/tests/sync-remote-skills.test.ts::NOTICE_credits_every_synced_package_at_its_pin::named_at_the_pin_is_clean;_a_moved_pin_or_a_missing_entry_is_a_finding
  Scenario: NOTICE credits every synced package at its pin
    Then a NOTICE naming the package at its SHA is clean
    And one naming it at an older commit gives a "current pin" finding
    And one not naming it gives a "does not name" finding
