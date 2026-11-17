Feature: Searching an IG site

  @test:scripts/ig-search.test.ts::the_box::boxHasLabelledInput
  Scenario: carries #search-input, labelled, and names its index
    Given the search box for "ACME IG"
    Then it has the search input, a label "Search ACME IG" and names its index

  @test:scripts/ig-search.test.ts::the_box::boxIsNotSearchClass
  Scenario: is not `.search`, which docs-ui would move out of the top bar into its band
    Then the box has no "search" class or id

  @test:scripts/ig-search.test.ts::the_box::boxHoldsNoDiv
  Scenario: holds no <div>: a composed page lifts the top bar up to its first </div> at a line end
    Then the box holds no div

  @test:scripts/ig-search.test.ts::the_box::boxFollowedByLocaleSlot
  Scenario: is followed by the language picker's slot, outside the form, empty until docs-ui fills it
    Then the locale slot is an empty span for the language picker
    And the box ends with its form followed by the locale slot

  @test:scripts/ig-search.test.ts::the_top_bar_carries_the_box_and_its_script_only_when_the_site_serves_the_search::barWithSearchCarriesBox
  Scenario: with search: the box and the deferred script, at the site's own paths, inside the bar
    Given the top bar written with the site's search
    Then it names the index and loads the deferred script at the site's paths
    And the box and the locale slot are inside the bar, the slot after the box

  @test:scripts/ig-search.test.ts::the_top_bar_carries_the_box_and_its_script_only_when_the_site_serves_the_search::barWithoutSearchUnchanged
  Scenario: without: unchanged
    Then the top bar written without search does not mention search

  @test:scripts/ig-search.test.ts::the_top_bar_carries_the_box_and_its_script_only_when_the_site_serves_the_search::composedLayoutLiftsBar
  Scenario: a composed page lifts the whole bar, box and script included, into its layout
    Given a staged site whose layout holds the top bar with search
    When it is composed at the root
    Then the thin layout holds the search input, the locale slot and the search script

  @test:scripts/ig-search.test.ts::the_top_bar_carries_the_box_and_its_script_only_when_the_site_serves_the_search::barStylesheetStylesBox
  Scenario: the bar's stylesheet styles the box
    Then the top bar CSS contains the search box CSS

  @test:scripts/ig-search.test.ts::the_thin_pages'_header::artefactPageHeaderHasBox
  Scenario: an artefact page carries the box in its header and loads the script, when the site serves the search
    When a thin artefact page is written with search
    Then its header holds the search input and the locale slot
    And it loads the search script

  @test:scripts/ig-search.test.ts::the_thin_pages'_header::artefactPageNoSearch
  Scenario: and nothing when it does not
    Then a thin artefact page written without search has no search input

  @test:scripts/ig-search.test.ts::the_thin_pages'_header::indexPagesHaveBox
  Scenario: the artifacts and toc pages too
    When the artifacts index page is written with search
    Then its header names the search index and it loads the search script

  @test:scripts/ig-search.test.ts::the_thin_pages'_header::thinStylesheetStylesBox
  Scenario: the thin pages' one stylesheet styles the box
    Then the thin page stylesheet is "assets/ig-artifact.css" and contains the search box CSS

  @test:scripts/ig-search.test.ts::the_thin_pages'_header::oneStylesheetFullWidth
  Scenario: it is the IG's ONE stylesheet: the top bar's rules are in it, and no page is capped to a centred column (owner, 2026-10-15: "full width")
    Given the thin page stylesheet
    Then it holds every rule of the top bar CSS
    And neither caps a page to 60rem or centres it, and the stylesheet sets no body rule

  @test:scripts/ig-search.test.ts::the_thin_pages'_header::thinPagesLinkSharedLayout
  Scenario: every thin page links the shared page layout before the IG's sheet, and wears its classes
    When a thin artefact page is written
    Then it links the shared page layout before the IG stylesheet and wears the layout's header, main and footer classes
    And the TOC index page links the shared layout and wears its main class

  @test:scripts/ig-search.test.ts::the_thin_pages'_header::clientBindsOnce
  Scenario: the client binds a box once, however many times a page loads it
    Then the search script returns early when the form is already bound

  @test:scripts/ig-search.test.ts::the_index::plainTextStripsMarkup
  Scenario: plain text: Liquid, HTML and markdown markup removed
    Then front matter, Liquid, HTML tags, markdown links and bold are removed and entities decoded

  @test:scripts/ig-search.test.ts::the_index::ownPagesIndexed
  Scenario: the IG's own pages: front matter pages outside artifact/, _*/ and assets/, not search-excluded
    Given a site with pages at the root and nested, a search-excluded page, an artefact page, an include, an asset page and a page with no front matter
    When the page entries are collected
    Then only the root and nested pages are indexed, with their titles, hrefs and text

  @test:scripts/ig-search.test.ts::the_index::longPageWholeText
  Scenario: a page's whole text, however long: a word deep in a long page is found
    Given a page of more than 50000 characters ending with "zanzibar"
    Then its indexed text is all of it, ending with "zanzibar"

  @test:scripts/ig-search.test.ts::the_index::artefactsIndexedWithIds
  Scenario: every artefact, linked to its thin page, with its identifiers and a one-line description
    Given a ValueSet with a name, title, canonical and description, and a Patient with only an id
    When the artefact entries are collected
    Then each links its thin page with its type, and its identifiers
    And the ValueSet carries its title and one-line description, and the Patient is titled by its id

  @test:scripts/ig-search.test.ts::the_index::indexFileFormat
  Scenario: the file: its format, hrefs relative to the docs root, pages first
    When the search index is built from one page and one artefact
    Then it has the format, a base of "../" and the page before the artefact

  @test:scripts/ig-search.test.ts::the_index::indexNamesNodeInsteadOfCopy
  Scenario: when the site serves the artefact index node, the file names it and holds only the pages
    When the search index is built from one page and the index node's path
    Then it has the format, a base of "../", the node at "../artifact/index.jsonld" and only the page

  @test:scripts/ig-search.test.ts::the_client_searches_the_index::titleOutranksText
  Scenario: a title match outranks a page's text, and hrefs resolve against the docs root
    When the client searches for "immunization"
    Then the title match comes before the page whose text matches
    And the hit's href resolves against the docs root

  @test:scripts/ig-search.test.ts::the_client_searches_the_index::artefactFoundById
  Scenario: an artefact is found by its id
    Then searching for "acme-patient" finds "ACME Patient"

  @test:scripts/ig-search.test.ts::the_client_searches_the_index::everyTermMustMatch
  Scenario: every term must match
    Then "patient vaccines" finds nothing
    And "codes vaccines" finds "Immunization Codes"

  @test:scripts/ig-search.test.ts::the_client_searches_the_index::emptyQueryFindsNothing
  Scenario: an empty query finds nothing
    Then a blank query finds nothing

  @test:scripts/ig-search.test.ts::the_client_reads_the_artefacts_from_the_index_node::sameEntriesAsTheCopy
  Scenario: the artefacts read from the index node are the entries the search index used to copy
    Given an index of a ValueSet with a name and title, a profile titled by its name, and a Patient with only an id
    When the client makes entries from the index node
    Then they are the copied entries, each linked beside the node, with no name the title already says

  @test:scripts/ig-search.test.ts::the_client_reads_the_artefacts_from_the_index_node::nameOnlyWhenTitleDoesNotSayIt
  Scenario: the index node repeats an artefact's name only when its title is not that name
    Then the ValueSet's row carries its name and the profile's row does not

  @test:scripts/ig-search.test.ts::the_client_reads_the_artefacts_from_the_index_node::foundByNameAndLinkedBesideNode
  Scenario: an artefact is found by its name, and links its thin page beside the node
    Then searching for "acmevs" finds "ACME Codes" at artifact/ValueSet-acme-vs.html

  @test:scripts/ig-search.test.ts::the_client_reads_the_artefacts_from_the_index_node::absoluteNodeIdsStillLinkThisSite
  Scenario: a node with absolute IRIs still links the pages of the site it was read from
    Given an index node written with an absolute base
    Then a hit links the page beside the node the client fetched, not the base

  @test:scripts/ig-search.test.ts::compose_writes_the_search;_publisher-pages_writes_the_language_picker's_block::writeSearchReadsArtefactsFromNode
  Scenario: writeSearch: with the index node in the site, the artefacts are read from it, not copied
    When the search is written for a staged site with one page, one artefact and the index node
    Then 1 page and 1 artefact are counted, the index names "../artifact/index.jsonld" and holds only the page

  @test:scripts/ig-search.test.ts::compose_writes_the_search;_publisher-pages_writes_the_language_picker's_block::writeSearchRefusesExisting
  Scenario: writeSearch: the index and the client under the docs root, refusing a path the host holds
    When the search is written for a staged site with one page and one artefact
    Then 1 page and 1 artefact are indexed, in that order, in the index file with its format
    And the client script is copied as is
    And writing it again throws "already holds"

  @test:scripts/ig-search.test.ts::compose_writes_the_search;_publisher-pages_writes_the_language_picker's_block::stampsTranslationMeta
  Scenario: stampTranslationMeta: every built page that lacks the block gets the platform's, once; a page with its own keeps it
    Given a site with two built pages lacking the translation block, one page with its own block and a data file
    When the translation block is stamped
    Then 2 pages are stamped, each with the language "en" and the six supported locales
    And the page with its own block is unchanged
    And a second run stamps nothing, and the data file is left alone

  @test:scripts/ig-search.test.ts::publisher-pages_gives_every_built_page_the_IG's_one_bar_and_the_shared_layout_(owner,_2026-10-15:_"please_consolidate_behaviours/appearance")::noBarGetsSearchBar
  Scenario: with no IG bar to give, a fallback bar at the top of the body, the layout then the IG's sheet in the head, the client before </body>
    When a built page with no IG bar is given the bar
    Then its body opens with a search header linking home, holding the form and the locale slot
    And its head links the shared layout stylesheet and script, before the IG stylesheet
    And it has no style element, loads the search script at the end of the body and has one search input

  @test:scripts/ig-search.test.ts::publisher-pages_gives_every_built_page_the_IG's_one_bar_and_the_shared_layout_(owner,_2026-10-15:_"please_consolidate_behaviours/appearance")::igBarUsedWhenGiven
  Scenario: the IG's bar, given: its scripts dropped, the client linked once
    When a built page is given the IG's own bar
    Then it carries that bar with its dropdowns
    And the search script is loaded once, at the page's relative path

  @test:scripts/ig-search.test.ts::publisher-pages_gives_every_built_page_the_IG's_one_bar_and_the_shared_layout_(owner,_2026-10-15:_"please_consolidate_behaviours/appearance")::thinPageHeaderReplaced
  Scenario: a thin page's own header is REPLACED by the IG's bar, its client and stylesheets kept, not doubled
    When a thin artefact page is given the IG's bar
    Then its own header is gone and the bar comes before its main content
    And it has one search input, one search script, one shared layout link and one IG stylesheet link

  @test:scripts/ig-search.test.ts::publisher-pages_gives_every_built_page_the_IG's_one_bar_and_the_shared_layout_(owner,_2026-10-15:_"please_consolidate_behaviours/appearance")::alreadyBarredUnchanged
  Scenario: a page that holds the IG's bar, that has a box in a bar of its own, or that has no head and body, is left as it is
    Then a page given the bar twice is the same as once
    And a page with its own search input is unchanged
    And an HTML fragment is unchanged

  @test:scripts/ig-search.test.ts::publisher-pages_gives_every_built_page_the_IG's_one_bar_and_the_shared_layout_(owner,_2026-10-15:_"please_consolidate_behaviours/appearance")::stampIgBarNeedsIndex
  Scenario: stampIgBar: the slim bar, never the menu; paths relative to each page, nothing under assets/, nothing without an index
    Given a site whose index page has the bar, a hub page, an OpenAPI page, a vendor page and a page with its own search box
    Then with no search index nothing is stamped
    When a search index is added and the bar is stamped
    Then 2 pages are stamped
    And the hub page gets the search bar linking home, the search script and the shared layout, without the dropdowns
    And the OpenAPI page loads the script and stylesheet one level up
    And the vendor page is unchanged, and a second run stamps nothing
