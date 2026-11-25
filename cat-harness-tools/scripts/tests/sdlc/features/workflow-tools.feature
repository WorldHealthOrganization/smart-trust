# scripts/check-workflow-tools.ts checks that every script a workflow runs is a
# Tool linked to a process, exempting QC checks. Each Scenario names the test that executes it.
Feature: Every script a workflow runs is a Tool linked to a process

  @test:scripts/tests/sdlc/workflow-tools.test.ts::runBlocks::reads_inline_and_block_`run:`,_and_drops_comment_lines
  Scenario: Inline and block run steps are read and comment lines are dropped
    Given a workflow with an inline "run: bash x/a.sh", a block run holding a commented "bash x/commented.sh" and "bun run x/b.ts --flag"
    When its run blocks are read
    Then they contain "bash x/a.sh" and "bun run x/b.ts --flag"
    And they do not contain the commented line

  @test:scripts/tests/sdlc/workflow-tools.test.ts::resolvePath::a_workflow's_checkout_prefix_is_dropped_until_the_rest_is_a_file
  Scenario: Leading checkout path segments are dropped until the rest names a file
    Given a tree holding lay/.github/scripts/x.py, lay/scripts/y.ts and .github/m.sh
    When "ci/.github/scripts/x.py" is resolved from layer "lay"
    Then it resolves to "lay/.github/scripts/x.py"
    And "fa/.github/m.sh" from "." resolves to ".github/m.sh"
    And "./lay/scripts/y.ts" from "." resolves to "lay/scripts/y.ts"

  @test:scripts/tests/sdlc/workflow-tools.test.ts::resolvePath::a_path_built_at_run_time,_or_naming_no_file,_resolves_to_nothing
  Scenario: A run-time path or a path to no file resolves to nothing
    Given a tree holding only a.ts
    When "$RUNNER_TEMP/a.ts" is resolved
    Then it resolves to nothing
    And "nowhere/b.ts" also resolves to nothing

  @test:scripts/tests/sdlc/workflow-tools.test.ts::assess::a_Tool_with_a_process_link_is_clean;_one_without_is_no-process;_none_is_no-tool
  Scenario: A linked Tool is clean, an unlinked Tool is no-process, and no Tool is no-tool
    Given a workflow running linked.sh, unlinked.ts, bare.py and the package key "do:it" that runs keyed.ts
    And a Tool for linked.sh satisfying a skill a BPMN process references
    And a Tool for unlinked.ts satisfying an unreferenced skill
    And a Tool for "do:it" with subprocess "proc-b"
    When the workflow is assessed
    Then the findings are unlinked.ts as "no-process" and bare.py as "no-tool"
    And keyed.ts and linked.sh are ok

  @test:scripts/tests/sdlc/workflow-tools.test.ts::assess::processesOf_joins_satisfies_to_BPMN_skill_refs,_and_adds_subprocesses
  Scenario: A Tool's processes are its satisfied skills' BPMN processes plus its subprocesses
    Given skill "skill-a" referenced by process "proc-a"
    When the processes of a Tool satisfying "skill-a" with subprocess "proc-c" are read
    Then they are "proc-a" and "proc-c"
    And a Tool satisfying only an unreferenced skill has no processes

  @test:scripts/tests/sdlc/workflow-tools.test.ts::QC_checks_need_no_Tool::a_gate_key,_a_--check_run_or_a_check-*_file_is_exempt;_a_producing_run_of_the_same_file_is_not
  Scenario: Check keys, --check runs and check-* files are QC, but a producing run of the same file is judged
    Given a workflow running "cat check:thing", gen-a.ts --check, gen-b.ts --check, gen-b.ts --out x and check-c.ts
    And no Tools
    When the workflow is assessed
    Then the only finding is gen-b.ts
    And 3 invocations are counted as QC

  @test:scripts/tests/sdlc/workflow-tools.test.ts::QC_checks_need_no_Tool::a_lint_key,_a_`verify`_subcommand_and_an_audit/verify/gates_segment_are_QC_too
  Scenario: Lint keys, verify subcommands and audit or gates scripts are QC too
    Given a workflow running "cat lint", "sign.sh verify", determinism-audit.sh, run-root-gates.py and "sign.sh file x"
    And no Tools
    When the workflow is assessed
    Then the only finding is sign.sh, for its producing run
    And 3 invocations are counted as QC

  @test:scripts/tests/sdlc/workflow-tools.test.ts::QC_checks_need_no_Tool::a_step_a_Tool's_own_script_runs_is_covered_by_that_Tool
  Scenario: A script named inside a Tool's own script is covered by that Tool
    Given a workflow running lay/scripts/step.ts
    And a Tool "main" whose script lay/scripts/main.ts names lay/scripts/step.ts
    When the workflow is assessed
    Then there are no findings
    And the step is ok, covered by Tool "main"

  @test:scripts/tests/sdlc/workflow-tools.test.ts::a_workflow_Tool::`gh_workflow_run_<file>`_covers_the_workflow's_scripts_and_those_of_the_reusable_workflows_it_calls
  Scenario: A gh workflow run Tool covers the scripts of the reusable workflows its workflow calls
    Given a caller workflow that uses the reusable workflow of layer "lay"
    And the reusable workflow runs lay/.github/scripts/helper.py
    And a Tool "ci-x" invoking "gh workflow run caller.yml"
    When the reusable workflow is assessed
    Then there are no findings
    And helper.py is ok, covered by Tool "ci-x"
