Feature: The record of refused XML and Turtle representations

  @test:scripts/p2-refusals.test.ts::P2_refusal_record::refusesXmlTtlCitingRuling
  Scenario: refuses every published XML and Turtle representation, citing the ruling
    Then 3 XML and 2 Turtle representations are refused, 5 in total
    And the refusal reason cites "P2"

  @test:scripts/p2-refusals.test.ts::P2_refusal_record::unpublishedKeptApart
  Scenario: keeps an unpublished representation apart from a refused one
    Then the StructureDefinition missing its Turtle is listed as not published

  @test:scripts/p2-refusals.test.ts::P2_refusal_record::publisherViewPageNames
  Scenario: names the Publisher's view page: .profile for StructureDefinitions, none for the IG
    Then a ValueSet's XML view is "ValueSet-a.xml.html"
    And a StructureDefinition's XML view is its ".profile.xml.html" page
    And an ImplementationGuide has no Turtle view

  @test:scripts/p2-refusals.test.ts::P2_combined_view_across_IGs_(bean_ntyj)::combinedTagsAndSums
  Scenario: tags every refusal with its IG and sums them
    Given the refusals of two IGs combined
    Then the total is 5, each XML refusal names its IG and the subject is the set of both IGs

  @test:scripts/p2-refusals.test.ts::P2_combined_view_across_IGs_(bean_ntyj)::combinedStatesEachIg
  Scenario: states each IG's counts, so an IG that refuses nothing is visible, not absorbed
    Then each IG's XML, Turtle and not-published counts are stated, including the IG that refuses nothing
    And the other IG's unpublished code system is listed with its IG

  @test:scripts/p2-refusals.test.ts::P2_combined_view_across_IGs_(bean_ntyj)::refusesFewerOrTwice
  Scenario: refuses fewer than two IGs, or one IG twice
    Then combining one IG throws "at least two" and the same IG twice throws "twice"
