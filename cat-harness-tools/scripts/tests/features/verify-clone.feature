# sub-kg:verify-clone: the three verdicts, against local repositories cloned
# by path. Each Scenario names the test that executes it.
Feature: Verify a clone

  @test:scripts/tests/verify-clone.test.ts::verify-clone::green_when_every_gate_passes
  Scenario: Every gate passing is green
    Given a local repository holding "README.md"
    When it is cloned and verified with gate "test -f README.md"
    Then the verdict is "green", the commit is a 40-hex sha, and the scratch directory is removed

  @test:scripts/tests/verify-clone.test.ts::verify-clone::red_when_a_gate_fails
  Scenario: A failing gate is red
    When the repository is verified with gate "test -f missing.txt"
    Then the verdict is "red"

  @test:scripts/tests/verify-clone.test.ts::verify-clone::unknown,_never_green:_no_gate_to_judge_by
  Scenario: No gates is unknown
    When the repository is verified with no gates
    Then the verdict is "unknown"

  @test:scripts/tests/verify-clone.test.ts::verify-clone::unknown,_never_green:_an_empty_tree
  Scenario: An empty tree is unknown
    Given a repository with only an empty commit
    When it is verified with gate "true"
    Then the verdict is "unknown"

  @test:scripts/tests/verify-clone.test.ts::verify-clone::unknown,_never_green:_the_clone_fails
  Scenario: A failed clone is unknown
    When a path that is not a repository is verified with gate "true"
    Then the verdict is "unknown" and the first step "could-not-run"

  @test:scripts/tests/verify-clone.test.ts::verify-clone::a_work_directory_given_is_kept
  Scenario: A given work directory is kept
    When a repository is verified with gate "true" in a given work directory
    Then the verdict is "green" and the work directory still exists

  @test:scripts/tests/verify-clone.test.ts::verify-clone::owner/name_becomes_a_GitHub_URL;_the_verdict_needs_at_least_one_step
  Scenario: owner/name is a GitHub URL; no steps is unknown
    Then "owner/name-not-a-path" clones from "https://github.com/owner/name-not-a-path.git"
    And the verdict of no steps is "unknown"
