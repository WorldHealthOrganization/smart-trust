# Writer records for the rerun-and-measure deploy (bean fwtz, option B).
# Each Scenario names the test that executes it.
Feature: Writer cone records

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::what_it_wrote_is_output,_not_input;_a_path_probed_absent_and_then_created_was_absent_before
  Scenario: Writes are outputs, and a probed-then-created path was absent
    Given a trace that reads "beans/defs/a.md", probes "site/out" absent, creates it and writes "site/out/index.json"
    When it is parsed collecting writes
    Then the input is "beans/defs/a.md", the writes are "site/out" and its index, and "site/out" was absent before

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::a_path_it_read_while_it_existed_and_then_rewrote_cannot_be_replayed
  Scenario: Reading a file then rewriting it is undetermined
    Given a trace that reads and then truncates "site/out/index.json"
    Then the parse is undetermined: "the writer reads site/out/index.json and then rewrites it"

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::a_write_that_failed_is_a_probe:_mkdir_-p_meeting_an_existing_directory_does_not_rewrite_it
  Scenario: A failed mkdir is a probe
    Given a trace that stats "smart-base/docs", fails mkdir on it with EEXIST, and writes a file in it
    Then the directory is an input and only the file is a write

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::a_call_strace_lost_as_a_thread_detached_names_nothing,_and_a_named_one_keeps_its_arguments
  Scenario: Detached calls name nothing; a named one keeps its arguments
    Given a trace with "???" calls lost to detached threads and an openat of "b.md" resumed as detached
    Then the inputs are "a.md" and "b.md" with no writes

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::git_run_with_an_absolute_-C_at_the_root_is_replayed_from_the_root
  Scenario: git -C at the root replays from the root
    Given a trace running "git -C /work/repo remote get-url origin"
    Then the git call is recorded with an empty cwd and its arguments

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::re-reading_its_own_declared_output_before_rewriting_it_is_not_an_input;_anything_else_still_refuses
  Scenario: Re-reading its own declared output is not an input
    Given a trace that reads then rewrites "docs/out/index.html"
    Then with own outputs "docs/out/" it is only a write
    And with own outputs "docs/other/" and "docs/out" (no slash) it is undetermined
    And a plain stat inside its own outputs is not an input, while "src/a.md" is
    And "a/b/" covers "a/b" but not "a/bc", and "c.json" covers itself

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::a_rewritten_file_nobody_declares_is_kept_as_an_input,_with_its_state_after_the_run
  Scenario: A rewritten file nobody declares is an input
    Given a trace that reads then rewrites "docs/todo/index.html" and creates "docs/new.html"
    Then when that file may be an input, it is an input and listed as rewritten, and "docs/new.html" is a write
    And when some writer declares it, the parse is undetermined

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::a_directory_it_listed_(getdents64)_is_marked_listed;_one_it_only_opened_is_not_(tools#1265)
  Scenario: A listed directory is marked listed
    Given a trace that lists "data" with getdents64, opens "opened" and reads a file in it, and lists a directory outside the root
    Then the inputs are "data", "opened" and "opened/k.json", and only "data" is listed

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::the_default_still_refuses_any_write_(checks_are_unchanged)
  Scenario: The default mode refuses any write
    Then a trace with a write parsed in the default mode is undetermined

  @test:scripts/tests/writer-cone.test.ts::parseTrace_in_collect_mode_—_a_writer's_reads_and_writes::a_failed_mkdir_(-1_EEXIST)_on_an_already-read_directory_does_not_mark_the_directory_as_rewritten,_and_<detached_...>_lines_parse
  Scenario: A failed mkdir on a read directory is not a rewrite
    Given a trace that stats a directory, fails mkdir on it, writes in it, and has detached lines including an openat of "in/extra.json"
    Then the inputs are "in/extra.json" and the directory, and the only write is the file

  @test:scripts/tests/writer-cone.test.ts::writerRecordOf_and_decideWriter::records_reads_with_their_state_and_outputs,_then_skips_only_while_every_read_matches
  Scenario: A record skips only while every read matches
    Given a writer that read "in/a.txt", wrote "out/o.json", and created "later"
    When its record is made
    Then its reads are "in/a.txt" only and its outputs "out/o.json"
    And with matching fingerprint and reads it skips with proof
    And with an unannotated environment site it skips as "evidence only"
    And with another fingerprint it runs because its script changed
    And with "in/a.txt" edited it runs because "in/a.txt changed"
    And verifying finds the writer skip-safe while its output matches, an unrecorded writer rerun, and skip-unsafe once its output differs or adds a file
    And the summary says "unsafe"

  @test:scripts/tests/writer-cone.test.ts::writerRecordOf_and_decideWriter::records_nothing_for_a_failed_run,_a_traced_site,_a_moved_fingerprint_or_an_unenumerable_trace
  Scenario: Nothing is recorded for an unreliable run
    Then a failed run, a run reaching the network, a fingerprint that moved, and an undetermined trace each record nothing, with their reason

  @test:scripts/tests/writer-cone.test.ts::writerRecordOf_and_decideWriter::a_directory_only_opened_is_recorded_as_"dir":_a_new_entry_keeps_the_skip,_a_listed_one's_new_entry_does_not_(tools#1265)
  Scenario: A directory only opened is recorded as "dir"; only a listed directory's new entry stops the skip
    Given a writer that read the directories "opened" and "listed", and listed only "listed"
    When its record is made
    Then "opened" is recorded as "dir" and "listed" as "dir " followed by its listing
    And a new entry in "opened" keeps the skip
    And a new entry in "listed" stops it with "listed changed"
    And "opened" replaced by a file stops it with "opened changed"

  @test:scripts/tests/writer-cone.test.ts::writerRecordOf_and_decideWriter::no_records,_or_an_unrecorded_writer,_always_runs
  Scenario: No record means run
    Then with no records the writer runs
    And an unrecorded writer runs, saying "not recorded:" and its reason

  @test:scripts/tests/writer-cone.test.ts::writerRecordOf_and_decideWriter::tracedArgv_wraps_the_writer_in_strace
  Scenario: The traced argv wraps the writer in strace
    Then the traced argv starts "strace" and ends with "-o", the log path and the writer's argv

  @test:scripts/tests/writer-cone.test.ts::snapshotPaths_(what_a_skip_puts_back)::adds_every_file_the_run_wrote_outside_its_declared_outputs
  Scenario: The snapshot adds writes outside the declared outputs
    Then a writer declaring "site/a/" and "out.json" that also wrote "build/extra.json" snapshots all three

  @test:scripts/tests/writer-cone.test.ts::snapshotPaths_(what_a_skip_puts_back)::refuses_a_write_into_another_writer's_declared_output
  Scenario: A write into another writer's output is refused
    Then a write to "site/b/y.html", another writer's output, gives no snapshot, naming the path

  @test:scripts/tests/writer-cone.test.ts::churnReport::groups_reruns_by_what_changed_and_who_wrote_it,_costliest_first
  Scenario: Reruns are grouped by cause, costliest first
    Given four writers that ran (two on a file a:pages wrote, one on a source, one on its script) and one skipped
    Then 1 skipped, 4 ran, 0 reused
    And the groups are the written file (by a:pages, 35 s), the source (by the commit, 10 s), and the script (1 s)

  @test:scripts/tests/writer-cone.test.ts::churnReport::renders_a_table_naming_the_cascade
  Scenario: The churn table names the cascade
    Then the rendered report says "against abcdef012345" and has the row for "docs/a/x.json" naming a:pages, b:pages, c:pages and 35

  @test:scripts/tests/writer-cone.test.ts::churnReport::says_so_when_nothing_ran
  Scenario: Nothing ran says so
    Then a report of only a skipped writer says "Nothing ran again."

  @test:scripts/tests/writer-cone.test.ts::changedWhy_(bean_fwtz,_S-CI3)::names_the_first_changed_read_as_before,_then_the_rest,_capped
  Scenario: The change reason names the first read and caps the rest
    Then one change reads ". changed"
    And three read ". changed (+2 more: .git, a)"
    And twelve list seven more and "and 4 others"

  @test:scripts/tests/writer-cone.test.ts::incremental_records_(cat-harness-tools#1702)::a_carried_record_keeps_its_own_commit,_so_its_outputs_entry_is_found_under_it
  Scenario: A carried record keeps its commit
    Given new records marking "w" unrecorded and previous records holding it at commit "older"
    When the record is carried
    Then it is carried unchanged, no longer unrecorded, and its entry is found at "older"

  @test:scripts/tests/writer-cone.test.ts::incremental_records_(cat-harness-tools#1702)::nothing_to_carry_for_a_writer_the_previous_records_do_not_hold
  Scenario: Nothing to carry
    Then carrying a writer the previous records lack returns false and adds nothing

  @test:scripts/tests/writer-cone.test.ts::incremental_records_(cat-harness-tools#1702)::an_index_kept_without_a_record_is_found_at_the_commit_it_was_kept_at;_anything_else_at_the_file's_commit
  Scenario: A kept index is found at its own commit
    Then an index kept at "kept-at" is found there
    And anything else is found at the records' own commit
