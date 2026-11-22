# The mount gates are judged on the tree as mounted: the prepare job records
# them and the shards take that record. Each Scenario names the test that
# executes it.
Feature: run-gates.py --as-mounted

  @test:scripts/tests/run-gates-as-mounted.test.ts::run-gates.py_--as-mounted::runs_only_the_mount_gates_and_records_them_in_the_--record_shape
  Scenario: --as-mounted runs and records only the mount gates
    Given a fixture root whose layer declares three mount gates and one other gate, run by echo
    When run-gates.py runs with --as-mounted
    Then it exits 0
    And the record holds exactly the three mount gates, mount:lock:check with exit 0

  @test:scripts/tests/run-gates-as-mounted.test.ts::run-gates.py_--as-mounted::a_shard_takes_the_recorded_answer_in_place_of_running_the_gate_over_the_built-on_tree
  Scenario: A shard takes the recorded answer
    Given a record saying mount:lock:check exited 1 with "as mounted: MISSING"
    When run-gates.py runs with --as-mounted-record
    Then it exits 0
    And mount:lock:check carries exit 1 and that tail
    And check:other and mount:remote:check ran with exit 0

  @test:scripts/tests/run-gates-as-mounted.test.ts::run-gates.py_--as-mounted::with_no_record_the_mount_gates_run_in_the_shard_as_before
  Scenario: With no record the mount gates run in the shard
    When run-gates.py runs with --as-mounted-record naming an absent file
    Then it exits 0 and says the record is "missing or unreadable"
    And mount:lock:check ran with exit 0
