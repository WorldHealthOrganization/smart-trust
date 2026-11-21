# A site's scope: an IG's site writes its own pages and links every other
# layer's pages on that layer's own site. Each Scenario names the test that
# executes it.
Feature: Site scope

  @test:scripts/tests/site-scope.test.ts::site-scope_—_the_--scope_flag::no_flag_is_no_scope:_every_instance_is_written
  Scenario: No --scope flag means no scope
    Then argv without --scope has no scope
    And every instance is in an undefined scope

  @test:scripts/tests/site-scope.test.ts::site-scope_—_the_--scope_flag::the_flag_names_the_instances,_comma-separated
  Scenario: --scope names instances comma-separated
    Given --scope "smart-base, smart-immunizations"
    Then the scope is those two instances
    And smart-base is in scope and cat-harness is not

  @test:scripts/tests/site-scope.test.ts::site-scope_—_the_--scope_flag::a_flag_with_no_names_is_refused,_never_read_as_everything
  Scenario: --scope with no names is refused
    Then a bare --scope, --scope followed by another flag, and --scope "," each throw

  @test:scripts/tests/site-scope.test.ts::site-scope_—_the_--scope_flag::the_value_is_sorted_and_once_each
  Scenario: The scope argument is sorted and de-duplicated
    Then the scope argument for b, a, b is "a,b"

  @test:scripts/tests/site-scope.test.ts::siteScopeOf_—_a_site_writes_its_own_pages::the_IG_only:_its_landing_layer_lends_chrome,_not_pages
  Scenario: An IG's site is scoped to the IG alone
    Given a site config landing on smart-base
    Then the scope of smart-immunizations' site is smart-immunizations only

  @test:scripts/tests/site-scope.test.ts::siteScopeOf_—_a_site_writes_its_own_pages::a_folio_that_lands_on_itself:_its_own_pages_only,_the_other_layers_linked
  Scenario: A layer that lands on itself is scoped to itself
    # Gap: checks only the scope; that the other layers are linked is not exercised here.
    Then a folio landing on itself is scoped to folio
    And smart-base landing on itself is scoped to smart-base

  @test:scripts/tests/site-scope.test.ts::siteScopeOf_—_a_site_writes_its_own_pages::the_hub,_or_a_checkout_that_names_no_landing,_has_no_scope
  Scenario: The hub or a checkout with no landing has no scope
    Then a config landing on "hub", a config with no landing, and no config at all each give no scope

  @test:scripts/tests/site-scope.test.ts::writerArgv_—_the_scope_reaches_a_writer_that_declares_it::declared:_passed
  Scenario: A writer that declares a scope flag receives the scope
    Given a writer declaring --scope
    When its argv is built for two instances
    Then it ends with --scope "smart-base,smart-immunizations"

  @test:scripts/tests/site-scope.test.ts::writerArgv_—_the_scope_reaches_a_writer_that_declares_it::not_declared:_not_passed,_and_the_writer_writes_everything_as_before
  Scenario: A writer that declares no scope flag is not passed one
    When the argv of a writer without a scope flag is built
    Then it contains no --scope

  @test:scripts/tests/site-scope.test.ts::relinkOutOfScope_—_another_layer's_page_is_linked_on_its_own_site::a_dead_link_under_a_visualiser_route_points_at_linkRoot;_a_live_one_and_any_other_dead_one_are_left_alone
  Scenario: Dead links under a visualiser route are relinked to the platform
    Given a processes page linking a page that exists, one that does not, a dead link outside the route and an external link
    When out-of-scope links are relinked under en/h/processes/
    Then 1 link on 1 page is changed
    And the missing sibling now points at the platform URL with its anchor
    And the live link and the other dead link are unchanged

  @test:scripts/tests/site-scope.test.ts::scopeDropped_—_the_parity_guard_lets_a_scoped_site_leave_other_layers'_pages_out::only_directories_that_hold_nothing_but_out-of-scope_layers'_pages
  Scenario: Only directories of out-of-scope pages count as dropped by scope
    Given a current site with out-of-scope layer directories, a mixed directory, and a directory kept in the candidate
    When the scope-dropped directories are found for scope "ig"
    Then they are ar, catalogue, docs and who-iris
    And each carries the scope ruling

  @test:scripts/tests/site-scope.test.ts::withoutLayers_—_the_Tools_viewer_writes_its_scope's_layer_pages_only::an_out-of-scope_layer's_pages_are_dropped;_the_index,_the_API_and_the_scope's_pages_stay
  Scenario: Out-of-scope layers' tools pages are dropped
    When the cat-harness and cat-harness-tools layer pages are dropped
    Then the tools index, openapi.json and smart-trust-tools' page remain

  @test:scripts/tests/site-scope.test.ts::withoutLayers_—_the_Tools_viewer_writes_its_scope's_layer_pages_only::a_directory_is_matched_whole,_never_as_a_name_prefix
  Scenario: A layer directory is matched whole
    When only the cat-harness layer pages are dropped
    Then cat-harness-tools' page remains and cat-harness's does not

  @test:scripts/tests/site-scope.test.ts::withoutLayers_—_the_Tools_viewer_writes_its_scope's_layer_pages_only::no_scope_drops_nothing
  Scenario: Dropping no layers keeps every page
    Then dropping nothing keeps all pages
