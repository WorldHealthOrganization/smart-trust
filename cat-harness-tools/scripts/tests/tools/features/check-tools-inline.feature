# scripts/check-tools.ts reports a Tool declared inline in a tools directory rather
# than in its own folder. Each Scenario names the test that executes it.
Feature: Inline Tool declarations are a check:tools finding

  @test:scripts/tests/tools/check-tools-inline.test.ts::inline_Tool_declarations_are_a_finding::the_barrel_is_reported,_the_folder_Tool_is_not
  Scenario: A barrel declaring a Tool is reported and a folder Tool is not
    Given a scratch tools directory holding "folder-tool/folder-tool.ts" declaring a Tool
    And an "index.ts" that declares a Tool itself
    And a "lib.ts" with no Tool and an "index.test.ts" calling defineTool
    When the inline Tool findings are computed
    Then the only finding is instance "scratch" with file "tools/index.ts"

  @test:scripts/tests/tools/check-tools-inline.test.ts::inline_Tool_declarations_are_a_finding::an_absent_tools_directory_is_no_finding_and_no_crash
  Scenario: An absent tools directory yields no finding
    Given a tools directory path that does not exist
    When the inline Tool findings are computed for it
    Then there are no findings and nothing throws

  @test:scripts/tests/tools/check-tools-inline.test.ts::inline_Tool_declarations_are_a_finding::every_declared_tools_directory_in_this_checkout_is_asked
  Scenario: This checkout declares at least one tools directory
    Given this checkout
    When its declared tools directories are listed
    Then there is at least one
    # Gap: only checks that the list is non-empty, not that the finder visits each directory
