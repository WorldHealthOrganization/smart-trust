Feature: the bibliography pages and their exports

  @test:scripts/bibliography-page.test.ts::collect::readsBothSourcesInOrder
  Scenario: reads both kinds of source, as one list in citation order
    Given a checkout with a references sub-graph and a catalogue sub-graph
    When the bibliography is collected
    Then nothing is invalid
    And the entries are aaronson2013, garoufalidis2004 and who-handbook in citation order
    And the sub-graphs are one references and one catalogue

  @test:scripts/bibliography-page.test.ts::collect::catalogueRecordBecomesReference
  Scenario: a catalogue record becomes a catalogue reference, linked to its record and its held copy
    When the who-handbook entry is read
    Then its provenance is catalogue, derived from its record and held at its library copy
    And it carries its ISBN

  @test:scripts/bibliography-page.test.ts::collect::refusesMisnamedAndBadNode
  Scenario: refuses a node whose file is not named for its key, and a bad node
    Given a reference file not named for its key and one with a bad id
    When the bibliography is collected
    Then both are reported invalid, the first naming its key

  @test:scripts/bibliography-page.test.ts::pages_and_exports::fiveExportsPerPage
  Scenario: one page with five exports for the whole KG, and for each sub-graph
    When the outputs are listed
    Then the whole KG and each sub-graph have an index and five exports
    And the exports are BibTeX, CSL-JSON, RIS, DC XML and JSON-LD

  @test:scripts/bibliography-page.test.ts::pages_and_exports::perAssetRouteExports
  Scenario: per-asset route (<route>/<sub-graph>/<asset>/) exports a library item and references extracted from it
    Given a library item with references extracted from it
    When the bibliography is collected and written
    Then the asset is listed with its entries
    And its page and its DC XML carry the item and the extracted citation

  @test:scripts/bibliography-page.test.ts::pages_and_exports::catalogueHeldDocumentGetsItsOwnBibliography
  Scenario: a catalogue-held document with an extracted reference list gets its own bibliography
    Given references extracted from a catalogued document's references section
    And another document's reference that cites the catalogued document
    When the bibliography is collected
    Then nothing is invalid and the catalogued document is one asset holding itself and its two extracted references, in order
    And its asset page carries the extracted entries

  @test:scripts/bibliography-page.test.ts::pages_and_exports::extractedReferencesOpenInThePanelNotTheirOwnPage
  Scenario: a reference extracted from a document opens in the side panel, with no page of its own
    Given a reference extracted from a catalogued document's references section
    When the pages are written
    Then the extracted reference has no page of its own
    And its document's page carries its detail inline, for the side panel
    And an authored reference keeps its own page

  @test:scripts/bibliography-page.test.ts::pages_and_exports::everyPageIsOutOfTheSiteSearch
  Scenario: every bibliography page stays out of the site's search index
    When the pages are written
    Then every page's front matter carries search_exclude

  @test:scripts/bibliography-page.test.ts::pages_and_exports::aLongListIsSummarised
  Scenario: a list longer than the limit is summarised, and its exports still hold it
    Given more references in one sub-graph than a page lists
    When the pages are written
    Then the whole page and the sub-graph page summarise them with no list
    And both offer the search box over the route's search index
    And the whole page links the sub-graph
    And the exports still carry every reference
    And without an extracted list a catalogued copy gets no page of its own

  @test:scripts/bibliography-page.test.ts::pages_and_exports::subgraphPageOwnRefsOnly
  Scenario: a sub-graph page holds its sub-graph's references only, and its exports match
    When the catalogue sub-graph's page and BibTeX are read
    Then they carry who-handbook and not garoufalidis2004

  @test:scripts/bibliography-page.test.ts::pages_and_exports::wholePageLinksSubgraphs
  Scenario: the whole-KG page links each sub-graph with its count
    When the whole-KG page is read
    Then it links each sub-graph with its count

  @test:scripts/bibliography-page.test.ts::pages_and_exports::entryPagesNestUnderTheirSubgraphPage
  Scenario: entry pages nest under their sub-graph page and stay out of the sidebar
    When the entry pages are listed
    Then there is one per entry
    And each names its sub-graph page as parent and the Bibliography as grand parent, and is excluded from the nav
    And that sub-graph page exists and sits under the Bibliography page

  @test:scripts/bibliography-page.test.ts::pages_and_exports::entryCarriesOwnExports
  Scenario: each entry carries its own BibTeX, RIS and CSL-JSON export
    When the garoufalidis2004 entry is rendered
    Then it offers BibTeX, RIS and CSL-JSON downloads
    And its BibTeX is an article entry

  @test:scripts/bibliography-page.test.ts::rendering::citationFormat
  Scenario: a citation reads author (year). title. container, volume, pages
    When the garoufalidis2004 citation is rendered
    Then it reads author (year). title. container, volume, pages

  @test:scripts/bibliography-page.test.ts::rendering::untitledShowsPrintedText
  Scenario: an untitled reference shows its printed text
    Given a reference with no title, a year and a note holding markup
    When its citation is rendered
    Then the note is shown escaped as the printed text
    And a printed field, when present, is shown
    And with neither note nor printed text only the year is shown

  @test:scripts/bibliography-page.test.ts::rendering::htmlEscaped
  Scenario: HTML in a field is escaped
    When a title holding a script tag is rendered
    Then it is escaped

  @test:scripts/bibliography-page.test.ts::rendering::segmentsUrlSafe
  Scenario: address segments are URL-safe
    When the address segment of "a:b/c+d.e" is made
    Then it is "a-b-c-d.e"

  @test:scripts/bibliography-page.test.ts::rendering::emptyPageSaysSo
  Scenario: an empty page says so and still offers its exports
    When a page with no entries is rendered
    Then it says "No references here yet." and links the BibTeX export

  @test:scripts/bibliography-page.test.ts::rendering::orderAuthorThenYear
  Scenario: order: first author, then year
    When the first two entries are compared
    Then the first sorts before the second

  @test:scripts/bibliography-page.test.ts::rendering::addReferenceFormControls
  Scenario: includes the ✍ + Add reference standalone node form controls and passes safeHref and escaped-markup checks
    When the add-reference form is rendered
    Then it carries the "✍ + Add reference (standalone node)" control and each of its fields

  @test:scripts/bibliography-page.test.ts::a_site_with_its_own_instance_(declared_at_the_checkout_root)_and_dependencies::rootInstanceIsOwn
  Scenario: the root layer is the site's own; a dependency's clashing sub-graph id gets its layer prefix
    Given a site whose root declares a layer, and a dependency with a clashing sub-graph id
    When the bibliography is collected
    Then nothing is invalid and the own layer is site-x
    And the dependency's sub-graph gets its layer prefix

  @test:scripts/bibliography-page.test.ts::a_site_with_its_own_instance_(declared_at_the_checkout_root)_and_dependencies::ownFirstDepsInClosedSection
  Scenario: the whole page lists the site's own references first and the dependencies in a labelled, closed section
    When the whole page is read
    Then the site's own references come first, then a closed dependencies section with the dependency's references
    And the section is labelled and lists sub-graphs by layer

  @test:scripts/bibliography-page.test.ts::a_site_with_its_own_instance_(declared_at_the_checkout_root)_and_dependencies::layerSubgraphPageOwnOnly
  Scenario: each layer's sub-graph page holds only that layer's references
    When each layer's sub-graph page is read
    Then each holds only its layer's references, the dependency's saying it is a dependency

  @test:scripts/bibliography-page.test.ts::a_site_with_its_own_instance_(declared_at_the_checkout_root)_and_dependencies::noRootInstanceOneList
  Scenario: with no layer at the root, the page stays one list
    When a checkout without a root layer is written
    Then its page has no dependencies section and lists by sub-graph

  @test:scripts/bibliography-page.test.ts::one_page_per_entry,_a_slash_address_and_no_anchor_(owner,_2026-11-08)::noAnchorIds
  Scenario: the whole page links each entry by its slash address, with no anchor ids
    Given two catalogues of different layers holding the same work under the same key
    When the whole-KG page is read
    Then no list item carries an id and no link points at a #ref- anchor
    And each entry links to its own sub-graph's page for that key

  @test:scripts/bibliography-page.test.ts::one_page_per_entry,_a_slash_address_and_no_anchor_(owner,_2026-11-08)::entryPageHoldsDetail
  Scenario: an entry's own page holds its detail
    When one layer's page for that entry is read
    Then it is titled with the work's title and holds its detail section and sources
    And it says no link to the work is recorded and links back to all references of its sub-graph

  @test:scripts/bibliography-page.test.ts::one_page_per_entry,_a_slash_address_and_no_anchor_(owner,_2026-11-08)::subgraphPageLinksBesideIt
  Scenario: a sub-graph page links its entries' pages beside it
    When the other layer's sub-graph page is read
    Then it links the entry by a relative address beside it

  @test:scripts/bibliography-page.test.ts::one_page_per_entry,_a_slash_address_and_no_anchor_(owner,_2026-11-08)::detailListsEverySource
  Scenario: the detail lists every source of a reference, once each
    Given a reference with a URL, a DOI, a pinned copy and a repository source that is the URL with a trailing slash
    When its detail is rendered
    Then it links the URL, the DOI and the pinned copy, labelled pinned
    And the trailing-slash twin of the URL is listed only once

  @test:scripts/bibliography-page.test.ts::one_page_per_entry,_a_slash_address_and_no_anchor_(owner,_2026-11-08)::panelScriptOnEveryList
  Scenario: the whole page carries the panel script
    When the whole-KG page is read
    Then it carries the fa-bib-panel script

  @test:scripts/bibliography-page.test.ts::one_instance's_own_bibliography,_for_its_page_inside_a_composed_site_(bean_djj5)::keepsInstanceAndNeeds
  Scenario: keeps the layer and what it needs, transitively, and makes it own
    When one layer's bibliography is taken
    Then it is its own, with its entries and the sub-graphs of what it needs

  @test:scripts/bibliography-page.test.ts::one_instance's_own_bibliography,_for_its_page_inside_a_composed_site_(bean_djj5)::leavesOutALayerBelowsExtractedReferenceLists
  Scenario: a layer below's extracted reference lists are left out of a layer's own bibliography
    Given extracted reference lists in the layer and in a layer it needs
    When the layer's bibliography is taken
    Then it keeps its own extracted list and leaves out the needed layer's references sub-graph

  @test:scripts/bibliography-page.test.ts::one_instance's_own_bibliography,_for_its_page_inside_a_composed_site_(bean_djj5)::pagesUnderInstance
  Scenario: its pages are served under /<instance>/
    When that bibliography's pages are written under /smart-trust
    Then their permalinks start /smart-trust/en/folio-assistant-core/bibliography/

  @test:scripts/bibliography-page.test.ts::one_instance's_own_bibliography,_for_its_page_inside_a_composed_site_(bean_djj5)::layerSiteTitlesNameTheLayer
  Scenario: a layer's bibliography page titles name the layer
    When that bibliography's pages are written under /smart-trust
    Then the root page is titled "Bibliography (smart-trust)" and its sub-graph page names it as parent
    And no page's parent or grand parent is a root "Bibliography" title
