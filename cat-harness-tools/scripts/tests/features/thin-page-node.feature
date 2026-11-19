# A thin page declares the node it renders (issue #1830).
# Each Scenario names the test that executes it.
Feature: Thin page node declaration

  Background:
    Given a thin page for node "https://example.org/tiny/widget/w1" of type "ex:Widget" with prefix "ex", a renderer and a family script

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::writes_the_node_in_RDFa_and_in_a_JSON-LD_stub,_and_the_two_agree
  Scenario: The node is written in RDFa and a JSON-LD stub that agree
    When the page is written
    Then the html element declares the "ex" prefix
    And the main element carries the node's resource and typeof
    And the head has a JSON-LD stub with the context, @id and @type
    And reading the page back gives the prefixes, the RDFa node and the stub with the expanded type
    And there are no problems

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::loads_the_generic_renderer_before_the_family's_script,_and_writes_no_private_config_block
  Scenario: The renderer loads first and no config block is written
    When the page is written
    Then "kg-render.js" appears before "widget.js"
    And there is no "application/json" script

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::refuses_a_body_with_no_element_carrying_the_node
  Scenario: A body with no node element is refused
    Then writing a page whose body carries no node attributes throws "no element of its body carries nodeAttrs"

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::refuses_a_hash_or_query_IRI,_an_undeclared_prefix,_and_a_node_without_the_renderer
  Scenario: Hash IRIs, undeclared prefixes and a missing renderer are refused
    # Gap: the title names a query IRI too; only a hash IRI is tried.
    Then a hash IRI throws "slash IRIs"
    And no prefixes throws 'prefix "ex"'
    And no renderer throws "generic renderer"

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::refuses_a_page_that_declares_neither_a_node_nor_a_config_block
  Scenario: A page with neither node nor config block is refused
    Then a page with no node and no config throws "neither a node nor a config block"

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::reports_an_RDFa_and_a_stub_that_disagree
  Scenario: Disagreeing RDFa and stub are reported
    Given the written page's stub @id is changed to ".../w2"
    Then the problem is "JSON-LD stub names .../w2, RDFa names .../w1"

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::still_writes_a_config-block_page_unchanged_when_no_node_is_given
  Scenario: A config-block page is still written
    When a page with no node but a config block "x-page" is written
    Then it holds the config JSON script, a plain html element, and no page node

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::ships_the_generic_renderer
  Scenario: The generic renderer script is shipped
    Then the renderer script selects "[resource][typeof]" and uses "window.kgRenderers"

  @test:scripts/tests/thin-page-node.test.ts::a_thin_page_that_declares_its_node::writes_the_small_page_at_a_node's_IRI_with_the_same_declaration,_a_link_and_a_redirect,_and_no_script
  Scenario: The node's IRI page is a small redirect
    When the stub page at the node's IRI is written
    Then it has no problems and its RDFa names the node
    And it refreshes to and links canonically to the full page
    And it loads no script and is under 1000 bytes
