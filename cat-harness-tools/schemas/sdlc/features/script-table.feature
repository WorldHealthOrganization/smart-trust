# schemas/sdlc/script-table.ts: scriptTable reads a root's package.json scripts, where a root
# that is itself an instance also declares checkoutScripts.
# Each Scenario names the test that executes it.
Feature: The script table at a root that is itself an instance

  @test:schemas/sdlc/script-table.test.ts::scriptTable_at_a_root_that_is_itself_an_instance::a_name_in_both_`scripts`_and_`checkoutScripts`_of_the_root_is_its_`scripts`_spelling
  Scenario: A name in both scripts and checkoutScripts takes its scripts spelling
    Given a root package.json with "check:x" in scripts as "bun run tool.ts ." and in checkoutScripts as "bun run tool.ts self", plus "only:host" in checkoutScripts
    When its script table is read
    Then "check:x" runs "bun run tool.ts ."
    And "only:host" runs "bun run h.ts"

  @test:schemas/sdlc/script-table.test.ts::scriptTable_at_a_root_that_is_itself_an_instance::a_name_the_root's_`checkoutScripts`_alone_declares_is_kept
  Scenario: A name only checkoutScripts declares is kept
    Given a root package.json whose only script is "a" in checkoutScripts, running "x"
    When its script table is read
    Then "a" runs "x"
