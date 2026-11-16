# Specifies declaredInstanceNames (scripts/search-split.ts) over the checkout.
Feature: The checkout's declared instances include the ones the site mounts

  @test:test/coordinator/search-split-checkout.test.ts::this_checkout's_declared_instances_include_the_ones_the_site_mounts
  Scenario: smart-trust, smart-base and bootstrap are declared instances
    Given the checkout
    When its declared instance names are read
    Then they include smart-trust, smart-base and bootstrap
