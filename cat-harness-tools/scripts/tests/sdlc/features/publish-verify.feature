# scripts/publish-verify.ts is the pre-deployment verifier set: JSON-LD expansion, unique HTML
# ids, the search index and its scopes, object-property links and own @base, each falsified on
# a tree built to break it. Each Scenario names the test that executes it.
Feature: Pre-deployment site verifiers

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_JSON-LD_verifier::a_clean_document_of_ours_passes
  Scenario: A clean JSON-LD document of ours passes
    Given a site with one document of ours whose context declares every key
    When the JSON-LD expansion verifier runs
    Then it exits 0 having checked 1 document

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_JSON-LD_verifier::FAILS_on_a_key_the_context_does_not_declare_—_the_property_a_processor_silently_drops
  Scenario: A key the context does not declare fails the JSON-LD verifier
    Given a document of ours carrying an undeclared "layer" key
    When the JSON-LD expansion verifier runs
    Then it exits 1
    And the finding reports an invalid property (layer)

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_JSON-LD_verifier::FAILS_on_a_context_it_would_have_to_fetch_from_the_network
  Scenario: A context that would have to be fetched from the network fails
    Given a document whose context names a remote example.org URL
    When the JSON-LD expansion verifier runs
    Then it exits 1

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_JSON-LD_verifier::third-party_documents_are_counted,_never_verified,_never_blocking
  Scenario: Third-party documents are counted, never verified, never blocking
    Given a site with a document of ours and a WHO document with a relative @id
    When the JSON-LD expansion verifier runs
    Then it exits 0 with 1 document out of scope
    And the WHO document is not ours

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_JSON-LD_verifier::nothing_to_verify_is_COULD_NOT_TELL,_not_a_pass
  Scenario: Nothing to verify is could-not-tell, not a pass
    Given an empty site
    When all verifiers run
    Then the exit is 2
    And the first result records could-not-tell

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_unique-id_verifier_—_bean_uknu::a_page_declaring_each_id_once_passes
  Scenario: A page declaring each id once passes the unique-id verifier
    Given a page with one heading id and a link to it
    When the unique-id verifier runs
    Then it exits 0 having checked 1 page

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_unique-id_verifier_—_bean_uknu::FAILS_on_the_defect_that_was_shipped:_the_nav_checkbox_rendered_twice
  Scenario: The nav checkbox rendered twice fails the unique-id verifier
    Given page p/a.html with the fa-nav-open checkbox twice
    When the unique-id verifier runs
    Then it exits 1
    And the only finding is html-unique-ids on "p/a.html": "duplicate id fa-nav-open ×2"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_unique-id_verifier_—_bean_uknu::...and_names_the_page_and_every_id_it_repeats
  Scenario: The unique-id verifier names each repeated id
    # Gap: only the finding's detail is checked, not that it names the page
    Given a page declaring "hl7-fhir" on a heading and an anchor
    When the unique-id verifier runs
    Then the findings are exactly "duplicate id hl7-fhir ×2"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::an_index_covering_every_search-box_page_passes
  Scenario: An index covering every search-box page passes
    Given pages a.html and b/index.html with a search box, and an index covering both
    When the search-index verifier runs
    Then it exits 0

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::MISSING,_EMPTY_and_NOT_JSON_each_fail_—_the_defect_that_would_have_shipped_green
  Scenario: A missing, empty or non-JSON search index each fails
    Given a search-box page and, in turn, no index, an empty index and an index that is not JSON
    When the search-index verifier runs on each
    Then each exits 1 with exactly one finding

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::an_indexed_page_that_is_not_in_the_tree_is_a_finding
  Scenario: An indexed page that is not in the tree is a finding
    Given an index entry for /gone.html, which the tree lacks
    When the search-index verifier runs
    Then it exits 1 with the finding "indexes /gone.html, which is not in the tree"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::an_index_far_below_the_search-box_page_count_is_truncated
  Scenario: An index far below the search-box page count is truncated
    Given four search-box pages and an index of one
    When the search-index verifier runs
    Then it exits 1 with a finding "below the 0.5 floor"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::pages_excluded_from_search_ON_PURPOSE_are_not_counted_against_the_index
  Scenario: Pages excluded from search on purpose are not counted against the index
    Given one indexed search-box page and ten pages carrying the search-exclude marker
    When the search-index verifier runs
    Then it exits 0

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::...and_a_real_truncation_still_fails,_naming_how_many_were_excluded
  Scenario: A real truncation still fails, naming how many were excluded
    Given four search-box pages, an index of one, and three excluded pages
    When the search-index verifier runs
    Then it exits 1 with a finding that "3 more are excluded from search on purpose"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::BORROWED_(a_staging_preview):_a_declared-empty_index_is_presence_and_parsing_only
  Scenario: A borrowed index on a staging preview is checked for presence and parsing only
    Given the search index is declared borrowed
    When the verifier runs on a tree with an empty index
    Then it exits 0
    And on a tree with no index it exits 1

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::a_tree_with_no_search_box_is_COULD_NOT_TELL,_never_a_pass
  Scenario: A tree with no search box is could-not-tell, never a pass
    Given a page with no search box
    When the search-index verifier runs
    Then the exit is 2 and could-not-tell is recorded

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-index_verifier_—_bean_fq5u::it_is_in_the_deploy_set_and_names_the_downstream_Tool_it_judges
  Scenario: The search-index verifier is in the deploy set and names its Tool
    Given the deploy verifier set
    Then it contains the search-index verifier
    And that verifier judges the Tool "site-search-index"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_documents_this_platform_actually_publishes::%s_expands_with_no_warning
  Scenario: Each published document expands with no warning
    Given, per row, the swimlane glossary, the vocabulary or the fsh-guts export built in memory
    When it is expanded with the local loader
    Then there are no findings

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_documents_this_platform_actually_publishes::the_glossary_round-trips:_expand_then_compact_keeps_every_concept
  Scenario: The glossary round-trips through expand and compact keeping every concept
    Given the swimlane glossary built in memory
    When it is expanded and compacted back against its own context
    Then the compacted graph has as many entries as the original

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_documents_this_platform_actually_publishes::the_content_context_resolves_locally,_never_over_the_network
  Scenario: The content context resolves locally, never over the network
    Given a local loader over a temporary directory
    When the content context URL is loaded
    Then the document has an "@context"

  @test:scripts/tests/sdlc/publish-verify.test.ts::a_staging_preview's_own_context_URLs_resolve_to_its_tree::with_no_--base,_a_STAGING/<slug>/_URL_whose_direct_path_is_missing_is_read_without_that_prefix
  Scenario: Without a base, a STAGING slug URL missing at its direct path is read without that prefix
    Given a tree holding the bootstrap-tools context at its root
    When the context is loaded by its STAGING/feature-x URL
    Then a context document is returned
    And a subject document naming that staged context expands with no findings

  @test:scripts/tests/sdlc/publish-verify.test.ts::a_staging_preview's_own_context_URLs_resolve_to_its_tree::with_the_preview's_--base,_the_longest_base_maps_its_URLs_onto_the_tree
  Scenario: With the preview's base, the longest base maps URLs onto the tree
    Given a tree holding the bootstrap-tools context and bases for the published and staged addresses
    When the context is loaded by its staged URL
    Then a context document is returned

  @test:scripts/tests/sdlc/publish-verify.test.ts::a_staging_preview's_own_context_URLs_resolve_to_its_tree::the_whole_verifier_passes_the_staged_subject_document
  Scenario: The whole verifier passes the staged subject document
    Given a tree holding the context and a staged subject document
    When the JSON-LD expansion verifier runs with the published base
    Then there are no findings, 1 document is checked and it exits 0

  @test:scripts/tests/sdlc/publish-verify.test.ts::a_staging_preview's_own_context_URLs_resolve_to_its_tree::a_context_the_tree_does_not_hold_is_still_refused,_staged_or_not
  Scenario: A context the tree does not hold is refused, staged or not
    Given a tree without the requested context
    When a staged context URL for it is loaded
    Then loading fails with "refused to fetch"

  @test:scripts/tests/sdlc/publish-verify.test.ts::a_document_published_at_our_address_is_ours,_whatever_vocabulary_it_speaks_—_bean_7h1c::the_declaration_names_the_base_—_otherwise_every_case_below_is_vacuous
  Scenario: The harness declaration names its published base
    Given the harness instance's declaration
    When its base is read
    Then it is an https URL

  @test:scripts/tests/sdlc/publish-verify.test.ts::a_document_published_at_our_address_is_ours,_whatever_vocabulary_it_speaks_—_bean_7h1c::an_@id_under_a_base_makes_a_SKOS-only_document_ours;_a_lookalike_prefix_does_not
  Scenario: An @id under a base makes a SKOS-only document ours, and a lookalike prefix does not
    Given SKOS-only documents
    When each is checked against the declared base
    Then one with an @id under the base is ours
    And an @id under the base with "-evil" appended is not ours
    And with no bases given, an @id under the base is not ours

  @test:scripts/tests/sdlc/publish-verify.test.ts::a_document_published_at_our_address_is_ours,_whatever_vocabulary_it_speaks_—_bean_7h1c::the_REAL_code-lists_document_is_checked,_not_counted_out_of_scope
  Scenario: The real code-lists document is checked, not counted out of scope
    Given the harness's code-lists document built at its published address
    When the JSON-LD expansion verifier runs without bases
    Then it is counted out of scope
    And when run with the declared base it exits 0, checks 1 document and counts none out of scope

  @test:scripts/tests/sdlc/publish-verify.test.ts::object_properties_are_links_—_ld-object-property-is-a-link::a_link_passes
  Scenario: A PROV association whose agent is a link passes
    Given a PROV-JSONLD association whose agent is an IRI
    When the object-links verifier runs
    Then 1 document is checked with no findings and it exits 0

  @test:scripts/tests/sdlc/publish-verify.test.ts::object_properties_are_links_—_ld-object-property-is-a-link::a_DECLARED_literal_—_no_release_address,_reason_recorded_elsewhere_—_is_counted,_not_a_finding
  Scenario: A declared literal is counted, not a finding
    Given an association whose agent is an explicit "@value" literal
    When the object-links verifier runs
    Then there are no findings
    And the note counts "1 declared literal"
    And it exits 0

  @test:scripts/tests/sdlc/publish-verify.test.ts::object_properties_are_links_—_ld-object-property-is-a-link::FAILS_on_a_compact-IRI_key_that_misses_the_term's_coercion,_and_names_that_as_the_cause
  Scenario: A compact-IRI key that misses the term's coercion fails and names the cause
    Given an association keyed "prov:agent" with a plain string value
    When the object-links verifier runs
    Then it exits 1 with one finding
    And the finding names "http://www.w3.org/ns/prov#agent" and "ld-coercion-belongs-to-the-term"

  @test:scripts/tests/sdlc/publish-verify.test.ts::object_properties_are_links_—_ld-object-property-is-a-link::the_object_properties_come_from_the_held_context,_not_a_list_here_—_PROV's_agent_is_one
  Scenario: Object properties come from the held context, so a data property's literal is not flagged
    Given an association with an IRI agent and a startTime string on the activity
    When the object-links verifier runs
    Then there are no findings

  @test:scripts/tests/sdlc/publish-verify.test.ts::object_properties_are_links_—_ld-object-property-is-a-link::the_real_PROV-O_reports_carry_no_undeclared_literal_under_an_object_property
  Scenario: The real PROV-O reports carry no undeclared literal under an object property
    Given the harness site's assets/prov directory
    When the object-links verifier runs on it
    Then more than 0 documents are checked
    And there are no findings

  @test:scripts/tests/sdlc/publish-verify.test.ts::no_document_leans_on_a_remote_@base_—_ld-no-base-in-a-remote-context::the_content_context_carries_@base_—_otherwise_every_case_below_is_vacuous
  Scenario: The content context carries its own @base
    Given the held content context
    When it is loaded locally
    Then its "@context" defines "@base"

  @test:scripts/tests/sdlc/publish-verify.test.ts::no_document_leans_on_a_remote_@base_—_ld-no-base-in-a-remote-context::the_two-part_context_(URL,_then_an_inline_@base)_passes
  Scenario: A context of the URL followed by an inline @base passes
    Given a document whose context is the content context URL then an inline "@base"
    When the own-base verifier runs
    Then there are no findings and it exits 0

  @test:scripts/tests/sdlc/publish-verify.test.ts::no_document_leans_on_a_remote_@base_—_ld-no-base-in-a-remote-context::FAILS_on_the_URL_alone_—_relative_@ids_resolve_only_under_jsonld.js
  Scenario: The content context URL alone fails the own-base verifier
    Given a document whose context is only the content context URL
    When the own-base verifier runs
    Then it exits 1 with a finding that it "states no @base of its own"

  @test:scripts/tests/sdlc/publish-verify.test.ts::both_voice_verifiers_are_in_the_deploy_set
  Scenario: Both linked-data voice verifiers are in the deploy set
    Given the deploy verifier set
    Then it includes "jsonld-object-links" and "jsonld-own-base"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::a_fresh_split_of_the_tree's_own_index_passes
  Scenario: A fresh split of the tree's own index passes
    Given a search index and its fresh scope split
    When the search-scopes verifier runs
    Then it exits 0

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::an_unsplit_index_is_a_finding_—_scoped_search_would_load_nothing
  Scenario: An unsplit index is a finding
    Given a search index with every scope file removed
    When the search-scopes verifier runs
    Then a finding says the split is "missing"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::a_split_of_a_DIFFERENT_index_is_stale_—_what_a_staging_tree_that_split_before_borrowing_would_ship
  Scenario: A split of a different index is stale
    Given a scope split made before an entry was added to the index
    When the search-scopes verifier runs
    Then a finding says it was "split from a different index"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::an_entry_in_two_scopes,_or_one_missing_from_all,_does_not_partition
  Scenario: An entry in two scopes, or one missing from all, does not partition the index
    Given a smart-trust scope that also holds the root entry
    When the search-scopes verifier runs
    Then a finding says that entry "is in both"
    And emptying the locale-fr scope gives findings "the manifest says 1" and "do not partition it"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::a_remote_lookup_the_tree_does_not_hold_is_a_finding_—_bean_1br0
  Scenario: A remote lookup the tree does not hold is a finding
    Given a split declaring a remote id-lookup "who-iris" of 10 entries
    When the search-scopes verifier runs
    Then with both the lookup page and the who-iris manifest in the tree it exits 0
    And without the who-iris manifest a finding "names an index that is not in the tree"
    And without the lookup page a finding "holds no lookup page"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::a_prebuilt_index_must_cover_exactly_its_scope,_under_the_theme's_fields_—_bean_lrzn
  Scenario: A prebuilt scope index must cover exactly its scope, under the theme's fields
    Given every scope published prebuilt from an index with titles and content
    When the search-scopes verifier runs
    Then the unchanged tree exits 0
    And locale-fr's index under smart-trust's name reports 1 missing and 1 not in the scope, by key
    And an unparseable smart-trust index is "unreadable"
    And an index with only title and content fields reports those fields
    And an index built with lunr 2.4.0 reports "is lunr 2.4.0, the theme loads 2.3.9"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::a_tree_with_no_site_index_is_out_of_scope_—_search-index_reports_that
  Scenario: A tree with no site index is out of scope for the search-scopes verifier
    # Gap: the claim that search-index reports the missing index is not checked here
    Given a tree with a page and no search index
    When the search-scopes verifier runs
    Then there are no findings and 1 is out of scope
    And it does not exit 1

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::it_is_in_the_deploy_set_and_names_the_downstream_Tool_it_judges
  Scenario: The search-scopes verifier is in the deploy set and names its Tool
    Given the deploy verifier set
    Then it contains the search-scopes verifier
    And that verifier judges the Tool "site-search-scopes"

  @test:scripts/tests/sdlc/publish-verify.test.ts::the_search-scopes_verifier_—_bean_m7mn::manifest_path_is_where_the_split_writes_it
  Scenario: The scopes manifest path is assets/js/search/manifest.json
    # Gap: checks the scopes directory constant only, not that the split writes the manifest there
    Given the scopes directory
    Then its manifest path is "assets/js/search/manifest.json"
