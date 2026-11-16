# The unlinked-beans QA report (bean folio-assistant-w2hn): which open beans
# no workflow instance or diagram id links, and an LSI grouping of them into
# the neighbourhoods of the epics. The diagram ids are Process_Review and its
# activity Task_Review; the grouping corpus has two disjoint neighbourhoods,
# telescopes (epic fa-sky) and bread (epic fa-brd). Each Scenario names the
# test that executes it.
Feature: Unlinked beans

  @test:scripts/tests/unlinked-beans.test.ts::diagram_ids::reads_processes_and_every_activity_kind,_each_under_its_process,_and_skips_extension_elements
  Scenario: Diagram ids are processes and activities, each under its process
    Given BPMN with prefixed and unprefixed processes holding a user task, a call activity, a service task and a folio:task extension element
    When its diagram ids are read
    Then they are Process_A with Task_One and Call_B, then Process_C with Task_Two
    And the extension element is skipped

  @test:scripts/tests/unlinked-beans.test.ts::diagram_ids::a_bean_names_an_id_only_as_a_whole_token
  Scenario: A bean names a diagram id only as a whole token
    Then text naming `Task_Review` and Process_Review names both
    And Task_ReviewAll, xTask_Review and Task_Review_2 name nothing
    And "a review task" names nothing

  @test:scripts/tests/unlinked-beans.test.ts::instance_mentions::bean,_carried,_subject_and_subprocess_are_each_recorded_with_the_instance
  Scenario: Each way an instance names a bean is recorded
    Given instances naming beans as their bean, carried beans, subject and a subprocess's bean
    When the mentions are collected
    Then fa-aaaa is i1's "bean", fa-bbbb "carried", fa-cccc "subject", and fa-dddd i2's "subprocess"

  @test:scripts/tests/unlinked-beans.test.ts::instance_mentions::a_history_note_names_a_bean_by_its_full_id,_or_by_its_short_id_after_the_word_bean_—_never_by_a_bare_short_id
  Scenario: A history note names a bean by full id, or by short id after "bean"
    Given history notes "closes bean `eeee`" in i2's subprocess and "touched fa-ffff and ffff, aaaa alone" in completed i3
    When the mentions are collected
    Then fa-eeee is named by i2's history and fa-ffff by i3's, completed
    And i3 does not name fa-aaaa

  @test:scripts/tests/unlinked-beans.test.ts::instance_mentions::an_instance's_own_bean_carried_again_by_its_subprocess_adds_no_second_mention
  Scenario: An instance's bean repeated by its subprocess is mentioned once
    Given an instance whose subprocess has the same bean
    When the mentions are collected
    Then the bean has one mention

  @test:scripts/tests/unlinked-beans.test.ts::the_link_classifier::instance,_then_named_id_(inferred),_then_none
  Scenario: A bean's link basis is instance, then named id, then none
    Given fa-1 named by an instance, fa-2 naming `Task_Review`, and fa-3 naming no diagram
    When their links are classified
    Then fa-1 is "instance", fa-2 is "named-id" naming Task_Review, and fa-3 is "none"

  @test:scripts/tests/unlinked-beans.test.ts::the_link_classifier::an_instance_wins_over_a_named_id,_and_the_named_id_is_still_reported
  Scenario: An instance wins over a named id, which is still reported
    Given a bean named by an instance whose body names Process_Review
    When its link is classified
    Then its basis is "instance" and its named ids are Process_Review

  @test:scripts/tests/unlinked-beans.test.ts::the_link_classifier::front_matter_counts_as_the_bean's_text
  Scenario: Front matter counts as the bean's text
    Given a bean whose only mention of Process_Review is its front-matter title
    When its link is classified
    Then its basis is "named-id"

  @test:scripts/tests/unlinked-beans.test.ts::size_classes::5_or_more_is_a_candidate;_fewer_is_small;_one_is_a_singleton;_no-fit_is_its_own_class
  Scenario: Group size classes
    Then a group of the minimum size is a "candidate"
    And one smaller, or of two, is "small", and of one a "singleton"
    And the no-fit group is "no-fit" whatever its size

  @test:scripts/tests/unlinked-beans.test.ts::the_grouping_step_(lsi-epics'_ranking,_reused)::lsi-epics'_exported_ranking_puts_each_topic's_bean_nearest_its_own_epic
  Scenario: lsi-epics' ranking puts each topic's bean nearest its own epic
    # Gap: that an epic is left out of its own centroid is not checked; only that an unknown bean ranks no epic
    Given an LSI index of the corpus
    Then fa-sky's members include fa-s1
    And fa-s5 ranks nearest fa-sky and fa-b2 nearest fa-brd
    And an unknown bean ranks no epic

  @test:scripts/tests/unlinked-beans.test.ts::the_grouping_step_(lsi-epics'_ranking,_reused)::open_beans_are_counted_by_basis;_closed_ones_only_counted
  Scenario: Open beans are counted by basis, closed ones only counted
    When the report is built over the corpus
    Then 10 open beans are counted, all with no link
    And the completed beans are counted 2, one by named id and one with none

  @test:scripts/tests/unlinked-beans.test.ts::the_grouping_step_(lsi-epics'_ranking,_reused)::every_unlinked_open_bean_is_in_exactly_one_group,_and_the_groups_are_the_epics'_neighbourhoods
  Scenario: Every unlinked open bean is in one group, and the groups are the epics' neighbourhoods
    When the report is built over the corpus
    Then the beans placed in groups are exactly the open beans with no link
    And the fa-sky group is a candidate holding fa-s1, fa-s3 to fa-s6, with telescope vocabulary among its terms
    And it is filed under fa-sky for one bean and knows Process_Review through one bean
    And the fa-brd group is small and knows no process
    And every placement in a group fits at or above the floor
    And fa-s2, nearest fa-sky but under the floor, is alone in the no-fit group, which names no nearest epic

  @test:scripts/tests/unlinked-beans.test.ts::the_grouping_step_(lsi-epics'_ranking,_reused)::the_QA_result_is_warning-only,_and_lists_the_link_basis_and_the_groups
  Scenario: The QA result is warning-only and lists the basis and the groups
    When the QA result document is built for store "t"
    Then it is qa-results/v1 about the bean store "t"
    And open-bean-unlinked counts 10 entries, every one a warning with basis "none"
    And unlinked-group includes a candidate, and closed-bean-counts has two entries

  @test:scripts/tests/unlinked-beans.test.ts::the_grouping_step_(lsi-epics'_ranking,_reused)::the_Markdown_and_the_page_section_list_small_groups_and_singletons_rather_than_dropping_them
  Scenario: The Markdown and the page section list small and no-fit groups
    When the Markdown is rendered
    Then it says "**Severity: warning.**" and has headings for candidate groups, one small group and one bean fitting no epic
    When the page section is rendered
    Then it has the id "unlinked-beans" and says "Warning, never a failure"

  @test:scripts/tests/unlinked-beans.test.ts::could_not_group::too_few_beans_for_an_index_leaves_the_grouping_unknown,_and_the_list_stands
  Scenario: Too few beans leave the grouping unknown, and the list stands
    Given a store with one unlinked bean
    When the report is built
    Then one open bean has no link, the grouping is unknown, and the Markdown says "Grouping **unknown**"

  @test:scripts/tests/unlinked-beans.test.ts::could_not_group::nothing_unlinked_is_an_empty_grouping,_not_an_unknown_one
  Scenario: Nothing unlinked is an empty grouping
    Given a store whose one bean an instance names
    When the report is built
    Then the grouping has no groups and no placements

  @test:scripts/tests/unlinked-beans.test.ts::on_the_bean_store's_page_(state_visualiser)::the_section_follows_the_bean-position_section_when_the_view_carries_it,_and_is_absent_otherwise
  Scenario: The unlinked section follows the bean-position section only when the view carries it
    # Gap: that the bean-position section is present is not asserted; the order check also passes if it is absent
    Given a bean store's parts section with the unlinked section in its view
    Then the unlinked-beans section comes after the bean-position section
    And without it in the view there is no unlinked-beans section
