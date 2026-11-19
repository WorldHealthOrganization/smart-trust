# The code reaches bootstrap-tools by package name, never by climbing out of
# its own directory (bean pxtk). Each Scenario names the test that executes it.
Feature: bootstrap-tools is imported by package name

  @test:scripts/tests/package-imports.test.ts::bootstrap-tools_by_package_name_(pxtk)::no_tracked_source_imports_bootstrap-tools_by_climbing_out_of_the_repository
  Scenario: No tracked source imports bootstrap-tools by climbing out of the repository
    When this layer's and the harness's tracked .ts and .js files are searched for a ../bootstrap-tools/ import
    Then neither repository has one

  @test:scripts/tests/package-imports.test.ts::bootstrap-tools_by_package_name_(pxtk)::the_package_is_declared,_and_resolved_by_workspace_both_inside_and_beside
  Scenario: The package is declared and resolved by workspace inside and beside
    Then this layer's package.json depends on @litlfred/bootstrap-tools
    And its workspaces include bootstrap-tool[s] and ../bootstrap-tool[s]

  @test:scripts/tests/package-imports.test.ts::bootstrap-tools_by_package_name_(pxtk)::the_name_resolves_to_a_bootstrap-tools_beside_or_inside_this_checkout,_not_a_downloaded_copy
  Scenario: The name resolves to a bootstrap-tools checkout, not a downloaded copy
    When @litlfred/bootstrap-tools/schemas/graph.ts is resolved from this layer
    Then it is not a downloaded copy under node_modules, and it ends in /bootstrap-tools/schemas/graph.ts
