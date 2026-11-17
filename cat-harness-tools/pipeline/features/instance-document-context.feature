# pipeline/instance-document-context.ts is the emitters' write boundary: a written JSON-LD
# document names its containing instance's own context URL instead of the shared one.
# Each Scenario names the test that executes it.
Feature: Instance document contexts at the write boundary

  @test:pipeline/instance-document-context.test.ts::instance_context_URLs::<iriBase>ns/context/v1.jsonld,_with_or_without_the_trailing_slash
  Scenario: An instance's context URL is its iriBase plus ns/context/v1.jsonld, with or without the trailing slash
    When the context URL of "https://example.org/top/" is made, it is that base followed by the instance context path
    And "https://example.org/top" without the slash gives "https://example.org/top/ns/context/v1.jsonld"

  @test:pipeline/instance-document-context.test.ts::atInstanceContext::names_the_innermost_containing_instance's_context,_keeping_the_local_half_and_key_order
  Scenario: A document names its innermost containing instance's context, keeping the local half and key order
    Given the instances "top" (iriBase https://example.org/top/), "nested" inside it (https://example.org/nested) and "bare" with no iriBase
    And a document whose context is the shared content context URL plus a local object
    When it is rewritten for a path under "top"
    Then its context is top's context URL followed by the unchanged local object
    And its keys stay in the order "@context", "@id", "title"
    And for a path under "nested" the context names nested's context URL
    And the original document is not mutated

  @test:pipeline/instance-document-context.test.ts::atInstanceContext::outside_every_instance,_or_on_another_context,_unchanged
  Scenario: Outside every instance, or on another context, a document is unchanged
    Given the instances "top" (iriBase https://example.org/top/), "nested" inside it (https://example.org/nested) and "bare" with no iriBase
    And a document whose context is the shared content context URL plus a local object
    When it is rewritten for a path outside every instance, the same document comes back
    And a document with a SKOS-only context under "top" comes back unchanged

  @test:pipeline/instance-document-context.test.ts::atInstanceContext::inside_an_instance_with_no_iriBase_it_THROWS
  Scenario: Inside an instance with no iriBase the rewrite throws
    Given the instances "top" (iriBase https://example.org/top/), "nested" inside it (https://example.org/nested) and "bare" with no iriBase
    And a document whose context is the shared content context URL plus a local object
    When it is rewritten for a path under "bare"
    Then it throws, saying the instance declares no iriBase

  @test:pipeline/instance-document-context.test.ts::atInstanceContext::the_serialised_form_changes_only_the_URL
  Scenario: The serialised rewrite changes only the context URL
    Given the instances "top" (iriBase https://example.org/top/), "nested" inside it (https://example.org/nested) and "bare" with no iriBase
    And the document serialised as indented JSON text
    When the text is rewritten for a path under "top"
    Then it equals the original text with only the content context URL replaced by top's
    And for a path outside every instance the text is unchanged
