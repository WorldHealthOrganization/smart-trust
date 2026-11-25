# The harness's Tool nodes (tools/discover.ts, schemas/tools/tool.ts, scripts/check-tools.ts) are
# real, well-formed and agree with the skills, types and schemas they name. Each Scenario names the test that executes it.
Feature: Tool nodes are well-formed and reachable

  @test:scripts/tests/tools/tools.test.ts::tools::there_are_tools_to_check_—_otherwise_everything_below_is_vacuous
  Scenario: There are Tools to check
    When the Tools are discovered
    Then there are at least 4

  @test:scripts/tests/tools/tools.test.ts::tools::every_satisfies_edge_agrees_with_its_skill's_own_input_contract
  Scenario: Every satisfies edge meets its skill's input contract
    When checkTools runs over the repository
    Then it reports no unmet contracts

  @test:scripts/tests/tools/tools.test.ts::tools::where_a_Tool_input_and_a_contract_property_share_a_name,_their_types_agree
  Scenario: A Tool input and a same-named contract property agree on type
    When checkTools runs over the repository
    Then it reports no mistyped contracts

  @test:scripts/tests/tools/tools.test.ts::tools::a_contract_that_is_present_but_unreadable_is_never_counted_as_agreement
  Scenario: No contract is unreadable, and no contract differs from an empty one
    # Gap: no unreadable contract is planted, so the unreadable path is not exercised.
    When checkTools runs over the repository
    Then it reports no unreadable contracts
    And contractRequires is undefined for "no-such-skill-exists"
    And contractRequires for "content-validate" includes "targetPath"

  @test:scripts/tests/tools/tools.test.ts::tools::every_skill_I/O_contract_publishes_at_the_address_its_own_$id_claims
  Scenario: Every skill I/O contract publishes at its own $id
    When the skill I/O contracts are built at base "https://example.invalid/fa"
    Then there is at least one
    And each $id is the skill I/O IRI for its skill and direction under the host's base
    And each published path under the host's base equals its $id

  @test:scripts/tests/tools/tools.test.ts::tools::no_source_$id_has_drifted_from_where_it_publishes
  Scenario: No source skill I/O $id is stale
    Then staleSkillIoIds reports nothing

  @test:scripts/tests/tools/tools.test.ts::tools::every_io_port_references_a_type_the_shared_vocabulary_declares
  Scenario: Every io port names a declared Tool type
    When checkTools runs over the repository
    Then it reports no unknown types

  @test:scripts/tests/tools/tools.test.ts::tools::io_references_are_absolute_IRIs_into_the_published_types_document
  Scenario: io references are absolute IRIs into the types document
    Given the Tool types document built at the test base
    Then it defines exactly as many types as TOOL_TYPES
    And every Tool port's schema starts with "https://"
    And names a type the document defines

  @test:scripts/tests/tools/tools.test.ts::tools::a_Tool_reachable_only_over_MCP_is_rejected
  Scenario: A Tool whose only invoke arm is MCP is rejected
    Given a Tool whose invoke is only an mcp tool
    Then ToolDefinitionSchema refuses it
    And the same Tool with a shell arm added parses

  @test:scripts/tests/tools/tools.test.ts::tools::a_Tool_satisfying_nothing_is_rejected
  Scenario: A Tool satisfying nothing is rejected
    Given a Tool with an empty satisfies
    Then ToolDefinitionSchema refuses it

  @test:scripts/tests/tools/tools.test.ts::tools::the_beans_pair_satisfies_exactly_the_same_skills
  Scenario: The beans pair satisfies the same skills
    Then "beans-manual" and "beans-cli" satisfy the same set of skills

  @test:scripts/tests/tools/tools.test.ts::tools::the_generated_schemas_carry_an_absolute_$id
  Scenario: The generated Tool schemas carry an absolute $id
    When the Tool schema and Tool types schema are built at the test base
    Then their $ids are "<base>/cat-harness/tool.schema.json" and "<base>/cat-harness/tool-types.schema.json"

  @test:scripts/tests/tools/tools.test.ts::tools::each_type_is_its_own_document,_whose_$id_is_the_IRI_a_port_names_(bean_tdir)
  Scenario: Each Tool type is its own document at the IRI a port names
    When the per-type files are built at the test base
    Then there is one "tool-types/<Name>.schema.json" per Tool type
    And each document's $id is its type document IRI and its published path under the host's base
    And each body equals that type's entry in the combined document
    And every Tool port names one of the types

  @test:scripts/tests/tools/tools.test.ts::tools::skill_discovery_is_the_ONE_definition,_not_a_second_scan
  Scenario: check-tools' skill set is the canonical skill discovery
    When check-tools' knownSkills and the canonical knownSkills for the harness layer are compared
    Then neither holds a skill the other lacks
    And "the-complement" is not a skill
    And "confirm-harness" and "log-message" are not this layer's skills
    And "log-message" is a skill of the bootstrap layer

  @test:scripts/tests/tools/tools.test.ts::tools::io_IRIs_follow_the_publication_base,_not_the_declaration
  Scenario: io IRIs follow the publication base
    Given a knowledge-graph export built at a staging base
    Then it holds at least 4 Tool nodes
    And every port's schema starts with the staging host's "tool-types"
    And equals the Tool type IRI minted at that staging base

  @test:scripts/tests/tools/tools.test.ts::tools::tools()_honours_an_explicit_base
  Scenario: tools() mints port IRIs at an explicit base
    When tools() is called with "https://example.invalid/other"
    Then every port's schema starts with that host's "tool-types"

  @test:scripts/tests/tools/tools.test.ts::substitutable_Tools_are_DERIVED,_and_say_how_to_choose_(#1168,_B9a)::the_derived_pairs_are_exactly_the_substitutable_ones
  Scenario: The derived alternative pairs are exactly the expected list
    When alternatives are derived from all Tools
    Then the pairs are the beans, GitHub/GitLab forge, ingest, release, serve-rendering and transcribe pairs
    And the glossary-table and memory pairs only where those Tools are loaded

  @test:scripts/tests/tools/tools.test.ts::substitutable_Tools_are_DERIVED,_and_say_how_to_choose_(#1168,_B9a)::the_relation_is_symmetric_by_construction
  Scenario: The alternative relation is symmetric
    Then for every Tool B listed as an alternative of A, A is an alternative of B

  @test:scripts/tests/tools/tools.test.ts::substitutable_Tools_are_DERIVED,_and_say_how_to_choose_(#1168,_B9a)::every_Tool_with_an_alternative_carries_all_three_selection_fields
  Scenario: Every Tool with an alternative carries when, limits and cost
    Then each Tool with a derived alternative has selection "when", "limits" and "cost"

  @test:scripts/tests/tools/tools.test.ts::substitutable_Tools_are_DERIVED,_and_say_how_to_choose_(#1168,_B9a)::check-tools_reports_a_Tool_with_an_alternative_and_no_selection
  Scenario: check-tools reports an alternative with no selection
    Given checkTools reports no unselectable alternatives on the real set
    When "ingest-stdlib" loses its selection
    Then alternativesWithoutSelection reports "ingest-stdlib" with alternative "ingest-extended"

  @test:scripts/tests/tools/tools.test.ts::substitutable_Tools_are_DERIVED,_and_say_how_to_choose_(#1168,_B9a)::sharing_a_skill_does_NOT_imply_substitutability
  Scenario: Tools sharing a skill are not thereby alternatives
    Given more than one Tool satisfies "process-state"
    Then none of them has a derived alternative

  @test:scripts/tests/tools/tools.test.ts::substitutable_Tools_are_DERIVED,_and_say_how_to_choose_(#1168,_B9a)::an_empty_signature_is_interchangeable_with_nothing
  Scenario: Tools with empty io signatures are not alternatives
    Given two Tools with no inputs and no outputs
    When alternatives are derived from them
    Then there are none

  @test:scripts/tests/tools/tools.test.ts::substitutable_Tools_are_DERIVED,_and_say_how_to_choose_(#1168,_B9a)::the_ingest_pair_is_derived,_and_splits_on_the_dependency_boundary
  Scenario: The ingest pair splits on the dependency boundary
    Given "ingest-stdlib" and "ingest-extended" exist
    Then "ingest-stdlib" installs with none and "ingest-extended" with a CLI
    And they satisfy the same skills
    And each one's selection limits names the other

  @test:scripts/tests/tools/tools.test.ts::the_gates_Tool_—_one_node_over_a_derived_list::the_node_exists,_or_nothing_below_is_testing_anything
  Scenario: The gates Tool exists
    Then a Tool with id "gates" is declared

  @test:scripts/tests/tools/tools.test.ts::the_gates_Tool_—_one_node_over_a_derived_list::its_command_is_a_real_script,_not_a_guess_at_one
  Scenario: The gates Tool's command is a real script
    Then its shell invoke is "bun run cat gates"
    And the repository's "gates" script runs "scripts/gates.ts"

  @test:scripts/tests/tools/tools.test.ts::the_gates_Tool_—_one_node_over_a_derived_list::every_flag_it_declares_is_one_`gates.ts`_actually_reads
  Scenario: Every gates flag is read by gates.ts
    Then the gates Tool's flag inputs are "--all" and "--list"
    And the source of scripts/gates.ts checks process.argv for each

  @test:scripts/tests/tools/tools.test.ts::the_gates_Tool_—_one_node_over_a_derived_list::there_is_exactly_ONE_gate_Tool,_and_the_list_stays_derived
  Scenario: There is exactly one gate Tool
    # Gap: only counts gate-named Tools; does not check that the gate list is derived.
    Then the only Tool named "gates" or starting "gate-" is "gates"

  @test:scripts/tests/tools/tools.test.ts::the_gates_Tool_—_one_node_over_a_derived_list::it_says_why_it_exists_where_CI_does_not,_which_is_the_whole_business_case
  Scenario: The gates Tool says why it exists where CI does not
    Then its selection has "when", "limits" and "cost"
    And its selection when contains "INHERITED"
    And it does not need the network

  @test:scripts/tests/tools/tools.test.ts::storage.tool_names_a_declared_Tool_(bean_j9cs)::the_repository's_own_declarations_name_only_declared_Tools
  Scenario: The repository's storage declarations name only declared Tools
    Then danglingStorageTools reports nothing

  @test:scripts/tests/tools/tools.test.ts::storage.tool_names_a_declared_Tool_(bean_j9cs)::a_store_naming_no_declared_Tool_is_reported,_with_where_it_was_declared
  Scenario: A store naming an undeclared Tool is reported with its location
    Given a layer "inst" with a directory "site" whose storage tool is "no-such-tool" and one "ok" using "gh-pages"
    When danglingStorageTools runs over it
    Then it reports only instance "inst", directory "site", tool "no-such-tool"
