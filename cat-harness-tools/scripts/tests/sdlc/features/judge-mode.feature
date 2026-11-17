# Judge mode: each writer-only gate (check-wireframes, check-layout-norms, check-rendered-labels, check-source-licence,
# check-methodology-evidence, check-lane-documentation, kg-export, check-avatar-coverage, check-harness-state) can fail on
# what it computes, exits on scripts/qa-results.ts's table (0 ok, 1 finding, 2 unknown or error), and writes nothing.
# Each Scenario names the test that executes it.
Feature: Judge mode for the writer-only gates

  @test:scripts/tests/sdlc/judge-mode.test.ts::the_shared_judge_(qa-results.ts)::four_states,_one_exit_table_—_could-not-determine_is_never_0
  Scenario: Four judgement states map to one exit table, and undetermined is never 0
    Given the shared judgement exit table
    Then it maps "ok" to 0, "finding" to 1, "unknown" to 2 and "error" to 2
    And no failures judge "ok" and three failures judge "finding"
    And an undetermined result judges "unknown", even with three failures beside it

  @test:scripts/tests/sdlc/judge-mode.test.ts::the_shared_judge_(qa-results.ts)::an_unknown_flag_is_a_usage_error_(2),_so_a_typo_never_runs_the_WRITER
  Scenario: An unknown flag is a usage error
    Given the arguments "--check" and "--chek"
    Then "--chek" is reported as the unknown flag
    And "--check", an allowed "--strict" and a positional argument report none
    And judge usage of "--check --update" returns 2
    And judge usage of "--check" alone returns nothing

  @test:scripts/tests/sdlc/judge-mode.test.ts::the_shared_judge_(qa-results.ts)::concludeJudgement_returns_the_table's_exit_and_writes_nothing
  Scenario: concludeJudgement returns the table's exit and creates no sidecar
    Given an empty directory with no committed sidecar
    When a "finding" judgement is concluded against it
    Then the exit is 1
    And no sidecar file was created

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:wireframes::CORRUPTED:_a_wireframe_with_no_intent_and_a_ref_nothing_declares_→_exit_1
  Scenario: A wireframe covering a ref nothing declares judges to exit 1
    # Gap: the missing intent is not asserted on its own
    Given a wireframe index whose wireframe "ghost" covers "no/such/ref.html"
    When the wireframes are checked
    Then at least one unknown ref is reported
    And the judgement exits 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:wireframes::clean_report_→_0;_nothing_declared_→_2
  Scenario: A clean wireframe report exits 0 and an empty one exits 2
    Given a wireframe report with one declared ref, covered, and no problems
    Then its judgement exits 0
    And the same report with nothing declared or covered exits 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:wireframes::CLI_judge_mode_writes_nothing_and_agrees_with_the_in-process_judgement
  Scenario: check-wireframes in judge mode writes nothing and agrees with the in-process judgement
    Given this checkout
    When check-wireframes.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And its exit equals the in-process judgement's exit

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:layout-norms::CORRUPTED:_a_nested_declaration_not_in_the_baseline_→_exit_1
  Scenario: A nested directory declaration not in the baseline judges to exit 1
    Given an instance declaring "skills/" and "skills/voices/", and no baseline
    When the layout norms are checked and judged
    Then the exit is 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:layout-norms::clean_fixture_→_0;_no_instance_at_all_→_2
  Scenario: Clean layout norms exit 0 and a root with no instance exits 2
    Given an instance declaring the separate directories "a/" and "b/"
    Then its layout-norms judgement exits 0
    And an empty root's judgement exits 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:layout-norms::CLI_judge_mode_writes_nothing_—_not_the_sidecar,_not_the_baseline
  Scenario: check-layout-norms in judge mode writes neither the sidecar nor the baseline
    Given this checkout and its layout-norms baseline
    When check-layout-norms.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And the baseline file is unchanged
    And its exit equals the in-process judgement's exit

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:layout-norms::CLI_refuses_the_writer's_--update_in_judge_mode_(2),_and_writes_nothing
  Scenario: check-layout-norms refuses --update in judge mode
    When check-layout-norms.ts runs with "--check --update"
    Then it exits 2
    And neither its sidecar nor git status changed

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:rendered-labels::CORRUPTED:_a_double-escaped_label_beyond_the_baseline_→_exit_1
  Scenario: A double-escaped SVG label beyond the baseline judges to exit 1
    Given a repository whose workflow SVG has the label "x&amp;#10;y", and no baseline
    When the rendered labels are checked and judged
    Then the exit is 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:rendered-labels::clean_fixture_→_0;_no_SVG_→_2
  Scenario: Clean rendered labels exit 0 and no SVG exits 2
    Given a repository whose workflow SVG has the label "plain"
    Then its rendered-labels judgement exits 0
    And a repository with no SVG judges to exit 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:rendered-labels::CLI_on_this_checkout:_exit_0_and_no_tracked-file_change
  Scenario: check-rendered-labels on this checkout exits 0 and writes nothing
    When check-rendered-labels.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And it exits 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:source-licence::CORRUPTED:_`stated`_with_no_basis_→_exit_1
  Scenario: A licence record stated with no basis judges to exit 1
    Given a library source whose licence record is "stated" as "CC-BY-4.0" with no basis
    When the source licences are checked
    Then one malformed record is reported
    And the judgement exits 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:source-licence::CORRUPTED:_a_manifest_that_will_not_parse_→_exit_1
  Scenario: A source manifest that will not parse judges to exit 1
    Given a library source whose manifest reads "{ not json"
    When the source licences are checked and judged
    Then the exit is 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:source-licence::clean_fixture_→_0_(absence_is_reported,_not_gated);_no_library_entry_→_2
  Scenario: A source with no licence record exits 0 and an empty library exits 2
    Given a library source whose manifest has no licence record
    Then its source-licence judgement exits 0
    And a root with no library entry judges to exit 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:source-licence::CLI_on_this_checkout:_exit_0_and_no_tracked-file_change_(bean_i2kp)
  Scenario: check-source-licence on this checkout exits 0 and writes nothing
    When check-source-licence.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And it exits 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:methodology-evidence::CORRUPTED:_an_`evidence`_ref_no_library_holds_→_exit_1
  Scenario: A methodology evidence ref no library holds judges to exit 1
    Given a valid methodology whose evidence names "library/no-such-source"
    When the methodology evidence is checked
    Then one unresolved ref is reported
    And the judgement exits 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:methodology-evidence::CORRUPTED:_front_matter_that_does_not_validate_→_exit_1
  Scenario: Methodology front matter that does not validate judges to exit 1
    Given a methodology whose front matter has the name "Not Kebab" and nothing else required
    When the methodology evidence is checked and judged
    Then the exit is 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:methodology-evidence::clean_fixture_→_0,_and_1_only_under_--strict;_no_methodology_graph_→_2
  Scenario: A methodology with no evidence exits 0, or 1 under strict, and no methodology graph exits 2
    Given a valid methodology with no evidence
    When the methodology evidence is checked
    Then one methodology without evidence is reported
    And the judgement exits 0
    And the strict judgement exits 1
    And a root with no methodology graph judges to exit 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:methodology-evidence::CLI_on_this_checkout:_exit_0_and_no_tracked-file_change
  Scenario: check-methodology-evidence on this checkout exits 0 and writes nothing
    When check-methodology-evidence.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And it exits 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:lane-documentation::CORRUPTED:_a_task-containing_lane_with_no_documentation_→_exit_1
  Scenario: A lane holding a task with no documentation judges to exit 1
    Given a BPMN diagram whose lane "Reviewer" holds task "T" and has no documentation
    When the lanes are checked
    Then one undocumented lane is reported
    And the judgement exits 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:lane-documentation::clean_fixture_→_0;_zero_diagrams_→_2_(the_writer_has_always_said_1_—_never_0)
  Scenario: Documented lanes exit 0 and no diagrams exit 2
    Given a BPMN diagram whose lane "Reviewer" is documented
    When the lanes are checked
    Then one diagram is counted
    And the judgement exits 0
    And a repository with no diagram judges to exit 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:lane-documentation::CLI_on_this_checkout:_exit_0_and_no_tracked-file_change
  Scenario: check-lane-documentation on this checkout exits 0 and writes nothing
    When check-lane-documentation.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And it exits 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::kg:export:judge::CORRUPTED:_an_undeclared_term,_a_root_field,_a_collision_→_exit_1_each
  Scenario: An undeclared term, an undeclared root field or a collision each judges to exit 1
    Given an otherwise clean knowledge-graph export summary
    Then one undeclared term judges to exit 1
    And one undeclared root field judges to exit 1
    And one collision judges to exit 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::kg:export:judge::an_unread_source_is_UNKNOWN_(2)_—_a_partial_graph_has_not_been_judged_whole
  Scenario: An unread source makes the export judgement unknown
    Given a knowledge-graph export summary with one problem reading a source
    Then the judgement exits 2
    And it still exits 2 with an undeclared term beside it
    And a clean summary exits 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::kg:export:judge::CLI_on_this_checkout:_exit_0,_no_sidecar_written,_no_`_kg/`_document_written
  Scenario: kg-export in judge mode on this checkout exits 0 and writes nothing
    When kg-export.ts runs with "--judge"
    Then neither its sidecar nor git status changed
    And the "_kg/" listing is unchanged
    And it exits 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::kg:export:judge::CLI_refuses_a_writer's_flag_in_judge_mode_(2)
  Scenario: kg-export refuses a writer's flag in judge mode
    When kg-export.ts runs with "--judge --out /dev/null"
    Then it exits 2
    And neither its sidecar nor git status changed

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:avatar-coverage::CORRUPTED:_a_stylesheet_that_carries_no_trash_rule_→_exit_1
  Scenario: An avatar stylesheet with no trash rule judges to exit 1
    Given the rendered avatar stylesheet with its data-fa-trash rule removed
    Then the trash derivation is reported absent
    And the avatar-coverage judgement exits 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:avatar-coverage::CORRUPTED:_a_required_kind_with_no_avatar_→_exit_1
  Scenario: A required kind with no avatar judges to exit 1
    Given the computed avatar coverage with a planted required kind "zzz-kind-with-no-art" listed as missing
    Then its judgement exits 1
    And the unplanted coverage judges to exit 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:avatar-coverage::an_empty_required_set_is_UNKNOWN_(2),_never_full_coverage
  Scenario: An empty required set of avatar kinds is unknown
    Given avatar coverage with no required, missing, orphaned or declared kinds
    Then its judgement exits 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:avatar-coverage::CLI_on_this_checkout:_exit_0_and_no_tracked-file_change_(`--check`_used_to_write)
  Scenario: check-avatar-coverage on this checkout exits 0 and writes nothing
    When check-avatar-coverage.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And it exits 0

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:harness-state::CORRUPTED:_a_family_with_a_finding_→_exit_1
  Scenario: A harness-state family with a finding judges to exit 1
    Given one harness-state family with a planted finding
    Then its judgement exits 1

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:harness-state::clean_→_0;_an_unreadable_family_→_2,_outranking_a_finding_beside_it
  Scenario: Clean harness state exits 0 and an unreadable family exits 2 even beside a finding
    Given one clean harness-state family
    Then its judgement exits 0
    And an unreadable family beside a family with a finding judges to exit 2

  @test:scripts/tests/sdlc/judge-mode.test.ts::check:harness-state::CLI_judge_mode_writes_nothing_and_agrees_with_the_in-process_judgement
  Scenario: check-harness-state in judge mode writes nothing and agrees with the in-process judgement
    When check-harness-state.ts runs with "--check"
    Then neither its sidecar nor git status changed
    And its exit equals the in-process judgement over its four families
