# Specifies schemas/kg/visualiser-route.ts: visualiserRoute, visualiserUrl,
# siteRootFrom, routeOf, aliasRoute and routeCollisions — the one function a
# visualiser's URL is computed with (owner, 2026-10-09).
Feature: A visualiser's route is <locale>/<harness>/<visualiser>[/<sub-graph>[/<asset>]]

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::the_full_KG,_a_sub-graph,_and_an_asset_of_either
  Scenario: Routes for the full graph, a sub-graph and an asset
    Then the cat-harness library route is "cat-harness/library/"
    And with the sub-graph who-iris it is "cat-harness/library/who-iris/"
    And with the asset x/index.html under it, "cat-harness/library/who-iris/x/index.html"
    And the processes visualiser's asset intake.html is "cat-harness/processes/intake.html"

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::a_nested_sub-graph_path_is_a_path_of_segments
  Scenario: A nested sub-graph is a path of segments
    When the auto-docs route for the sub-graph "index/skills/core-skills" is computed
    Then it is "cat-harness/auto-docs/index/skills/core-skills/"

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::a_segment_that_is_not_a_URL_segment_is_refused,_never_encoded
  Scenario: Invalid segments are refused
    Then the harness "Cat Harness" throws "not a URL segment"
    And the sub-graph "../up" throws
    And the asset "../escape.html" throws "escapes"

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::an_absolute_URL_under_a_base,_with_or_without_its_trailing_slash
  Scenario: A visualiser URL is the route under a base
    Then under "https://e.org/site" the h/v URL is "https://e.org/site/h/v/"
    And under "/" the h/v/s URL is "/h/v/s/"

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::the_way_back_to_the_site_root_is_the_route's_depth
  Scenario: The relative way back to the site root matches the route's depth
    Then from h/v it is "../../"
    And from h/v with the sub-graph a/b it is "../../../../"

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::routeOf_finds_the_declared_route_a_site_path_lies_under
  Scenario: routeOf finds the declared route a path lies under
    Given the declared route h/v
    Then "h/v/s/index.html" lies under it with the rest "s/index.html"
    And "h/vv/index.html" lies under no declared route

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::a_locale_is_the_route's_first_segment,_above_the_harness
  Scenario: A locale is the route's first segment
    Then the h/v route in "en" is "en/h/v/"
    And with sub-graph s and asset d.json it is "en/h/v/s/d.json"
    And the way back to the root from it is "../../../"
    And the locale "EN" throws

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::routeOf_tells_a_localised_route_from_the_unlocalised_one
  Scenario: routeOf distinguishes a localised route
    Given the declared route h/v in locale "en"
    Then "en/h/v/s/" lies under it with the rest "s/"
    And "h/v/s/" lies under no declared route

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::an_alias_is_one_segment_at_the_site's_top_level
  Scenario: An alias is one top-level segment
    Then the alias "todos" routes to "todos/"
    And the alias "a/b" throws

  @test:schemas/kg/visualiser-route.test.ts::routeCollisions::one_route_claimed_twice,_and_a_claim_inside_another's_subtree
  Scenario: Same and nested route claims collide
    Given claims of "h/v/" by a, "h/v" by b, "h/v/s/" by c and "h/w/" by d
    When the collisions are computed
    Then they are "same" on h/v/ by a and b, and "nested" on h/v/s/ by a, b and c

  @test:schemas/kg/visualiser-route.test.ts::routeCollisions::siblings_do_not_collide
  Scenario: Sibling routes do not collide
    Given claims of "h/v/" by a and "h/vv/" by b
    When the collisions are computed
    Then there are none

  @test:schemas/kg/visualiser-route.test.ts::visualiserRoute::a_sub-graph_id_with_capitals_routes_lower-cased_(smart-base's_layer_subgraphs)
  Scenario: A sub-graph id with capitals routes lower-cased, and any other bad segment is still refused
    When the sub-graph "smart-base-L4-skills" is made a segment
    Then it is "smart-base-l4-skills"
    And the smart-base skills route for it is "smart-base/skills/smart-base-l4-skills/"
    And the sub-graph "index/L2-bpmn" routes as "h/v/index/l2-bpmn/"
    And the sub-graph "L4 skills" throws "not a URL segment"
