# scripts/check-workflow-injection.ts finds GitHub expressions interpolated into "run:" and "script:"
# blocks, grades them by what an attacker controls, and follows step and job outputs back to their source.
# Each Scenario names the test that executes it.
Feature: Workflow expression injection

  @test:scripts/tests/sdlc/workflow-injection.test.ts::classify::free_text_is_free_text_—_a_quote_is_all_it_takes
  Scenario: Attacker-written text is classified as free text
    Given the expressions for a PR title, PR body, comment body, head commit message, a dispatch input and "inputs.anything"
    When each is classified
    Then each is "free-text"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::classify::attacker-chosen_but_shape-constrained_is_reported,_not_ignored
  Scenario: Attacker-chosen but shape-constrained values are classified as constrained
    Given the expressions "github.head_ref", "github.event.pull_request.number" and "github.event.repository.name"
    When each is classified
    Then each is "constrained"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::classify::values_the_attacker_does_not_influence_are_not_reported_at_all
  Scenario: Values the attacker does not influence are not classified
    Given the expressions "github.workspace", "steps.slug.outputs.branch", "matrix.package" and "secrets.GITHUB_TOKEN"
    When each is classified without provenance
    Then each classifies to nothing

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_comparison_yielding_literals_is_not_an_injection::the_shell_receives_one_of_two_constants,_never_the_input
  Scenario: A comparison that yields only literals is not an injection
    Given the expression "inputs.force_rerender == true && '--force' || ''"
    When it is checked and classified
    Then it yields only literals
    And it classifies to nothing

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_comparison_yielding_literals_is_not_an_injection::but_a_branch_that_IS_an_input_still_reports
  Scenario: A comparison with an input as one branch still reports
    Given the expression "inputs.a == 'x' && inputs.b || ''"
    When it is checked and classified
    Then it does not yield only literals
    And it is "free-text"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_comparison_yielding_literals_is_not_an_injection::a_bare_input_with_no_comparison_is_not_laundered
  Scenario: A bare input is not treated as a literal-yielding comparison
    Given the expression "inputs.package"
    When it is checked
    Then it does not yield only literals

  @test:scripts/tests/sdlc/workflow-injection.test.ts::scanWorkflows_reads_`run:`_blocks_and_nothing_else::free_text_inside_a_run_block_is_found,_with_its_line
  Scenario: Free text in a run block is found with its line
    Given a workflow whose run block echoes the PR body on line 5
    When the workflows are scanned
    Then there is one free-text finding on line 5

  @test:scripts/tests/sdlc/workflow-injection.test.ts::scanWorkflows_reads_`run:`_blocks_and_nothing_else::the_SAME_expression_in_`env:`_is_not_reported_—_env_is_the_remedy
  Scenario: The same expression bound in env is not reported
    Given a step that binds the PR body to an env variable and echoes the variable in its run block
    When the workflows are scanned
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-injection.test.ts::scanWorkflows_reads_`run:`_blocks_and_nothing_else::an_expression_in_`with:`_is_not_a_shell_injection_and_is_not_graded
  Scenario: An expression in a with input is not reported
    Given a step whose with input "t" is the issue title
    When the workflows are scanned
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-injection.test.ts::scanWorkflows_reads_`run:`_blocks_and_nothing_else::a_one-line_`run:`_is_scanned_too,_not_just_a_block
  Scenario: A one-line run is scanned too
    Given a step with a one-line run that echoes the comment body
    When the workflows are scanned
    Then there is one free-text finding

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::the_producing_step_is_recorded_as_carrying_free_text,_keyed_job.stepId
  Scenario: A step that writes bound free text to its output is recorded as a producer
    Given a "release" job whose "version" step binds a dispatch input in env and writes it to GITHUB_OUTPUT
    When provenance is resolved
    Then "release.version" carries "free-text"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::the_consumption_is_FREE_TEXT,_and_the_finding_names_the_step_that_leaked
  Scenario: Interpolating a tainted step output is free text and names the leaking step
    Given the same job, with a later step interpolating "steps.version.outputs.version" into a run block
    When the workflows are scanned
    Then there is one free-text finding via "release.version"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::a_step_that_writes_an_output_but_binds_nothing_is_NOT_a_producer
  Scenario: A step that writes an output but binds nothing is not a producer
    Given a step that writes a literal to GITHUB_OUTPUT and binds nothing
    When provenance is resolved
    Then there are no producers

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::a_step_that_binds_free_text_but_writes_NO_output_is_not_a_producer_either
  Scenario: A step that binds free text but writes no output is not a producer
    Given a step that binds the PR body in env and writes it only to a file
    When provenance is resolved
    Then there are no producers

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::the_taint_is_JOB-scoped_—_step_outputs_are,_so_two_jobs_may_reuse_an_id
  Scenario: Output taint is scoped to its job, so two jobs may reuse a step id
    Given a "dirty" job whose step "v" outputs a dispatch input
    And a "clean" job whose step "v" outputs a literal and a later step interpolates "steps.v.outputs.x"
    When the workflows are scanned
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::a_job_output_is_followed_one_more_hop,_so_`needs.*.outputs.*`_inherits
  Scenario: A job output is followed through needs to its consumer
    Given a "setup" job whose output "sel" comes from a step that outputs "inputs.package"
    And a "use" job that interpolates "needs.setup.outputs.sel" into a run block
    When the workflows are scanned
    Then there is one free-text finding via "setup.sel"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::the_SAME_laundered_output_in_`env:`_is_still_not_reported_—_env_is_the_remedy
  Scenario: A tainted step output bound in env is not reported
    Given a tainted "version" step output that a later step binds in env and uses as a variable
    When the workflows are scanned
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_step_output_CARRIES_whatever_the_step_put_in_it_(bean_`6bhf`)::the_real_corpus_is_parsed,_not_skipped_—_an_empty_map_would_make_this_gate_vacuous
  Scenario: The repository's real workflows have at least one output producer
    Given the YAML files in the repository's .github/workflows
    When provenance is resolved for each
    Then the total number of producers is greater than zero

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_value_bound_ABOVE_the_step_still_reaches_its_output::a_WORKFLOW-level_env_taints_a_producer_that_binds_nothing_itself
  Scenario: A workflow-level env taints a producer that binds nothing itself
    Given a workflow-level env binding a dispatch input, and a step "v" in job "a" writing it to GITHUB_OUTPUT
    When provenance is resolved
    Then "a.v" carries "free-text"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_value_bound_ABOVE_the_step_still_reaches_its_output::a_JOB-level_env_taints_that_job's_producer_and_NOT_another_job's
  Scenario: A job-level env taints that job's producer and not another job's
    Given a "dirty" job with a job-level env binding a dispatch input, used by step "v"'s output
    And a "clean" job whose step "w" outputs a literal
    When provenance is resolved
    Then "dirty.v" carries "free-text"
    And "clean.w" is not a producer

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_value_bound_ABOVE_the_step_still_reaches_its_output::an_env_block_BELOW_the_steps_it_reaches_still_taints_them
  Scenario: A job-level env written below the steps still taints them
    Given a job whose env binding "inputs.tag" comes after its steps, and a step "v" that outputs it
    When provenance is resolved
    Then "a.v" carries "free-text"

  @test:scripts/tests/sdlc/workflow-injection.test.ts::a_value_bound_ABOVE_the_step_still_reaches_its_output::a_step-level_env_is_not_mistaken_for_a_job-level_one
  Scenario: A step-level env taints only its own step
    Given a step "v" with its own env binding "inputs.tag" and writing it to GITHUB_OUTPUT
    And a following step "w" that writes a literal
    When provenance is resolved
    Then "a.v" carries "free-text"
    And "a.w" is not a producer

  @test:scripts/tests/sdlc/workflow-injection.test.ts::`script:`_blocks_are_JavaScript,_and_the_same_values_land_in_them_(bean_`j0zs`)::free_text_in_a_`script:`_block_is_reported,_and_the_surface_says_so
  Scenario: Free text in a script block is reported with the script surface
    Given an actions/github-script step whose script interpolates the PR title
    When the workflows are scanned
    Then there is one free-text finding on the "script" surface

  @test:scripts/tests/sdlc/workflow-injection.test.ts::`script:`_blocks_are_JavaScript,_and_the_same_values_land_in_them_(bean_`j0zs`)::a_`run:`_finding_still_says_`run:`_—_the_surface_is_read,_not_assumed
  Scenario: A run finding reports the run surface
    Given a one-line run that echoes the comment body
    When the workflows are scanned
    Then the only finding is on the "run" surface

  @test:scripts/tests/sdlc/workflow-injection.test.ts::`script:`_blocks_are_JavaScript,_and_the_same_values_land_in_them_(bean_`j0zs`)::an_ordinary_`with:`_input_is_still_NOT_graded_—_only_`script:`_is_code
  Scenario: An ordinary with input is still not reported
    Given a step whose with input "title" is the issue title
    When the workflows are scanned
    Then there are no findings

  @test:scripts/tests/sdlc/workflow-injection.test.ts::`script:`_blocks_are_JavaScript,_and_the_same_values_land_in_them_(bean_`j0zs`)::the_baseline_key_carries_the_surface,_so_one_decision_cannot_baseline_the_other
  Scenario: The baseline key includes the surface
    Given a constrained "github.head_ref" finding in "w.yml"
    When its baseline key is made for the run and script surfaces
    Then they are "w.yml (run): github.head_ref" and "w.yml (script): github.head_ref"
    And the two keys differ

  @test:scripts/tests/sdlc/workflow-injection.test.ts::`script:`_blocks_are_JavaScript,_and_the_same_values_land_in_them_(bean_`j0zs`)::a_`script:`_block_ends_at_its_indentation,_like_a_`run:`_block
  Scenario: A script block ends at its indentation
    Given a script block with only a constant, followed by a step whose one-line run echoes the comment body
    When the workflows are scanned
    Then the only finding is on the "run" surface

  @test:scripts/tests/sdlc/workflow-injection.test.ts::`script:`_blocks_are_JavaScript,_and_the_same_values_land_in_them_(bean_`j0zs`)::the_real_corpus_HAS_`script:`_blocks_that_are_scanned_—_else_this_is_inert
  Scenario: Every script block in the real workflows is scanned
    Given a copy of each real workflow with the comment body planted on the first line of one of its script blocks
    When the copies are scanned
    Then at least one script block was planted
    And each planted expression is found on the "script" surface

  @test:scripts/tests/sdlc/workflow-injection.test.ts::staleNotThisRoots_—_a_baseline_line_for_another_root's_workflow::an_instance_root_without_the_named_workflow_excuses_the_line
  Scenario: An instance root without the named workflow excuses that baseline line
    Given baseline lines for "feature-staging.yml" and "pr.yml"
    And an instance root "smart-ips-pilgrimage" holding only "pr.yml"
    When the lines stale for another root are found
    Then only the "feature-staging.yml" line is excused

  @test:scripts/tests/sdlc/workflow-injection.test.ts::staleNotThisRoots_—_a_baseline_line_for_another_root's_workflow::a_root_that_HAS_the_workflow_still_fails_the_stale_line
  Scenario: A root that has the named workflows excuses no baseline line
    # Gap: only checks that nothing is excused, not that the check then fails
    Given the same baseline lines and an instance root holding both workflows
    When the lines stale for another root are found
    Then none is excused

  @test:scripts/tests/sdlc/workflow-injection.test.ts::staleNotThisRoots_—_a_baseline_line_for_another_root's_workflow::the_index_root,_which_declares_no_instance,_is_judged_exactly_as_before
  Scenario: The index root, which declares no instance, excuses no baseline line
    # Gap: only checks that nothing is excused, not the rest of the judgement
    Given the same baseline lines and a root with no instance file and no workflows
    When the lines stale for another root are found
    Then none is excused
