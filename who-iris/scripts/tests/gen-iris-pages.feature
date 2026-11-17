Feature: The pages gen-iris-pages writes
  The docs pages, the catalogue page's inputs, the library's withheld list and
  the two pages of the IRIS replica, its home and search pages, as committed and as the
  generator's helpers produce them.

  @test:scripts/tests/gen-iris-pages.test.ts::the_generator_owns_its_filenames,_and_prunes_only_those::committedHtmlIsExactlyGenerated
  Scenario: every .html committed under docs/ is one the generator would write
    Given every .html file committed in site/ and docs/
    And the wanted set: index.html, the generator's fixed docs pages, and the rendering of each authored docs page
    Then there are more than 3 committed pages
    And no committed page is outside the wanted set
    And no wanted page is missing from the committed pages

  @test:scripts/tests/gen-iris-pages.test.ts::the_generator_owns_its_filenames,_and_prunes_only_those::ownedMatchesEmittedPages
  Scenario: OWNED matches what the generator emits
    Given every .html file committed in site/ and docs/
    Then the OWNED pattern matches each of them

  @test:scripts/tests/gen-iris-pages.test.ts::the_generator_owns_its_filenames,_and_prunes_only_those::ownedSparesForeignFiles
  Scenario: OWNED spares what the generator did NOT write
    Then the OWNED pattern matches none of "hand-authored.html", ".nojekyll", "README.md", "assets" and "index.json"

  @test:scripts/tests/gen-iris-pages.test.ts::ingestion-notes_is_a_projection_of_the_skill,_not_a_copy_of_it::everyRequirementReachesPage
  Scenario: every requirement in the skill reaches the page
    Given the iris-dspace skill and the committed ingestion-notes page
    When the requirements are read from the skill
    Then there are more than 10
    And the page has a table header cell for every requirement id
    And the page states the requirement count in bold

  @test:scripts/tests/gen-iris-pages.test.ts::ingestion-notes_is_a_projection_of_the_skill,_not_a_copy_of_it::refusesEmptyRequirementsTable
  Scenario: refuses rather than rendering an empty table when the source moves
    When requirements are read from a skill with no requirements table
    Then it throws an error saying no rows were found

  @test:scripts/tests/gen-iris-pages.test.ts::ingestion-notes_is_a_projection_of_the_skill,_not_a_copy_of_it::requirementIdsUniqueAndGapless
  Scenario: ids are unique and the numbering has no gaps
    When the requirement ids are read from the iris-dspace skill
    Then no id repeats
    And they are R1, R2, ... in order with no gaps

  @test:scripts/tests/gen-iris-pages.test.ts::the_IRIS_home_replica::recentSubmissionsCappedAtTen
  Scenario: Recent Submissions shows at most 10 items
    Given the replica's home page in site/
    Then it shows at least one and at most 10 recent submissions

  @test:scripts/tests/gen-iris-pages.test.ts::the_IRIS_home_replica::referencedItemsLinkToLibraryNotIris
  Scenario: every Recent Submissions title goes to its library entry page
    Given the replica's home page in site/
    Then each submission title links to a page under the who-iris library
    And none links to IRIS or the Handle resolver

  @test:scripts/tests/gen-iris-pages.test.ts::the_IRIS_home_replica::stripsNestedXmlComments
  Scenario: XML comments are stripped until none is left
    Given SVG text with a comment, and one that a single removal pass would form
    Then no comment survives and comment-free text is unchanged

  @test:scripts/tests/gen-iris-pages.test.ts::the_IRIS_home_replica::homeHasNoEmblemOrPhoto
  Scenario: carries no WHO emblem and no photograph
    Given the replica's home page in site/
    Then it does not contain "who_logo"
    And it does not contain ".jpg"
    And it does not contain "emblem.svg", ignoring case

  @test:scripts/tests/gen-iris-pages.test.ts::the_IRIS_home_replica::emblemMaskedInCoverBytes
  Scenario: the emblem is absent from the BYTES, not merely undisplayed
    Given every masked region declared on a bitstream of a catalogue node
    Then the committed file's SHA-256 equals the declared fixity digest
    And the file is a readable PNG and the region fits within its real width and height
    And when the pymupdf backend is available, every pixel in the region is the single colour 128, 128, 128
    And at least one masked region was checked
    And when the backend is available, every declared region was also pixel-checked

  @test:scripts/tests/gen-iris-pages.test.ts::the_KG-to-portal_page_keeps_its_claims_honest::inlinesArchitectureDrawing
  Scenario: inlines the architecture drawing rather than linking across mount routes
    Given the committed kg-to-portal page
    Then it contains an inline "<svg"
    And it contains "did:web"
    And it does not contain "cat-harness/docs/assets"

  @test:scripts/tests/gen-iris-pages.test.ts::the_KG-to-portal_page_keeps_its_claims_honest::namesWhoDidAsTrustAnchor
  Scenario: names WHO's signing DID via did:web + x5c as the trust anchor, not a GDHCN trust list (#104)
    Given the committed kg-to-portal page
    Then it contains "WHO signing DID — did:web + x5c chain"
    And it contains "publicKeyJwk.x5c"
    And it contains "No GDHCN trust list is assumed."
    And it does not say the trust anchor is to be GDHCN

  @test:scripts/tests/gen-iris-pages.test.ts::the_KG-to-portal_page_keeps_its_claims_honest::claimsNoUnbuiltStage
  Scenario: does not claim a stage this instance has not built
    Given the committed kg-to-portal page
    Then for each of the stages Package, Sign and Verify there is a table row
    And that row contains "not built"

  @test:scripts/tests/gen-iris-pages.test.ts::the_KG-to-portal_page_keeps_its_claims_honest::upstreamFiguresFromCatalogue
  Scenario: states the upstream figures from the catalogue, not from prose
    Given the committed kg-to-portal page and catalogue/catalogue.json
    Then the page contains the catalogue's upstream item total, formatted with en-US thousands separators
    And it contains the catalogue's upstream file total, formatted the same way

  @test:scripts/tests/gen-iris-pages.test.ts::the_KG-to-portal_page_keeps_its_claims_honest::saysReadersNotMeasured
  Scenario: says readers are not measured rather than inventing a count
    Given the committed kg-to-portal page
    Then it contains "not measured"

  @test:scripts/tests/gen-iris-pages.test.ts::a_phone-width_reader_never_pans_sideways_—_bean_`xwrt`::inlineCodeBreaksOnEveryPage
  Scenario: every committed page lets inline code break rather than widen the page
    Given every .html page committed in docs/
    Then there is at least one
    And every one contains the rule ":not(pre) > code { overflow-wrap: anywhere; }"

  @test:scripts/tests/gen-iris-pages.test.ts::every_generated_page_carries_the_Do_not_hand-edit_marker_—_bean_`7te5`::everyPageCarriesGeneratorBanner
  Scenario: every committed page in docs/ carries the generator banner
    Given every .html page committed in docs/
    Then there is at least one
    And every one contains "Do not hand-edit: the next run overwrites it"

  @test:scripts/tests/gen-iris-pages.test.ts::library/_is_the_corpus_only_—_bean_2b5s::libraryHoldsNoPage
  Scenario: holds no page, so no mount copies it
    Then library/ contains no .html file

  @test:scripts/tests/gen-iris-pages.test.ts::library/withheld.json_is_the_catalogue's_gates,_for_the_mount_—_bean_cw35::withholdsExactlyGatedItems
  Scenario: withholds every item whose original's publication gates block, and no other
    Given library/withheld.json and the catalogue nodes that have a library id
    And an item counts as blocked when a materialized ORIGINAL bitstream has a publication gate blocking
    Then at least one item is not blocked
    And every blocked item's library directory is listed in withheld.json
    And no unblocked item's library directory is listed

  @test:scripts/tests/gen-iris-pages.test.ts::library/withheld.json_is_the_catalogue's_gates,_for_the_mount_—_bean_cw35::withheldPathsExist
  Scenario: every withheld path exists under library/ — a stale entry would hide nothing
    Given library/withheld.json
    Then every listed path exists under library/

  @test:scripts/tests/gen-iris-pages.test.ts::the_replica_in_the_six_UN_languages_—_issue_#2228::translationCataloguesComplete
  Scenario: every catalogue is complete, unfuzzy and keeps its placeholders and markup
    Then the site has at least one translatable string
    And the catalogue check reports no problems

  @test:scripts/tests/gen-iris-pages.test.ts::the_page_finds_its_site_root_on_every_host_it_is_served_from::pageCarriesSiteRootPattern
  Scenario: a page carries the pattern
    Given the committed ingestion-notes page
    Then it carries a site-root regular expression

  @test:scripts/tests/gen-iris-pages.test.ts::the_page_finds_its_site_root_on_every_host_it_is_served_from::findsSiteRoot[${path}]
  Scenario Outline: <path> → <root>
    Given the site-root regular expression read out of the committed ingestion-notes page
    When it is matched against the path "<path>"
    Then the captured site root is "<root>"

    Examples:
      | path                                         | root               |
      | /who-iris/item-x.html                        | /                  |
      | /docs/who-iris/ingestion-notes.html          | /                  |
      | /folio-assistant/who-iris/item-x.html        | /folio-assistant/  |
      | /STAGING/branch/who-iris/item-x.html         | /STAGING/branch/   |
      | /who-iris/who-iris/item-x.html               | /who-iris/         |
      | /who-iris/who-iris/fr/item-x.html            | /who-iris/         |
      | /who-iris/docs/who-iris/ingestion-notes.html | /who-iris/         |

  @test:scripts/tests/gen-iris-pages.test.ts::the_docs_landing_page_lists_the_authored_pages_it_does_not_generate_(bean_mw5z)::derivesAuthoredDocsFromDirectory
  Scenario: derives them from the directory: titled by first heading; README and front-matter pages left out
    Given a temporary directory holding README.md, a site-home.md with front matter, style-guide.md headed "The WHO style guide", notes.md with no heading, and index.html
    When the authored docs are derived from it
    Then they are exactly notes.md titled "notes" and style-guide.md titled "The WHO style guide", in that order

  @test:scripts/tests/gen-iris-pages.test.ts::the_docs_landing_page_lists_the_authored_pages_it_does_not_generate_(bean_mw5z)::authoredPagesRenderedAndLinked
  Scenario: every authored page is rendered, and the committed landing page links the rendering (owner's option 1)
    Given the authored pages in docs/ and the committed docs landing page
    Then each authored page's .html rendering exists in docs/
    And the landing page links the .html rendering
    And the landing page does not link the .md source

  @test:scripts/tests/gen-iris-pages.test.ts::the_docs_landing_page_lists_the_authored_pages_it_does_not_generate_(bean_mw5z)::rendersGfmAndRewritesMdLinks
  Scenario: renders GFM tables and points sibling .md links at their renderings, leaving other links alone
    Given Markdown with a GFM table, a link to sibling style-guide.md#x and a link to ../library/README.md
    When it is rendered with style-guide.md as a known sibling and no repository
    Then the output contains a table
    And the sibling link points at "style-guide.html#x"
    And the "../library/README.md" link is unchanged

  @test:scripts/tests/gen-iris-pages.test.ts::the_docs_landing_page_lists_the_authored_pages_it_does_not_generate_(bean_mw5z)::citesOutsideFilesByRepository
  Scenario: cites a file OUTSIDE docs/ by repository, since only docs/ is published (who-iris's own site)
    Given Markdown linking ../library/README.md#a, ../skills/voices/ and ../../AGENTS.md
    When it is rendered for the repository "example/who-iris"
    Then the library link becomes the GitHub blob URL of library/README.md#a at HEAD
    And the voices link becomes the GitHub tree URL of skills/voices/ at HEAD
    And the "../../AGENTS.md" link, which climbs out of the instance, is left as it is

  @test:scripts/tests/gen-iris-pages.test.ts::the_catalogue_page_(bean_kx0p)::listsHeldFirstLabelsGatesNoViewer
  Scenario: lists the held nodes first, labels each gate count inside its pill, and links no viewer on a site without one
    Given every catalogue node
    When the catalogue viewer page is rendered without a library viewer
    Then its node table has one state cell per node
    And the states are ordered materialized, then referenced, then unknown
    And the first state is materialized
    And the gates section shows each count as "<label>: <n> of <m>" inside its pill, with no number after the pill
    And the page has no "library/who-iris/#" link
    And rendering with the default options does contain a "library/who-iris/#" link

  @test:scripts/tests/gen-iris-pages.test.ts::the_replica_keeps_only_its_IRIS-style_home_page_(owner,_2026-10-30)::eachLocaleHasOnlyHomeAndSearchPages
  Scenario: each language has a home page and a search page and nothing else: the item, collection and community pages are gone
    Then the only .html files in site/ are index.html and search.html
    And for every site locale, the only .html files in its directory are index.html and search.html

  @test:scripts/tests/gen-iris-pages.test.ts::the_replica_keeps_only_its_IRIS-style_home_page_(owner,_2026-10-30)::searchPageFacetValuesAreComputedNotWritten
  Scenario: the search page's facet values are computed in the browser, not written into the page
    Given the committed site/search.html
    Then it links Home as index.html and carries the items as JSON data
    And its facet list is empty in the HTML
    And the home page's search form submits to search.html and has no hard-coded filter chips

  @test:scripts/tests/gen-iris-pages.test.ts::the_replica_keeps_only_its_IRIS-style_home_page_(owner,_2026-10-30)::homeLinksHeldItemsToLibrary
  Scenario: each held item links to its library entry page, and no link names a retired page
    Given the catalogue's item nodes whose library directory exists
    Then there is at least one
    And the replica's home page links each to "../en/cat-harness/library/who-iris/<libraryId>/"
    And it has no link to an item-, collection- or community-list page
    And it links "../who-iris/catalogue/"

  @test:scripts/tests/gen-iris-pages.test.ts::the_replica_keeps_only_its_IRIS-style_home_page_(owner,_2026-10-30)::rebasesLinksToOwnSiteRoot
  Scenario: written for the instance's own site root, its links are said from there
    Given HTML with links to ../who-iris/catalogue/, index.html, fr/index.html, ../en/cat-harness/library/who-iris/x/ and an image ../library/x-cover.png
    When it is rebased to the instance's own site root
    Then the links become catalogue/, ./, who-iris/fr/index.html and en/cat-harness/library/who-iris/x/
    And the image source becomes library/x-cover.png

  @test:scripts/tests/gen-iris-pages.test.ts::the_replica_keeps_only_its_IRIS-style_home_page_(owner,_2026-10-30)::rebasesJsonLinks
  Scenario: re-bases the links the page carries as JSON, so the rail's "On this page" list resolves
    Given a visualiser-nav JSON script with hrefs index.html, ../who-iris/catalogue/, ../en/cat-harness/library/who-iris/x/ and https://example.org/
    When it is rebased to the instance's own site root
    Then the hrefs become ./, catalogue/ and en/cat-harness/library/who-iris/x/
    And the https://example.org/ href is unchanged
    And no href starts with "../"

  @test:scripts/tests/gen-iris-pages.test.ts::search_data_is_loaded_when_it_is_needed_(owner,_2026-11-14)::homeSearchRecordsAreAFileNotInline
  Scenario: the home page's search records are a file beside it, not inline
    Given the committed home page of every site locale
    Then it carries no inline search index and names home-search.json
    And home-search.json beside it holds the records, each with a title, an href and a text

  @test:scripts/tests/gen-iris-pages.test.ts::search_data_is_loaded_when_it_is_needed_(owner,_2026-11-14)::homeSearchFetchesOnFirstUseOnly
  Scenario: the home search fetches its records on first use, once
    Given the committed home page's search script run against a stub page
    Then nothing is fetched at load
    When the box is focused twice
    Then home-search.json is fetched once
    When a word of a title is typed
    Then the results panel shows a match without a second fetch

  @test:scripts/tests/gen-iris-pages.test.ts::search_data_is_loaded_when_it_is_needed_(owner,_2026-11-14)::homeSearchPrintsComplete
  Scenario: printing a page whose box holds a query loads the records first
    Given the committed home page's search script run against a stub page
    When the box holds a word of a title and beforeprint fires
    Then home-search.json is fetched and the results panel shows the match
    And a ?q= address loads the records at once

  @test:scripts/tests/gen-iris-pages.test.ts::search_data_is_loaded_when_it_is_needed_(owner,_2026-11-14)::searchRecordsCarryNoLowerCasedCopies
  Scenario: the search page ships each record once, and lower-cases at parse
    Given the committed search page of every site locale
    Then no record carries titleLc, abstractLc, facetLc or text, and each carries ids
    And the page's client makes the lower-cased fields as it parses
