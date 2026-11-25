| # | component | what it holds |
|---|---|---|
| 1 | Health interventions and recommendations | the WHO guideline's recommendations; informs DAK scope |
| 2 | Generic personas | roles, responsibilities and interventions of the targeted personas |
| 3 | User scenarios | brief narratives of how the personas engage with the system |
| 4 | Business processes and workflows | generic clinical and non-clinical workflows; when data is collected and used |
| 5 | Core data elements | data for decisions and indicators; informs forms and L3 interoperability |
| 6 | Decision-support logic | decision tables for counselling and treatment algorithms |
| 7 | Scheduling logic | decision tables for scheduling by care plan (formerly part of 6) |
| 8 | Indicators and monitoring | numerators and denominators; person-centred data linked to aggregate |
| 9 | Functional and non-functional requirements | key functions and requirements of a digital tracking and decision-support system |
| 10 | Test scenarios | test data and scenarios to check a system against the other nine |

The slide drew nine cards and put the tenth, **testing: test data and test harness**, beside them. The squares below give all ten a card, and are generated from `DAK_COMPONENTS` (the DAK layer's `scripts/gen-dak-components-figure.ts`), so a component added there cannot go without one.

![The ten components of a WHO Digital Adaptation Kit as numbered coloured squares: 1 Health Interventions and Recommendations, 2 Generic Personas, 3 User Scenarios, 4 Business Processes and Workflows, 5 Core Data Elements, 6 Decision Support Logic, 7 Scheduling Logic (not yet its own DAK model field), 8 Indicators and Monitoring, 9 Functional and Non-functional Requirements, 10 Test Scenarios.]({{ '/assets/img/dak-components.svg' | relative_url }})

<details markdown="1"><summary>The figure as it appeared on the slide (2026-09-30): nine cards</summary>

<a href="{{ '/assets/img/kg-deck/img-p003-1.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p003-1.webp' | relative_url }}" alt="The nine components of a WHO Digital Adaptation Kit, as numbered coloured cards: 1 Health interventions and recommendations (from the WHO guideline; informs DAK scope); 2 Generic personas (roles, responsibilities and interventions of targeted personas); 3 User scenarios (brief narratives of how personas engage with the system); 4 Business processes and workflows (generic clinical and non-clinical workflows; when data is collected and used); 5 Core data elements (for decision-making, indicators and other needs; inform forms and L3 interoperability); 6 Decision support logic (decision tables for counselling and treatment algorithms); 7 Scheduling logic (decision tables for scheduling per care plans — marked as previously combined with decision support logic); 8 Indicators and monitoring (numerator and denominator data elements; linking person-centred to aggregate data); 9 Functional and non-functional requirements. Note: the slide&#x27;s speaker notes still say eight components." loading="lazy"></a>

</details>

**Sources:** `DAK_COMPONENTS` (ten: the original eight plus scheduling logic
and test scenarios); the SMART Base 1.0.0 `DAK` logical model;
[the L2 artefacts and their skills](https://litlfred.github.io/folio-assistant/smart-base/guides/who-smart-dak.html).

> **Misaligned, in three directions:** the speaker notes said 8. The figure
> shows 9 cards, with testing beside them. The SMART Base `DAK` logical model
> (`DAK.fsh`) declares 9 fields: test scenarios **in**,
> scheduling logic carried **inside** decision-support logic. This
> repository's `DAK_COMPONENTS` counts 10 and marks scheduling logic as not yet
> formalized. WHO's IG starter kit disagrees with itself the same way: its
> introduction counts 9 with scheduling and no testing, and its table counts 9
> with test scenarios and scheduling inside decision support. Scheduling logic is authored as DMN decision tables but may not
> yet be formalized as its own L2 component or L3 artefact, and that is the
> gap the logical model shows. The notes are
> corrected in the owner's copy.
