# The content profile axis in schemas/content/block-kinds.ts: `document` and `paper` as nested
# restrictions of the block kinds (profileAcceptsKind, kindsOutsideProfile, profileForContentType),
# kept separate from the content-adapter axis. Each Scenario names the test that executes it.
Feature: Content profiles restrict block kinds without disturbing adapters

  @test:scripts/tests/content-profiles.test.ts::the_profile_partition::document_and_math_are_disjoint_and_cover_the_built-in_kinds
  Scenario: Document and math kinds partition the built-in kinds
    Given the document block kinds and the math block kinds
    Then no math kind is a document kind
    And together they number and equal the built-in block kinds

  @test:scripts/tests/content-profiles.test.ts::the_profile_partition::a_kind_added_to_BLOCK_KINDS_cannot_go_unclassified
  Scenario: Every built-in kind is in exactly one of document or math
    Given the built-in block kinds
    Then each one is in exactly one of the document and math kinds

  @test:scripts/tests/content-profiles.test.ts::the_profile_partition::the_document_profile_is_named_explicitly,_not_inherited_silently
  Scenario: The document and math kinds are pinned by name
    Given the document block kinds
    Then sorted they are "algorithm", "diagram", "equation", "example", "figure", "prose", "recommendation", "remark", "simulator" and "table"
    And the math kinds sorted are "conjecture", "corollary", "definition", "lemma", "proof", "proposition" and "theorem"

  @test:scripts/tests/content-profiles.test.ts::the_profile_partition::`definition`_is_in_the_math_profile_for_a_reason_the_type_enforces
  Scenario: A definition block requires a Lean reference and is a math kind
    # Skipped: when no mounted vocabulary module types `definition`
    Given the source of the vocabulary module that types `definition`
    When the DefinitionBlock interface body is read
    Then it declares "lean: LeanRef"
    And it does not declare "lean?: LeanRef"
    And "definition" is a math kind

  @test:scripts/tests/content-profiles.test.ts::profiles_do_not_disturb_the_adapter_axis::every_built-in_kind_maps_to_exactly_one_built-in_vocabulary
  Scenario: Every built-in kind maps to a content adapter
    # Gap: only checks that each kind's adapter is a content adapter, not that it maps to exactly one
    Given the built-in block kinds
    When each kind's adapter is looked up
    Then it is one of the content adapters

  @test:scripts/tests/content-profiles.test.ts::profileAcceptsKind::paper_admits_everything_the_document_profile_does
  Scenario: The paper profile accepts every document kind
    Given the document block kinds
    Then the "paper" profile accepts each of them

  @test:scripts/tests/content-profiles.test.ts::profileAcceptsKind::document_rejects_every_math_kind
  Scenario: The document profile rejects every math kind
    Given the math block kinds
    Then the "document" profile accepts none of them

  @test:scripts/tests/content-profiles.test.ts::profileAcceptsKind::an_unknown_kind_is_admitted_by_no_profile
  Scenario: No profile accepts an unknown or empty kind
    Given every content profile
    Then none accepts "no-such-kind"
    And none accepts the empty string

  @test:scripts/tests/content-profiles.test.ts::profileAcceptsKind::PROFILE_BLOCK_KINDS_agrees_with_the_predicate
  Scenario: Each profile accepts every kind it lists
    Given every content profile and its listed block kinds
    Then the profile accepts each listed kind

  @test:scripts/tests/content-profiles.test.ts::kindsOutsideProfile::reports_math_kinds_against_the_document_profile,_de-duplicated
  Scenario: Math kinds are reported once against the document profile
    Given the kinds "prose", "theorem", "theorem" and "table"
    When the kinds outside the "document" profile are found
    Then the result is "theorem" alone

  @test:scripts/tests/content-profiles.test.ts::kindsOutsideProfile::reports_unknown_kinds_too,_whichever_profile_is_declared
  Scenario: Unknown kinds are reported against the paper profile
    Given the kinds "prose" and "value-set"
    When the kinds outside the "paper" profile are found
    Then the result is "value-set" alone

  @test:scripts/tests/content-profiles.test.ts::kindsOutsideProfile::known_kinds_come_back_in_BLOCK_KINDS_order,_unknown_ones_sorted_after
  Scenario: Outside kinds come in block-kind order with unknown kinds sorted after
    Given the kinds "proof", "zzz", "definition" and "aaa"
    When the kinds outside the "document" profile are found
    Then the result is "definition", "proof", "aaa", "zzz"

  @test:scripts/tests/content-profiles.test.ts::kindsOutsideProfile::a_conforming_corpus_reports_nothing
  Scenario: A corpus within its profile reports nothing
    When the document kinds are checked against the "document" profile
    Then nothing is reported
    And all built-in kinds checked against the "paper" profile report nothing

  @test:scripts/tests/content-profiles.test.ts::profileForContentType::only_the_exact_string_'document'_selects_the_narrower_profile
  Scenario: The content type "document" selects the document profile
    When the profile for content type "document" is chosen
    Then it is "document"

  @test:scripts/tests/content-profiles.test.ts::profileForContentType::anything_else_falls_back_to_paper_—_the_WIDER_profile,_on_purpose
  Scenario: Any other content type falls back to the paper profile
    When the profile is chosen for "paper", no content type, "Document" and "dak"
    Then each is "paper"
