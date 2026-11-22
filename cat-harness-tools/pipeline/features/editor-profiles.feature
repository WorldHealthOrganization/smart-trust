# pipeline/editor-profiles.ts finds the suggest editor's profiles through the instance
# declaration, bundles their code refs under the runtime's roles, and refuses refs that leave their layer.
# Each Scenario names the test that executes it.
Feature: Suggest editor profiles

  @test:pipeline/editor-profiles.test.ts::editor_profiles::found_through_the_declaration,_by_content_type
  Scenario: Profiles are found through the declaration by content type
    Given an instance "sci" declaring an editor-checkers directory with the profiles "paper-math" (paper), "doc" (document), the mode "form" (fhir) and an empty profile
    When profiles are looked up by content type
    Then "paper" finds "paper-math", "document" finds "doc" and "fhir" finds "form"
    And "lean" finds none
    And neither the empty profile nor the node of another schema is found

  @test:pipeline/editor-profiles.test.ts::editor_profiles::the_bundle_re-exports_each_code_ref_under_its_role
  Scenario: The bundle entry re-exports each code ref under its role
    Given an instance "sci" declaring an editor-checkers directory with the profiles "paper-math" (paper), "doc" (document), the mode "form" (fhir) and an empty profile
    When the entry source for "paper-math" is generated
    Then it re-exports "checkIt as check", "tableOf as macros" and "features as featureConfigs"
    And it exports the nodeViews map with "math_inline"

  @test:pipeline/editor-profiles.test.ts::editor_profiles::a_code_ref_outside_its_instance,_or_to_no_file,_is_refused
  Scenario: A code ref outside its instance, to no file, or without an export is refused
    Given the instance "sci"
    When the code ref "../x.ts#y" is resolved, it is refused as outside its instance
    And "suggest/none.ts#y" is refused as not existing
    And "suggest/check.ts" is refused as not a code ref

  @test:pipeline/editor-profiles.test.ts::editor_profiles::bundled_into_one_browser_module_that_runs_on_its_own
  Scenario: A profile bundles into one self-contained browser module
    Given an instance "sci" declaring an editor-checkers directory with the profiles "paper-math" (paper), "doc" (document), the mode "form" (fhir) and an empty profile
    When the "paper" profiles are bundled into the site's suggest assets
    Then the result lists "paper-math" with its module path, rawFirstFor "proof" and its at-ref token rule serialised as regex strings
    And the bundled module has no import statement
    And its check reports an unbalanced brace as an error
    And its macros give the arity 2 for "#1,#2"
    And its nodeViews hold "math_inline" and its featureConfigs map the Math feature
    And bundling "lean" yields no profiles

  @test:pipeline/editor-profiles.test.ts::editor_profiles::a_mode_bundles_its_open_and_issue,_and_names_the_file_types_it_serves
  Scenario: A mode bundles its open and issue and names the file types it serves
    Given an instance "sci" declaring an editor-checkers directory with the profiles "paper-math" (paper), "doc" (document), the mode "form" (fhir) and an empty profile
    When the "fhir" profiles are bundled
    Then the result is the "form" module serving ".json"
    And its open handle returns the text with "!" appended
    And its issue builds a title and body
    And it has no check

  @test:pipeline/editor-profiles.test.ts::editor_profiles::token_rules_are_called_at_build_time,_serialised,_and_refused_when_they_would_do_nothing
  Scenario: Token rules that would do nothing are refused at build time
    # Gap: the serialisation of a valid token rule is checked by the bundling scenario, not here
    Given the "paper-math" profile
    When its token rules are taken with no tokens ref, the result is undefined
    And a rule with a find but no valid is refused
    And a rule with a global valid is refused
    And a tokens ref that is not a function is refused
