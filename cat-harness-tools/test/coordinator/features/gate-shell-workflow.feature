# Specifies, by parsing the checkout's code-quality-gates.yml, the form in
# which jobs and steps name gate-shell.sh as a custom shell.
Feature: code-quality-gates.yml names gate-shell.sh in a form a runner can resolve

  @test:test/coordinator/gate-shell-workflow.test.ts::code-quality-gates.yml_wires_gate-shell.sh_in_a_form_a_runner_can_resolve::at_least_one_job_opts_in,_or_the_whole_mechanism_is_dead_code
  Scenario: At least one job or step uses a custom shell
    Given the jobs of code-quality-gates.yml
    When every custom shell, job default or step override, other than plain bash, is collected
    Then there is at least one

  @test:test/coordinator/gate-shell-workflow.test.ts::code-quality-gates.yml_wires_gate-shell.sh_in_a_form_a_runner_can_resolve::every_custom_`shell:`_names_bash_and_an_ABSOLUTE_path,_never_a_relative_one
  Scenario: Every custom shell is bash with an absolute workspace path
    Given every custom shell in code-quality-gates.yml
    When each is read
    Then it starts with "bash "
    And it contains "${{ github.workspace }}/"
    And it ends with "{0}"
    And it does not name a path relative as "bash cat-harness/"

  @test:test/coordinator/gate-shell-workflow.test.ts::code-quality-gates.yml_wires_gate-shell.sh_in_a_form_a_runner_can_resolve::the_plain_built-in_`bash`_appears_only_on_the_step_that_mounts_the_script's_own_layer
  Scenario: The plain built-in bash is used only on the mount step
    Given every step in code-quality-gates.yml whose shell is plain "bash"
    When its run command is read
    Then each one runs .github/mount-from-lock.sh with bash

  @test:test/coordinator/gate-shell-workflow.test.ts::code-quality-gates.yml_wires_gate-shell.sh_in_a_form_a_runner_can_resolve::the_script_every_custom_`shell:`_points_at_exists_at_that_repo_path
  Scenario: The script each custom shell names exists in the checkout
    Given every custom shell in code-quality-gates.yml
    When the workspace prefix and the trailing "{0}" are stripped
    Then the remaining path exists in the checkout
