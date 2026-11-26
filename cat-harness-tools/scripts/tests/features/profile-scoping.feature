# QA criterion scoping by content profile, the second axis beside adapters:
# an opted-out criterion is n/a in a document folio, an unannotated one still
# runs, and an undetermined profile runs it. Each Scenario names the test that executes it.
Feature: Scoping QA criteria by content profile

  @test:scripts/tests/profile-scoping.test.ts::criterionProfiles_—_the_default_runs_the_other_way_from_adapters::absent_means_EVERY_profile,_not_one_of_them
  Scenario: An absent profiles field means every profile
    Then a criterion with no profiles applies to every content profile
    And with no adapters it applies to every adapter

  @test:scripts/tests/profile-scoping.test.ts::criterionProfiles_—_the_default_runs_the_other_way_from_adapters::an_explicit_scope_is_honoured
  Scenario: An explicit profile scope is honoured
    Then profiles paper gives paper, and profiles document gives document

  @test:scripts/tests/profile-scoping.test.ts::criterionProfiles_—_the_default_runs_the_other_way_from_adapters::every_criterion_resolves_to_a_non-empty_scope
  Scenario: Every criterion resolves to a non-empty profile scope
    Then every registered criterion applies to at least one profile

  @test:scripts/tests/profile-scoping.test.ts::criterionProfiles_—_the_default_runs_the_other_way_from_adapters::the_axis_is_an_opt-out_for_a_minority,_not_a_re-scoping_of_the_registry
  Scenario: The profile axis is an opt-out for a minority
    Then at least one criterion opts out, and fewer than a quarter of the registry do

  @test:scripts/tests/profile-scoping.test.ts::criterionProfiles_—_the_default_runs_the_other_way_from_adapters::an_opted-out_criterion_names_`paper`,_never_`document`_alone
  Scenario: An opted-out criterion names paper, never document alone
    Then every criterion declaring profiles declares exactly paper

  @test:scripts/tests/profile-scoping.test.ts::criterionProfiles_—_the_default_runs_the_other_way_from_adapters::profiles_and_adapters_stay_orthogonal
  Scenario: Profiles and adapters stay orthogonal
    Then a criterion scoped to no content adapter carries no profile opt-out
    And at most one name sits on both axes, and it is paper or document

  @test:scripts/tests/profile-scoping.test.ts::profileExcludesCriterion_—_the_third_state::excludes_an_opted-out_criterion_from_a_document_folio
  Scenario: An opted-out criterion is excluded from a document folio
    Then a paper-only criterion is excluded for document

  @test:scripts/tests/profile-scoping.test.ts::profileExcludesCriterion_—_the_third_state::never_excludes_an_unannotated_criterion
  Scenario: An unannotated criterion is never excluded
    Then a criterion with no profiles is excluded neither for document nor for paper

  @test:scripts/tests/profile-scoping.test.ts::profileExcludesCriterion_—_the_third_state::an_UNDETERMINED_profile_runs_the_criterion,_it_does_not_skip_it
  Scenario: An undetermined profile runs the criterion
    Then a paper-only or a document-only criterion is not excluded when the profile is undetermined

  @test:scripts/tests/profile-scoping.test.ts::readDeclaredFolioProfile_—_undetermined_is_not_`paper`::a_declared_contentType_resolves,_and_says_where_from
  Scenario: A declared contentType resolves and says where from
    Given a folio declaring contentType document
    Then the declared reader gives document, declared by contentType: "document"

  @test:scripts/tests/profile-scoping.test.ts::readDeclaredFolioProfile_—_undetermined_is_not_`paper`::no_config,_no_contentType,_and_unparseable_config_are_all_undetermined
  Scenario: No config, no contentType and an unparseable config are undetermined
    Then each gives no profile, and each says it is undetermined

  @test:scripts/tests/profile-scoping.test.ts::readDeclaredFolioProfile_—_undetermined_is_not_`paper`::the_validator-facing_reader_still_resolves_undetermined_to_paper
  Scenario: The validator-facing reader still resolves undetermined to paper
    Given a folio with no config
    Then the validator-facing reader gives paper, by default

  @test:scripts/tests/profile-scoping.test.ts::the_sweep's_profile_gate,_end_to_end::a_paper-only_criterion_is_n/a'd_in_a_document_folio,_under_its_OWN_outcome
  Scenario: A paper-only criterion is n/a'd in a document folio under its own outcome
    Given the sweep of a scaffolded document folio's block
    Then voice-unicode-crash is n/a-wrong-profile, not n/a-wrong-adapter

  @test:scripts/tests/profile-scoping.test.ts::the_sweep's_profile_gate,_end_to_end::an_automated:false_criterion_scoped_to_paper_is_n/a'd_in_a_document_folio,_not_needs-agent_(nba0)
  Scenario: A paper-scoped automated:false criterion is n/a'd, not needs-agent
    Given the sweep of the document folio's block
    Then da-lean-narrative-divergence is n/a-wrong-profile, not needs-agent

  @test:scripts/tests/profile-scoping.test.ts::the_sweep's_profile_gate,_end_to_end::an_UNANNOTATED_criterion_still_runs_in_a_document_folio
  Scenario: An unannotated criterion still runs in a document folio
    Given the sweep of the document folio's block
    Then voice-status-leak has an outcome that is not n/a-wrong-profile
    And fewer than a quarter of the outcomes are n/a-wrong-profile

  @test:scripts/tests/profile-scoping.test.ts::the_sweep's_profile_gate,_end_to_end::the_same_criterion_runs_in_a_paper_folio_—_the_gate_is_profile-driven
  Scenario: The same criteria run in a paper folio
    Given the paper profile is held and a paper folio's block is swept
    Then neither voice-unicode-crash nor voice-status-leak is n/a-wrong-profile

  @test:scripts/tests/profile-scoping.test.ts::the_sweep's_profile_gate,_end_to_end::a_folio_whose_config_cannot_be_read_keeps_its_coverage
  Scenario: A folio whose config cannot be read keeps its coverage
    Given a document folio whose config is truncated before the sweep
    Then the config said document before, the declared profile became undetermined, and no outcome is n/a-wrong-profile
