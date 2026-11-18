# Where a subject page is linked: only on a site that writes one.
# Each Scenario names the test that executes it.
Feature: Subject page links

  @test:scripts/tests/subject-pages.test.ts::which_checkout_publishes_the_host's_site::the_host's_own_checkout_does
  Scenario: The host's own checkout publishes the host's site
    Given a checkout whose root is the host instance
    Then it publishes the host's site

  @test:scripts/tests/subject-pages.test.ts::which_checkout_publishes_the_host's_site::an_index_of_the_host's_layers_does:_its_root_declares_no_instance
  Scenario: An index of the host's layers publishes the host's site
    Given a checkout whose root config lists instances but declares none itself, with the host mounted under it
    Then it publishes the host's site

  @test:scripts/tests/subject-pages.test.ts::which_checkout_publishes_the_host's_site::a_downstream_does_not:_its_root_declares_another_instance,_and_builds_that_one's_site
  Scenario: A downstream does not publish the host's site
    Given a checkout whose root declares instance "down", with the host mounted under it
    Then it does not publish the host's site

  @test:scripts/tests/subject-pages.test.ts::subjectHref_in_this_checkout::a_file_outside_every_instance_gets_no_link
  Scenario: A file outside every instance gets no subject link
    When the subject link of a step in a BPMN file outside every instance is asked for
    Then there is none

  @test:scripts/tests/subject-pages.test.ts::subjectHref_in_this_checkout::a_host_process_gets_its_absolute_subject_IRI,_a_path_under_its_document_(when_this_checkout_is_the_host's)
  Scenario: A host process step gets its absolute subject IRI
    # Gap: the assertion runs only when a link is returned; if this checkout does not publish the host's site the test passes with no assertion, so it can never fail on a missing link.
    When the subject link of step "P/node/T" in a host process file is asked for
    Then if a link is returned, it is an absolute URL ending "/process/P/node/T"
