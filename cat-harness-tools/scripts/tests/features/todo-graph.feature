# The todos as one JSON-LD graph, a thin page per todo, and site nodes
# published at the IRIs they carry (issue #1908). "The sample todo" is
# a-todo, open and high priority, targeting node n of page p, with a who,
# two bean (one unresolved), a PR and a process relation. The "what is
# published" tests read the committed site output and skip when it is not
# built. Each Scenario names the test that executes it.
Feature: The todo graph and its pages

  @test:scripts/tests/todo-graph.test.ts::todo_IRIs::a_todo's_IRI_is_extensionless_under_the_singular_kind,_its_data_the_IRI_plus_.jsonld_(issue_#1830)
  Scenario: A todo's IRI is extensionless under todo/, and its data is the IRI plus .jsonld
    Then a-todo's site path is "todo/a-todo.jsonld" and its IRI the docs site base plus "todo/a-todo"
    And the docs site base is "https://litlfred.github.io/folio-assistant/"

  @test:scripts/tests/todo-graph.test.ts::todo_IRIs::the_rendering_is_the_directory_the_IRI_names,_so_the_host_serves_it_at_the_IRI
  Scenario: A todo's page is the directory its IRI names
    Then a-todo's page path is "todo/a-todo/", which under the site base is its IRI with a trailing slash

  @test:scripts/tests/todo-graph.test.ts::todo_IRIs::a_segment_never_carries_a_character_that_would_end_a_Liquid_string
  Scenario: A segment escapes an apostrophe
    Then the segment of "it's" is "it%27s"

  @test:scripts/tests/todo-graph.test.ts::the_JSON-LD::typed_edges:_target_is_an_IRI_edge_to_the_site_node;_who,_bean,_PR,_process
  Scenario: The sample todo's edges are typed
    When the sample todo's document is expanded
    Then its id is its IRI and its type ical Vtodo
    And schema:about is the site node of p#n, and schema:agent the who's GitHub URL
    And dcterms:isPartOf holds the resolved bean's IRI and an unresolved entry without an id
    And dcterms:references holds one PR, and dcterms:subject the value "Process_X"

  @test:scripts/tests/todo-graph.test.ts::the_JSON-LD::the_todo_carries_no_link_to_its_rendering
  Scenario: The todo's document does not link its page
    Then the sample todo's document does not mention its page path

  @test:scripts/tests/todo-graph.test.ts::the_JSON-LD::an_unresolved_label_keeps_the_label_and_gets_no_edge
  Scenario: An unresolved target label is kept with no edge
    Given the sample todo without a resolved target
    When its document is built
    Then it has no target and its label is "sec:p-n"

  @test:scripts/tests/todo-graph.test.ts::the_JSON-LD::the_graph_is_the_DECLARED_Subgraph_node,_naming_every_todo,_and_each_todo_points_back
  Scenario: The graph is the declared Subgraph node naming every todo
    Given a declared todos subgraph
    When the graph document of the sample todo is built
    Then its id is the subgraph's IRI and its type "Subgraph"
    And its hasPart and its graph name the todo's IRI, and it has no subgraph publication findings

  @test:scripts/tests/todo-graph.test.ts::the_JSON-LD::a_member's_subgraph_edge_is_its_own_term,_distinct_from_its_bean's_dcterms:isPartOf
  Scenario: Subgraph membership is its own term, distinct from the bean's isPartOf
    When the sample todo's document within the declared subgraph is expanded
    Then inSubgraph holds the subgraph's IRI
    And dcterms:isPartOf holds only the resolved bean's IRI

  @test:scripts/tests/todo-graph.test.ts::the_JSON-LD::the_container's_own_node_expands_to_the_bootstrap_Subgraph_class
  Scenario: The container node expands to the bootstrap Subgraph class
    When the graph document within the declared subgraph is expanded
    Then the container node's type is the bootstrap Subgraph term

  @test:scripts/tests/todo-graph.test.ts::the_JSON-LD::without_a_declared_subgraph,_no_container_is_invented
  Scenario: Without a declared subgraph no container is invented
    When the graph document of the sample todo is built with no subgraph
    Then it has no id and no type, and its graph holds one node

  @test:scripts/tests/todo-graph.test.ts::the_thin_page::themed,_JSON-LD_alternate,_no_content_written_in,_declares_its_todo_(issue_#1830)
  Scenario: The thin page is themed, links its JSON-LD, holds no content, and declares its todo
    When the sample todo's page is rendered
    Then it starts with the default layout's front matter and has no document, html, head or body tag
    And its JSON-LD alternate is "../a-todo.jsonld"
    And it has the summary heading but not the summary text, and no JSON config block
    And it is a todo page whose RDFa node is the todo's IRI typed ical Vtodo, with no page-node problems
    And it carries the target href, and loads kg-render.js before todo-page.js
    And a page with the old JSON config block is a legacy page, and this one is not

  @test:scripts/tests/todo-graph.test.ts::the_thin_page::a_config_cannot_close_its_own_script_element
  Scenario: A thin page's config cannot close its script element
    Given a thin page whose config value is "</script>"
    Then the page does not hold that value unescaped, and the config reads back unchanged

  @test:scripts/tests/todo-graph.test.ts::the_no-JS_floor::links_each_todo_to_its_own_page
  Scenario: The listing links each todo to its own page without JavaScript
    When the todo listing is rendered
    Then it links "Open this todo" to "/todo/a-todo/"

  @test:scripts/tests/todo-graph.test.ts::what_is_published::the_graph,_as_.jsonld_and_.json,_names_every_todo_in_the_index
  Scenario: The published graph names every todo in the index
    Given the site's todo index and graph are built, else the test is skipped
    Then todos.json and todos.jsonld are identical
    And the graph's hasPart is the IRI of every todo in the index, in order

  @test:scripts/tests/todo-graph.test.ts::what_is_published::%s::its_JSON-LD,_its_.json_and_its_page_exist
  Scenario: Each published todo has its JSON-LD, its .json and its page
    Given a todo in the built index
    Then its .jsonld and .json files exist, and its page is a todo page

  @test:scripts/tests/todo-graph.test.ts::what_is_published::%s::its_target_IRI_names_a_file_the_site_publishes
  Scenario: Each published todo's target IRI names a published site node
    Given a todo in the built index with a target
    Then the target's site node file exists, with a content context whose site part is the shared one and whose id is its site path
    And the published todo's target is that node's IRI

  @test:scripts/tests/todo-graph.test.ts::what_is_published::the_site_context_is_one_a_content_record_accepts
  Scenario: The site context is one a content record accepts
    Then the site document context parses as a content context
