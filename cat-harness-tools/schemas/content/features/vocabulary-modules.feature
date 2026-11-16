# Specifies schemas/content/vocabulary-modules.ts: readVocabulary, which holds
# a typed vocabulary's module to its contract, and the composition of the
# discovered modules (allTypedBlockKinds, blockSchemaFor, allConstraintRules,
# allConstraintContextContributors).
Feature: A vocabulary module types its kinds and adds its rules, or says what is wrong

  @test:schemas/content/vocabulary-modules.test.ts::readVocabulary_holds_a_module_to_the_contract::a_module_typing_a_declared_kind_loads,_with_its_rules_and_builders
  Scenario: A module typing a declared kind loads with its rules and builders
    Given a module of "gadgets" with a "widget" block schema, the rule "widget-size" and a "widget" builder
    And "widget" is a declared kind of "gadgets"
    When the module is read
    Then it types "widget", carries the rule "widget-size", and has a "widget" builder

  @test:schemas/content/vocabulary-modules.test.ts::readVocabulary_holds_a_module_to_the_contract::it_names_the_module_and_what_is_wrong,_never_types_nothing_silently
  Scenario: A module breaking the contract throws, naming it and what is wrong
    Given modules of "gadgets" in "g.ts" that export no block schemas, type an undeclared kind, type "widget" twice, type a schema whose kind is not a literal, or export a constraintContext that is not a function
    When each is read
    Then each throws, saying respectively that "g.ts" exports no blockSchemas, that no block-kind node of "gadgets" declares "widget", that it is typed twice, that a literal kind is needed, and that constraintContext is not a function

  @test:schemas/content/vocabulary-modules.test.ts::readVocabulary_holds_a_module_to_the_contract::a_module's_constraint_context_contributor_is_carried,_and_is_absent_when_it_has_none_(bean_saqd)
  Scenario: A module's constraint context contributor is carried, and absent when it has none
    Given a "widget" module with a constraint context function, and one without
    When each is read
    Then the first carries that same function
    And the second's constraint context is undefined

  @test:schemas/content/vocabulary-modules.test.ts::composition,_in_whatever_checkout_this_runs::every_built-in_kind_stays_typed,_and_a_module's_kinds_are_added
  Scenario: Every built-in kind and every module's kind is typed
    Given whatever vocabulary modules this checkout discovers
    When all typed block kinds are composed
    Then they include every built-in typed kind
    And every kind each discovered module types

  @test:schemas/content/vocabulary-modules.test.ts::composition,_in_whatever_checkout_this_runs::a_block_is_parsed_by_its_module's_schema_when_one_types_its_kind,_else_by_BlockSchema
  Scenario: A kind's schema is its module's, else BlockSchema
    Given whatever vocabulary modules this checkout discovers
    When the block schema is asked for each kind a module types, and for "no-such-kind"
    Then each module's kind gives that module's schema
    And "no-such-kind" gives BlockSchema

  @test:schemas/content/vocabulary-modules.test.ts::composition,_in_whatever_checkout_this_runs::a_module's_rule_replaces_a_built-in_rule_with_the_same_id,_so_no_rule_runs_twice
  Scenario: A module's rule wins over a built-in with the same id, and no id appears twice
    # Gap: the modules are those this checkout discovers. Standing alone it
    # discovers none, so the replacing branch is not reached here; a checkout
    # with a vocabulary module contributing a built-in id exercises it.
    Given whatever vocabulary modules this checkout discovers
    When all constraint rules are composed
    Then no rule id appears twice
    And every built-in rule's id is present
    And each composed rule is the module's own rule object when a module contributes its id, and the built-in rule object otherwise
    And every rule a module contributes is among them

  @test:schemas/content/vocabulary-modules.test.ts::composition,_in_whatever_checkout_this_runs::every_module's_constraint_context_contributor_is_composed,_and_only_those
  Scenario: The composed constraint context contributors are exactly the modules'
    Given whatever vocabulary modules this checkout discovers
    When all constraint context contributors are composed
    Then they equal, in order, the contributor of each module that has one
