# scripts/folio-create.ts creates a reader's document in the folio, of any document kind a loaded knowledge graph declares,
# and links an external document into library/ as a referenced node. Each Scenario names the test that executes it.
Feature: Creating and linking folio documents

  @test:scripts/tests/folio-create.test.ts::resolveKind::an_id_one_instance_declares_resolves
  Scenario: A kind id declared by one instance resolves
    Given the kinds "smart-base:l1" and "smart-base:l1-guideline"
    When "l1" is resolved
    Then it resolves to "smart-base:l1"

  @test:scripts/tests/folio-create.test.ts::resolveKind::an_id_two_instances_declare_is_refused,_naming_both
  Scenario: A kind id declared by two instances is refused, naming both
    Given the kinds "smart-base:l1" and "other:l1"
    When "l1" is resolved
    Then the error names "smart-base:l1 and other:l1"
    And "other:l1" resolves to the other instance's kind

  @test:scripts/tests/folio-create.test.ts::resolveKind::an_unknown_kind_lists_the_known_ones
  Scenario: An unknown kind lists the known ones
    Given the kind "smart-base:l1"
    When "dak" is resolved
    Then the error lists "smart-base:l1"

  @test:scripts/tests/folio-create.test.ts::the_page::a_sub-kind_carries_its_parent's_sections_first,_each_once
  Scenario: A sub-kind carries its parent's sections first, each once
    Given "l1" with sections introduction and annexes, and "l1-guideline" extending it with recommendations and introduction
    When the sections of "l1-guideline" are read
    Then they are introduction, annexes, recommendations in that order

  @test:scripts/tests/folio-create.test.ts::the_page::front_matter_names_the_kind,_and_every_section_is_a_heading_marked_required_or_optional
  Scenario: The page front matter names the kind and each section is a marked heading
    Given the "l1-guideline" kind
    When its page is drafted with the title "My guideline"
    Then the front matter has documentKind "smart-base:l1-guideline"
    And "recommendations heading" is a level-2 heading followed by a "Required. about recommendations" comment
    And annexes carries an "Optional. about annexes" comment

  @test:scripts/tests/folio-create.test.ts::createDocument::writes_<folio>/<slug>/index.md_and_refuses_to_overwrite_it
  Scenario: createDocument writes the index page and refuses to overwrite it
    Given an empty root and the "l1" kind
    When a document "my-doc" titled "My doc" is created
    Then folio/my-doc/index.md is written and contains "# My doc"
    And creating "my-doc" again fails with "already exists"
    And the page still contains "# My doc"

  @test:scripts/tests/folio-create.test.ts::createDocument::a_bad_slug_or_an_unknown_kind_writes_nothing
  Scenario: A bad slug or an unknown kind is refused
    # Gap: only the error is checked, not that nothing was written
    Given an empty root and the "l1" kind
    Then creating with the slug "Bad Slug" returns an error
    And creating with the kind "nope" returns an error

  @test:scripts/tests/folio-create.test.ts::createDocument::discovers_document_kinds_from_the_dependency_chain_and_mounted_layers_when_kinds_is_omitted
  Scenario: Document kinds are discovered from the dependency chain and mounted layers
    Given an upstream dependency "upstream-dep" declaring kind "l1" outside the folio checkout
    And a folio checkout that depends on it and has a mount lock placing "mounted-layer", declaring "programme", under mounts/mounted-layer
    When the loaded document kinds are read with no kinds given
    Then they are "mounted-layer:programme" and "upstream-dep:l1"
    And a "programme" document "anc-programme" is created with documentKind "mounted-layer:programme"
    And an "upstream-dep:l1" document "anc-l1" is created at folio/anc-l1/index.md

  @test:scripts/tests/folio-create.test.ts::linkDocument::writes_<library>/<slug>/referenced.json_and_manifest.jsonld_that_pass_ReferencedSourceSchema_and_checkEntry
  Scenario: linkDocument writes a referenced entry that passes the schema and the entry check
    Given an empty root
    When "https://example.org/upstream-ig/" is linked as "upstream-overview" titled "Upstream overview"
    Then library/upstream-overview/referenced.json and manifest.jsonld are written
    And referenced.json passes the referenced-source schema, with state "referenced" and one "upstream document" link to the URL
    And the manifest has the title "Upstream overview", contains nothing, and a disposition mentioning "referenced source"
    And the entry check reports no unmet requirement

  @test:scripts/tests/folio-create.test.ts::linkDocument::refuses_to_overwrite_an_existing_library_entry_or_accept_a_non-http(s)_URL
  Scenario: linkDocument refuses an existing entry and a non-http(s) URL
    Given a library entry "ext-doc" already linked
    Then linking "ext-doc" again fails with "already exists"
    And linking "javascript:alert(1)" fails naming "http:// or https://"
