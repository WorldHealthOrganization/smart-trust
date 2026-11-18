# scripts/merge-queue-store.ts reads the merge queue's store in one of four states
# and records decisions into its mount, on real git and a real mount marker.
# Each Scenario names the test that executes it.
Feature: The merge queue's store

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_four_read_states::absent_—_no_instance_declares_a_merge-queue_directory,_and_nothing_claims_one
  Scenario: No declared merge-queue directory reads as absent
    Given a repository whose declaration has no merge-queue directory
    When the queue store is read
    Then the state is "absent" with no directory
    And reading the queue entries gives null rather than throwing

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_four_read_states::declared-but-absent_—_a_checkout_directory_the_declaration_names_and_the_disk_has_not_got
  Scenario: A declared checkout directory missing on disk is declared-but-absent
    Given a declaration naming beans/queue/ as a merge-queue directory that does not exist on disk
    When the queue store is read
    Then the state is "declared-but-absent"
    And reading the queue entries gives null rather than throwing

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_four_read_states::unreachable_—_on_the_branch,_nothing_mounted:_a_REASON,_and_readQueueEntries_THROWS
  Scenario: A branch-sourced queue with nothing mounted is unreachable and entries throw
    Given a merge-queue directory sourced from the branch tip, not mounted
    When the queue store is read
    Then the state is "unreachable" with no directory
    And the reason mentions "state:mount"
    And reading the queue entries throws "cannot read the merge queue"

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_four_read_states::read_—_entries,_what_was_skipped,_and_a_files_count_that_is_not_a_restatement
  Scenario: A readable store lists entries, skipped files and a files count
    Given a queue directory holding one valid entry, a manifest.json, an entry with pr -1 and a README.md
    When the queue store is read
    Then the state is "read" with the one entry for PR 2065
    And manifest.json is skipped as expected
    And the broken entry is skipped as not expected
    And three files were seen, equal to entries plus skipped

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_four_read_states::a_GitHub_fact_is_refused_BY_NAME,_so_the_queue_cannot_acquire_a_second_answer_to_CI
  Scenario: A GitHub fact in an entry is refused by name
    Given a branch-sourced queue declaration
    When a decision carrying a headSha is recorded
    Then it is refused
    And the reason names "headSha"

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_live_shape:_declared_FROM_WITHIN,_and_cut_over::graphReadPath_resolves_the_from-within_entry_by_its_OWN_id,_and_the_store_reads_its_mount
  Scenario: A from-within queue resolves by its own id and the store reads its mount
    Given the queue declared within beans/beans.json as a subgraph on the branch tip, and mounted at beans/queue
    When the graph read path for "queue" is resolved
    Then it reads from the mount
    And after an entry is written into the mount the store reads one entry with id "queue" from that directory

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_live_shape:_declared_FROM_WITHIN,_and_cut_over::a_MOUNTED_from-within_graph_no_longer_reports_as_`unmounted`_—_the_najo_regression
  Scenario: A mounted from-within graph is reported as mounted
    Given the queue declared within beans/beans.json as a subgraph, and mounted
    When its nested directory is listed
    Then its id is "beans/queue", its own id "queue" and it is a subgraph
    And tip presence is "mounted" at the mount when asked with the composed id
    And tip presence is "mounted" when asked with the own id
    And the nested-directory audit has no findings

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::the_live_shape:_declared_FROM_WITHIN,_and_cut_over::a_branch_source_on_an_entry_NO_mount_can_reach_is_`unmountable`,_not_`unmounted`
  Scenario: A branch source no mount can reach is unmountable
    Given the queue declared within beans/beans.json on the branch tip without "subgraph": true
    When the nested directories are audited
    Then the only finding is "unmountable"
    And its detail names '"subgraph": true'
    And its detail does not offer the state:mount remedy

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::recording_a_decision::refuses_when_the_graph_is_not_mounted,_rather_than_writing_where_no_push_reaches
  Scenario: Recording refuses when the graph is not mounted
    Given a branch-sourced queue that is not mounted
    When a decision is recorded without pushing
    Then it is refused
    And the reason mentions "not mounted"

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::recording_a_decision::refuses_when_the_path_is_the_CHECKOUT's_own,_because_that_write_would_be_a_commit_on_this_branch
  Scenario: Recording refuses to write into the checkout's own path
    Given a queue declared as a plain checkout directory that exists
    When a decision is recorded without pushing
    Then it is refused
    And the reason mentions "pull request"

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::recording_a_decision::writes_the_entry_into_the_mount,_named_for_its_repository_and_pull_request
  Scenario: Recording writes the entry into the mount under its repository and PR
    Given a mounted from-within queue
    When a decision is recorded without pushing
    Then it is written as "litlfred--folio-assistant--2065.json"
    And the push is "skipped"
    And the store reads it back with the same decidedBy

  @test:scripts/tests/sdlc/merge-queue-store.test.ts::recording_a_decision::an_override_with_no_reason_is_refused_—_the_schema's_one_hard_refusal,_through_the_writer
  Scenario: An override placement with no reason is refused by the writer
    # Gap: only the refused state is checked, not that the missing reason is why
    Given a mounted from-within queue
    When a decision with an override placement at position 1 and no placement reason is recorded
    Then it is refused
