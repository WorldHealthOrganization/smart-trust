# The layer PR-check scripts judge a layer PR on the index checks that read it: gate_diagnostics.py keys
# findings, index-gates.json names the index gates run-gates.py runs, and reader-tests.py finds other
# instances' tests that name the layer. Each Scenario names the test that executes it.
Feature: Layer PRs are judged on the index checks that read them

  @test:test/layer-pr-checks-index-checks.test.ts::gate_diagnostics.py:_the_harness's_own_finding_shapes::run-gates.py's_findings()_is_this_parser_(one_parser,_#1457)
  Scenario: run-gates.py's findings() gives the same result as gate_diagnostics.py
    Given gate output with a counted finding heading, an item under it and a single finding
    When run-gates.py's findings() and gate_diagnostics.py's diagnostics() both read it
    Then the two results are equal

  @test:test/layer-pr-checks-index-checks.test.ts::gate_diagnostics.py:_the_harness's_own_finding_shapes::core#630:_a_qa-results_baseline's_new_findings,_by_family
  Scenario: A qa-results baseline's new findings are keyed by family
    Given baseline output listing two new findings under "new in wrong-direction:"
    When gate_diagnostics.py reads it
    Then the result is each finding's JSON prefixed "new in wrong-direction: "
    And the baseline summary line is not a finding

  @test:test/layer-pr-checks-index-checks.test.ts::gate_diagnostics.py:_the_harness's_own_finding_shapes::a_✗_finding_is_kept;_the_items_under_a_counted_✗_heading_are_kept,_the_count_is_not
  Scenario: A single finding is kept and a counted heading keeps its items but not its count
    Given output with a single "✗" finding, a "✗ 2 finding(s):" heading with two items, and a counted kind JSON Schema heading
    When gate_diagnostics.py reads it under the root "/r/fa"
    Then the single finding is kept without its marker
    And the two items are kept with the "/r/fa/" root stripped from the first
    And neither counted heading is kept

  @test:test/layer-pr-checks-index-checks.test.ts::gate_diagnostics.py:_the_harness's_own_finding_shapes::who-iris#239:_a_re-pin_that_only_changes_the_commits_a_finding_names_is_not_a_new_key
  Scenario: A finding that differs only in the commits it names is the same key
    Given two pin-mismatch findings that differ only in their 12-character commit hashes
    When gate_diagnostics.py reads each
    Then the two results are equal
    And each commit is replaced by "<commit>"
    And "✗ decade 2026 facade" becomes "decade # facade", keeping hex-letter words and replacing the number

  @test:test/layer-pr-checks-index-checks.test.ts::gate_diagnostics.py:_the_harness's_own_finding_shapes::a_count_that_went_down,_a_duration_or_a_temporary_directory_is_not_a_new_key
  Scenario: A changed count, duration or temporary directory is not a new key
    Given one output with "6 finding(s)", "1.5 s" and "/tmp/abc123/x"
    And another with "5 finding(s)", "12 s" and "/tmp/zz9/x"
    When gate_diagnostics.py reads each
    Then the two results are equal
    And they are "a: stale" and "b took # s in /tmp/<tmp>/x"

  @test:test/layer-pr-checks-index-checks.test.ts::index-gates.json::names_the_index_checks_the_re-pin_caught,_each_a_script_this_layer_declares,_under_its_declared-gate_name
  Scenario: index-gates.json names the index checks under their declared-gate names
    Given the gates in index-gates.json and this layer's package.json scripts and checkoutScripts
    Then the gates include "check:reference-direction:check", "check:prov-qaqc", "libraries:check" and "gen:jsonld:check"
    And they do not include "render:bpmn:check"
    And every gate's script is declared by this layer
    And every gate is named "cat-harness-tools:<script>"

  @test:test/layer-pr-checks-index-checks.test.ts::index-gates.json::run-gates.py_runs_them_for_a_caller_whose_harness_does_not_reach_cat-harness-tools
  Scenario: run-gates.py runs the index gates for a caller whose harness does not reach cat-harness-tools
    Given a root with one instance "low" that needs nothing and declares "check:own"
    When run-gates.py derives the gates for "low"
    Then every index gate is derived as "bun run cat <script>"
    And "low:check:own" is derived as "bun run cat check:own"

  @test:test/layer-pr-checks-index-checks.test.ts::index-gates.json::an_index_gate_whose_script_the_MOUNTED_cat-harness-tools_does_not_declare_yet_is_skipped_as_not-at-pin,_never_run_as_'no_script'
  Scenario: An index gate whose script the mounted cat-harness-tools does not declare is skipped as not-at-pin
    Given a root with an instance "low" and a mounted cat-harness-tools
    And the mounted cat-harness-tools declares every index gate's script except the last
    When run-gates.py derives the gates for "low"
    Then the missing script's gate is not derived
    And it is skipped with kind "not-at-pin", command "bun run cat <script>" and a reason naming the script
    And every other index gate is derived as "bun run cat <script>"

  @test:test/layer-pr-checks-index-checks.test.ts::index-gates.json::run-gates.py_own_instances_reads_both_`instances`_and_the_migrated_`layers`_+_`harnesses`_form_of_index.config.json_(cat-harness#1138)
  Scenario: run-gates.py reads the layers and harnesses form of index.config.json
    Given a root with a declared instance "ig"
    And an index.config.json listing layers "ig" and "unmounted" and harness "ig"
    When run-gates.py lists the instances in the root
    Then they are only "ig"
    And the own instances are "ig"

  @test:test/layer-pr-checks-index-checks.test.ts::reader-tests.py:_other_instances'_tests_that_name_the_layer::who-iris#175:_the_navbar-checkout_test_that_lists_who-iris's_graphs_is_a_reader;_the_layer's_own_tests_are_not
  Scenario: A test in another instance that names the layer is a reader and the layer's own tests are not
    Given instances "who-iris" and "tools"
    And who-iris has its own test naming who-iris
    And tools has tests naming "who-iris", a test naming only "who-irisx", and a non-test helper naming "who-iris"
    When reader-tests.py lists the readers of "who-iris"
    Then it exits 0
    And it prints "./tools/test/navbar-checkout.test.ts" and "./tools/test/path.test.ts"

  @test:test/layer-pr-checks-index-checks.test.ts::reader-tests.py:_other_instances'_tests_that_name_the_layer::more_readers_than_the_cap_runs_none,_and_says_so
  Scenario: More readers than the cap runs none and says so
    Given the same instances, with two readers of who-iris
    When reader-tests.py lists the readers of "who-iris" with a cap of 1
    Then it prints nothing
    And stderr says "more than 1"
