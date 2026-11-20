# Specifies the schemas in openapi/schemas/openapi.ts: cat-openapi-config/v1 with
# repository and rendered documents, and folio-openapi-source/v1 for a rendered one.
# Each Scenario names the test that executes it.
Feature: An OpenAPI config holds repository and rendered documents, and a rendered one records its fetch

  @test:openapi/schemas/openapi.test.ts::cat-openapi-config/v1:_repository_and_rendered_documents::a_config_may_hold_only_repository_documents,_as_before
  Scenario: A config may hold only repository documents
    Given a config with one repository document "gateway" and no rendered list
    When it is parsed
    Then its rendered list is empty
    And the document's ref defaults to "main"

  @test:openapi/schemas/openapi.test.ts::cat-openapi-config/v1:_repository_and_rendered_documents::…or_only_rendered_ones
  Scenario: A config may hold only rendered documents
    Given a config with one rendered document at "https://example.org/openapi.json" and no repository list
    When it is parsed
    Then its documents list is empty
    And the rendered document keeps its URL

  @test:openapi/schemas/openapi.test.ts::cat-openapi-config/v1:_repository_and_rendered_documents::but_not_neither
  Scenario: A config with neither repository nor rendered documents is refused
    Given a config with no documents and no rendered list
    When it is checked against the config schema
    Then it fails

  @test:openapi/schemas/openapi.test.ts::cat-openapi-config/v1:_repository_and_rendered_documents::an_id_is_unique_across_BOTH_lists_—_one_directory_holds_them_all
  Scenario: An id may not be used in both the repository and the rendered list
    Given a config with a repository document "gateway" and a rendered document also with id "gateway"
    When it is checked against the config schema
    Then it fails

  @test:openapi/schemas/openapi.test.ts::cat-openapi-config/v1:_repository_and_rendered_documents::a_rendered_spec_is_read_over_https_only
  Scenario: A rendered document's URL must be https
    Given a config with a rendered document at "http://example.org/openapi.json"
    When it is checked against the config schema
    Then it fails

  @test:openapi/schemas/openapi.test.ts::folio-openapi-source/v1_for_a_rendered_document::records_the_URL_and_when_it_was_fetched_—_no_commit_to_pin
  Scenario: A rendered document's provenance records its URL and fetch time, with no commit
    Given a provenance record whose source is a URL and a "fetchedAt" time
    When it is checked against the rendered provenance schema
    Then it passes

  @test:openapi/schemas/openapi.test.ts::folio-openapi-source/v1_for_a_rendered_document::a_fetch_time_is_required:_undated_cannot_be_told_from_stale
  Scenario: A rendered document's provenance without a fetch time is refused
    Given the provenance record with its source holding only the URL
    When it is checked against the rendered provenance schema
    Then it fails
