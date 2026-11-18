# scripts/summaries.ts drains agent summaries of prose blocks into each library
# entry's summaries.json sidecar, which a person reviews through scripts/narratives.ts.
# Each Scenario names the test that executes it.
Feature: Agent summaries of prose blocks

  @test:scripts/tests/block-summaries.test.ts::the_sidecar_validates,_and_refuses_records_that_mean_nothing::a_draft_by_an_agent_naming_its_model_validates
  Scenario: A draft by an agent naming its model validates
    Given a sidecar with one record whose narrative is an English draft by an agent with a model
    When it is parsed with the block summaries sidecar schema
    Then it parses

  @test:scripts/tests/block-summaries.test.ts::the_sidecar_validates,_and_refuses_records_that_mean_nothing::an_empty_slot_is_refused_—_no_record_already_means_not_summarised
  Scenario: A record with an empty narrative slot is refused
    Given a sidecar record whose narrative is text null in state "not-authored"
    When it is parsed with the block summaries sidecar schema
    Then it is refused

  @test:scripts/tests/block-summaries.test.ts::the_sidecar_validates,_and_refuses_records_that_mean_nothing::two_records_for_one_block_are_refused
  Scenario: Two records for one block are refused
    Given a sidecar holding the same record twice
    When it is parsed with the block summaries sidecar schema
    Then it is refused

  @test:scripts/tests/block-summaries.test.ts::the_sidecar_validates,_and_refuses_records_that_mean_nothing::the_hash_is_a_full_sha256
  Scenario: A source hash that is not a full sha256 is refused
    Given a sidecar record whose source_hash is "abc"
    When it is parsed with the block summaries sidecar schema
    Then it is refused

  @test:scripts/tests/block-summaries.test.ts::the_sidecar_validates,_and_refuses_records_that_mean_nothing::an_agent_draft_with_no_model_is_refused_—_inherited_from_the_attribution_schema
  Scenario: An agent draft with no model is refused
    Given a sidecar record drafted by an agent with an id and no model
    When it is parsed with the block summaries sidecar schema
    Then it is refused

  @test:scripts/tests/block-summaries.test.ts::the_sidecar_validates,_and_refuses_records_that_mean_nothing::every_committed_summaries.json_validates
  Scenario: Every committed summaries.json validates
    Given every library entry directory in the repository
    When each existing summaries.json is parsed with the sidecar schema
    Then at least one such file exists
    And every one of them parses

  @test:scripts/tests/block-summaries.test.ts::a_changed_source_reads_as_STALE,_not_as_right::editing_the_section's_text_marks_its_summary_stale_and_puts_it_back_in_the_queue
  Scenario: Editing a section's text marks its summary stale and requeues it
    Given an entry with prose sections a and b, both drafted
    When the text of section a is revised
    Then the backlog was empty before the edit
    And section a's status is "stale" while b's is still "draft"
    And the backlog is exactly block a

  @test:scripts/tests/block-summaries.test.ts::a_changed_source_reads_as_STALE,_not_as_right::a_front-matter-only_edit_is_NOT_a_change_of_text
  Scenario: A front-matter-only edit does not change the text
    Given an entry with section a drafted
    When only the title in section a's front matter is changed
    Then its status is still "draft"

  @test:scripts/tests/block-summaries.test.ts::a_changed_source_reads_as_STALE,_not_as_right::summaryStatus_compares_the_hash_—_the_mutation_target
  Scenario: summaryStatus compares the source hash
    Given a draft record hashed from the text "old"
    When summaryStatus is asked about various bodies
    Then it is "draft" for "old" and "stale" for "new"
    And a confirmed record over "new" is also "stale"
    And with no record it is "not-summarised" for text, "unreadable" for null and "empty" for an empty body

  @test:scripts/tests/block-summaries.test.ts::a_changed_source_reads_as_STALE,_not_as_right::the_review_queue_shows_a_stale_draft_as_stale,_and_refuses_to_confirm_it
  Scenario: The review queue shows a stale draft as stale and refuses to confirm it
    Given an entry with section a drafted, then its text changed
    When the review queue is listed
    Then it holds one summaries item, marked stale
    And confirming it throws an error mentioning "STALE"

  @test:scripts/tests/block-summaries.test.ts::a_changed_source_reads_as_STALE,_not_as_right::decide_re-checks_freshness_even_when_the_listing_said_fresh
  Scenario: decide re-checks freshness even when the listing said fresh
    Given an entry with section a drafted, listed in the review queue as not stale
    When section a's text changes after listing and a person confirms the item
    Then decide throws an error mentioning "STALE"

  @test:scripts/tests/block-summaries.test.ts::a_changed_source_reads_as_STALE,_not_as_right::a_fresh_draft_IS_confirmable_by_a_person,_and_then_leaves_the_backlog_as_confirmed
  Scenario: A fresh draft confirmed by a person leaves the backlog as confirmed
    Given an entry with section a drafted
    When a person confirms its queue item
    Then the decision's state is "confirmed"
    And the block's status is "confirmed"

  @test:scripts/tests/block-summaries.test.ts::an_agent_cannot_write_`confirmed`::record_refuses_a_draft_that_claims_any_state_but_draft
  Scenario: record refuses a draft claiming any state but draft
    Given a draft for section a
    When it is recorded with state "confirmed", and again with state "rejected"
    Then each attempt throws an error mentioning "only a person"
    And no summaries.json is written

  @test:scripts/tests/block-summaries.test.ts::an_agent_cannot_write_`confirmed`::the_schema_refuses_a_confirmation_by_an_agent
  Scenario: The narrative schema refuses a confirmation by an agent
    Given a confirmed narrative whose confirmer is an agent
    When it is parsed with the narrative schema
    Then it is refused

  @test:scripts/tests/block-summaries.test.ts::an_agent_cannot_write_`confirmed`::record_writes_drafts_only,_and_only_for_an_agent_naming_its_model
  Scenario: record writes drafts only, for an agent naming its model
    Given a draft for section a
    When it is recorded as drafted by a human, then by an agent with no model, then by the test agent
    Then the human attempt throws mentioning "AGENT"
    And the model-less agent attempt throws mentioning "model"
    And the written record holds one narrative in state "draft", lang "en", drafted by model "test-model"

  @test:scripts/tests/block-summaries.test.ts::an_agent_cannot_write_`confirmed`::record_stores_the_language_a_draft_names,_else_the_file's,_else_en_(e1lo)
  Scenario: record stores the draft's language, else the file's, else en
    # Gap: the fallback to "en" is not asserted here
    Given three fresh entries each with section a
    When one is recorded with file-level lang "fr", one with lang "fr" and per-draft lang "pt-BR", and one with lang "not a tag"
    Then the first stores "fr"
    And the second stores "pt-BR"
    And the third throws

  @test:scripts/tests/block-summaries.test.ts::an_agent_cannot_write_`confirmed`::record_refuses_a_hash_that_no_longer_matches_—_it_summarised_something_else
  Scenario: record refuses a source hash that no longer matches
    Given a draft for section a computed before its text changed to "Moved on."
    When it is recorded
    Then it throws an error mentioning "source_hash"

  @test:scripts/tests/block-summaries.test.ts::an_agent_cannot_write_`confirmed`::record_is_all-or-nothing
  Scenario: record is all-or-nothing
    Given drafts for sections a and b where b's source_hash is wrong
    When they are recorded
    Then it throws
    And no summaries.json is written

  @test:scripts/tests/block-summaries.test.ts::the_queue_leaves_out_blocks_that_already_have_a_current_summary::drafted_and_confirmed_are_out;_not-summarised,_stale_and_rejected_are_in
  Scenario: Drafted and confirmed blocks leave the queue; unsummarised, stale and rejected are in it
    # Gap: a stale block re-entering the queue is not exercised in this test
    Given an entry with sections a, b and c
    When a and b are drafted, then a person rejects b with the reason "too vague to be useful"
    Then the backlog starts with three blocks
    And after drafting it is exactly c
    And after the rejection it is b and c
    And the next item for b carries the rejection reason "too vague to be useful"

  @test:scripts/tests/block-summaries.test.ts::the_queue_leaves_out_blocks_that_already_have_a_current_summary::redrafting_a_rejected_block_keeps_the_rejection_under_`superseded`
  Scenario: Redrafting a rejected block keeps the rejection under superseded
    Given an entry with section a drafted and then rejected with reason "wrong"
    When a new draft "A better summary." is recorded
    Then the record's narrative is in state "draft"
    And its first superseded entry has rejection reason "wrong"

  @test:scripts/tests/block-summaries.test.ts::the_queue_leaves_out_blocks_that_already_have_a_current_summary::a_current_draft_is_never_overwritten_by_another
  Scenario: A current draft is never overwritten by another
    Given section a already recorded with a draft
    When the same draft is recorded again
    Then it throws an error mentioning "already has a current draft"

  @test:scripts/tests/block-summaries.test.ts::the_queue_leaves_out_blocks_that_already_have_a_current_summary::a_draft_in_another_language_is_added_beside_a_current_summary,_which_is_kept_(e1lo)
  Scenario: A draft in another language is added beside a current summary
    Given section a with a confirmed English summary and a French draft prepared beforehand
    When the French draft is recorded
    Then the narratives are "en:confirmed" and "fr:draft"
    And there is no superseded entry
    And recording the French draft again throws, naming "fr"
    And the backlog is empty

  @test:scripts/tests/block-summaries.test.ts::the_queue_leaves_out_blocks_that_already_have_a_current_summary::--lang_serves_summarised_blocks_missing_that_language,_with_their_current_summaries_(e1lo)
  Scenario: --lang serves summarised blocks missing that language, with their current summaries
    Given an entry with sections a, b and c, where a and b are drafted in English as "A summary."
    When the French translation backlog is read, and a French draft for a is recorded
    Then the French backlog is a and b, not the unsummarised c
    And the next French item names lang "fr" and carries summaries "en": "A summary."
    And after recording, the French backlog is b only and the English one is empty
    And the plain backlog is still c only
    And with no translation config the owed locales are ar, en, es, fr, ru and zh

  @test:scripts/tests/block-summaries.test.ts::the_queue_leaves_out_blocks_that_already_have_a_current_summary::an_empty_section_is_not_prose_to_summarise,_and_not_backlog
  Scenario: An empty section is neither prose to summarise nor backlog
    Given an entry with section a holding "A." and section e empty
    When its items are read and tallied
    Then e's status is "empty"
    And the backlog is exactly a
    And the tally counts prose 1, empty 1 and backlog 1

  @test:scripts/tests/block-summaries.test.ts::semantic_QA:_what_the_schema_cannot_see::a_record_for_a_block_that_is_not_there_is_a_broken_reference,_and_the_L1_gate_says_so
  Scenario: A record for a missing block is a broken reference the L1 gate reports
    Given a summaries.json whose record names a block "prose-gone" that does not exist
    When its sidecar defects and the entry's L1 check are read
    Then the first defect mentions "no such prose block"
    And the "block-summaries" requirement is "unmet"

  @test:scripts/tests/block-summaries.test.ts::semantic_QA:_what_the_schema_cannot_see::a_sidecar_naming_another_entry_is_a_defect
  Scenario: A sidecar naming another entry is a defect
    Given a summaries.json whose entry field is "other"
    When its sidecar defects are read
    Then the first defect mentions names entry "other"

  @test:scripts/tests/block-summaries.test.ts::semantic_QA:_what_the_schema_cannot_see::a_backlog_is_advisory:_met,_with_the_count_in_the_detail
  Scenario: A summary backlog is advisory and reported in the detail
    Given an entry with two unsummarised prose sections
    When the entry's L1 check is read
    Then the "block-summaries" requirement is "met"
    And its detail mentions "backlog 2"

  @test:scripts/tests/block-summaries.test.ts::the_viewer_carries_the_extract_AND_the_summary::a_summarised_prose_block_projects_both,_and_an_unsummarised_one_says_so
  Scenario: The viewer projects both extract and summary, or says a block is unsummarised
    Given an entry with section a drafted as "Alpha, summarised." and section b unsummarised
    When its blocks are read for the viewer
    Then a's content is the full section text and its summary text is "Alpha, summarised."
    And a's summary status is "draft", drafted by agent "claude-code" with model "test-model"
    And b's content is "Beta." and its summary is only status "not-summarised"

  @test:scripts/tests/block-summaries.test.ts::the_viewer_carries_the_extract_AND_the_summary::the_committed_projection_of_the_drained_entry_carries_both
  Scenario: The built projection of the drained entry carries extract and summary
    # Skipped: when the site's library projection for arxiv-2312.07755v1 has not been built
    Given the site's library projection of the entry arxiv-2312.07755v1
    When its prose blocks are read
    Then at least one has both content and summary text

  @test:scripts/tests/block-summaries.test.ts::the_real_backlog_—_not_vacuous,_and_it_adds_up::backlog_>_0_and_backlog_===_prose_-_summarised
  Scenario: The real backlog is non-empty and equals prose blocks minus summarised ones
    Given a walk of every non-held library entry's files that shares no code with summaries.ts
    When the tally of all entry items is compared with it
    Then the backlog is greater than zero
    And the prose and summarised counts agree with the walk
    And the backlog equals prose minus summarised, and the backlog list has that length
    And at least one block is summarised

  @test:scripts/tests/block-summaries.test.ts::a_library_whose_owner_holds_summaries_back_(bean_x80s)::is_named_as_held,_and_the_drain_never_offers_its_blocks
  Scenario: A library held back by its owner is never offered to the drain
    Given the repository's held libraries
    When the next 10000 drain items and the entry directories are listed
    Then an entry ending "arxiv-2607.25032v1" is held
    And no drain item belongs to a held library
    And no entry directory lies inside a held library
