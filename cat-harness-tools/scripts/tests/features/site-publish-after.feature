# A site publish waits for the workflows that seed what the site is built
# from, derived from the publishers the mounted layers declare. Each Scenario
# names the test that executes it.
Feature: The workflows a site publish waits for

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::a_repository_declaring_no_publishAfter_still_waits_for_the_workflow_a_publisher_says_seeds_its_site
  Scenario: The publisher's seeder is waited for without site.publishAfter
    Given an IG repository whose index.config.json declares no publishAfter, and a publisher that declares refresh-cache.yml as its seeder
    When the workflows to wait for are derived
    Then refresh-cache.yml is waited for

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::the_caller_is_found_by_what_it_calls,_not_by_its_own_file_name
  Scenario: The caller is found by what it calls
    Given a workflow named ast.yml that calls refresh-cache.yml
    When the workflows to wait for are derived
    Then ast.yml is waited for, and the reason names refresh-cache.yml

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::site.publishAfter_adds_to_the_derived_ones,_once_each,_and_a_name_that_is_not_a_workflow_file_is_dropped
  Scenario: Declared waits add to the derived ones
    Given site.publishAfter names refresh-cache.yml, other.yml, a path and a number
    When the workflows to wait for are derived
    Then other.yml and refresh-cache.yml are waited for, once each

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::the_publish's_own_caller_is_never_waited_for,_even_when_declared
  Scenario: The publish never waits for itself
    Given site.publishAfter names the caller of folio-site-publish.yml
    When the workflows to wait for are derived
    Then only refresh-cache.yml is waited for

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::with_no_publisher_declaring_what_seeds_it,_only_site.publishAfter_is_waited_for
  Scenario: No declared seeder waits for nothing
    Given a publisher that declares no after
    When the workflows to wait for are derived
    Then nothing is waited for

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::a_publisher's_after_must_be_a_list_of_file_names
  Scenario: A publisher's after is a list
    Given a publisher whose after is a string
    When it is checked as a site publisher
    Then it is not one

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::site.publishAfter_is_read_from_index.config.json,_and_an_unreadable_one_declares_none
  Scenario: site.publishAfter is read from index.config.json
    Given a directory with no, a valid and an unreadable index.config.json
    When site.publishAfter is read
    Then it is none, the list, and none

  @test:scripts/tests/site-publish-after.test.ts::site-publish-after::the_shared_publish_waits_after_the_mount,_on_a_manual_run_as_well_as_a_push
  Scenario: The shared publish waits after the mount on any trigger
    Given folio-site-publish.yml
    When its wait step is read
    Then it comes after mount-layers, runs site-publish-after.ts and is not limited to a push
