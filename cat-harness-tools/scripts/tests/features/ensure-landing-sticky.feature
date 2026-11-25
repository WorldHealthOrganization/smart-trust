# scripts/ensure-landing-sticky.ts declares an instance's folio graph by a surgical text edit and writes the landing stickies its
# layers contribute; repeated runs change nothing, and a sticky records the harness's initiation status as a receipt.
# Each Scenario names the test that executes it.
Feature: Ensure the landing stickies and folio declaration

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::every_byte_outside_the_insertion_is_unchanged
  Scenario: Inserting the folio entry keeps every original line of the declaration
    Given a committed-style declaration that is ASCII-escaped, 2-space indented and carries a "_comment"
    When the folio directory entry is inserted into it
    Then the added lines mention "folio"
    And the kept lines still include the "_comment"
    And every original line other than a closing brace is still present

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::the_escapes_survive_verbatim
  Scenario: ASCII escapes in the declaration survive the insertion verbatim
    Given the committed-style declaration with "—" and " " escapes
    When the folio directory entry is inserted into it
    Then the result still contains "—" and " "
    And it contains neither a literal em dash nor a literal no-break space

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::the_result_is_still_valid_JSON,_with_the_entry_present
  Scenario: The edited declaration is valid JSON that declares the folio
    Given the committed-style declaration with one directory
    When the folio directory entry is inserted into it
    Then the result parses as JSON with 2 directories
    And it declares a folio

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::a_second_insertion_is_a_NO-OP,_byte_for_byte
  Scenario: Inserting the folio entry a second time leaves the text identical
    Given the declaration with the folio entry already inserted
    When the folio directory entry is inserted again
    Then the text is byte for byte the same

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::a_bracket_inside_a_prose_comment_does_not_shift_the_match
  Scenario: A bracket inside a prose comment does not misplace the insertion
    Given the declaration whose "_comment" contains "[bracket]" and a stray "]"
    When the folio directory entry is inserted
    Then the result parses as JSON with 2 directories

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::an_escaped_quote_inside_a_string_does_not_end_it_early
  Scenario: An escaped quote inside a string does not misplace the insertion
    Given the declaration whose name contains escaped quotes
    When the folio directory entry is inserted
    Then the result parses as JSON with 2 directories

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::an_empty_directories_array_is_handled
  Scenario: The folio entry can be inserted into an empty directories array
    Given the declaration with "directories": []
    When the folio directory entry is inserted
    Then the result parses as JSON with 1 directory

  @test:scripts/tests/ensure-landing-sticky.test.ts::the_declaration_is_edited_surgically,_not_re-serialised::toAsciiJson_escapes_non-ASCII_and_leaves_ASCII_alone
  Scenario: toAsciiJson escapes non-ASCII and leaves ASCII alone
    When an object holding an em dash is serialised with toAsciiJson
    Then the output contains "—"
    When an object holding "plain" is serialised with toAsciiJson
    Then the output contains "plain" as written

  @test:scripts/tests/ensure-landing-sticky.test.ts::running_it_twice_changes_nothing::the_second_run_reports_`already`_on_both_halves
  Scenario: A second run reports already for the declaration and every sticky
    Given an instance declaring the stickies "landing", "cat-harness" and "subgraphs"
    When the landing stickies are ensured for the first time
    Then the folio declaration is "added" and all three stickies are "written", in that order
    When they are ensured again with a later clock
    Then the folio declaration is "already" and all three stickies are "already"

  @test:scripts/tests/ensure-landing-sticky.test.ts::running_it_twice_changes_nothing::the_sticky's_createdAt_is_the_FIRST_run's,_not_the_second's
  Scenario: A sticky keeps the createdAt of the first run
    Given an instance ensured at "2026-09-20T00:00:00Z"
    When it is ensured again at "2027-01-01T00:00:00Z"
    Then the landing sticky's createdAt is still "2026-09-20T00:00:00Z"

  @test:scripts/tests/ensure-landing-sticky.test.ts::running_it_twice_changes_nothing::the_declaration_is_written_once_and_not_grown
  Scenario: The declaration is not changed by a second run
    Given an instance ensured once
    When it is ensured again with a later clock
    Then the declaration file is byte for byte unchanged

  @test:scripts/tests/ensure-landing-sticky.test.ts::running_it_twice_changes_nothing::the_sticky_it_writes_is_a_valid_LandingSticky
  Scenario: The written landing sticky is a valid LandingSticky
    Given an instance ensured once
    When its landing sticky file is read
    Then it parses against the LandingSticky schema

  @test:scripts/tests/ensure-landing-sticky.test.ts::running_it_twice_changes_nothing::the_instance's_own_description_is_what_the_sticky_carries
  Scenario: The landing sticky carries the instance's own description
    Given an instance whose description is "one line", a blank line and a no-break space before "c@t-harness"
    When it is ensured and its landing sticky is read
    Then the sticky's comment is that description, no-break space included

  @test:scripts/tests/ensure-landing-sticky.test.ts::running_it_twice_changes_nothing::`--check`_reports_without_writing
  Scenario: A check reports what is missing without writing
    Given a fresh instance
    When the landing stickies are checked
    Then the folio declaration is reported as "added"
    And the declaration file is unchanged

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_malformed_sticky_is_repaired,_not_fatal::initiation_overwrites_unparseable_content
  Scenario: An unparseable sticky is overwritten with a valid one
    Given an instance ensured once whose landing sticky file is then replaced with "{ not json"
    When it is ensured again
    Then the landing sticky is reported as "updated"
    And the file now parses as a valid LandingSticky

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_malformed_sticky_is_repaired,_not_fatal::an_instance_with_no_description_falls_back_to_its_name
  Scenario: An instance with no description falls back to its name
    Given the declaration with its description removed
    When its stickies are composed
    Then the first sticky's comment is "a-folio"
    And the declaration still names "a-folio"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_malformed_sticky_is_repaired,_not_fatal::a_declaration_that_already_declares_a_folio_elsewhere_is_respected
  Scenario: A folio already declared at another path is respected
    Given a declaration with a "content" directory at "authored/" carrying the "folio" graph typology
    When the landing stickies are ensured
    Then the folio declaration is "already"
    And the folio directory is "authored/"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_malformed_sticky_is_repaired,_not_fatal::...including_one_still_spelling_the_field_the_pre-2026-09-21_way
  Scenario: A folio declared with the legacy "graphs" field is respected
    Given a declaration with a "content" directory at "authored/" whose legacy "graphs" field lists "folio"
    When the landing stickies are ensured
    Then the folio declaration is "already"
    And the folio directory is "authored/"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_nested_instance_contributes_its_own_stickies::the_nested_instance_is_DISCOVERED,_not_named_by_the_outer_one
  Scenario: A nested instance is discovered by its own declaration
    Given an outer layer that declares "inner/skills/" and an inner layer declared at "inner/"
    When the contributing roots are found
    Then they are the inner root then the outer root

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_nested_instance_contributes_its_own_stickies::a_declared_directory_of_the_instance_ITSELF_is_not_a_second_contributor
  Scenario: A plain declared subdirectory is not a second contributor
    Given a layer "only" declaring a "sub/" directory with no declaration of its own
    When the contributing roots are found
    Then the only root is the layer itself

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_nested_instance_contributes_its_own_stickies::both_layers'_cards_are_composed,_each_carrying_its_OWN_description
  Scenario: Each layer's card carries its own description
    Given the outer layer with card "landing" and the nested inner layer with card "inner-card"
    When the declared contributions are composed
    Then the card ids are "landing" then "inner-card"
    And their descriptions are "the outer layer" then "the inner layer"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_nested_instance_contributes_its_own_stickies::the_nested_layer's_declared_order_places_it,_not_its_depth
  Scenario: Cards are placed by declared order, not nesting depth
    Given the outer card with order 10 and the inner card with order 90
    When the declared contributions are composed
    Then their orders come out as 10 then 90

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_nested_instance_contributes_its_own_stickies::the_written_board_holds_one_file_per_contributed_sticky,_each_in_its_own_instance's_folio_directory
  Scenario: Each contributed sticky is written to its own layer's folio directory
    Given the outer layer and the nested inner layer
    When the landing stickies are ensured
    Then the reported stickies are "landing" then "inner-card", each file a valid LandingSticky with the matching id
    And the outer folio holds the "landing" card and not the "inner-card" card
    And "inner/folio" holds the "inner-card" card, contributed by "inner"
    And reading the landing stickies gives "landing" then "inner-card"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_nested_instance_contributes_its_own_stickies::an_instance_contributing_NO_stickies_gets_an_empty_board,_not_a_default_one
  Scenario: An instance declaring no stickies gets an empty board
    Given a layer "quiet" that declares no stickies
    When its contributions are composed and its landing stickies ensured
    Then both are empty

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::absent_is_NOT_ok_—_a_card_nothing_reported_on_carries_no_status
  Scenario: A sticky nothing reported on carries no initiation status
    Given an instance with cards "landing" and "other"
    When the landing stickies are ensured with no initiation
    Then the landing sticky has no initiation

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::`--begin`_marks_it_running,_with_a_start_time_and_no_completion
  Scenario: Beginning an initiation marks the sticky running
    Given an instance with cards "landing" and "other"
    When the landing stickies are ensured at "2026-09-20T01:00:00.000Z" with a begin for "a-folio"
    Then the landing sticky's initiation status is "running"
    And it started at "2026-09-20T01:00:00.000Z" and has no completedAt

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::`--complete`_PRESERVES_the_start_time_rather_than_overwriting_it
  Scenario: Completing an initiation keeps its start time
    Given an instance whose initiation began at "2026-09-20T01:00:00.000Z"
    When it is completed at "2026-09-20T01:05:00.000Z"
    Then the landing sticky's initiation status is "ok"
    And startedAt is still "2026-09-20T01:00:00.000Z" and completedAt is "2026-09-20T01:05:00.000Z"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::a_completion_with_no_begin_is_recorded,_not_refused
  Scenario: A completion without a begin is still recorded
    Given an instance with no initiation begun
    When an initiation for "a-folio" is completed
    Then the landing sticky's initiation status is "ok"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::a_failure_carries_what_failed_—_the_schema_refuses_one_that_does_not
  Scenario: A failed initiation carries its detail, and the schema requires one
    Given an instance with cards "landing" and "other"
    When an initiation is completed as "failed" with detail "skills/ did not resolve"
    Then the landing sticky's initiation detail contains "skills/"
    And the Initiation schema rejects a "failed" status with no detail

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::a_finished_initiation_must_carry_completedAt;_only_`running`_may_omit_it
  Scenario: Only a running initiation may omit completedAt
    When the Initiation schema parses status "ok" with only a startedAt
    Then it is rejected
    When it parses status "running" with only a startedAt
    Then it is accepted

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::EVERY_card_of_that_harness_gets_the_status_—_one_initiation,_one_harness
  Scenario: Every card of the harness gets the initiation status
    Given an instance with cards "landing" and "other"
    When an initiation for "a-folio" is completed
    Then both cards carry initiation status "ok"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::a_status_survives_a_plain_rebuild_rather_than_being_reset
  Scenario: An initiation status survives a plain rebuild
    Given an instance whose initiation for "a-folio" completed
    When the landing stickies are ensured again with no initiation
    Then the landing sticky's initiation status is still "ok"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_sticky_is_an_initiation_RECEIPT::argv_parsing:_begin,_complete,_failure_with_a_detail
  Scenario: Initiation options are parsed from argv
    When "--begin boot" is parsed
    Then it gives a begin for harness "boot"
    When "--complete boot" is parsed
    Then it gives a complete for "boot" with status "ok"
    When "--complete boot --failed --detail why" is parsed
    Then it gives a complete for "boot" with status "failed" and detail "why"
    When only "--check" is parsed
    Then no initiation is given

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_harness_sticky_shows_the_landing's_text,_not_the_author's_(ob3m_3)::`bodyFrom:_summary`_writes_the_summary_and_the_Also_written_list,_and_no_rationale
  Scenario: A summary-bodied card shows the summary and the Also written list
    Given a declaration with a summary, two alsoWritten spellings, a rationale description and a landing card with bodyFrom "summary"
    When the landing stickies are ensured
    Then the card's comment is the summary followed by "Also written: `a-f0lio`, `a@folio`"
    And it does not contain the rationale
    And no reader-text problems are reported

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_harness_sticky_shows_the_landing's_text,_not_the_author's_(ob3m_3)::a_card_that_shows_the_description_when_a_summary_is_declared_is_a_finding
  Scenario: A card showing the description when a summary exists is a finding
    Given the same declaration but with the landing card's bodyFrom set to "description"
    When the landing stickies are ensured and reader-text problems are checked
    Then exactly one problem is reported
    And it names the card's "folio/" sticky file and says to use bodyFrom "summary"

  @test:scripts/tests/ensure-landing-sticky.test.ts::a_harness_sticky_shows_the_landing's_text,_not_the_author's_(ob3m_3)::no_summary_falls_back_to_the_description,_as_the_landing_does
  Scenario: A summary-bodied card with no summary falls back to the description
    Given a declaration with only the description "Only a description." and a card with bodyFrom "summary"
    When the landing stickies are ensured
    Then the card's comment is "Only a description."
    And no reader-text problems are reported
