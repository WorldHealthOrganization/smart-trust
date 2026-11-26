# scripts/init-folio.ts (folio_init) scaffolds a folio or a contentless instance: slug checks, the files and workflows it writes, safe re-runs, state graphs and remote link mode.
# The end-to-end scenarios scaffold into a temp directory, link the platform and render. Each Scenario names the test that executes it.
Feature: init-folio scaffolds a working folio or instance

  @test:scripts/tests/init-folio.test.ts::slug_validation::accepts_lowercase_hyphen-joined_words
  Scenario: A lowercase hyphen-joined slug is valid
    Given the slugs "cold-chain-guidance", "qou" and "l2-dak"
    When each is checked with isValidSlug
    Then each is valid

  @test:scripts/tests/init-folio.test.ts::slug_validation::rejects_what_breaks_as_a_directory,_a_module_name_or_a_URL_path
  Scenario: A slug that breaks as a directory, module name or URL path is invalid
    Given the slugs "Cold Chain", "cold_chain", "-lead", "trail-", "double--hyphen", "", "a/b" and "Ünïcode"
    When each is checked with isValidSlug
    Then each is invalid

  @test:scripts/tests/init-folio.test.ts::slug_validation::a_reserved_slug_is_refused_rather_than_silently_undiscovered
  Scenario: A reserved slug is refused
    Given an empty folio directory
    When initFolio is asked to scaffold slug "schema" or "pipeline"
    Then it throws saying the slug is reserved

  @test:scripts/tests/init-folio.test.ts::slug_validation::an_invalid_slug_names_all_three_things_it_has_to_be
  Scenario: An invalid slug's error says what a slug has to be
    # Gap: only the "directory name" part of the message is asserted
    Given an empty folio directory
    When initFolio is asked to scaffold slug "Cold Chain"
    Then it throws naming "directory name"

  @test:scripts/tests/init-folio.test.ts::slug_validation::slugify_derives_one_from_a_title
  Scenario: slugify derives a slug from a title
    Given the titles "Cold Chain Guidance" and "WHO ANC (2016) — Recommendations!"
    When each is slugified
    Then they become "cold-chain-guidance" and "who-anc-2016-recommendations"

  @test:scripts/tests/init-folio.test.ts::required_inputs::an_empty_author_list_is_refused,_not_defaulted
  Scenario: An empty author list is refused
    Given an empty folio directory
    When initFolio is called with no authors
    Then it throws naming the author

  @test:scripts/tests/init-folio.test.ts::what_gets_written::a_DOCUMENT_folio's_staging_caller_is_ON_and_builds_with_build-document-site_(fyu2)
  Scenario: A document folio's staging workflow is on and builds with build-document-site
    Given an empty folio directory
    When a document folio is scaffolded
    Then .github/workflows/staging.yml calls the folio-staging.yml reusable workflow at main
    And it runs on pull_request, on issue_comment with "issues: read", and on push to main
    And it builds with "folio-assistant-core/scripts/build-document-site.ts --out _site"
    And the notes do not say staging is "wired but OFF"
    And the .gitignore contains "_site/"

  @test:scripts/tests/init-folio.test.ts::what_gets_written::a_new_folio_declares_a_todos_graph_with_a_feedback_directory,_so_a_review_decision_has_somewhere_to_go_(423d,_c4rz)
  Scenario: A new folio declares a todos graph with a feedback directory
    Given a folio directory whose config overrides both state graphs to directory sources
    When a document folio is scaffolded
    Then todos/todos.json has a todo-feedback node at path "feedback"
    And the scaffold's config sets feedbackDir to "todos/feedback"
    And every directory the todos graph declares exists

  @test:scripts/tests/init-folio.test.ts::what_gets_written::a_folio_in_a_SUBFOLDER_of_a_repository_gets_no_workflow_GitHub_would_never_read,_and_is_told_why_(zdfa)
  Scenario: A folio in a repository subfolder gets no staging workflow and is told why
    Given a git repository with a target folder guides/handbook inside it
    When a document folio is scaffolded there without skipping version control
    Then enclosingRepoRoot finds the enclosing repository
    And no .github/workflows/staging.yml is written
    And the notes say GitHub "cannot stage a folio below it"
    And no nested .git is created, and the notes say "no git init"

  @test:scripts/tests/init-folio.test.ts::what_gets_written::a_folio_at_its_repository's_root_is_not_enclosed_(zdfa)
  Scenario: A folio at its repository's root is not enclosed
    Given an empty folio directory
    Then enclosingRepoRoot returns null for it
    And after git init in that directory it still returns null

  @test:scripts/tests/init-folio.test.ts::what_gets_written::a_PAPER_folio's_staging_caller_is_OFF:_dispatch-only,_and_its_build_refuses_until_set_(ojcx)
  Scenario: A paper folio's staging workflow is off until set
    # Skipped: when no paper folio-template profile is held in the checkout
    Given an empty folio directory
    When a paper folio is scaffolded
    Then staging.yml has no pull_request, issue_comment or push trigger
    And its build contains "exit 1"
    And the notes say "Staging previews are wired but OFF"

  @test:scripts/tests/init-folio.test.ts::what_gets_written::every_file_the_layout_needs,_and_no_subject_matter
  Scenario: A scaffold writes every file the layout needs
    # Gap: "no subject matter" is not asserted, only that the listed files are written
    Given an empty folio directory
    When a document folio "cold-chain-guidance" is scaffolded
    Then no separate <slug>.config.json is written
    And index.config.json, .mcp.json, .beans.yml, the folio/schema shims, the book, chapter and overview block files, uploads/README.md, library/README.md, AGENTS.md, CLAUDE.md, GEMINI.md and the staging workflow are each created and exist

  @test:scripts/tests/init-folio.test.ts::what_gets_written::the_builder_shim_is_the_only_place_the_platform_path_is_written
  Scenario: Only the builder shim names the platform path
    Given an empty folio directory
    When a folio is scaffolded with assistant path "vendor/fa"
    Then folio/schema/builders.ts imports from "../../vendor/fa/cat-harness-tools/schemas/builders"
    And the book manifest imports "../schema/builders" and does not mention "vendor/fa"

  @test:scripts/tests/init-folio.test.ts::what_gets_written::AGENTS.md_tells_a_document_folio_which_kinds_it_may_not_use
  Scenario: A document folio's AGENTS.md names the kinds it may not use
    # Gap: only checks the words appear, not that they are presented as forbidden
    Given a scaffolded document folio
    When its AGENTS.md is read
    Then it mentions "normative-statements", "theorem", "lemma" and "proof"

  @test:scripts/tests/init-folio.test.ts::what_gets_written::CLAUDE.md_and_GEMINI.md_are_stubs_pointing_at_AGENTS.md
  Scenario: CLAUDE.md and GEMINI.md are short stubs pointing at AGENTS.md
    Given a scaffolded folio
    When CLAUDE.md and GEMINI.md are read
    Then each mentions "AGENTS.md"
    And each is shorter than 400 characters

  @test:scripts/tests/init-folio.test.ts::what_gets_written::a_paper_folio_gitignores_Lean_artifacts;_a_document_folio_does_not
  Scenario: A paper folio gitignores Lean artifacts and a document folio does not
    # Skipped: when no paper folio-template profile is held in the checkout
    Given a scaffolded paper folio and a scaffolded document folio
    Then the paper folio's .gitignore contains ".lake/"
    And the document folio's .gitignore does not

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::a_DOCUMENT_folio_gets_the_three_generic_workflows_and_none_of_the_Lean_ones
  Scenario: A document folio gets the generic workflows and none of the Lean ones
    Given an empty folio directory
    When a document folio is scaffolded
    Then qa-sweep.yml, qa-sweep-nightly.yml, section-title-audit.yml and site-publish.yml are created
    And none of the Lean workflows blueprint.yml, lean-build.yml, lean-build-sidecar.yml or lean_ci.yml exist
    And none of the Lean support action or scripts exist

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::a_PAPER_folio_gets_the_generic_workflows_AND_the_Lean_ones,_with_what_they_call
  Scenario: A paper folio gets the generic and Lean workflows with their support files
    # Skipped: when no paper folio-template profile is held in the checkout
    Given an empty folio directory
    When a paper folio is scaffolded
    Then all four generic and four Lean workflows are created
    And the lake-cache-restore action and the five .github/scripts Python files are created

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::the_Lean_workflows'_local_action_and_scripts_are_ones_the_scaffold_wrote
  Scenario: The Lean workflows' local actions and scripts were written by the scaffold
    # Skipped: when no paper folio-template profile is held in the checkout
    Given a scaffolded paper folio
    When each Lean workflow is scanned for local "uses: ./.github/actions/..." and "python3 .github/scripts/..." references
    Then each referenced action has an action.yml and each referenced script exists in the folio

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::nothing_written_names_one_folio's_papers,_and_no_placeholder_is_left
  Scenario: Written workflows name no folio's papers and leave no placeholder
    # Skipped: when no paper folio-template profile is held in the checkout
    Given a document folio and a paper folio, each scaffolded with assistant path "vendor/fa"
    When every file written under .github/ is read
    Then there is at least one, none mentions "qou", and none has a template placeholder left
    And qa-sweep.yml contains 'folio: "folio"'
    And qa-sweep-nightly.yml still contains GitHub's "${{ inputs.axes }}" expression

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::every_platform_file_a_scaffolded_folio_runs_EXISTS_in_the_index_(bean_cat-tools-yylt)
  Scenario: Every platform file a scaffolded folio runs exists
    Given a document folio and a paper folio, each scaffolded with assistant path "vendor/fa"
    When every vendor/fa script path and every named cat-harness-tools reusable workflow is collected from the written files
    Then at least one path is found
    And each exists in this checkout

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::the_QA_working_copy_is_ignored,_so_a_folio_commits_no_derived_verdict_(bean_5qy8)
  Scenario: The QA working copy is gitignored
    Given a scaffolded document folio
    Then its .gitignore has a line "test/results/"

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::a_freshly_initialised_folio_publishes_QA_sweep_verdicts_to_its_own_qa-reports_branch_(beans_5qy8,_7mwa)
  Scenario: A new folio publishes QA sweep verdicts to its own store
    # Gap: the qa-reports branch name itself is not asserted
    Given a scaffolded document folio
    When qa-sweep.yml and qa-sweep-nightly.yml are read
    Then each grants contents write permission
    And each calls the matching folio-qa-sweep reusable workflow of cat-harness-tools at main
    And each reusable workflow publishes through scripts/qa-store.ts publish

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::an_unknown_placeholder_is_refused,_not_written_through
  Scenario: An unknown template placeholder is refused
    Given the placeholder values assistant, folio, platform_git and platform_repo
    When "run: {{assistant}}/x ${{ github.ref }}" is rendered
    Then it becomes "run: a/x ${{ github.ref }}"
    And rendering "run: {{nope}}" throws "unknown template placeholder"

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::every_template_parses_as_YAML,_before_and_after_substitution
  Scenario: Every workflow template parses as YAML before and after substitution
    # Skipped: when no paper folio-template profile is held in the checkout
    Given the paper profile's .yml templates, at least nine of them
    When each is parsed raw and after rendering
    Then the raw template parses
    And the rendered template has a string name

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::the_templates_come_from_the_declared_directory,_not_a_path_written_in_code
  Scenario: Templates come from the declared folio-templates directory
    Given the declared templates directory
    Then it holds a "document" profile
    And it is the first of the templates directories
    And no document template targets a path containing "lean"

  @test:scripts/tests/init-folio.test.ts::workflow_templates_(52dz)::the_paper_profile_is_a_member_a_dependent_layer_holds,_found_across_the_checkout
  Scenario: The paper profile is held by a dependent layer found across the checkout
    # Skipped: when folio-assistant-sci is not in the checkout
    Given the templates directories across the checkout
    Then one of them holds a "paper" profile

  @test:scripts/tests/init-folio.test.ts::re-running_is_safe::existing_files_are_skipped,_not_overwritten
  Scenario: A re-run skips existing files rather than overwriting them
    Given a scaffolded folio whose AGENTS.md was then edited by its author
    When initFolio runs again
    Then nothing is created and AGENTS.md is listed as skipped
    And AGENTS.md keeps the author's text

  @test:scripts/tests/init-folio.test.ts::re-running_is_safe::force_overwrites,_and_says_so
  Scenario: Force overwrites existing files
    # Gap: that the run says it overwrote is not asserted
    Given a scaffolded folio whose AGENTS.md was then edited by its author
    When initFolio runs again with force
    Then nothing is skipped
    And AGENTS.md again contains "This is a **folio**"

  @test:scripts/tests/init-folio.test.ts::re-running_is_safe::a_dry_run_writes_nothing_but_reports_everything
  Scenario: A dry run writes nothing but reports what it would create
    Given an empty folio directory
    When initFolio runs as a dry run
    Then more than 10 files are reported as created
    And no config file and no folio directory exist

  @test:scripts/tests/init-folio.test.ts::re-running_is_safe::a_missing_platform_is_reported,_not_left_to_fail_at_import_time
  Scenario: A missing platform is reported in the notes
    Given an empty folio directory with no platform linked
    When initFolio runs
    Then the notes say the platform "does not exist yet"

  @test:scripts/tests/init-folio.test.ts::the_scaffolded_folio_actually_builds::renders_to_Markdown_with_no_issues,_through_its_own_shim
  Scenario: The scaffolded folio renders to Markdown through its own shim
    Given a scaffolded document folio with the platform linked at folio-assistant
    When buildDocumentMarkdown renders its book manifest
    Then there are no issues, 1 block and the chapter "introduction"
    And the Markdown has "# Cold Chain Guidance", "## Introduction" and "### Overview"
    And it contains the starter text "unit of authorship" and no "Missing block"

  @test:scripts/tests/init-folio.test.ts::the_scaffolded_folio_actually_builds::the_scaffolded_document_folio_conforms_to_its_own_declared_profile
  Scenario: The scaffolded document folio conforms to its declared profile
    Given a scaffolded document folio with the platform linked at folio-assistant
    When checkFolioProfile checks it
    Then the profile is "document", declared by the index.config.json entry "cold-chain-guidance"
    And 1 block is checked with no violations

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::writes_every_instance-level_artefact,_and_nothing_an_adapter_owns
  Scenario: A contentless instance writes every instance-level artefact and nothing an adapter owns
    Given an empty directory
    When initInstance scaffolds "cold-chain-guidance"
    Then the declaration, index.config.json, .mcp.json, .claude/settings.json, .gitignore, .beans.yml, README.md, AGENTS.md, CLAUDE.md, GEMINI.md and the publish-context and publish-qa workflows are created
    And no folio, uploads or library directory exists and nothing under folio/ is created
    And the only .github files are publish-context.yml and publish-qa.yml

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::the_publish-qa_workflow_calls_the_tools_layer's_QA_publisher_for_THIS_instance,_on_main_and_on_pull_requests
  Scenario: The instance's publish-qa workflow calls the QA publisher for this instance
    Given a contentless instance scaffolded by initInstance
    When .github/workflows/publish-qa.yml is parsed
    Then it runs on push to main and on pull_request
    And its permissions are exactly contents write
    And its publish job uses cat-harness-tools' layer-qa-publish.yml at main with the instance "cold-chain-guidance"

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::the_publish-context_workflow_calls_the_harness's_reusable_workflow_for_THIS_instance,_on_push_to_main
  Scenario: The instance's publish-context workflow calls the reusable workflow for this instance
    Given a contentless instance scaffolded by initInstance
    When .github/workflows/publish-context.yml is parsed
    Then it runs on push to main
    And its permissions are exactly contents write
    And its publish job uses cat-harness-tools' layer-publish-context.yml at main with the instance "cold-chain-guidance"

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::no_GitHub_origin:_no_iriBase_is_invented,_and_the_note_says_how_to_add_one
  Scenario: With no GitHub origin no iriBase is invented
    Given a directory with no git origin
    When initInstance scaffolds it
    Then the declaration has no iriBase and no version
    And the notes say "No iriBase was declared"

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::a_GitHub_origin_gives_iriBase_https://<owner>.github.io/<repo>/,_and_the_note_says_to_switch_Pages_on
  Scenario: A GitHub origin derives the iriBase from owner and repository
    Given a repository whose origin is https://github.com/LitlFred/new-layer.git
    When initInstance scaffolds it
    Then the declaration's iriBase is "https://litlfred.github.io/new-layer/" with version "0.1.0"
    And its release agent IRI is "https://litlfred.github.io/new-layer/v0/"
    And the notes say "Deploy from a branch: gh-pages, / (root)"

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::an_origin_that_is_not_github.com_derives_no_iriBase
  Scenario: An origin that is not github.com derives no iriBase
    Given a repository whose origin is a non-GitHub proxy URL
    When initInstance scaffolds it
    Then the declaration has no iriBase

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::--iri-base_is_declared_as_given
  Scenario: An explicit --iri-base is declared as given
    Given an empty directory
    When initInstance scaffolds it with iriBase "https://example.org/x/"
    Then the declaration's iriBase is "https://example.org/x/" with version "0.1.0"
    And its release IRIs compute without throwing

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::inside_another_repository_no_workflow_is_written_(GitHub_would_never_read_it),_and_the_note_says_why
  Scenario: An instance inside another repository gets no workflow and is told why
    Given a git repository with a target folder "inner" inside it
    When initInstance scaffolds the inner folder
    Then no .github directory is written
    And the notes say "no publish-context workflow was written"

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::the_config_names_no_adapter_and_the_declaration_no_folio_directory
  Scenario: A contentless instance's config names no adapter and its declaration no folio directory
    Given a contentless instance scaffolded by initInstance
    Then its config has no contentType, adapter or adapterModule
    And its declaration is named "cold-chain-guidance"
    And its declared directories are exactly beans, todos and fsh-guts

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::a_folio's_instance_half_is_the_instance's_—_the_two_cannot_drift
  Scenario: A folio's instance half matches a bare instance's
    Given a bare instance and a document folio scaffolded side by side
    Then the folio creates every instance-level file except the two publish workflows
    And its .mcp.json, .claude/settings.json and .beans.yml are byte-identical to the instance's

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::%s::probe_—_its_declaration_loads_and_every_declared_directory_exists
  Scenario: Each scaffold's declaration loads and every declared directory exists
    # Skipped: the paper folio row when no paper folio-template profile is held
    Given one row per scaffold: a contentless instance, a document folio and a paper folio
    When its declaration is read
    Then the declaration is defined
    And every declared directory not sourced from a branch exists

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::a_folio's_probe_sees_the_content_type_it_asked_for,_not_a_fallback
  Scenario: A paper folio's config carries the content type it asked for
    # Skipped: when no paper folio-template profile is held in the checkout
    Given a scaffolded paper folio
    Then its config's contentType is "paper" and its adapter is "paper"

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::the_CLI_scaffolds_an_instance_with_no_--type_and_no_--author
  Scenario: The CLI scaffolds an instance with no --type and no --author
    Given an empty directory
    When scripts/init-folio.ts runs with --instance, --title "Cold Chain Guidance" and --skip-vcs
    Then it exits 0 and prints "no content type"
    And the instance declaration exists and no folio directory does

  @test:scripts/tests/init-folio.test.ts::a_contentless_instance_(mer2)::the_CLI_refuses_--instance_with_a_--type,_rather_than_silently_dropping_it
  Scenario: The CLI refuses --instance combined with --type
    Given an empty directory
    When scripts/init-folio.ts runs with --instance and --type paper
    Then it exits 1 with "--instance takes no --type" on stderr

  @test:scripts/tests/init-folio.test.ts::a_scaffold_says_what_it_stands_on_(zmdo)::a_contentless_instance_stands_on_cat-harness,_and_reaches_its_skills_through_the_stack
  Scenario: A contentless instance stands on cat-harness and reaches its skills
    Given a contentless instance scaffolded by initInstance
    Then its config's dependencies name cat-harness at "folio-assistant/cat-harness"
    And once the platform is linked its declaration chain contains cat-harness and bootstrap but not folio-assistant-core
    And its resolved skill directories include cat-harness/skills

  @test:scripts/tests/init-folio.test.ts::state_graphs_follow_their_resolved_source_(hp54)::by_default_both_are_declared_on_cat/<instance>/<id>,_tip-keyed,_and_NOT_written
  Scenario: By default the state graphs are declared on branches and not written
    Given an empty folio directory
    When a document folio is scaffolded
    Then beans, todos and fsh-guts are each declared on branch "cat/cold-chain-guidance/<id>" keyed by tip
    And none of their directories or files is written into the checkout
    And each state graph is reported as declared, with a seed naming its branch ref and a manifest.json
    And the todos seed carries todos/todos.json, the beans seed beans/beans.json and the fsh-guts seed fsh-guts/retired/.gitkeep
    And the .gitignore ignores /beans/**, /todos/** and /fsh-guts/**
    And the notes say the graphs are "NOT written into the checkout"

  @test:scripts/tests/init-folio.test.ts::state_graphs_follow_their_resolved_source_(hp54)::a_`directory`_source_(config_override)_is_written_AND_declared
  Scenario: A directory-source override writes and declares the state graphs
    Given a directory whose config overrides beans and todos to directory sources
    When initInstance scaffolds it
    Then beans and todos exist and are declared
    And each is reported as a directory source declared in config, with no seed
    And beans/beans.json and todos/todos.json are created
    And the .gitignore does not ignore /beans/**

  @test:scripts/tests/init-folio.test.ts::state_graphs_follow_their_resolved_source_(hp54)::an_existing_declaration_that_does_not_name_a_state_graph_is_reported,_not_rewritten
  Scenario: An existing declaration without the state graphs is reported, not rewritten
    Given an existing instance declaration with no directories
    When initInstance scaffolds over it
    Then the declaration is listed as skipped
    And no state graph is reported as declared
    And the notes say it 'does not declare "beans"'

  @test:scripts/tests/init-folio.test.ts::state_graphs_follow_their_resolved_source_(hp54)::every_registry_kind_with_a_newInstanceSource_is_a_state_graph_the_scaffold_writes
  Scenario: Every registry kind with a newInstanceSource is a scaffolded state graph
    Given the default graph typology registry
    Then every kind with a newInstanceSource holds state or context and is in the scaffold's state graph list
    And every listed state graph's newInstanceSource is a branch

  @test:scripts/tests/init-folio.test.ts::state_graphs_follow_their_resolved_source_(hp54)::the_branch_convention_refuses_an_instance_name_that_would_make_an_invalid_ref
  Scenario: The state branch convention refuses an invalid ref
    Given instance names "demo-x" and "a..b"
    When the state branch for beans is formed
    Then "demo-x" gives "cat/demo-x/beans"
    And "a..b" throws

  @test:scripts/tests/init-folio.test.ts::remote_link_mode_(--link_remote,_bean_c4lg)::the_remote_mounts_for_a_content_type_come_from_the_declaring_instance_and_its_needs,_never_from_a_hard-coded_name
  Scenario: Remote mounts come from the declaring instance and its needs
    Given a fixture where layer-a declares the document adapter and layer-b the paper adapter, with their needs
    When remotePlatformLayers is asked for no content type, "document" and "paper"
    Then no content type mounts the four platform layers
    And "document" adds layer-a
    And "paper" adds layer-a and layer-b

  @test:scripts/tests/init-folio.test.ts::remote_link_mode_(--link_remote,_bean_c4lg)::a_content_type_no_instance_declares_mounts_the_platform_alone_—_no_invented_layer
  Scenario: A content type no instance declares mounts the platform alone
    Given no adapter declaring the content type asked for
    When remotePlatformLayers is asked for it
    Then it returns only cat-harness, cat-harness-tools, bootstrap and bootstrap-tools

  @test:scripts/tests/init-folio.test.ts::remote_link_mode_(--link_remote,_bean_c4lg)::initFolio_with_link:_'remote'_writes_pinned_source.remote_mounts,_site.landing,_.gitignore_index-mounts_block,_and_root-relative_shims
  Scenario: initFolio in remote link mode writes pinned remote mounts, a landing, an ignore block and root-relative shims
    # Skipped: when folio-assistant-core and folio-assistant-sci are not in the checkout
    Given an empty folio directory
    When a document folio is scaffolded with link "remote"
    Then index.config.json parses, lands on "cold-chain-guidance" and holds the folio as a local source at "."
    And its remote mounts are cat-harness, cat-harness-tools, bootstrap, bootstrap-tools and folio-assistant-core
    And each remote is litlfred/<name> pinned to a 40-hex commit, with a whole override of itself
    And the .gitignore index-mounts block is current and ignores /cat-harness/, /cat-harness-tools/ and /folio-assistant-core/
    And builders.ts re-exports "../../cat-harness-tools/schemas/builders"
    And staging.yml runs "bun run folio-assistant-core/scripts/build-document-site.ts --out _site"
    And the notes say "Linked via remote mounts in index.config.json"

  @test:scripts/tests/init-folio.test.ts::remote_link_mode_(--link_remote,_bean_c4lg)::CLI_--link_remote_scaffolds_a_paper_folio_with_folio-assistant-sci_included_in_remote_mounts
  Scenario: The CLI in remote link mode mounts folio-assistant-sci for a paper folio
    # Skipped: when folio-assistant-core and folio-assistant-sci are not in the checkout
    Given an empty directory
    When scripts/init-folio.ts scaffolds a paper folio with --link remote
    Then it exits 0
    And index.config.json lands on "cold-chain-guidance" with folio-assistant-sci among its remote mounts
    And the .gitignore index-mounts block is current
