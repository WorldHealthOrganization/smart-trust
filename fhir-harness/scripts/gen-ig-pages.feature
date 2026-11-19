Feature: Generating an IG's artefact index pages

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages:_the_banner's_identity_is_the_index's::ownIdentityKeepsWatermark
  Scenario: an IG with its own identity file keeps its status watermark
    Given an IG instance with its own identity file
    Then its banner links its package id and carries the active status class

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages:_the_banner's_identity_is_the_index's::noIdentityNoBorrowedStatus
  Scenario: an IG with none names itself and asserts no status borrowed from another IG
    Given an IG instance with no identity file
    Then its banner names its own package id and canonical
    And it names no other IG's package and carries no status class

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--summary:_the_landing_page::summaryOpensWithHarnessSection
  Scenario: with --summary the index opens with the instance's own harness section, then the artefact index
    Given the index generated with --summary
    Then it is titled "International Patient Access"
    And it includes the instance's harness details before the "Artefact index" heading

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--summary:_the_landing_page::noSummaryArtefactIndexTitle
  Scenario: generated without --summary: no include, artefact-index title
    Given the index generated without --summary
    Then it has no harness details include
    And it is titled "International Patient Summary — artefact index"

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages:_the_publish_note_and_the_sidecar_label_are_the_caller's::callerNoteAndLabelCarried
  Scenario: a caller's note and label are what the pages carry
    Given an index generated with a publish note and a sidecar label
    Then it carries that publish note and the heading "HL7 sidecars surface"

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages:_the_publish_note_and_the_sidecar_label_are_the_caller's::neutralDefaults
  Scenario: with no --publish-note or --sidecar-label, the pages carry the layer's neutral defaults only
    Given an index generated with no publish note or sidecar label
    Then it carries the neutral publish note and the heading "IG API surface", and does not say "HL7"
    And the artefact page has the heading "IG API" and not the caller's label

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--compiled-data:_an_AST-built_artefact_page_loads_its_resource::compiledDataLoadsResource
  Scenario: with --compiled-data: a pointer, a visible loading state, a no-script link, and the shared loader
    Given pages generated with --compiled-data
    Then the compiled artefact page points at its resource data and the pages list, and names the published base
    And it shows a loading state, a no-script link to the data and loads the resource script
    And the resource script is copied and the pages list names the artefact page
    And an artefact that was not compiled has no data section

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--compiled-data:_an_AST-built_artefact_page_loads_its_resource::noCompiledDataNoLoader
  Scenario: without --compiled-data: no section, no loader — the published-IG pages are unchanged
    Given pages generated without --compiled-data
    Then the artefact page has no data section and no resource script is copied

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages:_an_AST_build's_revision_is_printed_once,_on_the_index_(bean_c65n)::indexCarriesRevision
  Scenario: the index carries the revision and the anchor artefact pages link to
    Given pages generated from an AST build
    Then the index carries the build-revision anchor and the 12-character revision

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages:_an_AST_build's_revision_is_printed_once,_on_the_index_(bean_c65n)::sameRevisionLinksIndex
  Scenario: an artefact built at the index's revision links to it, so a new commit leaves its page byte-identical
    Given an artefact built at the index's revision
    Then its page links to the build revision on the index and does not print it
    And the page is identical for two builds apart from the instance name

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages:_an_AST_build's_revision_is_printed_once,_on_the_index_(bean_c65n)::otherRevisionNamesOwn
  Scenario: an artefact built at a different revision still names its own
    Given an artefact built at a different revision
    Then its page prints its own 12-character revision

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::toolDeclaresSiteFlags
  Scenario: the Tool declares the flags a site build passes: --instance and --site
    Given the "ig-pages" Tool
    Then its instance input passes "--instance" and its site input passes "--site"

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::siteWritesRoutePagesOnly
  Scenario: writes the full view and the instance's sub-graph view at the localised route, and nothing else
    Given the pages generated with --site
    Then the run exits 0
    And the only files are the full view and the instance's sub-graph view

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::siteWritesNothingInInstance
  Scenario: writes nothing into the instance: no docs/
    Given the pages generated with --site
    Then the instance has no docs directory and there is no _site directory

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::siteWithoutIndexGetsIndex
  Scenario: a site without the IG's index gets the index itself, every artefact linked upstream
    Given a site that does not carry the IG's index
    Then the full view is the artefact index page, rendered by ig-pages, titled "Sited IG — artefact index"
    And it links artefacts to the published IG and is not a redirect
    And the sub-graph view is the same page

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::siteWithIndexRedirects
  Scenario: a site that carries the index gets a redirect to it, relative to the route
    Given a site that carries the IG's index
    Then the run exits 0
    And the full view and sub-graph view redirect to the index relative to their routes

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::siteCheckJudgesRoutes
  Scenario: --check with --site judges the route pages under the site
    Then a check with the same label passes
    And a check with another label fails

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::siteAndOutRefused
  Scenario: --site and --out together are refused
    Then running with both --site and --out exits 2

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site:_only_the_declared_route_pages,_under_the_site::noIndexDirStillGetsPage
  Scenario: an IG instance that declares no index directory (#124: built at publish) still gets its sub-graph view
    Given an IG instance that declares no directories but an artefact index visualiser
    When the pages are generated for a site
    Then the run exits 0 and the instance's route page is written

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site-prefix:_the_shared_assets_are_linked_where_the_pages_are_published::assetsUnderInstanceByDefault
  Scenario: by default, under /<instance>/
    Given pages generated for the instance "plain" with no site prefix
    Then a page links the shared stylesheet at /plain/assets/ig-pages.css

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site-prefix:_the_shared_assets_are_linked_where_the_pages_are_published::assetsUnderNamedPrefix
  Scenario: under the prefix the caller names, e.g. an AST site copied to /<instance>/ast/
    Given pages generated for the instance "prefixed" with the site prefix /prefixed/ast
    Then a page links the shared stylesheet at /prefixed/ast/assets/ig-pages.css
    And never at /prefixed/assets/

  @test:scripts/gen-ig-pages.test.ts::gen-ig-pages_--site-prefix:_the_shared_assets_are_linked_where_the_pages_are_published::refusesBadSitePrefix
  Scenario: refuses a prefix that is not one site-absolute path
    When gen-ig-pages runs with each of the prefixes "prefixed/ast", "/prefixed/ast/", "/a/../b" and "/a//b"
    Then it exits 2 for every one
