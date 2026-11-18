# The composition roots resolve their parts from declarations: MCP tool groups
# (src/tool-groups.ts), built-in content adapters (src/builtin-adapters.ts) and HTTP routes
# (src/route-groups.ts). Each way of not resolving one is reported distinctly.
# Each Scenario names the test that executes it.
Feature: Composition roots resolve from declarations

  @test:test/composition-roots.test.ts::MCP_tool_groups::every_served_group_in_the_dependency_tree_registers_here
  Scenario: Every served tool group in the dependency tree registers
    Given a recording server and the repository as the layer root
    When the served tool groups are registered
    Then there are no failures and every outcome is "registered"
    And at least one group was registered
    And the tool "folio_init" was registered

  @test:test/composition-roots.test.ts::MCP_tool_groups::the_served_groups_ARE_the_Tool_nodes'_modules_—_no_list_restates_them
  Scenario: The served groups are exactly the Tool nodes' modules
    Given the served tool groups of the repository
    When the cat-harness set is compared with the harness's own Tool nodes
    Then its modules are exactly the modules of those Tool nodes
    And the folio-assistant-sci set exists and its modules are exactly the modules of the Tool nodes discovered in that layer, with no discovery failures
    And the sci set includes "pipeline/formal-edges-mcp.ts"

  @test:test/composition-roots.test.ts::MCP_tool_groups::a_folio_that_declares_nothing_still_gets_the_harness's_tools
  Scenario: A folio with no declaration still gets the harness's tools
    Given an empty temporary folio and the cat-harness layer as its chain
    When its served tool groups are computed
    Then the only set is "cat-harness"
    And its modules include "src/tools/folio-init.ts"

  @test:test/composition-roots.test.ts::MCP_tool_groups::a_group_carries_the_instance_that_declares_it_as_its_layer
  Scenario: Each tool group's layer is the instance that declares it
    Given the served tool groups of the repository
    When each group is inspected
    Then its layer equals its set's instance

  @test:test/composition-roots.test.ts::MCP_tool_groups::an_uninstalled_layer_is_SKIPPED_and_reported,_not_a_crash
  Scenario: A tool group whose module is not installed is absent and reported
    Given a declared group "ghost" in layer "sci" whose module does not exist and which requires "a Lean toolchain"
    When the declared groups are registered
    Then its outcome is "absent"
    And it names layer "sci" and its detail mentions "a Lean toolchain"

  @test:test/composition-roots.test.ts::MCP_tool_groups::a_present-but-broken_group_is_`failed`,_NOT_`absent`
  Scenario: A tool group whose module lacks its registrar is failed, not absent
    Given a declared group whose module exists but has no export "registerNoSuchThing"
    When the declared groups are registered
    Then its outcome is "failed"
    And its detail names "registerNoSuchThing"

  @test:test/composition-roots.test.ts::MCP_tool_groups::a_registrar_that_throws_is_`failed`,_and_does_not_abort_the_rest
  Scenario: A failing group does not stop the groups after it
    Given a broken group with registrar "registerNoSuchThing" followed by the working readme-audit group
    When the declared groups are registered
    Then the outcomes are "failed" then "registered"
    # Gap: the broken group has a missing export rather than a registrar that throws when called

  @test:test/composition-roots.test.ts::built-in_content_adapters::both_declared_adapters_resolve_in_this_checkout
  Scenario: Every declared built-in adapter resolves in this checkout
    Given the built-in adapter declarations
    When each content type is resolved
    Then the adapter used has that content type
    And there is no fallback reason
    And a constructor is returned

  @test:test/composition-roots.test.ts::built-in_content_adapters::a_specialisation_leads_its_base,_because_it_is_the_superset
  Scenario: A specialising adapter is listed before its base
    Given the built-in adapter declarations
    When an adapter extends a base that is also declared
    Then the adapter comes before its base in the list

  @test:test/composition-roots.test.ts::built-in_content_adapters::discovery_reads_declarations,_orders_by_`extends`,_and_refuses_a_collision
  Scenario: Adapter discovery reads declarations, orders by extends and refuses a collision
    Given instances "base" declaring content type "b" and "spec" declaring "s" that extends "b"
    When the built-in adapters are discovered
    Then there are no problems
    And the order is "s" then "b"
    And "s" is from instance "spec" with module "../spec/a/s.ts"
    And when a third instance "dupe" also declares "b", discovery throws an adapter declaration collision error

  @test:test/composition-roots.test.ts::built-in_content_adapters::a_malformed_or_escaping_declaration_is_RECORDED,_not_read_as_'declares_none'
  Scenario: An adapter declaration whose module escapes its instance is recorded as a problem
    Given instance "up" declaring an adapter with module "../elsewhere/x.ts"
    When the built-in adapters are discovered
    Then no adapter is returned
    And the problems mention "up"
    # Gap: only the escaping case is exercised, not a malformed declaration

  @test:test/composition-roots.test.ts::built-in_content_adapters::an_unknown_contentType_falls_back_AND_says_so
  Scenario: An unknown content type falls back and says why
    Given the content type "no-such-type"
    When the built-in adapter is resolved
    Then a fallback reason is given that names "no-such-type"
    And a constructor is still returned

  @test:test/composition-roots.test.ts::built-in_content_adapters::the_class_name_each_declaration_points_at_is_the_one_exported
  Scenario: Each declared class name is the class the module exports
    Given the built-in adapter declarations
    When each content type is resolved
    Then the constructor's name equals the declared class name

  @test:test/composition-roots.test.ts::built-in_content_adapters::resolveAdapterPreamble_returns_the_adapter's_preamblePath_or_undefined_on_fallback
  Scenario: The adapter preamble is its declared preamblePath, or none on fallback
    Given the content types "no-such-type" and "document"
    When their preambles are resolved
    Then both are undefined
    Given a mock "paper" adapter module whose class declares a static preamblePath to a template file
    When the "paper" preamble is resolved against it
    Then it is that template's path

  @test:test/composition-roots.test.ts::HTTP_routes::every_declared_route's_module_exists_and_mounts
  Scenario: Every declared HTTP route mounts
    Given the server's route declarations and services gitHelper and feedbackStore
    When the routes are mounted
    Then every outcome is "mounted"
    And there is one route per declaration

  @test:test/composition-roots.test.ts::HTTP_routes::the_declaration_covers_all_five_routes_the_server_used_to_import,_and_the_work-plan_route_added_since
  Scenario: The route declaration lists the six routes in order
    Given the server's route declarations
    When their ids are read
    Then they are "branches", "feedback", "glossary", "relevance", "work-plan", "chat"

  @test:test/composition-roots.test.ts::HTTP_routes::declaration_order_IS_dispatch_order,_and_chat_stays_last
  Scenario: Chat is the last declared route
    Given the server's route declarations
    When the last one is read
    Then its id is "chat"
    # Gap: dispatch order itself is not exercised; only that chat is declared last

  @test:test/composition-roots.test.ts::HTTP_routes::chat_is_POST-only_and_work-plan_GET-only,_so_each_dispatch_is_one_shorter_than_the_list
  Scenario: Chat is POST-only and work-plan is GET-only
    Given the mounted server routes
    When the mounted routes without a GET handler and without a POST handler are listed
    Then "chat" and "work-plan" are both mounted
    And only "chat" lacks a GET handler
    And only "work-plan" lacks a POST handler

  @test:test/composition-roots.test.ts::HTTP_routes::the_three_content_routes_are_declared_`core`
  Scenario: The three content routes are declared in layer core
    Given the server's route declarations
    When those with layer "core" are listed
    Then they are "feedback", "glossary" and "relevance"

  @test:test/composition-roots.test.ts::HTTP_routes::a_missing_service_is_reported_BY_NAME,_not_as_a_later_TypeError
  Scenario: A route whose service is missing fails naming the service
    Given the server's route declarations and no services
    When the routes are mounted
    Then "branches" and "feedback" are failed
    And each failure detail names "gitHelper" or "feedbackStore"
    And the other four routes still mount

  @test:test/composition-roots.test.ts::HTTP_routes::an_absent_module_is_`absent`,_a_broken_one_is_`failed`
  Scenario: A route with an absent module is absent and one with a missing factory is failed
    Given a route "ghost" whose module "src/routes/ghost.ts" does not exist
    When it is mounted
    Then its outcome is "absent" and no route mounts
    Given a route whose module exists but has no factory "noSuchFactory"
    When it is mounted
    Then its outcome is "failed" with detail naming "noSuchFactory"

  @test:test/composition-roots.test.ts::HTTP_routes::chat_declares_no_`needs`_—_it_never_read_the_store_it_was_handed
  Scenario: The chat route declares no needs
    Given the server's route declarations
    When the "chat" declaration is read
    Then it has no needs

  @test:test/composition-roots.test.ts::HTTP_routes::dispatch_returns_null_for_a_URL_nobody_claims
  Scenario: Dispatch returns null for an unclaimed URL
    Given the mounted server routes
    When a GET and a POST for "/api/nothing-claims-this" are dispatched
    Then both return null
