# Two settings panels, two names, each pointing to the other: the source half
# over the shipped docs-ui.js. Each Scenario names the test that executes it.
Feature: Distinct settings panel labels

  @test:scripts/tests/settings-labels-distinct.test.ts::ob3m_finding_12_—_two_settings_panels,_two_names,_each_points_to_the_other::the_names_are_declared_once,_and_differ
  Scenario: The two panel names are declared and differ
    Given the SETTINGS_NAMES declaration in docs-ui.js
    Then the page name is "Page settings" and the glass name is "Glass settings"
    And they differ and neither is the bare "Settings"

  @test:scripts/tests/settings-labels-distinct.test.ts::ob3m_finding_12_—_two_settings_panels,_two_names,_each_points_to_the_other::both_panels_take_their_label_from_the_declaration,_not_a_literal
  Scenario: Both panels take their label from the declaration
    Then the gear tile button uses SETTINGS_NAMES.page and the glass chrome tile uses SETTINGS_NAMES.glass
    And neither is given a string literal as its caption

  @test:scripts/tests/settings-labels-distinct.test.ts::ob3m_finding_12_—_two_settings_panels,_two_names,_each_points_to_the_other::the_glass_panel's_HEADING_leads_with_its_name_—_the_title_is_the_heading
  Scenario: The glass panel's title starts with its name
    Then the glass chrome tile's title is SETTINGS_NAMES.glass followed by more text

  @test:scripts/tests/settings-labels-distinct.test.ts::ob3m_finding_12_—_two_settings_panels,_two_names,_each_points_to_the_other::Page_settings_draws_a_link_to_Glass_settings,_and_Glass_settings_one_to_Page_settings
  Scenario: Each panel's builder links to the other
    Then buildViews calls settingsCrossLink("glass")
    And buildSettings calls settingsCrossLink("page")

  @test:scripts/tests/settings-labels-distinct.test.ts::ob3m_finding_12_—_two_settings_panels,_two_names,_each_points_to_the_other::both_openers_are_registered,_so_neither_link_is_drawn_pointing_at_nothing
  Scenario: Both panel openers are registered
    Then settingsOpeners.page and settingsOpeners.glass are each assigned a function

  @test:scripts/tests/settings-labels-distinct.test.ts::ob3m_finding_12_—_two_settings_panels,_two_names,_each_points_to_the_other::the_glass_id_is_untouched_—_it_is_the_contract_the_tests_and_STRIP_DEFAULT_key_on
  Scenario: The glass-settings id is unchanged
    Then docs-ui.js still creates the chrome tile "glass-settings"
