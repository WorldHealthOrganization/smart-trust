# The processes index must be true before it is useful (bean prhr): it sweeps
# every diagram, reports only gaps that exist, and joins skills to processes.
# Each Scenario names the test that executes it.
Feature: The processes index

  @test:scripts/tests/processes-viz.test.ts::the_sweep_actually_swept::finds_diagrams_at_all
  Scenario: The sweep finds diagrams
    When the process rows of the workspace are read
    Then there is at least one

  @test:scripts/tests/processes-viz.test.ts::the_sweep_actually_swept::reaches_MORE_THAN_ONE_instance
  Scenario: The sweep reaches more than one instance
    Then the rows' groups span more than one instance

  @test:scripts/tests/processes-viz.test.ts::the_sweep_actually_swept::indexes_no_decision_tables
  Scenario: No decision table is indexed
    Then every row's file is a .bpmn

  @test:scripts/tests/processes-viz.test.ts::a_gap_it_reports_is_a_gap_that_exists::every_diagram_named_as_unrendered_really_has_no_SVG
  Scenario: Every diagram reported unrendered has no SVG
    Then no row without an SVG has one at the docs layer's workflows path

  @test:scripts/tests/processes-viz.test.ts::a_gap_it_reports_is_a_gap_that_exists::and_every_SVG_it_names_is_on_disk
  Scenario: Every SVG the index names is on disk
    Then every row's named SVG exists

  @test:scripts/tests/processes-viz.test.ts::a_gap_it_reports_is_a_gap_that_exists::a_diagram_that_will_not_load_is_reported,_never_dropped
  Scenario: A diagram that will not load is reported on the page
    Then every row with a load error has a non-empty error and is named on the page
    # Gap: when no diagram fails to load the loop asserts nothing.

  @test:scripts/tests/processes-viz.test.ts::the_joins_are_the_point::every_skill_named_by_an_activity_is_reachable_from_the_index
  Scenario: Every skill named by an activity is reachable from the index
    Then the skill-to-processes join is not empty and holds every skill a row names

  @test:scripts/tests/processes-viz.test.ts::the_joins_are_the_point::the_reverse_join_names_files,_so_two_processes_running_one_skill_both_show
  Scenario: The reverse join names files, so two processes running one skill both show
    Then at least one skill is run by more than one process file

  @test:scripts/tests/processes-viz.test.ts::the_joins_are_the_point::bean_ops_come_from_the_parser,_not_a_regex_over_the_text
  Scenario: Bean ops come from the parser, not a regex
    Then the parsed bean-op total is at least the count a text scan of each file finds

  @test:scripts/tests/processes-viz.test.ts::a_skill-less_activity_is_a_census_entry,_not_an_accusation::there_are_some_to_reason_about
  Scenario: There are skill-less activities to reason about
    Then at least one row has an activity without a skill

  @test:scripts/tests/processes-viz.test.ts::a_skill-less_activity_is_a_census_entry,_not_an_accusation::does_NOT_call_them_a_requirement_violation
  Scenario: Skill-less activities are not called a requirement violation
    Then the page does not say one is required on every activity

  @test:scripts/tests/processes-viz.test.ts::a_skill-less_activity_is_a_census_entry,_not_an_accusation::names_the_beans_that_settled_it
  Scenario: The page names the beans that settled the census
    Then the page names luke and uuhu

  @test:scripts/tests/processes-viz.test.ts::a_skill-less_activity_is_a_census_entry,_not_an_accusation::separates_call_activities,_which_delegate_rather_than_omit
  Scenario: Call activities are separated
    Then at least one skill-less activity is a call activity, and the page says call activities delegate to a subprocess

  @test:scripts/tests/processes-viz.test.ts::a_skill-less_activity_is_a_census_entry,_not_an_accusation::and_declines_to_rule_on_the_rest,_saying_WHY_it_cannot
  Scenario: The rest are given no verdict, and the page says why
    Then the page says no verdict is offered and names the actor KIND

  @test:scripts/tests/processes-viz.test.ts::a_skill-less_activity_is_a_census_entry,_not_an_accusation::counts_roleRef_rather_than_characterising_it
  Scenario: roleRef is counted rather than characterised
    Then the page states how many of the remaining skill-less steps carry a roleRef, as numbers
    And no "present on" claim stands without a number

  @test:scripts/tests/processes-viz.test.ts::declared_and_defaulted_are_different_facts::reports_both,_and_does_not_merge_them
  Scenario: Declared and defaulted enforcement are reported apart
    Then the page has a declared and a defaulted enforcement column
    And some rows declare enforcement and some do not

  @test:scripts/tests/processes-viz.test.ts::declared_and_defaulted_are_different_facts::a_process_whose_file_declares_an_enforcement_VALUE_is_marked_declared
  Scenario: A process whose file declares an enforcement value is marked declared
    Then each row is marked declared exactly when its file's policy element carries an enforcement attribute

  @test:scripts/tests/processes-viz.test.ts::declared_and_defaulted_are_different_facts::declaring_a_value_implies_carrying_an_element,_but_not_the_reverse
  Scenario: Declaring a value implies a policy element, but not the reverse
    Then every row marked declared has a policy element
    And a declared file with its enforcement values struck out still has a policy element but declares no enforcement

  @test:scripts/tests/processes-viz.test.ts::the_committed_page_is_current::resolves_its_path_from_the_declaration
  Scenario: The page's path is resolved from the declaration
    Then the page's path is defined and under the page locale

  @test:scripts/tests/processes-viz.test.ts::the_committed_page_is_current::and_the_page_is_at_that_path
  Scenario: The page is at that path
    Given the page is committed or built
    Then it exists at the declared path or at the path without the locale

  @test:scripts/tests/processes-viz.test.ts::the_skill_→_run-by_table_links_what_resolves_(qgjh)::links_a_skill_that_has_a_page,_and_each_diagram_to_its_process_page
  Scenario: A skill with a page is linked, and each diagram to its process page
    When the page is rendered knowing the first joined skill has a page
    Then that skill's table row links its instruction page from the site root, and the diagram to its process page

  @test:scripts/tests/processes-viz.test.ts::the_skill_→_run-by_table_links_what_resolves_(qgjh)::leaves_a_skill_with_no_page_as_code,_never_a_link_that_404s
  Scenario: A skill with no page stays code
    When the page is rendered knowing of no skill pages
    Then that skill's table row starts with the skill as code

  @test:scripts/tests/processes-viz.test.ts::running_instances:_links_and_counts,_never_a_position_(bean_v49e)::links_each_instance_page_by_the_site_root_plus_its_declared_route
  Scenario: Each instance is linked by the site root plus its declared route
    Then the cell for Process_CRDM links the running instance and lists 1 finished, both by site root and route

  @test:scripts/tests/processes-viz.test.ts::running_instances:_links_and_counts,_never_a_position_(bean_v49e)::a_subprocess_lists_the_instances_that_call_it
  Scenario: A subprocess lists the instances that call it
    Then the cell for Process_CRDM_Needs links the running instance that calls it

  @test:scripts/tests/processes-viz.test.ts::running_instances:_links_and_counts,_never_a_position_(bean_v49e)::says_none_recorded,_and_none_running_when_only_finished_ones_exist
  Scenario: None recorded, and none running when only finished ones exist
    Then with no instances the cell says none recorded
    And with only a finished instance it says none running and links the finished one

  @test:scripts/tests/processes-viz.test.ts::running_instances:_links_and_counts,_never_a_position_(bean_v49e)::the_index_carries_the_column,_and_names_a_store_it_could_not_read
  Scenario: The index carries the instances column and names a store it could not read
    When the page is rendered with cat-harness's instances unread
    Then it has the running instances column, says none recorded, and says cat-harness's instances could not be read
