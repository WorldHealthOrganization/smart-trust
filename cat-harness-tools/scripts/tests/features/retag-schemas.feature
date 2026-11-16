# Retagging renames only a node's `$schema` value; prose naming an old tag is
# history and stays. Each Scenario names the test that executes it.
Feature: Retagging schema identifiers

  @test:scripts/tests/retag-schemas.test.ts::retag::a_JSON_node's_top-level_$schema
  Scenario: A JSON node's top-level $schema is renamed
    Given a JSON node with "$schema": "folio-public-comment-changeset/v1"
    When it is retagged with the 2026-10-05 renames
    Then its $schema is "changeset/1.0.0" and the rest of the text is unchanged

  @test:scripts/tests/retag-schemas.test.ts::retag::a_Markdown_todo's_front_matter,_and_not_its_prose
  Scenario: A Markdown todo's front matter is renamed but not its prose
    Given a Markdown todo whose front matter says "$schema: folio-todo/v1" and whose prose names `folio-todo/v1`
    When it is retagged
    Then the front matter says "$schema: todo/1.0.0"
    And the prose still names `folio-todo/v1`

  @test:scripts/tests/retag-schemas.test.ts::retag::an_unrelated_tag,_or_a_file_already_renamed,_is_left_alone
  Scenario: An unrelated or already-renamed tag is left alone
    Given a node tagged "kg-qa/v1" and a node already tagged "todo/1.0.0"
    When each is retagged
    Then retag returns undefined for both
