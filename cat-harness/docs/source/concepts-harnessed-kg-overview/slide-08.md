The harness's own schemas, drawn from the JSON Schemas they are generated from,
in four packages. **test** holds the KG QA report and the test run. **process**
holds the task and the OMG BPMN 2.0 process. **scenario** holds actor, role,
user story, voice and skill. **schema** holds JSON Schema and external schema. An actor
takes on roles, a role carries skills, a task sits in a lane of a role and uses
a skill, a test run tests a skill, and a QA report audits any kind of subject.

![Harness schemas — UML class diagram generated from the JSON Schemas: packages test, process, scenario and schema, with the classes and relations described in the text above.]({{ '/assets/img/uml/harness-schemas.svg' | relative_url }})

<details markdown="1"><summary>The diagram as it appeared on the slide (2026-09-30), without Voice Profile</summary>

<a href="{{ '/assets/img/kg-deck/img-p008-1.webp' | relative_url }}"><img src="{{ '/assets/img/kg-deck/img-p008-1.webp' | relative_url }}" alt="UML class diagram &quot;Harness schemas — attributes derived from JSON Schema&quot;, in four packages. test: KG QA Report (kg-qa/v1; subject kind process|decision|role|requirement|skill|graph|tool, criteria, totals, pair_attestations) and Test Run (folio-test-run/v1; skill, subject, data and process hashes, outcome, cases). process: Task (process, task; BPMN callActivity, serviceTask, task and userTask) &#x27;in process&#x27; Process (external OMG BPMN 2.0; start and end events, gateways, lanes, sequence flows) — noted as XSD, not JSON Schema. scenario: Actor (id, title, kind person|agent|system|external, roles) &#x27;takes on roles&#x27; Role (persona, actorKinds, skills, inherits, actedUpon, judgementOnly); User Story (role, want, soThat) &#x27;as a role&#x27;; Role &#x27;carries skills&#x27; Skill (id, name, description, roles, requiredCapabilities, dependsOn, allowedTools, routingPatterns, tags, package, lifecycleStages plan|author|validate|review|test|publish|feedback|retire). schema: JSON Schema (draft-07, from Zod) and External Schema (authority OMG|DCMI|W3C|IETF|ISO|HL7|other; use conforms|reads|cites). Edges: KG QA Report audits subject kind; Test Run tests Skill; Task in lane of Role and uses Skill; every class conforms to JSON Schema." loading="lazy"></a>

</details>

**Source:** `bun run cat uml:overview` regenerates the picture above from the schemas.

> **Misaligned — the snapshot is older:** today's diagram has a **Voice
> Profile** class that slide 8 does not. The picture above is the current one.
