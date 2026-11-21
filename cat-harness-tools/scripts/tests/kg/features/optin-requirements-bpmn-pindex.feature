# Three gates align with the mounting root's opt-in list: check:requirements skips a switched-off
# proposals directory, translate-bpmn:check skips a template whose diagram is switched off, and
# check:process-index finds its page in any layer. Each Scenario names the test that executes it.
Feature: check:requirements, translate-bpmn:check and check:process-index follow opt-in

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::check:requirements:_the_proposals_directory::switched_off_by_the_mounting_root_(and_left_out):_not_judged
  Scenario: A proposals directory the mounting root switched off is not judged
    Given a consumer mounting "up" whole with no opt-in group switched on
    When check:requirements picks the directory for "proposals"
    Then it is not judged, for a reason naming "up.proposals"
    And "requirements" is judged at "up/requirements/"

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::check:requirements:_the_proposals_directory::switched_on_by_the_mounting_root_and_missing:_still_fails
  Scenario: A proposals directory switched on and missing still fails
    Given a consumer mounting "up" with "up.proposals" switched on but no "proposals/" on disk
    When check:requirements picks the directory for "proposals"
    Then it fails with "which does not exist"

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::check:requirements:_the_proposals_directory::a_layer_no_mount_placed_judges_what_is_on_disk,_its_own_list_aside
  Scenario: A layer no mount placed judges its proposals on disk
    Given "up" placed directly with "proposals/" on disk
    When check:requirements picks the directory for "proposals"
    Then it is judged at "up/proposals/"

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::translate-bpmn:check:_a_template_whose_diagram_the_mounting_root_switched_off::left_out_by_the_mount:_not_judged
  Scenario: A template whose diagram group the mount left out is not judged
    Given a consumer mounting "up" with no opt-in group switched on
    When the template "ops-flow" with ".bpmn" is checked against switched-off groups
    Then it is not judged, for groups "up.ops" and "up.proposals"
    And the reason contains "left out"

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::translate-bpmn:check:_a_template_whose_diagram_the_mounting_root_switched_off::switched_off_but_on_disk:_not_judged_when_the_diagram_is_there,_an_orphan_when_it_is_not
  Scenario: A switched-off group on disk excuses only a diagram that is there
    Given a consumer mounting "up" with no group switched on, but "ops/" still on disk
    When the switched-off groups are gathered
    Then the on-disk ones are exactly "up.ops"
    And the template "ops-flow" is not judged, for group "up.ops"
    And the template "renamed-away" is not excused, so it is an orphan

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::translate-bpmn:check:_a_template_whose_diagram_the_mounting_root_switched_off::nothing_switched_off:_a_template_with_no_diagram_is_an_orphan
  Scenario: With nothing switched off, a template with no diagram is an orphan
    Given a consumer mounting "up" with both opt-in groups switched on
    When the template "renamed-away" with ".bpmn" is checked against switched-off groups
    Then it is not excused

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::check:process-index:_where_the_page_is::held_by_a_layer_that_does_not_depend_on_the_base:_found_there
  Scenario: The process-index page is found in a layer other than the base
    Given a checkout with layers "base" and "other", the page held under "other/docs/source"
    When the process-index page is located from the base
    Then it is the page under "other/docs/source"

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::check:process-index:_where_the_page_is::held_by_the_base:_found_there
  Scenario: The process-index page is found in the base layer
    Given a checkout with layers "base" and "other", the page held under "base/docs/source"
    When the process-index page is located from the base
    Then it is the page under "base/docs/source"

  @test:scripts/tests/kg/optin-requirements-bpmn-pindex.test.ts::check:process-index:_where_the_page_is::held_by_no_layer:_the_base_layer's_path_is_named,_as_where_it_was_expected
  Scenario: With no layer holding the page, the base layer's path is named
    Given a checkout with layers "base" and "other" and no process-index page
    When the process-index page is located from the base
    Then it is the expected path under "base/docs/source"
