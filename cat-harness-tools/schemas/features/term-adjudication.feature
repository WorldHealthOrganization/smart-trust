# Term adjudication records (schemas/content/term-adjudication.ts): the three outcomes for a
# term that disagrees with an authority, what is refused, and how check:term-mapping
# (scripts/check-term-mapping.ts) reads them. Each Scenario names the test that executes it.
Feature: Term adjudication outcomes

  @test:schemas/term-adjudication.test.ts::three_outcomes,_each_saying_what_is_written_and_where::every_outcome_has_its_row,_and_the_table_has_no_extra_rows
  Scenario: Every outcome has exactly one row saying what it writes and where
    Given the outcome list and the outcome-writes table
    Then the table's keys are exactly the outcomes
    And each row names at least one thing written and one place

  @test:schemas/term-adjudication.test.ts::three_outcomes,_each_saying_what_is_written_and_where::a_well-formed_record_of_each_outcome_parses
  Scenario: A well-formed record of each outcome parses
    Given a change-prose, a local-term and a vocabulary-wrong record for "kg-tools" term "participant" on "skos"
    When each is parsed
    Then all three succeed

  @test:schemas/term-adjudication.test.ts::what_is_refused::an_undetermined_subject:_a_terminology_nobody_reached_has_not_disagreed_(dh4f)
  Scenario: A subject the check could not determine is refused
    Given a vocabulary-wrong record whose observed exact and concept are both "undetermined"
    When it is parsed
    Then it fails

  @test:schemas/term-adjudication.test.ts::what_is_refused::an_exact_match:_that_is_agreement,_with_nothing_to_decide
  Scenario: A subject that already maps exactly is refused
    Given a vocabulary-wrong record whose observed exact and concept are both "mapped"
    When it is parsed
    Then it fails

  @test:schemas/term-adjudication.test.ts::what_is_refused::a_local_term_that_is_exactly_the_authority's_concept:_that_outcome_is_change-prose
  Scenario: A local term with an exactMatch relation is refused
    Given a local-term record whose relation is "exactMatch"
    When it is parsed
    Then it fails

  @test:schemas/term-adjudication.test.ts::what_is_refused::relatedMatch:_an_authored_term_cannot_carry_it,_so_the_outcome_could_not_be_written
  Scenario: A local term with a relatedMatch relation is refused
    Given a local-term record whose relation is "relatedMatch"
    When it is parsed
    Then it fails

  @test:schemas/term-adjudication.test.ts::what_is_refused::a_relation_with_no_concept,_and_a_concept_with_no_relation
  Scenario: A relation needs a concept and a concept needs a relation
    Given a local-term record with a narrowMatch relation and its concept removed
    When it is parsed
    Then it fails
    And a local term with relation "none" but a concept fails
    And a local term with relation "none" and no concept parses

  @test:schemas/term-adjudication.test.ts::what_is_refused::a_decision_with_no_reason,_or_a_blank_one
  Scenario: A decision with no reason or a blank reason is refused
    Given a vocabulary-wrong record with its reason removed
    When it is parsed
    Then it fails
    And with a reason of only spaces it fails too

  @test:schemas/term-adjudication.test.ts::what_is_refused::an_in-repo_`<scheme>:<id>`_where_an_IRI_is_required
  Scenario: An in-repo scheme:id where an IRI is required is refused
    Given a change-prose record whose concept is "platform:actor"
    When it is parsed
    Then it fails

  @test:schemas/term-adjudication.test.ts::what_is_refused::change-prose_that_names_no_changed_asset
  Scenario: Change-prose that names no changed asset is refused
    Given a change-prose record with an empty changed list
    When it is parsed
    Then it fails

  @test:schemas/term-adjudication.test.ts::what_is_refused::two_outcomes_for_one_disagreement_in_a_file
  Scenario: Two outcomes for one disagreement in a file are refused
    Given an adjudications file holding a change-prose and a vocabulary-wrong record for the same subject
    When it is parsed
    Then it fails
    And with the second record's target changed to "fhir" it parses

  @test:schemas/term-adjudication.test.ts::a_record_set_against_the_check's_current_answer::change-prose_is_applied_once_the_term_maps_exactly_or_is_gone,_pending_while_unchanged
  Scenario: Change-prose is applied once the term maps exactly or is gone, pending while unchanged
    Given a parsed change-prose record observed as exact "unmapped", concept "mapped"
    Then its status is "applied" when the term now maps exactly or has no observation
    And "pending" while the observation is unchanged
    And "stale" when the concept is now unmapped too

  @test:schemas/term-adjudication.test.ts::a_record_set_against_the_check's_current_answer::vocabulary-wrong_holds_while_the_observed_pair_holds,_and_is_stale_otherwise
  Scenario: Vocabulary-wrong holds while the observed pair holds, and is stale otherwise
    Given a parsed vocabulary-wrong record observed as exact "unmapped", concept "mapped"
    Then its status is "holds" against that same observation
    And "stale" when the term maps exactly or has no observation

  @test:schemas/term-adjudication.test.ts::check:term-mapping_reads_the_files_beside_the_schemes::no_file_is_zero_files,_not_a_failure
  Scenario: No adjudication file is zero files, not a failure
    Given a checkout whose layer declares a glossary directory holding no adjudication file
    When its adjudications are read
    Then the result is zero files, nothing invalid and no statuses

  @test:schemas/term-adjudication.test.ts::check:term-mapping_reads_the_files_beside_the_schemes::an_invalid_record_is_reported_with_its_path
  Scenario: An invalid adjudication record is reported with its path
    Given the glossary holds "x.term-adjudications.json" with a vocabulary-wrong record whose reason is empty
    When its adjudications are read
    Then exactly one invalid entry is reported
    And it names "x.term-adjudications.json"

  @test:schemas/term-adjudication.test.ts::check:term-mapping_reads_the_files_beside_the_schemes::a_valid_record_is_set_against_the_mappings_this_run_produced
  Scenario: A valid record is set against the mappings this run produced
    Given the glossary holds "x.term-adjudications.json" with a valid vocabulary-wrong record
    And this run produced a mapping for "participant" in "kg-tools" on "skos", exact "unmapped" and concept "mapped"
    When its adjudications are read
    Then the result is one file, nothing invalid, and "kg-tools/participant on skos" with status "holds"
