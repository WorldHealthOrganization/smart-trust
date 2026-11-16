# Remote mounts (bean 0mpw) against fixture repositories: local bare git
# repositories served over file://, so the real fetch path runs with no
# network. Repository o/up holds "core" (needs base; mountDefaults narrows to
# core-scripts) and "base" (needs boot; its state directory is branch-kept),
# and gitlinks "boot", which lives at the root of o/boot. A downstream
# checkout declares a consented remote mount of "core" from o/up, and
# consents to boot at its own pin. Each Scenario names the test that executes
# it.
Feature: Remote layers are mounted at their pins, checked and locked

  @test:scripts/tests/remote-mount.test.ts::the_remote_source_member::a_pin_is_a_full_40-character_SHA,_never_a_branch_or_an_abbreviation
  Scenario: A pin is a full 40-character sha
    Then a remote source pinned at 40 hex characters parses
    And one pinned at "main" or at 12 characters does not

  @test:scripts/tests/remote-mount.test.ts::the_remote_source_member::resolves_with_the_upstream_path_defaulting_to_the_entry's_own
  Scenario: A remote source's upstream path defaults to the entry's own
    When a directory "skills/" with a remote source is resolved
    Then it is remote from "o/r" with upstream path "skills/", declared in the declaration

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::1._the_closure_is_mounted_transitively:_same_tree,_then_a_gitlink_pin
  Scenario: The closure is mounted transitively, through the same tree then a gitlink pin
    When the downstream's mounts are mounted
    Then core, base and boot are all "mounted"
    And core holds only its scripts, base its schemas but not its branch-kept state, and boot is read from o/boot
    And the lock pins boot by "gitlink" at the boot sha from its root, and base by "same-tree"
    And the check is "mounted" with exit code 0

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::1b._an_instance_entry_left_at_an_older_commit_than_its_pin_is_missing,_not_mounted_(folio-assistant#2682)
  Scenario: A layer entry left at an older commit than its pin is missing
    Given the mount done, then the mounted layer's own lock entry set to another sha
    When the mounts are checked
    Then the state is "missing", naming that layer "at ffffffffffff"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::1c._a_concern_name_expands_to_the_members_its_kinds_declare:_processes/sdlc/_and_skills/sdlc/_(bean_mo75)
  Scenario: A concern name expands to the members its kinds declare
    Given a layer "cg" with processes/ (groups sdlc and kg), skills/ (topic sdlc) and notes/, mounted with directories ["sdlc"]
    When it is mounted
    Then cg is "mounted" with processes/sdlc and skills/sdlc only
    And the lock's directory ids are "processes/sdlc" and "skills/sdlc", and the check is "mounted"
    When the override names "conduct", which no kind declares
    Then planning gives cg "could-not-determine"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::2._code_arrives_through_mounted_paths:_a_cross-instance_relative_import_resolves
  Scenario: A cross-instance relative import resolves in mounted code
    When the downstream's mounts are mounted
    Then importing core/scripts/run.ts gives doubled 84

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::3._the_overlay_reads_a_mounted_dependency_like_a_local_one
  Scenario: The overlay reads a mounted dependency like a local one
    Given a downstream that needs "core"
    When its mounts are mounted
    Then its instance roots are the root, base, boot and core
    And its declaration chain is boot, base, core, (root)

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::4._edited_mounted_bytes_are_reported,_and_a_re-mount_leaves_them_untouched
  Scenario: Edited mounted bytes are reported and a re-mount leaves them alone
    Given the mounts mounted, then base/schemas/util.ts edited
    Then the check is "missing" with base "modified"
    When mounting again
    Then base is "left untouched" and the edit is still there

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::4b._--fresh_replaces_an_edited_mount,_and_only_what_the_lock_says_this_mount_put_there
  Scenario: --fresh replaces an edited mount
    Given the mounts mounted, then base/schemas/util.ts edited
    When mounting again discarding edits
    Then base is not "left untouched", the edit is gone, and base is not "missing"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::5._a_downstream_overrides_by_id_—_path_and_directories_—_and_the_overlay_still_finds_it
  Scenario: A downstream overrides path and directories by id
    Given core overridden to path "vendor/core" with directories ["core-docs"]
    When the mounts are mounted
    Then the summary is "mounted" with vendor/core/docs/readme.md and no vendor/core/scripts
    And the mounted root of "core" is vendor/core

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::5b._a_dependency_an_override_moved_deeper_is_still_resolved_by_the_overlay,_through_the_lock
  Scenario: A dependency moved deeper by an override is resolved through the lock
    Given a downstream that needs core, with core overridden to path "vendor/core"
    When its mounts are mounted
    Then its declaration chain is boot, base, core, (root)

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::6._an_override_that_names_an_undeclared_directory_is_refused,_not_dropped
  Scenario: An override naming an undeclared directory is refused
    Given core overridden to directories ["nope"]
    When the mounts are planned
    Then core is "could-not-determine"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::7._`skip`_is_an_answer,_recorded_in_the_lock,_and_not_a_failure
  Scenario: skip is an answer recorded in the lock
    Given boot overridden with skip
    When the mounts are mounted and checked
    Then the check is "mounted" with boot "skipped"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::8._a_pin_the_remote_does_not_have_is_could-not-determine,_never_an_empty_layer
  Scenario: A pin the remote does not have is could-not-determine
    Given the mount pinned at 0000…
    When it is mounted
    Then the summary and the check are "could-not-determine", whose exit code is 2

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::9._a_path_the_mount_did_not_put_there_is_refused
  Scenario: A path the mount did not put there is refused
    Given the downstream holds a local core/mine.txt
    When the mounts are mounted
    Then core is "missing", mine.txt is unchanged, and the check is "missing"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::9b._a_target_that_IS_the_pinned_bytes,_with_no_lock,_is_adopted;_one_that_differs_is_refused_and_named_(folio-assistant#2467)
  Scenario: Pinned bytes with no lock are adopted; differing ones are refused and named
    Given the mounts mounted and the lock removed
    When mounting again
    Then base is "mounted" and "adopted", and the check is "mounted"
    Given the lock removed again, util.ts edited and extra.ts added
    When mounting again
    Then base is "missing", naming "differ: `base/schemas/util.ts`" and "extra: `base/schemas/extra.ts`", and the edit stays

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::10._a_lock_for_other_pins_reads_stale;_an_unreadable_lock_reads_could-not-determine
  Scenario: A lock for other pins is stale and an unreadable lock is could-not-determine
    Given the mounts mounted, then the declared pin changed
    Then the check is "missing"
    When the lock is not JSON
    Then the check is "could-not-determine"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::11._no_lock_where_mounts_are_declared_is_missing;_nothing_declared_is_not-enabled
  Scenario: No lock where mounts are declared is missing; nothing declared is not-enabled
    Then the check of a downstream never mounted is "missing"
    And the check of a layer declaring no mounts is "not-enabled"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::12._a_need_neither_in_the_tree_nor_pinned_as_a_gitlink_is_missing,_and_the_check_says_so
  Scenario: A need neither in the tree nor pinned as a gitlink is missing
    Given a mount of a layer "g" that needs "nobody"
    When it is mounted and checked
    Then the check is "missing" with "nobody" "missing"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::13._the_mount_is_kept_out_of_commits
  Scenario: The mount is kept out of commits
    When the mounts are mounted
    Then nothing had to be excluded and git status shows nothing under core/

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::14._the_session-start_fan-out_mounts_every_declaring_instance,_then_checks_clean
  Scenario: The session-start fan-out mounts and then checks clean
    Then a fan-out check before mounting is "missing"
    And a fan-out mount is "mounted"
    And a fan-out check after it is "mounted"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::14b._a_fan-out_over_mounts_the_lock_already_verifies_fetches_nothing_(bean_folio-assistant-x35i);_a_removed_one_is_fetched_again
  Scenario: A fan-out over verified mounts fetches nothing; a removed one is fetched
    Given the fan-out mounted
    When it runs again
    Then it is "mounted", asked for no URL, and says "nothing fetched"
    When a locked directory is removed and it runs again
    Then it asks for URLs, is "mounted", and the directory is back

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::14c._a_fan-out_whose_only_off-lock_mounts_are_edited_fetches_nothing_and_stays_missing_(bean_cat-tools-sm8r);_an_absent_one_is_fetched
  Scenario: A fan-out whose only off-lock mounts are edited fetches nothing
    Given the fan-out mounted, then a file written into a mounted directory
    Then the lock sees an edited-only state
    When the fan-out runs
    Then it asks for no URL, is "missing", says "nothing fetched" and "left untouched", and the file is still there
    When the directory is removed instead
    Then there is no edited-only state, and the fan-out asks for URLs and is "mounted"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::15._a_declaration_whose_directory_is_NOT_its_name_is_found,_and_lands_at_livesAt.path
  Scenario: A declaration whose directory is not its name lands at livesAt.path
    Given o/odd declares "trust" in shared/trust.json, living at "trust"
    When it is mounted
    Then it is "mounted" with trust/x/a.txt, from upstream root "shared" at path "trust"

  @test:scripts/tests/remote-mount.test.ts::mount:remote_over_fixture_repositories::16._declared_assets_arrive_beside_the_declaration_and_are_locked;_an_undeclared_root_file_does_not
  Scenario: Declared assets arrive and are locked; undeclared root files do not
    Given o/assets declares "doc" with a README asset and an asset climbing out to ../ROOT.md, plus an undeclared stray.ts
    When it is mounted
    Then it is "mounted" with doc/README.md, without doc/stray.ts or ROOT.md
    And the lock's assets are exactly "README.md", and the check is "mounted"
    When doc/README.md is edited
    Then the check is "missing", saying "doc/README.md modified"

  @test:scripts/tests/remote-mount.test.ts::mount_trust_(H8,_bean_`ieum`)::16._unsigned_and_unconsented_is_refused,_and_nothing_is_written
  Scenario: Unsigned and unconsented is refused and nothing is written
    Given the core mount without trust
    When it is mounted
    Then every outcome is "refused", the first saying "unsigned and unconsented"
    And no core directory is written

  @test:scripts/tests/remote-mount.test.ts::mount_trust_(H8,_bean_`ieum`)::17._a_staging_mount_needs_neither_signature_nor_consent
  Scenario: A staging mount needs neither signature nor consent
    Given the core mount without trust
    When it is mounted for staging
    Then the summary is "mounted"

  @test:scripts/tests/remote-mount.test.ts::mount_trust_(H8,_bean_`ieum`)::18._consent_for_another_pin_is_refused:_a_moved_pin_asks_again
  Scenario: Consent for another pin is refused
    Given the core mount consented at another sha
    When it is mounted
    Then the first outcome says "a moved pin asks again"

  @test:scripts/tests/remote-mount.test.ts::whole-instance_mounts_and_replaying_the_lock_(bean_`nn8e`,_#2462)::19._`whole`_mounts_every_tracked_file_at_the_instance_root,_locked_as_one_`*`_directory
  Scenario: whole mounts every tracked file, locked as one "*" directory
    Given boot overridden as whole
    When the mounts are mounted
    Then boot is "mounted" with ns.jsonld, README.md and schemas/floor.ts, and no .git
    And the lock holds boot as one directory "*" at "boot" from upstream "."
    And the check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::whole-instance_mounts_and_replaying_the_lock_(bean_`nn8e`,_#2462)::19b._a_re-mount_keeps_a_STATE_mount_inside_the_instance_—_never_re-lays_over_it
  Scenario: A re-mount keeps a state mount inside the instance
    Given boot mounted whole, an edited report state-mounted inside it, and its branch-mount marker
    Then the check is "mounted"
    When mounting again
    Then boot is "mounted", the edited report is kept, schemas/floor.ts is there, and the check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::whole-instance_mounts_and_replaying_the_lock_(bean_`nn8e`,_#2462)::19c._a_re-mount_keeps_the_instance's_node_modules_—_an_install_artefact_is_never_the_mount's_to_delete
  Scenario: A re-mount keeps the instance's node_modules
    Given boot mounted whole, then a katex 0.18.10 package written into boot/node_modules
    When mounting again
    Then boot is "mounted", katex 0.18.10 is still there, schemas/floor.ts is there, and the check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::whole-instance_mounts_and_replaying_the_lock_(bean_`nn8e`,_#2462)::20._a_committed_lock_(%s)_replays_on_a_fresh_clone_with_no_declaration_reader,_and_verifies_digests
  Scenario: A committed lock replays on a fresh clone and verifies digests
    Given a lock from a whole mount, copied under "index.lock.json" or "down.mount-lock.json" into a fresh clone with the declaration, and the fixtures served under CAT_MOUNT_URL_PREFIX
    When the lock is replayed
    Then base, boot and core are "mounted", with boot/ns.jsonld and core/scripts/run.ts
    And replaying again, and replaying with --check, are all "current", and the mount check is "mounted"
    And the git corpus holds the mounted files once each, and "*.jsonld" selects only boot/ns.jsonld
    When boot/README.md is edited and the lock replayed
    Then boot is "missing" and the edit is kept

  @test:scripts/tests/remote-mount.test.ts::whole-instance_mounts_and_replaying_the_lock_(bean_`nn8e`,_#2462)::21._a_lock_whose_digest_the_fetched_bytes_do_not_match_is_could-not-determine,_and_nothing_is_kept
  Scenario: A lock whose digest the fetched bytes do not match keeps nothing
    Given a lock for boot alone whose tree digest is all zeros
    When it is replayed on a fresh clone
    Then boot is "could-not-determine" and no boot directory exists

  @test:scripts/tests/remote-mount.test.ts::a_whole_mount_leaves_out_the_opt-in_sub-graphs_the_downstream_has_not_switched_on_(Q-SG-1)::W1._the_paths:_top-level_and_from-within,_outermost_only,_enabled_ones_kept
  Scenario: Switched-off opt-in paths are the outermost ones not enabled
    Given top-level "skills", opt-in "sdlc" and "library", and from within opt-in "library/corpus", "sdlc/skills" and a path climbing out
    Then with nothing enabled the switched-off paths are "library/corpus" and "sdlc"
    And with "ch.sdlc" enabled they are "library/corpus" and "sdlc/skills"
    And with all three enabled, or "all", there are none

  @test:scripts/tests/remote-mount.test.ts::a_whole_mount_leaves_out_the_opt-in_sub-graphs_the_downstream_has_not_switched_on_(Q-SG-1)::W2._mounted,_locked_with_`except`,_checked_clean,_and_replayed_without_them;_enabling_brings_them_back
  Scenario: A whole mount leaves out switched-off opt-in groups, and enabling brings them back
    Given a layer "opt" with schemas/ and an opt-in extra/, mounted whole
    When it is mounted
    Then package.json and schemas/a.ts are there and extra/ is not
    And the lock's "*" directory has except ["extra"], and the check is "mounted"
    When the lock is replayed on a fresh clone
    Then it is "mounted" without extra/, and --check is "current"
    When the downstream enables "opt.extra" and mounts again
    Then extra/big.txt is there and the lock has no except

  @test:scripts/tests/remote-mount.test.ts::a_whole_mount_leaves_out_the_opt-in_sub-graphs_the_downstream_has_not_switched_on_(Q-SG-1)::W3._a_changed_`enableSubgraphs`_is_not_current_per_the_lock,_so_a_plain_mount_lays_the_group_down_(no_`--fresh`)
  Scenario: A changed enableSubgraphs is not current per the lock
    Given "opt" mounted whole with nothing enabled
    Then there is no opt-in drift and the lock reads current as "mounted"
    When "opt.extra" is enabled
    Then the check is still "mounted", the drift says "opt: extra is now switched on", and the lock is neither current nor edited-only
    When mounting again
    Then extra/big.txt is laid down and the lock reads current
    When it is switched off again
    Then the drift says "opt: extra is now switched off" and the lock is not current

  @test:scripts/tests/remote-mount.test.ts::mount_trust_is_recorded,_re-judged_and_scoped_(roast_`1ygp`_L4.2)::22._the_lock_records_the_basis:_consent_with_who,_when_and_approver;_staging_when_--staging
  Scenario: The lock records the trust basis
    When the consented mounts are mounted
    Then core's trust is consent by "test" on "2026-10-07" at the up sha with a declared approver
    And boot's trust is consent at the boot sha
    When an unconsented mount is mounted for staging
    Then every instance's basis is "staging", the check is "mounted", and core's detail says "staging"

  @test:scripts/tests/remote-mount.test.ts::mount_trust_is_recorded,_re-judged_and_scoped_(roast_`1ygp`_L4.2)::23._a_gitlinked_instance_needs_consent_of_its_own:_the_parent's_consent_does_not_cover_it
  Scenario: A gitlinked instance needs consent of its own
    Given a downstream that does not consent to boot
    When the mounts are mounted
    Then core and base are "mounted" and boot is "refused", naming the "gitlink"
    And no boot directory is written and the check is "missing"

  @test:scripts/tests/remote-mount.test.ts::mount_trust_is_recorded,_re-judged_and_scoped_(roast_`1ygp`_L4.2)::24._the_check_re-runs_the_trust_check:_consent_withdrawn_after_the_mount_is_reported,_not_inherited
  Scenario: The check re-runs the trust check
    Given the mounts mounted and checked "mounted"
    When the consent is removed from the declaration
    Then the check is "missing" with core "refused" because consent "no longer holds", and exit code 1

  @test:scripts/tests/remote-mount.test.ts::mount_trust_is_recorded,_re-judged_and_scoped_(roast_`1ygp`_L4.2)::25._a_refused_re-mount_leaves_the_old_bytes_on_disk_but_NOT_presented_as_mounted;_restored_consent_re-mounts
  Scenario: A refused re-mount leaves old bytes on disk but not as mounted
    Given the mounts mounted, then core's consent moved to another sha
    When mounting again
    Then core is "refused", its files stay on disk, it is not in the lock's instances, and it is recorded as unmounted "refused" and left on disk at "core"
    And core is not a mounted instance root, and the check is "missing" saying "still on disk"
    When the consent is restored and mounting again
    Then core is "mounted" and the check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::mount_trust_is_recorded,_re-judged_and_scoped_(roast_`1ygp`_L4.2)::26._approvers:_none_declared_is_UNVERIFIED_(its_own_state,_never_clean);_one_not_on_the_list_is_refused
  Scenario: No approvers is unverified, and an approver not on the list is refused
    Given a downstream declaring no mount approvers
    When the mounts are mounted
    Then the summary is "unverified-approver", core's trust approver is "unverified", the check is "unverified-approver", with exit code 0
    Given a downstream whose approvers are ["someone-else"]
    When the mounts are mounted
    Then core is "refused", naming "mountApprovers"

  @test:scripts/tests/remote-mount.test.ts::index.config.json_as_the_mount_declaration_(owner,_2026-10-07)::27._mounts_declared_only_in_the_index_are_mounted,_locked_as_index.lock.json,_and_ignored_by_the_COMMITTED_block_—_never_info/exclude
  Scenario: Mounts declared only in the index are mounted, locked and ignored by the committed block
    Given a downstream whose mounts are declared only in index.config.json
    When they are mounted
    Then core, base and boot are "mounted", locked in index.lock.json with no legacy lock
    And nothing is excluded and .git/info/exclude is unchanged
    And .gitignore is exactly the committed block listing /core/, /base/ and /boot/
    And the check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::index.config.json_as_the_mount_declaration_(owner,_2026-10-07)::27b._a_need_the_index_mounts_by_its_OWN_entry_is_that_entry's_—_no_`skip`_needed,_none_recorded
  Scenario: A need the index mounts by its own entry belongs to that entry
    Given the index also declares "base" as its own remote entry
    When the mounts are mounted
    Then nothing is "skipped", base is locked via "base" pinned "declared", and nothing is unmounted

  @test:scripts/tests/remote-mount.test.ts::index.config.json_as_the_mount_declaration_(owner,_2026-10-07)::28._without_an_index:_remoteMounts_on_the_declaration,_and_the_SAME_committed_block_from_the_lock_—_never_info/exclude_(owner,_2026-10-09)
  Scenario: Without an index, mounts come from the declaration with the same committed block
    Given a downstream declaring remoteMounts and no index
    Then its declared mounts come from "declaration"
    When they are mounted
    Then nothing is excluded, .git/info/exclude is unchanged, .gitignore is the committed block listing /base/, /boot/ and /core/, and nothing is "missing"

  @test:scripts/tests/remote-mount.test.ts::index.config.json_as_the_mount_declaration_(owner,_2026-10-07)::29._mounts_in_BOTH_the_index_and_the_declaration:_the_check_is_could-not-determine_and_names_both,_the_mount_throws
  Scenario: Mounts in both the index and the declaration are refused
    Given mounts declared in index.config.json and in down.json
    Then the check is "could-not-determine", naming both files
    And mounting throws "BOTH"

  @test:scripts/tests/remote-mount.test.ts::index.config.json_as_the_mount_declaration_(owner,_2026-10-07)::29b._approvers_in_the_index_count_when_the_declaration_has_none;_on_both,_the_mount_throws_(folio-assistant#2389)
  Scenario: Approvers in the index count when the declaration has none
    Given the index's approvers are ["test"] and the declaration has none
    When the mounts are mounted
    Then core is "mounted" with a declared approver, and the check is "mounted"
    And with index approvers ["someone-else"] core is "refused"
    And with approvers in both, mounting throws "mountApprovers in both"

  @test:scripts/tests/remote-mount.test.ts::index.config.json_as_the_mount_declaration_(owner,_2026-10-07)::30._a_legacy_lock_is_RENAMED_onto_index.lock.json_when_the_mount_rewrites_it,_never_left_beside_it
  Scenario: A legacy lock is renamed onto index.lock.json when rewritten
    Given the mounts mounted and the lock moved to down.mount-lock.json
    Then the check is "mounted"
    When mounting again
    Then index.lock.json exists and down.mount-lock.json does not
    When both lock files exist
    Then the check is "could-not-determine" and no mounted instance root is read

  @test:scripts/tests/remote-mount.test.ts::a_changed_lock_re-renders_the_agent_surface::every_agent-surface_generator_exists_beside_remote-mount.ts
  Scenario: Every agent-surface generator exists
    Then every agent-surface generator file exists beside remote-mount.ts

  @test:scripts/tests/remote-mount.test.ts::a_changed_lock_re-renders_the_agent_surface::mount:remote_+_regenerateAgentSurface_writes_nothing_under_a_mounted_instance_and_reports_stale_committed_surfaces_naming_the_layer_(bean_bx4c)
  Scenario: Re-rendering the agent surface writes nothing under a mounted layer and reports its stale surfaces
    Given an index mounting layer "surf" whole, whose committed command and agent memory are stale
    When it is mounted and the agent surface regenerated
    Then surf is "mounted" and the index root gets .claude/commands/hello.md and .agents/rules/agent-memory.md holding "fresh mounted lesson"
    And surf's stale command and memory files are unchanged, the check is "mounted", and replaying with --check is "current"
    And the surface is not ok, every line naming "surf" and "not rewritten"

  # Hydrated mounts (bean mo75 G2): repository o/hy holds layer "hh", which
  # publishes one index.hydrated.jsonld (for tools, plus a child's), and "hb",
  # which publishes one under another subgraph's IRI; o/np builds its subgraph
  # files at publish. Package fetches default to an empty file:// mirror.

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H1._`hydrated:_true`_on_the_entry_lays_down_only_the_published_index.hydrated.jsonld_—_no_code,_no_child_file,_no_declaration
  Scenario: A hydrated mount lays down only the published hydrated file
    Given hh mounted with hydrated true
    Then hh is "mounted" with "hydrated metadata", naming skills and docs as not published at the pin
    And hh/tools/index.hydrated.jsonld has the tools subgraph IRI, and there is no child file, no index.jsonld, no skills and no hh.json
    And no instance root and no mounted instance root is offered for hh
    And the lock marks hh hydrated with one directory "tools" from hh/docs/subgraph/hh/tools holding 1 file, and declaration hh.json
    And the planned directory resolves as a hydrated source for harness hh, subgraph tools, at the pin, by tool "remote-mount"
    And the check is "mounted"
    When the hydrated file is edited
    Then the check is "missing", saying "hh/tools/ modified"

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H2._an_override_chooses_the_subgraphs;_a_named_one_the_pin_does_not_publish_is_missing,_the_rest_mounted
  Scenario: An override chooses the subgraphs; an unpublished one is missing
    Given hh hydrated with directories tools and skills
    When it is mounted
    Then hh is "missing", naming skills with "no index.hydrated.jsonld published there", and the tools file is laid down
    And hh mounted hydrated but overridden hydrated false for tools lays down tools/a/a.ts and hh.json

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H3._a_pin_that_publishes_no_hydrated_file_is_missing,_and_says_the_files_are_built_at_publish_—_never_an_empty_'mounted'
  Scenario: A pin that publishes no hydrated file is missing
    Given np mounted hydrated with no package
    Then np is "missing" saying "builtAtPublish", no np directory exists, and the check is "missing"

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H4._a_hydrated_file_declaring_another_subgraph's_IRI_is_refused,_not_held_as_the_one_asked_for
  Scenario: A hydrated file declaring another subgraph's IRI is refused
    Given hb mounted hydrated
    Then hb is "missing", saying "it was fetched for", and no hb/tools exists

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H5._`whole`_and_`hydrated`_together_are_refused_at_plan_time
  Scenario: whole and hydrated together are refused at plan time
    Given hh overridden with hydrated and whole
    When it is planned
    Then hh is "could-not-determine", saying "keep one"

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H6._the_lock_replays_on_a_fresh_clone:_the_one_file_again,_still_no_declaration,_then_current
  Scenario: A hydrated lock replays on a fresh clone
    Given hh mounted hydrated, and its lock and declaration copied into a fresh clone served under CAT_MOUNT_URL_PREFIX
    When the lock is replayed
    Then hh is "mounted" with the same hydrated file, no hh.json and no tools/a
    And replaying with --check is "current" and the mount check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H7._a_pin_whose_tree_holds_no_index_file_(builtAtPublish)_mounts_it_from_the_pin's_package,_and_the_lock_says_so
  Scenario: A pin with no index file in its tree mounts it from the pin's package
    Given np's subgraph index package published with a tools hydrated file
    When np is mounted hydrated, fetching packages from it
    Then np is "mounted" with "1 from the pin's subgraph index package", naming skills and docs as not published
    And the hydrated file is laid down without index.jsonld or np.json
    And the lock's tools directory names the canonical package URL and member, with a sha256, and the check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H8._a_package_file_declaring_another_subgraph's_IRI_is_refused_like_a_tree_file;_no_package_at_all_keeps_G2's_answer,_naming_where_it_looked
  Scenario: A package file declaring another subgraph's IRI is refused, and no package says where it looked
    Given np's package holds a hydrated file under another IRI
    When np is mounted hydrated from it
    Then np is "missing", saying "it was fetched for", with no np/tools
    When np is mounted hydrated from a release that does not exist
    Then np is "missing", saying "builtAtPublish" and "subgraph index package: absent"

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H9._a_package_that_fails_its_checks_is_never_an_empty_layer
  Scenario: A package that fails its checks is never an empty layer
    Given np's package tarball replaced with other bytes
    When np is mounted hydrated from it
    Then np is "missing", saying "subgraph index package: refused", and no np directory exists

  @test:scripts/tests/remote-mount.test.ts::hydrated_mounts:_metadata_at_the_pin,_no_files_(bean_`mo75`_G2)::H10._the_lock_replays_a_package-sourced_directory_on_a_fresh_clone:_same_bytes,_refused_if_they_change
  Scenario: A package-sourced directory replays on a fresh clone and is refused if the bytes change
    Given np mounted hydrated from its package, and the lock copied into a fresh clone whose prefix serves the repository and release assets
    When the lock is replayed
    Then np is "mounted" with the same bytes and no np.json, and --check is "current"
    When np is removed and the release tarball replaced with other bytes
    Then replaying gives np "could-not-determine", saying "refused", with no file laid down

  # Named ids declared from within (bean mo75 G3): o/nest's "nn" declares
  # skills/, whose skills.json declares "voices" from within; "mm" names
  # voices in its own mountDefaults.

  @test:scripts/tests/remote-mount.test.ts::named_ids_declared_FROM_WITHIN_(bean_`mo75`_G3)::N1._files:_a_nested_id_mounts_its_own_path_alone,_and_the_lock_and_check_agree
  Scenario: A nested id mounts its own path alone
    Given nn overridden with directories ["voices"]
    When it is mounted
    Then nn is "mounted" with skills/voices/v.md, without skills/s or tools
    And the lock's only directory is "voices" at nn/skills/voices, and the check is "mounted"

  @test:scripts/tests/remote-mount.test.ts::named_ids_declared_FROM_WITHIN_(bean_`mo75`_G3)::N2._files:_a_nested_id_beside_a_top-level_one,_through_the_harness's_own_`mountDefaults`_too
  Scenario: A nested id beside a top-level one, and through mountDefaults
    Given nn overridden with directories ["tools", "voices"]
    When it is mounted
    Then tools/a/a.ts and skills/voices/v.md are there and skills/s is not
    And mounting mm with its own defaults lays down mm/skills/voices/v.md and not mm/skills/s

  @test:scripts/tests/remote-mount.test.ts::named_ids_declared_FROM_WITHIN_(bean_`mo75`_G3)::N3._hydrated:_a_nested_id_lays_down_its_own_published_file,_as_a_`hydrated`_source_for_its_nested_path
  Scenario: A hydrated nested id lays down its own published file
    Given nn hydrated with directories ["voices"]
    When it is mounted
    Then nn is "mounted" with skills/voices/index.hydrated.jsonld of the voices IRI, and no v.md
    And the planned directory is "voices" at nn/skills/voices from nn/docs/subgraph/nn/skills/voices, a hydrated source for subgraph "skills/voices"

  @test:scripts/tests/remote-mount.test.ts::named_ids_declared_FROM_WITHIN_(bean_`mo75`_G3)::N4._an_id_declared_nowhere_—_not_in_`<name>.json`,_not_from_within_—_is_refused_at_plan_time_and_says_where_it_looked
  Scenario: An id declared nowhere is refused at plan time
    Given nn overridden with directories ["voices", "choir"], with files and hydrated
    When each is planned
    Then nn is "could-not-determine", saying "`choir` named for mounting but not declared" and "neither in its declaration nor from within"

  # Tools chosen by id (bean mo75 G3): o/tl holds "kit" (mounted whole), "def"
  # (Tool definitions and their published Tools metadata) and "impl" (the code
  # the definitions invoke); o/tlbad adds Tools whose code cannot arrive whole.

  @test:scripts/tests/remote-mount.test.ts::Tools_chosen_by_id,_mounted_runnable_(bean_`mo75`_G3;_owner,_2026-10-24)::T1._load_the_Tools_metadata_(hydrated),_choose_three_Tools_by_id,_materialise_them:_each_arrives_with_definition,_implementation_and_closure,_and_loads
  Scenario: Three Tools chosen from the metadata arrive runnable with their closure
    Given def's Tools metadata mounted hydrated, with no tool code laid down
    When the Tools that run layer code are chosen from it
    Then they are alpha, beta and gamma
    When impl is mounted with def's tools ["alpha", "beta", "gamma"]
    Then impl, def and kit are "mounted", def naming alpha's definition and implementation
    And def holds schemas and tools, impl holds impl-scripts and impl-src, kit holds "*", and def/skills, def/docs, impl/ui and impl/tools are absent
    And the unchosen delta's definition comes with tools/, and the check is "mounted"
    And with workspace links in place each definition loads, and alpha, beta and gamma return "def:shared:alpha", "shared:beta" and "gamma->kit"

  @test:scripts/tests/remote-mount.test.ts::Tools_chosen_by_id,_mounted_runnable_(bean_`mo75`_G3;_owner,_2026-10-24)::T2._a_Tool_with_no_implementation_layer_brings_its_definition_only,_and_names_what_it_runs
  Scenario: A Tool with no implementation layer brings its definition only
    When impl is mounted with def's tools ["delta"]
    Then def names that it "runs `gh pr list`", impl's lock holds no directories, and impl/src is absent

  @test:scripts/tests/remote-mount.test.ts::Tools_chosen_by_id,_mounted_runnable_(bean_`mo75`_G3;_owner,_2026-10-24)::T3._an_id_the_metadata_does_not_hold,_an_import_that_names_nothing_and_a_file_in_no_declared_directory_are_refused_—_and_nothing_of_the_entry_is_mounted
  Scenario: Unknown ids, dangling imports and undeclared files are refused, mounting nothing
    When impl is mounted with def's tools ["alpha", "omega"]
    Then def is "missing", saying "omega" is in none of def's published Tools metadata, and neither def nor impl is written
    And choosing "broken" says its import "names no file at the pin", choosing "stray" says impl/loose.ts "is in no directory `impl` declares", and in each def and impl are "missing" with no impl/src

  @test:scripts/tests/remote-mount.test.ts::Tools_chosen_by_id,_mounted_runnable_(bean_`mo75`_G3;_owner,_2026-10-24)::T5._an_instance_of_ANOTHER_entry_the_closure_reaches_shrinks_to_what_it_needs;_an_explicit_list_wins_(owner,_2026-10-29,_option_B)
  Scenario: Another entry's instance the closure reaches shrinks to what it needs; an explicit list wins
    Given def mounted with tools ["alpha"] and impl mounted by its own entry naming no directories
    When they are mounted
    Then impl is "mounted" with only impl-scripts and impl-src, and no impl/ui
    Given impl's own entry names directories ["impl-src", "impl-ui"]
    When they are mounted
    Then def is "missing" because "the closure needs `impl`'s `impl-scripts`, which its own mount entry (`impl`) does not bring"

  @test:scripts/tests/remote-mount.test.ts::Tools_chosen_by_id,_mounted_runnable_(bean_`mo75`_G3;_owner,_2026-10-24)::T4._`tools`_with_`hydrated`_is_refused_at_plan_time:_metadata_brings_no_code
  Scenario: tools with hydrated is refused at plan time
    Given def overridden with hydrated and tools ["alpha"]
    When it is planned
    Then def is "could-not-determine", saying "`tools` and `hydrated` both asked for"
