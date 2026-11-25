# The root index on a layer's site: the opt-in recipe flag, the export plan
# publish-root-index.ts runs, and root-index.ts reading the repository
# subgraph index from outside the site. Each Scenario names the test that
# executes it.
Feature: Publishing a layer's root index

  @test:scripts/tests/publish-root-index.test.ts::site.build.rootIndex:_opt-in::absent_is_off,_and_the_recipe_does_not_carry_it
  Scenario: rootIndex absent is off
    Given a checkout declaring "demo" whose site.build has no rootIndex
    When its build recipe is read
    Then the recipe carries no rootIndex

  @test:scripts/tests/publish-root-index.test.ts::site.build.rootIndex:_opt-in::true_is_carried_to_the_build
  Scenario: rootIndex true is carried to the build
    Given a checkout declaring "demo" whose site.build.rootIndex is true
    When its build recipe is read
    Then the recipe's rootIndex is true

  @test:scripts/tests/publish-root-index.test.ts::site.build.rootIndex:_opt-in::anything_but_a_boolean_is_refused,_naming_the_key
  Scenario: A non-boolean rootIndex is refused, naming the key
    Given a checkout declaring "demo" whose site.build.rootIndex is "yes"
    When its build recipe is read
    Then it throws "site.build.rootIndex must be true or false"

  @test:scripts/tests/publish-root-index.test.ts::site.build.rootIndex:_opt-in::the_declaration_schema_keeps_it
  Scenario: The declaration schema keeps rootIndex
    When the harness site schema parses a build with rootIndex true
    Then the parsed build's rootIndex is true

  @test:scripts/tests/publish-root-index.test.ts::the_export_plan::the_host_first,_at_<name>/<stub>.jsonld,_with_its_QA_sidecar_kept_out_of_the_mount
  Scenario: The export plan exports the host first
    Given the export plan for this checkout with site "/site" and QA root "/qa"
    Then the first step runs kg-export.ts with "--qa-root /qa"
    And it writes "/site/<host name>/<host stub>.jsonld"

  @test:scripts/tests/publish-root-index.test.ts::the_export_plan::every_other_layer_last,_by_instance-exports,_at_this_site's_base_without_a_trailing_slash
  Scenario: The export plan exports every other layer last
    Given the export plan with base URL "https://example.org/layer/"
    Then the last step runs "instance-exports.ts --out-dir /site --base-url https://example.org/layer"
    And it declares no single file it writes

  @test:scripts/tests/publish-root-index.test.ts::the_export_plan::every_step_is_a_bun_script_with_argv,_never_a_shell_string
  Scenario: Every step of the export plan is a bun script with argv
    Given the export plan
    Then every step's argv starts with "bun", "run"

  @test:scripts/tests/publish-root-index.test.ts::root-index:_the_repository_subgraph_index_may_live_outside_the_site::a_missing_index_is_named_by_the_path_it_was_looked_for_at
  Scenario: A missing subgraph index is named by the path it was looked for at
    Given an empty site and a subgraph index path that does not exist
    When the root index is built from that index
    Then a problem starts with "<that path> is missing"

  @test:scripts/tests/publish-root-index.test.ts::root-index:_the_repository_subgraph_index_may_live_outside_the_site::a_given_index_is_read_in_place_of_the_site's_own
  Scenario: A given subgraph index is read in place of the site's own
    Given an empty site and a subgraph index file outside it with no subgraphs
    When the root index is built from that index
    Then no problem says the index "is missing — the subgraph roots cannot be named"
    And a problem says "the deploy did not publish it"
