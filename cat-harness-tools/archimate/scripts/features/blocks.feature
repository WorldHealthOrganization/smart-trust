# Specifies the relationship rules of an ArchiMate document
# (archimate/schemas/rules.ts) and archimate/scripts/archimate-blocks.ts:
# the rules file's schema, the Markdown tables drawn from it, the check of a
# model against the rules, and blocksOf, which writes a document's tables and
# figures from an instance's ArchiMate config.
# The model: a component realises a service, the service serves components
# twice, a grouping aggregates the component and the component influences a
# placeholder "Goal". The rules: "Realization" (with a verb, icon and meaning)
# and "Serving" (without); component realises service, capability serves goal.
Feature: A document's relationship rules are drawn as tables and checked against the model

  @test:archimate/scripts/blocks.test.ts::the_rules_file::refuses_a_rule_whose_relationship_type_it_does_not_list,_and_a_rule_listed_twice
  Scenario: A rule of an unlisted relationship type, and a rule listed twice, are refused
    Given a rules file listing only "Serving", with a "Composition" rule and the same "Serving" rule twice
    When it is parsed by the rules schema
    Then it fails, with a message that "Composition is not in" the list and one that a rule is "listed twice"

  @test:archimate/scripts/blocks.test.ts::the_tables::draws_the_rules_table_in_the_file's_order,_with_the_document's_names
  Scenario: The rules table follows the file's order and the document's names
    Given the rules
    When the rules table is drawn
    Then it is a Markdown table of Source, Relationship, Target and Note, with "Application Component | Realisation | Application Service" then "Capability | Serving | Goal"

  @test:archimate/scripts/blocks.test.ts::the_tables::draws_only_the_relationship_types_that_carry_a_meaning
  Scenario: The relationship-types table holds only the types with a meaning
    Given the rules
    When the relationship-types table is drawn
    Then its only row is the "Realises" icon, verb and meaning

  @test:archimate/scripts/blocks.test.ts::the_tables::replaces_the_table_and_keeps_the_caption_and_footnotes
  Scenario: Replacing a block's table keeps its caption and footnotes
    Given a block with a caption, a table and a footnote
    When its table is replaced
    Then the caption and the footnote are kept around the new table

  @test:archimate/scripts/blocks.test.ts::checking_a_model_against_the_rules::counts_what_follows_each_rule,_and_leaves_groupings_and_placeholders_out
  Scenario: Each rule's use is counted, without groupings and placeholders
    Given the model and the rules
    When the model is checked against the rules
    Then three of its five relationships are checked
    And the first rule is used once and the second never
    And the uncovered patterns hold only "id-r2" and "id-r3", not the grouping's aggregation nor the influence on the placeholder "Goal"
    When rules for a grouping aggregating a component and a component influencing a goal are added
    Then still three relationships are checked, and both added rules are used zero times

  @test:archimate/scripts/blocks.test.ts::checking_a_model_against_the_rules::reports_the_patterns_no_rule_covers,_most_used_first
  Scenario: The patterns no rule covers are reported
    Given the model and the rules
    When the model is checked against the rules
    Then the only uncovered pattern is a service serving a component, used twice
    And two relationships are uncovered
    When the realisation rule is removed
    Then the uncovered patterns are the serving, used twice, then the realisation, used once
    And three relationships are uncovered

  @test:archimate/scripts/blocks.test.ts::checking_a_model_against_the_rules::flags_a_rule_ArchiMate_does_not_allow,_and_a_relationship_type_the_document_never_explains
  Scenario: A rule ArchiMate does not allow, and an unexplained relationship type, are flagged
    Given the model and the rules
    When the model is checked against the rules
    Then the rule "Capability Serving Goal" is not allowed
    And "Serving" is unexplained
    And the report for "Table 9" says "1 of 2 rule(s) the model never uses" and "does not allow"

  @test:archimate/scripts/blocks.test.ts::blocksOf,_on_an_instance::draws_the_table_into_its_block_and_the_view_as_SVG,_and_checks_the_model
  Scenario: The table is drawn into its block, the view as SVG, and the model is checked
    Given a throwaway instance with the model, the rules as a file, a table block "doc/t.md", and a config naming that table and a figure of the view
    When its blocks are made
    Then the outputs are "doc/t.md" and "doc/media/f.svg"
    And the table block starts with its caption and then the rules table
    And the SVG contains "<svg" and "Registry"
    And the check finds two uncovered relationships
    And the block file on disk is not changed

  @test:archimate/scripts/blocks.test.ts::blocksOf,_on_an_instance::refuses_a_table_whose_model_the_config_does_not_declare
  Scenario: A table naming an undeclared model is refused
    Given the config with its table's model changed to "nope"
    When it is parsed by the ArchiMate config schema
    Then it fails
