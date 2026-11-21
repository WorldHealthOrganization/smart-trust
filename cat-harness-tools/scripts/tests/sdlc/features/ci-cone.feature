# scripts/ci-cone.ts decides whether a CI check (or a test file run as a gate) may skip: it traces a green run on main
# under strace, records every path, git query and variable that run read, and skips a PR's run only when all of it is unchanged.
# Each Scenario names the test that executes it.
Feature: The CI cone skips a check only when everything its green run read is unchanged

  @test:scripts/tests/sdlc/ci-cone.test.ts::touchedOf_—_what_a_run_touched,_for_a_runner_that_traces_several_at_once_(Q-ACT-1_A)::reads,_listed_directories,_writes_(creates,_deletes,_renames)_and_git,_from_one_trace
  Scenario: One trace yields the reads, listed directories, writes and git count of a run
    Given a trace that opens "data/a.json" for reading, lists "data", creates "out.json", unlinks "old.json" and renames "x.tmp" to "x.json"
    When what the run touched is read from the trace
    Then the reads are "data" and "data/a.json"
    And the listed directories are "data"
    And the writes are "old.json", "out.json", "x.json" and "x.tmp"
    And the git count is 0

  @test:scripts/tests/sdlc/ci-cone.test.ts::touchedOf_—_what_a_run_touched,_for_a_runner_that_traces_several_at_once_(Q-ACT-1_A)::a_read_then_rewritten_path_is_both_read_and_written;_a_failed_create_is_a_probe,_not_a_write
  Scenario: A path read then rewritten is both read and written, and a failed mkdir is only a probe
    Given a trace that opens "a.json" for reading, then opens it for writing, then fails to mkdir "d" with EEXIST
    When what the run touched is read from the trace
    Then the reads are "a.json" and "d"
    And the writes are "a.json" only

  @test:scripts/tests/sdlc/ci-cone.test.ts::touchedOf_—_what_a_run_touched,_for_a_runner_that_traces_several_at_once_(Q-ACT-1_A)::a_probe_of_a_path_that_does_not_exist_yet_is_a_read,_so_a_neighbour_creating_it_is_caught
  Scenario: A probe of a not-yet-existing path counts as a read
    Given a trace whose only call is a stat of "x/new.json" failing with ENOENT
    When what the run touched is read from the trace
    Then the reads are "x/new.json"
    And there are no writes

  @test:scripts/tests/sdlc/ci-cone.test.ts::touchedOf_—_what_a_run_touched,_for_a_runner_that_traces_several_at_once_(Q-ACT-1_A)::no_trace_is_undetermined,_with_the_reason
  Scenario: No trace means touched is undetermined with the given reason
    When what the run touched is asked for with no trace and the reason "not traced — x"
    Then the result is undetermined with exactly that reason

  @test:scripts/tests/sdlc/ci-cone.test.ts::touchedOf_—_what_a_run_touched,_for_a_runner_that_traces_several_at_once_(Q-ACT-1_A)::a_git_command_the_cone_cannot_replay_is_counted_as_git,_not_undetermined;_its_writes_still_show
  Scenario: A git command the cone cannot replay is counted, and the run's writes still show
    Given a trace in which git runs "log -1" against a separate git-dir, and the run creates "out.json"
    When what the run touched is read from the trace
    Then the writes are "out.json"
    And the git count is 1
    And parsing the same trace as a record is undetermined

  @test:scripts/tests/sdlc/ci-cone.test.ts::keepRecords_—_records_concurrent_runs_wrote_to_their_own_files::a_kept_record_goes_into_the_record_file;_a_null_record_removes_the_old_one
  Scenario: A kept record is written to the record file, and a null record removes the old one
    Given a records directory with a run file for "check:a" holding a record of one path, and one for "check:b" holding null
    When the "check:a" run file is kept
    Then the first note contains "check:a: recorded (1 paths"
    And the loaded records hold that record for "check:a"
    When "check:a"'s run file is rewritten with a null record and both files are kept
    Then the loaded records hold nothing for "check:a"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_read,_a_listing_and_an_absent_probe_are_all_in_the_read_set;_paths_outside_the_checkout_are_not
  Scenario: Reads, listings and absent probes inside the checkout form the read set, and outside paths do not
    Given a trace that reads "data/a.json", opens the directory "data", probes the absent "data/maybe.json", reads a system library and writes a file under /tmp
    When the trace is parsed
    Then the read paths are "data", "data/a.json" and "data/maybe.json"
    And there are no git commands

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_write_inside_the_checkout_is_undetermined,_never_a_read_set
  Scenario: A write inside the checkout makes the read set undetermined
    Given a trace that creates "out.json" inside the checkout
    When the trace is parsed
    Then it is undetermined, mentioning "writes inside the checkout"
    And a trace that unlinks a checkout file is undetermined
    And a trace that creates a directory in the checkout is undetermined

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::an_unclassified_path_syscall_is_undetermined_—_never_assumed_harmless
  Scenario: An unclassified syscall on a path makes the read set undetermined
    Given a trace holding a fanotify_mark call on a checkout path
    When the trace is parsed
    Then it is undetermined, mentioning "unclassified syscall fanotify_mark"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_relative_path_with_no_known_directory_is_undetermined
  Scenario: A relative path with no known directory is undetermined
    Given a trace whose only call is a stat of the relative "data/a.json" with no cwd shown
    When the trace is parsed
    Then it is undetermined, mentioning "relative to a directory the trace does not name"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_relative_path_resolves_against_the_cwd_the_trace_showed,_and_a_child_inherits_it
  Scenario: A relative path resolves against the traced cwd, and a forked child inherits it
    Given a trace whose process shows cwd "/work/repo", forks a child that changes into "sub"
    And the child stats "x.json" while the parent stats "y.json"
    When the trace is parsed
    Then the read paths are "sub", "sub/x.json" and "y.json"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::an_unfinished_call_is_joined_to_its_resumption,_and_an_fd-relative_path_resolves_through_-y
  Scenario: An unfinished call is joined to its resumption, and an fd-relative path resolves through the fd's path
    Given a trace where an openat of "a.md" relative to the "skills" directory fd is unfinished, another process opens "b.md", and the first call resumes
    When the trace is parsed
    Then the read paths are "b.md" and "skills/a.md"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_path_strace_truncated_is_undetermined
  Scenario: A path strace truncated is undetermined
    Given a trace whose stat path ends in "..." after the closing quote
    When the trace is parsed
    Then it is undetermined

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::git's_own_reads_of_.git_are_left_out;_the_script's_are_kept
  Scenario: Git's own reads of .git are dropped while the script's are kept
    Given a trace in which git runs "rev-parse --show-toplevel" and reads ".git/HEAD"
    And the script itself reads ".git/config"
    When the trace is parsed
    Then the read paths are ".git/config" only
    And the git commands are "rev-parse --show-toplevel" at the root

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_git_command_is_recorded_for_REPLAY_only_when_it_is_read-only_and_takes_no_stdin
  Scenario: Only read-only git commands that take no stdin are replayable
    When replayability is asked of "-C sub ls-files -z", "--no-pager log -1", "remote get-url origin" and "hash-object a.svg"
    Then each is replayable, with "-C sub" becoming cwd "sub"
    And an absolute -C at or under the checkout is made repository-relative
    And "remote add", "remote set-url", "hash-object -w", "-C /elsewhere", "fetch", "add -A" and "status --porcelain" are undetermined
    And "hash-object --stdin-paths", "cat-file --batch", "check-ignore --stdin", "config user.name x", "--git-dir=/elsewhere" and "-C ../other" are undetermined

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_git_command_that_cannot_be_replayed_makes_the_whole_read_set_undetermined
  Scenario: A git command that cannot be replayed makes the whole read set undetermined
    Given a trace in which git runs "fetch origin" in the checkout
    When the trace is parsed
    Then it is undetermined, mentioning "git fetch"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::git_in_a_directory_the_run_created_is_its_own_scratch_repository:_kept_as_an_ordinary_process
  Scenario: Git run in a directory the run created is kept as an ordinary child process
    Given a trace that creates "/tmp/probe-ab12" and runs "git commit" there
    And that git reads its own ".git/index" and the checkout's ".git/HEAD"
    When the trace is parsed
    Then the read paths are ".git/HEAD"
    And there are no git commands
    And the children are "/usr/bin/git"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::the_programs_a_child_exec'd_are_named;_the_command's_own_exec_is_not
  Scenario: Programs exec'd by children are named, but not the command's own exec or a failed exec
    Given a trace where the command execs bun, a child execs bun, and another child's exec of "nope" fails
    When the trace is parsed
    Then there are no read paths and no git commands
    And the children are "/usr/bin/bun"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::a_child_that_ran_inline_code_is_named;_installed_package_files_it_read_are_kept_outside_the_read_set
  Scenario: A child running inline code is named with its code, and installed package files it read are external
    Given a trace where a child runs python3 -c "import x" and reads an installed dist-packages file, and probes a missing one
    When the trace is parsed
    Then there are no read paths
    And the children are "/usr/bin/python3"
    And the inline code is "import x" for python3
    And the external files are the dist-packages file it read

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::inlineCodeOf:_python_-c_and_bun_-e_give_their_code;_a_script_on_stdin_is_null;_a_file_or_-m_is_none
  Scenario: Inline code is found for python -c and bun -e, stdin is null, and a file or -m is none
    Then python3 "-c x arg" gives "x" and "-Bc y" gives "y"
    And bare python3, and python3 "-u -", give null
    And python3 with a script file, and python3.12 "-m json.tool", give undefined
    And bun "-e 1" gives "1" while bun with a script file gives undefined
    And git "-c a=b log" gives undefined

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::git_outside_the_checkout_in_a_directory_the_run_did_not_create_is_still_undetermined
  Scenario: Git outside the checkout in a directory the run did not create is undetermined
    Given a trace where the run created "/tmp/other", or failed to create "/tmp/probe-ab12"
    And git runs "status" in "/tmp/probe-ab12"
    When each trace is parsed
    Then each is undetermined, mentioning "ran outside the checkout"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::the_top-level_node_modules_is_left_out_(bun.lock_pins_it);_a_nested_one_is_kept_(bean_xd1g)
  Scenario: The top-level node_modules and the cone's own build output are excluded, nested node_modules is not
    Then "node_modules/zod/index.js" is excluded
    And "pkg/node_modules/x/index.js" is not excluded
    And "build/ci-cone/records.json" and "build/regen-cache/traces/1.log" are excluded
    And "build/other.json" is not excluded

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::instance_discovery_skips_exactly_the_build-output_directories_the_tree_digest_leaves_out
  Scenario: Instance discovery skips exactly the tree digest's build-output directories
    Then the set of non-instance directories equals the set of build-output directories

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::argument_splitting_respects_quotes_and_brackets;_escapes_decode
  Scenario: Syscall arguments split respecting quotes and brackets, and escapes decode
    When "AT_FDCWD</a, b>, \"x,y\", {a=1, b=2}, 0" is split
    Then the arguments are the fd path, the quoted string, the braced struct and "0"
    And unquoting a string with an escaped quote and backslash decodes both
    And unquoting a truncated string gives undefined

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::ignores_???(_<detached_...>_thread-exit_lines,_while_recording_paths_from_syscalls_that_detached_mid-call
  Scenario: Detached thread-exit lines are ignored while a call that detached mid-way still records its path
    Given a trace that reads "data/a.json", starts reading "data/b.json" and detaches, and holds "???(" and futex detach lines and an exit line
    When the trace is parsed
    Then the read paths are "data/a.json" and "data/b.json"

  @test:scripts/tests/sdlc/ci-cone.test.ts::parseTrace_—_what_a_traced_run_read,_or_why_that_cannot_be_enumerated::pathState_on_.git_records_directory_presence_without_hashing_git-internal_transient_entries,_while_hashing_.git/config_by_content
  Scenario: The state of .git is its presence, not its transient entries, while .git/config is hashed by content
    Given a temporary directory with no ".git"
    Then the state of ".git" is "absent"
    When ".git/config" is written
    Then the state of ".git" is "dir" and the state of ".git/config" is "file" with a 64-hex digest
    When "FETCH_HEAD" and "index.lock" are written inside ".git"
    Then neither state changes
    When ".git/config" itself changes
    Then its state changes

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::a_`tree`_site:_git's_answer_is_replayed_—_a_tracked_file_added_under_its_pathspec_makes_it_RUN,_one_elsewhere_does_not
  Scenario: A tree site's git answer is replayed, so a tracked file added under its pathspec makes it run
    # Skipped: where strace cannot run
    Given a committed fixture repository whose "g:check" script runs a reviewed "git ls-files data"
    When "g:check" is recorded
    Then the note starts with "recorded"
    And the record's git queries are exactly "ls-files data" at the root
    And the check skips
    When a file under "elsewhere" is added to the index
    Then the check still skips
    When a file under "data" is added to the index
    Then the check runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::the_result_store:_a_result_main's_latest_record_no_longer_holds_is_REUSED;_an_unseen_state_still_runs
  Scenario: A result that main's latest record no longer holds is reused from the result store, and an unseen state runs
    # Skipped: where strace cannot run
    Given "x:check" recorded with "data/c.json" as "c", then recorded again with it as "c2"
    Then each record's note mentions "result store"
    When "data/c.json" is set back to "c"
    Then the check skips, and why says "reused"
    When "data/c.json" is set to "c3"
    Then the check runs, and why says "result store: none of 2 stored result(s) matches"

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::a_green_run_is_recorded_with_what_it_read,_and_an_untouched_tree_SKIPS
  Scenario: A green run is recorded with what it read, and an untouched tree skips
    # Skipped: where strace cannot run
    Given a fixture whose "x:check" reads "data/a.json", follows it to "data/c.json", lists "data", probes "data/maybe.json" and imports "scripts/y.ts"
    When "x:check" is recorded
    Then it exits 0 and the note starts with "recorded"
    And the recorded reads include "data/a.json", "data/c.json", "data", "data/maybe.json", "scripts/x.ts", "scripts/y.ts" and "package.json"
    And they do not include "elsewhere/b.json"
    And on the untouched tree the check skips at sha "mainsha"

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::a_directory_it_only_OPENED:_a_new_entry_does_not_make_it_run;_the_file_it_read,_or_the_directory_becoming_a_file,_does_(tools#1265)
  Scenario: A directory only opened ignores new entries, but its read file or its turning into a file makes the check run
    # Skipped: where strace cannot run
    Given "o:check" recorded, which stats "opened" and reads "opened/k.json"
    Then the recorded state of "opened" is "dir" and of "scripts" starts with "dir "
    When a new file is added to "opened"
    Then the check skips
    When "opened/k.json" changes
    Then the check runs
    When it is changed back
    Then the check skips
    When "opened" is replaced by a file
    Then the check runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::THE_CONE:_a_change_to_a_file_the_check_never_read_does_not_make_it_run
  Scenario: A change to a file the check never read does not make it run
    # Skipped: where strace cannot run
    Given "x:check" recorded
    When "elsewhere/b.json" is changed and "elsewhere/new.json" is created
    Then the check skips

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::%s_→_it_RUNS
  Scenario: Each change inside the cone makes the recorded check run
    # Skipped: where strace cannot run
    Given "x:check" recorded and skipping on the untouched tree
    When one change is made
    Then the check runs
    And the rows are: a traced file edited; a file a data-dependent read now reaches; a probed absent path created; a new file in a listed directory; the script itself edited; a module it imports edited; package.json edited

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::a_moved_--against_baseline_makes_it_run,_though_no_file_changed
  Scenario: A moved --against baseline makes the check run with no file changed
    # Skipped: where strace cannot run
    Given "b:check" recorded against baseline "entry-1" and skipping
    When the baseline moves to "entry-2"
    Then the check runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::a_check_that_writes_inside_the_checkout_records_nothing,_so_it_always_runs
  Scenario: A check that writes inside the checkout records nothing and always runs
    # Skipped: where strace cannot run
    When "w:check", which writes "data/out.txt", is recorded
    Then the note mentions "writes inside the checkout"
    And the check runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::a_red_run_records_nothing,_keeps_its_own_exit_code,_and_forgets_an_earlier_pass
  Scenario: A red run records nothing and keeps its own exit code
    # Skipped: where strace cannot run
    # Gap: no earlier pass is recorded first, so forgetting one is not checked
    When "red:check", which exits 1, is recorded
    Then the exit code is 1
    And the note mentions "re-run untraced, which exited 1"
    And the check runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::no_record,_or_a_record_from_another_tracer_version,_means_run
  Scenario: No record, or a record from another tracer version, makes the check run
    # Skipped: where strace cannot run
    Given no record
    Then "x:check" runs
    When it is recorded, the records file's version is set to -1 and the result store is removed
    Then "x:check" runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::strace_availability_is_reported,_not_hidden
  Scenario: Whether strace is available is logged
    When the test runs
    Then it logs whether strace was available and the falsifiers ran or were skipped
    And the availability flag is a boolean

  @test:scripts/tests/sdlc/ci-cone.test.ts::test_files_as_gates:_a_test's_result_is_reused_only_when_what_it_READ_is_unchanged::a_green_test_file_is_recorded_and_SKIPS_on_an_untouched_tree,_or_when_only_an_unrelated_file_changed
  Scenario: A green test file is recorded and skips on an untouched tree or an unrelated change
    # Skipped: where strace cannot run
    Given a test file "t/a.test.ts" that reads "fixtures/f.json", run as the gate "test:t/a.test.ts"
    When it is recorded
    Then it exits 0 and the note starts with "recorded"
    And the recorded reads include "fixtures/f.json"
    And the gate skips
    When "elsewhere/x.json" changes
    Then the gate still skips

  @test:scripts/tests/sdlc/ci-cone.test.ts::test_files_as_gates:_a_test's_result_is_reused_only_when_what_it_READ_is_unchanged::its_fixture,_its_preload_or_the_test_itself_changed:_it_RUNS
  Scenario: A test file runs again when its fixture, its preload or the test itself changes
    # Skipped: where strace cannot run
    Given the gate "test:t/a.test.ts" recorded
    When "fixtures/f.json" changes
    Then the gate runs, and skips again once it is restored
    When the bunfig preload "t/preload.ts" changes
    Then the gate runs
    When the preload is restored and the test file is edited
    Then the gate runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::test_files_as_gates:_a_test's_result_is_reused_only_when_what_it_READ_is_unchanged::a_red_test_file_is_never_recorded
  Scenario: A red test file is never recorded
    # Skipped: where strace cannot run
    When the gate "test:t/red.test.ts" is recorded
    Then its exit code is not 0
    And the note mentions "not recorded"
    And the gate runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::test_files_as_gates:_a_test's_result_is_reused_only_when_what_it_READ_is_unchanged::the_fingerprint_audits_the_bunfig_preloads_as_entries
  Scenario: The bunfig preloads are listed as entries and a test file becomes a bun test gate
    # Skipped: where strace cannot run
    Given a bunfig whose test preload is "./t/preload.ts"
    Then the preload scripts are "test-preload:t/preload.ts" run as "bun ./t/preload.ts"
    And the gate "test:t/a.test.ts" is "bun test ./t/a.test.ts"

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_test's_bun_children:_their_environment_is_derived_from_the_trace::the_child's_variable_is_recorded;_changing_it,_or_the_child,_makes_the_test_RUN
  Scenario: A bun child's variable is recorded, and changing it or the child makes the test run
    # Skipped: where strace cannot run
    Given a test that spawns "bun t/child.ts", whose reviewed site reads "CONE_CHILD_FIXTURE", set to "one"
    When the test is recorded
    Then the note starts with "recorded" and the recorded env is "CONE_CHILD_FIXTURE" = "one"
    And the test skips
    When the variable is "two"
    Then the test runs, and why names the variable
    When it is "one" again
    Then the test skips
    When the child is edited
    Then the test runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_test's_bun_children:_their_environment_is_derived_from_the_trace::a_child_module_with_a_site_nobody_reviewed_records_nothing
  Scenario: A bun child module with an unreviewed site records nothing
    # Skipped: where strace cannot run
    Given the child reads HOME with no input-site annotation
    When the test is recorded
    Then it exits 0 and the note mentions "a bun child's modules"
    And the test runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_test's_python_children:_their_sources_are_audited_from_the_trace::the_child's_variable_and_interpreter_are_recorded;_changing_the_variable_or_the_script_makes_the_test_RUN
  Scenario: A python child's variable and interpreter are recorded, and changing the variable or script makes the test run
    # Skipped: where strace or python3 is unavailable
    Given a test that spawns "python3 t/child.py", whose reviewed site reads "CONE_PY_FIXTURE", set to "one"
    When the test is recorded
    Then the note starts with "recorded"
    And the recorded env holds "CONE_PY_FIXTURE" = "one" and a "PYTHONPATH" entry
    And a recorded tool path names python3
    And the test skips
    When the variable is "two"
    Then the test runs, and why names the variable
    When it is "one" again
    Then the test skips
    When the script is edited
    Then the test runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_test's_python_children:_their_sources_are_audited_from_the_trace::a_python_source_with_a_site_nobody_reviewed_records_nothing
  Scenario: A python source with an unreviewed site records nothing
    # Skipped: where strace or python3 is unavailable
    Given the python child reads the time with no input-site annotation
    When the test is recorded
    Then it exits 0 and the note mentions "a python child's sources"

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_test's_python_children:_their_sources_are_audited_from_the_trace::inline_code_is_audited_from_its_command_line:_clean_code_records,_a_site_nobody_reviewed_does_not
  Scenario: Python inline code is audited from its command line
    # Skipped: where strace or python3 is unavailable
    Given a test that runs python3 -c "print(1)"
    When it is recorded
    Then the note starts with "recorded" and the test skips
    When the test runs python3 -c with code that reads the time
    Then recording exits 0 and the note mentions "inline code"

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_test's_python_children:_their_sources_are_audited_from_the_trace::a_script_read_from_stdin_records_nothing
  Scenario: A python script read from stdin records nothing
    # Skipped: where strace or python3 is unavailable
    Given a test that pipes "print(1)" into python3 on stdin
    When the test is recorded
    Then it exits 0 and the note mentions "from stdin"

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_test's_python_children:_their_sources_are_audited_from_the_trace::an_imported_python_module's___pycache___is_neither_an_input_nor_a_write
  Scenario: An imported python module's __pycache__ is neither an input nor a write
    # Skipped: where strace or python3 is unavailable
    Given a python child that imports a helper module from "t"
    When the test is recorded
    Then the note starts with "recorded"
    And no recorded read contains "__pycache__"
    And the test skips

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_computed_load_the_run_did_not_open_is_no_input;_one_it_opened_is_audited_from_the_trace::a_plugin_the_run_never_loaded_does_not_stop_the_record,_even_with_an_unreviewed_site
  Scenario: A plugin the run never loaded does not stop the record even with an unreviewed site
    # Skipped: where strace cannot run
    Given a test whose loader computes a plugin import from "data/which.txt", which is empty
    And a plugin "plugins/p.ts" with an unreviewed site
    When the test is recorded
    Then the note starts with "recorded"
    And the test skips

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_computed_load_the_run_did_not_open_is_no_input;_one_it_opened_is_audited_from_the_trace::a_loaded_plugin_with_an_unreviewed_site_records_nothing
  Scenario: A loaded plugin with an unreviewed site records nothing
    # Skipped: where strace cannot run
    Given "data/which.txt" names "plugins/p.ts", which has an unreviewed site
    When the test is recorded
    Then it exits 0 and the note mentions "a module the run loaded by a computed load"

  @test:scripts/tests/sdlc/ci-cone.test.ts::a_computed_load_the_run_did_not_open_is_no_input;_one_it_opened_is_audited_from_the_trace::a_loaded,_reviewed_plugin's_variable_is_recorded,_and_a_change_to_it_or_to_the_plugin_RUNS
  Scenario: A loaded, reviewed plugin's variable is recorded, and a change to it or the plugin makes the test run
    # Skipped: where strace cannot run
    Given "data/which.txt" names "plugins/p.ts", whose reviewed site reads "CONE_PLUGIN_FIXTURE", set to "one"
    When the test is recorded
    Then the note starts with "recorded" and the recorded env is "CONE_PLUGIN_FIXTURE" = "one"
    And the test skips
    When the variable is "two"
    Then the test runs
    When it is "one" again and the plugin is edited
    Then the test runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::every_check_is_a_candidate,_declared_in_task-io_or_not_(owner,_2026-11-13:_every_gate)
  Scenario: A check with no input declaration, or none naming the tracked set, is still recorded and skipped
    # Skipped: where strace cannot run
    Given the fixture check "x:check", with no task-io declaration and then with one declaring only empty outputs
    When it is recorded on main for each
    Then it exits 0 and the note contains "recorded"
    And the check skips

  @test:scripts/tests/sdlc/ci-cone.test.ts::the_falsifiers,_under_a_real_strace_(skipped_where_strace_cannot_run)::an_undeclared_check_still_runs_when_a_path_it_read_changed
  Scenario: An undeclared check still runs when a path it read changed
    # Skipped: where strace cannot run
    Given the fixture check "x:check" with no task-io declaration, recorded on main
    And the check skips
    When "data/c.json", read only because "data/a.json" names it, is changed
    Then the check runs

  @test:scripts/tests/sdlc/ci-cone.test.ts::which_runs_record_(recordsOnMain)::a_push_to_main_records
  Scenario: A push to main records
    Given the event "push" on "refs/heads/main"
    Then the run records

  @test:scripts/tests/sdlc/ci-cone.test.ts::which_runs_record_(recordsOnMain)::a_dispatch_on_main_records_too:_a_train's_merge_starts_no_push_run_(bean_hd58)
  Scenario: A workflow dispatch on main records too
    Given the event "workflow_dispatch" on "refs/heads/main"
    Then the run records

  @test:scripts/tests/sdlc/ci-cone.test.ts::which_runs_record_(recordsOnMain)::nothing_else_records:_a_dispatch_on_another_branch,_a_PR,_a_merge_group
  Scenario: No other run records
    Then a workflow dispatch on "refs/heads/repin-train/x" does not record
    And a pull request on "refs/pull/1/merge" does not record
    And a merge group on "refs/heads/gh-readonly-queue/main/x" does not record
    And a push to "refs/heads/feature" does not record
    And an empty environment does not record
