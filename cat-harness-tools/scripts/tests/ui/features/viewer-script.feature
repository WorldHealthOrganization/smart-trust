# viewer/index.html carries the whole paper viewer as inline scripts; these Scenarios check that the
# scripts parse and that its Lean helpers and route recogniser, evaluated from the page, behave.
# Each Scenario names the test that executes it.
Feature: Paper viewer inline scripts

  @test:scripts/tests/ui/viewer-script.test.ts::viewer/index.html::has_inline_scripts_to_check_—_finding_none_is_not_a_pass
  Scenario: The viewer page has inline scripts to check
    Given viewer/index.html
    When its inline scripts are collected
    Then there is at least one
    And the largest is over 100,000 characters

  @test:scripts/tests/ui/viewer-script.test.ts::viewer/index.html::every_inline_script_parses
  Scenario: Every inline script of the viewer parses
    Given each inline script of viewer/index.html
    When it is transpiled as an ES2022 module
    Then there are no diagnostics

  @test:scripts/tests/ui/viewer-script.test.ts::viewer/index.html::no_variable_is_used_before_its_declaration
  Scenario: No variable in the viewer is used before its declaration
    Given each inline script of viewer/index.html, checked as plain JavaScript
    When its semantic diagnostics are read
    Then none is a used-before-declaration diagnostic

  @test:scripts/tests/ui/viewer-script.test.ts::the_viewer's_Lean_helpers_read_both_shapes::a_ref-only_block_has_Lean,_named_by_its_declaration_without_the_package
  Scenario: A ref-only Lean block has Lean, named by its declaration without the package
    Given a Lean block with only the ref "qou:QOU.ChiSymAlt.chiPairProductC_eq"
    Then it has Lean
    And its declaration name is "QOU.ChiSymAlt.chiPairProductC_eq"

  @test:scripts/tests/ui/viewer-script.test.ts::the_viewer's_Lean_helpers_read_both_shapes::the_older_`decl`_/_`file`_shape_still_reads
  Scenario: The older decl and file Lean shape still reads
    Given a Lean block with decl "Foo.bar" and file "Foo/Bar.lean"
    Then its declaration name is "Foo.bar"
    And a block with only the file is named "Foo/Bar.lean"

  @test:scripts/tests/ui/viewer-script.test.ts::the_viewer's_Lean_helpers_read_both_shapes::no_ref,_decl_or_file_is_no_Lean,_and_names_nothing_rather_than_`undefined`
  Scenario: A block with no ref, decl or file has no Lean and names nothing
    Given a Lean block with only a validation, and no Lean block at all
    Then neither has Lean
    And no Lean block is named by the empty string

  @test:scripts/tests/ui/viewer-script.test.ts::the_viewer's_Lean_helpers_read_both_shapes::the_GitHub_source_link_is_used_only_in_the_shape_the_server_builds_(og5t,_ruling_A)
  Scenario: The GitHub source link is used only in the shape the server builds
    Given a pinned-commit github.com blob URL for litlfred/qou
    Then a block carrying it links to it
    And a javascript URL, another host, a branch instead of a commit, and an attribute-injecting URL each give no link
    And a block with no source URL, and no block, give no link

  @test:scripts/tests/ui/viewer-script.test.ts::the_viewer's_route_recogniser_takes_every_block_label,_not_a_hand-kept_list_(og5t)::tables,_algorithms_and_the_other_prefixes_qou_uses_are_labels
  Scenario: Every block label prefix qou uses is a route label
    Given the viewer's label recogniser
    Then "tbl:", "alg:", "def:", "ssec:", "subsec:", "viz:", "proof:" and "prose:" labels are recognised

  @test:scripts/tests/ui/viewer-script.test.ts::the_viewer's_route_recogniser_takes_every_block_label,_not_a_hand-kept_list_(og5t)::a_paper_id,_a_cross-paper_reference,_a_route_or_a_URL_is_not_a_label
  Scenario: A paper id, cross-paper reference, route or URL is not a label
    Given the viewer's label recogniser
    Then a paper id, "unital-groebner-bases:cor:pbw", "/view/quantum-observable-universe", "@claude/some-branch" and an https URL are not recognised
