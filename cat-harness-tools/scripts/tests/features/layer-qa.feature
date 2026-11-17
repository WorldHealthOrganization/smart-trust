# A mounted layer's QA is read from its own store at the pinned commit
# (folio-assistant-7mwa), over a bare repository standing in for the layer's
# remote. Each Scenario names the test that executes it.
Feature: A mounted layer's QA read from its own store

  @test:scripts/tests/layer-qa.test.ts::readQaTreeAtCommit::a_commit_pushed_to_main_is_read_at_main/<sha>
  Scenario: A commit published to main is read at main/<sha>
    Given QA results published at main/<sha>
    When the QA tree is read at that commit
    Then it is a hit keyed main/<sha> holding the published result file

  @test:scripts/tests/layer-qa.test.ts::readQaTreeAtCommit::a_pull_request's_head,_as_a_re-pin_train_may_pin_it,_is_read_at_pr/<n>/<sha>
  Scenario: A pull request head is read at pr/<n>/<sha>
    Given results published at main/<sha> and different results published at pr/5/<other sha>
    When the QA tree is read at the pull request's commit
    Then it is a hit keyed pr/5/<other sha>

  @test:scripts/tests/layer-qa.test.ts::readQaTreeAtCommit::an_unpublished_commit_is_a_miss_that_names_it_—_never_the_newest_entry
  Scenario: An unpublished commit is a miss naming it
    Given results published only at main/<sha>
    When the QA tree is read at a commit nobody published
    Then it is a miss whose reason names that commit

  @test:scripts/tests/layer-qa.test.ts::readQaTreeAtCommit::a_layer_with_no_store_branch_at_all_is_a_miss,_not_unknown
  Scenario: A layer with no store branch is a miss
    Given a remote with no QA store branch
    When the QA tree is read at a commit
    Then it is a miss, not unknown

  @test:scripts/tests/layer-qa.test.ts::readQaTreeAtCommit::an_abbreviated_sha_is_a_usage_error:_a_pin_is_a_full_commit
  Scenario: An abbreviated sha is a usage error
    When the QA tree is read at a seven-character sha
    Then it throws asking for a full commit sha

  @test:scripts/tests/layer-qa.test.ts::the_layer_a_mount_came_from::an_owner/name_repository_is_read_from_GitHub;_anything_else_is_used_as_given
  Scenario: An owner/name repository is read from GitHub; anything else is used as given
    When the QA remote of a layer at owner/name is resolved, it is that GitHub repository's .git URL
    And a file:// repository is used as given
    And a QA_LAYER_REMOTE_<LAYER> environment override wins over both

  @test:scripts/tests/layer-qa.test.ts::the_layer_a_mount_came_from::an_instance_no_lock_mounted_has_no_layer_source:_its_QA_is_the_index's
  Scenario: An instance no lock mounted has no layer source
    Given an index with no lock
    When the layer QA source of a directory in it is asked
    Then there is none, and the layer QA tree read has no source

  @test:scripts/tests/layer-qa.test.ts::the_layer_a_mount_came_from::a_mounted_layer_is_read_from_its_own_store_at_the_pinned_commit
  Scenario: A mounted layer is read from its own store at the pinned commit
    Given a lock mounting the layer from a remote at a pinned sha, and results published there at main/<sha>
    When the layer's QA source is resolved, it names the layer, the remote and the sha
    And the layer's QA tree read is a hit
