# check:workflow-refs audits bootstrap at the repository root, and the set it
# walks must not be empty. Each Scenario names the test that executes it.
Feature: Workflow refs reach bootstrap

  @test:scripts/tests/workflow-refs-instances.test.ts::bootstrap_is_where_the_checker_looks_for_it::`bootstrap/`_is_at_the_REPOSITORY_root,_not_under_the_instance_root
  Scenario: bootstrap is at the repository root
    Then "bootstrap/" exists at the repository root
    And it does not exist under the harness instance root

  @test:scripts/tests/workflow-refs-instances.test.ts::bootstrap_is_where_the_checker_looks_for_it::its_diagrams_resolve_—_a_non-empty_set,_which_is_the_whole_point
  Scenario: bootstrap's diagrams resolve
    Then bootstrap has at least one process diagram

  @test:scripts/tests/workflow-refs-instances.test.ts::bootstrap_is_where_the_checker_looks_for_it::the_root's_own_walk_does_NOT_reach_them,_which_is_why_the_second_entry_exists
  Scenario: The harness's walk does not reach bootstrap's diagrams
    Then the harness root has more than 10 diagrams
    And none of bootstrap's diagrams is among them

  @test:scripts/tests/workflow-refs-instances.test.ts::bootstrap_is_where_the_checker_looks_for_it::a_DEPENDENCY_instance's_diagrams_are_reached_—_the_gap_is_bootstrap_alone
  Scenario: Dependency diagrams are reached
    Then some diagram the harness root walks lies outside the harness directory

  @test:scripts/tests/workflow-refs-instances.test.ts::the_checker,_run_as_a_command::exits_0_on_this_tree_and_counts_BOTH_instances'_diagrams
  Scenario: The checker counts both instances' diagrams
    Given the repository root has the manifest defining the "cat" alias
    When "bun run cat check:workflow-refs" runs
    Then it exits 0 and its summary line names 2 instances
    And its diagram count is the harness's plus bootstrap's

  @test:scripts/tests/workflow-refs-instances.test.ts::render:bpmn_covers_bootstrap,_whatever_the_walk's_shape::every_bootstrap_diagram_has_a_rendered_SVG_in_the_site_assets
  Scenario: Every bootstrap diagram has a rendered SVG
    # Gap: when bootstrap has no diagrams the test is not skipped and its loop asserts nothing.
    Given the site's workflow SVGs have been rendered
    Then every bootstrap diagram has an SVG of the same name in the site assets

  @test:scripts/tests/workflow-refs-instances.test.ts::render:bpmn_covers_bootstrap,_whatever_the_walk's_shape::no_two_diagrams_across_both_instances_share_a_basename
  Scenario: No two diagrams share a basename
    Then no basename repeats across the harness's and bootstrap's diagrams
    And there are more than 10 diagrams in all
