# Re-ingestion extracts figures, tables, references and glossary, or says it did not
# (owner, 2026-11-14). Each Scenario names the test that executes it.
Feature: Re-ingestion extraction coverage

  @test:scripts/tests/library/reingest-extraction.test.ts::vector_figures_become_figure_blocks::a_kept_vector_figure_gets_a_block_beside_the_raster_ones,_with_its_narrative
  Scenario: A kept vector figure is a figure block with its narrative
    Given an entry whose vector-figures.json keeps a figure on page 4 with a narrative, and a raster figure on page 2
    When its library nodes are built
    Then blocks/figure-vfig-p004.jsonld is a figure block over ../figures/vfig-p004.png carrying the narrative
    And the section holding page 4 contains it, beside the raster figure's block

  @test:scripts/tests/library/reingest-extraction.test.ts::vector_figures_become_figure_blocks::an_uninspected_or_unrendered_vector_render_is_not_a_figure_block
  Scenario: An uninspected or unrendered vector render is not a figure
    Given a vector render with role undetermined and one with no file
    When the library nodes are built
    Then neither has a figure block

  @test:scripts/tests/library/reingest-extraction.test.ts::the_library_index_counts_figures_apart_from_images::an_entry_with_one_raster_image_and_fifteen_vector_figures_reads_images_1,_figures_15
  Scenario: Images and figures are counted apart
    Given an entry with one raster logo and fifteen vector figures
    When the library index is read
    Then the entry reads images 1 and figures 15

  @test:scripts/tests/library/reingest-extraction.test.ts::the_extraction_record_says_which_steps_ran::a_step_is_found_N,_partial,_none_or_not_extracted_—_and_says_why_when_it_is_partial_or_did_not_run
  Scenario: An extraction step's state is consistent with its count
    Given extraction steps in each state
    Then found needs a count above 0, none no count above 0, and partial or not-extracted a note

  @test:scripts/tests/library/reingest-extraction.test.ts::the_extraction_record_says_which_steps_ran::an_absent_artefact_observes_nothing,_and_an_unnamed_kind_is_not_extracted
  Scenario: A refused contents tree is undetermined and a missing kind is not extracted
    Given a structure whose inferred contents fell below the 0.6 floor and no tables record
    When its extraction is observed
    Then contents are partial with the rung's reason
    And tables and glossary are not extracted, never none

  @test:scripts/tests/library/reingest-extraction.test.ts::the_extraction_record_says_which_steps_ran::a_recorded_none_is_kept_apart_from_never_ran_—_in_the_shape_the_viewer_reads
  Scenario: None is a recorded fact, in the viewer's shape
    Given the table step recorded it found no table
    Then tables read none while references read not extracted
    And the record declares folio-library-extraction/v1

  @test:scripts/tests/library/reingest-extraction.test.ts::the_extraction_record_says_which_steps_ran::a_staged_record_takes_this_run's_steps,_then_the_artefacts,_then_the_destination's_other_kinds
  Scenario: A re-ingest keeps a later reader's record
    Given a destination entry whose references were extracted by another layer's reader
    When a re-ingest writes its staged record
    Then references keep their count, figures come from the fresh artefacts, and tables from this run's step

  @test:scripts/tests/library/reingest-extraction.test.ts::L1_completeness_reports_extraction_as_advice,_never_as_a_failure::a_paged_entry_carries_one_advisory_per_kind_and_the_requirements_and_verdict_are_unchanged
  Scenario: L1 completeness reports extraction per kind without gating
    Given a paged entry
    When L1 completeness is checked
    Then it carries one advisory per kind: contents, sections, figures, tables, references, glossary, footnotes, summaries
    And no requirement and no committed verdict changes because of them

  @test:scripts/tests/library/reingest-extraction.test.ts::L1_completeness_reports_extraction_as_advice,_never_as_a_failure::the_record_is_a_declared_sidecar,_not_a_stray
  Scenario: extraction.json is a declared sidecar
    Given an entry holding extraction.json
    Then its contents requirement is met

  @test:scripts/tests/library/reingest-extraction.test.ts::the_table_arm_writes_CSVW_drafts,_guarded::the_drafts_are_a_valid_CSVW_record_that_the_viewer_reads
  Scenario: Extracted tables are CSVW drafts the viewer reads
    Given pdf-tables.py found a captioned table
    When the arm writes it
    Then tabular.csvw.json validates and readEntryTables reads its label, columns, rows and pages

  @test:scripts/tests/library/reingest-extraction.test.ts::the_table_arm_writes_CSVW_drafts,_guarded::prose_cut_into_columns_is_no_table,_and_is_counted_apart
  Scenario: Prose a column split cut through is not drafted as a table
    When a candidate's cell boundaries cut a word at a quarter or more of at least five boundaries
    Then it is not drafted, and the record's note counts it apart from the other dropped candidates

  @test:scripts/tests/library/reingest-extraction.test.ts::the_table_arm_writes_CSVW_drafts,_guarded::a_failure_is_recorded_as_not_extracted_and_the_arm_does_not_throw
  Scenario: A table step that fails records not extracted
    Given a PDF the table step cannot read
    When the arm runs
    Then tables are recorded not extracted and nothing is written

  @test:scripts/tests/library/reingest-extraction.test.ts::the_table_arm_writes_CSVW_drafts,_guarded::a_transcription_the_destination_holds_is_kept,_never_overwritten
  Scenario: A checked transcription is never overwritten
    Given the destination entry already holds a tabular.csvw.json
    When the arm runs
    Then it writes no tables and records the kept count

  @test:scripts/tests/library/reingest-extraction.test.ts::references_and_glossary_run_through_an_optional_pipeline_slot::the_slot_is_optional,_so_a_full_checkout_is_not_required_to_fill_it
  Scenario: The library-entry-arms slot is optional
    Then library-entry-arms is an optional pipeline slot, not one every checkout must fill

  @test:scripts/tests/library/reingest-extraction.test.ts::references_and_glossary_run_through_an_optional_pipeline_slot::with_no_layer_filling_it,_each_kind_is_recorded_not_extracted_—_and_a_reader's_earlier_record_survives
  Scenario: With no reader mounted, references and glossary say so
    Given no layer fills the library-entry-arms slot and references were recorded earlier
    When the arms run after promotion
    Then glossary is recorded not extracted naming the slot, and references keep their record

  @test:scripts/tests/library/reingest-extraction.test.ts::references_and_glossary_run_through_an_optional_pipeline_slot::an_arm_that_throws_is_recorded_not_extracted,_and_the_next_arm_still_runs
  Scenario: A failing reader does not stop the next
    Given a references arm that throws and a glossary arm that finds seven terms
    When the arms run
    Then references are not extracted with the error and glossary is found 7

  @test:scripts/tests/library/reingest-extraction.test.ts::counts_that_say_what_the_source_holds_(re-ingest_pilot,_2026-11-14)::footnotes_count_only_the_notes_a_mark_calls
  Scenario: Footnotes are the notes a mark calls
    When the footnote arm links some notes to marks and keeps other foot-of-page lines
    Then the count is the linked notes; with none linked and lines left over, the step is partial with no count

  @test:scripts/tests/library/reingest-extraction.test.ts::counts_that_say_what_the_source_holds_(re-ingest_pilot,_2026-11-14)::a_re-run_over_a_promoted_entry_takes_the_artefacts_over_the_entry's_old_record
  Scenario: Re-running the record over a promoted entry
    When the record is rebuilt in the entry it describes after its sidecars changed
    Then each kind the artefacts show is taken from them, and the kinds they do not show keep their record

  @test:scripts/tests/library/reingest-extraction.test.ts::the_extraction_record_is_a_node_kind::its_validator_judges_a_record_as_the_writer's_schema_does:_strict,_and_each_step's_rules_apply
  Scenario: The extraction record is a node kind
    Given the library kind's family folio-library-extraction/v1 and its validator node
    When a record is judged by the node kind the validator names
    Then a record the writer's schema accepts passes, and one with an unknown key or a found step with no count fails
