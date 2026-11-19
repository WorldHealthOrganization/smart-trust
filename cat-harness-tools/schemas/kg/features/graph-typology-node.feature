# Specifies schemas/kg/graph-typology-node.ts and the GraphTypologyRegistry
# that loads its nodes (bean dmx1): kinds declared as nodes in each instance's
# typologies/ graph, validators declared as nodes (bean riit), and the order of
# several checkouts (kg-separation lesson 6).
Feature: Graph typologies are declared as nodes and loaded from the checkouts on first use

  @test:schemas/kg/graph-typology-node.test.ts::a_declared_kind::is_loaded_on_first_use,_with_the_file_that_declared_it
  Scenario: A declared kind is loaded with the file that declared it
    Given a checkout whose instance alpha declares the kind "widget" in typologies/widget.json
    When a registry over that checkout is asked for "widget"
    Then the kind holds "derived"
    And it is declared by alpha/typologies/widget.json
    And the registry's names include "widget"

  @test:schemas/kg/graph-typology-node.test.ts::a_declared_kind::carries_`shownOnPublishedPages`,_and_the_schema_takes_only_`true`_for_it
  Scenario: shownOnPublishedPages is carried, and only true is accepted
    Given a checkout declaring the kind "annex" with shownOnPublishedPages true
    When the registry is asked for "annex"
    Then its shownOnPublishedPages is true
    And a node with shownOnPublishedPages false is refused by the node schema

  @test:schemas/kg/graph-typology-node.test.ts::a_declared_kind::is_unknown_to_a_registry_that_declares_no_checkout
  Scenario: A registry with no checkout does not know a declared kind
    Given a registry built with no checkout
    When it is asked whether it has "widget"
    Then it does not

  @test:schemas/kg/graph-typology-node.test.ts::a_declared_kind::two_files_claiming_one_name_are_refused,_naming_both
  Scenario: Two files claiming one kind name are refused
    Given a checkout in which alpha and beta both declare the kind "widget"
    When the registry is asked for "widget"
    Then it throws an error saying "declared by"
    And the message names both alpha's and beta's typologies/widget.json files

  @test:schemas/kg/graph-typology-node.test.ts::a_declared_kind::a_declared_name_that_the_code_also_lists_is_refused
  Scenario: A declared kind the code also lists is refused
    Given a checkout declaring "widget" and a registry whose code-listed kinds also include "widget"
    When the registry's names are read
    Then it throws an error mentioning the "base layer"

  @test:schemas/kg/graph-typology-node.test.ts::a_declared_kind::a_node_that_does_not_parse_throws_with_its_path
  Scenario: A kind node that does not parse throws with its path
    Given a checkout declaring a "widget" node with only $schema and kind
    When the registry is asked whether it has "widget"
    Then it throws an error naming widget.json

  @test:schemas/kg/graph-typology-node.test.ts::the_node_schema::a_node_is_never_mistaken_for_an_instance_declaration_(it_carries_no_`name`)
  Scenario: A typologies/ directory is not taken for an instance
    Given a checkout whose instance alpha declares the kind "widget"
    When a declaration file is sought in alpha/typologies
    Then none is found

  @test:schemas/kg/graph-typology-node.test.ts::the_node_schema::refuses_an_unknown_field_and_an_upper-case_name
  Scenario: The node schema refuses an unknown field and an upper-case kind
    Given a "widget" node with an extra field, and a node named "Widget"
    When each is parsed with the node schema
    Then each is refused

  @test:schemas/kg/graph-typology-node.test.ts::this_checkout::fhir-harness_declares_ig-pages_and_ig-ast,_with_their_avatars
  Scenario: fhir-harness declares ig-pages and ig-ast, each with an avatar
    Given the default graph typology registry of this checkout
    When "ig-pages" and "ig-ast" are looked up
    Then each is declared by a file under fhir-harness/typologies/
    And each has an avatar

  @test:schemas/kg/graph-typology-node.test.ts::validators_as_nodes_(bean_riit):_the_validator_names_the_family::a_listed_family_takes_the_validator_a_node_names_for_it
  Scenario: A listed family takes the validator a validator node names for it
    Given the kind "widget" listing the family "widget/v1"
    And a validator node "widget" for that family naming "alpha:schemas/w.ts#WidgetSchema"
    When the registry is asked for "widget"
    Then the family's validator is "alpha:schemas/w.ts#WidgetSchema"
    And the validator node for the family is "widget"

  @test:schemas/kg/graph-typology-node.test.ts::validators_as_nodes_(bean_riit):_the_validator_names_the_family::a_kind-level_validator_fills_a_kind_with_no_families
  Scenario: A kind-level validator fills a kind with no families
    Given the kind "widget" with no families and a validator node naming no family
    When the registry is asked for "widget"
    Then the kind's validator is "alpha:schemas/w.ts#WidgetSchema"

  @test:schemas/kg/graph-typology-node.test.ts::validators_as_nodes_(bean_riit):_the_validator_names_the_family::a_validator_for_a_family_the_kind_does_not_list_is_refused
  Scenario: A validator for an unlisted family is refused
    Given the kind "widget" listing "widget/v1" and a validator for "other/v1"
    When the registry is asked for "widget"
    Then it throws an error saying the kind "does not list" the family

  @test:schemas/kg/graph-typology-node.test.ts::validators_as_nodes_(bean_riit):_the_validator_names_the_family::two_validators_for_one_family_are_refused,_naming_both
  Scenario: Two validators for one family are refused
    Given validator nodes "a" and "b" for the family "widget/v1", naming different schemas
    When the registry is asked for "widget"
    Then it throws an error mentioning "two validators"
    And the message names both validator files, validators/a.json and validators/b.json

  @test:schemas/kg/graph-typology-node.test.ts::validators_as_nodes_(bean_riit):_the_validator_names_the_family::a_family_that_already_names_DIFFERENT_code_is_two_answers,_and_refused
  Scenario: A validator node for a family that already names code is refused
    Given the kind "widget" whose family "widget/v1" already names "alpha:old.ts#OldSchema"
    And a validator node for that family naming a different schema
    When the registry is asked for "widget"
    Then it throws an error mentioning "two answers"

  @test:schemas/kg/graph-typology-node.test.ts::validators_as_nodes_(bean_riit):_the_validator_names_the_family::a_kind_registered_in_code_after_load_is_joined_too_(core's_folio)
  Scenario: A kind registered in code after loading still gets its validator
    Given a checkout with a kind-level validator for "widget" and no declared kinds
    And the registry has already loaded its names
    When "widget" is registered in code
    Then its validator is "alpha:schemas/w.ts#WidgetSchema"

  @test:schemas/kg/graph-typology-node.test.ts::several_checkouts,_in_precedence_order_(kg-separation_lesson_6)::a_kind_only_the_inspected_checkout_declares_is_known_—_the_standalone-tools_case
  Scenario: A kind only the inspected checkout declares is known
    Given an inspected checkout declaring "l6-contributed" and a module checkout declaring nothing
    When a registry over both is asked for "l6-contributed"
    Then it has it
    And a registry over the module checkout alone does not

  @test:schemas/kg/graph-typology-node.test.ts::several_checkouts,_in_precedence_order_(kg-separation_lesson_6)::a_later_checkout_repeating_a_kind_is_SHADOWED_and_reported,_not_a_conflict
  Scenario: A kind repeated by a later checkout is shadowed and reported
    Given the inspected checkout declaring "l6-shared" as content and a later checkout declaring it as derived
    When a registry over both, inspected first, is asked for "l6-shared"
    Then the kind holds "content"
    And the shadowed list records the inspected file as kept and the later one as shadowed

  @test:schemas/kg/graph-typology-node.test.ts::several_checkouts,_in_precedence_order_(kg-separation_lesson_6)::within_ONE_checkout_two_files_claiming_a_name_are_still_refused
  Scenario: Two files in one checkout claiming a name are still refused
    Given a checkout in which alpha and beta both declare "l6-twice", listed after another checkout
    When the registry is asked for "l6-twice"
    Then it throws an error mentioning "declared by"

  @test:schemas/kg/graph-typology-node.test.ts::several_checkouts,_in_precedence_order_(kg-separation_lesson_6)::defaultTypologyRoots:_$REPO_ROOT_alone;_else_the_inspected_checkout_first,_then_the_module's
  Scenario: The default roots are $REPO_ROOT alone, else the inspected checkout then the module's
    Given an inspected checkout, the module's own checkout, and an empty directory
    When the default typology roots are computed
    Then with REPO_ROOT set they are that checkout alone
    And from the inspected checkout they are the inspected checkout, then the module's
    And from the module's checkout, or from a directory holding no instance, they are the module's alone

  @test:schemas/kg/graph-typology-node.test.ts::several_checkouts,_in_precedence_order_(kg-separation_lesson_6)::readDeclaration_registers_typologies_from_the_declaration's_checkout_before_validating_(bean_cat-tools-g7ls)
  Scenario: Reading a declaration registers the kinds of its own checkout first
    Given a registry over a checkout that does not declare "g7ls-contributed"
    And an instance fhir-harness in another checkout whose directory uses "g7ls-contributed", declared there
    When fhir-harness's declaration is read with that registry
    Then it reads with the name "fhir-harness"
    And the registry now has "g7ls-contributed"
    And reading it with a registry of no checkout throws 'unknown graph typology "g7ls-contributed"'

  @test:schemas/kg/graph-typology-node.test.ts::several_checkouts,_in_precedence_order_(kg-separation_lesson_6)::a_lazy_roots_thunk_is_not_evaluated_at_construction_time_—_importing_the_module_touches_no_filesystem_(cat-harness-tools#634)
  Scenario: A lazy roots function is called once, on first use
    Given a registry built with a function returning a checkout that declares "l6-lazy"
    Then the function has not been called
    When the registry is asked whether it has "l6-lazy"
    Then it has, and the function has been called once
    And reading its roots returns that checkout without calling the function again

  @test:schemas/kg/graph-typology-node.test.ts::several_checkouts,_in_precedence_order_(kg-separation_lesson_6)::a_checkout_read_before_a_layer_was_mounted_is_read_again_once_the_layer_is_on_disk_(standing_re-pin,_ig-ast,_2026-11-13)
  Scenario: A checkout read before a layer was mounted is read again once the layer is on disk
    Given a registry over a checkout that does not declare "rescan-ig-ast"
    And a site checkout whose smart-trust declaration uses "rescan-ig-ast", which only its unmounted layer fhir-harness declares
    When smart-trust's declaration is read with that registry
    Then it throws 'unknown graph typology "rescan-ig-ast"'
    When fhir-harness is laid down in the site with a typology node "rescan-ig-ast"
    Then reading smart-trust's declaration gives the name "smart-trust" and the registry has "rescan-ig-ast"
    And reading it once more, with nothing new mounted, still gives "smart-trust" without a conflict
