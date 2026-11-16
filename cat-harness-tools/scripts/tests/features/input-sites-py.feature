# scripts/input-sites-py.ts is the Python twin of the input-site audit: it scans the Python sources a test's python3 child ran for environment, spawn, network, clock, randomness and host reads a trace does not record.
# Each Scenario names the test that executes it.
Feature: Python input sites are found and audited

  @test:scripts/tests/input-sites-py.test.ts::blankPython_blanks_strings_and_comments,_never_code::a_docstring,_a_quoted_name_and_a_comment_hide_their_text
  Scenario: Docstrings, string literals and comments are blanked but code is kept
    Given Python source with "os.environ" in a docstring, "subprocess" in a string, "time.time()" in a comment and a real os.environ read
    When blankPython blanks it
    Then the docstring line no longer contains "environ"
    And the second line no longer contains "subprocess" or "time"
    And the third line still contains "os.environ["

  @test:scripts/tests/input-sites-py.test.ts::scanPython_finds_what_a_trace_does_not_record::%s:_%s
  Scenario: Each kind of risky Python line is one unreviewed site with its risk
    Given a one-line Python file, one row per risk: env (os.environ.get, os.getenv), spawn (subprocess.run), network (import urllib.request), clock (time.time, datetime.now), random (random.random), host (os.path.expanduser) and computed (exec)
    When scanPython scans it
    Then it finds exactly one site
    And the site's risks contain the row's risk
    And the site has no verdicts

  @test:scripts/tests/input-sites-py.test.ts::scanPython_finds_what_a_trace_does_not_record::a_module_loaded_by_name_is_no_site:_its_file_is_in_the_read_set
  Scenario: Loading a module by name is not a site
    Given Python source importing importlib.util, calling __import__ and exec_module
    When scanPython scans it
    Then no site is found

  @test:scripts/tests/input-sites-py.test.ts::scanPython_finds_what_a_trace_does_not_record::importing_subprocess,_or_naming_its_exceptions,_runs_nothing;_a_renaming_import_is_a_site
  Scenario: Importing subprocess is not a site, but a renaming import of run is
    Given Python source that imports subprocess and catches subprocess.SubprocessError
    When scanPython scans it
    Then no site is found
    And "from subprocess import run as r" is one site with risks exactly "spawn"

  @test:scripts/tests/input-sites-py.test.ts::scanPython_finds_what_a_trace_does_not_record::plain_code,_and_a_risk_word_in_a_string_or_comment,_is_no_site
  Scenario: Plain code and risk words in strings or comments are not sites
    Given Python source importing json and printing a dict keyed "os.environ" with a "subprocess" comment
    When scanPython scans it
    Then no site is found

  @test:scripts/tests/input-sites-py.test.ts::scanPython_finds_what_a_trace_does_not_record::an_annotation_pinned_to_its_statement_answers_it;_an_edit_makes_it_stale
  Scenario: A pinned annotation answers its site until the statement is edited
    Given an os.environ.get("X") line annotated "env X" and pinned to its statement
    When scanPython scans it
    Then the site's verdicts are env with names "X"
    And after the line is edited to read "Y" the verdicts are "stale"

  @test:scripts/tests/input-sites-py.test.ts::scanPython_finds_what_a_trace_does_not_record::a_verdict_the_cone_cannot_answer_for_Python_is_malformed
  Scenario: A verdict Python cannot take is malformed
    Given a subprocess.run(cmd) line annotated "runs scripts/*.ts"
    When scanPython scans it
    Then the site is malformed with a message containing "a Python site takes only"

  @test:scripts/tests/input-sites-py.test.ts::auditPython::collects_the_variables,_and_refuses_the_first_site_nobody_reviewed
  Scenario: The audit collects reviewed variables and refuses an unreviewed site
    Given a.py with an os.environ.get("X") site annotated "env X"
    When auditPython audits a.py alone
    Then it returns env "X" and no unset variables
    And when b.py with an unannotated time.time() is added, the result is undetermined naming "b.py:1"
