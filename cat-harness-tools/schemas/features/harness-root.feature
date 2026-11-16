# schemas/harness-root.ts resolves the cat-harness root, preferring the cat-harness beside this
# layer over the one a linked node_modules points to (bean g7ls). Each Scenario names the test that executes it.
Feature: Resolving the cat-harness root

  @test:schemas/harness-root.test.ts::harnessRoot::the_sibling_cat-harness_wins_over_a_linked_package_from_another_checkout
  Scenario: The sibling cat-harness wins over a linked package from another checkout
    Given a rehearsal workspace with a sibling cat-harness declaration
    And a node_modules linked in from another index checkout whose package is its own cat-harness
    When harnessRoot() is run from the rehearsal's cat-harness-tools without CAT_HARNESS_ROOT
    Then it exits 0
    And it prints the rehearsal's sibling "<ws>/rehearsal/cat-harness"

  @test:schemas/harness-root.test.ts::harnessRoot::with_no_sibling,_the_linked_package_is_still_found
  Scenario: With no sibling, the linked package's cat-harness is still found
    Given a rehearsal workspace with no sibling cat-harness
    And a node_modules linked in from another index checkout
    When harnessRoot() is run from the rehearsal's cat-harness-tools without CAT_HARNESS_ROOT
    Then it exits 0
    And it prints the linked package's root "<ws>/index/cat-harness"
