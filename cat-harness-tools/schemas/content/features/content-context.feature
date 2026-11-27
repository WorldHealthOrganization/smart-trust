# Specifies schemas/content/content-context.ts: documentContext (the published
# content context plus a local half), the instance contexts (instanceContextUrl,
# instanceContext, instanceDocumentContext), and atInstanceContext with its
# serialised form, the emitters' write boundary.
Feature: A document's JSON-LD context names a published context and binds only what it lacks locally

  @test:schemas/content/content-context.test.ts::documentContext_(bean_0r7u)::a_document_whose_types_the_published_context_binds_carries_only_@base
  Scenario: Types the published context binds need only @base locally
    Given prefixes for two instances
    When the document context is built for "cat-harness:SourceDocument" and "doco:Section"
    Then it is the content context URL followed by an object holding only "@base" set to the folio base

  @test:schemas/content/content-context.test.ts::documentContext_(bean_0r7u)::an_instance's_kind_class_binds_that_instance's_prefix_locally,_once
  Scenario: An instance's kind classes bind that instance's prefix once
    Given prefixes for two instances, one of them "folio-assistant-sci"
    When the document context is built for "folio-assistant-sci:Theorem", "folio-assistant-sci:Lemma" and "doco:Section"
    Then the local half is "@base" plus a single binding of "folio-assistant-sci" to its namespace

  @test:schemas/content/content-context.test.ts::documentContext_(bean_0r7u)::a_different_base_is_honoured
  Scenario: A different base is honoured
    Given no types and the base "https://example.org/site/"
    When the document context is built
    Then the local half's "@base" is "https://example.org/site/"

  @test:schemas/content/content-context.test.ts::documentContext_(bean_0r7u)::a_prefix_nothing_binds_is_refused,_never_emitted
  Scenario: A prefix nothing binds is refused
    Given the type "nobody:Thing", whose prefix no context binds
    When the document context is built
    Then it throws an error saying no context binds it

  @test:schemas/content/content-context.test.ts::instance_contexts_(bean_folio-assistant-63q4)::the_URL_is_<iriBase>ns/context/v1.jsonld,_with_or_without_the_trailing_slash
  Scenario: An instance's context URL is its iriBase plus ns/context/v1.jsonld
    Given the iriBase "https://example.org/top/", and the same without its trailing slash
    When the instance context URL is built from each
    Then both are "https://example.org/top/ns/context/v1.jsonld"

  @test:schemas/content/content-context.test.ts::instance_contexts_(bean_folio-assistant-63q4)::by_name,_or_by_a_path_inside_it_—_the_innermost_instance_wins
  Scenario: An instance is found by name or by a path inside it, the innermost winning
    Given the instances "top", "nested" inside it, and "bare" with no iriBase
    When the instance context is looked up by the name "top", by a path inside "top", and by a path inside "nested"
    Then the name gives top's context URL
    And the path inside "top" gives the instance "top"
    And the path inside "nested" gives nested's context URL

  @test:schemas/content/content-context.test.ts::instance_contexts_(bean_folio-assistant-63q4)::an_instance_with_no_iriBase,_or_none_at_all,_THROWS_—_never_a_URL_nobody_publishes
  Scenario: An instance with no iriBase, or no instance at all, throws
    Given the instances "top", "nested" and "bare", which declares no iriBase
    When the instance context is looked up for "bare", and for a path inside no instance
    Then the first throws saying it declares no iriBase
    And the second throws saying there is no instance

  @test:schemas/content/content-context.test.ts::instance_contexts_(bean_folio-assistant-63q4)::instanceDocumentContext_is_the_two-part_form,_and_the_record_schema_accepts_it
  Scenario: The instance document context is the two-part form the record schema accepts
    Given the instance "top"
    When its instance document context is built
    Then it is top's context URL followed by "@base" set to the folio base
    And the content context schema accepts it
    And the schema refuses the same form naming "ns/content/v1.jsonld" instead

  @test:schemas/content/content-context.test.ts::instance_contexts_(bean_folio-assistant-63q4)::documentContext_with_an_instance_keeps_its_local_bindings_and_swaps_only_the_URL
  Scenario: Naming an instance swaps only the URL of the document context
    Given the type "folio-assistant-sci:Theorem" and the instance "top"
    When the document context is built for that instance
    Then the URL is top's context URL
    And the local half is "@base" plus the "folio-assistant-sci" binding

  @test:schemas/content/content-context.test.ts::atInstanceContext_—_the_emitters'_write_boundary::names_the_containing_instance's_context,_keeping_the_local_half_and_key_order
  Scenario: A document written inside an instance names that instance's context
    Given a document naming the content context with a local half, then "@id" and "title"
    When it is put at a path inside the instance "top"
    Then its context is top's context URL with the same local half
    And its keys keep the order "@context", "@id", "title"
    And the original document still names the content context

  @test:schemas/content/content-context.test.ts::atInstanceContext_—_the_emitters'_write_boundary::outside_every_instance_it_is_unchanged;_another_context_is_unchanged
  Scenario: Outside every instance, or with another context, the document is returned as it is
    Given a document naming the content context, and another naming only a skos prefix
    When the first is put at a path inside no instance, and the second inside "top"
    Then each is returned as the same object

  @test:schemas/content/content-context.test.ts::atInstanceContext_—_the_emitters'_write_boundary::inside_an_instance_with_no_iriBase_it_THROWS
  Scenario: Inside an instance with no iriBase, it throws
    Given a document naming the content context
    When it is put at a path inside "bare", which declares no iriBase
    Then it throws saying the instance declares no iriBase

  @test:schemas/content/content-context.test.ts::atInstanceContext_—_the_emitters'_write_boundary::the_serialised_form_changes_only_the_URL
  Scenario: The serialised form changes only the URL
    Given the document serialised as indented JSON text
    When the serialised form is put inside "top", and inside no instance
    Then inside "top" the text differs only by top's context URL replacing the content context URL
    And inside no instance the text is unchanged
