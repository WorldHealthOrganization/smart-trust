# scripts/cache-key.ts (cache:key and cache:publish) derives the key of a cached CI step and publishes a
# committer's output as a cache ref. Each Scenario names the test that executes it.
Feature: Cached CI step keys and published entries

  @test:scripts/tests/cache-key.test.ts::hashFiles::is_the_runner's:_sha256_over_each_file's_raw_sha256,_in_path_order
  Scenario: hashFiles hashes each file's raw sha256 in path order
    Given a directory holding files "a" with "A" and "b" with "B"
    When the files "b" and "a" are hashed
    Then the result is the sha256 over the raw sha256 of "A" then of "B"

  @test:scripts/tests/cache-key.test.ts::hashFiles::a_missing_file,_or_none,_is_undetermined_—_never_a_constant_key
  Scenario: A missing file or no file makes the hash undetermined
    Given an empty directory
    When the file "nope" is hashed
    Then the result is undetermined with "nope is not a file"
    And hashing no files is undetermined with "no file to hash"

  @test:scripts/tests/cache-key.test.ts::namespaced::matches_cached-step.sh's_cs1-<step>-<key>
  Scenario: A key is namespaced as cs1-step-key
    Given the step "cat-mount" and the key "ab"
    When the key is namespaced
    Then it is "cs1-cat-mount-ab"

  @test:scripts/tests/cache-key.test.ts::namespaced::refuses_a_step_id_the_action_refuses
  Scenario: A step id the action refuses is refused
    Given the step id "Bad Step"
    When a key is namespaced with it
    Then it throws

  @test:scripts/tests/cache-key.test.ts::treePathOf::a_checkout_path_goes_under_ws/,_a_home_path_under_home/,_anything_else_is_refused
  Scenario: Output paths map under ws or home, and others are refused
    Given a checkout at "/r" and a home at "/h"
    When output paths are mapped to tree paths
    Then "build/x" becomes "ws/build/x"
    And "~/.cache/cat-mount" becomes "home/.cache/cat-mount"
    And "/etc/passwd" throws

  @test:scripts/tests/cache-key.test.ts::publish::--dry-run_commits_the_output_as_a_tree_and_pushes_nothing
  Scenario: A dry-run publish commits the output as a tree
    # Gap: does not check that nothing is pushed
    Given a git repository with "out/f.txt"
    When "out" is published for step "demo" with key "k1" as a dry run
    Then the ref is "refs/cache/cs1-demo-k1"
    And the commit's tree lists only "ws/out/f.txt"

  @test:scripts/tests/cache-key.test.ts::publish::the_commit_is_the_same_wherever_it_is_published,_with_no_git_identity_configured
  Scenario: The published commit is identical across repositories without a git identity
    Given no global or system git configuration
    And two separate git repositories each holding the same "out/f.txt"
    When each publishes "out" for step "demo" with key "k1" as a dry run
    Then both commits are the same

  @test:scripts/tests/cache-key.test.ts::publish::an_output_that_was_not_built_is_refused
  Scenario: Publishing an output that was not built is refused
    Given a git repository without an "absent" output
    When "absent" is published as a dry run
    Then it throws "does not exist"

  @test:scripts/tests/cache-key.test.ts::every_published_step_derives_its_key,_never_from_a_hand_list_of_inputs
  Scenario: Every published step derives its key
    Given every step in the published steps table
    When each is checked
    Then its id namespaces without throwing
    And its key is derived from a script or from hashFiles
    And it publishes at least one path

  @test:scripts/tests/cache-key.test.ts::cache:key_is_the_key_`gates`_records:_the_same_fingerprint,_the_same_io_projection,_the_same_baseline
  Scenario: cache:key matches the fingerprint gates records
    Given the first 5 scripts, sorted, that declare inputs in the task io table
    When each one's gate fingerprint and cache key are computed at the checkout root
    Then the cache key equals the fingerprint hash, or both are undetermined
