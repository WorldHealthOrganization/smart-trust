# scripts/check-declared-paths.ts scans a Tool declared as data (<id>/<id>.json) for declared-path
# literals: its $comment list is prose and not scanned, and a declared-path-literal comment
# covers the value at its JSON pointer. Each Scenario names the test that executes it.
Feature: A JSON Tool definition is scanned for declared-path literals

  @test:scripts/tests/kg/tool-definition-json-scan.test.ts::toolDefinitionText::other_JSON_is_not_a_Tool_definition
  Scenario: Other JSON is not a Tool definition
    Then a document with $schema "block-manifest/v1" gives no Tool definition text
    And text that is not JSON gives none

  @test:scripts/tests/kg/tool-definition-json-scan.test.ts::toolDefinitionText::the_$comment_list_is_blanked;_line_numbers_survive
  Scenario: The $comment list is blanked while line numbers survive
    Given a Tool definition maintaining "schemas/a.ts" whose $comment prose names "schemas/b.ts"
    When its scannable text is read
    Then it has as many lines as the file
    And it contains "schemas/a.ts"
    And it does not contain "schemas/b.ts"

  @test:scripts/tests/kg/tool-definition-json-scan.test.ts::toolDefinitionText::a_marker_covers_the_line_of_the_value_at_its_pointer,_and_only_that
  Scenario: A marker covers only the line of the value at its pointer
    Given a $comment at "/maintains/0/artefact" beginning "declared-path-literal:"
    When its scannable text is read
    Then the only covered line is "\"artefact\": \"ns/a.jsonld\""
    And its reason is "this node IS the declaration of the artefact."
