# scripts/fsh-guts-export.ts builds the fsh-guts trashcan's own JSON-LD document, reachable by name at
# <base>/fsh-guts.jsonld and by no edge from the main graph, with logs excluded by declaration.
# Each Scenario names the test that executes it.
Feature: The fsh-guts trashcan exported as its own JSON-LD document

  @test:scripts/tests/fsh-guts-export.test.ts::the_real_corpus::nothing_was_skipped_for_a_reason_that_means_a_defect
  Scenario: No node of the real fsh-guts corpus is skipped as a defect
    Given the fsh-guts export built from the harness root
    Then no skipped file's reason says it "does not satisfy" the schema

  @test:scripts/tests/fsh-guts-export.test.ts::the_real_corpus::the_@id_names_where_it_is_actually_served
  Scenario: The fsh-guts document's @id names where it is served
    Given the fsh-guts export built from the harness root
    Then its @id is "https://litlfred.github.io/folio-assistant/cat-harness/directory/fsh-guts"
    And built against the base "https://example.invalid/preview" its @id is "https://example.invalid/preview/cat-harness/directory/fsh-guts"

  @test:scripts/tests/fsh-guts-export.test.ts::the_real_corpus::a_writer_gets_the_one_declared_trashcan,_and_is_refused_when_there_is_none
  Scenario: A writer gets the one declared trashcan and is refused when there is none
    Given a layer that declares a repository-scoped fsh-guts directory
    Then fshGutsDirectory is the first directory fshGutsDirs finds
    And for a layer declaring no fsh-guts directory fshGutsDirectory throws "no `fsh-guts` directory is declared"

  @test:scripts/tests/fsh-guts-export.test.ts::reachable_BY_NAME,_and_by_no_edge::the_main_graph_still_does_not_mention_fsh-guts_at_all
  Scenario: The main graph does not mention fsh-guts
    Given the main graph export
    Then its JSON does not contain "fsh-guts"

  @test:scripts/tests/fsh-guts-export.test.ts::reachable_BY_NAME,_and_by_no_edge::and_this_document_is_a_separate_one,_not_a_subgraph
  Scenario: The fsh-guts document is separate from the main graph document
    Given the fsh-guts export built from the harness root
    Then its @id is not the main graph's "folio-assistant.jsonld" @id

  @test:scripts/tests/fsh-guts-export.test.ts::logs_are_excluded_by_DECLARATION,_not_by_the_gitignore::a_log_entry_sitting_in_the_tree_is_not_in_the_document
  Scenario: A log entry in the trashcan tree is not in the exported document
    Given a trashcan holding a kept fsh-guts node and a "logs/entry.json" log entry with a "secret-ish" summary
    When the fsh-guts export is built
    Then it counts 1 node
    And its graph does not contain "secret-ish"

  @test:scripts/tests/fsh-guts-export.test.ts::logs_are_excluded_by_DECLARATION,_not_by_the_gitignore::the_skip_reason_names_what_the_file_actually_declares
  Scenario: The skip reason names the schema a log entry declares
    When readFshGutsNode reads a JSON log entry declaring "folio-log/v1"
    Then it yields no node
    And its reason names "folio-log/v1"
    And its reason does not say "declares no $schema"

  @test:scripts/tests/fsh-guts-export.test.ts::logs_are_excluded_by_DECLARATION,_not_by_the_gitignore::a_file_that_genuinely_declares_nothing_says_so
  Scenario: A file that declares no schema is reported as such
    When readFshGutsNode reads a plain markdown note with no front matter
    Then its reason says "declares no $schema"

  @test:scripts/tests/fsh-guts-export.test.ts::what_was_not_included_is_reported::a_node_declaring_this_schema_but_failing_it_is_a_defect,_not_a_skip
  Scenario: A node declaring the fsh-guts schema but failing it is reported as a defect
    Given a trashcan holding a node that declares "folio-fsh-guts/v1" but has no title
    When the fsh-guts export is built
    Then it counts 0 nodes
    And the skip reason says "does not satisfy"

  @test:scripts/tests/fsh-guts-export.test.ts::what_was_not_included_is_reported::an_instance_with_no_declared_trashcan_is_distinguishable_from_an_empty_one
  Scenario: A layer with no declared trashcan is distinguishable from an empty one
    Then the export of a layer with no fsh-guts directory scans nothing
    And the export of a layer with an empty declared trashcan scans "fsh-guts" and counts 0 nodes

  @test:scripts/tests/fsh-guts-export.test.ts::the_site_build_publishes_it,_with_the_media-type_alias::the_document_is_written_into_the_site
  Scenario: The docs-site workflow writes the fsh-guts document into the site
    # Gap: a source-text check of .github/workflows/docs-site.yml; the site build is not run
    Given the docs-site workflow file
    Then it contains "scripts/fsh-guts-export.ts"
    And it contains "./_site/fsh-guts.jsonld"

  @test:scripts/tests/fsh-guts-export.test.ts::the_site_build_publishes_it,_with_the_media-type_alias::and_the_.json_alias,_since_Pages_serves_.jsonld_as_octet-stream
  Scenario: The docs-site workflow also publishes a .json alias of the fsh-guts document
    # Gap: a source-text check of .github/workflows/docs-site.yml; the site build is not run
    Given the docs-site workflow file
    Then it copies "./_site/fsh-guts.jsonld" to "./_site/fsh-guts.json"

  @test:scripts/tests/fsh-guts-export.test.ts::the_folded_block_scalar_the_corpus_actually_uses::`summary:_>-`_is_read_as_prose,_not_as_the_literal_`>-`
  Scenario: A folded summary block is read as prose
    When readFshGutsNode reads a node whose summary is a ">-" block over "one line" and "and another"
    Then the summary is "one line and another"

  @test:scripts/tests/fsh-guts-export.test.ts::a_kind's_own_fields_survive,_because_`kind`_is_open::an_extra_field_survives_the_read_instead_of_being_stripped
  Scenario: A kind's extra field survives the read
    When readFshGutsNode reads a JSON "staging-preview" node with a nested staging block
    Then a node is read
    And its staging slug is "x"

  @test:scripts/tests/fsh-guts-export.test.ts::a_kind's_own_fields_survive,_because_`kind`_is_open::and_reaches_the_exported_document,_under_`data`
  Scenario: A kind's extra field reaches the exported document under data
    Given a trashcan holding a JSON "staging-preview" node with staging slug "x" and liveness "live"
    When the fsh-guts export is built
    Then it counts 1 node
    And the node's data.staging is slug "x" and liveness "live"

  @test:scripts/tests/fsh-guts-export.test.ts::a_kind's_own_fields_survive,_because_`kind`_is_open::an_ordinary_node_gains_no_empty_`data`_—_the_document_is_unchanged_for_it
  Scenario: An ordinary node gains no data field
    Given a trashcan holding an ordinary markdown proposal node
    When the fsh-guts export is built
    Then the exported node has no data field

  @test:scripts/tests/fsh-guts-export.test.ts::a_kind's_own_fields_survive,_because_`kind`_is_open::a_common_field_is_emitted_once,_under_its_term_and_not_also_in_`data`
  Scenario: A common field is emitted once, under its own term
    Given a trashcan holding a node with bean "abcd"
    When the fsh-guts export is built
    Then the exported node's bean is "abcd"
    And it has no data field

  @test:scripts/tests/fsh-guts-export.test.ts::a_JSON_node_of_THIS_graph_is_read,_and_a_log_still_is_not::the_JSON_carrier_works,_because_front_matter_is_flat
  Scenario: A JSON fsh-guts node is read
    When readFshGutsNode reads a JSON node titled "T" of kind "staging-preview"
    Then the node's title is "T" and its kind is "staging-preview"

  @test:scripts/tests/fsh-guts-export.test.ts::a_JSON_node_of_THIS_graph_is_read,_and_a_log_still_is_not::its_body_is_empty_rather_than_invented_—_a_JSON_node's_content_IS_its_fields
  Scenario: A JSON fsh-guts node's body is empty
    When readFshGutsNode reads a JSON fsh-guts node
    Then its body is the empty string

  @test:scripts/tests/fsh-guts-export.test.ts::a_JSON_node_of_THIS_graph_is_read,_and_a_log_still_is_not::READING_JSON_DID_NOT_LET_LOGS_IN_—_the_guarantee_this_change_had_to_keep
  Scenario: Reading JSON nodes does not let log entries into the export
    Given a trashcan holding a JSON log entry with a "secret-ish" summary and a JSON fsh-guts node
    When the fsh-guts export is built
    Then it counts 1 node
    And its graph does not contain "secret-ish"

  @test:scripts/tests/fsh-guts-export.test.ts::a_JSON_node_of_THIS_graph_is_read,_and_a_log_still_is_not::a_JSON_file_declaring_this_schema_but_failing_it_is_a_defect,_not_a_clean_skip
  Scenario: A JSON file declaring the fsh-guts schema but failing it is a defect
    When readFshGutsNode reads a JSON file declaring "folio-fsh-guts/v1" with no title
    Then it yields no node
    And its reason says "does not satisfy it"
