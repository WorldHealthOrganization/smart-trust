# Specifies INSTANCE_ROOT (scripts/tests/helpers.ts) and how the checkout root
# is identified: by its index.config.json, not a declaration.
Feature: INSTANCE_ROOT is the cat-harness platform instance, listed by the checkout's index

  @test:test/coordinator/folio-root-checkout.test.ts::FOLIO_ROOT_detection::INSTANCE_ROOT_is_this_platform_checkout
  Scenario: INSTANCE_ROOT is cat-harness and the checkout's index lists it
    Given INSTANCE_ROOT
    When it and the checkout root above it are read
    Then INSTANCE_ROOT is absolute and ends with "cat-harness"
    And the checkout root has no instance declaration
    And its index.config.json has $schema "folio-index-config/v1"
    And its instances include the name of INSTANCE_ROOT's directory
