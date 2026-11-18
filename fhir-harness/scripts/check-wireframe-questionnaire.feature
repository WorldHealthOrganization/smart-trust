Feature: Checking a Questionnaire against its wireframe

  @test:scripts/check-wireframe-questionnaire.test.ts::the_wireframe's_fields_are_read_in_order,_per_layout::oneLayoutIgnoresCommentsScripts
  Scenario: one layout when no data-layout is given; comments and scripts are ignored
    Given a wireframe with no data-layout, a field inside a comment and one inside a script
    Then it has one layout "(whole document)" with the fields "a" then "b"

  @test:scripts/check-wireframe-questionnaire.test.ts::the_wireframe's_fields_are_read_in_order,_per_layout::webMobileSeparateSharedHeader
  Scenario: separate web and mobile subtrees are separate layouts; a shared header goes to both
    Given a wireframe with a shared header field and separate web and mobile subtrees
    Then the web layout's fields are "h", "a", "b"
    And the mobile layout's fields are "h", "b", "a"

  @test:scripts/check-wireframe-questionnaire.test.ts::Questionnaire_items_name_their_data_element_by_definition_or_code::skipsGroupsReadsDepthFirst
  Scenario: groups and displays are skipped, nested items are read depth first
    Given a Questionnaire with a group holding an item by definition and a display, followed by an item by code
    Then the items are "1" with its definition ids and "2" with "DE7"

  @test:scripts/check-wireframe-questionnaire.test.ts::fidelity_findings::faithfulHasNoFinding
  Scenario: a faithful Questionnaire has no finding
    Given a Questionnaire whose items match the wireframe's fields in order
    Then there are no findings

  @test:scripts/check-wireframe-questionnaire.test.ts::fidelity_findings::reportsMissingItemAndField
  Scenario: a field with no item, and an item with no field
    Given a Questionnaire missing the wireframe's "DE7" and adding an item "3" for "DE9"
    Then a finding says field "DE7" has no Questionnaire item
    And a finding says item "3" (DE9) has no field

  @test:scripts/check-wireframe-questionnaire.test.ts::fidelity_findings::reportsItemWithoutElement
  Scenario: an item that names no data element
    Given a Questionnaire item "x" that names no data element
    Then a finding says item "x" names no data element

  @test:scripts/check-wireframe-questionnaire.test.ts::fidelity_findings::reportsOrderOnceAtDivergence
  Scenario: a different order is reported once, at the first divergence
    Given a Questionnaire with the wireframe's two fields in the other order
    Then there is one finding, saying the order differs where field "DE7" follows "name"

  @test:scripts/check-wireframe-questionnaire.test.ts::fidelity_findings::reportsDuplicateElement
  Scenario: a data element twice in one layout
    Given a wireframe with the field "name" twice
    Then a finding says data element "name" appears twice

  @test:scripts/check-wireframe-questionnaire.test.ts::fidelity_findings::judgesEachLayout
  Scenario: each layout is judged on its own
    Given web and mobile layouts with the fields in different orders
    Then there is one finding, starting "[mobile] order differs"

  @test:scripts/check-wireframe-questionnaire.test.ts::structure_warnings::warnsDuplicateLinkAndDanglingEnableWhen
  Scenario: a linkId used twice, and an enableWhen naming no item
    Given a Questionnaire using linkId "1" twice and an enableWhen on "9"
    Then the warnings say linkId "1" is used by more than one item and item "2" has enableWhen on "9", which is no item's linkId

  @test:scripts/check-wireframe-questionnaire.test.ts::structure_warnings::findsNestedEnableWhenTarget
  Scenario: a nested enableWhen target is found
    Given an enableWhen naming an item nested in a group
    Then there are no structure warnings

  @test:scripts/check-wireframe-questionnaire.test.ts::checkSuggestion:_the_editor-checker_shape::errorsAreSyntaxOnly
  Scenario: errors are syntax only: not JSON, not a Questionnaire
    Then a suggestion "{" has an error starting "not JSON"
    And a suggestion of a Patient has the error "not a Questionnaire (resourceType Patient)"

  @test:scripts/check-wireframe-questionnaire.test.ts::checkSuggestion:_the_editor-checker_shape::reportsOnlyIntroducedWarnings
  Scenario: only what the edit introduces is reported
    Given a Questionnaire with a duplicate linkId
    Then suggesting it unchanged gives no warning
    And suggesting it over a clean original warns that linkId "1" is used by more than one item

  @test:scripts/check-wireframe-questionnaire.test.ts::checkSuggestion:_the_editor-checker_shape::wireframeAddsFidelityWarnings
  Scenario: a wireframe in the context adds fidelity warnings; they never become errors
    Given a wireframe with the fields "name" and "DE7" in the context
    When a Questionnaire with only "name" is suggested
    Then there is no error
    And the warning says the field "DE7" has no Questionnaire item

  @test:scripts/check-wireframe-questionnaire.test.ts::checkSuggestion:_the_editor-checker_shape::unreadableOriginalStillChecks
  Scenario: an unreadable original still checks the suggestion
    Given an empty original
    When a suggestion with a dangling enableWhen is checked
    Then there is one warning
