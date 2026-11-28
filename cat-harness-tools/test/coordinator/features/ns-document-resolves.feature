# Specifies, by reading the namespace-publishing loop (and bootstrap's copy
# line) in docs-site.yml and feature-staging.yml, that each layer's namespace
# document is published where its terms' IRIs point.
Feature: A layer's namespace document is published at the path its terms name

  @test:test/coordinator/ns-document-resolves.test.ts::a_layer's_namespace_document_is_published_where_its_terms_say_it_is::the_two_workflows_agree_with_each_other
  Scenario: The two workflows publish the same layers to the same directories
    Given the layer and directory pairs docs-site.yml and feature-staging.yml publish
    When they are compared
    Then docs-site.yml has at least 3
    And feature-staging.yml has exactly the same pairs

  @test:test/coordinator/ns-document-resolves.test.ts::a_layer's_namespace_document_is_published_where_its_terms_say_it_is::every_layer_with_a_namespace_is_published_by_the_loop
  Scenario: Every layer with a namespace is published
    Given the layer and directory pairs docs-site.yml publishes
    When their layers are collected
    Then bootstrap, harness and core are each published

  @test:test/coordinator/ns-document-resolves.test.ts::a_layer's_namespace_document_is_published_where_its_terms_say_it_is::%s_publishes_each_layer_under_its_own_IRI_segment
  Scenario: Each workflow publishes every layer under the IRI segment its namespace names
    Given a table of the workflows ".github/workflows/docs-site.yml" and ".github/workflows/feature-staging.yml"
    When the layer and directory pairs the row's workflow publishes are read
    Then there are at least 3
    And every pair's directory is the segment its layer's namespace IRI names
