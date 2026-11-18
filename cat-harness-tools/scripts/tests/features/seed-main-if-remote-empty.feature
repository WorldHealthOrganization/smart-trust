# An EMPTY origin gets main before a feature branch can become the default.
# A remote with any branch is never touched, nothing is force-pushed.
# Each Scenario names the test that executes it.
Feature: Seeding main on an empty remote

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::an_empty_origin_gets_main_first::commits_on_a_feature_branch:_main_is_the_branch's_ROOT,_so_there_is_one_root
  Scenario: main is seeded from the feature branch's root commit
    Given an empty bare remote and a feature branch with two commits
    When main is seeded
    Then the result is seeded from "root-commit" at the root commit
    And the remote has only main, at the root commit
    And the feature branch descends from main, its tip and name unchanged
    And the feature branch then pushes normally

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::an_empty_origin_gets_main_first::a_branch_that_is_its_own_root_is_seeded,_and_the_empty_PR_is_reported
  Scenario: A single-commit branch is seeded and the empty PR reported
    Given a feature branch with one commit
    When main is seeded
    Then it is seeded from "root-commit" with a note mentioning "empty"
    And the formatted message says the "pull request will be empty"

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::an_empty_origin_gets_main_first::no_commits_yet:_an_empty_seed,_and_the_current_branch_starts_from_it
  Scenario: With no commits, an empty seed is pushed
    Given a feature branch with only a staged file
    When main is seeded
    Then it is seeded from "empty-seed" and the remote has main with no files
    And the feature branch points at main
    And the staged file is still staged
    And after committing, the branch's root is main

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::an_empty_origin_gets_main_first::a_local_main_is_what_is_pushed
  Scenario: A local main is what is pushed
    Given a local main with one commit and a feature branch from it
    When main is seeded
    Then it is seeded from "local-main" at that commit, and the remote's main is that commit

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::anything_but_an_empty_answer_leaves_the_remote_alone::a_remote_with_ANY_branch_is_not_touched,_even_one_that_is_not_main
  Scenario: A remote with any branch is left alone
    Given a remote holding only a "trunk" branch
    When main is seeded from another checkout
    Then the result is "remote-has-branches" and the remote still has only trunk
    And its formatted message is empty

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::anything_but_an_empty_answer_leaves_the_remote_alone::no_origin:_nothing
  Scenario: With no origin nothing happens
    Given a repository with no origin
    When main is seeded
    Then the result is "no-origin"

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::anything_but_an_empty_answer_leaves_the_remote_alone::a_remote_that_cannot_be_asked_stops,_and_seeds_nothing_locally
  Scenario: An unreachable remote stops without seeding locally
    Given an origin pointing at a path that does not exist
    When main is seeded
    Then the result is "stopped" and there is no local main

  @test:scripts/tests/seed-main-if-remote-empty.test.ts::anything_but_an_empty_answer_leaves_the_remote_alone::the_entry_point_exits_0_whatever_happens
  Scenario: The entry point always exits 0
    When the script runs against a checkout with an unreachable origin
    Then it exits 0 and says "main was not seeded"
