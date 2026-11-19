# Specifies analyse (scripts/check-import-direction.ts) on a temporary tree
# that copies the real needs of bootstrap, bootstrap-tools, cat-harness and
# cat-harness-tools, with a downward and an upward import planted.
Feature: The import-direction check reads the real needs and allows imports down the arrow

  @test:test/coordinator/check-import-direction-checkout.test.ts::check:import-direction_—_the_cat-harness_/_cat-harness-tools_boundary::the_real_declarations_carry_needs_for_every_instance_involved
  Scenario: The real declarations carry needs for every instance involved
    Given the four instances with the needs their real declarations carry
    And a cat-harness-tools file importing cat-harness and a cat-harness file importing cat-harness-tools
    When the import direction is analysed
    Then no instance has undeclared needs

  @test:test/coordinator/check-import-direction-checkout.test.ts::check:import-direction_—_the_cat-harness_/_cat-harness-tools_boundary::cat-harness-tools_→_cat-harness,_down_the_arrow,_is_allowed
  Scenario: An import from cat-harness-tools into cat-harness is allowed
    Given the same planted tree
    When the import direction is analysed
    Then there is no finding on "cat-harness-tools/src/server.ts"
    And the one finding on "cat-harness/src/planted.ts" is from "cat-harness" to "cat-harness-tools"
    And its verdict is "wrong-direction" when cat-harness's needs are declared, and "undetermined" when they are not
