# "Nothing to open" and "opens, refuses an edit" are two greys, not one
# (bean 10s1). Read over the published harness data, which is skipped when the
# site is not built; the who-iris block also needs a who-iris checkout.
# Each Scenario names the test that executes it.
Feature: Two greys: absent and read-only

  Background:
    Given the published harness data "_data/harness.json" has been built

  @test:scripts/tests/two-greys.test.ts::the_two_states_arrive_separately::there_are_visualisations_to_reason_about
  Scenario: There are visualisations
    Then the harnesses' visualisations are not empty

  @test:scripts/tests/two-greys.test.ts::the_two_states_arrive_separately::at_least_one_kind_is_declared_read-only
  Scenario: At least one kind is read-only
    Then at least one visualisation has readOnly true

  @test:scripts/tests/two-greys.test.ts::the_two_states_arrive_separately::read-only_is_declared,_not_derived_from_a_missing_viewer
  Scenario: Read-only is declared, shown by an explicit writable kind
    # Gap: the closing loop checks that readOnly is a boolean on kinds already filtered to readOnly true, which cannot fail; the path/readOnly independence its comment claims is not checked.
    Then at least one visualisation is read-only
    And at least one visualisation has readOnly false

  @test:scripts/tests/two-greys.test.ts::the_two_states_arrive_separately::absent_readOnly_is_never_written_as_false
  Scenario: Explicit false readOnly values have a kind
    # Gap: CAN NEVER FAIL. It asserts that each readOnly-false visualisation has a kind (every visualisation does) and that a filtered list is no longer than the list it filters; nothing checks that a false was declared rather than invented.
    Then every visualisation with readOnly false has a kind
    And there are no more of them than visualisations

  @test:scripts/tests/two-greys.test.ts::read-only_is_SAID,_not_only_recorded::every_instance_with_a_frozen_kind_says_so_in_a_finding
  Scenario: An instance with a frozen kind says so
    Then at least one harness has a read-only kind
    And each such harness has a finding containing "READ-ONLY"

  @test:scripts/tests/two-greys.test.ts::read-only_is_SAID,_not_only_recorded::the_finding_names_the_kinds,_not_just_a_count
  Scenario: The read-only finding names the kinds
    Then each harness's first "READ-ONLY" finding names every one of its read-only kinds

  @test:scripts/tests/two-greys.test.ts::read-only_is_SAID,_not_only_recorded::and_says_what_to_do_about_it
  Scenario: The read-only finding says to copy one out
    Then every "READ-ONLY" finding contains "copy one out"

  @test:scripts/tests/two-greys.test.ts::read-only_is_SAID,_not_only_recorded::an_instance_with_nothing_frozen_says_nothing
  Scenario: An instance with nothing frozen has no read-only finding
    Then no harness without a read-only kind has a "READ-ONLY" finding

  @test:scripts/tests/two-greys.test.ts::who-iris_—_the_instance_that_carries_both_answers::who-iris_is_in_the_report
  Scenario: who-iris is in the report
    Given a who-iris checkout beside the harness
    Then the harness data has an entry named "who-iris"

  @test:scripts/tests/two-greys.test.ts::who-iris_—_the_instance_that_carries_both_answers::its_catalogue_is_frozen
  Scenario: who-iris's catalogue is frozen
    Given a who-iris checkout beside the harness
    Then its "catalogue" visualisation is read-only

  @test:scripts/tests/two-greys.test.ts::who-iris_—_the_instance_that_carries_both_answers::and_its_uploads/_is_writable_while_declared,_and_not_a_graph_once_it_is_repository_data
  Scenario: who-iris's uploads are writable while declared
    Given a who-iris checkout beside the harness
    Then if who-iris declares an "uploads" directory its uploads visualisation has readOnly false
    And otherwise it has no uploads visualisation

  @test:scripts/tests/two-greys.test.ts::who-iris_—_the_instance_that_carries_both_answers::so_readOnly_is_per_kind,_not_a_per-instance_constant
  Scenario: readOnly is per kind
    Given a who-iris checkout beside the harness
    Then at least one harness has both a read-only and an explicitly writable kind
    And if who-iris declares uploads, its catalogue and uploads differ in readOnly
