# scripts/journeys/check.ts and scripts/check-journey-refs.ts (check:journey-refs) check
# that every reference a journey and a workshop name resolves, over fixture checkouts
# with fictional people. Each Scenario names the test that executes it.
Feature: Checking journey and workshop references

  @test:scripts/tests/journey-refs.test.ts::a_checkout_whose_every_reference_resolves::passes,_having_examined_every_sort_of_reference
  Scenario: A checkout whose every reference resolves passes, having examined every sort
    Given a two-layer checkout where every reference of the journeys and the workshop resolves
    When its journey references are checked
    Then there are no findings and nothing could not be determined
    And it counts 3 journeys and 1 workshop
    And at least 25 references were examined

  @test:scripts/tests/journey-refs.test.ts::the_negative_fixture:_one_broken_reference_of_each_sort::each_broken_reference_is_a_finding_naming_its_file_and_step
  Scenario: Each broken reference is a finding naming its file and step
    Given the same checkout with one broken reference of each sort in journey p4
    When its journey references are checked
    Then findings name the unknown persona "ghost", follows "p2-missing", partOf "no-group", cast actor "nobody" and view "no-such-view"
    And step P4 findings name the experience actor, the story, the missing BPMN task, the absent process file and the unknown block
    And step P4 findings name requirement "STT-VER-404", FHIR example "Bundle/missing", record.state "unknown-state", handoff.to "stranger" and the missing illustration

  @test:scripts/tests/journey-refs.test.ts::the_negative_fixture:_one_broken_reference_of_each_sort::a_workshop's_step_refs_must_name_a_journey_and_a_step_of_it
  Scenario: A workshop's step refs must name a journey and a step of it
    Given the broken workshop fixture
    When its journey references are checked
    Then findings name the scenario "no-journey", step "P9" of p4-scanned and scenario "nope"
    And discussion q1 findings name step "P0" of p3-ill and the malformed ref "not-a-ref"
    And presentation findings name recordOf "nobody" and device demo step "P99"

  @test:scripts/tests/journey-refs.test.ts::the_negative_fixture:_one_broken_reference_of_each_sort::a_FHIR_change's_examples_resolve_as_the_step's_do;_a_hand-off_end_in_words_is_not_an_actor
  Scenario: A FHIR change's examples resolve as the step's do, and a hand-off end in words is not an actor
    Given the broken fixture with a FHIR change example "Bundle/also-missing" and a hand-off from "Thai hospital"
    When its journey references are checked
    Then a finding names FHIR example "Bundle/also-missing"
    And no finding mentions "Thai hospital"

  @test:scripts/tests/journey-refs.test.ts::the_negative_fixture:_one_broken_reference_of_each_sort::a_file_that_does_not_parse_is_a_finding,_not_a_skip
  Scenario: A file that does not parse is a finding, not a skip
    Given the broken fixture with a journey file that does not parse
    When its journey references are checked
    Then a finding says journeys/broken.json does not parse

  @test:scripts/tests/journey-refs.test.ts::the_negative_fixture:_one_broken_reference_of_each_sort::nothing_that_resolves_is_reported
  Scenario: Nothing that resolves is reported
    Given the broken fixture
    When its journey references are checked
    Then no finding other than a parse failure names kamal, reem, wallet, Task_Scan or pilgrim-1

  @test:scripts/tests/journey-refs.test.ts::an_artifact_index_built_at_publish::absent_from_the_checkout:_an_example_it_would_hold_is_could-not-determine,_never_missing
  Scenario: An example in an absent publish-built artifact index is could-not-determine, never missing
    Given the clean checkout with no FHIR artifact index
    When its journey references are checked
    Then there are no findings
    And the one could-not-determine is at journeys/p4.json step P4, naming "Bundle/kamal-ips" and "built at publish"

  @test:scripts/tests/journey-refs.test.ts::an_artifact_index_built_at_publish::present_without_the_key:_the_example_is_missing,_a_finding
  Scenario: An example missing from a present artifact index is a finding
    Given the clean checkout whose step example is "Bundle/missing"
    When its journey references are checked
    Then nothing is could-not-determine
    And the only finding is that "Bundle/missing" is in no declared fhir-artifact-index

  @test:scripts/tests/journey-refs.test.ts::an_artifact_index_built_at_publish::a_MOUNTED_layer's_index_written_to_the_layer_output_root_is_read_there_(bean_cat-tools-sm8r_item_4)
  Scenario: A mounted layer's index written to the layer output root is read there
    Given the artifact index moved to build/layers/base/fhir/index.json and a lock mounting base
    When its journey references are checked
    Then there are no findings and nothing could not be determined

  @test:scripts/tests/journey-refs.test.ts::a_step's_DAK_assets_(user-scenario_0.3.0)::each_key_resolves_through_the_artifact_index,_as_an_example_does;_one_it_does_not_list_is_a_finding
  Scenario: A step's DAK asset keys resolve through the artifact index, and an unlisted one is a finding
    Given a 0.3.0 journey step with DAK assets "PlanDefinition/dt-01", which the index lists, and "Measure/ind-09", which it does not
    When its journey references are checked
    Then nothing is could-not-determine
    And the only finding says DAK asset "Measure/ind-09" is in no declared fhir-artifact-index

  @test:scripts/tests/journey-refs.test.ts::a_step's_DAK_assets_(user-scenario_0.3.0)::with_the_index_built_at_publish_and_absent,_each_key_is_could-not-determine,_never_missing
  Scenario: With the publish-built index absent, each DAK key is could-not-determine
    Given the same DAK assets and no artifact index
    When its journey references are checked
    Then there are no findings
    And the DAK could-not-determines are "PlanDefinition/dt-01" and "Measure/ind-09" in that order

  @test:scripts/tests/journey-refs.test.ts::a_journey_is_a_DAK_user_scenario_(user-scenario_specialises_it)::its_DAK_personas_are_the_roles_its_actors_play,_derived,_and_a_role_persona_is_read_as_it_is
  Scenario: A journey's DAK personas are the roles its actors play
    Given the clean checkout's journey corpus
    When the DAK user scenario of p4-scanned is derived
    Then it has id "p4-scanned", title "P4", description "d" and personas pilgrim and host-health-worker

  @test:scripts/tests/journey-refs.test.ts::a_journey_is_a_DAK_user_scenario_(user-scenario_specialises_it)::a_journey_none_of_whose_actors_plays_a_role,_or_whose_actor_plays_a_role_nobody_declares,_is_a_finding
  Scenario: A journey whose actors play no role, or an undeclared role, is a finding
    Given kamal plays no role and reem plays "ghost-role"
    When its journey references are checked
    Then p-all is reported as having no DAK personas because none of its actors plays a role
    And p4 is reported because its persona "ghost-role" is no role in a declared scenarios directory

  @test:scripts/tests/journey-refs.test.ts::a_journey_is_a_DAK_user_scenario_(user-scenario_specialises_it)::0.4.0:_a_plain_DAK_user_scenario_(personas_are_roles,_no_steps)_passes,_and_its_role_lists_the_actors_who_play_it
  Scenario: A plain 0.4.0 DAK user scenario passes, and its role lists the actors who play it
    Given a 0.4.0 journey whose personas are the role "pilgrim" and which has no steps
    When its journey references are checked
    Then there are no findings
    And reading the corpus gives its personas as "kamal"

  @test:scripts/tests/journey-refs.test.ts::composition_(user-scenario_0.4.0):_a_parent_lists_its_parts::parts_resolve,_the_parent's_personas_are_derived_from_them,_and_nothing_is_said_twice
  Scenario: Parts resolve and the parent's personas are derived from them
    Given p-all composed of parts p3-ill and p4-scanned, with no personas of its own
    When its journey references are checked
    Then there are no findings
    And p-all's personas read as kamal and reem

  @test:scripts/tests/journey-refs.test.ts::composition_(user-scenario_0.4.0):_a_parent_lists_its_parts::a_part_that_names_no_journey,_and_a_cycle_of_parts,_are_findings
  Scenario: A part naming no journey, and a cycle of parts, are findings
    Given p-all also lists part "p9-nowhere" and p4-scanned lists p-all as its part
    When its journey references are checked
    Then a finding says part "p9-nowhere" is no journey in this checkout
    And a finding names the cycle p-all → p4-scanned → p-all

  @test:scripts/tests/journey-refs.test.ts::composition_(user-scenario_0.4.0):_a_parent_lists_its_parts::what_the_parts_say_is_not_said_again:_follows_and_partOf_on_a_listed_part,_personas_that_are_exactly_the_parts'
  Scenario: What the parts say is not said again
    Given the composed p-all with personas reem and kamal, and p4 declaring follows p3-ill and partOf p-all
    When its journey references are checked
    Then p4's follows "p3-ill" and partOf "p-all" are each reported redundant
    And p-all's personas are reported redundant as exactly its parts' personas

  @test:scripts/tests/journey-refs.test.ts::a_step_that_includes_a_journey_(user-scenario_0.4.0)::agrees_with_the_call_activity_its_realisedBy_names
  Scenario: A step that includes a journey agrees with the call activity its realisedBy names
    Given step P4b includes journey triage and is realised by call activity Call_Triage, which calls Process_Triage
    When its journey references are checked
    Then there are no findings and nothing could not be determined

  @test:scripts/tests/journey-refs.test.ts::a_step_that_includes_a_journey_(user-scenario_0.4.0)::a_call_activity_of_another_process_is_a_finding_naming_both;_one_naming_no_process_is_could-not-determine
  Scenario: A call activity of another process is a finding, and one naming no process is could-not-determine
    Given the triage journey realised by Process_Other instead
    When its journey references are checked
    Then the only finding says includes "triage" disagrees, naming Call_Triage, Process_Triage and Process_Other
    And with the step realised by Call_Unnamed there are no findings and one could-not-determine saying it names no calledElement

  @test:scripts/tests/journey-refs.test.ts::a_step_that_includes_a_journey_(user-scenario_0.4.0)::a_call_activity_with_no_includes_is_silent,_and_an_includes_naming_no_journey_is_a_finding
  Scenario: An includes naming no journey is a finding, and a call activity with no includes is silent
    Given the including step changed to include "nowhere"
    When its journey references are checked
    Then the only finding says includes "nowhere" is no journey in this checkout
    And with the includes removed there are no findings

  @test:scripts/tests/journey-refs.test.ts::a_step's_people_default_to_its_lanes_(user-scenario_0.4.0)::with_no_experiences,_the_actors_who_play_its_tasks'_lanes_do_them,_the_first_leading
  Scenario: With no experiences a step's people are the actors playing its tasks' lanes, the first leading
    Given a 0.4.0 step with no experiences and no lead, realised by Task_Show and Task_Scan
    When its journey references are checked and the corpus is read
    Then there are no findings
    And the step's lead is kamal
    And its experiences are kamal doing "Show the code" and reem doing "Scan"

  @test:scripts/tests/journey-refs.test.ts::a_step's_people_default_to_its_lanes_(user-scenario_0.4.0)::a_lead_that_repeats_the_derived_one_is_redundant,_and_a_step_whose_lanes_no_persona_plays_is_a_finding
  Scenario: A lead repeating the derived one is redundant, and a step whose lanes no persona plays is a finding
    Given a lane-derived step with an explicit lead "kamal"
    When its journey references are checked
    Then the only finding says the lead "kamal" is redundant
    And given a step on Task_Scan in a journey whose only persona is kamal, a finding says no persona plays a lane of its tasks

  @test:scripts/tests/journey-refs.test.ts::the_command::exits_2,_not_0_or_1,_when_the_only_open_reference_is_in_an_index_built_at_publish
  Scenario: The command exits 2 when the only open reference is in a publish-built index
    Given the clean checkout with no artifact index
    When check-journey-refs.ts is run on it
    Then it exits 2
    And stderr says "could not be determined"

  @test:scripts/tests/journey-refs.test.ts::the_command::exits_0_on_the_clean_checkout_and_1_on_a_broken_one,_naming_the_finding
  Scenario: The command exits 0 on a clean checkout and 1 on a broken one, naming the finding
    When check-journey-refs.ts is run on the clean checkout
    Then it exits 0 and prints "✓ journey-refs:"
    And run on a checkout with story "ghost-story" it exits 1 and stderr names it

  @test:scripts/tests/journey-refs.test.ts::overview_gaps:_what_a_workshop's_VaxLink_overview_would_leave_out::the_clean_fixture_names_each_part_its_journeys_do_not_declare,_and_never_fails_on_it
  Scenario: The clean fixture warns of each overview part its journeys do not declare, and never fails on it
    Given the clean checkout
    When its journey references are checked
    Then there are no findings
    And overview-gap warnings name the missing one-sentence story, scenes on p3-ill and p4-scanned, the trustLadder on p3-ill and the illustration on P3
    And warnings name the ladder declared without a recordOf and the empty Device Demo

  @test:scripts/tests/journey-refs.test.ts::overview_gaps:_what_a_workshop's_VaxLink_overview_would_leave_out::declaring_the_parts_clears_their_warnings
  Scenario: Declaring the overview parts clears their warnings
    Given a workshop with a story, recordOf kamal and a device demo, teaching only p4-scanned which has a scene
    When its journey references are checked
    Then there are no warnings
