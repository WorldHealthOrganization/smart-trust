# scripts/check-instance-render.ts: renders each layer's graph and gives a verdict of rendered, failed or undetermined,
# checking temp layers that perturb one thing each and then this repository's own instances.
# Each Scenario names the test that executes it.
Feature: Instance render conformance check

  @test:scripts/tests/ui/instance-render.test.ts::could_not_determine_is_a_THIRD_state,_never_a_pass::no_declaration_is_undetermined,_not_failed_and_not_rendered
  Scenario: A layer with no declaration is undetermined
    Given a temp layer with no declaration file
    When it is rendered
    Then the verdict is "undetermined"
    And the reasons say "nothing declares what this instance is"

  @test:scripts/tests/ui/instance-render.test.ts::could_not_determine_is_a_THIRD_state,_never_a_pass::a_declaration_that_will_not_parse_is_undetermined_too
  Scenario: A declaration that will not parse is undetermined
    Given a temp layer whose declaration reads "{ not json"
    When it is rendered
    Then the verdict is "undetermined"
    And the node count is 0

  @test:scripts/tests/ui/instance-render.test.ts::could_not_determine_is_a_THIRD_state,_never_a_pass::undetermined_carries_NO_published_kinds_—_it_never_looked
  Scenario: An undetermined render carries no published or declared kinds
    Given a temp layer with no declaration file
    When it is rendered
    Then its published kinds are empty
    And its declared kinds are empty

  @test:scripts/tests/ui/instance-render.test.ts::an_empty_render_is_a_failure,_not_an_empty_success::zero_nodes_fails,_and_says_why_in_those_words
  Scenario: A render of zero nodes fails and says the empty graph is a failure
    Given a temp layer declaring one directory of the unpublished kind "fsh-guts"
    When it is rendered
    Then the verdict is "failed"
    And the node count is 0
    And it is not flagged noDirectories
    And the reasons say "empty graph is a failure"

  @test:scripts/tests/ui/instance-render.test.ts::an_instance_that_declares_no_directories_is_accepted,_and_reported_(C1)::`directories:_[]`_renders_nothing_of_its_own_and_is_rendered,_flagged_noDirectories
  Scenario: A layer declaring no directories renders nothing and is accepted, flagged noDirectories
    Given a temp layer declaring "directories: []"
    When it is rendered
    Then the verdict is "rendered" with node count 0
    And it is flagged noDirectories
    And there are no reasons

  @test:scripts/tests/ui/instance-render.test.ts::an_instance_that_declares_no_directories_is_accepted,_and_reported_(C1)::leaving_`directories`_out_is_not_declaring_none:_it_still_fails_when_it_renders_nothing
  Scenario: Leaving directories out still fails when nothing renders
    Given a temp layer whose declaration omits "directories"
    When it is rendered
    Then the verdict is "failed"
    And it is not flagged noDirectories
    And the reasons say "empty graph is a failure"

  @test:scripts/tests/ui/instance-render.test.ts::an_instance_that_declares_no_directories_is_accepted,_and_reported_(C1)::the_report_says_so,_in_the_instance's_line_and_in_the_summary
  Scenario: The report names a layer that declares no directories, in its line and in the summary
    Given the render of a temp layer declaring "directories: []"
    When the report is formatted
    Then it contains "declares no directories"
    And its summary reads "1 rendered (1 declare no directories: render-…), 0 failed"

  @test:scripts/tests/ui/instance-render.test.ts::declared_means_TRANSITIVELY_declared::a_nested_graph_file's_kinds_count_as_the_instance's
  Scenario: A nested graph file's kinds count as the instance's declared kinds
    Given a layer declaring a "beans" directory whose "beans/beans.json" declares "bean-defs" and "workflow-state" under graphTypologies
    When its declared kinds are read
    Then they are "bean-defs", "beans" and "workflow-state"

  @test:scripts/tests/ui/instance-render.test.ts::declared_means_TRANSITIVELY_declared::`kinds`_is_read_as_well_as_`graphs`_—_the_bean_graph_uses_both_spellings
  Scenario: A nested graph file's kinds spelling is read as well as graphTypologies
    Given a layer whose nested "beans/beans.json" declares "bean-defs" under "kinds"
    When its declared kinds are read
    Then they include "bean-defs"

  @test:scripts/tests/ui/instance-render.test.ts::declared_means_TRANSITIVELY_declared::an_unparseable_nested_file_does_not_manufacture_an_undeclared_kind
  Scenario: An unparseable nested graph file adds no kind
    Given a layer whose nested "beans/beans.json" reads "{ not json"
    When its declared kinds are read
    Then they are only "beans"

  @test:scripts/tests/ui/instance-render.test.ts::this_repository's_own_instances::every_instance_is_found_—_otherwise_everything_below_is_vacuous
  Scenario: Discovery finds every instance of this repository
    Given this repository's checkout
    When its instances are discovered
    Then they are, in order, bootstrap, bootstrap-tools, cat-harness, cat-harness-tools, fhir-harness, folio-assistant-core, folio-assistant-sci, smart-base, smart-immunizations, smart-trust, smart-trust-phw and who-iris
    And they include "folio-assistant-core"
    And they do not include "folio-assistant"
    And the checkout root is not one of them

  @test:scripts/tests/ui/instance-render.test.ts::this_repository's_own_instances::every_instance_renders,_and_none_renders_nothing_unless_it_declares_nothing
  Scenario: Every repository instance renders, and only one declaring nothing renders nothing
    Given each of this repository's instances, rendered once
    When each verdict is read
    Then every verdict is "rendered"
    And every instance not flagged noDirectories has more than zero nodes

  @test:scripts/tests/ui/instance-render.test.ts::this_repository's_own_instances::only_an_instance_that_declares_no_directories_is_let_off_rendering_nothing
  Scenario: Only an instance declaring no directories is let off rendering nothing
    Given each of this repository's instances flagged noDirectories
    When its declaration is read
    Then its directories are exactly []

  @test:scripts/tests/ui/instance-render.test.ts::this_repository's_own_instances::bootstrap's_OWN_skills_are_in_its_render_—_the_silent_drop,_pinned
  Scenario: Bootstrap's own skills are in its render
    # Gap: only checks bootstrap renders more than 10 nodes; the confirm-harness skill node is not looked up
    Given the bootstrap instance of this repository
    When it is rendered
    Then its node count is greater than 10

  @test:scripts/tests/ui/instance-render.test.ts::this_repository's_own_instances::an_instance_publishes_only_the_kinds_it_declares_—_the_count_is_now_ZERO
  Scenario: An instance publishes only the kinds it declares
    Given the bootstrap instance of this repository
    When it is rendered
    Then the verdict is "rendered"
    And it has no undeclared published kinds
    And "beans" is not among undeclared kinds

  @test:scripts/tests/ui/instance-render.test.ts::this_repository's_own_instances::...and_the_guard_is_not_vacuous_—_bootstrap_really_does_publish_kinds
  Scenario: Bootstrap really publishes kinds, all of them declared
    Given the bootstrap instance of this repository
    When it is rendered
    Then it publishes at least one kind
    And it declares at least one kind
    And every published kind is among its declared kinds
