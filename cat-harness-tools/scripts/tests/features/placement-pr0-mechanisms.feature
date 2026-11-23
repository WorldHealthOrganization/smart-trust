# Placement PR0 (bean ejye): the checkout aggregates, extension by id, concern
# groups for every grouping kind, and Tools naming their own subprocesses,
# each pinned on a throwaway checkout and then held against this one. Each
# Scenario names the test that executes it.
Feature: The placement mechanisms

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::a_corpus-wide_question_sees_every_staged_instance's_member
  Scenario: A corpus-wide question sees every staged instance's member
    Given a checkout whose root needs base and two dependents of it, each with a library
    Then the checkout's library directories are a/library, b/library and base/library

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::the_platform_resolved_ALONE_sees_nothing_above_it_(cmsl_falsifier:_a_split_checkout_sees_less)
  Scenario: The platform resolved alone sees nothing above it
    When base's own declaration chain is resolved
    Then every directory is under base/

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::`corpusDirectoriesForGraph`_is_the_instance_plus_what_is_stacked_on_it_—_never_its_dependencies
  Scenario: The corpus of an instance is itself plus what is stacked on it
    Then base's library corpus is a/library, b/library and base/library
    And a's library corpus is only a/library

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::checkout-level_state_declared_by_the_root_instance_is_reached_from_the_platform
  Scenario: Checkout-level state declared by the root is reached from the platform
    Then base's beans corpus is the root's beans directory

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::dependents_are_found_from_the_checkout,_deepest_first
  Scenario: Dependents are found from the checkout
    Then the dependents of base are a, b and top

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::a_`scope:_repository`_entry_in_a_non-root_instance_is_a_mirror,_and_the_gate_refuses_it
  Scenario: A repository-scoped entry naming another instance's directory is a mirror, refused
    Given base declares a/library at repository scope
    Then base#a-library is a repository mirror and the instance graph gate reports a repository-mirror problem

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::checkout-level_state_a_platform_instance_declares_for_every_checkout_is_not_a_mirror
  Scenario: Checkout-level state a platform instance declares for every checkout is not a mirror
    Given base declares todos/ at repository scope
    Then there are no repository mirrors and no repository-mirror problem

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::two_non-root_instances_claiming_one_repository_path_are_both_reported
  Scenario: Two non-root instances claiming one repository path are both reported
    Given base and b both declare todos at repository scope
    Then the repository mirrors are b#todos-too and base#todos

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::an_instance_the_root_does_not_reach_is_unstaged,_and_the_gate_refuses_it
  Scenario: An instance the root does not reach is unstaged, refused
    Given the root needs only a
    Then an unstaged problem names b

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0a_—_the_checkout_aggregates::a_member's_OWN_declaration_file_is_read:_sci's_skills.json_declares_its_lean/_from_within
  Scenario: A member's own declaration file is read
    Given a's skills/skills.json declares a lean subgraph from within
    Then a's resolved directories hold lean-skills at a/skills/lean, member a, within skills
    And the checkout's directories include a/skills/lean

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::an_extension_ADDS_skills_to_a_lower_role_and_overrides_nothing
  Scenario: An extension adds skills to a lower role and overrides nothing
    When core extends librarian with filing-dublin-core and library-ingestion
    Then librarian's skills are library-ingestion then filing-dublin-core, its title is unchanged
    And the extension recorded only the added skill, and the base graph is not mutated

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::redeclaring_a_lower_role_is_refused_—_extend_it_instead
  Scenario: Redeclaring a lower role with a change is refused
    When core redeclares librarian with another title
    Then it throws saying the role is already declared by base

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::an_extension_may_point_only_DOWN:_at_a_role_declared_below_it
  Scenario: An extension may point only down
    When core extends a role nobody below declares
    Then it throws saying no instance below it declares the role

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::a_higher_instance's_NEW_role_may_inherit_a_lower_one
  Scenario: A higher instance's new role may inherit a lower one
    When sci declares proof-reviewer inheriting reviewer
    Then the roles are librarian, reviewer and proof-reviewer

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::on_a_checkout:_the_platform's_role_graph_gains_a_dependent's_extension;_identical_without_one
  Scenario: On a checkout the platform's role graph gains a dependent's extension
    Given base's roles and a's extension of librarian on disk
    Then the checkout role graph of base gives librarian library-ingestion and filing-dublin-core
    And b, with no role graph, has none

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::actors:_an_extension_adds_roles_and_capabilities;_a_new_id_is_a_new_actor;_a_redeclared_id_is_refused
  Scenario: An actor extension adds roles and capabilities; a new id is new; a redeclared id is refused
    Given base's actor claude and a's extension of it plus a new actor lean-mcp
    Then claude has both roles and both capabilities and is still an agent, and the actors are claude and lean-mcp
    And once a also declares a second actor with id claude, reading the actors throws saying it is already declared below

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::an_actor_extension_may_not_carry_anything_but_roles_and_capabilities
  Scenario: An actor extension may carry only roles and capabilities
    Given a's extension of claude sets kind
    Then reading the actors throws saying the extension may not carry kind

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0b_—_roles,_actors_and_capabilities_extended_by_id::capabilities:_a_new_probe_is_added,_an_extension_adds_`requires`,_a_redeclared_id_is_refused
  Scenario: A new capability is added, an extension adds requires, a redeclared id is refused
    Given base's python3 capability, a's new lean-toolchain, and a's extension of python3 requiring pip
    Then the capabilities are lean-toolchain and python3, and python3 requires pip

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0c_—_concern_groups_for_every_grouping_kind::the_grouping_kinds_are_read_from_the_registry:_skills,_processes,_schemas,_library,_uml_and_code_(tests)
  Scenario: The grouping kinds are read from the registry
    Then the grouping kinds are code, library, processes, schemas, skills and uml

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0c_—_concern_groups_for_every_grouping_kind::a_kind's_declaration_file_names_its_groups_by_code,_and_a_declared-but-absent_group_throws
  Scenario: A kind's declaration file names its groups, and a declared-but-absent group throws
    Given base/processes/processes.json declares sdlc, which exists
    Then the declared groups are sdlc at sdlc
    And once it also declares kg, which does not exist, reading them throws naming kg/

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0c_—_concern_groups_for_every_grouping_kind::a_group_declared_once_below_is_INHERITED:_the_dependent's_same-named_directory_is_a_member
  Scenario: A group declared once below is inherited by the dependent's same-named directory
    Given base declares the skills topic library, and a has skills/library/cataloguing
    Then a's package is library/cataloguing in topic library
    And the resolved skills groups are one library group declared by base with members base and a

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0c_—_concern_groups_for_every_grouping_kind::the_same_walk_serves_processes:_a_dependent's_`processes/<group>/`_is_grouped_too
  Scenario: The same walk groups a dependent's processes
    Given base declares the processes group tools, and b has processes/tools/my-tool
    Then b's grouped child is tools/my-tool in group tools

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0c_—_concern_groups_for_every_grouping_kind::a_dependent_that_REDECLARES_a_group_is_reported:_a_higher_instance_adds_no_group_of_its_own
  Scenario: A dependent that redeclares a group is reported
    Given base and a both declare the processes group sdlc
    Then sdlc is declared by base and redeclared by a

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::0c_—_concern_groups_for_every_grouping_kind::the_declaration_shape_is_strict
  Scenario: The concern groups declaration shape is strict
    Then a list of group codes is valid
    And a code with a slash, or an extra topics key, is refused

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::ruling_6_—_a_Tool_may_describe_its_own_specific_subprocesses::`subprocesses`_takes_process_ids
  Scenario: A Tool's subprocesses take process ids
    Then a Tool naming the subprocess probe-retry-loop is valid
    And one naming "Not An Id" is refused

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::this_checkout::no_instance_but_the_root_declares_a_repository-scoped_entry,_and_every_instance_is_staged
  Scenario: In this checkout no non-root instance mirrors, and every instance is staged
    Then this checkout has no repository mirrors, and the instance graph gate reports no unstaged or repository-mirror problem

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::this_checkout::falsifier_1:_the_corpus-wide_answer_still_holds_every_dependent's_skills_and_diagrams
  Scenario: The corpus-wide answer holds every dependent's skills and diagrams
    Then the checkout's known skills include one skill of each former mirror owner
    And its workflow files include the DIIG investment diagram in either of its places, and core's deep-document-research diagram

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::this_checkout::falsifier_2:_the_platform_resolved_alone_names_nothing_above_it
  Scenario: The platform resolved alone names nothing above it
    Then the platform declares at least one repository-scoped root, none of which is an instance
    And resolved alone it names no directory outside the platform layers and those roots
    And its own known skills do not include lean-formal-edges

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::this_checkout::the_five_libraries_the_mirrors_named_are_all_in_the_corpus
  Scenario: The five libraries the mirrors named are in the corpus
    Then the platform's library corpus holds cat-harness's, folio-assistant-core's, folio-assistant-sci's, smart-base's and who-iris's libraries

  @test:scripts/tests/placement-pr0-mechanisms.test.ts::this_checkout::concern_groups_are_clean:_codes_of_the_list,_declared_once
  Scenario: Concern groups are clean and declared once
    When the concern groups are checked
    Then there are no problems and the codes are sdlc, process, tools, kg, library, content, ui and conduct
