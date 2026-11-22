# pipeline/uses-field.ts parseStringField reads a block's string field, such as the
# editorial `interprets` edge, through the masked scanner so comments and prose
# cannot fool it. Each Scenario names the test that executes it.
Feature: Reading the interprets field of a block

  @test:scripts/tests/interprets-editorial-edge.test.ts::parseStringField::reads_a_plain_scalar_field
  Scenario: A plain scalar field is read
    Given the source 'interprets: "def:x",'
    When the interprets field is parsed
    Then the value is "def:x"

  @test:scripts/tests/interprets-editorial-edge.test.ts::parseStringField::a_comment_before_the_field_does_not_hide_it
  Scenario: A comment before the field does not hide it
    Given a title, then a comment line, then 'interprets: "prop:y"'
    When the interprets field is parsed
    Then the value is "prop:y"

  @test:scripts/tests/interprets-editorial-edge.test.ts::parseStringField::the_field_name_quoted_in_prose_does_not_win_over_the_real_field
  Scenario: The field name quoted in prose does not win over the real field
    Given a body string containing 'interprets: \"def:ghost\"' followed by the real field 'interprets: "def:real"'
    When the interprets field is parsed
    Then the value is "def:real"

  @test:scripts/tests/interprets-editorial-edge.test.ts::parseStringField::a_label_mentioned_only_in_a_comment_is_not_the_value
  Scenario: A label mentioned only in a comment is not the value
    Given a comment line naming 'interprets: "def:ghost"' and then the real field "def:real"
    When the interprets field is parsed
    Then the value is "def:real"

  @test:scripts/tests/interprets-editorial-edge.test.ts::parseStringField::an_absent_field_is_undefined
  Scenario: An absent field is undefined
    Given a source holding only a label field
    When the interprets field is parsed
    Then the value is undefined

  @test:scripts/tests/interprets-editorial-edge.test.ts::parseStringField::a_non-string_value_is_skipped_rather_than_mis-read
  Scenario: A non-string value is skipped rather than mis-read
    Given the source "interprets: someVar,"
    When the interprets field is parsed
    Then the value is undefined

  @test:scripts/tests/interprets-editorial-edge.test.ts::parseStringField::the_identifier_boundary_keeps_a_longer_field_name_out
  Scenario: The identifier boundary keeps a longer field name out
    Given 'reinterprets: "def:no"' before 'interprets: "def:yes"'
    When the interprets field is parsed
    Then the value is "def:yes"
