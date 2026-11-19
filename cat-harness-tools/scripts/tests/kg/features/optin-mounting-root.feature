# A check resolving a mounted layer sees the opt-in sub-graphs the mounting root switched on,
# not the mounted layer's own list: directories, known skills, workflows, check:tools'
# satisfies targets, the SKILLS.md index, readme:sync and test-plan exit DMNs.
# Each Scenario names the test that executes it.
Feature: The mounting root's opt-in list decides for a mounted layer

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_consumer_that_switched_a_group_OFF_that_the_mounted_layer_has_on::the_mounting_root's_list_decides
  Scenario: A consumer's switched-off group is off for the mounted layer
    Given "up" switches "up.ops" on for itself and leaves "up.extra" off
    And a consumer mounting "up" whole with no group switched on
    Then the mounted "up"'s enabled sub-graphs are empty
    And "ops" is not among its directories

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_consumer_that_switched_a_group_OFF_that_the_mounted_layer_has_on::its_skills_do_not_exist_for_check:tools_/_check:workflow-refs,_and_its_workflows_are_not_read
  Scenario: A switched-off group's skills and workflows are not seen
    Given a consumer mounting "up" whole with no group switched on
    When the mounted "up"'s known skills and workflow files are read
    Then "base" is a known skill
    And "ops-skill" is not
    And no workflow file is read

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_consumer_that_switched_a_group_ON_that_the_mounted_layer_has_off::the_mounting_root's_list_decides
  Scenario: A consumer's switched-on group is on for the mounted layer
    Given "up" leaves "up.extra" off for itself
    And a consumer mounting "up" with only "up.extra" switched on
    Then the mounted "up"'s enabled sub-graphs are exactly "up.extra"
    And "extra" is among its directories and "ops" is not

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_consumer_that_switched_a_group_ON_that_the_mounted_layer_has_off::its_skills_exist_and_its_workflows_are_read
  Scenario: A switched-on group's skills exist and its workflows are read
    Given a consumer mounting "up" with only "up.extra" switched on
    Then "extra-skill" is a known skill
    And the workflow files read are exactly "extra/processes/extra.bpmn"

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_layer_no_mount_placed_keeps_its_own_list::`ops`_on,_`extra`_off,_as_`up`_declares_for_itself
  Scenario: A layer no mount placed keeps its own opt-in list
    Given "up" placed directly with both "ops/" and "extra/" on disk
    Then its enabled sub-graphs are exactly "up.ops"
    And "ops" is among its directories and "extra" is not
    And "ops-skill" is a known skill and "extra-skill" is not

  @test:scripts/tests/kg/optin-mounting-root.test.ts::check:tools:_a_`satisfies`_target_in_a_group_the_mounting_root_switched_off_(card_Q-SKILL-TOOL-LINK_B)::left_out_by_the_mount:_a_Tool_of_the_mounted_layer_naming_a_skill_there_is_not_judged
  Scenario: A satisfies target in a group left out by the mount is not judged
    Given a consumer mounting "up" with no group switched on
    When the switched-off skill homes are gathered
    Then "up" has "up.extra" and "up.ops" left out
    And the satisfies target "ops-skill" from a Tool of "up" is excused by those two groups

  @test:scripts/tests/kg/optin-mounting-root.test.ts::check:tools:_a_`satisfies`_target_in_a_group_the_mounting_root_switched_off_(card_Q-SKILL-TOOL-LINK_B)::switched_off_but_still_on_disk:_judged_by_name_—_held_is_not_judged,_absent_is_dangling
  Scenario: A switched-off group still on disk is judged by name
    Given "up" placed directly with "extra/" on disk though "up.extra" is off for itself
    When the switched-off skill homes are gathered
    Then no layer has a group left out
    And "extra-skill" is excused by "up.extra" with a reason mentioning "switched off"
    And "no-such-skill" is not excused, so it dangles

  @test:scripts/tests/kg/optin-mounting-root.test.ts::check:tools:_a_`satisfies`_target_in_a_group_the_mounting_root_switched_off_(card_Q-SKILL-TOOL-LINK_B)::a_group_the_mounting_root_switched_ON_that_is_missing:_dangling
  Scenario: A switched-on group that is missing is dangling
    Given a consumer mounting "up" with "up.extra" switched on, and "extra/" deleted
    When the switched-off skill homes are gathered
    Then only "up.ops" is left out for "up"
    And "extra-skill" is not held
    And "extra-skill" named from a Tool of another layer is not excused

  @test:scripts/tests/kg/optin-mounting-root.test.ts::check:tools:_a_`satisfies`_target_in_a_group_the_mounting_root_switched_off_(card_Q-SKILL-TOOL-LINK_B)::a_name_no_layer_holds,_from_a_Tool_whose_layer_left_nothing_out:_dangling
  Scenario: A name no layer holds, from a layer that left nothing out, is dangling
    Given a consumer mounting "up" with both groups switched on
    When the switched-off skill homes are gathered
    Then no layer has a group left out
    And "no-such-skill" from a Tool of "up" is not excused

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_left-out_group's_skills_are_named_by_the_layer's_committed_index_(smart-ips-pilgrimage#66)::a_name_the_index_lists_in_a_left-out_group_is_held_there,_whichever_layer_refers_to_it
  Scenario: A skill the committed index lists in a left-out group is held there for any layer
    Given a consumer mounting "up" with no group switched on
    And "up"'s SKILLS.md lists "ops-skill" under opt-in "up.ops" and "extra-skill" under opt-in "up.extra"
    When the switched-off skill homes are gathered
    Then no layer is left with an unlisted left-out group
    And "ops-skill" referred to from another layer is excused by "up.ops"
    And "no-such-skill" is not excused

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_left-out_group's_skills_are_named_by_the_layer's_committed_index_(smart-ips-pilgrimage#66)::a_left-out_group_the_index_does_not_list_keeps_the_narrower_pass:_the_layer's_own_refs_only
  Scenario: A left-out group the index does not list excuses only the layer's own refs
    Given a consumer mounting "up" with no group switched on
    And "up"'s SKILLS.md lists only the "up.ops" section
    When the switched-off skill homes are gathered
    Then "up.extra" is left out for "up"
    And "extra-skill" referred to from another layer is not excused
    And "extra-skill" referred to from "up" itself is excused by "up.extra"

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_left-out_group's_skills_are_named_by_the_layer's_committed_index_(smart-ips-pilgrimage#66)::a_group_the_mounting_root_switched_ON_that_is_missing_is_not_excused_by_the_index
  Scenario: A switched-on group that is missing is not excused by the index
    Given a consumer mounting "up" with "up.extra" switched on, "extra/" deleted, and SKILLS.md listing "extra-skill" under "up.extra"
    When the switched-off skill homes are gathered
    Then "extra-skill" is not held
    And "extra-skill" referred to from another layer is not excused

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_left-out_group's_skills_are_named_by_the_layer's_committed_index_(smart-ips-pilgrimage#66)::a_section_whose_rows_disagree_with_its_count_is_not_a_record
  Scenario: An index section whose rows disagree with its count is not a record
    Given an "ops/" section headed with count 2 but holding one row
    When the skill index is parsed
    Then no section is returned
    And a section headed with count 2 holding rows for "a" and "b" parses to dir "ops", those two rows, and opt-in "up.ops"

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_left-out_group's_skills_are_named_by_the_layer's_committed_index_(smart-ips-pilgrimage#66)::readme:sync_keeps_a_left-out_group's_sections_where_the_committed_index_had_them
  Scenario: readme:sync keeps a left-out group's section where the committed index had it
    Given regenerated sections "skills/a", "skills/new", "skills/z"
    And a committed index of "skills/a", opt-in "ops" for "up.ops", and an older "skills/z"
    When the sections are merged, carrying the "up.ops" group
    Then the order is "skills/a", "ops", "skills/new", "skills/z"
    And "skills/z" keeps the regenerated rows

  @test:scripts/tests/kg/optin-mounting-root.test.ts::a_left-out_group's_skills_are_named_by_the_layer's_committed_index_(smart-ips-pilgrimage#66)::a_test_plan's_exit_DMN_in_a_left-out_group_is_not_judged;_one_in_a_switched-on_group_is
  Scenario: A test plan's exit DMN in a left-out group is not judged
    Given a consumer mounting "up" with no group switched on
    Then "ops/decisions/exit.dmn#Decision_Exit" is switched off
    And "skills/exit.dmn#Decision_Exit" is not
    And with "up.ops" switched on and "ops/" deleted, "ops/decisions/exit.dmn#Decision_Exit" is not switched off
