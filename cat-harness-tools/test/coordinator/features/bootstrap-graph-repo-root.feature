# Specifies, against the checkout's docs-site.yml and feature-staging.yml and
# its git index, how the bootstrap graph document is published: its @id, its
# single publisher, its absence from git, and its provenance.
Feature: The bootstrap graph is published once, where its @id says, with provenance, and is not committed

  @test:test/coordinator/bootstrap-graph-repo-root.test.ts::the_document_is_published_where_it_says_it_is::its_`@id`_is_the_URL_the_site_build_writes_it_to
  Scenario: Each publishing step's base URL and output directory name the same directory
    Given the workflows docs-site.yml and feature-staging.yml
    When the steps that publish a bootstrap graph are read
    Then each step's --base-url directory equals its --out directory under ./_site/

  @test:test/coordinator/bootstrap-graph-repo-root.test.ts::the_document_is_published_where_it_says_it_is::the_site_build_actually_writes_it,_at_that_path
  Scenario: The site build writes the document at the path its @id names
    Given the bootstrap graph exported with a document IRI ending in "<stub>/<stub>.jsonld"
    And the --out paths of docs-site.yml, with captured stub and directory variables expanded
    When the last two segments of the @id's path are taken
    Then the --out paths include "./_site/" followed by those segments

  @test:test/coordinator/bootstrap-graph-repo-root.test.ts::the_document_is_published_where_it_says_it_is::exactly_ONE_step_publishes_it_—_the_rival_generator_no_longer_does
  Scenario: Exactly one step in each workflow publishes the bootstrap graph
    Given the workflows docs-site.yml and feature-staging.yml
    When the steps that publish a bootstrap graph are counted
    Then each workflow has exactly one

  @test:test/coordinator/bootstrap-graph-repo-root.test.ts::the_document_is_published_where_it_says_it_is::it_is_NOT_committed_—_it_is_a_build_artefact_now
  Scenario: The bootstrap graph document is not tracked by git
    Given the checkout's git index
    When "bootstrap/bootstrap.jsonld" is listed
    Then git lists nothing

  @test:test/coordinator/bootstrap-graph-repo-root.test.ts::the_document_has_a_schema,_and_the_published_build_satisfies_it_(bean_n350)::the_published_copy_carries_provenance;_the_@graph_carries_none_(hwzu)
  Scenario: The published document carries provenance and its @graph carries no build time
    Given the workflows docs-site.yml and feature-staging.yml
    When their bootstrap graph publishing steps are read
    Then every such step passes --provenance
    And the bootstrap graph exported with provenance has a top-level "generatedAtTime"
    And its @graph does not mention "generatedAtTime"
