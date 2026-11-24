Feature: A resource's JSON view page

  @test:scripts/resource-views.test.ts::JSON_views::jsonViewsWherePublisherWrites
  Scenario: exist for what the Publisher writes one for: not the IG, not StructureDefinitions (their view is .profile.json)
    Then a published ValueSet has a JSON view
    And an ImplementationGuide, a StructureDefinition and an unpublished resource have none

  @test:scripts/resource-views.test.ts::JSON_views::readsFromHeldPackage
  Scenario: reads the resource out of the held package, never a copy
    When the JSON view's data is built
    Then it reads the ValueSet's entry from the held package, links the raw JSON and loads the script one level up

  @test:scripts/resource-views.test.ts::JSON_views::tabsJsonActiveExtrasAfter
  Scenario: tabs: narrative, JSON active, extra tabs after it -- no XML or TTL
    When the JSON view's data is built with an extra tab
    Then its tabs are Narrative Content, JSON active, then the extra tab
    And its heading is "Actors - JSON Representation"

  @test:scripts/resource-views.test.ts::JSON_views::loaderPrettyPrintsPackage
  Scenario: the loader shows the resource as the Publisher's page does
    Given the JSON view loader script
    Then it pretty-prints the resource with an indent of 2 and decompresses gzip

  @test:scripts/resource-views.test.ts::rebaseDescriptionLinks::rebasesRelativeLinks
  Scenario: rebases a relative link onto the IG root and leaves absolute, ../ and anchor links alone
    Then a relative description link is rebased onto the IG root, and absolute, "../" and anchor links are unchanged

  @test:scripts/resource-views.test.ts::rebaseDescriptionLinks::noPagesReducesToText
  Scenario: with no IG pages on the site, reduces a relative link to its text instead of leaving it to dangle
    Then with no IG pages on the site, a relative link is reduced to its text and the others are unchanged
