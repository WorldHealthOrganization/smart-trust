# Specifies the label prefixes contributed through the checkout's real
# contribution registry, and parseReference (schemas/kg/jsonld.ts) with them.
Feature: The real contribution registry supplies label prefixes that references resolve with

  @test:test/coordinator/jsonld-label-resolution-checkout.test.ts::contributed_label_prefixes::the_real_registry_supplies_them
  Scenario: The real registry contributes "dt", and a dt reference is same-paper
    Given the contributions loaded from the checkout
    When the contributed label prefixes are read
    Then they include "dt"
    And "dt:anc-contact" parses with them as the form "same-paper"
