# Platform state in an instance's joined checkout is not applicable, not red
# (cat-harness-tools#1701, smart-ips-pilgrimage#13). Each Scenario names the
# test that executes it.
Feature: Platform state in an instance checkout is not applicable

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:declared-dirs_in_an_instance's_joined_checkout::state_the_mount_recorded_absent_is_not_applicable,_and_says_why
  Scenario: State the mount recorded absent is not applicable, and says why
    Given an instance checkout with a mounted platform layer declaring beans on a branch the origin lacks
    When the state is mounted and the platform layer's declared directories are audited
    Then beans is not a finding, and it is not applicable because it is not declared by this root

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:declared-dirs_in_an_instance's_joined_checkout::without_an_absence_record_the_same_entry_is_still_unmounted
  Scenario: Without an absence record the same entry is still unmounted
    When the platform layer is audited without mounting state
    Then beans is an unmounted finding and is not listed as not applicable

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:declared-dirs_in_an_instance's_joined_checkout::checkout-level_state_a_mounted_layer_declares_and_nobody_created_is_not_applicable
  Scenario: Checkout-level state a mounted layer declares and nobody created is not applicable
    When the platform layer is audited
    Then uploads is not a finding, and it is not applicable because it is not declared by this root

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:declared-dirs_in_an_instance's_joined_checkout::the_root's_own_repository-scoped_directory_that_is_missing_is_still_a_finding
  Scenario: The root's own missing repository-scoped directory is still a finding
    Given the root itself declares uploads and it is not on disk
    When the root is audited
    Then uploads is an absent finding

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:declared-dirs_in_an_instance's_joined_checkout::an_id_several_OTHER_mounts_share_is_not_'could_not_determine'_for_this_path
  Scenario: An id several other mounts share is not "could not determine" for this path
    Given two other mounts recorded under the id health
    When the presence of plat's health directory is read
    Then it is unmounted, and its detail does not say could not determine

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:harness-state_families_over_an_absent_container::a_blind_family_whose_container_is_recorded_absent_becomes_not_applicable
  Scenario: A blind family whose container is recorded absent is not applicable
    When a family that could not determine is excused against a recorded absence of beans
    Then it is no longer unreadable and is not applicable with that reason

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:harness-state_families_over_an_absent_container::with_no_absence_record_it_stays_blind
  Scenario: With no absence record a blind family stays blind
    When the family is excused with nothing recorded absent
    Then it is still unreadable and not marked not applicable

  @test:scripts/tests/not-applicable-instance-state.test.ts::check:harness-state_families_over_an_absent_container::a_family_with_no_declared_container_is_never_excused
  Scenario: A family with no declared container is never excused
    Given a family that declares no container
    When it is excused against any absence
    Then it is still unreadable
