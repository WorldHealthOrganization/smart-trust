# scripts/check-bean-rollup.ts finds beans whose status their own subtree contradicts, and sweeps
# in-progress claims into buckets by age, children and open PRs. Each Scenario names the test that executes it.
Feature: Bean status rollup and in-progress sweep

  @test:scripts/tests/check-bean-rollup.test.ts::a_status_its_own_subtree_refutes::an_open_container_whose_every_child_is_closed_is_reported
  Scenario: An open container whose children are all closed is reported
    Given an in-progress epic whose two children are completed and scrapped
    When the rollup findings are computed
    Then the only finding is "open-container-closed-subtree"
    And its message says the bean "asserts live work its own subtree denies"

  @test:scripts/tests/check-bean-rollup.test.ts::a_status_its_own_subtree_refutes::a_closed_container_with_an_open_child_is_reported,_and_names_the_count
  Scenario: A closed container with open children is reported with their count
    Given a completed epic with a todo child, an in-progress child and a completed child
    When the rollup findings are computed
    Then the only finding is "closed-container-open-subtree"
    And its message names "2 open child(ren)"

  @test:scripts/tests/check-bean-rollup.test.ts::a_status_its_own_subtree_refutes::a_container_with_one_open_child_is_silent_in_both_directions
  Scenario: An open container with an open child yields no finding
    Given an in-progress epic with one completed and one in-progress child
    When the rollup findings are computed
    Then there are no findings

  @test:scripts/tests/check-bean-rollup.test.ts::a_status_its_own_subtree_refutes::a_childless_bean_is_never_judged_as_a_container,_whatever_its_type
  Scenario: A bean with no children is never judged as a container
    Given an in-progress feature, a completed feature and an in-progress milestone, none with children
    When the rollup findings are computed
    Then there are no findings

  @test:scripts/tests/check-bean-rollup.test.ts::a_status_its_own_subtree_refutes::the_key_is_the_rule_and_the_id,_so_a_title_edit_cannot_move_it
  Scenario: A finding's key is the rule name and the bean id
    Given a completed epic "ep1" with a todo child
    When the rollup findings are computed
    Then the finding's key is "closed-container-open-subtree:ep1"

  @test:scripts/tests/check-bean-rollup.test.ts::the_sweep_carries_the_clock,_and_declines_to_guess::a_container_with_a_live_child_is_never_counted_as_a_stale_claim
  Scenario: A container with a live child is put in the container-live bucket
    Given an in-progress epic with three in-progress children, swept at 2026-09-22T18:00Z with no open PRs
    When the sweep runs
    Then the "container-live" bucket holds only "ep1"
    And its reading says "the claim is TRUE"

  @test:scripts/tests/check-bean-rollup.test.ts::the_sweep_carries_the_clock,_and_declines_to_guess::a_claim_touched_today_is_not_untouched
  Scenario: A claim updated within the day is not counted as untouched
    Given four in-progress beans, three last updated three days ago and "t3" an hour ago
    When the sweep runs
    Then 4 beans are in progress and 3 are untouched
    And "t3" appears in no bucket

  @test:scripts/tests/check-bean-rollup.test.ts::the_sweep_carries_the_clock,_and_declines_to_guess::an_open_PR_naming_a_leaf_makes_it_live,_not_a_candidate
  Scenario: A leaf named by an open PR goes in the open-PR bucket
    Given the same corpus and an open PR naming "t1"
    When the sweep runs
    Then the "leaf-open-pr" bucket holds only "t1"
    And the "leaf-no-open-pr" bucket holds only "t2"

  @test:scripts/tests/check-bean-rollup.test.ts::the_sweep_carries_the_clock,_and_declines_to_guess::with_no_GitHub_answer_the_leaves_are_one_UNJUDGED_bucket,_not_candidates
  Scenario: Without a GitHub answer the leaves are one unjudged bucket
    Given the same corpus and no answer from GitHub
    When the sweep runs
    Then the sweep records that GitHub was not consulted
    And there is no "leaf-no-open-pr" bucket
    And the "leaf-unjudged" bucket holds "t1" and "t2"
    And its reading says "unjudged is not stale"

  @test:scripts/tests/check-bean-rollup.test.ts::the_sweep_carries_the_clock,_and_declines_to_guess::a_bean_stating_no_`updated_at`_is_not_aged
  Scenario: A bean without updated_at has no age
    Given an in-progress task bean whose front matter has no "updated_at"
    When its age in days is computed
    Then the age is null
