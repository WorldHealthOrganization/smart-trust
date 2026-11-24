# scripts/gen-bat-wrappers.sh --check (bat:sync:check) verifies the scripts its wrapper list names; in a
# content root it excuses entries no mounted instance holds. Each Scenario names the test that executes it.
Feature: bat:sync:check over entries this root does not hold

  @test:scripts/tests/sdlc/gen-bat-wrappers-not-applicable.test.ts::bat:sync:check_—_entries_this_root_does_not_hold::a_content_root_excuses_entries_no_mounted_instance_holds,_and_says_so
  Scenario: A content root excuses absent entries no mounted instance holds and prints why
    Given a joined checkout with no gates workflow and no cat-harness-tools instance file, so every wrapped entry is absent
    When gen-bat-wrappers.sh runs with "--check"
    Then the output says "· .claude/skills/hooks/session-start.sh not applicable here"
    And the output contains "not applicable here)"
    And the exit code is 0

  @test:scripts/tests/sdlc/gen-bat-wrappers-not-applicable.test.ts::bat:sync:check_—_entries_this_root_does_not_hold::an_absent_entry_under_a_MOUNTED_instance_is_still_an_error
  Scenario: An absent entry under a mounted instance is still an error
    Given a content-root checkout that mounts the cat-harness-tools instance but holds none of its wrapped scripts
    When gen-bat-wrappers.sh runs with "--check"
    Then the exit code is 2
    And the output contains "ERROR: cat-harness-tools/scripts/"

  @test:scripts/tests/sdlc/gen-bat-wrappers-not-applicable.test.ts::bat:sync:check_—_entries_this_root_does_not_hold::a_harness_root_is_judged_as_before:_the_root-level_entry_is_an_error
  Scenario: In a harness root an absent root-level entry is an error
    Given a checkout carrying the code-quality gates workflow, which makes it a harness root
    When gen-bat-wrappers.sh runs with "--check"
    Then the exit code is 2
    And the output contains "ERROR: .claude/skills/hooks/session-start.sh does not exist"
