# The shared layers cache ref refs/cat/layers/<key>, exercised against fixture
# repositories served over file://. Each Scenario names the test that executes it.
Feature: The shared layers cache ref

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::miss:_no_ref_at_the_index,_every_layer_is_fetched_from_its_own_repository
  Scenario: With no ref at the index every layer is fetched from its own repository
    Given an index whose lock pins two layers and no layers ref
    When a fresh clone replays its mounts
    Then both layers are mounted, the cache names no ref and reports a miss naming refs/cat/layers/
    And the summary line starts as an exact miss

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::hit:_after_publish,_a_fresh_clone_mounts_every_layer_from_the_ref_with_the_layer_repositories_unreachable
  Scenario: After publish a fresh clone mounts every layer from the ref, offline
    Given an index whose mounts are replayed and published with main
    Then the publish pushes the key's ref and the main ref, keyed by the lock's layers key
    And the published tree holds exactly each layer's declaration and directory at its mount path
    When a fresh clone replays with the layer repositories unreachable
    Then both layers are mounted from the key's ref, each detail naming the layers cache, and the summary is an exact hit with 2 layers and 0 fetched
    And a second replay needs nothing and prints no summary line, and a check reads both layers current

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::tampered:_a_cached_directory_that_does_not_hash_to_the_lock_is_refused_and_that_layer_falls_back
  Scenario: A tampered cached directory is refused and that layer falls back
    Given a published layers ref re-pushed with one layer's script changed
    When a fresh clone replays
    Then both layers are mounted, the tampered one fetched from its own repository with its original bytes, the other from the cache
    And offline the tampered layer reads could-not-determine and its directory is not laid down

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::stale:_main_from_an_older_lock_still_serves_the_layer_that_did_not_move;_the_re-pinned_one_is_fetched
  Scenario: A stale main ref still serves the layer that did not move
    Given main's layers ref published from a lock, then one layer re-pinned without publishing
    When a fresh clone replays
    Then both are mounted from the main ref, with the re-pinned layer fetched
    And the summary is warm with 1 layer from main and 1 fetched, and the re-pinned layer holds its new bytes

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::publish_refuses_a_checkout_whose_mounts_do_not_hash_to_the_lock,_and_--no-layers-cache_skips_the_ref
  Scenario: Publish refuses mounts that do not hash to the lock; --no-layers-cache skips the ref
    Given an index whose layer is not yet mounted, publish fails
    And once mounted and then edited, publish is refused and no refs/cat ref exists at the origin
    And a replay with the layers cache off reports no layers result

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::publishing_leaves_no_objects_behind_in_the_index_checkout
  Scenario: Publishing leaves no objects in the index checkout
    Given a replayed index
    When the layers are published with and without pushing
    Then the checkout's loose object count is unchanged

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::node_modules_and_other_install_artefacts_are_never_published
  Scenario: node_modules is never published
    Given a mounted layer directory holding node_modules
    When the layers are published
    Then the published tree names no node_modules

  @test:scripts/tests/layers-cache.test.ts::layers_cache:_publish_and_the_fast_path::prune_keeps_the_newest_N_lock_refs,_main,_and_any_key_asked_to_be_kept
  Scenario: Prune keeps main and every key asked to be kept
    Given the published key's ref, main, and three extra key refs at the origin
    When the refs are pruned to the newest 1, keeping the published key and the first extra
    Then the published key's ref, main and the first extra remain, at least one ref is pruned, and the rest are the five less those pruned
    # Gap: both retained key refs are on the keep list, so retention of the newest N refs on its own is not distinguished.

  @test:scripts/tests/layers-cache.test.ts::layers:check_—_the_re-pinner's_gate::missing_until_the_re-pinner_publishes,_then_published;_an_unchanged_lock_owes_nothing
  Scenario: layers:check is missing until published, and an unchanged lock owes nothing
    Given a replayed index with no layers ref
    Then the check fails as "missing" pointing at layers:publish
    And checked against a lock unchanged since HEAD it is "skipped"
    And after publish it passes as "published" with the lock's layers key

  @test:scripts/tests/layers-cache.test.ts::layers:move_—_a_sandbox's_publish,_moved_by_the_runner::a_remote_that_refuses_refs/cat_gets_the_claude/cat-layers/_branch;_the_mover_moves_it_and_deletes_the_branch
  Scenario: A remote that refuses refs/cat gets the claude/cat-layers/ branch, which the mover moves
    Given an origin that accepts pushes only to claude/ branches
    When the layers are published
    Then the publish succeeds through the claude/cat-layers/<key> branch and the check reads "pending"
    When the hook is removed and the mover runs
    Then the state is "published", the check reads published, the branch is deleted, and a second move is still "published"

  @test:scripts/tests/layers-cache.test.ts::layers:move_—_a_sandbox's_publish,_moved_by_the_runner::the_mover_refuses_a_branch_that_does_not_hold_this_lock's_layers_commit
  Scenario: The mover refuses a branch that does not hold this lock's layers commit
    Given a claude/cat-layers/<key> branch pointing at the index's own HEAD
    When the mover runs
    Then the state is "error" saying it is not this lock's layers commit
