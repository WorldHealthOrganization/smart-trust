# Specifies schemas/process/role-graph.ts: readRoleGraph (the strict role
# graph, including roles inherited from instances it needs), the skill
# closure (resolveRoleSkills) and subprocess composition (resolveRoleStack),
# how a BPMN lane names its role (roleForLane, laneRoleRef, laneBinding),
# mechanical roles, readActors and readPermissions, the three actor kinds and
# which may fulfil a BPMN activity, and lane holding (laneNeeded, electHolder,
# isStalled). Several scenarios read this repository's own role graph, actor
# registry, permission vocabulary and capability probes.
Feature: An actor performs a task in a process as a role, using that role's skills

  @test:schemas/process/role-graph.test.ts::readRoleGraph::absent_declaration_is_undefined,_not_an_error
  Scenario: An absent role graph reads as undefined
    Given a directory with no role graph declaration
    When its role graph is read
    Then the result is undefined

  @test:schemas/process/role-graph.test.ts::readRoleGraph::a_declaration_nobody_can_parse_throws_rather_than_reading_as_empty
  Scenario: A role graph that is not JSON throws
    Given a role graph file holding "{ not json"
    When it is read
    Then it throws saying it is not valid JSON

  @test:schemas/process/role-graph.test.ts::readRoleGraph::a_dangling_`inherits`_is_refused_at_read,_so_no_closure_is_silently_short
  Scenario: A dangling inherits is refused at read
    Given a role "a" inheriting "ghost", which is not declared
    When the role graph is read
    Then it throws naming inherits "ghost"

  @test:schemas/process/role-graph.test.ts::readRoleGraph::a_role_carrying_`voice`_or_`useCases`_is_refused_—_each_points_at_the_role_now_(#1168)
  Scenario: A role carrying voice or useCases is refused
    Given a role carrying "voice", and a role carrying "useCases"
    When each role graph is read
    Then each throws, naming the key or saying it is not a valid role graph

  @test:schemas/process/role-graph.test.ts::readRoleGraph::an_unknown_key_on_a_ROLE_is_refused,_not_stripped
  Scenario: An unknown key on a role is refused, not stripped
    Given a role carrying "summary"
    When the role graph is read
    Then it throws, naming "summary" or saying it is not a valid role graph

  @test:schemas/process/role-graph.test.ts::readRoleGraph::a_`_`-prefixed_documentation_key_is_legal,_on_a_role_and_above_it
  Scenario: Underscore documentation keys are legal on a role and above it
    Given a role graph with "_comment" and "_lanes_comment" at its top, and a role "a" with "_comment"
    When it is read
    Then its roles are "a"
    And the role carries no "_comment" in the parsed value

  @test:schemas/process/role-graph.test.ts::readRoleGraph::a_duplicate_role_id_is_refused
  Scenario: A duplicate role id is refused
    Given two roles with id "a"
    When the role graph is read
    Then it throws saying the role is declared twice

  @test:schemas/process/role-graph.test.ts::readRoleGraph::an_inheritance_cycle_is_refused_rather_than_defended_against_at_call_sites
  Scenario: An inheritance cycle is refused
    Given role "a" inheriting "b" and role "b" inheriting "a"
    When the role graph is read
    Then it throws mentioning a cycle

  @test:schemas/process/role-graph.test.ts::readRoleGraph::an_unknown_actorKind_is_rejected,_not_accepted_and_ignored
  Scenario: An unknown actor kind is refused
    Given a role whose actor kinds are "wizard"
    When the role graph is read
    Then it throws

  @test:schemas/process/role-graph.test.ts::resolveRoleSkills::closes_over_`inherits`_transitively
  Scenario: A role's skills close over inherits transitively
    Given roles viewer (skill read), reviewer (skill review, inherits viewer) and editor (skill commit, inherits reviewer)
    When the skills of "editor" are resolved
    Then they are commit, read and review

  @test:schemas/process/role-graph.test.ts::resolveRoleSkills::reports_which_role_supplied_each_skill,_nearest_ancestor_first
  Scenario: Each resolved skill names the role that supplied it
    Given the viewer, reviewer and editor roles
    When the skills of "editor" are resolved
    Then commit comes via editor, review via reviewer and read via viewer

  @test:schemas/process/role-graph.test.ts::resolveRoleSkills::an_unknown_role_resolves_to_nothing_rather_than_throwing
  Scenario: An unknown role resolves to no skills
    Given the viewer, reviewer and editor roles
    When the skills of "ghost" are resolved
    Then there are none

  @test:schemas/process/role-graph.test.ts::resolveRoleStack_—_subprocess_composition_is_NOT_inheritance::an_actor_descending_into_a_subprocess_keeps_the_outer_role's_skills
  Scenario: Descending into a subprocess keeps the outer role's skills
    Given the viewer, reviewer and editor roles
    When the role stack editor then viewer is resolved
    Then its skills are commit, read and review

  @test:schemas/process/role-graph.test.ts::resolveRoleStack_—_subprocess_composition_is_NOT_inheritance::the_inner_role_does_not_permanently_acquire_the_caller's_skills
  Scenario: The inner role does not keep the caller's skills
    Given the viewer, reviewer and editor roles
    When the role stack editor then viewer is resolved
    Then the skills of "viewer" alone are still only read

  @test:schemas/process/role-graph.test.ts::resolveRoleStack_—_subprocess_composition_is_NOT_inheritance::an_unresolvable_role_in_the_path_is_kept_and_flagged,_not_dropped
  Scenario: An unresolvable role in the stack is kept and flagged
    Given the viewer, reviewer and editor roles
    When the role stack editor then ghost is resolved
    Then "ghost" is listed unresolved
    And the path is still editor then ghost

  @test:schemas/process/role-graph.test.ts::roleForLane::a_lane's_name_alone_binds_nothing:_roles_list_no_lanes_(#1168)
  Scenario: A lane's name alone binds no role
    Given the viewer, reviewer and editor roles
    When the role for lane "Reviewer" is found with no role ref
    Then there is none

  @test:schemas/process/role-graph.test.ts::roleForLane::the_lane's_explicit_role_ref_is_what_binds_it
  Scenario: A lane's explicit role ref binds it
    Given the viewer, reviewer and editor roles
    When the role for lane "Review Committee" with ref "editor" is found
    Then it is "editor"

  @test:schemas/process/role-graph.test.ts::roleForLane::an_explicit_ref_naming_no_role_resolves_to_nothing_—_it_is_not_silently_name-matched
  Scenario: An explicit ref naming no role binds nothing
    Given the viewer, reviewer and editor roles
    When the role for lane "Review Committee" with ref "ghost" is found
    Then there is none

  @test:schemas/process/role-graph.test.ts::roleForLane::an_unbound_lane_name_is_undefined,_which_is_the_finding_the_audit_reports
  Scenario: An unbound lane name has no role
    Given the viewer, reviewer and editor roles
    When the role for lane "Some New Lane" is found with no role ref
    Then there is none

  @test:schemas/process/role-graph.test.ts::laneRoleRef_—_a_lane_names_its_Role_by_partitionElementRef_(owner,_2026-10-16)::partitionElementRef,_resolved_by_moddle_to_the_<bpmn:resource>,_is_the_role_id
  Scenario: A lane's partitionElementRef resolved to a resource is its role
    Given a lane whose partitionElementRef is the resource "build-pipeline"
    When its role ref is read
    Then it is "build-pipeline" from partitionElementRef, and the performer does not vary

  @test:schemas/process/role-graph.test.ts::laneRoleRef_—_a_lane_names_its_Role_by_partitionElementRef_(owner,_2026-10-16)::an_unresolved_partitionElementRef_id_string_reads_the_same
  Scenario: An unresolved partitionElementRef string reads the same
    Given a lane whose partitionElementRef is the string "editor"
    When its role ref is read
    Then it is "editor"

  @test:schemas/process/role-graph.test.ts::laneRoleRef_—_a_lane_names_its_Role_by_partitionElementRef_(owner,_2026-10-16)::the_legacy_<bootstrap.processes:role_ref>_is_still_read,_with_a_warning
  Scenario: The legacy role extension is still read, with a warning
    Given a lane with a bootstrap.processes:role extension naming "editor"
    When its role ref is read
    Then it is "editor" from the legacy role ref
    And the warning says it is deprecated

  @test:schemas/process/role-graph.test.ts::laneRoleRef_—_a_lane_names_its_Role_by_partitionElementRef_(owner,_2026-10-16)::the_legacy_element_is_matched_by_local_name,_whatever_prefix_the_reader_registered
  Scenario: The legacy role extension is matched by local name, whatever its prefix
    Given lanes with a role extension naming "editor" under the prefixes folio, bootstrap.processes, x and a.b.c
    When each one's role ref is read
    Then each one's source is the legacy role ref, naming "editor"
    And extensions whose local name is roles, notrole or role-ref bind nothing

  @test:schemas/process/role-graph.test.ts::laneRoleRef_—_a_lane_names_its_Role_by_partitionElementRef_(owner,_2026-10-16)::partitionElementRef_wins_over_a_disagreeing_legacy_ref,_and_says_so
  Scenario: partitionElementRef wins over a disagreeing legacy ref
    Given a lane whose partitionElementRef is "editor" and whose legacy role extension names "reviewer"
    When its role ref is read
    Then it is "editor"
    And the warning says partitionElementRef wins

  @test:schemas/process/role-graph.test.ts::laneRoleRef_—_a_lane_names_its_Role_by_partitionElementRef_(owner,_2026-10-16)::variable="true"_is_a_declaration,_not_a_legacy_binding
  Scenario: variable="true" declares a varying performer, not a binding
    Given a lane with a bootstrap.processes:role extension carrying variable "true"
    When its role ref is read
    Then it has source "none" and the performer varies

  @test:schemas/process/role-graph.test.ts::laneRoleRef_—_a_lane_names_its_Role_by_partitionElementRef_(owner,_2026-10-16)::feeds_laneBinding_unchanged
  Scenario: A lane's role ref feeds laneBinding
    Given the viewer, reviewer and editor roles, and a lane whose partitionElementRef is "editor"
    When the lane's binding is found from its role ref
    Then it is "bound"

  @test:schemas/process/role-graph.test.ts::mechanical_roles_are_real_roles_(owner,_2026-10-16)::no_role_carries_the_retired_`actedUpon`;_a_layer_still_carrying_it_loads,_with_the_flag_dropped
  Scenario: No role carries the retired actedUpon, and a graph still carrying it loads without it
    Given this repository's own role graph
    Then no role in it carries "actedUpon"
    And a role graph whose one role "c" carries actedUpon true reads with role "c" and no "actedUpon"

  @test:schemas/process/role-graph.test.ts::mechanical_roles_are_real_roles_(owner,_2026-10-16)::every_mechanical_role_carries_at_least_one_skill_—_its_contract
  Scenario: Every mechanical role in this repository carries a skill
    Given this repository's own role graph
    Then no mechanical role has an empty skill list

  @test:schemas/process/role-graph.test.ts::mechanical_roles_are_real_roles_(owner,_2026-10-16)::a_mechanical_role_is_not_an_audience;_a_performed_one_is
  Scenario: A mechanical role is not an audience; a performed one is
    Given this repository's own role graph
    Then the audience problem for "corpus" mentions "mechanical"
    And there is no audience problem for "author"

  @test:schemas/process/role-graph.test.ts::readActors::maps_the_legacy_`type`_field_and_flags_entries_that_are_really_roles
  Scenario: Actors with the legacy type field are read, and entries that inherit are flagged as roles
    Given actor "a" of type person inheriting "b", and actor "b" of type system
    When the actors are read
    Then their kinds are person and system
    And only "a" looks like a role

  @test:schemas/process/role-graph.test.ts::readActors::an_absent_directory_is_empty,_not_an_error
  Scenario: An absent actors directory holds no actors
    When a directory that does not exist is read for actors
    Then there are none

  @test:schemas/process/role-graph.test.ts::this_repository's_own_role_graph::is_declared_and_loads
  Scenario: This repository declares a role graph
    When this repository's own role graph is read
    Then it is defined

  @test:schemas/process/role-graph.test.ts::this_repository's_own_role_graph::every_role's_summary_says_what_the_position_is,_not_just_its_name
  Scenario: Every role in this repository has a description that says more than its name
    Given this repository's own role graph
    Then every role's description is longer than 20 characters
    And with the words of the role's title and id taken out, at least three words of its description remain

  @test:schemas/process/role-graph.test.ts::this_repository's_own_role_graph::findRole_and_toJsonLd_agree_on_the_declared_set
  Scenario: findRole and the JSON-LD view of this repository's role graph
    Given this repository's own role graph
    Then the role found for "author" is titled "Author"
    And its JSON-LD view has as many roles as the graph, the first with @id "#user"
    And findRole finds every role the JSON-LD view lists, by the id in its @id
    And the JSON-LD ids, with no repeat, are exactly the declared role ids

  @test:schemas/process/role-graph.test.ts::this_repository's_actor_registry,_after_the_roles[]_migration::no_entry_still_carries_the_deprecated_`inherits`
  Scenario: No actor in the registry still carries inherits
    Given the actor registry and the role graph of the harness root
    Then no actor looks like a role

  @test:schemas/process/role-graph.test.ts::this_repository's_actor_registry,_after_the_roles[]_migration::every_role_an_actor_lists_is_declared
  Scenario: Every role an actor lists is declared
    Given the actor registry and this repository's role graph
    Then every role an actor lists is a declared role

  @test:schemas/process/role-graph.test.ts::this_repository's_actor_registry,_after_the_roles[]_migration::every_role_has_an_actor_who_can_take_it_on,_but_for_the_known_mechanical_gaps
  Scenario: Every role has an actor, but for the known mechanical gaps
    Given the actor registry and this repository's role graph
    Then the roles no actor lists are exactly corpus, external-registry, log, publish-target, session-record and work-plan

  @test:schemas/process/role-graph.test.ts::this_repository's_actor_registry,_after_the_roles[]_migration::`roles:_[]`_is_kept_distinct_from_an_absent_`roles`
  Scenario: The viewer actor lists an empty roles array
    Given the actor registry
    Then the actor "viewer" has roles equal to an empty list

  @test:schemas/process/role-graph.test.ts::permissions_are_an_actor_property,_not_a_role_property::the_vocabulary_is_declared_and_every_id_is_unique
  Scenario: The permission vocabulary is declared, with unique ids
    When the permission vocabulary in this repository's skills graph is read
    Then it is defined
    And no permission id repeats

  @test:schemas/process/role-graph.test.ts::permissions_are_an_actor_property,_not_a_role_property::every_permission_an_actor_claims_is_declared
  Scenario: Every permission an actor claims is declared
    Given the permission vocabulary and the actor registry
    Then every permission an actor claims is in the vocabulary

  @test:schemas/process/role-graph.test.ts::permissions_are_an_actor_property,_not_a_role_property::`capabilities[]`_now_holds_probes_only_—_no_permission_and_no_skill_leaked_back_in
  Scenario: An actor's capabilities are all capability probes
    Given the capability probes directory and the actor registry
    Then every capability an actor lists names a probe file

  @test:schemas/process/role-graph.test.ts::permissions_are_an_actor_property,_not_a_role_property::a_permission_genuinely_cross-cuts_roles_—_which_is_why_it_cannot_live_on_Role
  Scenario: A permission is held by actors of more than one role, and not by every actor of a role
    Given the actor registry, with grants read from this repository's ODRL policies
    Then the actors holding "content-authoring" take more than one role between them
    And so do the actors holding "qa-reporting"
    And for each of the two, some role has actors who hold it and actors who do not

  @test:schemas/process/role-graph.test.ts::permissions_are_an_actor_property,_not_a_role_property::an_unparseable_vocabulary_throws_rather_than_reading_as_empty
  Scenario: A permission vocabulary that is not JSON throws
    Given a permissions.json holding "{ not json"
    When the permission vocabulary is read
    Then it throws saying it is not valid JSON

  @test:schemas/process/role-graph.test.ts::the_actor_kind_is_three-way:_human,_agentic,_mechanical::agentic_and_mechanical_are_distinguishable_in_this_repository's_registry
  Scenario: The registry holds agents, and names its mechanical actors
    Given the actor registry
    Then at least one actor is an agent
    And the system actors are exactly attestation-service, board-renderer, ci-health-watcher, ci-pipeline, crdm-detect-signals and local-sweep

  @test:schemas/process/role-graph.test.ts::the_actor_kind_is_three-way:_human,_agentic,_mechanical::an_unrecognised_`kind`_throws_rather_than_being_coerced
  Scenario: An unrecognised actor kind throws
    Given an actor of kind "robot"
    When the actors are read
    Then it throws saying it is not an actor kind

  @test:schemas/process/role-graph.test.ts::the_actor_kind_is_three-way:_human,_agentic,_mechanical::a_legacy_`type`_still_loads,_and_is_never_read_as_agentic
  Scenario: A legacy type still loads, and system is never read as agent
    Given an actor "some-agent" of legacy type system, and an actor "p" of legacy type person
    When each is read
    Then their kinds are system and person

  @test:schemas/process/role-graph.test.ts::which_actor_kinds_may_fulfil_an_activity::BPMN's_own_semantics_are_read,_not_restated
  Scenario: A user task is a person's, a service task an agent's or a system's
    When the fulfilment kinds of bpmn:UserTask and bpmn:ServiceTask are read
    Then they are person, and agent and system

  @test:schemas/process/role-graph.test.ts::which_actor_kinds_may_fulfil_an_activity::an_abstract_task_and_a_call_activity_assert_NOTHING,_which_is_not_allowing_nothing
  Scenario: An abstract task and a call activity assert no kinds
    When the fulfilment kinds of bpmn:Task and bpmn:CallActivity are read
    Then each is undefined, not an empty list

  @test:schemas/process/role-graph.test.ts::which_actor_kinds_may_fulfil_an_activity::the_judgement_kinds_are_derived_from_the_vocabulary,_not_written_out_again
  Scenario: The judgement and mechanical kinds are drawn from the actor kinds
    Then every judgement and mechanical kind is an actor kind
    And the judgement kinds are person and agent
    And the mechanical kinds are system

  @test:schemas/process/role-graph.test.ts::readRoleGraph_—_a_role_inherits_a_role_of_an_instance_it_needs::through_`needs`,_transitively,_with_no_`lower`_passed_by_the_caller
  Scenario: A role inherits a role of an instance it needs, transitively
    Given sibling instances base (role reviewer), mid (needs base) and top (needs mid, role checker inheriting reviewer)
    When top's role graph is read with no lower graphs passed
    Then its roles are "checker"

  @test:schemas/process/role-graph.test.ts::readRoleGraph_—_a_role_inherits_a_role_of_an_instance_it_needs::never_from_an_instance_it_does_not_need_—_a_sibling_or_a_dependent_stays_refused
  Scenario: A role may not inherit from an instance it does not need
    Given sibling instances base (role reviewer), side (role auditor) and top (needs base, role checker inheriting auditor)
    When top's role graph is read
    Then it throws saying it inherits "auditor", which is not declared

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::a_role_may_declare_it,_and_the_strict_schema_refuses_an_unknown_key_inside_it
  Scenario: A role may declare lane holding, and the holding refuses an unknown key
    Given the lane holding: needed from 2 active sessions with more than 10 queued runs, a run queued over 30 minutes, or a conflict; elected by P0 ownership then creation; a lone session holds; heartbeat 10 and stall after 30 minutes
    When a role "merge-steward" with that holding is parsed
    Then it is accepted
    And with an extra holding key "appointedBy" it is refused

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::not_needed_with_one_active_session,_however_busy_the_runners
  Scenario: The lane is not needed with one active session, however busy the runners
    Given the lane holding
    When need is judged with 1 active session and 50 queued runs
    Then the lane is not needed

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::not_needed_when_several_sessions_are_active_but_nothing_is_contended
  Scenario: The lane is not needed when several sessions are active but nothing is contended
    Given the lane holding
    When need is judged with 3 active sessions, 2 queued runs, the oldest 5 minutes old and no conflicts
    Then the lane is not needed

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::needed_when_runners_are_contended_by_queue_length,_by_age,_or_when_PRs_conflict
  Scenario: The lane is needed by queue length, by queue age, or by conflicting PRs
    Given the lane holding and the quiet state of 3 sessions
    When need is judged with 11 queued runs, with the oldest queued 31 minutes, or with 1 conflicting PR
    Then the lane is needed each time
    And with conflicts not counted, 1 conflicting PR does not make it needed

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::the_owner_of_the_P0_PR_is_elected_over_an_earlier_session
  Scenario: The owner of the P0 PR is elected over an earlier session
    Given sessions A (05:00), B (04:00) and C (06:00, owns the P0)
    When the holder is elected
    Then it is C

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::with_no_P0_owner,_the_earliest-created_session_is_elected
  Scenario: With no P0 owner, the earliest-created session is elected
    Given sessions A (05:00) and B (04:00), neither owning a P0
    When the holder is elected
    Then it is B

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::two_P0_owners:_the_earlier-created;_an_exact_tie:_the_lower_session_id
  Scenario: Two P0 owners elect the earlier; an exact tie elects the lower session id
    Given C and B both owning a P0, with B earlier
    When the holder is elected
    Then it is B
    And between C and a copy of C with id "session_0", it is "session_0"

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::the_result_does_not_depend_on_the_order_of_the_listing
  Scenario: Election does not depend on the listing order
    Given sessions A, B and C, and D, a second P0 owner created with B
    When the holder is elected from every ordering of A and B, of A, B and C, and of A, B, C and D
    Then each listing elects the same holder in every one of its orderings

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::a_lone_session_holds_the_lane_for_itself_only_when_the_role_allows_it
  Scenario: A lone session holds the lane only when the role allows it
    When the holder is elected from A alone
    Then it is A
    And with lone sessions not allowed to hold, there is no holder
    And with no sessions, there is no holder

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::a_stalled_session_is_never_elected,_even_the_P0_owner_or_the_earliest
  Scenario: A stalled session is never elected
    Given the stall window of 30 minutes
    Then 31 minutes without an answer is stalled, and 30 minutes or an unknown time is not
    And with C (the P0 owner) silent for 45 minutes, B is elected from A, B and C
    And with B (the earliest) silent for 31 minutes, A is elected from A and B

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::a_lone_session_that_has_stalled_holds_nothing:_the_lane_is_vacant
  Scenario: A lone session that has stalled holds nothing
    When the holder is elected from A alone, silent for 90 minutes
    Then there is no holder

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::the_stall_and_heartbeat_windows_are_required
  Scenario: The stall and heartbeat windows are required
    Given the lane holding with heartbeatMinutes removed
    When it is parsed
    Then it is refused
    And the lane holding with stalledAfterMinutes removed is refused too

  @test:schemas/process/role-graph.test.ts::lane_holding:_when_the_lane_is_needed,_and_who_holds_it_(owner_rulings,_2026-11-07)::an_unreadable_creation_time_sorts_last_rather_than_dropping_the_candidate
  Scenario: An unreadable creation time sorts last rather than dropping the candidate
    When the holder is elected from A with creation time "not a date" and B
    Then it is B
    And when both creation times are unreadable, A is elected

  @test:schemas/process/role-graph.test.ts::readRoleGraph_—_a_role_inherits_a_role_of_an_instance_it_needs::a_self-mounting_checkout:_the_needed_layer_is_mounted_INSIDE_the_layer's_own_root
  Scenario: A self-mounting checkout finds the needed layer mounted inside its own root
    Given instance "top" needing "base", with a role "checker" that inherits "reviewer"
    And instance "base" mounted inside top's own root at "base/", declaring role "reviewer"
    When top's role graph is read
    Then it reads without error and its own roles are "checker"
