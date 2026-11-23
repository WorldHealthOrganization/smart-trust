Feature: the recommendation-strength-resolves QA checker

  @test:pipeline/qa-checkers-recommendation.test.ts::the_recommendation-strength-resolves_checker::readsStrengthAsText
  Scenario: reads strength as text, without executing the manifest
    When strength is read from manifest text
    Then a literal strength gives its list, code and line
    And a manifest without strength gives undefined
    And a strength whose list is computed gives null
    And "strength" inside a string or comment is ignored

  @test:pipeline/qa-checkers-recommendation.test.ts::the_recommendation-strength-resolves_checker::passesKnownCodeFailsUnknown
  Scenario: passes a code in core's lists, fails one that is not, and names it
    Given a block with strength code "strong" and one with code "weak" in grade-recommendation-strength
    When the checker runs on each
    Then the "strong" block passes
    And the "weak" block fails with a hit on line 3 that names "weak"

  @test:pipeline/qa-checkers-recommendation.test.ts::the_recommendation-strength-resolves_checker::noStrengthNaComputedWarns
  Scenario: no strength is n/a, and a computed strength is a warning, never a pass
    Given a block with no strength and one with a computed list
    When the checker runs on each
    Then the first is n/a
    And the second is a warning

  @test:pipeline/qa-checkers-recommendation.test.ts::the_recommendation-strength-resolves_checker::folioOwnCodeListResolves
  Scenario: a folio's own code list is seen, so its own grading resolves
    Given a block with strength code "tier-1" in list "house-grading"
    When the checker runs before and after the folio adds code-lists/house-grading.json
    Then it fails before and passes after

  @test:pipeline/qa-checkers-recommendation.test.ts::the_recommendation-strength-resolves_checker::dispatchTableHoldsChecker
  Scenario: the dispatch table the qa-checkers node names holds this checker
    When the recommendation checkers dispatch table is read
    Then its only key is "recommendation-strength-resolves"
