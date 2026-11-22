Feature: core's checkout root, in the composed and the standalone layout

  @test:scripts/lib/checkout-root.test.ts::checkoutRootFor::composedLayoutIsTheParent
  Scenario: in the composed layout the checkout root is core's parent
    Given core checked out beside cat-harness under one directory
    When core's checkout root is found
    Then it is that parent directory

  @test:scripts/lib/checkout-root.test.ts::checkoutRootFor::standaloneLayoutIsCoreItself
  Scenario: in the standalone layout the checkout root is core itself
    Given cat-harness checked out inside core
    When core's checkout root is found
    Then it is core itself

  @test:scripts/lib/checkout-root.test.ts::checkoutRootFor::noHarnessAnywhereKeepsTheComposedAnswer
  Scenario: with no harness anywhere, the composed answer stands
    Given core with no cat-harness beside it or inside it
    When core's checkout root is found
    Then it is core's parent directory
