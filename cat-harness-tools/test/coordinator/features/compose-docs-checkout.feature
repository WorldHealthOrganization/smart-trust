# Specifies docsLayers (scripts/compose-docs.ts) over the real checkout.
Feature: compose-docs reads the checkout's docs layers from its declaration

  @test:test/coordinator/compose-docs-checkout.test.ts::compose-docs_reads_its_layers_from_the_declaration::the_REAL_repository_declares_the_site_chrome_as_the_base_and_docs_over_it
  Scenario: The checkout declares site-chrome as the base and docs over it
    Given the checkout root
    When its docs layers are read
    Then no declared layer is missing
    And the layers are "site-chrome" then "docs"
