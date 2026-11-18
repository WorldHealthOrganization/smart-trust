# The root meta-skeleton: one index naming every declared layer's export,
# built over a real site layout in a temporary directory.
# Each Scenario names the test that executes it.
Feature: Root index of declared instances

  Background:
    Given the repository subgraph index has been built at publish
    And a temporary site holding every declared layer's export, each of two nodes

  @test:scripts/tests/root-index.test.ts::the_root_index::names_every_declared_instance,_once,_and_nothing_else
  Scenario: The index names every declared instance once
    When the root index is built
    Then there are no problems
    And the entries' names are exactly the declared instance names

  @test:scripts/tests/root-index.test.ts::the_root_index::each_entry's_@id_is_the_address_its_exporter_mints,_with_counts_and_a_digest_of_what_is_there
  Scenario: Each entry carries its address, node count and digest
    When the root index is built
    Then every entry's @id is an http(s) URL ending in .jsonld
    And its url is under https://litlfred.github.io/folio-assistant/ ending in .jsonld
    And its node count is 2 and its sha256 is 64 hex digits

  @test:scripts/tests/root-index.test.ts::the_root_index::depth_1_only:_no_graph_node_is_inlined
  Scenario: No graph node is inlined
    When the root index is built
    Then no entry has a "@graph" key

  @test:scripts/tests/root-index.test.ts::the_root_index::`needs`_becomes_the_dependencies'_document_IRIs
  Scenario: Every dependency an entry names is an entry of the index
    # Gap: checks only that each dependsOn IRI is some entry's @id; it does not check dependsOn matches the layer's declared `needs`, nor that it is non-empty.
    When the root index is built
    Then every IRI in an entry's dependsOn is the @id of an entry in the index

  @test:scripts/tests/root-index.test.ts::the_root_index::a_framed_instance_names_its_subgraph_root;_bootstrap_names_its_own_published_site_(t8c4)
  Scenario: Subgraph roots for a framed instance and for bootstrap
    When the root index is built
    Then cat-harness's subgraph ends in /subgraph/cat-harness/
    And bootstrap's subgraph ends in /bootstrap/subgraph/

  @test:scripts/tests/root-index.test.ts::the_root_index::every_key_expands_under_the_verifier_the_deploy_runs_—_nothing_is_dropped_as_an_undefined_term
  Scenario: Every key expands under the deploy's JSON-LD verifier
    When the root index is built and JSON-LD expanded with the site's local loader
    Then expansion reports no findings

  @test:scripts/tests/root-index.test.ts::the_root_index::an_instance_with_no_export_is_a_PROBLEM,_never_a_shorter_index
  Scenario: An instance with no export is a problem
    Given a site missing bootstrap's export
    When the root index is built
    Then a problem starts with "bootstrap: no export"
