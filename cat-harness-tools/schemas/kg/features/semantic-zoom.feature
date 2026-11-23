# Specifies schemas/kg/semantic-zoom.ts (CRDM Q4: folio default, a kind may
# override): the semantic-zoom schema, zoomThresholdFor and rendersAvatar.
Feature: The zoom threshold is declared by the folio, overridable per kind, and traceable

  @test:schemas/kg/semantic-zoom.test.ts::inherit_everything,_override_anything::a_kind_that_states_nothing_takes_the_folio's_number
  Scenario: A kind with no override takes the folio's threshold
    Given a declaration of belowPx 120 with an override of 260 for "table"
    When the threshold for "prose" is resolved
    Then it is 120 from the source "folio"

  @test:schemas/kg/semantic-zoom.test.ts::inherit_everything,_override_anything::a_kind_that_states_one_takes_its_own
  Scenario: A kind with an override takes its own threshold
    Given the same declaration
    When the threshold for "table" is resolved
    Then it is 260

  @test:schemas/kg/semantic-zoom.test.ts::inherit_everything,_override_anything::a_declaration_with_NO_overrides_is_complete,_not_incomplete
  Scenario: A declaration with no overrides is complete
    Given a declaration of belowPx 100 and an empty byKind
    Then it parses
    And the threshold for any kind resolves to 100

  @test:schemas/kg/semantic-zoom.test.ts::inherit_everything,_override_anything::an_UNKNOWN_kind_resolves_rather_than_throwing
  Scenario: An undeclared kind resolves to the folio's threshold
    When the threshold for "kind-nobody-declared" is resolved
    Then its source is "folio"

  @test:schemas/kg/semantic-zoom.test.ts::an_inherited_value_is_still_a_fact_somebody_must_be_able_to_trace::the_resolver_says_WHERE_the_number_came_from
  Scenario: The resolver names the source of the threshold
    Then the source for "prose" is "folio"
    And the source for "table" is "kind"

  @test:schemas/kg/semantic-zoom.test.ts::an_inherited_value_is_still_a_fact_somebody_must_be_able_to_trace::an_override_carries_its_reason,_and_the_default_carries_none
  Scenario: An override carries its reason and the default carries none
    Then the resolved "table" threshold carries the reason "a dense table is noise long before a title is"
    And the resolved "prose" threshold carries no reason

  @test:schemas/kg/semantic-zoom.test.ts::an_inherited_value_is_still_a_fact_somebody_must_be_able_to_trace::an_override_WITHOUT_a_reason_does_not_validate
  Scenario: An override without a reason is refused
    Given a declaration whose "table" override has no because
    When it is parsed
    Then it is refused

  @test:schemas/kg/semantic-zoom.test.ts::an_inherited_value_is_still_a_fact_somebody_must_be_able_to_trace::an_empty_reason_is_no_reason
  Scenario: An override with an empty reason is refused
    Given a declaration whose "table" override has because ""
    When it is parsed
    Then it is refused

  @test:schemas/kg/semantic-zoom.test.ts::the_boundary_is_stated_once::strictly_below_—_the_declared_number_still_shows_words
  Scenario: Avatars render strictly below the threshold
    Given the folio threshold of 120
    Then "prose" renders an avatar at 119 px
    And not at 120 or 121 px

  @test:schemas/kg/semantic-zoom.test.ts::the_boundary_is_stated_once::a_kind's_override_moves_the_boundary,_not_just_the_number
  Scenario: A kind's override moves the avatar boundary
    When rendering at 200 px
    Then "table", with its override of 260, renders an avatar
    And "prose", at the folio's 120, does not

  @test:schemas/kg/semantic-zoom.test.ts::the_document_declares_what_it_is::no_tag,_no_document
  Scenario: A declaration without its $schema tag is refused
    Given { belowPx: 120 } with no $schema
    When it is parsed
    Then it is refused

  @test:schemas/kg/semantic-zoom.test.ts::the_document_declares_what_it_is::the_folio_default_is_REQUIRED_—_nothing_is_ever_unstated
  Scenario: The folio threshold is required
    Given a tagged declaration with byKind but no belowPx
    When it is parsed
    Then it is refused

  @test:schemas/kg/semantic-zoom.test.ts::the_document_declares_what_it_is::a_zero_or_negative_threshold_is_refused
  Scenario: A zero or negative threshold is refused
    Given tagged declarations with belowPx 0 and -1
    When each is parsed
    Then each is refused

  @test:schemas/kg/semantic-zoom.test.ts::the_document_declares_what_it_is::byKind_defaults_to_empty,_so_a_minimal_declaration_parses
  Scenario: byKind defaults to empty
    Given a tagged declaration of belowPx 90 and no byKind
    When it is parsed
    Then its byKind is empty
