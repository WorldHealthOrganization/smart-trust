# `scripts/kind-register.ts` lists every artefact a new graph typology owes: the chain
# of writers and checks, the two authored artefacts reported against the kind, and a
# hue report that is never graded. Each Scenario names the test that executes it.
Feature: Kind register

  @test:scripts/tests/kind-register.test.ts::the_chain::every_step_names_a_writer_and_the_check_that_asks_the_same_question
  Scenario: Every step names a writer, a check and a reason
    Given the registered chain of steps
    Then there is at least one step
    And every step has a non-empty writer command and a non-empty check command
    And every step's reason is longer than 20 characters

  @test:scripts/tests/kind-register.test.ts::the_chain::a_check_is_never_the_writer's_own_name
  Scenario: A step's check is never the same command as its writer
    Given the registered chain of steps
    Then no step's check command equals its writer command

  @test:scripts/tests/kind-register.test.ts::the_AUTHORED_two_are_reported_against_the_kind::this_repository_has_no_authored_gap
  Scenario: This repository has no authored gap
    When the authored gaps of this repository are computed
    Then there are none

  @test:scripts/tests/kind-register.test.ts::the_AUTHORED_two_are_reported_against_the_kind::a_kind-table_row_missing_is_reported,_naming_the_kind
  Scenario: A missing kind-table row is reported, naming the kind
    Given a fixture root whose graph-typology table has the header and no rows
    When the authored gaps of that root are computed
    Then at least one gap is reported
    And every gap owes a "kind-table-row"
    And the first gap names a kind and its detail names the kind-table document

  @test:scripts/tests/kind-register.test.ts::hue_is_reported_and_never_graded::the_shared_tones_are_real,_and_are_a_family_convention
  Scenario: Shared tones exist among the kinds
    # Gap: only checks that at least one hue collision exists, not that collisions are a family convention
    When the hue report is computed
    Then it lists at least one collision

  @test:scripts/tests/kind-register.test.ts::hue_is_reported_and_never_graded::the_shared_WHO_tone_is_a_convention_declared_in_the_data
  Scenario: The shared WHO tone is a convention declared in the data
    # Skipped: when the checkout does not hold who-iris and smart-base
    Given the avatars of "who-iris" and "smart-base"
    Then each avatar's reads text contains "WHO blue"
    And both avatars have the same tone

  @test:scripts/tests/kind-register.test.ts::hue_is_reported_and_never_graded::nearest-neighbour_clearance_is_symmetric_and_circular
  Scenario: Nearest-neighbour clearance is sorted closest first and measured on the circle
    # Gap: symmetry of the clearance is not checked
    When the hue report is computed
    Then it lists at least one nearest neighbour
    And the first clearance is no larger than the last
    And no clearance exceeds 180 degrees
