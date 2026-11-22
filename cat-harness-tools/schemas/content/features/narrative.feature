# Specifies schemas/content/narrative.ts, one narrative per language (bean
# cat-tools-e1lo, owner ruling 2026-10-20): NarrativeSchema's lang,
# NarrativeSlotSchema (the empty slot, or a list with one entry per language),
# narrativesOfSlot, and narrativeFor, the one entry a single-text display shows.
Feature: A narrative names its language, and a slot holds one per language

  @test:schemas/content/narrative.test.ts::a_narrative_names_its_language::a_BCP_47_tag_is_accepted,_with_or_without_subtags
  Scenario: A BCP 47 tag is accepted, with or without subtags
    Given draft narratives with the lang "en", "fr", "zh-Hant" and "pt-BR"
    When each is parsed with the narrative schema
    Then each is accepted

  @test:schemas/content/narrative.test.ts::a_narrative_names_its_language::a_written_narrative_must_name_its_language;_the_empty_slot_claims_none_(stage_4,_ruling_1A)
  Scenario: A written narrative must name its language; the empty slot names none
    Given a draft narrative with no lang, one with "en", and the not-authored narrative
    When each is parsed with the narrative schema
    Then the one with no lang is refused
    And the one with "en" and the not-authored narrative are accepted

  @test:schemas/content/narrative.test.ts::a_narrative_names_its_language::something_that_is_not_a_language_tag_is_refused
  Scenario: Something that is not a language tag is refused
    Given draft narratives with the lang "English", "en_US", "e" and "EN"
    When each is parsed with the narrative schema
    Then each is refused

  @test:schemas/content/narrative.test.ts::a_slot_holds_one_narrative,_or_one_per_language::the_bare_object_is_the_empty_slot_only;_a_written_one_must_be_a_list_(stage_4)
  Scenario: Only the empty slot may be a bare object
    Given the not-authored narrative, and draft narratives with and without a lang, each bare
    When each is parsed as a slot
    Then the not-authored slot reads back as the list holding only the not-authored narrative
    And both bare drafts are refused

  @test:schemas/content/narrative.test.ts::a_slot_holds_one_narrative,_or_one_per_language::a_list_with_one_entry_per_language_parses,_and_reads_back_in_order
  Scenario: A list with one entry per language reads back in order
    Given a slot listing drafts in "en" then "fr"
    When it is parsed and read
    Then the languages read back are "en", "fr"

  @test:schemas/content/narrative.test.ts::a_slot_holds_one_narrative,_or_one_per_language::FALSIFIED:_a_list_entry_with_no_`lang`_is_refused
  Scenario: A list entry with no lang is refused
    Given a slot listing a draft in "en" and a draft with no lang
    When it is parsed as a slot
    Then it is refused

  @test:schemas/content/narrative.test.ts::a_slot_holds_one_narrative,_or_one_per_language::FALSIFIED:_the_same_language_twice_is_refused
  Scenario: The same language twice is refused
    Given a slot listing two drafts in "fr"
    When it is parsed as a slot
    Then it is refused

  @test:schemas/content/narrative.test.ts::a_slot_holds_one_narrative,_or_one_per_language::an_empty_list_is_refused:_no_narrative_is_`not-authored`,_not_`[]`
  Scenario: An empty list is refused
    Given the empty list
    When it is parsed as a slot
    Then it is refused

  @test:schemas/content/narrative.test.ts::a_slot_holds_one_narrative,_or_one_per_language::each_entry_is_still_a_narrative:_an_agent_cannot_confirm,_whatever_the_language
  Scenario: An entry confirmed by an agent is refused
    Given a slot listing a draft in "en" and an entry in "fr" in the state "confirmed", confirmed by an agent
    When it is parsed as a slot
    Then it is refused

  @test:schemas/content/narrative.test.ts::narrativeFor:_the_one_entry_a_single-text_display_shows_(locale_match,_else_first)::the_reader's_language_wins,_exactly_and_case-insensitively
  Scenario: The reader's language wins, exactly and case-insensitively
    Given a slot with entries in "en", "fr-CA" and "pt"
    When the entry is chosen for the locale "pt", and for "FR-ca"
    Then they are the "pt" and "fr-CA" entries

  @test:schemas/content/narrative.test.ts::narrativeFor:_the_one_entry_a_single-text_display_shows_(locale_match,_else_first)::a_regional_locale_finds_its_language,_and_a_language_finds_its_regional_entry
  Scenario: A regional locale finds its language, and a language its regional entry
    Given a slot with entries in "en", "fr-CA" and "pt"
    When the entry is chosen for the locale "en-GB", and for "fr"
    Then they are the "en" and "fr-CA" entries

  @test:schemas/content/narrative.test.ts::narrativeFor:_the_one_entry_a_single-text_display_shows_(locale_match,_else_first)::no_locale,_or_one_the_slot_does_not_hold,_gives_the_first_entry
  Scenario: No locale, or one the slot does not hold, gives the first entry
    Given a slot with entries in "en", "fr-CA" and "pt"
    When the entry is chosen with no locale, and for "ar"
    Then both are the "en" entry

  @test:schemas/content/narrative.test.ts::narrativeFor:_the_one_entry_a_single-text_display_shows_(locale_match,_else_first)::the_empty_slot_is_returned_as_it_is
  Scenario: The empty slot gives the not-authored narrative
    Given the not-authored slot
    When the entry is chosen for "fr"
    Then it is the not-authored narrative
