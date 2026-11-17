# The beans-by-process projection and its pages (cat-harness-tools#1413, bean
# folio-assistant-pbv1), against hand-built instances and beans. Each Scenario
# names the test that executes it.
Feature: Beans by process

  @test:scripts/tests/processed-beans.test.ts::processedBeansRows::a_running_instance_unmoved_for_30_days_is_stalled,_with_its_bean_joined
  Scenario: A running instance unmoved for 30 days is stalled, with its bean joined
    Given a running instance on Task_2, last moved 30 days ago, naming an in-progress bean
    When its row is built
    Then it is not finished, 30 days old, stuck as enabled-not-taken, with the bean joined and found
    And its done steps are Start and Task_1, with its drawing and its page link

  @test:scripts/tests/processed-beans.test.ts::processedBeansRows::a_bean_the_store_does_not_hold_is_bean-missing,_a_token_off_the_diagram_is_node-missing
  Scenario: A bean the store lacks is bean-missing, and a token off the diagram is node-missing
    Given an instance naming a bean the store does not hold, with a token on a node the diagram lacks
    When its row is built
    Then the bean is not found and the row is stuck as bean-missing and node-missing, naming the missing node

  @test:scripts/tests/processed-beans.test.ts::processedBeansRows::a_token_resting_on_an_end_event_is_finished,_not_stalled
  Scenario: A token resting on an end event is finished, not stalled
    Given an old instance whose token is on End, naming a completed bean
    When its row is built
    Then it is finished and stuck neither as enabled-not-taken nor bean-closed

  @test:scripts/tests/processed-beans.test.ts::processedBeansRows::rows_sort_oldest_move_first
  Scenario: Rows sort oldest move first
    When rows are built for a newer and an older instance
    Then the older comes first

  @test:scripts/tests/processed-beans.test.ts::links::beans_link_to_their_source,_processes_to_their_page_and_steps_to_its_steps_section
  Scenario: Beans link to their source, processes to their page, and steps to the steps section
    Given a bean source resolver and a process page resolver
    Then the row's bean links to its source and the row to its process page
    And rebasing one level deeper moves the process page link and keeps the absolute source
    And the rendered page links the steps section, the source and the process page

  @test:scripts/tests/processed-beans.test.ts::routes_are_path_IRIs::only_URL-segment_ids_get_a_page
  Scenario: Only URL-segment ids get a page
    Given one instance with segment-safe process and bean ids and one with spaces in both
    Then routes are made only for Process_A and fa-aaaa
    And a bean id is a segment while a/b is not

  @test:scripts/tests/processed-beans.test.ts::routes_are_path_IRIs::rebase_re-anchors_relative_hrefs_and_leaves_absolute_ones
  Scenario: rebase re-anchors relative hrefs and leaves absolute ones
    When a row with a relative href and an absolute drawing is rebased two levels
    Then the href is re-anchored and the drawing is unchanged

  @test:scripts/tests/processed-beans.test.ts::routes_are_path_IRIs::no_page_builds_a_query-string_link
  Scenario: No page builds a query-string link
    When the all-beans page and one bean's page are rendered
    Then neither holds a link with a query string or uses URLSearchParams, and both build bean-processed/<id>/ links
    And the bean's page names its bean

  @test:scripts/tests/processed-beans.test.ts::routes_are_path_IRIs::the_embedded_rows_cannot_close_the_script_element
  Scenario: The embedded rows cannot close the script element
    Given a bean whose title holds </script>
    When the page is rendered
    Then the raw </script><b> does not appear

  @test:scripts/tests/processed-beans.test.ts::one_bean's_history_(cat-harness#991_step_5;_owner,_2026-11-03)::the_stepper:_buttons_for_first,_previous,_play,_next_and_last,_a_slider_over_every_event,_and_the_keys_named
  Scenario: One bean's history has a stepper
    Given three history events for one bean
    When its page is rendered
    Then it has first, previous, play, next and last buttons, a slider from 0 to 2 at 2, the Space key named, a polite live region and the history list

  @test:scripts/tests/processed-beans.test.ts::one_bean's_history_(cat-harness#991_step_5;_owner,_2026-11-03)::a_history_that_could_not_be_read_says_so,_with_the_reason_—_never_an_empty_timeline
  Scenario: A history that could not be read says so with the reason
    When a bean page is rendered with an unknown history
    Then it says the history could not be read, gives the reason, and draws no play button

  @test:scripts/tests/processed-beans.test.ts::one_bean's_history_(cat-harness#991_step_5;_owner,_2026-11-03)::an_event's_text_cannot_close_the_script_it_is_embedded_in
  Scenario: An event's text cannot close the script it is embedded in
    Given an event whose text holds a script element
    When the bean page is rendered
    Then the raw script tags do not appear

  @test:scripts/tests/processed-beans.test.ts::finished_instances,_beans_in_no_process,_open_and_closed_(owner,_2026-11-03)::a_finished_instance_with_no_token_is_marked_where_it_ended,_its_last_step;_a_running_one_is_not
  Scenario: A finished instance with no token is marked at its last step; a running one is not
    Given a completed instance with no token whose history ends at Task_2, and a running instance
    Then the finished one ended at Task_2 and the running one ended nowhere

  @test:scripts/tests/processed-beans.test.ts::finished_instances,_beans_in_no_process,_open_and_closed_(owner,_2026-11-03)::a_finished_instance_resting_on_an_end_event_ends_there
  Scenario: A finished instance resting on an end event ends there
    Then a completed instance with its token on End ended at End

  @test:scripts/tests/processed-beans.test.ts::finished_instances,_beans_in_no_process,_open_and_closed_(owner,_2026-11-03)::a_bean_says_whether_it_is_closed,_and_carries_the_start_of_its_body
  Scenario: A bean says whether it is closed, and carries the start of its body
    Given a scrapped bean with a body
    Then its row entry is closed with the body as its excerpt

  @test:scripts/tests/processed-beans.test.ts::finished_instances,_beans_in_no_process,_open_and_closed_(owner,_2026-11-03)::beans_no_instance_names_are_listed,_so_a_store_with_beans_and_no_instance_is_not_an_empty_page
  Scenario: Beans no instance names are listed
    Given one bean placed by an instance, one open bean unplaced and one closed bean unplaced
    Then the unplaced beans are the open one and the closed one, marked
    And the page holds the unplaced list and its data, filtered to open by default

  @test:scripts/tests/processed-beans.test.ts::finished_instances,_beans_in_no_process,_open_and_closed_(owner,_2026-11-03)::a_store_with_no_instance_links_no_`workflows/`_hub:_that_hub_is_drawn_only_over_instances
  Scenario: A store with no instance links no workflows hub
    Then a page with only unplaced beans links beans-processed and not workflows
    And a page with an instance links workflows

  @test:scripts/tests/processed-beans.test.ts::finished_instances,_beans_in_no_process,_open_and_closed_(owner,_2026-11-03)::the_bean_index_filters_open_and_closed,_open_by_default
  Scenario: The bean index filters open and closed, open by default
    When the bean index page is rendered
    Then it is an index page with Open selected and a Closed option

  @test:scripts/tests/processed-beans.test.ts::the_combined_page,_every_store_at_…/beans/beans-processed/_(owner,_2026-11-03)::each_row_keeps_its_own_store:_its_links_re-anchored_at_that_store's_page
  Scenario: On the combined page each row keeps its own store's links
    Given rows from cat-harness and folio-assistant-core on the combined page
    Then each embedded row carries its store, its store's page as up, and its link re-anchored there

  @test:scripts/tests/processed-beans.test.ts::the_combined_page,_every_store_at_…/beans/beans-processed/_(owner,_2026-11-03)::a_tick_box_per_store,_on_by_default,_and_links_to_each_store's_own_page
  Scenario: The combined page has a tick box per store, on by default, linking each store's page
    Then there is a checked box for each store and a link to folio-assistant-core's beans-processed page

  @test:scripts/tests/processed-beans.test.ts::the_combined_page,_every_store_at_…/beans/beans-processed/_(owner,_2026-11-03)::beans_in_no_process_say_which_store_they_are_from
  Scenario: Unplaced beans on the combined page say which store they are from
    Then the embedded data names folio-assistant-core as a store

  @test:scripts/tests/processed-beans.test.ts::the_combined_page,_every_store_at_…/beans/beans-processed/_(owner,_2026-11-03)::each_store's_needs_go_to_the_page,_kept_to_the_stores_on_it,_for_"and_what_it_depends_on"
  Scenario: Each store's needs go to the combined page, kept to the stores on it
    Given a combined page of cat-harness needing bootstrap, and folio-assistant-core needing cat-harness and bootstrap
    When the page is built
    Then its embedded needs are cat-harness: none and folio-assistant-core: cat-harness, bootstrap being on no page
    And the page carries the "and what it depends on" control

  @test:scripts/tests/processed-beans.test.ts::the_combined_page,_every_store_at_…/beans/beans-processed/_(owner,_2026-11-03)::no_live_refresh:_the_local_server_serves_one_store,_not_every_store
  Scenario: The combined page has no live refresh
    Then it holds no live-refresh control

  @test:scripts/tests/processed-beans.test.ts::the_combined_page,_every_store_at_…/beans/beans-processed/_(owner,_2026-11-03)::a_store_may_not_be_named_like_a_page_beside_it
  Scenario: A store may not be named like a page beside it
    Then the reserved store names are bean-processed and beans-processed
