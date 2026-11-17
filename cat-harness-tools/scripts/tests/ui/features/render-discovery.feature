# pipeline/render-discovery.ts resolves the render target a folio validates against from its
# declared profile, and reports every way of not having one as a miss rather than a pass.
# Each Scenario names the test that executes it.
Feature: Render target discovery

  @test:scripts/tests/ui/render-discovery.test.ts::the_built-in_targets::paper_renders_to_LaTeX_and_IS_structurally_checked
  Scenario: Paper renders to LaTeX and is structurally checked
    When the render target for profile "paper" is resolved
    Then there is no miss
    And the target's format is "latex"
    And the target has a validator

  @test:scripts/tests/ui/render-discovery.test.ts::the_built-in_targets::document_renders_to_Markdown_and_is_NOT_structurally_checked
  Scenario: Document renders to Markdown and is not structurally checked
    When the render target for profile "document" is resolved
    Then there is no miss
    And the target's format is "markdown"
    And the target has no validator

  @test:scripts/tests/ui/render-discovery.test.ts::the_built-in_targets::a_document_block_does_not_go_through_the_LaTeX_renderer
  Scenario: A document block does not go through the LaTeX renderer
    When the render targets for "paper" and "document" are resolved
    Then their formats differ

  @test:scripts/tests/ui/render-discovery.test.ts::the_built-in_targets::every_declared_target_actually_loads
  Scenario: Every declared render target loads
    Given every profile declared in the render targets table
    When each one's render target is resolved
    Then none is a miss

  @test:scripts/tests/ui/render-discovery.test.ts::no_target_is_a_reported_state,_never_a_pass::an_undeclared_profile_is_`no-profile`,_not_defaulted_to_paper
  Scenario: An undeclared profile is a no-profile miss, not defaulted to paper
    When the render target for no profile is resolved
    Then there is no target
    And the miss reason is "no-profile"

  @test:scripts/tests/ui/render-discovery.test.ts::no_target_is_a_reported_state,_never_a_pass::the_miss_carries_a_detail_a_reader_can_act_on
  Scenario: The miss carries a detail a reader can act on
    When the render target for no profile is resolved
    Then the miss detail mentions "profile"

  @test:scripts/tests/ui/render-discovery.test.ts::contributed_targets::a_contributed_target_wins_over_the_platform's_built-in
  Scenario: A contributed target wins over the built-in
    Given a contribution registry with a LaTeX renderer for "paper" that renders "CONTRIBUTED"
    When the render target for "paper" is resolved with that registry
    Then rendering with it gives "CONTRIBUTED"

  @test:scripts/tests/ui/render-discovery.test.ts::contributed_targets::with_no_registry_the_built-in_still_resolves
  Scenario: With no registry the built-in target still resolves
    When the render target for "paper" is resolved without a registry
    Then rendering a prose block with it does not give "CONTRIBUTED"

  @test:scripts/tests/ui/render-discovery.test.ts::argStyle_is_declared,_not_sniffed::both_call_shapes_produce_a_string_from_a_real_block
  Scenario: Both renderer call shapes produce a string from a real block
    Given a prose block labelled "test-prose"
    When it is rendered through the "paper" and the "document" targets
    Then each result is a string

  @test:scripts/tests/ui/render-discovery.test.ts::argStyle_is_declared,_not_sniffed::the_Markdown_renderer_receives_the_body,_not_`[object_Object]`
  Scenario: The Markdown renderer receives the body
    Given a prose block with body "UNIQUE BODY MARKER"
    When it is rendered through the "document" target
    Then the output contains "UNIQUE BODY MARKER"

  @test:scripts/tests/ui/render-discovery.test.ts::argStyle_is_declared,_not_sniffed::the_LaTeX_renderer_receives_the_body_too
  Scenario: The LaTeX renderer receives the body
    Given a prose block with body "UNIQUE BODY MARKER"
    When it is rendered through the "paper" target
    Then the output contains "UNIQUE BODY MARKER"
