# <bootstrap.processes:precondition>: what must hold before a process starts
# (bean lv3j), and every way of writing one that lies refused at load. Each
# Scenario names the test that executes it.
Feature: Process preconditions

  @test:scripts/tests/precondition.test.ts::the_real_diagram_—_`initialize-harness`::declares_four_preconditions,_three_of_them_unobservable
  Scenario: initialize-harness declares four preconditions, three unobservable
    When the initialize-harness diagram is loaded
    Then it has four preconditions, the stated ones are knows-the-vocabulary, told-it-is-a-bootstrapping-agent and at-the-start, and one is checkable

  @test:scripts/tests/precondition.test.ts::the_real_diagram_—_`initialize-harness`::the_three_claims_about_the_ACTOR_all_come_back_could-not-determine
  Scenario: The three claims about the actor are could-not-determine
    When initialize-harness's preconditions are evaluated
    Then the could-not-determine ones are exactly the three stated claims

  @test:scripts/tests/precondition.test.ts::the_real_diagram_—_`initialize-harness`::the_one_claim_about_the_WORLD_is_answered,_and_answers_what_it_says
  Scenario: The one claim about the world is answered
    When readme-present is evaluated
    Then it is satisfied, checking that README.md exists relative to the bootstrap layer
    And evaluated against an empty directory it is unsatisfied

  @test:scripts/tests/precondition.test.ts::a_stated_precondition_can_never_read_as_satisfied::...even_when_one_is_hand-built_carrying_a_check_the_parser_would_refuse
  Scenario: A hand-built stated precondition carrying a check is still could-not-determine
    Then evaluating a stated precondition with a file-exists check gives could-not-determine

  @test:scripts/tests/precondition.test.ts::a_stated_precondition_can_never_read_as_satisfied::a_checkable_one_with_no_check_is_could-not-determine,_never_satisfied
  Scenario: A checkable precondition with no check is could-not-determine
    Then evaluating it gives could-not-determine

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::no_kind:_there_is_deliberately_no_default
  Scenario: A precondition with no kind is refused
    Then loading a process whose precondition has no kind fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::a_kind_that_is_neither
  Scenario: A kind that is neither stated nor checkable is refused
    Then loading a precondition of kind "probably" fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::checkable_with_no_check_—_the_central_case
  Scenario: A checkable precondition with no check is refused
    Then loading it fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::checkable_with_a_check_nobody_implemented
  Scenario: A checkable precondition with a check nobody implemented is refused
    Then loading one with check agent-understood and a ref fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::checkable_with_no_ref_—_a_check_that_does_not_know_what_to_check
  Scenario: A checkable precondition with no ref is refused
    Then loading a file-exists check with no ref fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::stated_WITH_a_check_—_mislabelled_either_way
  Scenario: A stated precondition with a check is refused
    Then loading it fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::no_id_—_a_verdict_that_cannot_name_its_subject
  Scenario: A precondition with no id is refused
    Then loading it fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::no_text_—_an_id_says_a_condition_exists,_not_what_it_is
  Scenario: A precondition with no text is refused
    Then loading it fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::a_ref_that_climbs_out_of_the_instance
  Scenario: A ref that climbs out of the instance is refused
    Given the diagram's layer is declared
    Then loading a file-exists check on ../x fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::an_absolute_ref
  Scenario: An absolute ref is refused
    Given the diagram's layer is declared
    Then loading a file-exists check on /etc/hosts fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::a_file_check_on_a_diagram_no_instance_owns_—_there_is_no_root_to_resolve_against
  Scenario: A file check on a diagram no instance owns is refused
    Given no layer declaration beside the diagram
    Then loading a file-exists check fails

  @test:scripts/tests/precondition.test.ts::refusals_—_every_way_of_writing_a_precondition_that_lies::two_sharing_an_id
  Scenario: Two preconditions sharing an id are refused
    Then loading two stated preconditions with one id fails

  @test:scripts/tests/precondition.test.ts::a_process_that_declares_none::gets_an_empty_list,_not_undefined_—_most_processes_are_this
  Scenario: A process that declares none gets an empty list
    When a process with no preconditions is loaded
    Then its preconditions and their evaluations are empty lists

  @test:scripts/tests/precondition.test.ts::a_file-exists_ref_resolves_against_the_owning_instance::not_the_repository_root_and_not_the_working_directory
  Scenario: A file-exists ref resolves against the owning instance
    Given a declared fixture checking here.txt
    When it is loaded
    Then the check's base is the diagram's directory and it is unsatisfied
    And once here.txt is written there it is satisfied
