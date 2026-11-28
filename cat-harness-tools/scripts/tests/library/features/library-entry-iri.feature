# Every library entry has its own IRI: a materialized path whose page is a thin
# shell that loads the entry from published data (owner, 2026-10-02, #1881).
# Scenarios over the built projection are skipped where it is not built.
Feature: Every library entry has its own IRI

  @test:scripts/tests/library/library-entry-iri.test.ts::reading_an_entry_from_its_own_path::an_entry_IRI,_with_or_without_its_trailing_slash_or_index.html
  Scenario: An entry IRI is read with or without a trailing slash or index.html
    Given the library root /folio-assistant/cat-harness/library/
    When the entry is read from smart-base/smart-trust/, smart-base/smart-trust and smart-base/smart-trust/index.html under it
    Then each gives instance smart-base and id smart-trust

  @test:scripts/tests/library/library-entry-iri.test.ts::reading_an_entry_from_its_own_path::a_library_page_is_not_an_entry,_and_neither_is_the_whole_view
  Scenario: An instance page and the whole view are not entries
    When the entry is read from the instance page, the library root, or the root's index.html
    Then each gives no entry

  @test:scripts/tests/library/library-entry-iri.test.ts::reading_an_entry_from_its_own_path::anything_deeper,_outside_the_root,_or_undecodable_is_refused_rather_than_guessed
  Scenario: A deeper, outside or undecodable path is refused
    When the entry is read from a three-segment path, a path outside the root, or a malformed percent-encoding
    Then each gives no entry

  @test:scripts/tests/library/library-entry-iri.test.ts::reading_an_entry_from_its_own_path::the_script_uses_it,_and_carries_no_query-string_addressing
  Scenario: The viewer script reads the entry from its path, never a query string
    Given the viewer script
    Then it embeds the address code and calls entryFromPath(location.pathname, LIB_ROOT)
    And it reads no location.search and builds no ?entry=, ?id= or ?key=

  @test:scripts/tests/library/library-entry-iri.test.ts::a_legacy_#key_is_read_once,_to_be_normalised_to_the_path::decodes_the_fragment_form_every_old_link_carries
  Scenario: A legacy fragment key is decoded
    Then "#smart-base%2Fsmart-trust" and "#smart-base/smart-trust" both read as key smart-base/smart-trust

  @test:scripts/tests/library/library-entry-iri.test.ts::a_legacy_#key_is_read_once,_to_be_normalised_to_the_path::an_empty_or_non-key_fragment_is_not_a_key
  Scenario: An empty or non-key fragment is not a key
    Then "", "#" and "#badges" each read as the empty key

  @test:scripts/tests/library/library-entry-iri.test.ts::a_legacy_#key_is_read_once,_to_be_normalised_to_the_path::normalisation_is_a_replaceState_to_the_entry's_path,_never_a_new_fragment
  Scenario: A legacy key is normalised with replaceState, not a new fragment
    Given the viewer script
    Then it calls history.replaceState to the entry's path
    And, apart from the embedded edit-links runtime, it never builds "#" + encodeURIComponent

  @test:scripts/tests/library/library-entry-iri.test.ts::a_row's_TITLE_opens_the_entry's_own_page_(owner,_2026-10-02)::a_referenced_entry_with_no_README:_the_title_links_its_path_IRI
  Scenario: A row's title links the entry's path IRI
    Given the viewer's columns, run on the smart-base library page
    When the title cell of a referenced entry with no README is rendered
    Then it links /folio-assistant/cat-harness/library/smart-base/smart-trust/ with the title
    And it holds no github.com link

  @test:scripts/tests/library/library-entry-iri.test.ts::a_row's_TITLE_opens_the_entry's_own_page_(owner,_2026-10-02)::the_SLUG_links_the_entry's_`view`,_composed_against_the_site_root
  Scenario: A row's slug links the entry's view under the site root
    Given the viewer's columns, run on the smart-base library page
    When the id cell of an entry whose view is /smart-trust/ is rendered
    Then it is a lib-view link to /folio-assistant/smart-trust/

  @test:scripts/tests/library/library-entry-iri.test.ts::a_row's_TITLE_opens_the_entry's_own_page_(owner,_2026-10-02)::an_entry_WITH_a_README_keeps_it,_as_a_secondary_link_only
  Scenario: An entry with a README keeps it as a secondary link
    Given the viewer's columns, run on the smart-base library page
    When the title cell of an entry with a README is rendered
    Then it starts with the lib-title link to the entry's path IRI
    And it carries a separate README link to the README URL

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::holds_identity_only_—_config_and_alternate_—_and_loads_the_shared_assets
  Scenario: An entry shell holds only its identity and loads shared assets
    Given the entry shell for smart-base/smart-trust with a published JSON-LD
    Then its config names the data, scope, library root and entry
    And its alternate is the entry's manifest.jsonld
    And it loads the shared viewer.js and viewer.css and holds no style element

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::is_a_THEMED_page_(2026-10-07):_the_layout's_band,_no_rail,_no_folio_mount,_both_sources_named
  Scenario: An entry shell is a themed page
    Given the entry shell for smart-base/smart-trust
    Then it starts with front matter for layout default, with its title, nav_exclude and search_exclude
    And it carries no doctype, head, folio navbar or folio mount
    And it names the library projection as a source
    And its body is wrapped in raw and endraw

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::the_layout_writes_the_alternate_it_declares
  Scenario: The site layout writes the declared alternate link
    Given the site's _includes/head_custom.html
    Then it writes a link rel alternate of type application/ld+json from page.alternate_jsonld

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::an_entry_with_no_published_JSON-LD_gets_no_`alternate`,_and_its_noscript_names_only_the_projection
  Scenario: An entry with no published JSON-LD gets no alternate
    Given the entry shell for an entry with no JSON-LD
    Then it declares no alternate and never says "alternate"
    And its noscript names only the library projection
    And its config names the data, scope, library root and entry

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::is_a_few_KB
  Scenario: An entry shell is under 4 KB
    Given the entry shell for smart-base/smart-trust
    Then it is shorter than 4096 characters

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::the_instance_page_is_the_same_template,_with_no_entry
  Scenario: The instance page is the same template with no entry
    Given the smart-base instance page
    Then its config names the data, scope and library root and no entry
    And it is the instance's subject shell and not an entry shell
    And the smart-trust entry shell is an entry shell and not the subject shell

  @test:scripts/tests/library/library-entry-iri.test.ts::the_committed_tree:_one_materialized_shell_per_entry::every_entry_in_the_projection_has_a_shell_at_<library>/<instance>/<id>/,_and_nothing_else_does
  Scenario: Exactly the projection's entries have shells
    Given the built library projection and the site's library route
    Then the entry shells found under <library>/<instance>/<id>/index.html are exactly the projection's entries

  @test:scripts/tests/library/library-entry-iri.test.ts::the_committed_tree:_one_materialized_shell_per_entry::each_shell's_alternate_JSON-LD_is_published
  Scenario: Each shell's alternate JSON-LD exists
    Given the built library projection
    Then each entry's shell declares an alternate
    And the file it names exists

  @test:scripts/tests/library/library-entry-iri.test.ts::asset_and_rendering:_two_resources,_two_IRIs_(owner,_2026-10-02)::the_site_root_the_IRIs_are_minted_under_is_the_one_the_site_is_served_at
  Scenario: The IRI site root is the site's served URL
    Given the site's _config.yml
    Then the IRI site root equals its url followed by its baseurl and a slash

  @test:scripts/tests/library/library-entry-iri.test.ts::asset_and_rendering:_two_resources,_two_IRIs_(owner,_2026-10-02)::the_rendering_points_TO_the_asset:_its_alternate_resolves_to_the_asset's_file
  Scenario: Each shell's alternate resolves to the entry's asset
    Given the built library projection
    Then each entry shell's alternate resolves to the entry's library asset path on the site

  @test:scripts/tests/library/library-entry-iri.test.ts::asset_and_rendering:_two_resources,_two_IRIs_(owner,_2026-10-02)::every_entry's_`view`_is_GENERATED_into_the_projection:_another_instance's_declared_root,_else_its_own_page
  Scenario: Every entry's view is generated into the projection
    Given the built library projection
    Then smart-base/smart-trust's view is /smart-trust/
    And who-iris/who-rhr-1806-eng's view is its own entry page under the library route
    And every entry has a view, and every view under the library route has an index.html

  @test:scripts/tests/library/library-entry-iri.test.ts::asset_and_rendering:_two_resources,_two_IRIs_(owner,_2026-10-02)::the_asset_never_references_a_rendering_of_itself
  Scenario: An entry's asset does not reference its rendering
    Given the built library projection
    Then no entry's asset text mentions subjectOf, foaf:page, "page", a library index.html or cat-harness/library/

  @test:scripts/tests/library/library-entry-iri.test.ts::smart-trust,_referenced_in_smart-base's_library_(owner,_2026-10-02)::is_a_valid_referenced_record_of_a_PUBLICATION,_with_the_identity_of_the_IG_the_index_describes
  Scenario: smart-trust is a referenced record of the IG publication
    Given smart-base's library holds smart-trust/referenced.json and smart-trust's artefact index
    Then the record is "referenced"
    And its source is a published one with the index's canonical base and package id
    And its identity's version is the source's version

  @test:scripts/tests/library/library-entry-iri.test.ts::smart-trust,_referenced_in_smart-base's_library_(owner,_2026-10-02)::holds_nothing_of_the_IG_and_passes_the_L1_gate
  Scenario: smart-trust holds nothing of the IG and passes L1
    Given smart-base's library holds smart-trust/referenced.json
    Then the entry has no sections, blocks or images directory
    And its L1 check has no unmet requirement

  @test:scripts/tests/library/library-entry-iri.test.ts::smart-trust,_referenced_in_smart-base's_library_(owner,_2026-10-02)::links_the_published_IG_and_this_site's_artefact_index_—_the_instance's_declared_root
  Scenario: smart-trust links the published IG and the artefact index
    Given smart-base's library holds smart-trust/referenced.json
    Then its links include the published IG at http://smart.who.int/trust
    And the smart-trust declaration has an instance-root docs directory
    And its links include the artefact index at the smart-trust instance's root path

  @test:scripts/tests/library/library-entry-iri.test.ts::smart-trust,_referenced_in_smart-base's_library_(owner,_2026-10-02)::appears_in_smart-base's_library_projection,_with_its_links
  Scenario: smart-trust appears in the projection with its links
    Given the built library projection
    Then the smart-base/smart-trust entry has rung referenced and title "WHO SMART Trust"
    And its links are the published IG and the artefact index at /smart-trust/

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::declares_its_entry_in_RDFa_and_a_JSON-LD_stub,_with_no_private_config_block_(issue_#1830)
  Scenario: An entry shell declares its entry in RDFa and a JSON-LD stub, with no private config block
    Given the entry shell for "smart-trust" in the "smart-base" library
    Then its page node has no problems
    And its first RDFa IRI is the library asset IRI of smart-base/smart-trust
    And it holds no "application/json" script block
    And the "smart-base" library's own page declares no page node

  @test:scripts/tests/library/library-entry-iri.test.ts::the_shell_template::the_entry_IRI_is_extensionless_kind/id;_its_JSON-LD_and_stub_sit_beside_it_(Q-THIN-6_B)
  Scenario: The entry IRI is an extensionless kind/id, with its JSON-LD and stub beside it
    Given the library asset IRI of smart-base/smart-trust
    Then it is the docs site followed by "assets/library/jsonld/smart-base/source/smart-trust"
    And its asset site path is the same path ending ".jsonld"
    And its stub site path is the same path ending ".html"
    And the IRI holds no "#" or "?"

  @test:scripts/tests/library/library-entry-iri.test.ts::the_committed_tree:_one_materialized_shell_per_entry::a_shell_whose_entry_holds_no_manifest_names_no_alternate
  Scenario: A committed shell whose entry holds no manifest names no alternate
    # Skipped: when the library projection index has not been built
    Given every entry in the published library projection that holds no manifest
    When the shell at its library instance and id is read
    Then it declares no alternate JSON-LD
