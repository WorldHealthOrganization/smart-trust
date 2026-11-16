Feature: the structured-assets page of a document

  @test:scripts/structured-assets.test.ts::the_structured-assets_page::oneTablePerKind
  Scenario: one table per kind, in the order the kinds first appear, with counts
    When the page is rendered
    Then the kinds' tables are in first-appearance order with their titles and counts

  @test:scripts/structured-assets.test.ts::the_structured-assets_page::rowsLinkCards
  Scenario: every row links to its card in the document
    When the page is rendered
    Then each row links to its card in the document

  @test:scripts/structured-assets.test.ts::the_structured-assets_page::scenarioPersonasLinked
  Scenario: a scenario's personas are named by title and linked
    When the page is rendered
    Then a scenario's persona is named by title and linked

  @test:scripts/structured-assets.test.ts::the_structured-assets_page::metaFieldsColumns
  Scenario: meta fields become columns; where a block came from does not
    When the page is rendered and field headings are made
    Then meta fields are columns with readable headings

  @test:scripts/structured-assets.test.ts::kind_labels_link_to_the_assets_page::listedKindLinks
  Scenario: a listed kind links to its table
    When a listed kind's label is linked
    Then it links to its table

  @test:scripts/structured-assets.test.ts::kind_labels_link_to_the_assets_page::unlistedKindPlain
  Scenario: a kind the page does not list stays plain
    When an unlisted kind's label is linked
    Then it stays plain

  @test:scripts/structured-assets.test.ts::data_element_cards_stay_light::tableFoldsBehindDetails
  Scenario: the table folds behind Technical details
    When a data element card is lightened
    Then its table folds behind Technical details

  @test:scripts/structured-assets.test.ts::data_element_cards_stay_light::nameLinksGlossary
  Scenario: the name links to a glossary entry with that label, or that label before a colon
    When a data element whose label is in the glossary is lightened
    Then its name links to the glossary entry with its definition

  @test:scripts/structured-assets.test.ts::data_element_cards_stay_light::noEntryNoLink
  Scenario: no entry, no link; other kinds untouched
    When a data element with no glossary entry and a persona card are lightened
    Then the name is not linked and the persona is unchanged

  @test:scripts/structured-assets.test.ts::cellValue::enumValuesAreTags
  Scenario: every enum-like value of a list is a tag
    When cell values are rendered
    Then each enum-like value in a list, or alone, is a tag
    And free text and empty values stay as they are

  @test:scripts/structured-assets.test.ts::indicators::indicatorColumns
  Scenario: the table shows the chosen indicator columns in order, not every field
    When indicators are rendered
    Then the table shows the chosen columns in order, with disaggregation as tags and no long text
