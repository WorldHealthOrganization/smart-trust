# scripts/derive-at-publish.ts derives the routes a visualiser builds on the host site into the publish plan:
# where each derived route sits in the host's writer order, which locales a translated viewer writes, and which
# Tool's script draws a host-site page. Each Scenario names the test that executes it.
Feature: Host-site routes derived into the publish plan

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::a_derived_route_keeps_the_host's_writer_order::a_route_goes_after_its_writer's_own_entry,_and_a_new_writer_after_its_harness's_last_route
  Scenario: A derived route follows its writer's own entry, and a new writer follows its harness's last route
    Given the host declares "docs/a/", "docs/assets/glossary/" and "docs/z/"
    And core derives two glossary routes and a bibliography route on the host site
    When the derived routes are merged into the declared ones
    Then the order is "docs/a/", "docs/assets/glossary/", "docs/en/core/glossary/", "docs/fr/core/glossary/", "docs/en/core/bibliography/", "docs/z/"

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::a_derived_route_keeps_the_host's_writer_order::so_the_bibliography_writer_runs_before_a_writer_that_reads_the_site,_exactly_as_when_the_host_listed_it
  Scenario: The derived writer order equals the order the host would have listed
    Given the same declared and derived routes
    And a host list that names the bibliography route by hand before "docs/z/"
    When the writers of each are ordered
    Then the two writer orders are equal

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::a_derived_route_keeps_the_host's_writer_order::with_no_place_to_go,_a_route_goes_at_the_end
  Scenario: A derived route with nowhere to follow goes at the end
    Given no declared routes and the derived bibliography route
    When they are merged
    Then the result is just "docs/en/core/bibliography/"

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::a_host_that_does_not_list_the_writer_declares_no_order_for_it_(a_downstream_IG_root)::no_cycle,_and_the_harness's_own_viewers_keep_their_order
  Scenario: A host that does not list the writer closes no cycle and keeps the harness's viewer order
    Given a platform that lists the glossary before its pages and context, and an IG host that lists its context before its pages and no glossary
    And core derives a glossary and a bibliography route on the IG host
    When the writers are ordered
    Then the order includes "ig:pages"
    And "glossary:page" comes before "bibliography:page" and before "base:pages"

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::a_host_that_does_not_list_the_writer_declares_no_order_for_it_(a_downstream_IG_root)::the_edges_name_the_harness,_never_the_host,_for_its_routes
  Scenario: The ordering edges for derived routes name the harness, not the host
    Given the same platform, IG host and derived routes
    When the writer edges are listed with their reasons
    Then no reason starting "ig lists" mentions the glossary or bibliography
    And one reason is "core declares its host-site viewer of glossary:page before that of bibliography:page"

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::the_locales_a_translated_viewer_writes::every_layer's_translation-sources_locales,_once_each,_the_page_locale_and_non-locale_folders_aside
  Scenario: The translated locales are every layer's translation-sources locales, once each
    Given layer "host" with translation folders "fr", "en" and "_tmp", and layer "upper" with "ar" and "fr"
    When the translated locales are listed
    Then they are "ar" and "fr"

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::the_Tool_that_draws_a_host-site_page_(cat-harness#1150)::a_page_declared_above_the_layer_that_holds_its_Tool_resolves_to_that_Tool's_script
  Scenario: A page declared above the layer holding its Tool resolves to that Tool's script
    Given layer "base" holds Tool "state-viewer" invoked by "bun run cat state:visualizer", and layer "top" needs "base"
    When the renderer of a page rendered by "state-viewer" is resolved from "top"
    Then it is "bun run cat state:visualizer"

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::the_Tool_that_draws_a_host-site_page_(cat-harness#1150)::the_declaring_layer's_own_Tool_still_resolves
  Scenario: The declaring layer's own Tool still resolves
    Given layer "base" holds Tool "state-viewer"
    When the renderer of a page rendered by "state-viewer" is resolved from "base"
    Then it is "bun run cat state:visualizer"

  @test:scripts/tests/sdlc/host-site-artefacts.test.ts::the_Tool_that_draws_a_host-site_page_(cat-harness#1150)::a_Tool_no_layer_holds_resolves_to_nothing,_so_the_page_is_refused
  Scenario: A Tool no layer holds resolves to nothing
    # Gap: that the page is then refused is not checked here
    Given no layer holds a Tool "no-such-tool"
    When the renderer of a page rendered by "no-such-tool" is resolved from "top"
    Then nothing is returned
