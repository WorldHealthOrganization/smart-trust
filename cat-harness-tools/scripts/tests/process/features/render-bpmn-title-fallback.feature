# Every step title in the site's drawing is a link on every site: the subject
# page when the site publishes one, else the process's page in the processes
# viewer. render-bpmn.ts runs on import, so its source is read.
Feature: A step with no page of its own still has a title link

  @test:scripts/tests/process/render-bpmn-title-fallback.test.ts::a_step_with_no_page_of_its_own_still_has_a_title_link::the_subject_page_wins,_else_the_step's_entry_on_its_process's_page
  Scenario: A step's title links to its subject page, else to the step's entry on its process's page
    # Gap: checked on the source text only; no drawing is rendered to see which link a step gets
    Given the source of scripts/render-bpmn.ts
    When it is read
    Then the step's href is subjectHref(file, "process", `${s.process}/node/${s.id}`) falling back with ?? to SITE_UP + stepOnProcessPage(basename(file, ".bpmn"), s.id)
    And the step's entry is the process page's target followed by "#step-<step>"
    And the anchor of step "Task_Verify" is "step-Task_Verify"

  @test:scripts/tests/process/render-bpmn-title-fallback.test.ts::a_step_with_no_page_of_its_own_still_has_a_title_link::every_step_is_linked,_not_only_those_with_a_subject_page
  Scenario: Every step's title is recorded with its href, unconditionally
    # Gap: checked on the source text only; no drawing is rendered to see every step linked
    Given the source of scripts/render-bpmn.ts
    When it is read
    Then it contains "titles.set(s.id, { href, name: s.name });"
    And it contains no "if (href) titles.set"

  @test:scripts/tests/process/render-bpmn-title-fallback.test.ts::a_step_with_no_page_of_its_own_still_has_a_title_link::the_fallback_is_the_processes_viewer's_page,_never_a_docs_section_another_site_may_not_publish
  Scenario: The fallback target is the process's viewer page, not a docs section
    Given a process "p" with no presenting docs page, and the same process with one presenting docs page
    When processTarget is computed for each
    Then with none it ends in "/p.html"
    And it differs from the target with the docs page

