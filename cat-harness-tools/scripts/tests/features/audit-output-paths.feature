# Pipeline audit writers and benchmark runners default their output into build/, and
# scripts/benchmark-guard.ts (with its Python twin) refuses any declared graph directory.
# Each Scenario names the test that executes it.
Feature: Audit and benchmark output paths

  @test:scripts/tests/audit-output-paths.test.ts::audit_output_paths::qa-section-title-audit_honours_--out_like_its_three_siblings
  Scenario: qa-section-title-audit accepts an --out argument
    # Gap: source-text check only; the --out redirect is not run
    Given the source of pipeline/qa-section-title-audit.ts
    Then it contains 'indexOf("--out")'

  @test:scripts/tests/audit-output-paths.test.ts::benchmark_runner_output_paths_and_graph_isolation_(folio-assistant-wp49)::isDeclaredGraphPath_detects_all_declared_graph_paths
  Scenario: Paths inside declared graph directories are recognised as graph paths
    Given the declared graph path check
    Then "beans/test.json", "todos/items.json", "test/results/qa.json" and "test/attestations/att.json" are graph paths
    And "library/item.json", "schemas/node.json" and "skills/sdlc/test.json" are graph paths

  @test:scripts/tests/audit-output-paths.test.ts::benchmark_runner_output_paths_and_graph_isolation_(folio-assistant-wp49)::isDeclaredGraphPath_allows_non-graph_report_paths
  Scenario: Report paths outside the graph directories are not graph paths
    Given the declared graph path check
    Then "build/benchmarks/toc.json", "build/results.json" and "reports/benchmark-report.json" are not graph paths

  @test:scripts/tests/audit-output-paths.test.ts::benchmark_runner_output_paths_and_graph_isolation_(folio-assistant-wp49)::assertBenchmarkOutputPath_throws_for_graph_destinations_and_allows_reports
  Scenario: The benchmark output guard throws for graph destinations and allows reports
    Given the benchmark output path assertion
    Then "beans/output.json" throws naming declared graph directory "beans"
    And "test/results/benchmark.json" throws naming declared graph directory "test/results"
    And "todos/bench.json" throws naming declared graph directory "todos"
    And "build/benchmarks/toc.json" and "reports/toc-synthesis.json" do not throw

  @test:scripts/tests/audit-output-paths.test.ts::benchmark_runner_output_paths_and_graph_isolation_(folio-assistant-wp49)::Python_benchmark_guard_rejects_graph_paths_and_allows_build/benchmarks/
  Scenario: The Python benchmark guard rejects graph paths and allows build/benchmarks/
    Given the Python benchmark guard script
    When it is run on "build/benchmarks/run.json"
    Then it exits with status 0
    And on "beans/run.json" it exits with status 1, saying it "resolves inside declared graph directory 'beans'"
    And on "test/results/run.json" it exits with status 1, saying it "resolves inside declared graph directory 'test/results'"

  @test:scripts/tests/audit-output-paths.test.ts::audit_output_paths::the_forbidden-path_patterns_match_the_literals_they_exist_to_catch
  Scenario: The forbidden-path patterns fire on the literals they exist to catch
    Given a "beans/<name>.json" and a "todos/<name>.json" literal, each in double and in single quotes
    Then the beans pattern matches each beans literal
    And the todos pattern matches each todos literal
    And the beans pattern matches neither "build/status-sections.json" nor "build/beans-status.json"

  @test:scripts/tests/audit-output-paths.test.ts::audit_output_paths::%s::does_not_default_into_beans/_or_todos/
  Scenario: An audit writer names no beans/ or todos/ JSON path as a string literal
    # Gap: source-text check only; the writers are not run
    Given the source of each pipeline audit writer: audit-status-sections.ts, extract-status-sections.ts, qa-agent-drain-queue.ts and qa-section-title-audit.ts
    Then it contains no double- or single-quoted "todos/<name>.json" literal
    And it contains no double- or single-quoted "beans/<name>.json" literal

  @test:scripts/tests/audit-output-paths.test.ts::audit_output_paths::%s::defaults_into_build/
  Scenario: An audit writer names a build/ JSON path as a string literal
    # Gap: source-text check only; the default output path is not run
    Given the source of each pipeline audit writer: audit-status-sections.ts, extract-status-sections.ts, qa-agent-drain-queue.ts and qa-section-title-audit.ts
    Then it contains a quoted "build/<name>.json" literal

  @test:scripts/tests/audit-output-paths.test.ts::benchmark_runner_output_paths_and_graph_isolation_(folio-assistant-wp49)::%s::does_not_default_into_beans/_or_todos/
  Scenario: A benchmark runner has no default under beans/ or todos/
    # Gap: source-text check only; the runners are not run
    Given the source of each benchmark runner: toc-benchmark.py, page-label-benchmark.py and formula-benchmark.py
    Then no default= value starts with "beans/", "./beans/" or a backslash variant
    And no default= value starts with "todos/", "./todos/" or a backslash variant

  @test:scripts/tests/audit-output-paths.test.ts::benchmark_runner_output_paths_and_graph_isolation_(folio-assistant-wp49)::%s::does_not_default_into_any_declared_graph_directory
  Scenario: A benchmark runner has no default under a declared graph directory
    # Gap: source-text check only; the runners are not run
    Given the declared graph directories read from scripts/
    And the source of each benchmark runner: toc-benchmark.py, page-label-benchmark.py and formula-benchmark.py
    Then for every declared graph directory, no default= value starts with that directory

  @test:scripts/tests/audit-output-paths.test.ts::benchmark_runner_output_paths_and_graph_isolation_(folio-assistant-wp49)::%s::defaults_its_output_into_build/benchmarks/
  Scenario: A benchmark runner defaults its output to a JSON file under build/benchmarks/
    # Gap: source-text check only; the default output path is not run
    Given the source of each benchmark runner: toc-benchmark.py, page-label-benchmark.py and formula-benchmark.py
    Then it contains a default= value "build/benchmarks/<name>.json"
