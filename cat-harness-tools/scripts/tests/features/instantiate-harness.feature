# scripts/instantiate-harness.ts instantiates a harness into a site root: it reads its
# arguments, resolves the closure of needed instances, writes the root's files and
# bootstrap, and plans its steps. Each Scenario names the test that executes it.
Feature: Instantiating a harness into a site root

  @test:scripts/tests/instantiate-harness.test.ts::arguments::a_harness_with_and_without_a_pin
  Scenario: A harness is accepted with or without a pin
    Given the argument "--harness litlfred/fhir-harness" with no ref
    When the arguments are parsed
    Then the harness ref is undefined
    And parsed with a harness ref, a "--pin", a "--repo-of" and "--local", the options carry the harness, its ref, the pins, the repo-of map, local true and pr true

  @test:scripts/tests/instantiate-harness.test.ts::arguments::refuses_what_it_cannot_use,_saying_why
  Scenario: Unusable arguments are refused with the reason
    When the arguments are parsed with no "--harness"
    Then it throws "--harness is required"
    And a harness not in OWNER/REPO form is refused naming "OWNER/REPO"
    And a pin that is not a sha is refused naming "40-character"
    And "--plan" with "--local" is refused with "pick one"
    And an unknown flag is refused with "unknown argument"

  @test:scripts/tests/instantiate-harness.test.ts::the_closure::every_instance_once,_breadth_first,_each_need_beside_the_instance_that_needs_it
  Scenario: The closure holds every instance once, breadth first
    Given fhir-harness's declared closure served by a fake fetcher at tip sha "a"
    When the closure of litlfred/fhir-harness is resolved
    Then its names are fhir-harness, folio-assistant-core, cat-harness, cat-harness-tools, bootstrap, bootstrap-tools in that order
    And every entry is at the tip ref
    And cat-harness, needed twice, is read only once

  @test:scripts/tests/instantiate-harness.test.ts::the_closure::--pin_and_the_harness's_own_pin_win_over_the_tip;_--repo-of_moves_a_need
  Scenario: A --pin and the harness's own pin win over the tip, and --repo-of moves a need
    Given the fhir closure with bootstrap served only from other/bootstrap
    When the closure is resolved with the harness at ref "f", a pin of cat-harness to "c" and "--repo-of bootstrap=other/bootstrap"
    Then fhir-harness is at ref "f"
    And cat-harness is at ref "c"
    And bootstrap's repository is other/bootstrap

  @test:scripts/tests/instantiate-harness.test.ts::the_closure::a_declaration_that_names_another_instance_is_refused,_with_the_remedy
  Scenario: A declaration naming another instance is refused with the remedy
    Given litlfred/bootstrap declares the name "something-else"
    When the fhir closure is resolved
    Then it throws saying it "declares `something-else`" and suggesting "--repo-of bootstrap="

  @test:scripts/tests/instantiate-harness.test.ts::the_closure::the_platform's_own_closure_is_what_the_bootstrap_lays_down
  Scenario: The platform's sub-closure is what the bootstrap lays down
    Given the resolved fhir closure
    When the sub-closure of cat-harness-tools is taken
    Then it holds exactly bootstrap, bootstrap-tools, cat-harness and cat-harness-tools

  @test:scripts/tests/instantiate-harness.test.ts::the_closure::a_need's_repository
  Scenario: A need's repository defaults to the harness owner and can be redirected
    When the repository of need cat-harness is asked for harness litlfred/fhir-harness
    Then it is litlfred/cat-harness
    And with a repo-of entry for cat-harness it is "who/cat-harness"

  @test:scripts/tests/instantiate-harness.test.ts::the_files_it_writes::index.config.json:_landing,_agent-run,_the_consenter_approves;_existing_values_kept
  Scenario: index.config.json gains landing, agent-run and the consenter as approver, keeping existing values
    Given a config with site keep ["x"] and mountApprovers ["a"]
    When the site and approver are set for fhir-harness and approver "b"
    Then the site keeps "keep" and gains landing "fhir-harness" and agentRun true
    And mountApprovers is ["a", "b"]
    And an approver already listed is not added twice

  @test:scripts/tests/instantiate-harness.test.ts::the_files_it_writes::package.json:_the_mounts_become_workspaces,_an_existing_manifest_is_kept
  Scenario: package.json lists the mounts as workspaces and keeps an existing manifest
    When workspaces are set with no existing manifest for root "smart-x"
    Then the manifest is named "smart-x-site", private, of type module, with the mounts as workspaces
    And an existing manifest keeps its name and has its workspaces replaced by the mounts

  @test:scripts/tests/instantiate-harness.test.ts::the_files_it_writes::package.json:_`cat`_is_the_bootstrap;_the_bare_runner_is_replaced,_a_root's_own_`cat`_kept
  Scenario: package.json's cat script is the bootstrap, replacing a bare runner but keeping a root's own
    When the cat script is set on a manifest with no scripts
    Then scripts.cat is the bootstrap command
    And a cat script running cat-harness-tools' or cat-harness's run-script.ts is replaced, other scripts kept
    And a root's own cat script "bun my/own.ts" is kept

  @test:scripts/tests/instantiate-harness.test.ts::the_files_it_writes::.github/:_the_two_bootstrap_files,_executable
  Scenario: The two .github bootstrap files are written executable
    Given an empty temporary repository
    When the root bootstrap is written
    Then .github/cat.ts and .github/mount-from-lock.sh exist
    And each has an executable mode bit set

  @test:scripts/tests/instantiate-harness.test.ts::the_files_it_writes::bunfig.toml:_the_hoisted_linker,_added_once
  Scenario: bunfig.toml gains the hoisted linker once
    When the hoisted linker is added to no file
    Then the result is an [install] section with linker = "hoisted"
    And an empty [install] section gains the linker line
    And a file with only a [test] section gets an [install] section appended after a blank line
    And an existing linker = "isolated" is left unchanged

  @test:scripts/tests/instantiate-harness.test.ts::the_files_it_writes::.gitignore:_node_modules/_once,_the_author's_lines_kept
  Scenario: .gitignore gains node_modules/ once, keeping the author's lines
    When node_modules/ is added to "output/" with or without a trailing newline
    Then the result is "output/" then "node_modules/", newline-terminated
    And a file already ignoring node_modules/ is unchanged

  @test:scripts/tests/instantiate-harness.test.ts::the_plan::names_every_step,_and_the_preview_path_of_the_branch
  Scenario: The plan names every step and the branch's preview path
    Given the fhir closure and the options with "--consent-by me"
    When the plan lines are made for branch "harness/fhir-harness"
    Then they mention seed, mount, install, instantiate:fhir-harness, prepare:fhir-harness and "branches/harness-fhir-harness/"
    And with local set the plan contains "--dry-run"

  @test:scripts/tests/instantiate-harness.test.ts::the_root_bootstrap,_.github/cat.ts::a_fresh_clone:_mounts_once,_then_runs_the_runner_with_the_arguments
  Scenario: A fresh clone mounts once and then runs the runner with the arguments
    Given a root with the real cat.ts and a stand-in mount script, nothing mounted
    When cat.ts is run with "prepare:x --flag"
    Then it exits 0 and the runner prints "runner prepare:x --flag"
    And the mount log records one mount
    And a second run prints "runner again" without mounting again

  @test:scripts/tests/instantiate-harness.test.ts::the_root_bootstrap,_.github/cat.ts::mounted_already:_hands_over_without_mounting
  Scenario: An already mounted root hands over without mounting
    Given a root whose runner is already mounted
    When cat.ts is run with "a"
    Then the runner prints "runner a"
    And no mount log is written

  @test:scripts/tests/instantiate-harness.test.ts::the_root_bootstrap,_.github/cat.ts::a_mount_that_fails_stops_with_its_exit_code
  Scenario: A failing mount stops with its exit code
    Given a root whose mount script exits 2
    When cat.ts is run
    Then it exits with status 2
    And stderr says "mounting failed"
