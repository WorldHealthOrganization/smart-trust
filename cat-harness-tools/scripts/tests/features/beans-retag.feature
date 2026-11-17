# scripts/beans-retag.ts and scripts/declarations-retag.ts put the node-kind $schema tag back on
# beans and on harness declarations above the harness, and scripts/state-push.ts retags beans
# before it splices them. Each Scenario names the test that executes it.
Feature: Retagging beans and declarations with their node kind

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::adds_the_tag_straight_after_the_CLI's_`#_<id>`_line,_and_nothing_else_moves
  Scenario: The bean tag goes straight after the CLI's id line and nothing else moves
    Given an untagged bean whose front matter starts with "# x-1abc"
    When the bean text is retagged
    Then the outcome is "added"
    And the text is the bean with the bean schema tag inserted after "# x-1abc" and nothing else changed

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::is_idempotent
  Scenario: Retagging a bean is idempotent
    Given a bean already retagged once
    When it is retagged again
    Then the outcome is "tagged" and the text is unchanged

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::front_matter_with_no_id_comment_gets_the_tag_on_its_first_line
  Scenario: Front matter with no id comment gets the tag on its first line
    Given a bean whose front matter is just "title: t"
    When the bean text is retagged
    Then the bean schema tag is the first front matter line, before "title: t"

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::a_quoted_accepted_tag_counts_as_tagged
  Scenario: A quoted accepted tag counts as tagged
    Given a bean whose front matter holds the bean schema tag in double quotes
    When the bean text is retagged
    Then the outcome is "tagged"

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::a_foreign_tag_is_reported,_never_overwritten
  Scenario: A foreign tag is reported, never overwritten
    Given a bean tagged "bean/2.0.0"
    When the bean text is retagged
    Then the outcome is "foreign" naming tag "bean/2.0.0"
    And the text is unchanged

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::a_tag_in_the_BODY_is_not_the_bean's_tag
  Scenario: A tag in the body is not the bean's tag
    Given an untagged bean whose body mentions "$schema: other/1.0.0"
    When the bean text is retagged
    Then the outcome is "added"

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::a_file_with_no_fence_is_left_alone
  Scenario: A file with no front matter fence is left alone
    Given the text "no front matter"
    When the bean text is retagged
    Then the outcome is "unfenced" and the text is unchanged

  @test:scripts/tests/beans-retag.test.ts::retagBeanText::front_matter_closed_at_end_of_file_keeps_its_shape
  Scenario: Front matter closed at the end of the file keeps its shape
    Given a bean whose closing fence is the last thing in the file, with no newline after it
    When the bean text is retagged
    Then the tag is added after "# x" and the file still ends at the closing fence

  @test:scripts/tests/beans-retag.test.ts::retagDir::without_write_it_counts_and_changes_nothing
  Scenario: Retagging a directory without write counts and changes nothing
    Given a scratch defs directory with an untagged bean, a tagged bean, an untagged archived bean and a README.md
    When the directory is retagged without write
    Then it counts 3 files, 1 already tagged
    And it would add tags to "x-1abc--a.md" and "archive/x-3ghi--c.md"
    And the untagged bean's file is unchanged

  @test:scripts/tests/beans-retag.test.ts::retagDir::with_write_it_tags_the_archive_too,_and_a_second_pass_finds_nothing
  Scenario: Retagging a directory with write tags the archive too, and a second pass finds nothing
    Given a scratch defs directory with an untagged bean, a tagged bean, an untagged archived bean and a README.md
    When the directory is retagged with write
    Then the archived bean carries the bean schema tag
    And the README.md is unchanged
    And a second pass without write would add nothing

  @test:scripts/tests/beans-retag.test.ts::retagDir::the_gate's_remedy_is_the_command,_spelled_through_the_runner
  Scenario: The gate's remedy is the retag command spelled through the runner
    Then the retag command is "bun run cat beans:retag"

  @test:scripts/tests/beans-retag.test.ts::retagDeclarationText::puts_the_tag_first,_indented_like_the_next_key
  Scenario: A declaration gets the tag as its first key, indented like the next key
    Given a two-space-indented declaration with "name" and "title"
    When the declaration text is retagged
    Then the outcome is "added"
    And "$schema" with the declaration schema tag is inserted first at the same indent
    And "$schema" is the first key of the parsed JSON

  @test:scripts/tests/beans-retag.test.ts::retagDeclarationText::is_idempotent,_and_a_foreign_tag_is_reported
  Scenario: Retagging a declaration is idempotent, and a foreign tag is reported
    Given a declaration already retagged once
    When it is retagged again
    Then the outcome is "tagged"
    And a declaration carrying "$schema" "other/1.0.0" gives "foreign"

  @test:scripts/tests/beans-retag.test.ts::retagDeclarationText::a_one-line_declaration_is_rewritten_in_two-space_form
  Scenario: A one-line declaration is rewritten in two-space form
    Given the declaration text '{"name":"demo"}'
    When the declaration text is retagged
    Then it is rewritten over several lines, two-space indented, with "$schema" first

  @test:scripts/tests/beans-retag.test.ts::retagDeclarationText::text_that_is_not_a_JSON_object_is_not_touched
  Scenario: Text that is not a JSON object is not touched
    When the declaration texts "[1]" and "{" are retagged
    Then each outcome is "unparseable"

  @test:scripts/tests/beans-retag.test.ts::retagDeclarationText::retagDeclarations_finds_the_declaration_by_its_name
  Scenario: retagDeclarations finds the declaration by its name
    Given an instance "demo" that needs cat-harness, holding "demo.json" and "demo.config.json"
    When its declarations are retagged with write
    Then only "demo/demo.json" is tagged
    And "demo.config.json" is unchanged

  @test:scripts/tests/beans-retag.test.ts::retagDeclarationText::instances_below_the_harness_—_those_that_do_not_reach_cat-harness_through_`needs`_—_are_left_untagged
  Scenario: Instances that do not reach cat-harness through needs are left untagged
    Given declarations "boot", "boot-tools" needing boot, "cat-harness" needing boot-tools, and "above" needing cat-harness
    When the declarations are retagged with write
    Then "boot" and "boot-tools" are below the harness
    And "above" and "cat-harness" are tagged
    And "boot/boot.json" has no "$schema"

  @test:scripts/tests/beans-retag.test.ts::retagDeclarationText::bootstrap-tools_stays_below_the_harness_when_cat-harness_no_longer_needs_it_(cat-harness#787,_bean_w1gy)
  Scenario: bootstrap-tools stays below the harness when cat-harness no longer needs it
    Given declarations "bootstrap", "bootstrap-tools" needing bootstrap, "cat-harness" needing bootstrap, and "cat-harness-tools" needing cat-harness and bootstrap-tools
    When the declarations are retagged without write
    Then "bootstrap" and "bootstrap-tools" are below the harness
    And "cat-harness" and "cat-harness-tools" would be tagged
    And retagging bootstrap-tools alone, judged by the whole checkout's needs, finds it below with 0 files to tag

  @test:scripts/tests/beans-retag.test.ts::state:push_retags_the_beans_it_is_about_to_splice::a_location_holding_the_store_is_retagged
  Scenario: A state push to a location holding the bean store retags the beans
    Given a scratch repository with an untagged bean in beans/defs/
    When the beans are retagged before a push of the "beans" location at "beans/"
    Then the step reports the beans/defs/ directory with 1 added and no foreign tags
    And the bean carries the bean schema tag

  @test:scripts/tests/beans-retag.test.ts::state:push_retags_the_beans_it_is_about_to_splice::a_push_of_some_other_graph_leaves_the_beans_alone
  Scenario: A push of some other graph leaves the beans alone
    Given a scratch repository with an untagged bean in beans/defs/
    When the beans are retagged before a push of the "todos" location only
    Then there is no step
    And the bean is unchanged
