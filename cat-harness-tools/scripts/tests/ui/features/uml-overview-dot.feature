# scripts/gen-uml-overview.ts draws the UML overview as Graphviz DOT: the same model as its .puml,
# coloured from uml.css, and laid out by the pinned Graphviz. Each Scenario names the test that executes it.
Feature: The UML overview's DOT is the model its .puml draws

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::a_named_sub-graph_is_a_cluster,_labelled_as_the_.puml_package_is
  Scenario: A named sub-graph is a cluster labelled as its .puml package
    Given a demo model with a demo/skills section holding two classes and a demo/beans section with one undetermined kind
    When its DOT is drawn
    Then it has the subgraphs "cluster_pkg_demo_skills" and "cluster_pkg_demo_beans"
    And the skills cluster is labelled "demo/skills" in bold

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::a_class_is_filled_with_its_family_colour_from_uml.css,_and_carries_its_kind's_class
  Scenario: A class is filled with its family colour from uml.css and carries its kind's class
    Given the uml.css palette's colour for kind "skills" is a hex colour
    When the demo model's DOT is drawn
    Then the Skill node is filled with that colour and has class "fa_uml_kind_skills"

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::every_hex_in_the_DOT_is_a_colour_uml.css_declares
  Scenario: Every hex colour in the DOT is one uml.css declares
    Given the demo model's DOT
    When its hex colours are collected
    Then there is at least one
    And each is among the palette's family colours

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::a_composition_has_its_diamond_at_the_whole_and_its_field_as_the_label
  Scenario: A composition has its diamond at the whole and its field as the label
    Given the demo model's DOT
    Then the Skill to Step edge has a diamond tail, no head, label "steps" and head label "0..*"

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::an_undetermined_kind_is_a_dashed_node_saying_why,_never_an_empty_box
  Scenario: An undetermined kind is a dashed node saying why
    Given the demo model's DOT
    Then the bean-defs node is rounded, filled and dashed, marked fa_uml_undetermined
    And it reads "could not determine: no validator registered"

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::a_union_type_stays_one_row:_no_record_shape_splits_the_label_at_`|`
  Scenario: A union type stays on one row of the class label
    Given a demo/skills section whose class has an attribute v of type "a | b | c"
    When its DOT is laid out with Graphviz
    Then the output contains "v [1] : a | b | c"

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::label_text_is_escaped_for_an_HTML-like_label
  Scenario: Label text is escaped for an HTML-like label
    Given the demo model's DOT, where a remark reads a <b> & "c"
    Then the DOT contains it as "a &lt;b&gt; &amp; &quot;c&quot;"

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::layout_scaffolding_is_invisible_and_marked,_so_the_viewer_neither_lists_nor_drags_it
  Scenario: Layout scaffolding is invisible and marked as an anchor
    Given the demo model's DOT with two sub-graphs
    When its grid_ lines are collected
    Then there is at least one
    And each is style=invis and has class "kg-graph-anchor"

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::one_sub-graph_needs_no_grid_anchors
  Scenario: A single sub-graph gets no grid anchors
    Given a model with only the demo/skills section
    When its DOT is drawn
    Then it contains no grid_ anchor

  @test:scripts/tests/ui/uml-overview-dot.test.ts::dot()_draws_the_overview_model::it_lays_out_with_the_pinned_Graphviz
  Scenario: The demo DOT lays out with the pinned Graphviz
    Given the demo model's DOT
    When it is unflattened and laid out with Graphviz
    Then the SVG has a node with class "fa_uml_kind_skills"
    And it has the Skill to Step edge titled demo_skills_Skill->demo_skills_Step

  @test:scripts/tests/ui/uml-overview-dot.test.ts::every_committed_DOT_is_the_model_its_.puml_draws::there_is_a_DOT_for_an_overview
  Scenario: There is a built DOT for an overview
    # Skipped: when the site's overview DOTs have not been built
    Given the site's built overview DOT directory
    Then it holds at least one .dot file

  @test:scripts/tests/ui/uml-overview-dot.test.ts::every_committed_DOT_is_the_model_its_.puml_draws::each_DOT_has_its_.puml,_with_every_class,_its_colour,_every_package_and_every_composition
  Scenario: Each built DOT matches its .puml's classes, colours, packages and compositions
    Given each built overview DOT
    Then a .puml exists at the same relative path under the UML overview directory
    And every .puml class appears in the DOT filled with the .puml's colour
    And every .puml package is a DOT cluster
    And the DOT has as many composition edges as the .puml has compositions

  @test:scripts/tests/ui/uml-overview-dot.test.ts::every_committed_DOT_is_the_model_its_.puml_draws::each_lays_out_with_the_pinned_Graphviz
  Scenario: Each built DOT lays out with the pinned Graphviz
    Given each built overview DOT
    When it is unflattened and laid out with Graphviz
    Then none fails
