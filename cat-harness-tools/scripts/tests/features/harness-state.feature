# scripts/harness-state.ts builds an instance's state from its init steps: the initialization position, next action, counts and badge,
# with build-machine paths made relative and partial lock mounts detected.
# Each Scenario names the test that executes it.
Feature: Harness initialization state

  @test:scripts/tests/harness-state.test.ts::harness-state_(bean_supn)::position_is_the_first_not-done_step,_and_next_is_its_action,_said_and_not_done
  Scenario: The position is the first not-done step and next is its action
    Given steps "declaration" done, "directory:a" not-done with action "create /repo/x/a", and "readme" not-done
    When the state of instance "x" under "/repo" is built
    Then the position is "directory:a"
    And next is step "directory:a" with action "create x/a"
    And the counts are 1 done, 2 not-done, 0 could-not-determine, 0 stated
    And the first health badge is "initialization" in state "finding" labelled "2 setup step(s) not done"

  @test:scripts/tests/harness-state.test.ts::harness-state_(bean_supn)::no_not-done_step_is_`complete`,_and_only_could-not-determine_left_is_unknown,_never_ok
  Scenario: With no not-done step the position is complete and undetermined steps make the badge unknown
    Given steps "declaration" done and "site:live" could-not-determine
    When the state of instance "x" is built
    Then the position is "complete"
    And next is null
    And the first health badge state is "unknown"
    And a badge for 3 done and 1 stated with nothing undetermined is "ok"

  @test:scripts/tests/harness-state.test.ts::harness-state_(bean_supn)::published_paths_carry_no_build-machine_directory
  Scenario: Published paths carry no build-machine directory
    When relativize is applied to "/repo/x/a and /repo" with root "/repo"
    Then it returns "x/a and ."
    And the serialised state of instance "x" under "/repo" does not contain "/repo/"

  @test:scripts/tests/harness-state.test.ts::harness-state_(bean_supn)::an_instance_the_lock_mounts_in_part_is_partial;_whole,_or_without_a_lock,_is_not
  Scenario: An instance the lock mounts in part is partial
    Given a repository with instance directories "a" and "b" and no lock
    Then "a" is not partially mounted
    And once "index.lock.json" mounts all of "a" but only "b/library" of "b", "a" is not partial and "b" is
    And the step "directory:docs" reads instance files while "needs:cat-harness" does not
