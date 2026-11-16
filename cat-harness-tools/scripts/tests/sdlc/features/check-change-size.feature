# schemas/sdlc/change-size.ts classifies changed files as code, prose/KG or exempt and weighs their lines
# into an effective change size against a 400-line threshold. Each Scenario names the test that executes it.
Feature: Weighted change size of a pull request

  @test:scripts/tests/sdlc/check-change-size.test.ts::classifyFilePath_—_file_categorization::identifies_executable_code_files
  Scenario: Source files in TypeScript, JavaScript, Python and shell are classified as code
    Given the paths "cat-harness/scripts/check-spec.ts", "src/index.js", "pipeline/runner.py" and "scripts/build.sh"
    When each path is classified
    Then each is "code"

  @test:scripts/tests/sdlc/check-change-size.test.ts::classifyFilePath_—_file_categorization::identifies_prose_and_knowledge_graph_documentation_files
  Scenario: Markdown documentation is classified as prose and knowledge graph
    Given the paths "README.md", "cat-harness/sdlc/skills/spec-kit/spec-kit.md", "skills/authoring/intro.md" and "docs/guides/agent-onboarding.md"
    When each path is classified
    Then each is "prose_kg"

  @test:scripts/tests/sdlc/check-change-size.test.ts::classifyFilePath_—_file_categorization::identifies_exempt_files_(lockfiles,_generated_QA_sidecars,_build_artifacts)
  Scenario: Lockfiles, QA sidecars, JSON-LD exports and build output are exempt
    Given the paths "bun.lock", "package-lock.json", "cat-harness/test/results/kg-export.qa.json", "library/mcp/prose-001.jsonld", "_site/index.html" and "dist/bundle.js"
    When each path is classified
    Then each is "exempt"

  @test:scripts/tests/sdlc/check-change-size.test.ts::calculateChangeSize_—_weights,_threshold_and_exemptions::code_is_weighted_at_1.0
  Scenario: Code lines count at full weight
    Given one code file with 200 changed lines
    When the change size is calculated
    Then there are 200 code lines, 0 prose lines and 0 exempt lines
    And the effective size is 200
    And the threshold is not exceeded

  @test:scripts/tests/sdlc/check-change-size.test.ts::calculateChangeSize_—_weights,_threshold_and_exemptions::prose_and_KG_documentation_are_weighted_at_0.25_(4x_line_allowance)
  Scenario: Prose lines count at a quarter weight
    Given one Markdown file with 800 changed lines
    When the change size is calculated
    Then there are 0 code lines, 800 prose lines and 0 exempt lines
    And the effective size is 200
    And the threshold is not exceeded

  @test:scripts/tests/sdlc/check-change-size.test.ts::calculateChangeSize_—_weights,_threshold_and_exemptions::exempt_files_(lockfiles,_generated)_contribute_zero_effective_lines
  Scenario: Exempt files add nothing to the effective size
    Given "bun.lock" with 5000 changed lines, a QA sidecar with 1000 and a code file with 150
    When the change size is calculated
    Then there are 150 code lines and 6000 exempt lines
    And the effective size is 150
    And the threshold is not exceeded

  @test:scripts/tests/sdlc/check-change-size.test.ts::calculateChangeSize_—_weights,_threshold_and_exemptions::exceeds_threshold_when_effective_lines_cross_400
  Scenario: A change of more than 400 effective lines exceeds the threshold
    Given two code files with 300 and 150 changed lines
    When the change size is calculated
    Then the effective size is 450
    And the threshold is exceeded

  @test:scripts/tests/sdlc/check-change-size.test.ts::calculateChangeSize_—_weights,_threshold_and_exemptions::mixed_code_and_prose_calculation_accurately_combines_weighted_lines
  Scenario: Code, prose and exempt lines combine by their weights
    Given a code file with 250 changed lines, a Markdown file with 400 and "bun.lock" with 2000
    When the change size is calculated
    Then there are 250 code lines, 400 prose lines and 2000 exempt lines
    And the effective size is 350
    And the threshold is not exceeded

  @test:scripts/tests/sdlc/check-change-size.test.ts::DEFAULT_CHANGE_SIZE_THRESHOLD_—_structural_basis::threshold_structurally_carries_non-empty_basis,_metric,_limit_and_mode
  Scenario: The default threshold carries its metric, limit, mode, weights and cited basis
    Given the default change-size threshold
    Then its metric is "effective_lines", its limit 400 and its mode "report"
    And its basis is longer than 20 characters and cites "Cohen et al., 2006" and "Google Modern Code Review"
    And its weights are 1.0 for code and 0.25 for prose_kg

  @test:scripts/tests/sdlc/check-change-size.test.ts::formatSc005Metric_—_SC-005_formatting::formats_compliance_as_count_with_denominator,_never_bare_percentage
  Scenario: The SC-005 metric is written as a count over its denominator with a percentage
    Given compliance counts of 4 of 32, 0 of 10 and 0 of 0
    When each is formatted
    Then they read "4 of 32 PRs (12.5%)", "0 of 10 PRs (0.0%)" and "0 of 0 PRs (0%)"
