Feature: Building an IG repository's own site from its AST

  @test:scripts/ig-repo-site.test.ts::topMounts::topMountsNothingNeeds
  Scenario: the listed instances nothing else listed needs
    Given four listed instances where each needs the next
    Then the only top mount is the first

  @test:scripts/ig-repo-site.test.ts::topMounts::independentTopsBoth
  Scenario: two independent tops are both returned
    Then two instances that need nothing are both top mounts

  @test:scripts/ig-repo-site.test.ts::listedInstances::listedInstancesInOrder
  Scenario: the names index.config.json lists, in order; none without one
    Then a directory with no index.config.json lists no instances
    And one listing "b", "a" and an unnamed entry lists "b" then "a"

  @test:scripts/ig-repo-site.test.ts::notSource::notSourceMountsAndProducts
  Scenario: mounts the lock names and the Publisher's products are not the IG's source
    Given a lock mounting "base", "layer/sub" and "."
    Then the mounts' top directories, .git and the Publisher's product directories are not source
    And "input" and "." are source

  @test:scripts/ig-repo-site.test.ts::the_AST_gate_(ig-build-pipeline_rule_2)::validAstGoesOn
  Scenario: a valid AST goes on
    Then a valid AST passes the gate

  @test:scripts/ig-repo-site.test.ts::the_AST_gate_(ig-build-pipeline_rule_2)::staleRefusedNoFallback
  Scenario: a stale, cannot-tell or other verdict is refused, and never falls back to the Publisher
    Then a stale-inputs, cannot-tell or stale-toolchain AST is refused without accepting stale, and the message says it does not fall back

  @test:scripts/ig-repo-site.test.ts::the_AST_gate_(ig-build-pipeline_rule_2)::staleAcceptedPreviewOnly
  Scenario: a stale AST is accepted for a preview only, never for the root
    Then a stale AST is accepted for a preview when stale is accepted
    And for the root it is refused, saying it is for a preview only and naming ig-ast-build.sh

  @test:scripts/ig-repo-site.test.ts::the_AST_gate_(ig-build-pipeline_rule_2)::previewAcceptsStaleByDefault
  Scenario: a preview accepts a stale AST by default; SITE_ACCEPT_STALE_AST=0 refuses it
    Then accepting stale is on when the variable is unset or "1" and off when it is "0"
    And with "0" a preview's stale AST is refused and the message names "=0"

  @test:scripts/ig-repo-site.test.ts::the_AST_gate_(ig-build-pipeline_rule_2)::previewIsStagingBase
  Scenario: a preview is a base path under STAGING/
    Then a base path under STAGING is a preview
    And a root base path or none is not

  @test:scripts/ig-repo-site.test.ts::the_IG_API_sidecars_a_layer_above_leaves_in_the_work_directory::noSidecarsNothingBound
  Scenario: none there, or an empty directory: nothing is bound
    Then no work directory, a missing one or one with an empty sidecars directory binds no IG API

  @test:scripts/ig-repo-site.test.ts::the_IG_API_sidecars_a_layer_above_leaves_in_the_work_directory::sidecarsAndLabelFromDescriptor
  Scenario: the files and the label the descriptor gives; no descriptor, no label
    Given a work directory with one sidecar
    Then the IG API is its sidecars directory with 1 file
    Given a descriptor with the label " My API "
    Then the label is "My API"

  @test:scripts/ig-repo-site.test.ts::the_IG_API_sidecars_a_layer_above_leaves_in_the_work_directory::refusesEmptyLabel
  Scenario: a descriptor whose label is not a non-empty string is refused
    Given a descriptor whose label is empty
    Then reading the IG API throws about the label

  @test:scripts/ig-repo-site.test.ts::publisher_pages:_the_AST's_data,_never_the_Publisher's_HTML::servesAstDataAndIndex
  Scenario: serves each resource once, by the Publisher's name, the index and the sidecars; no ast-data mirror; never replaces a site file
    Given an AST of a ValueSet and a CodeSystem, a site that already has the CodeSystem's JSON, an index and a sidecar
    When the AST data is served
    Then 1 resource is served by the Publisher's name, 1 kept, 1 sidecar and the index
    And no ast-data directory is written, the ValueSet is served by its Publisher name, and the site's CodeSystem file is kept
    And the index and the sidecar are served

  @test:scripts/ig-repo-site.test.ts::publisher_pages:_the_AST's_data,_never_the_Publisher's_HTML::noAstRefusedNamingStep
  Scenario: no AST: refused, naming the step that restores it
    Then publisher pages with no AST throw "no AST" naming the step that restores it

  @test:scripts/ig-repo-site.test.ts::publisher_pages:_the_AST's_data,_never_the_Publisher's_HTML::readsWorkDirIndexAndSidecars
  Scenario: the step reads the index and sidecars compose and the layer above left in the work directory
    Given a work directory holding the index and a sidecar a layer above left
    When publisher pages run
    Then 1 resource, 1 named, 1 sidecar and the index are served
    And the log says the Publisher's HTML is not taken

  @test:scripts/ig-repo-site.test.ts::layerSiteFilesServedNotOver
  Scenario: what the layer above wrote for the site root is served there, never over a path the site holds
    Given a layer above that wrote an OpenAPI page, a JSON file and an index page for the site root, and a site that already has an index page
    When the AST data is served
    Then 2 site files are served and the site's index page is kept
    And the OpenAPI page and JSON file are served and the site's index page is unchanged

  @test:scripts/ig-repo-site.test.ts::placeholderPageReplaced
  Scenario: a page of the IG's own holding the layer's placeholder is replaced by the layer's page; no other is
    Given a layer above with a hub page and another page, and a descriptor naming a placeholder
    And a site whose hub page holds the placeholder and whose other page does not
    When the AST data is served
    Then the hub page is filled with the layer's page and the other page is kept as the IG's own

  @test:scripts/ig-repo-site.test.ts::refusesShortPlaceholder
  Scenario: a placeholder too short to be a marker is refused
    Given a descriptor whose placeholder is "<p>"
    Then reading the IG API throws about the placeholder

  @test:scripts/ig-repo-site.test.ts::the_PlantUML_jar::plantumlJarPrecedence
  Scenario: the one given, else PLANTUML_JAR, else the cached pinned release; none that is not there
    Then a given jar that exists is used
    And a given jar that does not exist falls back to PLANTUML_JAR
    And with nothing given and nothing cached there is none
    And the cached pinned release is used when present

  @test:scripts/ig-repo-site.test.ts::the_guard:_no_published_page_wears_the_IG_Publisher's_chrome_(owner,_2026-10-14)::publisherChromeMarkers
  Scenario: each marker alone is the Publisher's chrome; a site page is not
    Then each Publisher stylesheet or generator marker alone is recognised as the Publisher's chrome
    And a site page with its own stylesheet is not

  @test:scripts/ig-repo-site.test.ts::the_guard:_no_published_page_wears_the_IG_Publisher's_chrome_(owner,_2026-10-14)::namesPagesWithChrome
  Scenario: publisherChromePages names every built page that carries it
    Given a site with its own index page, a page wearing the Publisher's chrome and a stylesheet file
    Then only the page wearing the chrome is named

  @test:scripts/ig-repo-site.test.ts::the_guard:_no_published_page_wears_the_IG_Publisher's_chrome_(owner,_2026-10-14)::refusesSiteWithChrome
  Scenario: the step refuses a site that carries one, whoever put it there
    Given a site holding an artifacts page wearing the Publisher's chrome
    Then publisher pages throw, naming the Publisher's chrome and the page

  @test:scripts/ig-repo-site.test.ts::builtPageByPermalink
  Scenario: builtPage: a source page by Jekyll's default permalink; never a file Jekyll does not publish
    Then Markdown pages build to .html and an HTML page keeps its name
    And an include and an image build to no page

  @test:scripts/ig-repo-site.test.ts::checkoutScriptsDeclared
  Scenario: the checkout scripts the platform asks for are the ones package.json declares
    Then the checkout scripts for ast, compose and publisher-pages run ig-repo-site.ts with those commands

  @test:scripts/ig-repo-site.test.ts::the_site's_folio-build.json::platformIsPinnedToolset
  Scenario: the platform is the toolset index.lock.json pins, else its first pin
    Then with no lock there is no platform commit
    And a lock pinning the toolset gives its ref
    And a lock without the toolset gives its first pin

  @test:scripts/ig-repo-site.test.ts::the_site's_folio-build.json::stampNamesRepoAndCommit
  Scenario: names the repository and its commit from the checkout when the runner says nothing
    Given a checkout with a lock and no runner variables
    Then the stamp names the instance, the platform commit, the repository, branch and head commit, and the build time

  @test:scripts/ig-repo-site.test.ts::the_site's_folio-build.json::publisherPagesWritesStamp
  Scenario: publisher-pages writes it at the root of the composed site, the marker of a folio root
    When publisher pages run for a site
    Then the stamp file is written at the site root and names the platform commit

  @test:scripts/ig-repo-site.test.ts::the_site's_folio-build.json::stampNamesAstSource
  Scenario: names the AST the artefact pages came from, so a stale preview's stamp does not claim the branch for them
    Given a work directory whose validity record says the AST is stale-inputs at revision "91b2b5a"
    When publisher pages run
    Then the stamp's AST is that commit with the verdict "stale-inputs" and the kind "full"
    And the log mentions the verdict and the revision

  @test:scripts/ig-repo-site.test.ts::siteTitledOnce
  Scenario: a page titled as the site is titled once (the IG's home page at the root)
    Given the thin IG layout and the harness layout
    Then a page titled as the site renders the title once
    And another page renders its title followed by the site title

  @test:scripts/ig-repo-site.test.ts::composedPageCarriesFolio
  Scenario: an IG page composed into a host carries the reader's folio (bean 95sk, R24)
    Given the thin IG layout under a host
    Then it carries the folio mount
    And its head links the host's docs-ui script and stylesheet

  @test:scripts/ig-repo-site.test.ts::the_IG's_TOC_on_its_thin_pages_(owner,_2026-11-02:_artifacts.html_had_no_TOC_in_the_rail)::thinPagesGetTocNav
  Scenario: every thin page gets the declaration and its label; other pages keep theirs
    Given a site whose index declares the TOC, four thin pages and another page
    When the TOC is stamped
    Then 4 pages are stamped, each with the declaration and label inside its head
    And the other page is unchanged
    And a second run stamps nothing

  @test:scripts/ig-repo-site.test.ts::the_IG's_TOC_on_its_thin_pages_(owner,_2026-11-02:_artifacts.html_had_no_TOC_in_the_rail)::noTocNothingStamped
  Scenario: no page declares the TOC: nothing to copy, nothing stamped
    Given a site where no page declares the TOC
    Then nothing is stamped

  @test:scripts/ig-repo-site.test.ts::libraryByUrl::cqlByUrlNoElm
  Scenario: a Library in the docs site links its CQL in the KG and carries no ELM
    Given a Library with CQL and ELM content and the IG holding its CQL file
    Then the Library's CQL is a URL to that file and the ELM is left out

  @test:scripts/ig-repo-site.test.ts::libraryByUrl::cqlKeptWithoutSource
  Scenario: CQL whose source the IG does not hold is kept inline
    Given a Library whose CQL file the IG does not hold
    Then its CQL stays inline and only the ELM is left out

  @test:scripts/ig-repo-site.test.ts::libraryByUrl::otherResourcesUntouched
  Scenario: other resources, and a Library already by URL, are served as they are
    Then nothing is changed

  @test:scripts/ig-repo-site.test.ts::libraryByUrl::urlFromRepositoryAndCommit
  Scenario: the CQL URL names the repository and commit the site is built from
    Given SITE_REPOSITORY and SITE_COMMIT
    Then each CQL file is linked at that commit, and with either missing nothing is linked

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::rawBaseFromRecordedCommit
  Scenario: the pages read the AST from raw.githubusercontent.com at the cache commit ast restored
    Given ast recorded a full cache commit and a github.com remote, over https or ssh
    Then the base is that repository's raw URL at that commit

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::noRawBaseWithoutUsableRecord
  Scenario: no recorded commit, a short sha, another host, a broken record or SITE_AST_BY_URL=0 keeps the root copies
    Then no base is given and the resources are copied to the site root as before

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::pagesPointAtRawUrl
  Scenario: an artefact's resource href is its path in the AST tree under the raw base
    Then the AST directory's own name is dropped and the path is appended to the base
    And with "." the href is still the root copy by the Publisher's name

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::restoreRecordsCacheCommit
  Scenario: ig-cache.sh restore --record writes the cache commit it restored and the remote
    Given a remote holding the IG's cache branch
    When the AST is restored with --record
    Then the record names the branch's commit and the remote, and the AST is laid down
    And with that AST already present the commit is recorded again, and with a changed manifest nothing is recorded

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::pagesReadTheSiteWorkRecord
  Scenario: the artefact pages read the commit from the site build's work directory, not compose's scratch one
    Given the record in the site build's work directory and an empty scratch directory
    When the artefact pages are built
    Then they name the raw URL at that commit, as publisher-pages does

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::byUrlServesReducedRootCopy
  Scenario: publisher pages serves each resource at the root, reduced, when the pages read them by URL
    Given a work directory where ast recorded the cache commit
    When publisher pages runs
    Then each resource is at the root as <Type>-<id>.json, minified and without its narrative, the index is still served, and the log names the raw base

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::rootResourcesOffServesNoRootCopy
  Scenario: SITE_ROOT_RESOURCES=0 serves no root copy when the pages read by URL
    Given the switch set to 0
    Then no <Type>-<id>.json is written when the pages read by URL
    And without a cache commit the root copy is still served whole, as the pages' own

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::rootNameFromTheResourceNotTheFile
  Scenario: the root name is read from the resource, not the cache's file name
    Given an AST whose resource file is not named for its id
    Then the root file is named from the resource's resourceType and id

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::caseOnlyCollisionWarned
  Scenario: two root names that differ only by case are warned about
    Given two resources whose ids differ only by case
    Then both are served and the clash is reported

  @test:scripts/ig-repo-site.test.ts::the_AST's_resources_by_raw_URL_at_the_cache_commit_(fhir-harness#325)::reducedLibraryKeepsCqlPointsElmAtFullCopy
  Scenario: a reduced Library keeps its CQL and points its ELM at the full copy
    Given a Library with a narrative, a contained resource, CQL and two ELM attachments
    When it is reduced with the AST cache's URL of its full copy
    Then the narratives are gone, the CQL is kept, and each ELM attachment keeps its entry with that URL instead of its data

  @test:scripts/ig-repo-site.test.ts::redirectStubsLeftBare
  Scenario: a view's redirect stub gets no IG bar and no language block
    Then an immediate meta refresh is a redirect stub, and a delayed refresh or a plain page is not

  @test:scripts/ig-repo-site.test.ts::another_IG_layer's_artefact_index_is_not_copied_into_this_IG's_site_(owner,_2026-11-10)::foreignIndexesAreTheOtherLayersServedIndexes
  Scenario: the other IG layers' served artefact indexes are found by their kind
    Given a base IG layer serving its artefact index and an OpenAPI graph, a layer that does not serve its index, and the checkout's own index
    Then only the base IG layer's served index is another layer's artefact index

  @test:scripts/ig-repo-site.test.ts::another_IG_layer's_artefact_index_is_not_copied_into_this_IG's_site_(owner,_2026-11-10)::dropForeignIndexesRemovesOnlyThoseRoutes
  Scenario: the final step leaves another IG layer's artefact index out of the built site
    Given a built site holding the base IG's served index, another directory of that layer, and the site's own index
    When the final step runs
    Then the base IG's index is removed with its size reported, the rest stays, and a second run removes nothing

  @test:scripts/ig-repo-site.test.ts::the_IG_API_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::cachedIgApiReadByRawUrl
  Scenario: the IG API the AST cache commit holds is bound and read by raw URL
    Given a work directory where ast recorded the cache commit, and an AST whose cache holds an IG API
    Then the site binds that IG API, with its raw URL at the commit

  @test:scripts/ig-repo-site.test.ts::the_IG_API_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::olderCacheFallsBackToTheStepsOutput
  Scenario: an older cache, or by-URL turned off, falls back to the step's own output
    Given a cache commit that holds no IG API
    Then the site binds the IG API the layer above left in the work directory
    And with SITE_AST_BY_URL=0 no raw base is used

  @test:scripts/ig-repo-site.test.ts::the_IG_API_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::byUrlServesNoSidecarAndRebasesSwagger
  Scenario: publisher pages copies no sidecar or document when the IG API is read by URL
    Given the cached IG API with its raw base
    When the AST's data is served
    Then no sidecar and no enumeration document is in the site, and the Swagger page lists each spec at its raw URL

  @test:scripts/ig-repo-site.test.ts::the_IG_API_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::localSwaggerSpecsPointAtTheServedSidecars
  Scenario: the Swagger page's specs point at where the sidecars are served
    Given a Swagger page listing its specs as ../<file> from openapi/
    Then each spec that is a served sidecar is listed at fhir-artifact-index/sidecars/, and any other name is left as it was

  @test:scripts/ig-repo-site.test.ts::the_artefact_index_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::cachedIndexNotServedPointerIs
  Scenario: with a pointer to the cache commit's index, the index is not served and the pointer is
    Given the index the site built and a pointer at the cache commit
    When the AST's data is served
    Then fhir-artifact-index/index.json is not in the site, and index.ref.json names the raw index, its base, the repository and the commit

  @test:scripts/ig-repo-site.test.ts::the_artefact_index_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::olderCacheServesTheIndexAndPointsAtIt
  Scenario: a cache with no index: the site serves its own, and the pointer names it
    Then fhir-artifact-index/index.json is served, and index.ref.json points at index.json beside it

  @test:scripts/ig-repo-site.test.ts::the_artefact_index_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::publisherPagesReadsTheCacheCopy
  Scenario: publisher pages reads the index from the cache commit when the restored AST holds one
    Given a recorded cache commit and a restored AST holding fhir-artifact-index/index.json
    When publisher pages runs
    Then the index is not served, and the log names its raw URL

  @test:scripts/ig-repo-site.test.ts::the_artefact_index_read_from_the_AST_cache_commit_(owner,_2026-11-10,_card_"A")::locateFollowsThePointerElseTheOldPath
  Scenario: a reader locates an IG's index from its site
    Then the pointer's index is followed, resolved against the pointer, and with no pointer the old path is used
