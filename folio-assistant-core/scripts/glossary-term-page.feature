Feature: a page for each glossary term

  @test:scripts/glossary-term-page.test.ts::term_pages::onePagePerTerm
  Scenario: one page per term, under its layer's page
    When the term pages are made
    Then there is one per term under its layer, with its permalink, out of the navigation

  @test:scripts/glossary-term-page.test.ts::term_pages::definingSiteIsRow
  Scenario: the defining site is the glossary row, in the document and on the glossary page
    When the term's page is read
    Then it says where it is defined, linking the document's glossary table and the glossary entry

  @test:scripts/glossary-term-page.test.ts::term_pages::broaderNarrowerRelatedLink
  Scenario: broader, the computed narrower, and related terms link to their pages
    When the term pages are read
    Then broader, related and computed narrower terms link to their pages

  @test:scripts/glossary-term-page.test.ts::term_pages::passagesAsProvenance
  Scenario: the narrative passages are provenance: explained first, then used, in the page and its JSON-LD
    When the term's page is read
    Then explained passages come before used ones
    And its JSON-LD names them as derivation and references, with the term's IRI

  @test:scripts/glossary-term-page.test.ts::term_pages::noPassageSaysSo
  Scenario: a term no passage names says so
    When the page of a term no passage names is read
    Then it says no passage names it

  @test:scripts/glossary-term-page.test.ts::term_pages::glossaryRowLinksTermPage
  Scenario: the glossary row links to the term page
    When the layer's glossary page is read
    Then the term's row links its term page
