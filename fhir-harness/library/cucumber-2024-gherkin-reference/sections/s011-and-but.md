---
doc_id: cucumber-2024-gherkin-reference
doc_title: "Gherkin Reference"
section_id: s011-and-but
section_title: "And, But"
file: "content/docs/gherkin/reference.md"
lines: 247-300
source_sha256: 50bdb1f828b4178c
granularity: heading
---
### And, But

If you have successive `Given`'s or `Then`'s, you *could* write:

```gherkin
Example: Multiple Givens
  Given one thing
  Given another thing
  Given yet another thing
  When I open my eyes
  Then I should see something
  Then I shouldn't see something else
```

Or, you could make the example more fluidly structured by replacing the successive `Given`'s or `Then`'s with `And`'s and `But`'s:

```gherkin
Example: Multiple Givens
  Given one thing
  And another thing
  And yet another thing
  When I open my eyes
  Then I should see something
  But I shouldn't see something else
```

<h3 id="Asterisk">*</h3>

Gherkin also supports using an asterisk (`*`) in place of any of the normal step keywords. This can be helpful when you have some steps that are effectively a _list of things_, so you can express it more like bullet points where otherwise the natural language of `And` etc might not read so elegantly.

For example:

```gherkin
Scenario: All done
  Given I am out shopping
  And I have eggs
  And I have milk
  And I have butter
  When I check my list
  Then I don't need anything
```

Could be expressed as:

```gherkin
Scenario: All done
  Given I am out shopping
  * I have eggs
  * I have milk
  * I have butter
  When I check my list
  Then I don't need anything
```
