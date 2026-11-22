Feature: The IG AST: its input digest, validity, diff, pages, formats and build kind

  @test:scripts/ig-ast.test.ts::inputDigest_—_the_same_algorithm_as_the_Java_InputDigest::goldenDigestVector
  Scenario: golden vector shared with ast-export's AstExporterTest
    Given an IG with sushi-config.yaml, ig.ini, an FSH file, a page and an output file
    Then its input digest is the golden vector shared with the Java exporter

  @test:scripts/ig-ast.test.ts::inputDigest_—_the_same_algorithm_as_the_Java_InputDigest::gitIgnoredNotInput
  Scenario: in a git work tree, an ignored file is not an input but an untracked one is
    Given an IG committed in a git work tree that ignores .DS_Store
    Then adding an ignored file does not change the input digest
    And adding an untracked FSH file does

  @test:scripts/ig-ast.test.ts::validity_—_compiledValidity_on_the_manifest's_inputs::currentInputsValid
  Scenario: built from the inputs the IG has now: valid
    Given an AST recording the IG's current revision and input digest
    Then it is valid

  @test:scripts/ig-ast.test.ts::validity_—_compiledValidity_on_the_manifest's_inputs::editedInputStale
  Scenario: an edited input is stale, and says which input
    Given an AST recording the IG's current inputs
    When an input file is edited
    Then it is stale-inputs, differing in the input digest

  @test:scripts/ig-ast.test.ts::validity_—_compiledValidity_on_the_manifest's_inputs::laterCommitInputsDecide
  Scenario: a later commit that changes no input is still valid; one that changes an input is not
    Given an AST recording the IG's current inputs
    When a commit adds only a README
    Then it is still valid
    When a commit changes an input
    Then it is stale-inputs, differing in the source revision and the input digest

  @test:scripts/ig-ast.test.ts::validity_—_compiledValidity_on_the_manifest's_inputs::nonAncestorRevisionStale
  Scenario: a recorded revision that is not an ancestor is stale even with the same inputs
    Given an AST recording a revision that is not an ancestor, with the current input digest
    Then it is stale-inputs, differing in the source revision

  @test:scripts/ig-ast.test.ts::validity_—_compiledValidity_on_the_manifest's_inputs::driftStalesWorkTreeNotCommit
  Scenario: drift: a build that writes under input/ makes the work tree stale, never the commit
    Given an AST recording a commit with an image under input/
    Then the digest at HEAD equals the work tree's digest
    When a build rewrites that image and adds another
    Then the work tree's digest differs and the AST is stale-inputs on the input digest
    And the digest at HEAD is unchanged and the AST is valid at HEAD
    When an input change is committed
    Then the AST is stale-inputs at HEAD on the source revision and input digest
    And at a revision that does not resolve it is cannot-tell

  @test:scripts/ig-ast.test.ts::validity_—_compiledValidity_on_the_manifest's_inputs::newerPublisherStale
  Scenario: a newer Publisher is stale even when the source is not
    Given an AST built by one Publisher version
    When it is checked against a newer Publisher
    Then it is stale-inputs, differing in the toolchain

  @test:scripts/ig-ast.test.ts::validity_—_compiledValidity_on_the_manifest's_inputs::noUsableInputsCannotTell
  Scenario: a manifest without usable inputs is cannot-tell, never valid
    Then an AST with no inputs is cannot-tell
    And an AST with a legacy prefixed digest is cannot-tell

  @test:scripts/ig-ast.test.ts::cachedStepLine_—_the_fhir-ast_cache's_summary,_in_cached-step's_format::a_valid_AST_restored_as_it_was_is_a_hit,_keyed_by_the_input_digest
  Scenario: the cache summary calls a valid AST restored as it was a hit, keyed by the input digest
    Given a valid AST and an input digest
    Then the summary line is an exact hit, built from the inputs this tree has, with the digest as its key

  @test:scripts/ig-ast.test.ts::cachedStepLine_—_the_fhir-ast_cache's_summary,_in_cached-step's_format::a_valid_AST_the_refresh_made_from_a_delta_is_warm
  Scenario: the cache summary calls a valid AST the refresh made from a delta warm
    Given a valid AST that the refresh made by applying a delta
    Then the summary line is an exact warm entry saying a delta was applied

  @test:scripts/ig-ast.test.ts::cachedStepLine_—_the_fhir-ast_cache's_summary,_in_cached-step's_format::stale_and_cannot-tell_are_misses_that_say_why;_warm_never_turns_a_miss_into_a_hit
  Scenario: stale and cannot-tell are misses that say why, and warm never turns a miss into a hit
    Given a stale AST whose inputDigest differs, marked warm
    Then the summary line is a miss saying it is stale because inputDigest differs, keyed by the digest
    And an AST whose validity cannot be told, with no digest, is a miss saying why, keyed as unknown

  @test:scripts/ig-ast.test.ts::source-inputs_—_an_AST_exported_after_a_pre-export_command::preparedTreeRecordsSource
  Scenario: recorded against the prepared tree it is stale once the tree is put back; against the source, valid
    Given an IG whose pre-export command rewrites an input and adds a page, and an AST recorded against that prepared tree
    When the tree is put back
    Then the work tree digest equals the source digest and the AST is stale-inputs
    When the source inputs are recorded with the pre-export command
    Then the prepared and source digests are returned and the manifest records the command and the prepared digest
    And the AST is valid

  @test:scripts/ig-ast.test.ts::source-inputs_—_an_AST_exported_after_a_pre-export_command::refusesDishonestRecord
  Scenario: refuses what it cannot record honestly
    Then recording onto an AST with no input digest throws that it records no inputs.inputDigest
    And a digest that is not a sha256 is refused
    And a blank pre-export command is refused
    And recording twice throws that it already records a preExport

  @test:scripts/ig-ast.test.ts::source-inputs_—_an_AST_exported_after_a_pre-export_command::cliPrintsSameDigest
  Scenario: the CLI prints the same digest validity computes
    When the CLI's digest command runs on the IG
    Then it exits 0 and prints the input digest

  @test:scripts/ig-ast.test.ts::diff_—_list_and_view_what_changed_between_two_ASTs::diffEveryStatus
  Scenario: every status, with a version move paired rather than split
    When a base and a head AST are diffed
    Then one resource each is added, removed, changed, version-changed and unchanged
    And the version move of B is paired from "1.0.0" to "1.1.0"
    And PD is removed, M is added, and A's change is an added related artifact

  @test:scripts/ig-ast.test.ts::diff_—_list_and_view_what_changed_between_two_ASTs::diffEdgesAndProvenance
  Scenario: edges added and removed, and the head's mixed provenance carried
    When the ASTs are diffed
    Then the added and removed edges name their sources
    And the head is mixed and the authority is "cache"

  @test:scripts/ig-ast.test.ts::diff_—_list_and_view_what_changed_between_two_ASTs::identicalEmptyDelta
  Scenario: identical ASTs: an empty delta, determined
    When an AST is diffed against itself
    Then no resource is listed and 4 are unchanged

  @test:scripts/ig-ast.test.ts::diff_—_list_and_view_what_changed_between_two_ASTs::listByTypeAndOrigin
  Scenario: list counts by type and by origin
    When the head AST is listed
    Then it counts 2 Libraries, 1 Measure and 1 Patient
    And it is mixed and counts 1 resource built at its revision

  @test:scripts/ig-ast.test.ts::render_—_just-the-docs_pages_for_the_delta::renderIndexAndPages
  Scenario: an index that lists, a page per changed resource that shows, and the provisional mark on every page
    Given a change to a Library's description holding Liquid and a pipe, and a version move
    When the delta is rendered
    Then 3 pages are written, each marked provisional and wrapped in a raw block
    And the Library page is titled under "AST delta" and escapes the pipe
    And the index links the Library page and shows the version move

  @test:scripts/ig-ast.test.ts::render_—_just-the-docs_pages_for_the_delta::endrawCannotEscape
  Scenario: a value carrying {% endraw %} cannot close the raw block or run Liquid
    Given a description holding an endraw tag, an include and an output tag
    When the delta is rendered
    Then the raw body holds no Liquid delimiters but still names endraw

  @test:scripts/ig-ast.test.ts::render_—_just-the-docs_pages_for_the_delta::sameTypeIdTwoPages
  Scenario: two resources sharing type/id but not key get two pages
    Given two resources sharing type and id but not key
    When the delta is rendered
    Then every page is distinct and two pages are for Library A

  @test:scripts/ig-ast.test.ts::an_incomplete_AST_is_cannot-tell,_never_a_clean_diff::missingDependenciesRefused
  Scenario: a missing dependencies.json refuses to read
    Given an AST with no dependencies.json
    Then reading it throws that dependencies.json is missing

  @test:scripts/ig-ast.test.ts::an_incomplete_AST_is_cannot-tell,_never_a_clean_diff::missingPayloadFailsDiff
  Scenario: a missing resource payload fails the diff rather than reading as unchanged
    Given two ASTs missing a resource's payload
    Then diffing them throws that it is missing

  @test:scripts/ig-ast.test.ts::the_formats,_declared_once_—_JSON_Schema_and_JSON-LD_for_downstream_(bean_l0lq)::validatesGeneratedSchemas
  Scenario: a valid AST validates against the GENERATED JSON Schemas too, so the published schema accepts what the reader does
    Given a valid AST
    Then its manifest and dependencies validate against the generated JSON Schemas
    And a manifest whose authority is "full" does not

  @test:scripts/ig-ast.test.ts::the_formats,_declared_once_—_JSON_Schema_and_JSON-LD_for_downstream_(bean_l0lq)::refusesNonCacheManifest
  Scenario: a manifest that does not say it is a cache is refused
    Given an AST whose authority is "full"
    Then reading it throws about the authority

  @test:scripts/ig-ast.test.ts::the_formats,_declared_once_—_JSON_Schema_and_JSON-LD_for_downstream_(bean_l0lq)::jsonLdIdentities
  Scenario: JSON-LD: a resource is its canonical URL, a canonical-less one a urn, an edge a link
    When an AST with a Library and a Patient is turned into JSON-LD
    Then it has a context and the authority "cache"
    And the Library is its canonical URL, typed as a FHIR Library, with its relatedArtifact dependency from the exporter
    And the Patient is a urn

  @test:scripts/ig-ast.test.ts::the_formats,_declared_once_—_JSON_Schema_and_JSON-LD_for_downstream_(bean_l0lq)::committedSchemasGenerated
  Scenario: the committed JSON Schemas and context are what the Zod generates
    Then every committed JSON Schema and context file equals what is generated

  @test:scripts/ig-ast.test.ts::build_kind_—_a_release_is_cut_from_a_full_build_(phase_P4,_bean_h3tx)::ordinaryRunFull
  Scenario: one ordinary run is full, and may be released
    Then an ordinary manifest is a full build and is not refused for release

  @test:scripts/ig-ast.test.ts::build_kind_—_a_release_is_cut_from_a_full_build_(phase_P4,_bean_h3tx)::mergedIsIncremental
  Scenario: a merged AST is incremental, and the guard says why it is refused
    Given a merged AST
    Then it is an incremental build
    And the refusal names the base, head and counts, and asks for a full build

  @test:scripts/ig-ast.test.ts::build_kind_—_a_release_is_cut_from_a_full_build_(phase_P4,_bean_h3tx)::cliRequireFull
  Scenario: the CLI's --require-full exits 1 on an incremental AST, 0 on a full one
    When the CLI's build-kind runs with --require-full
    Then on a full AST it prints "full" and exits 0
    And on an incremental AST it prints "incremental" and exits 1
