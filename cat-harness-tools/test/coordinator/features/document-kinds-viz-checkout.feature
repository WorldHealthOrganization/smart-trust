# Specifies readDocumentKinds and pageHtml (scripts/gen-document-kinds-viz.ts)
# over smart-base's committed DAK document kind.
Feature: The committed DAK document kind is drawn with its sections, structure and sources

  @test:test/coordinator/document-kinds-viz-checkout.test.ts::the_committed_DAK_kind,_drawn::smart-base_declares_the_DAK_kind
  Scenario: smart-base declares the DAK kind
    Given the document kinds the checkout declares
    When the kind "dak" of the instance "smart-base" is looked up
    Then it is found

  @test:test/coordinator/document-kinds-viz-checkout.test.ts::the_committed_DAK_kind,_drawn::every_section_title_appears,_and_the_structure_and_sources_are_stated
  Scenario: The DAK page shows every section title, its fixed structure and its sources
    Given smart-base's DAK kind
    When its page HTML is rendered
    Then every section title appears, with "&" escaped
    And it says "<b>fixed</b> structure"
    And every source's ref appears
