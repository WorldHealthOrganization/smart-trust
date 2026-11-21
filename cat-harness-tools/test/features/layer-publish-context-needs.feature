# The layer-publish-context workflow's needs-at-main.ts takes the caller's dependency harness at main,
# reading each layer's needs from its declaration at main and its home from the index lock.
# Each Scenario names the test that executes it.
Feature: The publish context takes the dependency harness as declared at main

  @test:test/layer-publish-context-needs.test.ts::needs-at-main::the_closure_follows_needs_as_declared_at_main,_takes_the_always-layers,_and_never_the_caller
  Scenario: The closure follows needs at main, takes the always-layers and never the caller
    Given a caller that needs "mid", and a locked "mid" that needs nothing
    And at main "mid" needs "low", "low" needs nothing and "tools" needs "low" and "caller"
    When the closure is taken for "caller" with the always-layer "tools", each take writing the main declaration
    Then the layers taken are "mid", "tools" and "low" in that order
    And "caller" is not taken

  @test:test/layer-publish-context-needs.test.ts::needs-at-main::needsOf_reads_nothing_for_an_absent_or_unreadable_declaration
  Scenario: needsOf reads no needs for an absent or unreadable declaration
    Given no declaration for "absent"
    And a "broken" declaration that is not valid JSON
    When needsOf reads each
    Then each has no needs

  @test:test/layer-publish-context-needs.test.ts::needs-at-main::the_lock_says_where_a_layer_lives,_including_a_sub-directory_instance
  Scenario: The lock's instances say where a layer lives, including a sub-directory instance
    Given an index.lock.json with instances "smart-base" at "litlfred/smart-base" under "smart-base" and "cat-harness" at "litlfred/cat-harness" at the repository root
    When the locked instances are read
    Then "smart-base" has repository "litlfred/smart-base" and upstream root "smart-base"
    And "cat-harness" has an empty upstream root

  @test:test/layer-publish-context-needs.test.ts::needs-at-main::the_current_lock's_mounts_carry_the_owner,_so_a_layer_moved_to_another_owner_is_fetched_from_there
  Scenario: The lock's mounts carry the owner a layer is fetched from
    Given an index.lock.json with mounts "smart-base" at "WorldHealthOrganization/smart-base" and "dpi-h-ra" at "WorldHealthOrganization/smart-ra"
    When the locked instances are read
    Then "smart-base" has repository "WorldHealthOrganization/smart-base"
    And "dpi-h-ra" has repository "WorldHealthOrganization/smart-ra"
