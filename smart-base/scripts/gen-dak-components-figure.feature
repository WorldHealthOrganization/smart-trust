Feature: Living deck slide 3 shows the DAK components
  The ten DAK components of the vocabulary, and the squares figure generated
  from them for the living deck.

  @test:smart-base/scripts/gen-dak-components-figure.test.ts::living_deck_slide_3:_the_DAK_components::tenComponentsSchedulingLogicUnformalized
  Scenario: ten components, scheduling logic marked unformalized in WHO's model
    Given the DAK components vocabulary
    Then it has 10 components, including "test-scenarios"
    And the unformalized components are exactly "scheduling-logic"

  @test:smart-base/scripts/gen-dak-components-figure.test.ts::living_deck_slide_3:_the_DAK_components::squaresFigureOneCardPerComponentCurrent
  Scenario: the squares figure has one card per component and is current
    Given the DAK cards and the rendered components SVG
    Then the cards are exactly the components
    And the SVG has a number badge for each component, 1 to 10
    And the SVG contains "Not yet its own DAK model field"
    And the committed figure file equals the rendered SVG
    And slide-03.md of the deck links the figure through relative_url
