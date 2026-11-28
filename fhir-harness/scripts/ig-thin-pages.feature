Feature: Thin artefact pages and their JSON-LD nodes

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld:_one_node_per_artefact,_in_borrowed_vocabularies::compiledNodeShape
  Scenario: a compiled artefact: FHIR RDF class, key, canonical as sameAs, the local copy, and PROV
    Given a compiled profile in the artifact index
    When its JSON-LD node is written
    Then it validates with its schema tag
    And it is typed as the FHIR RDF class, with the FHIR vocabulary, the key as identifier and the canonical as sameAs
    And its id is relative to its own file and its local encoding points at the compiled resource
    And it records the generating activity and the IG package it is part of

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld:_one_node_per_artefact,_in_borrowed_vocabularies::baseMakesIrisAbsolute
  Scenario: with a base: every IRI is absolute under the docs root
    When the node is written with a base
    Then its id and the encoding's content URL are absolute under the docs root

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld:_one_node_per_artefact,_in_borrowed_vocabularies::referencedNodeUpstreamOnly
  Scenario: a referenced artefact names only its upstream files, and no node links its rendering
    Given a referenced profile
    When its node is written
    Then its status is "referenced", every encoding is upstream and it records no generating activity
    And it links no HTML rendering

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld:_one_node_per_artefact,_in_borrowed_vocabularies::refusesTypeKeyMismatch
  Scenario: the schema refuses a node whose type and key disagree
    Given a node whose type is changed to ValueSet
    Then the schema refuses it

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld:_one_node_per_artefact,_in_borrowed_vocabularies::nodeNamesNoOverlay
  Scenario: nothing in the node names a downstream overlay
    Given every node file written for the index
    Then none mentions the overlay's site, base package or document kind

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check:_the_kind's_QA,_beyond_shape::checkPassesOnWritten
  Scenario: passes on what it wrote
    Then the check of the written site has no findings

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check:_the_kind's_QA,_beyond_shape::checkFailsMissingNode
  Scenario: fails on a missing node
    When a node is deleted
    Then the check says the artefact has no node

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check:_the_kind's_QA,_beyond_shape::checkFailsOrphan
  Scenario: fails on an orphan
    When a node is copied to a name no artefact has
    Then the check says it is an orphan

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check:_the_kind's_QA,_beyond_shape::checkFailsCopiedNode
  Scenario: fails on a node copied to another artefact's name
    When one artefact's node is copied over another's
    Then the check says the node names one artefact but the file is the other's

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check:_the_kind's_QA,_beyond_shape::checkFailsJsonTwinServed
  Scenario: fails when a .json twin is served beside a node
    When a node and the index node each get a byte-identical .json copy
    Then the check says a .json twin is served beside each, a second copy no reader fetches

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check:_the_kind's_QA,_beyond_shape::checkFailsResourceMissing
  Scenario: fails when the resource the page will draw is not on the site
    When the compiled resource data is removed from the site
    Then the check says it is not on the site

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check:_the_kind's_QA,_beyond_shape::checkFailsNothingWritten
  Scenario: fails when nothing was written, rather than passing over nothing
    Given an empty site
    Then the check says that is not a pass

  @test:scripts/ig-thin-pages.test.ts::thinArtifactPage:_identity_and_a_pointer,_nothing_of_the_artefact's_content::pageNamesSelfAndNode
  Scenario: names itself by its file, and the node as its alternate
    Given the thin page of a profile
    Then it names its own file as canonical and its node as alternate

  @test:scripts/ig-thin-pages.test.ts::thinArtifactPage:_identity_and_a_pointer,_nothing_of_the_artefact's_content::pageLinksRail
  Scenario: links the rail rather than inlining it
    Then it links the navbar rail and does not inline it

  @test:scripts/ig-thin-pages.test.ts::thinArtifactPage:_identity_and_a_pointer,_nothing_of_the_artefact's_content::pageDeclaresNodeLoadersOrder
  Scenario: the page declares its node, the loaders and the reading order, with no private config block
    Then the page declares its node with no problems, as the profile's IRI typed as a StructureDefinition, and is an artefact page
    And it carries no private thin-page config block
    And it loads kg-render.js before ig-artifact.js
    And it names the AST loader, the previous and next pages and the published base

  @test:scripts/ig-thin-pages.test.ts::thinArtifactPage:_identity_and_a_pointer,_nothing_of_the_artefact's_content::noscriptLinksNodeAndResource
  Scenario: a reader without JavaScript is sent to the node and the resource
    Then a no-script block links the node and the compiled resource

  @test:scripts/ig-thin-pages.test.ts::thinArtifactPage:_identity_and_a_pointer,_nothing_of_the_artefact's_content::pageHoldsNoContent
  Scenario: holds no description, version or canonical: those are the node's
    Then it holds neither the description nor the canonical

  @test:scripts/ig-thin-pages.test.ts::thinArtifactPage:_identity_and_a_pointer,_nothing_of_the_artefact's_content::pageIsSmall
  Scenario: is small
    Then it is under 3000 characters

  @test:scripts/ig-thin-pages.test.ts::the_shared_renderer::rendererParses
  Scenario: parses as a script
    Given the shared renderer script
    Then it parses as a script and reads the page config block by its id

  @test:scripts/ig-thin-pages.test.ts::gen-ig-pages:_thin_by_default,_end_to_end_(owner,_2026-10-12:_"make_thin_default")::thinByDefault
  Scenario: with no flag, writes each artefact page as a thin .html at the full page's address, its node beside it, and the index node
    Given pages generated with no flag
    Then the artifact directory holds each page as thin HTML, the profile's tab views, the nodes, their JSON twins and the index files
    And the renderer, stylesheet, resource loader and page list are copied
    And a page starts with a doctype, is under 3000 characters and its next page is the second artefact
    And the index node is titled "IPS"

  @test:scripts/ig-thin-pages.test.ts::gen-ig-pages:_thin_by_default,_end_to_end_(owner,_2026-10-12:_"make_thin_default")::thinFlagSamePages
  Scenario: --thin, the old opt-in, is still accepted and writes the same pages
    Then pages generated with --thin are the same as with no flag

  @test:scripts/ig-thin-pages.test.ts::gen-ig-pages:_thin_by_default,_end_to_end_(owner,_2026-10-12:_"make_thin_default")::nodesPassCheckWhenServed
  Scenario: its nodes pass the kind's QA once the resource is served
    Given the generated index and its compiled resource served on the site
    Then the check has no findings

  @test:scripts/ig-thin-pages.test.ts::gen-ig-pages:_thin_by_default,_end_to_end_(owner,_2026-10-12:_"make_thin_default")::fullPagesOldPath
  Scenario: --full-pages keeps the old path: full .md pages, no nodes, no renderer
    Given pages generated with --full-pages
    Then every artefact page is Markdown and no renderer is copied

  @test:scripts/ig-thin-pages.test.ts::gen-ig-pages:_thin_by_default,_end_to_end_(owner,_2026-10-12:_"make_thin_default")::thinAndFullRefused
  Scenario: --thin and --full-pages together are refused
    When the generator runs with --thin and --full-pages
    Then it exits 2 and says to pick one

  @test:scripts/ig-thin-pages.test.ts::the_index_node:_every_artefact_once,_each_entry_naming_its_node::indexNodeListsAll
  Scenario: lists every artefact in the Publisher's order, with what a row shows, and validates
    When the index node is written titled "IPS"
    Then it validates with its schema tag and id "index.jsonld"
    And it counts 2 items and lists both nodes in order, the second titled "Patient (IPS)"
    And it links no HTML rendering

  @test:scripts/ig-thin-pages.test.ts::the_index_node:_every_artefact_once,_each_entry_naming_its_node::refusesWrongCount
  Scenario: the schema refuses a count that is not the list's
    Given an index node whose count is 3
    Then the schema refuses it

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check_over_the_index_node_(calibrated:_each_case_breaks_one_thing)::indexCheckPasses
  Scenario: is not an orphan, and passes on what was written
    Then the check of the written site with its index node has no findings

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check_over_the_index_node_(calibrated:_each_case_breaks_one_thing)::indexCheckFailsMissing
  Scenario: fails when the index node is missing
    When the index node is deleted
    Then the check says "index.jsonld: missing"

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check_over_the_index_node_(calibrated:_each_case_breaks_one_thing)::indexCheckFailsOmitted
  Scenario: fails when it omits an artefact
    When the index node drops an artefact and its count
    Then the check says it does not list that artefact

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check_over_the_index_node_(calibrated:_each_case_breaks_one_thing)::indexCheckFailsWrongNode
  Scenario: fails when an entry names another artefact's node
    When an index entry names another artefact's node
    Then the check says the entry names a node that is the other artefact

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check_over_the_index_node_(calibrated:_each_case_breaks_one_thing)::indexCheckFailsAbsentNode
  Scenario: fails when an entry's node is not on the site
    When an index entry names a node that does not exist
    Then the check says it is not on the site

  @test:scripts/ig-thin-pages.test.ts::ig-artifact-jsonld_check_over_the_index_node_(calibrated:_each_case_breaks_one_thing)::indexCheckFailsCount
  Scenario: fails when its count disagrees with its list
    When the index count is set to 5
    Then the check says it says 5 and lists 2

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::nodeProfilesAndSubject
  Scenario: the node names its profiles as dcterms:conformsTo and its code as schema:DefinedTerms, as written
    Given a Basic instance stating two profiles and a code with and without a display
    When its node is written
    Then it validates
    And its profiles are conformsTo and its codes are defined terms, named only where the resource gives a display

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::neitherStatedNeither
  Scenario: an artefact that states neither has neither
    Then a node for an artefact stating no profile or code has neither

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::definitionNotByProfile
  Scenario: a definition (it has a canonical) is described by its description: its profiles are not written
    Given the ImplementationGuide, which states a profile
    Then neither its node nor its index entry carries conformsTo

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::indexEntryRepeatsStated
  Scenario: the index entry repeats them, and every canonical, so a row can link a profile of the same IG
    When the index node is written
    Then it validates
    And the Basic instance's entry repeats its node's conformsTo and subject
    And the profile's entry carries its canonical as sameAs

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::refusesTermWithoutCodeOrName
  Scenario: the schema refuses a term with neither a code nor a name
    Given a node with a defined term that has no code and no name
    Then the schema refuses it

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::statedCheckPasses
  Scenario: check passes on what was written
    Then the check of the written site has no findings

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::checkFailsEntrySubject
  Scenario: check fails when an entry's code is not its node's (a summary, never a second home)
    When an index entry's code differs from its node's
    Then the check says the entry says dcterms:subject

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::checkFailsEntryProfile
  Scenario: check fails when an entry claims a profile its node does not
    When an index entry claims a profile its node does not
    Then the check says it says dcterms:conformsTo

  @test:scripts/ig-thin-pages.test.ts::what_an_instance_states:_its_profiles_and_its_code,_in_the_node_and_the_index_(owner,_2026-10-12)::checkFailsEntryCanonical
  Scenario: check fails when an entry's canonical is not its node's
    When an index entry's canonical differs from its node's
    Then the check says it says schema:sameAs

  @test:scripts/ig-thin-pages.test.ts::thinIndexPage:_the_IG's_artifacts_and_toc_pages_as_thin_shells::indexPagesThinShells
  Scenario: names the index node as the asset, links the rail and the shared renderer
    Given the artifacts and TOC thin pages
    Then each names the index node as alternate, links the rail, the renderer and the stylesheet
    And each has no style or svg element and is under 3000 characters

  @test:scripts/ig-thin-pages.test.ts::thinIndexPage:_the_IG's_artifacts_and_toc_pages_as_thin_shells::indexConfigNamesViewIndex
  Scenario: its config names the view, the index, the pages and the footer
    Then the artifacts page's config names the view, index, pages, footer, next page and root
    And the TOC page's view is "toc"

  @test:scripts/ig-thin-pages.test.ts::thinIndexPage:_the_IG's_artifacts_and_toc_pages_as_thin_shells::listsNoArtefactItself
  Scenario: lists no artefact itself: the list is the node's; the toc keeps the IG's own pages
    Then the artifacts page does not name an artefact
    And the TOC links the IG's home page

  @test:scripts/ig-thin-pages.test.ts::the_shared_renderer_draws_both_page_families::rendererReadsEitherConfig
  Scenario: reads either config block
    Then the renderer reads the index config block by its id

  @test:scripts/ig-thin-pages.test.ts::the_shared_renderer_draws_both_page_families::rendererGuideFirst
  Scenario: draws the IG's own resource first, as This guide, never as Not categorised
    Then the renderer draws the IG's own resource as "This guide"

  @test:scripts/ig-thin-pages.test.ts::the_shared_renderer_draws_both_page_families::rendererFilledColumnsOnly
  Scenario: draws only the columns a table's rows fill, and sub-heads a category that mixes types
    Then the renderer chooses columns from the rows, draws description only when filled, and sub-heads a category by type

  @test:scripts/ig-thin-pages.test.ts::the_shared_renderer_draws_both_page_families::rendererContentsCardBesideGuide
  Scenario: draws a Contents card beside This guide, not the dotted jump line
    Then the renderer has a drawContents function, draws an igi-head block, and has no igi-jump

  @test:scripts/ig-thin-pages.test.ts::the_shared_renderer_draws_both_page_families::rendererHtmlBreaksAreParagraphs
  Scenario: an HTML break in a description is split into paragraphs, not drawn as text
    Then the renderer has a breaks function and splits a description's text on it

  @test:scripts/ig-thin-pages.test.ts::the_shared_renderer_draws_both_page_families::rendererCategoriesOpen
  Scenario: draws every category OPEN: no <details> (the owner could not find artefacts behind collapsed ones)
    Then the renderer creates no details element

  @test:scripts/ig-thin-pages.test.ts::the_IG_site,_thin_by_default:_stageIgSite,_composeIgSite_and_artifactsFor::stageWritesThinIndexPages
  Scenario: writes artifacts.html and toc.html as thin pages, and neither as Liquid
    Given an IG staged as a site
    Then artifacts.html and toc.html are generated and no Markdown versions are written
    And the artifacts page is a thin page rendered by ig-pages with the artifacts view on the index node
    And the TOC page lists the IG's own pages in sushi-config's order and has the toc view

  @test:scripts/ig-thin-pages.test.ts::the_IG_site,_thin_by_default:_stageIgSite,_composeIgSite_and_artifactsFor::composedPagesThinLayout
  Scenario: composed into a host, the IG's pages wear the thin layout: chrome linked, nothing of the host's inlined
    When the staged site is composed at the root of a host
    Then there are no collisions
    And an IG page uses the thin layout, not the default, and includes the bottom chrome
    And the thin layout links the rail, the shared layout before the IG stylesheet, and no top bar stylesheet
    And it declares the navigation, has no style or svg, and places the top bar above the full-width main column
    And the top include has no top bar or style, and the bottom include loads the source links script
    And the shared layout files and the source links script are copied, and no top bar stylesheet
    And the thin artifacts page is copied as it is

  @test:scripts/ig-thin-pages.test.ts::the_IG_site,_thin_by_default:_stageIgSite,_composeIgSite_and_artifactsFor::fullPagesKeepHostLayout
  Scenario: --full-pages keeps the host's layout
    When the staged site is composed with full pages
    Then there are no collisions, the page uses the default layout and no layouts are written

  @test:scripts/ig-thin-pages.test.ts::the_IG_site,_thin_by_default:_stageIgSite,_composeIgSite_and_artifactsFor::artifactsForNamesIndexNode
  Scenario: artifactsFor names the index node, and refuses when the artefact pages were built with --full-pages
    Given an instance with an artifact index and an artifact docs directory with no index node
    Then asking for the artefacts throws, naming --full-pages
    And with full pages it names no index node
    When the index node is written
    Then the artefacts name "artifact/index.jsonld"

  @test:scripts/ig-thin-pages.test.ts::the_resource_files_at_the_site_root,_named_by_the_JSON-LD_graph_(fhir-harness#359)::rootCopyFirstMirrorSecond
  Scenario: a node lists the site's root copy first and the AST cache's full copy as its mirror
    Given an artefact the AST holds, on a site that serves its resources at the root
    When its node is written with the AST cache's raw base
    Then its encodings are the root <Type>-<id>.json (local), the raw URL (mirror), then the upstream file
    And a referenced artefact names no root file, and a root copy that is the compiled copy is listed once

  @test:scripts/ig-thin-pages.test.ts::the_resource_files_at_the_site_root,_named_by_the_JSON-LD_graph_(fhir-harness#359)::indexEntryNamesRootFile
  Scenario: the index node names each root file on its entry
    When the index node is written for a site that serves its resources at the root
    Then the entry of an artefact the AST holds has the root file as its schema:contentUrl, and a referenced one has none

  @test:scripts/ig-thin-pages.test.ts::the_resource_files_at_the_site_root,_named_by_the_JSON-LD_graph_(fhir-harness#359)::everyLocalEncodingIsOnTheBuiltSite
  Scenario: every local encoding a node names is a file of the built site
    Given a site whose root resources publisher pages served from an AST, and the nodes written beside its pages
    Then every node's local encoding resolves to a file on the site, and check finds nothing
    And the root copy is minified and carries no narrative

  @test:scripts/ig-thin-pages.test.ts::the_resource_files_at_the_site_root,_named_by_the_JSON-LD_graph_(fhir-harness#359)::checkFailsRootFileMissing
  Scenario: check names a root file the graph points at and the site lacks
    Given that site with one root file removed
    Then check reports the node's resource and the index entry's file as not on the site
