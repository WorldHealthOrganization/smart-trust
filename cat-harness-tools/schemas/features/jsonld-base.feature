# schemas/kg/jsonld.ts defines the content JSON-LD context, whose @ids must resolve against FOLIO_BASE even
# under a strict JSON-LD 1.1 processor that ignores @base in a remote context (bean bh4q). Each Scenario names the test that executes it.
Feature: Content @ids under a strict JSON-LD processor

  @test:schemas/jsonld-base.test.ts::content_@id_under_a_strict_JSON-LD_1.1_processor::the_two-part_context_resolves_against_FOLIO_BASE
  Scenario: The two-part content context resolves @ids against FOLIO_BASE
    Given a document with @id "papers/x/blocks/def-foo" loaded from a foreign URL
    And a loader serving the published context with its @base removed
    When the document is expanded with the two-part content document context
    Then its @id is FOLIO_BASE followed by "papers/x/blocks/def-foo"

  @test:schemas/jsonld-base.test.ts::content_@id_under_a_strict_JSON-LD_1.1_processor::control:_the_bare_URL_resolves_against_the_document's_own_URL_—_the_defect
  Scenario: The bare context URL resolves @ids against the document's own URL
    Given a document with @id "papers/x/blocks/def-foo" loaded from "https://example.org/somewhere/else/doc.jsonld"
    And a loader serving the published context with its @base removed
    When the document is expanded with only the bare context URL
    Then its @id is "https://example.org/somewhere/else/papers/x/blocks/def-foo"

  @test:schemas/jsonld-base.test.ts::ContentContextSchema::accepts_the_two-part_form_and_the_bare_URL_older_records_carry
  Scenario: ContentContextSchema accepts the two-part form and the bare URL
    Then the two-part content document context parses
    And the bare content context URL parses

  @test:schemas/jsonld-base.test.ts::ContentContextSchema::refuses_any_other_context_or_base
  Scenario: ContentContextSchema refuses any other context or base
    Then a foreign context URL is refused
    And the context URL with a foreign @base is refused
    And the context URL with FOLIO_BASE plus an extra key is refused
