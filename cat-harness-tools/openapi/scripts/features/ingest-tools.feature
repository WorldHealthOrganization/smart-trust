# Specifies the two OpenAPI ingest tools: ingestRendered (openapi/scripts/ingest-openapi-rendered.ts)
# reads a published spec URL, ingestFromSource (ingest-openapi.ts) reads a repository at a ref,
# and checkCommitted verifies either offline. Each Scenario names the test that executes it.
Feature: An OpenAPI document is ingested from a published URL or a repository ref, and checked offline

  @test:openapi/scripts/ingest-tools.test.ts::openapi-ingest-rendered::writes_the_document_verbatim_with_url_+_fetchedAt,_and_--check_accepts_it
  Scenario: A rendered document is written verbatim with its URL and fetch time, and the check accepts it
    Given a layer with smart-trust's declaration and a config naming one rendered document "published"
    When it is ingested from a fetcher serving a one-operation spec at 2026-10-11T06:00Z
    Then the state is "ingested"
    And "published.openapi.json" holds the served bytes exactly
    And "published.source.json" records the URL, fetchedAt "2026-10-11T06:00:00.000Z" and one operation
    And the committed check finds no problem

  @test:openapi/scripts/ingest-tools.test.ts::openapi-ingest-rendered::an_unreachable_URL_is_FAILED_and_writes_nothing
  Scenario: An unreachable URL fails and writes nothing
    Given the layer with one rendered document "published"
    When it is ingested from a fetcher that answers "HTTP 404"
    Then the result is "failed" with the reason naming the URL and "HTTP 404"
    And no "published.openapi.json" is written

  @test:openapi/scripts/ingest-tools.test.ts::openapi-ingest-rendered::bytes_that_are_not_OpenAPI_3_are_FAILED_and_never_replace_a_held_copy
  Scenario: Bytes that are not OpenAPI 3 fail and leave the held copy in place
    Given the layer with "published" already ingested from a valid spec
    When it is ingested again from a fetcher serving an HTML page
    Then the state is "failed"
    And "published.openapi.json" still holds the earlier spec

  @test:openapi/scripts/ingest-tools.test.ts::openapi-ingest-rendered::--check_catches_a_hand_edit_to_a_rendered_document
  Scenario: The committed check catches a hand edit to a rendered document
    Given the layer with "published" ingested
    When the document file is overwritten with a different spec
    Then the committed check says the committed document does not match its provenance

  @test:openapi/scripts/ingest-tools.test.ts::openapi-ingest-source_with_--ref::reads_the_document_AT_the_ref,_not_the_checkout's_working_tree,_and_records_that_commit
  Scenario: A repository document is read at the given ref and that commit is recorded
    Given a git repository whose "openapi.json" titled "Old" was later committed as "New"
    And a layer with a config naming the repository document "gateway"
    When it is ingested from the repository at the old commit
    Then the provenance records the old commit and title "Old"
    And "gateway.openapi.json" holds the old spec, and the committed check finds no problem
    And ingested without a ref, the title is "New"
