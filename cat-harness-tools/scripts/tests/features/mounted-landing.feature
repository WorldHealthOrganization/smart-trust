# landing:data:check is not applicable when the landing is a lock-mounted
# layer of a content instance's root (cat-harness-tools#1701). Each Scenario
# names the test that executes it.
Feature: A landing that is a mounted layer

  @test:scripts/tests/mounted-landing.test.ts::landingMountedNotOwned::a_content_root_whose_landing_is_a_mounted_layer:_not_applicable
  Scenario: A content root whose landing is a mounted layer is not applicable
    Given a content root whose lock mounts smart-base
    When its landing smart-base is judged
    Then the reason for not applying names smart-base

  @test:scripts/tests/mounted-landing.test.ts::landingMountedNotOwned::the_platform_index_(root_declares_nothing)_is_still_checked
  Scenario: The platform index, whose root declares nothing, is still checked
    Given a checkout with no root declaration whose lock mounts smart-base
    Then its landing smart-base is not exempt

  @test:scripts/tests/mounted-landing.test.ts::landingMountedNotOwned::a_root_whose_landing_is_itself_is_still_checked
  Scenario: A root whose landing is itself is still checked
    Given the root is smart-base
    Then its landing smart-base is not exempt

  @test:scripts/tests/mounted-landing.test.ts::landingMountedNotOwned::a_landing_the_lock_does_not_mount,_or_an_unreadable_lock,_is_still_checked
  Scenario: A landing the lock does not mount, an unreadable lock, or no landing is still checked
    Then a landing the lock does not mount is not exempt
    And with an unreadable lock it is not exempt
    And with no landing named it is not exempt
