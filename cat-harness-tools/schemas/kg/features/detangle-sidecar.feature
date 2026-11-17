# Specifies schemas/kg/detangle-sidecar.ts: sidecarFor, PINNED_FIELDS and
# staleFields, and that the two direction counts are pinned like every other
# field (beans j79e, 1xhc).
Feature: The detangle sidecar pins the direction counts and reports them stale when they change

  @test:schemas/kg/detangle-sidecar.test.ts::the_direction_counts_survive_the_round_trip::both_are_emitted,_and_`wrongDirection`_carries_its_value_rather_than_a_default
  Scenario: The sidecar carries both direction counts from the measurement
    Given a measurement with wrongDirection 1 and undeterminedDirection 0
    When its sidecar is written
    Then the sidecar's wrongDirection is 1
    And its undeterminedDirection is 0

  @test:schemas/kg/detangle-sidecar.test.ts::the_direction_counts_survive_the_round_trip::both_are_in_PINNED_FIELDS,_so_the_comparer_sees_what_the_writer_wrote
  Scenario: Both direction counts are pinned fields
    When PINNED_FIELDS is read
    Then it contains "wrongDirection" and "undeterminedDirection"

  @test:schemas/kg/detangle-sidecar.test.ts::the_direction_counts_survive_the_round_trip::`undeterminedDirection`_is_pinned_SEPARATELY,_so_the_third_state_cannot_hide_in_the_first
  Scenario: An edge moving from wrong-direction to undetermined is stale on both fields
    Given a sidecar with wrongDirection 1 and undeterminedDirection 0
    And a sidecar of the same measurement with wrongDirection 0 and undeterminedDirection 1
    When the two are compared
    Then the stale fields are wrongDirection and undeterminedDirection

  @test:schemas/kg/detangle-sidecar.test.ts::the_comparer_is_neither_always-empty_nor_always-full::an_unchanged_measurement_is_not_stale
  Scenario: An unchanged measurement is not stale
    Given two sidecars of the same measurement
    When they are compared
    Then no field is stale

  @test:schemas/kg/detangle-sidecar.test.ts::the_comparer_is_neither_always-empty_nor_always-full::a_changed_`wrongDirection`_IS_stale,_and_is_named
  Scenario: A changed wrongDirection is stale and named
    Given a committed sidecar with wrongDirection 0 and a fresh one with wrongDirection 1
    When they are compared
    Then the only stale field is wrongDirection

  @test:schemas/kg/detangle-sidecar.test.ts::a_sidecar_missing_the_direction_fields_entirely_reads_as_stale,_not_as_zero
  Scenario: A legacy sidecar without the direction fields is stale
    Given a sidecar with wrongDirection and undeterminedDirection deleted
    When it is compared with a fresh sidecar of the same measurement
    Then the stale fields are wrongDirection and undeterminedDirection
