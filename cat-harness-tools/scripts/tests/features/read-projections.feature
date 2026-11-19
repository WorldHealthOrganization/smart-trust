# Projected reads (owner card Q-SPD-9b A): a writer is keyed only on the part
# of a hub file its reader uses, and only when every open of the file was
# reported. Each Scenario names the test that executes it.
Feature: A writer is keyed on the projection of a file its reader uses

  @test:scripts/tests/read-projections.test.ts::PROJECTIONS::declaration-name_keeps_only_whether_it_parses_and_its_name
  Scenario: declaration-name keeps only whether the file parses and its name
    Then two nameless documents project alike, as do two documents named "a"
    And documents named "a" and "b" project differently
    And unparseable text projects to "unparseable", unlike "{}"

  @test:scripts/tests/read-projections.test.ts::PROJECTIONS::nested-directories_keeps_directories_as_written,_and_nothing_else
  Scenario: nested-directories keeps only the directories as written
    Then documents differing only in @context and @graph project alike
    And documents whose directory paths differ project differently

  @test:scripts/tests/read-projections.test.ts::PROJECTIONS::mount-location_keeps_where_the_mount_lives,_not_its_tip_or_files
  Scenario: mount-location keeps where the mount lives, not its tip or files
    Then two mount records differing only in tip project alike
    And two differing in "into" project differently

  @test:scripts/tests/read-projections.test.ts::PROJECTIONS::projectedReads_counts_reports_per_path,_and_drops_a_path_reported_under_two_projections
  Scenario: Projected reads are counted per path, and a path under two projections is dropped
    Given report lines naming a.json twice under declaration-name, b.json under two projections, and an unrelated line
    Then a.json is declaration-name with count 2
    And b.json has no projection with count 2

  @test:scripts/tests/read-projections.test.ts::writerRecordOf_with_projected_reads::a_file_every_open_of_which_was_reported_is_keyed_on_its_projection;_one_opened_more_often_is_keyed_in_full
  Scenario: A fully reported file is keyed on its projection; one opened more often is keyed in full
    Given report.json opened once and reported once, and twice.json opened twice and reported once
    Then report.json is keyed on declaration-name and twice.json in full
    When report.json changes outside its name
    Then the writer still skips
    When twice.json changes
    Then the writer runs because "twice.json changed"
    When report.json gains a name
    Then the writer runs because "report.json changed"
    When report.json is removed
    Then the writer runs

  @test:scripts/tests/read-projections.test.ts::writerRecordOf_with_projected_reads::a_projection_this_version_does_not_know_never_matches
  Scenario: An unknown projection never matches
    Given a writer record keyed on a projection this version does not know
    Then the writer does not skip

  @test:scripts/tests/read-projections.test.ts::parseTrace_countOpens::counts_successful_opens_for_reading_of_the_paths_asked_for,_and_only_those
  Scenario: Only successful reading opens of the asked-for paths are counted
    Given a trace with two opens of a.json, a failed open and a stat of b.json, and an open of c.json
    When it is parsed counting opens of a.json and b.json
    Then a.json is opened 2 times and b.json 0 times

  @test:scripts/tests/read-projections.test.ts::the_real_readers,_under_a_real_strace::instance_discovery_reads_a_build_report_only_for_its_name,_so_the_report_keeps_a_writer's_skip
  Scenario: Instance discovery reads a build report only for its name
    Given a build report and a script that runs declaration discovery over the build directory, under strace
    Then the script exits 0 and the trace is complete
    And the report is read once under declaration-name, opened once, and keyed on that projection

  @test:scripts/tests/read-projections.test.ts::mount-from-lock's_restated_report::writes_the_same_line_projectedRead_does
  Scenario: mount-from-lock's restated report matches projectedRead
    When mount-from-lock reports a mount location read and projectedRead reports the same path as mount-location
    Then the two trace lines are identical

  @test:scripts/tests/read-projections.test.ts::a_trace_too_long_to_spread_into_push()_is_read_without_overflowing_the_stack
  Scenario: A trace too long to spread into push() is read
    Given a trace file of 1,000,000 projected lines
    Then the trace is complete and 1,000,000 projected lines are read
