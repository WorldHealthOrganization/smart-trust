# scripts/audit-coverage.ts reports, per declared graph kind, whether it has no directory,
# an empty directory, files nothing audits, or files a criterion or gate covers.
# Each Scenario names the test that executes it.
Feature: Audit coverage report

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::a_single_kind
  Scenario: A single @covers kind is read from a docblock
    Given a docblock with the line "@covers tools"
    When its covers are read
    Then they are exactly "tools"

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::a_comma-separated_list
  Scenario: A comma-separated @covers list is split into kinds
    Given a docblock with the line "@covers bean-defs, beans"
    When its covers are read
    Then they are "bean-defs" and "beans"

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::an_em-dash_reason_is_not_mistaken_for_a_kind
  Scenario: An em-dash reason after @covers is not read as kinds
    Given a docblock with "@covers none — .github/workflows/ is not a declared graph typology"
    When its covers are read
    Then they are exactly "none"

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::a_wrapped_reason_contributes_nothing
  Scenario: A reason wrapped onto the next line contributes no kinds
    Given a docblock with "@covers computed — …" whose reason continues on an indented line
    When its covers are read
    Then they are exactly "computed"

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::several_lines_accumulate,_without_duplicates
  Scenario: Several @covers lines accumulate without duplicates
    Given a docblock with "@covers processes" and "@covers processes, skills"
    When its covers are read
    Then they are "processes" and "skills"

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::an_INDENTED_@covers_is_a_mention,_not_a_declaration
  Scenario: An indented @covers is a mention, not a declaration
    Given a docblock whose only @covers lines are indented examples
    When its covers are read
    Then the result is undefined

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::a_continuation_line_does_not_leak_into_the_list
  Scenario: A continuation line does not leak into the covers list
    Given a docblock with "@covers tools — because it reads" and a continuation line naming beans
    When its covers are read
    Then they are exactly "tools"

  @test:scripts/tests/audit-coverage.test.ts::coversIn_—_the_declaration_a_gate_makes_about_itself::absent_is_UNDEFINED,_not_an_empty_list
  Scenario: A docblock with no @covers reads as undefined, not an empty list
    Given a docblock with no @covers line
    When its covers are read
    Then the result is undefined
    And a docblock with "@covers none" reads as exactly "none"

  @test:scripts/tests/audit-coverage.test.ts::scriptsFor_—_a_gate_command_to_the_files_it_runs::a_direct_path
  Scenario: A gate command naming a script path resolves to that path
    Given package scripts where "check:x" runs "cat-harness/scripts/check-x.ts"
    When the files run by "bun run cat-harness/scripts/check-x.ts" are resolved
    Then they are exactly "cat-harness/scripts/check-x.ts"

  @test:scripts/tests/audit-coverage.test.ts::scriptsFor_—_a_gate_command_to_the_files_it_runs::one_hop_through_package.json
  Scenario: A gate command resolves one hop through package.json
    Given package scripts where "check:x" runs "cat-harness/scripts/check-x.ts"
    When the files run by "bun run check:x" are resolved
    Then they are exactly "cat-harness/scripts/check-x.ts"

  @test:scripts/tests/audit-coverage.test.ts::scriptsFor_—_a_gate_command_to_the_files_it_runs::two_hops
  Scenario: A gate command resolves two hops through package.json
    Given package scripts where "check:x:check" runs "check:x", which runs "cat-harness/scripts/check-x.ts"
    When the files run by "bun run check:x:check" are resolved
    Then they are exactly "cat-harness/scripts/check-x.ts"

  @test:scripts/tests/audit-coverage.test.ts::scriptsFor_—_a_gate_command_to_the_files_it_runs::through_publish-check_to_the_writer_it_runs_(B1)
  Scenario: A gate routed through publish-check resolves to the writer it runs
    Given "docs:x:check" runs publish-check.ts over "docs:x", which runs "gen-x.ts"
    When the files run by "bun run cat docs:x:check" are resolved
    Then they are publish-check.ts followed by gen-x.ts

  @test:scripts/tests/audit-coverage.test.ts::scriptsFor_—_a_gate_command_to_the_files_it_runs::through_run-script.ts_to_the_layer_script_it_runs_(run-gates.py)
  Scenario: A gate routed through run-script.ts resolves to the layer script it runs
    Given "libraries:check" runs "cat-harness-tools/scripts/libraries.ts --check"
    When the files run by "bun cat-harness-tools/scripts/run-script.ts libraries:check" are resolved
    Then they are run-script.ts followed by libraries.ts

  @test:scripts/tests/audit-coverage.test.ts::scriptsFor_—_a_gate_command_to_the_files_it_runs::a_command_with_no_script_resolves_to_nothing,_rather_than_guessing
  Scenario: A command that runs no script resolves to nothing
    Given package scripts where "lint" runs "eslint ."
    When the files run by "bun run cat lint" and by "bunx tsc --noEmit -p tsconfig.json" are resolved
    Then each resolves to an empty list

  @test:scripts/tests/audit-coverage.test.ts::census_—_what_counts_as_a_file_of_a_kind::a_verdict_ABOUT_a_node_is_not_a_node
  Scenario: QA sidecars are counted apart from the files they judge
    Given a directory holding a.md, a.kg-qa.json and b.qa.json
    When it is censused
    Then it has 1 file
    And it has 2 sidecars

  @test:scripts/tests/audit-coverage.test.ts::census_—_what_counts_as_a_file_of_a_kind::dot-prefixed_paths_are_skipped,_at_every_segment
  Scenario: Dot-prefixed paths are skipped at every segment
    Given the same directory with .cache/c.md and .hidden added
    When it is censused
    Then it still has 1 file

  @test:scripts/tests/audit-coverage.test.ts::census_—_what_counts_as_a_file_of_a_kind::an_unreadable_directory_says_so_rather_than_reporting_zero
  Scenario: An unreadable directory is reported unreadable rather than empty
    Given a directory path that does not exist
    When it is censused
    Then it is marked not readable
    And its file count is 0

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::it_examined_something_—_the_vacuity_guard's_subject
  Scenario: The report over this repository examines something
    Given the coverage report over this repository
    Then it has at least one row
    And it has at least one gate
    And there is at least one KG criterion

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::every_declared_kind_gets_exactly_one_row
  Scenario: Every declared kind gets exactly one row
    Given the coverage report over this repository
    Then the row count equals the registered kinds plus the declared-only kinds
    And no kind appears in two rows

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::typed-only_is_derived_from_the_registry,_and_is_NOT_covered
  Scenario: A kind is typed exactly when the registry gives it a validator or node schemas
    Given the coverage report over this repository
    Then each row is typed exactly when its registry definition has a validator or node schemas
    And a typed-only row is typed, has no criteria and no gates, and has files
    And an unaudited row is not typed

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::typed-only_and_unaudited_are_different_findings,_not_one_bucket
  Scenario: Typed-only and unaudited kinds are disjoint
    Given the coverage report over this repository
    Then no typed-only kind is also unaudited

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::the_two_kinds_`3oqj`_typed_are_typed,_and_their_real_nodes_parse
  Scenario: The interaction and issue-marks kinds are typed and have files
    # Gap: the nodes are not parsed against the schema here; only typed and file count are asserted
    Given the coverage report over this repository
    Then the "interaction" and "issue-marks" kinds each have a row
    And each is typed
    And each has more than 0 files

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::the_three_states_are_distinguishable,_and_all_three_occur_here
  Scenario: The no-directory and covered states both occur, and each state holds its meaning
    # Gap: the title says all three states occur; only no-directory and covered are required to occur
    Given the coverage report over this repository
    Then some row is "no-directory" and some row is "covered"
    And a no-directory row has no directories
    And an empty row has no files
    And an unaudited row has files, no criteria or gates, and is not typed
    And a covered row has at least one criterion or gate

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::a_nested_kind_resolves_its_own_directory_and_is_judged,_not_a_gap
  Scenario: A nested kind resolves its own directory and is covered
    Given the coverage report over this repository
    Then the "bean-defs" row is "covered"
    And one of its directories ends with "beans/defs"
    And it has at least one gate

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::a_kind_judged_only_by_a_check_its_own_layer's_CI_runs_is_covered,_not_typed-only
  Scenario: A kind judged only by its own layer's CI check is covered
    Given the coverage report over this repository
    Then the "cache" row has files
    And its gates include "bun run cat caches:viz:check"
    And it is "covered"

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::the_bean_store_is_reported_as_audited_—_the_defect_that_prompted_this
  Scenario: The bean store is reported as covered by its gates
    Given the coverage report over this repository
    Then the "beans" row has files
    And it has at least 5 gates
    And it is "covered"

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::criteria_are_attributed_through_the_declared_bridge,_not_guessed
  Scenario: Criteria are attributed to a kind through the declared subject bridge
    Given the coverage report over this repository
    Then each row's criteria are exactly the KG criteria whose applies maps to that kind through the subject-to-typology bridge

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::every_gate_CI_runs_has_declared_—_bean_`3srh`
  Scenario: No gate CI runs is left undeclared
    Given the coverage report over this repository
    Then no gate is in the "undeclared" state

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::a_gate's_every_declared_kind_is_a_kind_that_has_a_row
  Scenario: Every kind a gate declares has a row
    Given the coverage report over this repository
    Then every kind named in a gate's covers is a kind with a row

  @test:scripts/tests/audit-coverage.test.ts::the_report_over_this_repository::every_gate_lands_in_exactly_one_state,_and_none_is_left_unclassified
  Scenario: Every gate lands in exactly one known state
    Given the coverage report over this repository
    Then each gate's state is one of declared, none, computed, undeclared or no-script
    And a declared gate covers at least one kind, and any other gate covers none
    And an undeclared or no-script gate gives a reason

  @test:scripts/tests/audit-coverage.test.ts::the_report_is_a_fixpoint::census_excludes_only_what_it_is_told_to
  Scenario: The census excludes only the sidecars it is told to
    Given a directory holding a.qa-results.json and b.qa-results.json
    When it is censused with no exclusions
    Then it has 2 sidecars
    And when a.qa-results.json is excluded it has 1 sidecar

  @test:scripts/tests/audit-coverage.test.ts::the_committed_record_is_the_coverage_relation,_not_the_census::a_file_count_is_never_written
  Scenario: The committed record never writes a file count
    Given the first row of the coverage report over this repository
    When it is turned into a record
    Then the record has no "files" property
    And it has no "sidecars" property

  @test:scripts/tests/audit-coverage.test.ts::the_committed_record_is_the_coverage_relation,_not_the_census::hasFiles_carries_the_only_thing_the_census_decides
  Scenario: The committed record carries only whether a kind has files
    Given the coverage report over this repository
    Then each row's record has hasFiles true exactly when the row has more than 0 files

  @test:scripts/tests/audit-coverage.test.ts::the_committed_record_is_the_coverage_relation,_not_the_census::everything_that_DEFINES_coverage_is_written
  Scenario: The committed record keeps everything that defines coverage
    Given a covered row of the coverage report over this repository
    When it is turned into a record
    Then the record has directories, criteria and gates
    And its state is "covered"

  @test:scripts/tests/audit-coverage.test.ts::kindUniverse::the_registry_is_the_denominator,_and_an_instance_may_add_to_it
  Scenario: The kind registry is the denominator and declared-only kinds are kept apart
    Given the kind universe of this repository
    Then it has at least one registered kind
    And no declared-only kind is also registered
