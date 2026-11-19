# narratives:migrate-lang (e1lo 3d) turns a single narrative into a one-entry
# list naming its language, and changes nothing else in the file. Each
# Scenario names the test that executes it.
Feature: Migrating narratives to language-tagged lists

  @test:scripts/tests/narratives-migrate-lang.test.ts::narratives:migrate-lang_(e1lo_3d)::a_written_single_narrative_becomes_a_one-entry_list_naming_its_language,_and_nothing_else_changes
  Scenario: A written single narrative becomes a one-entry list naming its language
    Given a file with a draft narrative and other fields
    When it is migrated for en
    Then one narrative is converted, its list holds the draft with lang en, and every other field is unchanged

  @test:scripts/tests/narratives-migrate-lang.test.ts::narratives:migrate-lang_(e1lo_3d)::every_slot_of_an_images_sidecar_and_a_summaries_file_is_converted
  Scenario: Every slot of an images sidecar and a summaries file is converted
    Then an images sidecar with one narrated image converts 1
    And a summaries file with two narratives converts 2, the second tagged en

  @test:scripts/tests/narratives-migrate-lang.test.ts::narratives:migrate-lang_(e1lo_3d)::an_empty_not-authored_slot_and_an_existing_list_are_left_as_they_are
  Scenario: An empty not-authored slot and an existing list are left as they are
    Then a not-authored slot is skipped and the text unchanged
    And an existing list is counted as already a list and the text unchanged

  @test:scripts/tests/narratives-migrate-lang.test.ts::narratives:migrate-lang_(e1lo_3d)::a_file_written_with_\u_escapes_keeps_them
  Scenario: A file written with \u escapes keeps them
    Given a file whose narrative spells an em dash as the escape \u2014
    When it is migrated for en
    Then one narrative is converted, the text still holds \u2014, and no literal em dash appears

  @test:scripts/tests/narratives-migrate-lang.test.ts::narratives:migrate-lang_(e1lo_3d)::a_number_written_the_Python_way_(`338.0`,_`1e-05`)_keeps_its_spelling
  Scenario: A number written the Python way keeps its spelling
    Given a file holding 48.96, 338.0 and 1e-05
    When it is migrated
    Then one is converted, the three numbers keep their spelling, and the narrative is tagged en

  @test:scripts/tests/narratives-migrate-lang.test.ts::narratives:migrate-lang_(e1lo_3d)::every_number_Python's_json_writes_survives:_its_repr,_not_JavaScript's
  Scenario: Every number Python's json writes survives
    Given a file holding numbers as Python's json writes them, including -0.0, 1e+20 and an integer past 2^53
    When it is migrated
    Then one is converted and the text before the narrative is byte for byte unchanged

  @test:scripts/tests/narratives-migrate-lang.test.ts::narratives:migrate-lang_(e1lo_3d)::a_file_in_neither_JSON_style_is_refused,_unchanged
  Scenario: A file in neither JSON style is refused, unchanged
    Given a file written on one line
    When it is migrated
    Then it is refused naming the round-trip, and the text is unchanged
