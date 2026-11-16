# A mount at an earlier pin of the same lock is stale, not somebody's work
# (bean folio-assistant-jstq). Each Scenario names the test that executes it.
Feature: Replacing a mount left at an earlier pin of the lock

  @test:scripts/tests/mount-from-lock-prior-pin.test.ts::a_mount_at_an_earlier_pin_of_the_lock_(bean_folio-assistant-jstq)::priorPins_reads_every_committed_version_of_the_lock
  Scenario: priorPins reads every committed version of the lock
    Given a checkout whose lock was committed at pin 1 and then pin 2
    When its prior pins are read
    Then both pins' tree digests are known for inst, and pin 1's declaration hash for inst/inst.json

  @test:scripts/tests/mount-from-lock-prior-pin.test.ts::a_mount_at_an_earlier_pin_of_the_lock_(bean_folio-assistant-jstq)::is_replaced_by_the_current_pin,_and_--check_says_so_first
  Scenario: An earlier pin's mount is replaced by the current pin, and --check says so first
    Given a checkout mounted at pin 1 whose lock now pins 2
    When the mounts are checked, the outcome is "missing", saying it holds an earlier pin's bytes, not an edit
    And when the mounts are laid down, the outcome is "mounted", saying it replaced an earlier pin's inst
    Then lib.ts holds pin 2's bytes, a check reads "current", and nothing of the set-aside copy is left

  @test:scripts/tests/mount-from-lock-prior-pin.test.ts::a_mount_at_an_earlier_pin_of_the_lock_(bean_folio-assistant-jstq)::keeps_a_state_mount_and_node_modules_inside_it
  Scenario: A state mount and node_modules inside the mount are kept
    Given a checkout mounted at pin 1 with a state mount and node_modules inside the mount, whose lock now pins 2
    When the mounts are laid down
    Then the outcome is "mounted", keeping both, which still hold their bytes
    And lib.ts holds pin 2's bytes and a check reads "current"

  @test:scripts/tests/mount-from-lock-prior-pin.test.ts::a_mount_at_an_earlier_pin_of_the_lock_(bean_folio-assistant-jstq)::an_EDITED_mount_is_still_somebody's_work:_refused_and_left_byte_for_byte
  Scenario: An edited mount is refused and left byte for byte
    Given a checkout mounted at pin 1 with lib.ts edited, whose lock now pins 2
    When the mounts are laid down
    Then the outcome is "missing" calling it somebody's work, lib.ts keeps the edit, and a check does not call it an earlier pin

  @test:scripts/tests/mount-from-lock-prior-pin.test.ts::a_mount_at_an_earlier_pin_of_the_lock_(bean_folio-assistant-jstq)::a_replacement_that_cannot_be_fetched_restores_the_earlier_pin_as_it_was
  Scenario: A replacement that cannot be fetched restores the earlier pin
    Given a checkout mounted at pin 1 whose lock pins 2 from a repository that does not exist
    When the mounts are laid down
    Then the outcome is "could-not-determine", saying it was restored as it was
    And lib.ts holds pin 1's bytes and the mount's digest is pin 1's
