# Agent-drafted, human-confirmed narratives (beans ju0u, 04vl): the state
# machine, the review queue, and where a decision lands. Each Scenario names
# the test that executes it.
Feature: Narratives drafted by agents and confirmed by people

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::only_`not-authored`_has_no_text
  Scenario: Only not-authored has no text
    Then the not-authored record is valid
    And a draft with null text, and a not-authored record with text, are refused

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::anything_written_records_who_wrote_it
  Scenario: Anything written records who wrote it
    Then a draft with no drafted_by is refused

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::AN_AGENT_CANNOT_CONFIRM_ITS_OWN_DRAFT
  Scenario: An agent cannot confirm its own draft
    Then a confirmation by an agent or by a script is refused
    And a confirmation by a human is accepted

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::a_rejection_must_say_why
  Scenario: A rejection must say why
    Then a rejection with no reason or an empty reason is refused
    And one with a listed reason is accepted

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::a_narrative_cannot_be_both_confirmed_and_rejected
  Scenario: A narrative cannot be both confirmed and rejected
    Then a confirmed record carrying rejection fields is refused

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::an_agent_draft_still_needs_its_model_—_inherited_from_`iqim`
  Scenario: An agent draft needs its model
    Then a draft by an agent with no model is refused

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::`STATES_WITH_TEXT`_is_derived,_so_a_new_state_forces_the_question
  Scenario: STATES_WITH_TEXT is derived from the states
    Then it is every narrative state except not-authored

  @test:scripts/tests/narratives.test.ts::the_state_machine_refuses_records_that_mean_nothing::only_`confirmed`_reads_as_confirmed
  Scenario: Only confirmed reads as confirmed
    Then a confirmed record is confirmed, and not-authored, draft and rejected are not
    And a draft awaits confirmation while not-authored does not

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::a_flat_document_yields_one,_at_`narrative`
  Scenario: A flat document yields one narrative at narrative
    Then a document with a one-entry narrative list yields it at narrative[0] with its language

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::an_images_sidecar_yields_one_per_DESCRIBED_image,_with_its_id
  Scenario: An images sidecar yields one per described image, with its id
    Given three images, the first and third described
    Then two narratives are found, at images[0] and images[2], with subjects a and c

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::a_CSVW_record_yields_one_per_transcribed_TABLE,_named_by_its_label
  Scenario: A CSVW record yields one per transcribed table, named by its label
    Given three tables, the first labelled and the third unlabelled, both narrated
    Then two narratives are found, at tables[0] and tables[2], with subjects "Table 1" and the third table's URL

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::the_index_is_the_image's_POSITION,_not_the_narrative's_ordinal
  Scenario: The index is the image's position
    Given only the third image is described
    Then its narrative's path is images[2]

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::both_shapes_at_once_are_both_returned
  Scenario: Both shapes at once are both returned
    Then a document with a top-level narrative and a described image yields both

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::a_document_with_neither_yields_a_DETERMINED_empty
  Scenario: A document with neither shape yields a determined empty
    Then a sidecar with no images, an empty images list, and images null each yield none

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::a_malformed_narrative_is_skipped_rather_than_half-read
  Scenario: A malformed narrative is skipped
    Then a narrative that is not a list, an image whose narrative is a string, and images that are not objects each yield none

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::a_vector-figures_sidecar_yields_one_per_described_figure,_with_its_id
  Scenario: A vector-figures sidecar yields one per described figure
    Then figures with one described yield it at figures[0] with its id and language

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::figure_descriptions_are_keyed_by_document,_which_becomes_the_item's_slug
  Scenario: Figure descriptions are keyed by document, which becomes the slug
    Then a description of Figure 2 under doc-a yields it with subject "Figure 2" and slug doc-a

  @test:scripts/tests/narratives.test.ts::`narrativesIn`_reads_both_shapes_and_says_where_each_one_sits::`images.json`_is_in_the_bearing_list_—_necessary,_and_on_its_own_useless
  Scenario: images.json is in the narrative-bearing list
    Then the narrative-bearing files include images.json

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::a_draft_appears;_settled_and_empty_ones_do_not
  Scenario: The queue offers a draft and not settled or empty ones
    Given library entries holding a draft, a confirmed, a rejected and an empty narrative
    When the queue is read
    Then only the draft's entry is offered

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::a_library-level_figure_description_is_offered,_under_its_document,_and_a_decision_lands_on_it
  Scenario: A library-level figure description is offered and a decision lands on it
    Given library/figure-descriptions.json holding a draft for Figure 2 of doc-a
    When the queue is read it offers it under doc-a, from that file
    And when it is confirmed, the stored narrative is confirmed by the human

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::a_paged_entry's_transcribed_table_is_offered,_and_a_decision_lands_on_the_table
  Scenario: A paged entry's transcribed table is offered and a decision lands on the table
    Given a paged entry whose tabular.csvw.json narrates Table 1
    When the queue is read it offers Table 1 under the entry, as many items as drafts found on disk
    And when it is confirmed, the table's stored narrative is confirmed by the human

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::a_summary's_SUPERSEDED_history_is_not_awaiting_anyone_—_by_the_queue_or_by_the_walk
  Scenario: A summary's superseded history is not awaiting anyone
    Given a summary with a draft and a superseded older draft
    Then the queue holds one item and the walk of the JSON counts one draft

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::a_REJECTED_draft_is_never_re-offered
  Scenario: A rejected draft is never re-offered
    Given an entry whose narrative was rejected
    Then the queue is empty

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::an_unparseable_file_is_skipped_rather_than_crashing_the_queue
  Scenario: An unparseable file is skipped
    Given one good entry and one whose file is not JSON
    Then the queue offers only the good one

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::no_library_at_all_is_an_empty_queue,_not_a_crash
  Scenario: No library at all is an empty queue
    Given an instance declaring no directories
    Then the queue is empty

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::THE_REAL_CORPUS'S_DRAFTS_ARE_VISIBLE_—_the_zero_this_asserted_was_blindness
  Scenario: The real corpus's drafts are visible to the queue
    When the queue of the harness is read
    Then its length equals the drafts counted by walking every JSON file of every declared library
    And it is more than zero

  @test:scripts/tests/narratives.test.ts::the_queue_shows_exactly_what_is_waiting_on_a_person::every_draft_in_a_multi-narrative_file_names_its_SUBJECT
  Scenario: Every draft in a multi-narrative file names its subject
    When the harness queue is read
    Then every item whose path is deeper than one step has a subject

  @test:scripts/tests/narratives.test.ts::deciding_writes_the_file,_and_validates_before_it_does::confirming_records_the_HUMAN_and_the_time
  Scenario: Confirming records the human and the time
    Given one draft in the queue
    When it is confirmed by a human at a given time
    Then the record is confirmed by that human at that time, still drafted by the agent
    And the stored record is valid and the queue is empty

  @test:scripts/tests/narratives.test.ts::deciding_writes_the_file,_and_validates_before_it_does::rejecting_keeps_the_reason
  Scenario: Rejecting keeps the reason
    When the draft is rejected with a listed reason
    Then the record is rejected with that reason and keeps its text

  @test:scripts/tests/narratives.test.ts::deciding_writes_the_file,_and_validates_before_it_does::an_invalid_decision_NEVER_reaches_the_file
  Scenario: An invalid decision never reaches the file
    Then a rejection with no reason throws saying it must say why, leaving the file unchanged
    And a confirmation by an agent throws naming human, leaving the file unchanged

  @test:scripts/tests/narratives.test.ts::a_decision_lands_on_the_PICTURE_the_reviewer_saw::confirming_the_second_draft_writes_`images[2]`_and_leaves_its_siblings_alone
  Scenario: Confirming the second draft writes images[2] and leaves its siblings alone
    Given an images sidecar describing images a and c
    When the second queue item is confirmed
    Then image c's narrative is confirmed, a's is still a draft, b has none, no top-level narrative appears, and only a is queued

  @test:scripts/tests/narratives.test.ts::a_decision_lands_on_the_PICTURE_the_reviewer_saw::the_rest_of_the_sidecar_survives_the_rewrite
  Scenario: The rest of the sidecar survives the rewrite
    When the first draft of the sidecar is confirmed
    Then the schema, doc_id, and every image's id, role and page are unchanged

  @test:scripts/tests/narratives.test.ts::a_decision_lands_on_the_PICTURE_the_reviewer_saw::a_path_into_nothing_is_REFUSED_rather_than_brought_into_being
  Scenario: A path into nothing is refused
    Given a queue item whose path points at images[9]
    When it is confirmed
    Then it throws saying the path does not exist, and both drafts are still queued

  @test:scripts/tests/narratives.test.ts::a_decision_lands_on_the_PICTURE_the_reviewer_saw::rejecting_one_draft_does_not_settle_the_others
  Scenario: Rejecting one draft does not settle the others
    When the first draft of the sidecar is rejected
    Then only c is queued

  @test:scripts/tests/narratives.test.ts::the_review_step_is_selection,_not_typing::every_rejection_reason_is_reachable_by_NUMBER
  Scenario: The rejection reasons exist and none is empty
    Then there is at least one rejection reason and each is non-empty
    # Gap: the title says each reason is reachable by number; only that the list and its entries are non-empty is checked.

  @test:scripts/tests/narratives.test.ts::the_review_step_is_selection,_not_typing::a_decision_is_one_word_and_one_number_—_measured,_not_asserted_vaguely
  Scenario: A decision costs one word and one number
    Then the confirm and reject command strings written in the test take only a number, and a flag and number, past the script name
    # Gap: can never fail — it slices string literals the test itself defines and checks Number.isInteger(i + 1) over array indexes; no CLI is consulted.

  @test:scripts/tests/narratives.test.ts::the_review_step_is_selection,_not_typing::a_bad_selection_says_the_range_rather_than_acting
  Scenario: A bad selection is not acted on
    When the narratives CLI is asked to confirm items 0, 99 and x
    Then each exits non-zero
    # Gap: the title says the CLI states the range; the message is not checked, and a non-zero exit also follows from the non-interactive reviewer refusal.

  @test:scripts/tests/narratives.test.ts::the_review_step_is_selection,_not_typing::a_rejection_with_no_reason_is_refused_at_the_CLI_too
  Scenario: A rejection with no reason is refused at the CLI
    When the narratives CLI is asked to reject item 1 with no reason
    Then it exits non-zero
    # Gap: the reason for the refusal is not checked; the non-interactive reviewer refusal alone would also exit non-zero.

  @test:scripts/tests/narratives.test.ts::an_agent_cannot_record_itself_as_the_human_—_the_hole_the_tool_itself_opened::`reviewer()`_refuses_outside_a_terminal
  Scenario: reviewer() refuses outside a terminal
    Then asking for the reviewer non-interactively throws naming non-interactive

  @test:scripts/tests/narratives.test.ts::an_agent_cannot_record_itself_as_the_human_—_the_hole_the_tool_itself_opened::the_test_suite_itself_has_no_terminal,_which_is_the_point
  Scenario: The test suite has no terminal
    Then the terminal check reads false under the test runner

  @test:scripts/tests/narratives.test.ts::an_agent_cannot_record_itself_as_the_human_—_the_hole_the_tool_itself_opened::a_scripted_decision_must_supply_the_reviewer_explicitly
  Scenario: A scripted decision must supply the reviewer
    When a draft is confirmed with no reviewer given
    Then it throws naming non-interactive

  @test:scripts/tests/narratives.test.ts::an_agent_cannot_record_itself_as_the_human_—_the_hole_the_tool_itself_opened::the_CLI_refuses_and_leaves_the_record_untouched
  Scenario: The CLI refuses without a terminal
    Given a fixture library with one draft
    When the narratives CLI is asked to confirm item 1 from the harness
    Then it exits non-zero and the fixture's record is unchanged
    # Gap: the CLI runs against the harness, not the fixture, so the "record untouched" check reads a file the CLI never sees and cannot fail.

  @test:scripts/tests/narratives.test.ts::a_slot_with_one_narrative_per_language::yields_one_item_per_language,_each_at_its_own_index
  Scenario: A slot with one narrative per language yields one item each
    Then an English and a French narrative yield items at narrative[0] and narrative[1] with their languages

  @test:scripts/tests/narratives.test.ts::a_slot_with_one_narrative_per_language::inside_an_images_sidecar_too,_keeping_the_image's_id
  Scenario: Per-language narratives inside an images sidecar keep the image's id
    Then an image with English and French narratives yields both, each with subject fig-1

  @test:scripts/tests/narratives.test.ts::a_slot_with_one_narrative_per_language::a_list_that_breaks_the_slot_rules_is_skipped,_not_half-read
  Scenario: A list that breaks the slot rules is skipped
    Then a list with two French narratives yields none

  @test:scripts/tests/narratives.test.ts::a_slot_with_one_narrative_per_language::confirming_the_French_one_writes_the_French_one,_and_the_English_draft_is_untouched
  Scenario: Confirming the French one leaves the English draft untouched
    Given an entry with English and French drafts
    When the French queue item is confirmed
    Then the stored English narrative is still a draft and the French one is confirmed
