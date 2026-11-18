# Specifies schemas/kg/url-space.ts (bean nbal): publishedPath for the root,
# instance and viewer cases, and isPublished's enabled default.
Feature: Every published page has one path, computed from its case

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::the_root_has_no_segment
  Scenario: The root case has no leading segment
    When the published path of the root is computed
    Then it is "/"
    And with the path "guides/agent-onboarding.html" it is "/guides/agent-onboarding.html"

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::an_instance_is_addressed_by_its_name
  Scenario: An instance is addressed by its name
    When the published path of the instance who-iris is computed
    Then it is "/who-iris/"
    And with the path "catalogue/" it is "/who-iris/catalogue/"

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::a_viewer_is_owner,_then_graph,_then_subject
  Scenario: A viewer is addressed by owner, graph, then subject
    When the published path of the viewer owned by cat-harness for the graph docs and subject who-iris is computed
    Then it is "/cat-harness/docs/who-iris/"
    And with no subject, for the graph library, it is "/cat-harness/library/"

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::a_locale_leads_a_viewer_page,_and_only_a_viewer_page_(owner,_2026-10-20)
  Scenario: A locale leads a viewer path, and only a viewer path
    When the published path of the cat-harness todos viewer in locale "en" is computed
    Then it is "/en/cat-harness/todos/"
    And an empty locale throws "not a path segment"
    And a root or an instance location with a locale does not type-check
    And with the locale forced past the type, the root's path is "/" and the instance's is "/bootstrap/bootstrap.jsonld", with no locale in either

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::with_a_locale,_the_viewer_case_is_visualiserRoute's_route:_two_resolvers,_one_answer
  Scenario: A localised viewer path equals the visualiser route
    Given three localised viewer cases, with and without a subgraph and an asset
    When each is resolved by publishedPath and by visualiserRoute
    Then the published path is "/" followed by the visualiser route

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::two_renderable_graphs_of_one_instance_do_not_collide
  Scenario: Two graphs of one instance get different paths
    When index.html is addressed in the docs viewer and in the folio viewer of cat-harness
    Then the two paths differ

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::a_base_prefixes_every_case,_with_or_without_its_trailing_slash
  Scenario: A base URL prefixes the path, with or without its trailing slash
    Given the base "https://litlfred.github.io/folio-assistant/"
    Then the root under it is the base itself
    And bootstrap.jsonld of the instance bootstrap, under the base without its slash, is ".../folio-assistant/bootstrap/bootstrap.jsonld"
    And index.html of the cat-harness todos viewer in locale "en", under the base with and without its slash, is ".../folio-assistant/en/cat-harness/todos/index.html"

  @test:schemas/kg/url-space.test.ts::publishedPath:_the_three_cases::a_segment_or_path_that_steps_outside_is_refused,_not_normalised
  Scenario: Segments and paths that step outside are refused
    Then an instance "" or "../x", and a viewer graph "b/../c", throw "not a path segment"
    And a root path "../secret" throws "steps outside"

  @test:schemas/kg/url-space.test.ts::isPublished:_enabled_is_a_declaration,_defaulting_to_enabled::absent_is_enabled;_only_an_explicit_false_disables
  Scenario: Only an explicit enabled false unpublishes
    Then a declaration with no enabled is published
    And one with enabled true is published
    And one with enabled false is not
