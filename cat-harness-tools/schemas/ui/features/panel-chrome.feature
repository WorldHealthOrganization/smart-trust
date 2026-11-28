# Specifies schemas/ui/panel-chrome.ts: the panel controls table, the fixed
# chrome the platform puts on every panel, the controls each kind declares,
# the findings for a bad declaration, and the split of declared controls into
# shown and hidden by the capabilities a deployment serves (pb04).
Feature: A kind declares its panel controls, and the platform fixes the chrome

  @test:schemas/ui/panel-chrome.test.ts::the_frame_is_the_platform's::`close`_is_on_every_panel,_whatever_the_kind_declares
  Scenario: Close is on every panel
    Given every kind in the kind-controls table and a kind nobody declared
    When the controls for each are asked for
    Then each list contains "close"

  @test:schemas/ui/panel-chrome.test.ts::the_frame_is_the_platform's::and_it_is_FIRST,_because_a_control_that_moves_is_not_a_fixed_control
  Scenario: Close is the first control
    Given every kind in the kind-controls table
    When the controls for each are asked for
    Then the first control of each is "close"

  @test:schemas/ui/panel-chrome.test.ts::the_frame_is_the_platform's::a_kind_cannot_remove_it_by_declaring_an_empty_set
  Scenario: A kind declaring no controls still gets close
    Given a table in which kind "x" declares an empty list
    When the controls for "x" are asked for
    Then they are "close" alone

  @test:schemas/ui/panel-chrome.test.ts::the_frame_is_the_platform's::a_kind_cannot_duplicate_it_by_declaring_it
  Scenario: A kind declaring close does not get it twice
    Given a table in which kind "x" declares "close" and "view"
    When the controls for "x" are asked for
    Then they are "close", "view"

  @test:schemas/ui/panel-chrome.test.ts::a_kind_absent_from_the_table_is_COMPLETE,_not_invalid::it_gets_the_frame_and_nothing_else
  Scenario: A kind absent from the table gets the frame alone
    When the controls for "never-heard-of-it" are asked for
    Then they are "close" alone
    And validating an empty table gives no findings

  @test:schemas/ui/panel-chrome.test.ts::a_typo_is_a_FINDING,_which_is_the_whole_value_of_declaring_the_set::a_control_that_does_not_exist_is_reported,_and_names_what_does
  Scenario: An unknown control is a finding that names the known controls
    Given a table in which "todo" declares "edti"
    When the table is validated
    Then there is one finding, for control "edti"
    And it says "no control called" and names every known panel control

  @test:schemas/ui/panel-chrome.test.ts::a_typo_is_a_FINDING,_which_is_the_whole_value_of_declaring_the_set::re-declaring_a_fixed_control_is_a_DIFFERENT_finding
  Scenario: Declaring a fixed control is its own finding
    Given a table in which "todo" declares "close"
    When the table is validated
    Then there is one finding, saying "the frame the platform fixes"

  @test:schemas/ui/panel-chrome.test.ts::a_typo_is_a_FINDING,_which_is_the_whole_value_of_declaring_the_set::a_bad_entry_does_not_take_the_panel_down
  Scenario: An unknown control is skipped and the rest are kept
    Given a table in which "x" declares "view", "edti", "edit"
    When the controls for "x" are asked for
    Then they are "close", "view", "edit"

  @test:schemas/ui/panel-chrome.test.ts::a_typo_is_a_FINDING,_which_is_the_whole_value_of_declaring_the_set::this_repository's_own_declarations_are_clean
  Scenario: This repository's own control table is clean
    When the default kind-controls table is validated
    Then there are no findings

  @test:schemas/ui/panel-chrome.test.ts::declared_and_unservable_is_a_THIRD_state,_not_a_second::with_no_source_at_all,_only_the_capability-free_controls_show
  Scenario: With no capabilities only the capability-free controls show
    Given the controls declared for "todo"
    When they are split by servability with no capabilities
    Then "close", "move", "pin", "discard", "relocate" are shown
    And "view", "edit" are hidden

  @test:schemas/ui/panel-chrome.test.ts::declared_and_unservable_is_a_THIRD_state,_not_a_second::a_readable_source_shows_View_and_still_hides_Edit
  Scenario: A readable source shows View and still hides Edit
    Given the controls declared for "todo"
    When they are split with "source-read" only
    Then "view" is shown
    And "edit" alone is hidden

  @test:schemas/ui/panel-chrome.test.ts::declared_and_unservable_is_a_THIRD_state,_not_a_second::both_capabilities_show_everything_the_kind_declared
  Scenario: Both capabilities show every declared control
    Given the controls declared for "todo"
    When they are split with "source-read" and "source-write"
    Then "close", "view", "edit", "move", "pin", "discard", "relocate" are shown in that order
    And nothing is hidden

  @test:schemas/ui/panel-chrome.test.ts::declared_and_unservable_is_a_THIRD_state,_not_a_second::the_REASON_is_returned,_not_swallowed_—_`pb04`
  Scenario: A hidden control carries the reason it is hidden
    Given the controls declared for "todo"
    When they are split with no capabilities
    Then the hidden "edit" says "source-write" and "pb04"

  @test:schemas/ui/panel-chrome.test.ts::declared_and_unservable_is_a_THIRD_state,_not_a_second::a_kind_that_never_declared_it_produces_NO_finding_—_absence_is_not_a_gap
  Scenario: A control the kind never declared is not reported as hidden
    Given the controls declared for "bean", which declares only "view"
    When they are split with no capabilities
    Then only "view" is hidden, and "edit" is not among the hidden

  @test:schemas/ui/panel-chrome.test.ts::declared_and_unservable_is_a_THIRD_state,_not_a_second::the_frame_survives_every_capability_answer
  Scenario: Close is shown whatever the capabilities
    Given the controls declared for "todo"
    When they are split with no capabilities, with "source-read" only, and with "source-write" only
    Then "close" is shown each time

  @test:schemas/ui/panel-chrome.test.ts::every_control_says_why_it_exists::no_entry_ships_without_a_`because`_or_a_worded_label
  Scenario: Every control carries its id, a worded label and a reason
    When every entry of the panel controls table is read
    Then each carries its own key as its id
    And each has a non-empty label
    And each has a reason longer than 20 characters

  @test:schemas/ui/panel-chrome.test.ts::every_control_says_why_it_exists::every_fixed_control_is_a_real_control
  Scenario: Every fixed control is in the controls table
    When each fixed control id is looked up
    Then the panel controls table has it
