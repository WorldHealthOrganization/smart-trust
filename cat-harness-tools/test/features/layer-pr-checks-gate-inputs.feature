# The layer PR-check gate runner (.github/scripts/layer-pr-checks/run-gates.py) gives each gate the input
# the run has, or skips it with a reason; root-cat-script.py adds a `cat` script to a root that lacks one.
# Each Scenario names the test that executes it.
Feature: Layer PR checks give gates their inputs and skip what they cannot judge

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::corpus-gate_is_given_--since_the_PR's_diff_base
  Scenario: corpus-gate is given --since with the PR's diff base
    Given GATE_DIFF_BASE is a 40-character sha
    When run-gates.py computes the arguments for "check:corpus-gate"
    Then the arguments are "--since" and that sha
    And there is no skip reason

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::corpus-gate_with_no_diff_base_is_skipped_with_a_reason,_never_run_bare
  Scenario: corpus-gate with no diff base is skipped with a reason instead of run bare
    Given no GATE_DIFF_BASE is set
    When run-gates.py computes the arguments for "check:corpus-gate"
    Then the arguments are null
    And the reason mentions "--since"

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::translation:catalogue:check_is_given_--base_the_PR's_diff_base,_not_a_three-dot_default
  Scenario: translation:catalogue:check is given --base with the PR's diff base
    Given GATE_DIFF_BASE is a 40-character sha
    When run-gates.py computes the arguments for "translation:catalogue:check"
    Then the arguments are "--base" and that sha with no skip reason
    And with no GATE_DIFF_BASE the arguments are null
    And the reason mentions "--base"

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::test-budgets_is_given_the_junit_report_the_tests_step_wrote
  Scenario: test-budgets is given the junit report the tests step wrote
    Given a junit report with 3 test cases at GATE_JUNIT
    When run-gates.py computes the arguments for "check:test-budgets"
    Then the only argument is the report's path
    And there is no skip reason

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::test-budgets_over_a_report_of_no_cases,_or_none,_is_skipped_with_a_reason
  Scenario: test-budgets over an empty or absent junit report is skipped with a reason
    Given a junit report with 0 test cases at GATE_JUNIT
    When run-gates.py computes the arguments for "check:test-budgets"
    Then the arguments are null and the reason mentions "no test cases"
    And with GATE_JUNIT pointing at "/nonexistent/junit.xml" the arguments are null
    And that reason mentions "absent"

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::a_gate_that_takes_no_input_runs_as_declared
  Scenario: A gate that takes no input runs with no arguments
    Given the gate "check:workflows" and no environment
    When run-gates.py computes its arguments
    Then the arguments are an empty list
    And there is no skip reason

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::the_supplied_gates_are_no_longer_in_the_never-supplied_list
  Scenario: No supplied gate is also listed as needing input
    Given run-gates.py's SUPPLIED_INPUTS and NEEDS_INPUT_SCRIPTS
    When the two are intersected
    Then the intersection is empty

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::post-merge:regen:check_is_skipped_as_live-state_so_it_does_not_run_the_gates_inside_the_gates_(bean_lpcs)
  Scenario: post-merge:regen:check is skipped as live-state
    Given the script "post-merge:regen:check"
    When run-gates.py asks for its skip reason
    Then the kind is "live-state"
    And the reason mentions "live state"

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::check:upstream-pins_is_skipped_as_live-state:_an_upstream_release,_not_the_diff,_turns_it_red
  Scenario: check:upstream-pins is skipped as live-state
    Given the script "check:upstream-pins"
    When run-gates.py asks for its skip reason
    Then the kind is "live-state"
    And the reason mentions "live state"

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::ingest:ig-chrome:check_is_skipped_as_needs-input_because_it_requires_external_--layer_template_checkouts_(smart-base#239)
  Scenario: ingest:ig-chrome:check is skipped as needs-input for its --layer checkouts
    Given the script "ingest:ig-chrome:check"
    When run-gates.py asks for its skip reason
    Then the kind is "needs-input"
    And the reason mentions "--layer"

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::software:check_judges_the_runner,_not_the_checkout_(folio-assistant-core#287)
  Scenario: software:check is skipped as runner-state
    Given the script "software:check" and no environment
    When run-gates.py asks for its skip reason
    Then the kind is "runner-state"
    And the reason mentions "machine"

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::the_navbar_--strict_sweep_is_not_a_gate:_its_advisories_are_editorial_calls_(Q-FMR-12)
  Scenario: The navbar --strict sweep is skipped as sweep-only while the plain check is gated
    Given the script "check:navbar-consistency:strict"
    When run-gates.py asks for its skip reason
    Then the kind is "sweep-only"
    And the reason mentions "navbar-consistency:check"
    And "check:navbar-consistency:check" has no skip kind and no reason

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::the_diagram_SVGs_are_a_QA_report,_not_a_merge_gate_(owner,_2026-11-13);_the_KG's_JSON-LD_is_gated
  Scenario: Diagram SVG rendering is skipped as a QA report while the JSON-LD check is gated
    Given the script "render:bpmn:check"
    When run-gates.py asks for its skip reason
    Then the kind is "qa-report"
    And the reason mentions "QA report"
    And "gen:jsonld:check" has no skip kind and no reason

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::the_lock_and_default-branch_gates_are_skipped_in_layer_mode_only_(folio-assistant-core#287)
  Scenario: The lock and default-branch gates are skipped in layer mode only
    Given the scripts "mount:lock:check", "mount:remote:check", "check:draft-beans", "readmes:check", "readme-sections:check", "book:check" and "check:standalone"
    When run-gates.py asks for each one's skip reason with MODE "layer"
    Then each kind is "layer-mode"
    And with MODE "index" each has no skip kind and no reason

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::another_layer's_standalone_rehearsal_is_skipped_in_any_root_but_its_own_(smart-ra#213)
  Scenario: Another layer's standalone rehearsal is skipped in any root but its own
    Given the script "check:cat-harness-tools-standalone"
    When run-gates.py asks for its skip reason in MODE "layer" or "index" with own layers "smart-ra"
    Then the kind is "other-layer"
    And the reason mentions "cat-harness-tools's own CI"
    And in layer mode with own layer "cat-harness-tools" it is not skipped
    And in index mode with own layers "cat-harness", "cat-harness-tools" and "smart-base" it is not skipped
    And in layer mode with no own layers given it is not skipped

  @test:test/layer-pr-checks-gate-inputs.test.ts::run-gates.py_gate_inputs::the_bare-usage_gates_are_skipped_as_needs-input_(folio-assistant-core#287)
  Scenario: The bare-usage gates are skipped as needs-input
    Given the scripts "check:qa-corpus", "check:session-staleness", "folio:shim:check" and "publish:check"
    When run-gates.py asks for each one's skip reason
    Then each kind is "needs-input"

  @test:test/layer-pr-checks-gate-inputs.test.ts::root-cat-script.py::a_root_with_no_`cat`_script_gets_one_that_runs_the_harness's_runner
  Scenario: A root with no cat script gets one that runs the harness's runner
    Given a root package.json with only a "check:archimate" script
    And the runner at "cat-harness-tools/scripts/run-script.ts"
    When root-cat-script.py ensures the cat script
    Then it reports "added" with "bun cat-harness-tools/scripts/run-script.ts"
    And package.json now holds "check:archimate" and that "cat" script

  @test:test/layer-pr-checks-gate-inputs.test.ts::root-cat-script.py::a_root_that_declares_`cat`_keeps_its_own
  Scenario: A root that declares cat keeps its own
    Given a root package.json whose cat script is "bun cat-harness/scripts/run-script.ts"
    When root-cat-script.py ensures the cat script
    Then it reports "kept" with "bun cat-harness/scripts/run-script.ts"

  @test:test/layer-pr-checks-gate-inputs.test.ts::root-cat-script.py::before_bean_70lx_the_runner_is_cat-harness's
  Scenario: With only cat-harness's runner present the cat script uses it
    Given an empty root package.json and the runner at "cat-harness/scripts/run-script.ts"
    When root-cat-script.py ensures the cat script
    Then it reports "added" with "bun cat-harness/scripts/run-script.ts"

  @test:test/layer-pr-checks-gate-inputs.test.ts::root-cat-script.py::no_runner_anywhere_is_reported,_not_papered_over
  Scenario: A root with no runner anywhere is reported missing
    Given an empty root package.json and no runner file
    When root-cat-script.py ensures the cat script
    Then it reports "missing" with no command
