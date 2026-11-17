Feature: Living deck slide 1 lists the five SMART knowledge layers
  The WHO SMART content types page's layers section names all five layers.

  @test:smart-base/scripts/who-smart-content-types.test.ts::living_deck_slide_1:_the_five_SMART_layers::layersSectionListsFiveLayers
  Scenario: the layers section lists all five layers
    Given the page the-three-layers.md of the WHO SMART content types concepts
    Then it contains "**L1** Narrative", "**L2** Operational" and "**L3** Machine readable"
    And it contains "L4 Executable" and "L5 Dynamic"
