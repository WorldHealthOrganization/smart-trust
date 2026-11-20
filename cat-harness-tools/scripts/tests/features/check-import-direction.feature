# scripts/check-import-direction.ts reads each layer's declared `needs` and reports every import
# that runs against that order, tested here on a scratch checkout with planted violations.
# Each Scenario names the test that executes it.
Feature: Import direction between layers

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction::finds_every_planted_wrong-direction_edge,_and_only_those
  Scenario: Every planted wrong-direction edge is found, and only those
    Given a checkout where "low" and "side" need nothing, "high" needs "low" and "odd" declares no needs
    And imports planted up the arrow, to an undeclared sibling, by package name and as a module-path literal
    When the checkout is analysed
    Then the wrong-direction findings are exactly "low/up.ts" to "high", "low/sibling.ts" to "side", "low/pkg-up.ts" to "high" and "low/src/table.ts" by module-path literal to "high"

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction::a_re-export_of_the_same_specifier_is_one_finding,_not_two
  Scenario: An import and a re-export of the same specifier are one finding
    Given "low/up.ts" both imports and re-exports "../high/y.ts"
    When the checkout is analysed
    Then "low/up.ts" has exactly one finding

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction::down_the_arrow_and_within_an_instance_is_allowed
  Scenario: Imports down the arrow and within a layer are allowed
    Given "high/ok.ts" imports from "low" and from its own layer
    When the checkout is analysed
    Then "high/ok.ts" has no finding

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction::an_undeclared_`needs`_is_UNDETERMINED_—_never_clean,_never_wrong
  Scenario: A layer with no declared needs is undetermined, never clean and never wrong
    Given the layer "odd" declares no needs and imports from "low"
    When the checkout is analysed
    Then the layers with undeclared needs are exactly "odd"
    And the only finding from "odd" has the verdict "undetermined"

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction::a_variable_`import(expr)`_is_reported_as_could-not-determine
  Scenario: A variable dynamic import is reported as could-not-determine
    Given "low/src/table.ts" calls import on a variable
    When the checkout is analysed
    Then the variable specifiers are exactly one in "low/src/table.ts"

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction::comments_and_instance-less_`../`_literals_are_not_imports
  Scenario: Comments and relative literals naming no layer are not imports
    Given "low/quiet.ts" quotes an import in a docblock and a require in a comment, and holds a "../fixtures/x.ts" string
    When the checkout is analysed
    Then "low/quiet.ts" has no finding

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction::the_planted_edges_disappear_when_`low`_declares_what_it_reaches
  Scenario: Declaring a need makes that edge legal without editing the check
    Given "low" is re-declared as needing "side"
    When the checkout is analysed again
    Then "low/sibling.ts" has no finding
    And "low/up.ts" still has a finding

  @test:scripts/tests/check-import-direction.test.ts::check:import-direction_—_the_cat-harness_/_cat-harness-tools_boundary::a_planted_cat-harness_→_cat-harness-tools_import_is_wrong-direction
  Scenario: A cat-harness import of cat-harness-tools is wrong-direction
    Given a scratch tree of bootstrap, bootstrap-tools, cat-harness and cat-harness-tools carrying their real declared needs
    And cat-harness-tools imports cat-harness, and a planted cat-harness file imports cat-harness-tools
    When the tree is analysed
    Then the only wrong-direction finding is "cat-harness/src/planted.ts" to "cat-harness-tools"
