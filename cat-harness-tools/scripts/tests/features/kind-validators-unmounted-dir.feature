# `sweepFamilies` in `scripts/check-kind-validators.ts` does not examine a declared
# directory the mount did not choose or one built at publish, while a chosen, mounted,
# empty directory is still read. Each Scenario names the test that executes it.
Feature: Kind validators and unmounted directories

  @test:scripts/tests/kind-validators-unmounted-dir.test.ts::a_declared_directory_the_mount_did_not_choose::the_lock_answers:_not_chosen
  Scenario: The mount lock answers that an unchosen directory was not chosen
    Given a downstream whose lock mounts "up" with only its "glossary" directory chosen
    When the mount choice is asked for "up/beans", "up/glossary" and the own layer's "beans"
    Then "up/beans" is not chosen, per "index.lock.json"
    And "up/glossary" is chosen, per "index.lock.json"
    And the own layer's directory has no answer

  @test:scripts/tests/kind-validators-unmounted-dir.test.ts::a_declared_directory_the_mount_did_not_choose::is_reported_not_mounted,_and_nothing_was_read
  Scenario: An unchosen directory is reported not mounted and nothing is read
    Given the same downstream with "up/beans" not chosen
    When the families are swept from the own layer
    Then beans counts 0 nodes
    And beans lists "up-beans" at "up/beans" as not mounted, per "index.lock.json"
    And no beans directory was read

  @test:scripts/tests/kind-validators-unmounted-dir.test.ts::a_chosen_directory,_mounted_and_empty::is_read,_and_is_not_excused_as_unmounted
  Scenario: A chosen, mounted, empty directory is read and not excused
    Given a downstream whose lock chooses "up/beans" and whose beans directory exists and is empty
    When the families are swept from the own layer
    Then beans counts 0 nodes
    And beans lists nothing as not mounted
    And 1 beans directory was read

  @test:scripts/tests/kind-validators-unmounted-dir.test.ts::a_declared_directory_built_at_publish_and_not_built_here::is_reported_as_built_at_publish,_and_nothing_was_read
  Scenario: An absent directory built at publish is reported so and nothing is read
    Given an instance declaring an absent "beans/" with "beans/index.json" built at publish by "beans:build"
    When the families are swept
    Then beans counts 0 nodes
    And beans lists "fixture-beans" at "fixture/beans" as built not here, written by "beans:build"
    And no beans directory was read

  @test:scripts/tests/kind-validators-unmounted-dir.test.ts::a_declared_directory_built_at_publish_and_not_built_here::without_a_builtAtPublish_claim,_an_absent_directory_gets_no_excuse
  Scenario: Without a built-at-publish claim an absent directory gets no excuse
    Given an instance declaring an absent "beans/" with no built-at-publish claim
    When the families are swept
    Then beans lists nothing as built not here and nothing as not mounted
    And 1 beans directory was read
