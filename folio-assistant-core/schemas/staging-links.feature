Feature: staging links in this layer's skill contracts

  @test:schemas/staging-links.test.ts::staging_links_in_this_layer's_skill_contracts::outputContractsCarryStagingLinks
  Scenario: every output contract carries stagingLinks
    When every output contract is read
    Then each carries stagingLinks

  @test:schemas/staging-links.test.ts::staging_links_in_this_layer's_skill_contracts::stagingLinksPointInline
  Scenario: every contract carrying stagingLinks points at its own draft-07 inline copy
    When every contract carrying stagingLinks is read
    Then each points at its own draft-07 inline definition

  @test:schemas/staging-links.test.ts::staging_links_in_this_layer's_skill_contracts::inlineCopyIsCanonical
  Scenario: every inline copy is cat-harness's canonical definition
    Given cat-harness's canonical stagingLinks definition is present
    When every inline copy is compared with it
    Then none has drifted
