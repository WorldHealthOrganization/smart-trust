# Mount gaps observed 2026-10-12, against fixture repositories over file://:
# (b) a mounted layer with a package.json is installed and runs, and --check
# still passes; (c) seeding a remote layer writes its trust.consent for that
# pin. The fixtures are "lib", "tool" (resolving @t/lib through a workspace)
# and "bad" (which tracks node_modules/). Each Scenario names the test that
# executes it.
Feature: A mounted layer runs, and seeding it writes its consent

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::after_mounting,_the_mounted_tool_runs:_its_workspace_package_resolves_through_node_modules
  Scenario: A mounted tool runs, resolving its workspace package
    Given a layer whose index config mounts consented "lib" and "tool"
    When they are mounted
    Then both are "mounted" and tool/node_modules/@t/lib exists
    And running tool/scripts/run.ts prints "84" with no stderr

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::--check_still_passes_over_the_installed_mount,_and_a_re-mount_does_not_refuse_it
  Scenario: --check passes over an installed mount and a re-mount does not refuse it
    Given "lib" and "tool" mounted with dependencies installed
    Then --check is "mounted"
    And mounting again leaves both "mounted" and --check "mounted"

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::the_install_writes_no_lockfile_and_the_lock's_digests_are_the_ones_a_bytes-only_mount_writes
  Scenario: The install writes no lockfile and does not change the lock's digests
    Given one checkout mounted without install and another mounted with it
    Then the first has no tool/node_modules and the second no tool/bun.lock
    And the two locks' directory tree digests are equal

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::an_edit_OUTSIDE_node_modules_still_reads_modified_—_the_exclusion_is_that_directory_only
  Scenario: An edit outside node_modules still reads modified
    Given "lib" and "tool" mounted
    When tool/scripts/run.ts is edited
    Then --check is "missing" and the tool's detail says "modified"

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::an_upstream_that_TRACKS_node_modules/_is_refused,_never_locked_with_bytes_no_check_would_see
  Scenario: An upstream that tracks node_modules/ is refused
    When the "bad" layer is mounted
    Then its outcome is "could-not-determine", naming "node_modules"

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::replaying_the_lock_(mount:lock)_installs_too,_and_its_--check_reads_current
  Scenario: Replaying the lock installs too and its check reads current
    Given a lock written by a mount without install, copied into a fresh checkout, and the fixtures served under CAT_MOUNT_URL_PREFIX
    When the lock is replayed
    Then both are "mounted" and tool/node_modules/@t/lib exists
    And replaying with --check reads both "current"

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::installDependencies:_a_lockfile_behind_its_package.json_still_installs,_and_is_put_back
  Scenario: A lockfile behind its package.json still installs and is put back
    Given a package.json and a stale bun.lock naming another package
    When its dependencies are installed
    Then the state is "installed" and bun.lock is unchanged

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::installDependencies:_no_manifest_is_nothing;_a_lockfile_the_install_touched_is_put_back_byte-for-byte
  Scenario: No manifest installs nothing, and a touched lockfile is put back
    Then a directory with no package.json installs "none"
    And installing a directory whose bun.lock reads "PINNED" leaves it reading "PINNED"
    And paths under any node_modules/ are install artefacts, but scripts/node_modules.ts is not

  @test:scripts/tests/remote-mount-gaps.test.ts::(b)_a_mounted_layer_is_runnable,_and_the_install_does_not_make_it_modified::installDependencies:_a_workspace_member_of_the_root_is_left_to_the_root's_install_(folio-assistant#2529,_ajv)
  Scenario: A workspace member of the root is left to the root's install
    Given a root whose workspaces are "inst" and "pkgs/*", and packages inst, pkgs/a, other and pkgs/a/deep
    Then inst and pkgs/a have the root as their workspace root, while other and pkgs/a/deep have none
    And installing inst is "none" because it is a "workspace member", writing no root node_modules

  @test:scripts/tests/remote-mount-gaps.test.ts::(c)_seeding_a_remote_instance_writes_its_consent::a_new_remote_instance_is_written_WITH_trust.consent_bound_to_its_pin,_and_then_mounts
  Scenario: Seeding a new remote layer writes its consent bound to the pin, and it mounts
    Given a layer with no remote mounts
    When "lib=o/lib@<sha>" is seeded whole with a grant
    Then its mount entry's consent is by "test" on "2026-10-12" at <sha> with the grant's evidence, and it is whole
    And mounting it without install is "mounted"

  @test:scripts/tests/remote-mount-gaps.test.ts::(c)_seeding_a_remote_instance_writes_its_consent::a_re-pin_moves_the_consent_with_the_pin_and_keeps_the_entry's_overrides
  Scenario: A re-pin moves the consent with the pin and keeps the overrides
    Given a consented whole "lib" entry pinned at another sha
    When "lib=o/lib@<sha>" is seeded
    Then its ref and consent ref are <sha> with the grant's evidence, and it is still whole

  @test:scripts/tests/remote-mount-gaps.test.ts::(c)_seeding_a_remote_instance_writes_its_consent::a_re-pin_over_edited_mounts_is_refused,_unless_--fresh_will_replace_them_(folio-assistant#2682)
  Scenario: A re-pin over edited mounts is refused unless --fresh
    Given "lib" seeded and mounted, then a mounted file edited
    When it is re-seeded at another sha
    Then it throws saying there are "edits the lock does not hold" for lib, and the index config is unchanged
    When it is re-seeded discarding edits
    Then its ref is the new sha

  @test:scripts/tests/remote-mount-gaps.test.ts::(c)_seeding_a_remote_instance_writes_its_consent::a_review's_choice_is_written_back_to_the_mount_entry,_keeping_the_pin_and_consent_(bean_mo75)
  Scenario: A review's choice is written back keeping the pin and consent
    Given "lib" seeded
    When directories "lib-schemas" (named twice) are chosen for it
    Then its overrides are exactly that one directory, and its ref and trust are unchanged
    And it mounts
    And "a:b" parses as harness "a" instance "b"
    And choosing nothing throws "a choice of nothing", and choosing for an unknown entry throws "no mount entry"

  @test:scripts/tests/remote-mount-gaps.test.ts::(c)_seeding_a_remote_instance_writes_its_consent::a_seed_spec_must_be_<name>=<owner/repo>@<40-char_sha>,_and_an_empty_grant_writes_nothing
  Scenario: A seed spec needs a full sha and an empty grant writes nothing
    Then "lib=o/lib@main" is refused as needing a "40-character" sha
    And seeding with empty evidence throws and leaves the index config unchanged
