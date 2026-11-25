Feature: the strength of a recommendation

  @test:schemas/recommendation-strength.test.ts::the_code_lists_core_declares::twoStrengthCodeLists
  Scenario: are the two strength vocabularies, each a valid folio-code-list/v1
    When core's code lists are loaded
    Then they are grade-recommendation-strength and rfc2119-requirement-level
    And the grade list's codes are strong and conditional

  @test:schemas/recommendation-strength.test.ts::strengthFinding::declaredCodeResolves
  Scenario: a code in a declared list resolves
    When strengths conditional and should-not are checked in their lists
    Then there is no finding

  @test:schemas/recommendation-strength.test.ts::strengthFinding::noStrengthNoFinding
  Scenario: no strength is not a finding: the field is optional
    When no strength is checked
    Then there is no finding

  @test:schemas/recommendation-strength.test.ts::strengthFinding::undeclaredListNamed
  Scenario: an undeclared list is named, with the lists that ARE declared
    When a strength in list "grade" is checked
    Then the finding names "grade" and the declared lists

  @test:schemas/recommendation-strength.test.ts::strengthFinding::unknownCodeNamed
  Scenario: a code the list does not hold is named, with the codes it does
    When code "weak" in the grade list is checked
    Then the finding names "weak" and the codes strong and conditional

  @test:schemas/recommendation-strength.test.ts::strengthFinding::retiredCodeRefused
  Scenario: a retired code is refused as a value
    Given the grade list with "weak" retired
    When code "weak" is checked
    Then the finding says it is retired

  @test:schemas/recommendation-strength.test.ts::the_recommendation_builder_carries_strength_and_about::builderCarriesStrengthAndAbout
  Scenario: validates a strength reference and the DAK link, with a folio-chosen label
    When a recommendation is built with a strength reference and an about link
    Then the block is a recommendation carrying strength strong and the about link

  @test:schemas/recommendation-strength.test.ts::the_recommendation_builder_carries_strength_and_about::builderRefusesFreeTextStrength
  Scenario: refuses a strength that is free text rather than a reference
    When a recommendation is built with strength "strong" as text
    Then it throws
