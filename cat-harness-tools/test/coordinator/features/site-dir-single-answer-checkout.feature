# Specifies that the cat-harness instance's own .gitignore follows its
# declared site root (siteDirFor), asked of git in a throwaway repository.
Feature: The instance's .gitignore follows the site root in both directions

  @test:test/coordinator/site-dir-single-answer-checkout.test.ts::the_site_root_is_one_answer,_not_a_literal::`.gitignore`_follows_the_site_root,_in_both_directions
  Scenario: Hand-written site assets are addable and build state is ignored
    Given a throwaway git repository holding only a copy of the instance's .gitignore
    When git is asked about probe paths under the declared site root
    Then assets/js, assets/js/vendor and _includes probes are not ignored
    And .bundle, vendor/bundle, _data/build.yml and _site probes are ignored
