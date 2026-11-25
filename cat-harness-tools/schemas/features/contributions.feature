# schemas/content/contributions.ts keeps the registry of block kinds, adapters, tools,
# QA checkers and renderers that dependencies contribute, refusing collisions, and
# loadContributions reads them from declared nodes. Each Scenario names the test that executes it.
Feature: Contribution registry and loader

  @test:schemas/contributions.test.ts::ContributionRegistry::accepts_a_contribution_and_reports_what_it_added
  Scenario: A registered contribution exposes its kind, adapter module and tools
    Given a contribution "folio-asst-sci" with block kind "knot-diagram" for adapter "sci", adapter module "./index.ts" and tool "lean"
    When it is registered
    Then the owner of "knot-diagram" is "sci"
    And the module of adapter "sci" is "./index.ts"
    And the contributed tools are exactly "lean"

  @test:schemas/contributions.test.ts::ContributionRegistry::is_idempotent_for_the_same_contributor_—_a_DIAMOND_is_not_a_collision
  Scenario: Registering the same contributor twice is not a collision
    Given the "folio-asst-sci" contribution is registered
    When it is registered again
    Then nothing throws
    And there is still one contributed kind

  @test:schemas/contributions.test.ts::ContributionRegistry::REFUSES_a_kind_claimed_by_a_different_contributor,_naming_both
  Scenario: A kind claimed by a second contributor is refused, naming both
    Given "folio-asst-sci" has registered kind "knot-diagram"
    When "smart-base" registers "knot-diagram" for adapter "dak"
    Then a ContributionCollisionError is thrown
    And its message names "folio-asst-sci" and "smart-base"

  @test:schemas/contributions.test.ts::ContributionRegistry::refuses_a_kind_the_platform_already_owns
  Scenario: A contributed kind the platform already owns is refused
    Given an empty registry
    When "rogue" registers the built-in kind "theorem"
    Then a ContributionCollisionError is thrown

  @test:schemas/contributions.test.ts::ContributionRegistry::refuses_an_adapter_name_the_platform_already_owns
  Scenario: A contributed adapter named like a platform adapter is refused
    Given an empty registry
    When "rogue" registers an adapter named after the first built-in content adapter
    Then a ContributionCollisionError is thrown

  @test:schemas/contributions.test.ts::ContributionRegistry::carries_a_contributed_kind's_builder,_label_prefix_and_JSON-LD_types
  Scenario: A contributed kind carries its builder, label prefix and JSON-LD types
    Given "smart-base" contributes "decision-table" with builder "decisionTable", label prefix "dt", folioType "x:DT" and docoType "doco:Table"
    And contributes "persona" with only label prefix "pers"
    When the kind entries are read
    Then "decision-table" carries adapter "dak" and all four of those fields
    And "persona" has builder "persona" and no docoType
    And the contributed builders are "decisionTable" for "decision-table" and "persona" for "persona"
    And the contributed label prefixes are "dt" and "pers"
    And the built-in kind "theorem" has no entry

  @test:schemas/contributions.test.ts::ContributionRegistry::refuses_a_contributed_builder_that_is_a_built-in_builder
  Scenario: A contributed builder named like a built-in builder is refused
    Given an empty registry
    When "rogue" contributes kind "my-thm" with builder "theorem"
    Then a ContributionCollisionError is thrown

  @test:schemas/contributions.test.ts::ContributionRegistry::refuses_one_builder_claimed_for_two_contributed_kinds
  Scenario: One builder claimed for two contributed kinds is refused
    Given contributor "a" registered kind "k-one" with builder "kOne"
    When contributor "b" registers kind "k-two" with builder "kOne"
    Then a ContributionCollisionError is thrown

  @test:schemas/contributions.test.ts::ContributionRegistry::accepts_`dak`_as_a_contributed_adapter_now_that_core_does_not_build_it_in
  Scenario: dak is accepted as a contributed adapter with its companion roles
    Given "smart-base" contributes adapter "dak" with companion roles "ts" and "dmn"
    When it is registered
    Then the contributed adapters are exactly "dak"
    And the companion roles of "dak" are "ts" and "dmn"
    And the companion roles of an uncontributed adapter "nobody" are undefined

  @test:schemas/contributions.test.ts::ContributionRegistry::refuses_a_tool_group_claimed_by_a_different_contributor
  Scenario: A tool group claimed by a second contributor is refused
    Given "folio-asst-sci" has registered tool group "lean"
    When "other" registers tool group "lean"
    Then a ContributionCollisionError is thrown

  @test:schemas/contributions.test.ts::ContributionRegistry::runs_every_contributed_tool_registrar_against_the_server
  Scenario: Every contributed tool registrar runs against the server
    Given contributor "a" with tool "lean" and contributor "b" with tool "fsh", each recording its call
    When the registry registers tools on a server
    Then both "fsh" and "lean" registrars have run

  @test:schemas/contributions.test.ts::composedKindOwner::consults_the_platform_first,_the_registry_second
  Scenario: The platform's kind owner is consulted before the registry's
    Given a registry where "sci" contributes "knot-diagram"
    When the composed owner of "theorem" is asked
    Then it is the platform's adapter for "theorem", which is a built-in content adapter
    And the composed owner of "knot-diagram" is "sci"

  @test:schemas/contributions.test.ts::composedKindOwner::returns_undefined_for_an_unknown_kind_—_never_a_guess
  Scenario: An unknown kind has no composed owner
    Given an empty registry
    When the composed owner of "nonsense" is asked
    Then it is undefined

  @test:schemas/contributions.test.ts::loadContributions_—_the_Phase_0.1_gate::a_dependency_contributes_a_block_kind,_an_adapter_and_a_QA_checker
  Scenario: A dependency's declared nodes contribute a block kind, an adapter and a QA checker
    Given a root folio whose dependency "dep-sci" declares block kind "knot-diagram", adapter "sci" and QA checker "knot-well-formed" as nodes
    When contributions are loaded from the root
    Then the owner of "knot-diagram" is "sci"
    And the module of adapter "sci" is "adapters/sci/index.ts"
    And a QA checker entry exists for "knot-well-formed"

  @test:schemas/contributions.test.ts::loadContributions_—_the_Phase_0.1_gate::the_dependency's_declared_name_wins_over_whatever_the_module_claims
  Scenario: A loaded kind's contributor is the dependency's declared name
    Given the root folio with dependency "dep-sci"
    When contributions are loaded
    Then the first contributed kind's contributor is "dep-sci"

  @test:schemas/contributions.test.ts::loadContributions_—_the_Phase_0.1_gate::the_dependency_entry's_ROOT_wins_too,_so_a_checker_hashes_the_right_bytes
  Scenario: A loaded checker's root is the dependency entry's path
    Given the root folio with dependency "dep-sci"
    When contributions are loaded
    Then the "knot-well-formed" checker entry's root is the dep-sci directory
    And its label is "dep-sci/checks/knots.ts"

  @test:schemas/contributions.test.ts::loadContributions_—_the_Phase_0.1_gate::a_declared_checker_whose_code_is_missing_fails_loudly
  Scenario: A declared checker whose code file is missing fails the load
    Given a root whose dependency declares checker "gone" at "checks/nope.ts", which does not exist
    When contributions are loaded from it
    Then loading rejects with an error saying the file "does not exist"

  @test:schemas/contributions.test.ts::loadContributions_—_the_Phase_0.1_gate::a_folio_with_no_dependencies_loads_an_empty_registry,_not_an_error
  Scenario: A folio with no dependencies loads an empty registry
    Given a bare folio config with contentType "document" and no dependencies
    When contributions are loaded from it
    Then the contributed kinds are empty

  @test:schemas/contributions.test.ts::contributed_QA_checkers::a_dependency's_checker_is_reachable_by_the_criterion_it_answers
  Scenario: A contributed checker is reachable by its criterion
    Given "smart-base" with root "/deps/smart-base" contributes a checker for "dak-bpmn-has-process" from "pipeline/checkers.ts"
    When it is registered
    Then a checker is found for "dak-bpmn-has-process"
    And the contributed checker listing is that criterion, contributor "smart-base" and label "smart-base/pipeline/checkers.ts"

  @test:schemas/contributions.test.ts::contributed_QA_checkers::an_unimplemented_criterion_is_undefined,_never_a_default_pass
  Scenario: An unimplemented criterion has no checker and no entry
    Given an empty registry
    Then the checker and the checker entry for "nobody-implements-this" are both undefined

  @test:schemas/contributions.test.ts::contributed_QA_checkers::the_entry_carries_where_the_bytes_are,_so_the_verdict_can_go_stale
  Scenario: A checker entry records its source file and root
    Given "smart-base" contributes a checker for "dak-bpmn-has-process" from "pipeline/checkers.ts"
    When its entry is read
    Then it holds the check function, sourceFile "pipeline/checkers.ts", root "/deps/smart-base" and label "smart-base/pipeline/checkers.ts"

  @test:schemas/contributions.test.ts::contributed_QA_checkers::qaCheckers_without_a_root_is_refused,_naming_the_contributor
  Scenario: QA checkers from a contribution with no root are refused
    Given a "smart-base" contribution with a QA checker but no root
    When it is registered
    Then it throws saying "smart-base" supplies qaCheckers but no root

  @test:schemas/contributions.test.ts::contributed_QA_checkers::two_contributors_claiming_one_criterion_throws,_naming_both
  Scenario: Two contributors claiming one criterion are refused, naming both
    Given "smart-base" has registered a checker for "shared"
    When "folio-asst-sci" registers a checker for "shared"
    Then it throws naming both "smart-base" and "folio-asst-sci"

  @test:schemas/contributions.test.ts::contributed_QA_checkers::the_same_contributor_re-registering_is_a_no-op,_so_a_diamond_loads
  Scenario: Re-registering the same checker contributor is a no-op
    Given a "smart-base" checker contribution is registered
    When the same contribution is registered again
    Then nothing throws
    And there is still one contributed checker

  @test:schemas/contributions.test.ts::contributed_renderers::a_render_target_is_reachable_by_format_and_by_adapter
  Scenario: A render target is reachable by format and by adapter
    Given "folio-asst-sci" contributes a "latex" renderer for adapter "paper"
    When it is registered
    Then a renderer is found for "latex"
    And one renderer is listed for adapter "paper"

  @test:schemas/contributions.test.ts::contributed_renderers::an_adapter_with_no_contributed_target_gets_a_DETERMINED_empty
  Scenario: An adapter with no contributed renderer gets an empty list
    Given "folio-asst-sci" contributes only the "latex" renderer for "paper"
    When renderers for "dak" are asked
    Then the result is an empty list

  @test:schemas/contributions.test.ts::contributed_renderers::a_target_may_render_without_validating,_and_says_so_by_omission
  Scenario: A renderer without validate is registered with no validator
    Given "folio-assist-core" contributes a "markdown" renderer with no validate function
    When the "markdown" renderer is read
    Then its validate is undefined
    And its render is defined

  @test:schemas/contributions.test.ts::contributed_renderers::two_contributors_claiming_one_format_throws,_naming_both
  Scenario: Two contributors claiming one render format are refused, naming both
    Given "folio-asst-sci" has registered the "latex" renderer
    When "other" registers a "latex" renderer
    Then it throws naming both "folio-asst-sci" and "other"

  @test:schemas/contributions.test.ts::contributed_renderers::the_same_contributor_re-registering_is_a_no-op,_so_a_diamond_loads
  Scenario: Re-registering the same renderer contributor is a no-op
    Given a "folio-asst-sci" renderer contribution is registered
    When the same contribution is registered again
    Then nothing throws
    And there is still one contributed renderer

  @test:schemas/contributions.test.ts::contributed_renderers::the_listing_names_the_format,_its_adapters_and_its_contributor
  Scenario: The renderer listing names the format, adapters and contributor
    Given "folio-asst-sci" contributes the "latex" renderer for "paper"
    When contributed renderers are listed
    Then the listing is format "latex", adapters "paper", contributor "folio-asst-sci"
