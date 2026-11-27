# Specifies schemas/sdlc/qa-axis.ts: the QA axes, the one vocabulary for
# counts, and what an instance declares about its QA writers (owner,
# 2026-11-24, the integrated QA page).
Feature: QA axes and one vocabulary for counts

  @test:schemas/sdlc/qa-axis.test.ts::normalizeCounts:_one_vocabulary::`totals`_and_`counts`,_`n/a`_and_`na`,_read_alike
  Scenario: Every spelling of a count reads alike
    Then "n/a" and "na" both read as n/a, and "passed", "errors" and "warnings" as pass, fail and warn

  @test:schemas/sdlc/qa-axis.test.ts::normalizeCounts:_one_vocabulary::nothing_recognised_is_undefined,_never_all-zero
  Scenario: Counts nobody took are not zero
    Then an object with no recognised key has no counts at all

  @test:schemas/sdlc/qa-axis.test.ts::normalizeCounts:_one_vocabulary::adding_keeps_never-counted_apart_from_zero
  Scenario: Adding counts keeps never-counted apart from zero
    Then adding a zero fail keeps it, and adding nothing changes nothing

  @test:schemas/sdlc/qa-axis.test.ts::axisOf::a_declared_writer's_glob_wins_over_the_format
  Scenario: A declared writer decides its files' axis
    Then a KG-format file a Lean writer declares is on the Lean axis

  @test:schemas/sdlc/qa-axis.test.ts::axisOf::schema,_then_path
  Scenario: The format decides, then the path
    Then a translation record, a KG sidecar, a node-view report and a render report land on their axes, and an unknown file on none

  @test:schemas/sdlc/qa-axis.test.ts::axisOf::globs:_`*`_stays_in_a_segment,_`**`_crosses_them
  Scenario: Writer globs
    Then "*" matches within a segment and "**" across segments

  @test:schemas/sdlc/qa-axis.test.ts::summarizeQaDoc::kg-qa_totals
  Scenario: A KG record is summarised from its totals
    Then its subject, axis and counts are read

  @test:schemas/sdlc/qa-axis.test.ts::summarizeQaDoc::block-qa:_the_newest_reviewer_entry_per_criterion
  Scenario: A block record counts each criterion's newest verdict
    Then a criterion with no entry is unknown

  @test:schemas/sdlc/qa-axis.test.ts::summarizeQaDoc::qa-results:_a_family_with_findings_fails
  Scenario: A whole-artefact result counts its families
    Then a family holding findings fails and an empty one passes

  @test:schemas/sdlc/qa-axis.test.ts::summarizeQaDoc::an_unknown_format_with_no_counts_has_none
  Scenario: An unknown format is not counted
    Then a record with no counts in any spelling has none

  @test:schemas/sdlc/qa-axis.test.ts::QaDeclarationSchema::accepts_writers_and_axes,_refuses_a_twice-declared_writer_and_an_unknown_axis
  Scenario: What an instance may declare
    Then writers and axes are accepted, a writer id twice and an axis outside the list are refused

  @test:schemas/sdlc/qa-axis.test.ts::the_instance_declaration_carries_`qa`_and_a_visualiser's_`sections`::a_section_names_another_visualiser_of_the_same_harness
  Scenario: A visualiser's sections name other visualisers of its harness
    Then a section naming a declared visualiser is accepted, and one naming itself or nothing is refused

  @test:schemas/sdlc/qa-axis.test.ts::the_instance_declaration_carries_`qa`_and_a_visualiser's_`sections`::`qa`_is_read_through_its_own_schema
  Scenario: The declaration's qa is checked
    Then a declared axis on the list is accepted and one outside it refused
