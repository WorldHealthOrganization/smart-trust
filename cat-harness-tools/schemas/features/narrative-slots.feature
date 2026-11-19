# schemas/content/block-summary.ts and schemas/library/tabular-csvw.ts let a narrative slot hold one
# narrative or one per language, and a block summary's status reads every language.
# Each Scenario names the test that executes it.
Feature: Narrative slots take one narrative per language

  @test:schemas/narrative-slots.test.ts::a_summary's_status_reads_every_language::a_one-entry_list_reads_as_its_one_narrative
  Scenario: A one-entry narrative list reads as its one narrative
    Given a block summary whose narrative is a list holding one confirmed "en" entry
    When its status is read against the unchanged body
    Then the status is "confirmed"

  @test:schemas/narrative-slots.test.ts::a_summary's_status_reads_every_language::confirmed_only_when_every_language_is
  Scenario: A summary is confirmed only when every language is confirmed
    Given a block summary with confirmed "en" and confirmed "fr" narratives
    Then its status is "confirmed"
    And with confirmed "en" and draft "fr" the status is "draft"

  @test:schemas/narrative-slots.test.ts::a_summary's_status_reads_every_language::rejected_when_any_language_is
  Scenario: A summary is rejected when any language is rejected
    Given a block summary with confirmed "en" and rejected "fr" narratives
    When its status is read against the unchanged body
    Then the status is "rejected"

  @test:schemas/narrative-slots.test.ts::a_summary's_status_reads_every_language::FALSIFIED:_a_list_entry_that_is_not-authored_is_refused,_as_the_single_form_is
  Scenario: A list entry in the not-authored state is refused
    Given a narrative list holding a draft "en" entry and an "fr" entry with null text and state "not-authored"
    When the block summary is parsed
    Then parsing fails

  @test:schemas/narrative-slots.test.ts::an_optional_slot_takes_a_per-language_list::tabular-csvw:_a_list_parses;_a_list_missing_a_lang_does_not
  Scenario: A tabular CSVW narrative list parses only when every entry has a language
    Given a valid tabular-csvw record with one table
    When it is parsed with a narrative list of draft "en" and draft "fr" entries
    Then parsing succeeds
    And with the "fr" entry's lang removed parsing fails
