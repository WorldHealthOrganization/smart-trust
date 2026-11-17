# scripts/input-sites.ts audits the input sites a check's source reads, schemas/sdlc/input-trace.ts
# traces the sites a run reaches, and scripts/input-hash.ts refuses to fingerprint a check that reads
# what the hash cannot see. Each Scenario names the test that executes it.
Feature: Input-site audit, runtime trace and the fingerprint's refusals

  @test:scripts/tests/input-sites.test.ts::the_scanner::text_in_comments_and_strings_is_not_a_site;_code_is
  Scenario: Text in comments, strings and regexes is not a site, while code is
    Given source with process.env and Date.now() in a line comment, a block comment, a string and a regex
    And process.env inside a template expression and a Date.now() call in code
    When the source is scanned
    Then the only sites are line 4 with risk "env" and line 6 with risk "clock"

  @test:scripts/tests/input-sites.test.ts::the_scanner::a_plain_named_import_is_not_a_site;_a_renamed_or_namespace_import_of_a_risky_module_is
  Scenario: A plain named import is not a site, while a renamed or namespace import of a risky module is
    Given single-line and multi-line plain imports from "node:child_process"
    And a namespace import of "node:child_process" and a renamed import of tmpdir from "node:os"
    When the source is scanned
    Then the sites are on lines 5 and 6 only

  @test:scripts/tests/input-sites.test.ts::the_scanner::regex_`.exec(`_and_`typeof_spawnSync`_are_not_spawns
  Scenario: A regex exec call and typeof spawnSync are not spawns
    Given source calling "re.exec(line)" and naming "ReturnType<typeof spawnSync>"
    When the source is scanned
    Then there are no sites

  @test:scripts/tests/input-sites.test.ts::the_scanner::an_annotation_is_read,_pinned,_and_goes_stale_when_its_statement_changes
  Scenario: An annotation is read with its pin and goes stale when its statement changes
    Given a git ls-files spawn annotated "tree" with its correct pin
    When the source is scanned
    Then the site's verdicts are a single "tree"
    And when the statement is edited to run git log, the site's verdicts are "stale"

  @test:scripts/tests/input-sites.test.ts::the_scanner::a_statement's_pin_covers_its_continuation_lines
  Scenario: A statement's pin covers its continuation lines
    Given two multi-line spawn statements that differ only in a continuation line
    When each statement's pin is taken from its first line
    Then the pins differ

  @test:scripts/tests/input-sites.test.ts::the_scanner::verdicts_parse,_and_a_bad_one_is_malformed_rather_than_accepted
  Scenario: Verdicts parse, and a bad one is malformed rather than accepted
    When "env A,B; tree" is parsed
    Then it yields an env verdict naming "A" and "B" and a tree verdict
    And "refs origin/main" yields a refs verdict naming "origin/main"
    And "vibes", a bare "env" and "tree x" each yield an error
    And a site annotated "vibes" is malformed with "unknown verdict"

  @test:scripts/tests/input-sites.test.ts::the_scanner::`traced`_needs_the_inputSiteReached()_hook_directly_above_the_site,_and_the_hook_needs_`traced`
  Scenario: A traced verdict needs the inputSiteReached hook directly above the site, and the hook needs traced
    Given a Date.now() site annotated "traced" with the inputSiteReached hook above it
    When it is scanned
    Then its verdicts are a single "traced"
    And the same annotation without the hook is malformed, naming "inputSiteReached"
    And the hook under an "inert" annotation is malformed, naming "traced"

  @test:scripts/tests/input-sites.test.ts::the_scanner::an_`if_(import.meta.main)_{_…_}`_block_is_found_on_the_blanked_source
  Scenario: An import.meta.main block is found on the blanked source
    Given source with an "if (import.meta.main)" block containing a string holding "}"
    When the main-block lines of the blanked source are found
    Then they are lines 1 to 4

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::a_clean_closure_hashes
  Scenario: A clean import closure hashes
    Given a git fixture whose check script imports a library with no sites
    When the check's fingerprint is taken
    Then it is a hash

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::an_UNANNOTATED_site_anywhere_in_the_import_closure
  Scenario: An unannotated site anywhere in the import closure is refused
    Given the library reads "process.env.SECRET_SWITCH" without an annotation
    When the check's fingerprint is taken
    Then it is undetermined with "unannotated input site at scripts/lib.ts:1 (env)"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::a_STALE_pin
  Scenario: A stale input-site pin is refused
    Given the library has a git spawn annotated "tree" with a wrong pin
    When the check's fingerprint is taken
    Then it is undetermined with "stale input-site pin"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::an_unannotated_non-literal_dynamic_import
  Scenario: An unannotated non-literal dynamic import is refused
    Given the library imports a template-literal path
    When the check's fingerprint is taken
    Then it is undetermined with "non-literal dynamic import"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::a_non-TypeScript_script,_whose_reads_cannot_be_audited
  Scenario: A non-TypeScript script is refused because its reads cannot be audited
    Given a check script that runs a shell script
    When its fingerprint is taken
    Then it is undetermined with "not TypeScript/JavaScript"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::a_`tree`_site_under_a_narrow_(non-{tracked})_declaration
  Scenario: A tree site is refused under a narrow declaration
    Given the library has a git ls-files spawn annotated "tree"
    When the fingerprint is taken with the {tracked} input declaration
    Then it is a hash
    And with a "src/**/*.md" input declaration it is undetermined with "only a {tracked} declaration covers"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::an_`env-unset`_variable_that_is_set
  Scenario: An env-unset variable that is set is refused
    Given the library reads "F017_OUTSIDE" annotated "env-unset F017_OUTSIDE"
    When the fingerprint is taken with the variable unset
    Then it is a hash
    And with the variable set it is undetermined with "$F017_OUTSIDE is set"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::a_site_in_an_`import.meta.main`_block_counts_when_the_file_is_the_ENTRY,_not_when_it_is_imported
  Scenario: A site in an import.meta.main block counts only in the entry file
    Given the entry script and the library each have a Date.now() site inside an import.meta.main block
    When the fingerprint is taken
    Then it is undetermined with "scripts/c.ts:3 (clock)"
    And once the entry script has no such block, it is a hash

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::an_`import_type`_is_not_followed,_a_value_import_is
  Scenario: An import type is not followed, while a value import is
    Given a module "scripts/risky.ts" with a type and a Date.now() site
    When the entry imports only its type, the fingerprint is a hash
    And when the entry imports its value, it is undetermined with "scripts/risky.ts:2 (clock)"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::`imports`_and_`scripts`_targets_join_the_closure_and_are_audited_too
  Scenario: Targets of imports and scripts annotations join the closure and are audited
    Given the library has a computed require annotated "imports plugins/*.ts"
    And "plugins/p.ts" has a Date.now() site
    Then the fingerprint is undetermined with "plugins/p.ts:1 (clock)"
    And once the plugin has no site, it is a hash
    And a spawn annotated "scripts r:check", whose script has a Date.now() site, is undetermined with "scripts/r.ts:1 (clock)"
    And a spawn annotated "scripts nope" is undetermined with "does not resolve"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::the_fingerprint_HASHES_what_a_verdict_names::an_`env`_variable's_value
  Scenario: The value of an env variable named by a verdict is hashed
    Given the library reads "F017_MODE" annotated "env F017_MODE"
    When the fingerprint is taken with the variable unset, set to "a" and set to empty
    Then the three hashes all differ

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::the_fingerprint_HASHES_what_a_verdict_names::`head`:_a_new_commit_moves_the_hash_although_the_tree_did_not
  Scenario: A head verdict moves the hash on a new commit although the tree did not change
    Given the library runs git log annotated "head" and is committed
    When an empty commit is made
    Then the fingerprint's hash changes

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::the_fingerprint_HASHES_what_a_verdict_names::`refs`:_a_moved_ref_moves_the_hash;_a_missing_one_is_hashed_as_missing
  Scenario: A refs verdict moves the hash when the ref appears, and hashes a missing ref
    Given the library runs git log on "f017-ref" annotated "refs f017-ref" and is committed
    When the fingerprint is taken before the ref exists
    Then it is a hash
    And after branch "f017-ref" is created, the hash differs

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::the_fingerprint_HASHES_what_a_verdict_names::an_IGNORED_file_under_{tracked}_—_a_walker_reads_it_whether_or_not_git_does
  Scenario: An ignored file under {tracked} is hashed
    Given a git-ignored file "ignored/data.json"
    When its content changes
    Then the fingerprint's hash changes

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::the_fingerprint_HASHES_what_a_verdict_names::a_BUILD_OUTPUT_directory_is_not_hashed_—_and_naming_one_in_source_is_a_site
  Scenario: A build output directory is not hashed, and naming one in source is a site
    Given a file "build/report.json"
    When its content changes
    Then the fingerprint's hash is unchanged
    And once the library reads "build/report.json", it is undetermined with "scripts/lib.ts:1 (build)"

  @test:scripts/tests/input-sites.test.ts::the_fingerprint_refuses_what_it_cannot_see::the_fingerprint_HASHES_what_a_verdict_names::the_input-hash_cache_itself_is_not_an_input
  Scenario: The input-hash cache itself is not an input
    Given a fingerprint of the fixture
    When "build/regen-cache/input-hashes.json" and a trace log under it are written
    Then the fingerprint's hash is unchanged

  @test:scripts/tests/input-sites.test.ts::the_runtime_trace::a_run_that_reaches_no_traced_site_reports_nothing
  Scenario: A run that reaches no traced site reports nothing
    Given an open trace
    When a child process run with the trace's environment reaches no hook
    Then the trace reports nothing reached

  @test:scripts/tests/input-sites.test.ts::the_runtime_trace::a_run_that_reaches_one_reports_it,_through_a_child_process's_inherited_environment
  Scenario: A run that reaches a traced site reports it through a child's inherited environment
    Given an open trace
    When a child process run with the trace's environment calls inputSiteReached("network")
    Then the trace reports "network"

  @test:scripts/tests/input-sites.test.ts::the_runtime_trace::a_qa-reports_read_is_tolerated_only_for_a_ref_whose_baseline_the_fingerprint_hashed
  Scenario: A qa-reports read is tolerated only for a ref whose baseline was hashed
    Given a child that reaches the qa-reports line for ref "main"
    Then the trace reports nothing when "main" was hashed
    And it reports the "main" line when no ref was hashed
    And a child reaching the line for "pr/7" is reported when only "main" was hashed

  @test:scripts/tests/input-sites.test.ts::the_runtime_trace::quietly()_silences_the_parts_of_a_reader_that_already_reported_itself
  Scenario: quietly() silences a reader's parts that already reported themselves
    Given a child that reaches the qa-reports line for "main" and then, inside quietly(), "branch-store x"
    When the trace is read with "main" hashed
    Then it reports nothing

  @test:scripts/tests/input-sites.test.ts::the_runtime_trace::without_the_variable_set,_the_hook_writes_nothing_anywhere
  Scenario: Without the trace variable set, the hook writes nothing anywhere
    Given a trace opened under a scratch root
    And a child process, run from that root, whose environment lacks the trace variable
    When the child calls inputSiteReached directly and inside quietly()
    Then the child exits 0
    And the trace reports nothing reached
    And the scratch root holds only the empty trace directory and the child's source
    When the same child runs with the trace variable set
    Then the trace reports "nothing to see"

  @test:scripts/tests/input-sites.test.ts::annotations_hold_to_the_data_that_chooses_their_targets::every_instance_a_loader_can_reach_is_one_level_below_the_checkout,_where_the_`*/`_globs_look
  Scenario: Every instance a loader can reach is one level below the checkout
    Given the checkout's instance roots and their declared dependencies
    Then each is the checkout itself or a direct child directory of it

  @test:scripts/tests/input-sites.test.ts::annotations_hold_to_the_data_that_chooses_their_targets::every_qa-checker_and_pipeline-plugin_ref_is_a_module_harness-config's_`declared_plugin-tables`_names
  Scenario: Every qa-checker and pipeline-plugin ref names a module listed by the plugin-tables declaration
    Given every qa-checkers and pipeline-plugins node with a check or implementation ref to an existing module
    When the ref is resolved against the deepest root that holds the node
    Then the module is one the "plugin-tables" declaration names
    And schemas/kg/harness-config.ts carries a "declared" annotation with source "plugin-tables"

  @test:scripts/tests/input-sites.test.ts::annotations_hold_to_the_data_that_chooses_their_targets::every_declared_validator_module,_from_any_root_a_caller_passes,_is_one_`declared_validator-refs`_names
  Scenario: Every declared validator module, from any caller's root, is listed by the validator-refs declaration
    Given every kind's validator and node-schema validator refs in the typology registry
    When each is resolved against the checkout and every reachable layer root
    Then at least one resolves to an existing module
    And each one that does is named by the "validator-refs" declaration
    And kind-validator.ts and node-kind-index.ts each carry a "declared" annotation with source "validator-refs"

  @test:scripts/tests/input-sites.test.ts::annotations_hold_to_the_data_that_chooses_their_targets::every_instance_themes_module_lies_under_theme-by-ref's_`imports`_glob
  Scenario: Every instance themes module lies under theme-by-ref's imports glob
    Given every reachable root's themes directories
    Then each existing themes module matches "*/themes/themes.ts"
    And schemas/ui/theme-by-ref.ts carries an "imports" annotation with that glob

  @test:scripts/tests/input-sites.test.ts::annotations_hold_to_the_data_that_chooses_their_targets::skill-register's_`scripts`_annotation_names_exactly_the_verify_half_of_its_STEPS
  Scenario: skill-register's scripts annotation names exactly the verify half of its STEPS
    Given the verify scripts of every step in skill-register.ts's STEPS
    When skill-register.ts is scanned for "scripts" verdicts
    Then there is at least one
    And each names exactly the verify scripts

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::outsideTemplates_blanks_template_text_only,_and_only_on_a_balanced_lex
  Scenario: outsideTemplates blanks template text only, and only on a balanced lex
    Given source with an import, a comment and a template literal holding an import and an expression
    When template text is blanked
    Then the import from "./a.ts" and the expression "f(\"./k\")" remain
    And the "./w.ts" text inside the template is gone
    And source with an unclosed template is returned unchanged

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::an_import_inside_a_template_literal_is_the_text_of_a_written_file,_not_an_edge;_a_literal_unresolvable_one_still_blocks
  Scenario: An import written inside a template literal is not an edge, while an unresolvable literal one blocks
    Given a module whose template literal writes an "export * from" line
    And a module whose template literal writes an import line
    When each closure is audited
    Then each closure holds only its own file
    And a module with a real "export * from \"./nowhere\"" is undetermined with "imports unresolvable ./nowhere"

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::a_closure_is_memoised_per_file_and_re-read_after_an_edit
  Scenario: A closure is memoised per file and re-read after an edit
    Given a module "a.ts" with no site, audited with a memo
    When it is edited to call Date.now() and audited again with the same memo
    Then the second audit is undetermined
    And the entry files of a script "bun run a.ts" are "a.ts"

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::a_`declared`_load_reaches_exactly_what_its_source_names,_kept_apart_as_computed_and_still_audited
  Scenario: A declared load reaches exactly what its source names, kept apart as computed and still audited
    Given a module with a computed import annotated "declared kinds", where "kinds" names "v1.ts"
    And "v1.ts" imports "dep.ts" and "shared.ts", and "v2.ts" sits beside it unnamed
    When the closure is audited
    Then its files are "a.ts", "dep.ts", "shared.ts" and "v1.ts"
    And its computed files are "dep.ts" and "v1.ts"
    And once "dep.ts" calls Date.now(), the audit is undetermined with "dep.ts:1 (clock)"
    And with no resolver for the source, it is undetermined with "declaration source kinds"

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::a_module_reached_statically_after_a_computed_load_is_not_computed
  Scenario: A module reached statically after a computed load is not computed
    Given a computed load annotated "imports v.ts" walked before a static import chain reaching "v.ts"
    When the closure is audited
    Then its files are "a.ts", "v.ts", "w.ts" and "z.ts"
    And nothing is computed

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::a_traced_fingerprint_does_not_hash_a_computed_target;_an_untraced_one_does
  Scenario: A traced fingerprint does not hash a computed target, while an untraced one does
    Given a check whose computed load is annotated "imports v.ts"
    When "v.ts" changes
    Then the fingerprint with the tree replayed keeps its hash
    And the fingerprint without it changes its hash

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::a_traced_fingerprint_defers_a_computed_target_unscanned;_an_untraced_one_still_refuses_its_unreviewed_site
  Scenario: A traced fingerprint defers an unscanned computed target, while an untraced one refuses its site
    Given a check whose computed load targets "v.ts", which reads process.env.SOME_VAR
    When the fingerprint is taken with the tree replayed
    Then it is a hash deferring "v.ts"
    And without the tree replayed it is undetermined, naming "v.ts"

  @test:scripts/tests/input-sites.test.ts::the_audit_walks_only_what_can_run::every_runtime_module_under_schemas/_is_input-site_annotated_after_8lcl_(cat-harness-tools#634)
  Scenario: Every runtime module under schemas/ is input-site annotated
    Given every non-test TypeScript module under this layer's schemas/
    When each is scanned
    Then no site is unannotated, stale or malformed

  @test:scripts/tests/input-sites.test.ts::the_test_scratch-dir_rule_(owner,_2026-11-05)::tmpdir()_in_a_test_file_needs_no_annotation:_it_is_inert
  Scenario: tmpdir() in a test file needs no annotation
    Given a test file line creating a scratch dir under tmpdir()
    When it is scanned
    Then it has one site, with verdict "inert"

  @test:scripts/tests/input-sites.test.ts::the_test_scratch-dir_rule_(owner,_2026-11-05)::the_same_line_outside_a_test_file_still_needs_one
  Scenario: The same tmpdir() line outside a test file still needs an annotation
    Given a non-test file line creating a scratch dir under tmpdir()
    When it is scanned
    Then its site has no verdict

  @test:scripts/tests/input-sites.test.ts::the_test_scratch-dir_rule_(owner,_2026-11-05)::homedir(),_or_tmpdir()_beside_another_risk,_still_needs_one_in_a_test
  Scenario: homedir(), or tmpdir() beside another risk, still needs an annotation in a test
    Given test file lines calling homedir(), joining tmpdir() with homedir(), and joining tmpdir() with process.env.HOME
    When each is scanned
    Then its site has no verdict

  @test:scripts/tests/input-sites.test.ts::the_test_git-spawn_rule::a_spawn_of_a_literal_git_in_a_test_file_is_`tree`,_which_only_the_cone's_replay_answers
  Scenario: A spawn of a literal git in a test file is a tree site
    Given test file lines spawning "git" with Bun.spawnSync, execFileSync and spawnSync
    When each is scanned
    Then each has the single verdict "tree"

  @test:scripts/tests/input-sites.test.ts::the_test_git-spawn_rule::outside_a_test_file,_beside_another_spawn,_or_with_any_other_risk,_it_still_needs_one
  Scenario: A git spawn outside a test file, beside another spawn, or with another risk still needs an annotation
    Given a git spawn in a non-test file
    And, in a test file, a git spawn beside a "sh" spawn, a spawn of a variable command, a spawn of "gitx" and a git spawn passing process.env
    When each is scanned
    Then each site has no verdict

  @test:scripts/tests/input-sites.test.ts::the_test_bun-spawn_rule::a_spawn_of_bun_itself_in_a_test_file_is_`spawned`;_beside_git,_also_`tree`
  Scenario: A spawn of bun or python in a test file is spawned, and beside git also tree
    Given test file lines spawning "bun", process.execPath, "python3" and "python"
    When each is scanned
    Then each has the single verdict "spawned"
    And a bun spawn beside a git spawn has the verdicts "spawned" and "tree"

  @test:scripts/tests/input-sites.test.ts::the_test_bun-spawn_rule::outside_a_test_file,_or_beside_another_program,_it_still_needs_one
  Scenario: A bun spawn outside a test file, or beside another program, still needs an annotation
    Given a bun spawn in a non-test file
    And, in a test file, a bun spawn beside a "ruby" spawn and a spawn of "bunx"
    When each is scanned
    Then each site has no verdict

  @test:scripts/tests/input-sites.test.ts::the_test_env-write_and_build-path_rules::process.env_written,_deleted_or_spread_whole_into_a_child_is_inert_in_a_test
  Scenario: Writing, deleting or spreading process.env in a test is inert
    Given test file lines assigning process.env[VAR], deleting process.env.CAT_MOUNT_URL_PREFIX and spreading process.env into a child's env
    When each is scanned
    Then each has the single verdict "inert"

  @test:scripts/tests/input-sites.test.ts::the_test_env-write_and_build-path_rules::a_value_read_from_process.env_still_needs_one,_in_a_test_or_not
  Scenario: A value read from process.env still needs an annotation, in a test or not
    Given test file lines reading process.env.X, copying process.env.B into process.env.A, and comparing process.env.A
    When each is scanned
    Then each site has no verdict
    And assigning process.env[VAR] in a non-test file has no verdict

  @test:scripts/tests/input-sites.test.ts::the_test_env-write_and_build-path_rules::a_build_directory_named_in_a_test_is_inert:_the_cone's_read_set_records_what_the_test_opens_there
  Scenario: A build directory named in a test is inert
    Given a line joining "build" and "derive-cache"
    When it is scanned in a test file
    Then it has the single verdict "inert"
    And in a non-test file it has no verdict

  @test:scripts/tests/input-sites.test.ts::an_explicit_`spawned`_verdict,_in_a_module::annotates_a_python3_or_bun_child,_inline_or_a_script
  Scenario: An explicit spawned verdict annotates a python3 or bun child
    Given module lines spawning "python3" inline, "bun" with a script, and process.execPath, each annotated "spawned"
    When each is scanned
    Then each has the single verdict "spawned"

  @test:scripts/tests/input-sites.test.ts::an_explicit_`spawned`_verdict,_in_a_module::is_malformed_on_any_other_spawn
  Scenario: An explicit spawned verdict is malformed on any other spawn
    Given module lines annotated "spawned" that spawn "curl", argv[0], or "python3" alongside "node"
    When each is scanned
    Then each is malformed with "`spawned` is for a spawn of"

  @test:scripts/tests/input-sites.test.ts::an_explicit_`spawned`_verdict,_in_a_module::is_still_implicit_nowhere_but_a_test_file
  Scenario: A python3 spawn in a module is not implicitly spawned
    Given an unannotated python3 spawn in "scripts/x.ts"
    When it is scanned
    Then its site has no verdict

  @test:scripts/tests/input-sites.test.ts::an_explicit_`spawned`_verdict,_in_a_module::a_git_spawn_alone_is_no_child_spawn
  Scenario: A git spawn alone is no child spawn
    When isChildSpawn is asked about a python3 spawn
    Then it is true
    And for a git spawn it is false

  @test:scripts/tests/input-sites.test.ts::annotations_hold_to_the_data_that_chooses_their_targets::every_Tool's_in-process_registrar_is_a_module_tool-api's_`declared_tool-registrars`_names
  Scenario: Every Tool's in-process registrar is listed by the tool-registrars declaration
    Given every Tool in every instance root with an MCP invocation and an in-process module
    When the module is resolved as tool-api's MCP tool list resolves it
    Then the "tool-registrars" declaration lists modules
    And each resolved module is one it names
    And scripts/tool-api.ts carries a "declared" annotation with source "tool-registrars"
