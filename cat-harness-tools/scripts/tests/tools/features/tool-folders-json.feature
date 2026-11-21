# schemas/tools/tool-folders.ts discovers a Tool declared as data in <id>/<id>.json the same way
# as a .ts one: type references resolve to IRIs, defineTool validates it, $comment is ignored.
# Each Scenario names the test that executes it.
Feature: Tools declared as JSON folders

  @test:scripts/tests/tools/tool-folders-json.test.ts::toolsFromFolders_reads_<id>/<id>.json::type_references_resolve_against_the_base;_$comment_is_dropped
  Scenario: A JSON Tool's type references resolve against the base and its $comment is dropped
    Given a folder "alpha" holding alpha.json with an input typed "Flag" and a $comment
    When toolsFromFolders reads the folder with base "https://example.org/h"
    Then the Tool's id is "alpha"
    And its first input's schema is the "Flag" Tool type IRI at that base
    And the loaded Tool contains no "$comment"

  @test:scripts/tests/tools/tool-folders-json.test.ts::toolsFromFolders_reads_<id>/<id>.json::a_folder_holding_both_forms_is_refused
  Scenario: A folder holding both a .json and a .ts Tool is refused
    Given a folder "beta" holding both beta.json and beta.ts
    When toolsFromFolders reads it
    Then it throws an error saying the Tool is declared "twice"

  @test:scripts/tests/tools/tool-folders-json.test.ts::toolsFromFolders_reads_<id>/<id>.json::an_unknown_type,_or_a_missing_$schema,_is_refused
  Scenario: An unknown type or a missing $schema is refused
    Given a gamma.json whose input is typed "NoSuchType"
    When toolsFromFolders reads it
    Then it throws "unknown Tool type"
    And given a gamma.json with no $schema, it throws naming "tool-definition/v1"
