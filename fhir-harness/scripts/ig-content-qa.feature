Feature: An IG's narratives, markdown fields and pages are reviewed for injection before its site is published

  @test:scripts/ig-content-qa.test.ts::scanText::a_Publisher_narrative_and_plain_prose_are_clean
  Scenario: a Publisher narrative and plain prose are clean
    Then a narrative of the shape the Publisher generates has no hit
    And prose with a less-than sign, an https link and the word JavaScript has no hit
    And a sentence naming FHIRPath has no hit

  @test:scripts/ig-content-qa.test.ts::scanText::each_of_the_issue's_flags_is_caught
  Scenario: each injection pattern the issue lists is caught
    Then a script, iframe, object, embed, form or base tag is caught as its own rule
    And a meta http-equiv, an on* event handler (also in an SVG), a srcdoc and a CSS expression are caught
    And a javascript: or vbscript: URL, in HTML, markdown or a CSS url(), is caught as a script URL
    And a data:text/html URL is caught, and a bidirectional control character is caught

  @test:scripts/ig-content-qa.test.ts::scanText::character_references_and_a_tab_inside_the_scheme_do_not_hide_a_URL
  Scenario: character references and a tab inside the scheme do not hide a URL
    Then character references and an encoded tab decode to "javascript:"
    And a javascript: URL written with a character reference, with a tab reference inside the scheme, or with a doubly escaped reference is caught
    And an escaped script tag is caught

  @test:scripts/ig-content-qa.test.ts::resourceItems::the_narrative_and_the_markdown_fields_at_any_depth,_contained_resources_included
  Scenario: a resource's narrative and markdown fields are collected at any depth, contained resources included
    Given a profile with a narrative, a description, a blank purpose, a title, element definitions and comments, a contained value set and a note
    When its items are collected
    Then the items are the narrative, the description, each element definition and comment, the contained narrative and description, and the note
    And the blank purpose, the title and an element's short are not collected

  @test:scripts/ig-content-qa.test.ts::contentDigest::order-free,_and_any_change_changes_it
  Scenario: the content digest is order-free, and any change changes it
    Then the digest of the items reversed is the same
    And an edited field or a dropped item gives another digest
    And the digest is a sha256

  @test:scripts/ig-content-qa.test.ts::contentGate::reviewed_and_clean_passes
  Scenario: a reviewed and clean IG passes the gate
    Given a review recorded over the current items
    Then the gate passes, as reviewed

  @test:scripts/ig-content-qa.test.ts::contentGate::missing_and_stale_refuse,_unless_a_preview_accepts_them
  Scenario: a missing or stale review refuses, unless a preview accepts it
    Then with no review the gate refuses as missing
    And with a review over other items the gate refuses as stale
    And on a preview that accepts unreviewed content, a stale or missing review passes, marked accepted

  @test:scripts/ig-content-qa.test.ts::contentGate::an_open_finding_refuses,_even_on_a_preview;_a_cleared_one_with_a_reason_passes
  Scenario: an open finding refuses even on a preview, and a finding cleared with a reason passes
    Then a review with an open finding refuses, even when unreviewed content is accepted
    And a review whose finding is cleared with a reason passes, as reviewed
    And a finding cleared without a reason cannot be recorded

  @test:scripts/ig-content-qa.test.ts::contentGate::a_pattern_hit_refuses_whatever_the_review_says
  Scenario: a pattern hit refuses whatever the review says
    Given a description holding a javascript: link, reviewed, on a preview
    Then the gate refuses on pattern hits and names where the hit is

  @test:scripts/ig-content-qa.test.ts::contentGate::an_unusable_review_refuses
  Scenario: an unusable review refuses
    Then a review with another schema has problems
    And the gate refuses an unparsable review as unusable

  @test:scripts/ig-content-qa.test.ts::a_checkout::collects_the_AST's_texts_and_the_IG's_pages;_record_then_gate_passes,_an_edit_makes_it_stale
  Scenario: a checkout's AST texts and pages are collected; a recorded review passes until an edit makes it stale
    Given an IG checkout with an AST resource, a markdown page and an image
    Then the items are the resource's description and the markdown page
    And the gate refuses with no review
    When a review is recorded over the items
    Then the gate passes as reviewed and writes an ok verdict into the work directory
    When the page is edited
    Then the gate refuses as stale

  @test:scripts/ig-content-qa.test.ts::a_checkout::a_review_outside_the_declared_read_scope_is_refused,_not_silently_skipped
  Scenario: a review outside the declared read scope is refused, not silently skipped
    Given a review file the read scope does not declare
    Then reading it is refused with a pointer to contentTypes.ig.include

  @test:scripts/ig-content-qa.test.ts::the_browser's_copy_of_the_rules::ast-resource.js_holds_the_same_list_as_the_gate
  Scenario: the browser's loader holds the same rule list as the gate
    Then ast-resource.js holds a marked INJECTION_RULES list equal to the gate's

  @test:scripts/ig-content-qa.test.ts::the_browser's_copy_of_the_rules::ast-resource.js_shows_a_flagged_narrative_as_text_and_renders_a_clean_one
  Scenario: the browser's loader flags an injected narrative and passes a clean one
    Given the loader's own injectionHits function, run outside a page
    Then a Publisher narrative has no hit
    And an on* event handler and a character-referenced javascript: URL are each named

  @test:scripts/ig-content-qa.test.ts::pageItems:_translated_page_catalogues_(fhir-harness#382)::translations/<locale>/pagecontent/*.po_are_cleared_with_the_pages
  Scenario: translated page catalogues are cleared with the pages
    Given an IG with a page and a French .po and .pot catalogue of it
    Then the page items are the page and the .po catalogue, not the .pot template
    And with a read scope that does not declare translations/, only the page is an item

  @test:scripts/ig-content-qa.test.ts::scripts_an_IG_trusts_on_its_own_pages_(owner,_2026-11-12,_Q-TRP-3_and_Q-RAIL-2)::a_bare_external_script_on_the_list_is_accepted_on_a_page,_with_a_module_or_classic_type,_defer_or_async
  Scenario: a bare external script on the trusted list is accepted on a page
    Given a page loading the trusted script as a module, with defer, or as classic JavaScript with async
    Then the script element is removed before scanning and the page has no hit

  @test:scripts/ig-content-qa.test.ts::scripts_an_IG_trusts_on_its_own_pages_(owner,_2026-11-12,_Q-TRP-3_and_Q-RAIL-2)::anything_else_in_a_script_element_is_still_refused
  Scenario: anything else in a script element is still refused
    Then an unlisted script, a trusted script with a body, an event handler, a second src, a non-script type, an external URL, or an inline script is a script-tag hit

  @test:scripts/ig-content-qa.test.ts::scripts_an_IG_trusts_on_its_own_pages_(owner,_2026-11-12,_Q-TRP-3_and_Q-RAIL-2)::a_trusted_path_is_never_accepted_in_a_narrative_or_a_markdown_field,_nor_with_no_list
  Scenario: a trusted script is never accepted in a narrative or a markdown field, nor with no list
    Then the trusted script in a narrative or a markdown field is a script-tag hit
    And on a page with no trusted list it is a script-tag hit

  @test:scripts/ig-content-qa.test.ts::scripts_an_IG_trusts_on_its_own_pages_(owner,_2026-11-12,_Q-TRP-3_and_Q-RAIL-2)::the_gate_takes_the_list;_the_review_still_reads_the_page_as_written
  Scenario: the gate takes the trusted script list
    Given a reviewed page loading the trusted script
    Then without the list the gate refuses on pattern hits, and with it the gate passes as reviewed

  @test:scripts/ig-content-qa.test.ts::scripts_an_IG_trusts_on_its_own_pages_(owner,_2026-11-12,_Q-TRP-3_and_Q-RAIL-2)::runGate_reads_the_list_from_the_read_scope's_declaration
  Scenario: runGate reads the trusted script list from the read scope's declaration
    Given a reviewed IG whose page loads the trusted script
    Then runGate refuses on a pattern hit when the declaration lists no trusted script
    And passes as reviewed when the declaration lists it

  @test:scripts/ig-content-qa.test.ts::SVG_drawings_an_IG_trusts_in_<object>_on_its_own_pages_(owner,_2026-11-12)::a_listed_same-site_SVG_object_is_accepted_on_a_page;_its_body_and_closing_tag_stay
  Scenario: a listed same-site SVG object is accepted on a page, keeping its body and closing tag
    Given a page embedding a trusted SVG in an object, with SVG type, style, size, class, id, role, title or aria-label, in any attribute order or quote
    Then only the opening object tag is removed before scanning, its fallback body and closing tag stay
    And the page has no hit

  @test:scripts/ig-content-qa.test.ts::SVG_drawings_an_IG_trusts_in_<object>_on_its_own_pages_(owner,_2026-11-12)::anything_else_in_an_object_element_is_still_refused
  Scenario: anything else in an object element is still refused
    Then an unlisted SVG, another type, an event handler, a second data, a CSS expression, a codebase, an unknown attribute, an external URL, or no data is an object-tag hit

  @test:scripts/ig-content-qa.test.ts::SVG_drawings_an_IG_trusts_in_<object>_on_its_own_pages_(owner,_2026-11-12)::the_body_of_a_trusted_object_is_still_scanned
  Scenario: the body of a trusted object is still scanned
    Given a trusted SVG object holding a script
    Then the only hit is the script tag

  @test:scripts/ig-content-qa.test.ts::SVG_drawings_an_IG_trusts_in_<object>_on_its_own_pages_(owner,_2026-11-12)::a_trusted_path_is_never_accepted_in_a_narrative_or_a_markdown_field,_nor_with_no_list
  Scenario: a trusted SVG object is never accepted in a narrative or a markdown field, nor with no list
    Then the trusted SVG object in a narrative or a markdown field is an object-tag hit
    And on a page with no trusted list it is an object-tag hit

  @test:scripts/ig-content-qa.test.ts::SVG_drawings_an_IG_trusts_in_<object>_on_its_own_pages_(owner,_2026-11-12)::the_gate_takes_the_list,_and_runGate_reads_it_from_the_read_scope's_declaration
  Scenario: the gate takes the trusted SVG list, and runGate reads it from the declaration and scans the file
    Given a reviewed page embedding the trusted SVG
    Then without the list the gate refuses on pattern hits, and with it the gate passes as reviewed
    And runGate refuses on a pattern hit when the declaration lists no trusted SVG
    And with the SVG listed but absent, runGate refuses because it cannot read it
    And with a clean SVG file, runGate passes as reviewed
    And with an SVG file carrying an event handler, runGate refuses, naming the file and the rule

  @test:scripts/ig-content-qa.test.ts::SVG_drawings_an_IG_trusts_in_<object>_on_its_own_pages_(owner,_2026-11-12)::trustedSvgHits_scans_each_listed_file_for_every_rule
  Scenario: each listed SVG file is scanned for every rule
    Given trusted SVGs holding a script, a javascript: link, a clean link, and one that does not exist
    Then the hits are a script tag, a script URL, and an unreadable trusted SVG, each with its file

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::a_document_folio_(no_contentTypes.ig,_no_sushi-config.yaml)_is_not_judged,_even_with_no_AST
  Scenario: a document folio is not judged, even with no AST
    Given a checkout declaring a document content type and no sushi-config.yaml
    Then it is not an IG checkout
    And the gate judges nothing and says it is not applicable, not a pass

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::the_command_exits_78_(not_applicable)_at_a_non-IG_root_and_at_an_IG_whose_run_built_no_AST,_never_0;_1_for_a_named_AST_that_is_missing
  Scenario: the gate command exits 78 when not applicable, and 1 for a named AST that is missing
    Then the not-applicable exit code is 78
    And the command at a non-IG root exits 78 and says it is not a pass
    And the command at an IG with no AST exits 78 and says there is no AST
    And the command at that IG with the AST named explicitly exits 1 and says there is no AST

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::an_IG_declared_by_contentTypes.ig_whose_run_built_no_AST_is_not_applicable,_not_passed
  Scenario: an IG declared by contentTypes.ig whose run built no AST is not applicable, not passed
    Given a checkout declaring contentTypes.ig, with no AST
    Then it is an IG checkout
    And the gate judges nothing and says there is no AST and it is not a pass

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::an_IG_with_an_AST_named_explicitly_that_is_missing_still_fails
  Scenario: an IG whose explicitly named AST is missing still fails
    Given an IG with a sushi-config.yaml and the AST path given explicitly
    Then the gate rejects it, saying there is no AST

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::with_no_AST,_a_pattern_hit_in_a_page_still_refuses
  Scenario: with no AST, a pattern hit in a page still refuses
    Given an IG with no AST whose page holds an on* event handler
    Then the gate rejects it on a pattern hit

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::with_no_AST,_a_hit_in_a_trusted_SVG_still_refuses
  Scenario: with no AST, a hit in a trusted SVG still refuses
    Given an IG with no AST whose trusted SVG has an onload handler
    Then the gate rejects it on a pattern hit

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::the_publish's_runGate_still_refuses_an_IG_with_no_AST
  Scenario: the publish's runGate still refuses an IG with no AST
    Given an IG with a sushi-config.yaml and no AST
    Then runGate refuses, saying there is no AST

  @test:scripts/ig-content-qa.test.ts::the_gate_command_judges_IG_checkouts_only::an_unusable_contentTypes.ig_is_an_IG,_and_is_refused_rather_than_passed
  Scenario: an unusable contentTypes.ig is an IG, and is refused rather than passed
    Given a checkout whose contentTypes.ig has an empty include
    Then it is an IG checkout
    And the gate rejects it
