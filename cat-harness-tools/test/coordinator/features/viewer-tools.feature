# Specifies viewer Tools' renders against the harnesses' declared
# visualisers and every instance's declared directories in the checkout.
Feature: Viewer Tools and declared visualisers agree on what is rendered

  @test:test/coordinator/viewer-tools.test.ts::viewer_Tools_declare_what_they_render::there_are_viewer_Tools,_and_declared_visualisers,_at_all
  Scenario: There are viewer Tools and declared visualisers
    Given every discovered Tool and the declared visualisers
    When the Tools that render something are taken
    Then there is at least one
    And there is at least one declared visualiser

  @test:test/coordinator/viewer-tools.test.ts::viewer_Tools_declare_what_they_render::every_declared_visualiser_is_renderedBy_a_Tool_that_exists
  Scenario: Every declared visualiser is rendered by a Tool that exists
    Given the declared visualisers and every Tool's id
    When each visualiser's renderedBy is looked up
    Then every one names an existing Tool

  @test:test/coordinator/viewer-tools.test.ts::viewer_Tools_declare_what_they_render::every_rendered_kind_is_declared_by_some_directory
  Scenario: Every rendered kind is declared, or listed as held outside the checkout
    Given every kind a Tool renders and every declared directory's typologies
    When the rendered kinds are compared with the declared ones
    Then each is declared, or is archimate, business-processes, user-scenario, workshop or device-screen

  @test:test/coordinator/viewer-tools.test.ts::viewer_Tools_declare_what_they_render::a_kind_arriving_in_this_index_is_still_rendered,_and_declared_by_no_instance_but_the_one_it_arrives_in
  Scenario: A kind arriving in this index is still rendered, and declared only by the instance it arrives in
    Given the kinds listed as arriving, each with the instance it arrives in: business-processes in smart-trust-phw
    When each is checked
    Then it is not also listed as held outside
    And some Tool still renders it
    And no instance but the one it arrives in declares a directory of that kind

  @test:test/coordinator/viewer-tools.test.ts::viewer_Tools_declare_what_they_render::every_kind_listed_as_held_outside_is_still_rendered_here_and_still_not_held_here
  Scenario: Every kind listed as held outside is still rendered and still not declared here
    Given the kinds listed as held outside
    When each is checked
    Then a kind awaiting its Tool's renders has that Tool existing and is not declared here
    And every other kind is rendered by some Tool and is not declared here

  @test:test/coordinator/viewer-tools.test.ts::viewer_Tools_declare_what_they_render::no_Tool_renders_an_unpublished_kind_—_the_Tool_graph_is_published
  Scenario: No Tool renders an unpublished kind
    Given every kind a Tool renders
    When each is checked
    Then every one is a published graph typology
