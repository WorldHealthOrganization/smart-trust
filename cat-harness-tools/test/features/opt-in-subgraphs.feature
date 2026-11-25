# Opt-in named sub-graphs (schemas/kg/opt-in-subgraphs.ts and the resolvers, schemas, served
# Tool groups, declaration check and mount planner that honour them): off unless the folio root
# enables one, with CAT_SUBGRAPHS overriding per process. Each Scenario names the test that executes it.
Feature: Opt-in named sub-graphs

  @test:test/opt-in-subgraphs.test.ts::the_switch::CAT_SUBGRAPHS:_`+`_adds,_`-`_removes,_a_bare_id_adds
  Scenario: CAT_SUBGRAPHS adds with a plus or a bare id and removes with a minus
    When CAT_SUBGRAPHS " +a.x, -b.y ,c.z," is parsed
    Then it adds "a.x" and "c.z" and removes "b.y"
    And a declared list "a.x", "b.y" under CAT_SUBGRAPHS "-a.x,+c.z" enables "b.y" and "c.z"
    And no declared list and no variable enables nothing

  @test:test/opt-in-subgraphs.test.ts::the_switch::switchedOff_walks_`within`_to_the_opt-in_ancestor
  Scenario: switchedOff follows within to the opt-in ancestor
    Given "x-skills" lies within "x", which "a" declares opt-in
    Then "x-skills" is switched off when nothing is enabled
    And it is on when "a.x" is enabled or when all are enabled
    And "api", which is not opt-in, is not switched off

  @test:test/opt-in-subgraphs.test.ts::off_by_default_in_the_layer_above::not_resolved,_no_skills,_no_Tool_served_—_the_sub-graph_and_its_members
  Scenario: An opt-in sub-graph is off by default in the layer above
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    When "b" is resolved with nothing enabled
    Then "x", "x-skills" and "x-tools" are not among its directories
    And b's own x/ member is not resolved
    And no skill directory under x/ is resolved
    And the only served Tool module is "src/at.ts"

  @test:test/opt-in-subgraphs.test.ts::off_by_default_in_the_layer_above::a_non-opt-in_named_sub-graph_is_unaffected
  Scenario: A non-opt-in named sub-graph still resolves in the layer above
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And an ordinary named sub-graph "api"
    When "b" is resolved with nothing enabled
    Then "api" and "api-skills" are among its directories

  @test:test/opt-in-subgraphs.test.ts::on_when_the_folio_enables_it::`b`_listing_`a.x`_resolves_it,_its_from-within_graphs,_its_skills_and_its_Tool
  Scenario: A folio that enables a.x resolves it with its graphs, skills and Tool
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "b" lists "a.x" in enableSubgraphs
    When "b" is resolved
    Then "x" and "x-skills" carry optInSubgraph "a.x"
    And b's own x/ member is resolved
    And a/x/skills is a skill directory
    And the served Tool modules are "src/at.ts" and "src/xt.ts"

  @test:test/opt-in-subgraphs.test.ts::on_when_the_folio_enables_it::CAT_SUBGRAPHS_`+a.x`_turns_it_on,_`-a.x`_off
  Scenario: CAT_SUBGRAPHS switches a.x on and off over the folio's choice
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    When CAT_SUBGRAPHS is "+a.x" and "b" enables nothing
    Then "a.x" is enabled, "x-tools" resolves, "src/xt.ts" is served and a/x/skills is a skill directory
    When "b" enables "a.x" and CAT_SUBGRAPHS is "-a.x"
    Then "x" does not resolve, only "src/at.ts" is served and no skill directory under x/ is resolved

  @test:test/opt-in-subgraphs.test.ts::on_when_the_folio_enables_it::the_folio_decides,_not_the_layer_below:_`a`_enabling_itself_does_not_switch_it_on_for_`b`
  Scenario: The declaring layer enabling itself does not enable the sub-graph for the folio above
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "a" lists "a.x" in its own enableSubgraphs
    When "b" is resolved
    Then "x" is not among its directories
    And the only served Tool module is "src/at.ts"

  @test:test/opt-in-subgraphs.test.ts::the_declaring_layer's_own_resolution::off_unless_it_enables_itself
  Scenario: The declaring layer resolves its opt-in sub-graph only when it enables it
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    When "a" is resolved on its own without enabling "a.x"
    Then "x" is not among its resolved or own directories
    When "a" enables "a.x" itself
    Then its resolution includes "x", "x-skills" and "x-tools"
    And its own directories include "x"

  @test:test/opt-in-subgraphs.test.ts::an_enable_id_that_names_nothing_opt-in_is_refused::by_the_schema:_not_qualified,_listed_twice,_or_this_instance's_own_non-opt-in_entry
  Scenario: The declaration schema refuses an unqualified, repeated or non-opt-in enable id
    Given a declaration of "a" with "x" opt-in and "api" not
    Then enableSubgraphs "a.x" parses
    And enableSubgraphs "x" is refused
    And "a.x" listed twice is refused
    And "a.api" is refused with "not an opt-in sub-graph"

  @test:test/opt-in-subgraphs.test.ts::an_enable_id_that_names_nothing_opt-in_is_refused::by_check:declaration-resolution,_across_the_needs_closure
  Scenario: check:declaration-resolution refuses enable ids that name nothing opt-in in the needs closure
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "b" enables "a.x", "a.api", "a.nope" and "zzz.x"
    When check:declaration-resolution runs over the checkout
    Then the enableSubgraphs findings name "a.api", "a.nope" and "zzz.x", all against instance "b"
    And 4 enable ids were examined

  @test:test/opt-in-subgraphs.test.ts::an_enable_id_that_names_nothing_opt-in_is_refused::an_entry_declared_from_within_can_be_named;_a_layer_above_cannot_be
  Scenario: An enable id may name an entry declared from within, but not a layer outside the needs
    Given "b" needs "a", which has opt-in entries "x" and "x-inner"
    Then "b" enabling "a.x-inner" has no problems
    And "b" enabling "c.x" has a problem mentioning "needs"

  @test:test/opt-in-subgraphs.test.ts::one_sub-graph_requires_another_(owner,_2026-11-13:_implied)::closeOverRequires_is_transitive_and_adds_only_what_is_required
  Scenario: closeOverRequires adds the transitive requirements and nothing else
    Given "l.c" requires "l.b", "l.b" requires "l.a", and "l.z" requires "l.q"
    Then closing over "l.c" gives "l.a", "l.b" and "l.c"
    And closing over "l.a" gives only "l.a"
    And "l.c" requires "l.a" and "l.b"
    And a cycle between "l.p" and "l.r" closes to both and ends

  @test:test/opt-in-subgraphs.test.ts::one_sub-graph_requires_another_(owner,_2026-11-13:_implied)::a_folio_enabling_`a.y`_gets_`a.x`_too:_its_graphs,_skills_and_Tool
  Scenario: A folio enabling a.y also gets a.x, which a.y requires
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "a" declares "y" opt-in, requiring "a.x"
    When "b" enables "a.y"
    Then the enabled sub-graphs are "a.x" and "a.y"
    And "x-skills" resolves and a/x/skills is a skill directory
    And the served Tool modules are "src/at.ts" and "src/xt.ts"

  @test:test/opt-in-subgraphs.test.ts::one_sub-graph_requires_another_(owner,_2026-11-13:_implied)::the_requirement_implies_one_way_only:_enabling_`a.x`_does_not_switch_`a.y`_on
  Scenario: A requirement does not switch on the sub-graph that requires it
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "a" declares "y" opt-in, requiring "a.x"
    When "b" enables "a.x"
    Then only "a.x" is enabled

  @test:test/opt-in-subgraphs.test.ts::one_sub-graph_requires_another_(owner,_2026-11-13:_implied)::the_schema_accepts_it;_requiresProblems_refuses_a_non-opt-in_carrier,_an_unknown_id_and_itself
  Scenario: requires is accepted by the schema and refused for bad carriers or targets
    Given a declaration of "a" whose opt-in "y" requires "a.x"
    Then the declaration schema accepts it
    And requiresProblems finds nothing for it
    And a non-opt-in "api" carrying requires is refused with "not an opt-in sub-graph"
    And "y" requiring the non-opt-in "a.api" is refused with "not an opt-in sub-graph"
    And "y" requiring "c.x" is refused mentioning "needs"
    And "y" requiring "a.y" is refused mentioning "itself"

  @test:test/opt-in-subgraphs.test.ts::one_sub-graph_requires_another_(owner,_2026-11-13:_implied)::check:declaration-resolution_reports_a_`requires`_that_names_nothing_opt-in
  Scenario: check:declaration-resolution reports a requires that names nothing opt-in
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "a" declares "y" opt-in, requiring "a.api"
    When check:declaration-resolution runs over "a"
    Then exactly one finding has subject "y.requires", against instance "a", field "enableSubgraphs", naming "a.api"

  @test:test/opt-in-subgraphs.test.ts::an_opt-in_group_declared_FROM_WITHIN_may_require_too_(owner,_2026-11-13:_L2/L3_own_collab)::requiresDeclared_reads_the_top_level_and_every_from-within_file,_keyed_by_the_entry's_own_id
  Scenario: requiresDeclared reads requires from the top level and every from-within file
    Given "a" whose top-level "y" requires "a.x"
    And x/graph.json declares "x-collab" requiring "a.x" and "a.y"
    And x/collab/collab.json declares "x-collab-deep" requiring "a.x-collab"
    And api/graph.json is not valid JSON
    When the declared requirements of "a" are read
    Then they are "a.y" to "a.x", "a.x-collab" to "a.x" and "a.y", and "a.x-collab-deep" to "a.x-collab"

  @test:test/opt-in-subgraphs.test.ts::an_opt-in_group_declared_FROM_WITHIN_may_require_too_(owner,_2026-11-13:_L2/L3_own_collab)::a_folio_enabling_`a.x-collab`_gets_its_level_`a.x`_and_`a.y`_too
  Scenario: A folio enabling a from-within group also gets the groups it requires
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "a" declares "y" opt-in, and x/graph.json declares "x-collab" requiring "a.x" and "a.y"
    When "b" enables "a.x-collab"
    Then the enabled sub-graphs are "a.x", "a.x-collab" and "a.y"

  @test:test/opt-in-subgraphs.test.ts::an_opt-in_group_declared_FROM_WITHIN_may_require_too_(owner,_2026-11-13:_L2/L3_own_collab)::check:declaration-resolution_holds_a_from-within_`requires`_to_the_same_rule
  Scenario: check:declaration-resolution holds a from-within requires to the same rule
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And x/graph.json declares opt-in "x-collab" requiring "a.api"
    When check:declaration-resolution runs over "a"
    Then exactly one finding has subject "x-collab.requires", against instance "a", field "enableSubgraphs", naming "a.api"

  @test:test/opt-in-subgraphs.test.ts::an_index_root_enables_it_in_index.config.json_(step_23.4)::the_index's_list_is_the_root's_list
  Scenario: An index root's enableSubgraphs is the root's enabled list
    Given the checkout's parent as an index whose index.config.json names "a" and "b"
    Then enabling "a.x" in index.config.json enables exactly "a.x"
    And an empty list enables nothing

  @test:test/opt-in-subgraphs.test.ts::an_index_root_enables_it_in_index.config.json_(step_23.4)::the_served_Tool_groups_follow_it
  Scenario: The served Tool groups follow the index's enabled list
    Given the checkout's parent as an index whose index.config.json names "a" and "b"
    Then with "a.x" enabled the served Tool modules are "src/at.ts" and "src/xt.ts"
    And with nothing enabled only "src/at.ts" is served

  @test:test/opt-in-subgraphs.test.ts::an_index_root_enables_it_in_index.config.json_(step_23.4)::the_schema_takes_it,_and_refuses_an_id_listed_twice_or_not_qualified
  Scenario: The index config schema takes enableSubgraphs and refuses a repeated or unqualified id
    Given an index config naming instance "a"
    Then enableSubgraphs "a.x" parses
    And "a.x" listed twice is refused
    And "x" is refused

  @test:test/opt-in-subgraphs.test.ts::an_index_root_enables_it_in_index.config.json_(step_23.4)::check:declaration-resolution_refuses_an_index_id_that_names_nothing_opt-in
  Scenario: check:declaration-resolution refuses an index enable id that names nothing opt-in
    Given the checkout's parent as an index enabling "a.x", "a.api" and "a.nope"
    When check:declaration-resolution runs over it
    Then the enableSubgraphs findings name "a.api" and "a.nope", all against instance "(index)"

  @test:test/opt-in-subgraphs.test.ts::the_mount_planner's_default_list::leaves_out_an_opt-in_sub-graph_the_downstream_has_not_enabled
  Scenario: The mount planner's default list leaves out an opt-in sub-graph that is not enabled
    Given the directories of "a": "tools", opt-in "x" and "api"
    Then with nothing enabled the default mount list is "tools" and "api"
    And with "a.x" enabled it is "tools", "x" and "api"

  @test:test/opt-in-subgraphs.test.ts::the_mount_planner's_default_list::filters_the_harness's_own_mountDefaults_too
  Scenario: The mount planner filters the harness's own mountDefaults too
    Given the directories of "a" with mountDefaults "x" and "api"
    When nothing is enabled
    Then the default mount list is only "api"

  @test:test/opt-in-subgraphs.test.ts::the_mount_planner's_default_list::with_nothing_opt-in,_the_list_is_exactly_what_it_was
  Scenario: With nothing opt-in the mount planner's default list is unchanged
    Given the directories of "a" with no opt-in flags
    Then the default mount list is "tools", "x" and "api"

  @test:test/opt-in-subgraphs.test.ts::the_fixture's_declarations_parse
  Scenario: The fixture's declarations parse
    Given a checkout where "b" needs "a", and "a" declares "x" opt-in with a skills and a tools graph inside it
    And "b" enables "a.x"
    Then reading a's declaration shows "x" as opt-in
    And b's declaration lists enableSubgraphs "a.x"
    And b.json needs "a"
