# Per-criterion source hashing: a checker's hash covers only the declarations
# its dispatcher reaches, so editing one checker leaves its siblings' verdicts
# fresh. Each Scenario names the test that executes it.
Feature: Each QA criterion is hashed over the code it reaches

  Background:
    Given a checker module where "crit-a" reaches helperA and SHARED, and "crit-b" reaches only helperB

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::criteria_sharing_a_module_hash_independently
  Scenario: Criteria sharing a module hash independently
    When both criteria are hashed
    Then both hashes are present and they differ

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::hashing_is_deterministic
  Scenario: Hashing is deterministic
    When "crit-a" is hashed twice with the cache reset between
    Then the hashes are equal

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::editing_one_checker_leaves_its_siblings'_hashes_alone
  Scenario: Editing one checker leaves its sibling's hash alone
    When helperA's body is changed
    Then the hash of "crit-a" changes
    And the hash of "crit-b" does not

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::a_shared_declaration_invalidates_exactly_its_dependents
  Scenario: A shared declaration invalidates exactly its dependents
    When SHARED is changed
    Then the hash of "crit-a" changes
    And the hash of "crit-b" does not

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::unrelated_edits_elsewhere_in_the_module_change_nothing
  Scenario: Unrelated edits elsewhere in the module change nothing
    When an unrelated exported function is appended
    Then the hash of "crit-a" does not change

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::returns_null_for_a_criterion_the_module_does_not_dispatch
  Scenario: A criterion the module does not dispatch hashes to null
    When "crit-missing" is hashed
    Then the hash is null

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::returns_null_for_an_unreadable_file
  Scenario: An unreadable file hashes to null
    When "crit-a" is hashed in a file that does not exist
    Then the hash is null

  @test:scripts/tests/qa-criterion-hash.test.ts::criterionSourceHash::resolves_criteria_in_the_real_voice_checker_module
  Scenario: Criteria in the real voice checker module resolve
    Given the real pipeline/qa-checkers-voice.ts exists
    When "voice-scholarly-default" and "voice-ai-slop" are hashed in it
    Then both hashes are present and they differ
