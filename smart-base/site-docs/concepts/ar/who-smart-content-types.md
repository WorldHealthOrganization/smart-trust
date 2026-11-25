---
layout: default
title: "حزم التكيف الرقمي (DAK) لإرشادات منظمة الصحة العالمية SMART (المستوى L2) · أدلة تطبيق إرشادات منظمة الصحة العالمية SMART (المستوى L3)"
lang: ar
nav_exclude: true
translation_status: unverified
translation_source: concepts/who-smart-content-types.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# حزم التكيف الرقمي (DAK) لإرشادات منظمة الصحة العالمية SMART (المستوى L2) · أدلة تطبيق إرشادات منظمة الصحة العالمية SMART (المستوى L3)
{: .no_toc }

## حزم التكيف الرقمي (DAK) لإرشادات منظمة الصحة العالمية SMART (المستوى L2)
{: #who-smart-guidelines-daks-l2 data-fa-label="sec:content-types-who-smart-guidelines-daks-l2" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l2-dak-authoring.bpmn){: .fa-node-edit title="Edit processes/l2-dak-authoring.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-guidelines-daks-l2.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-guidelines-daks-l2.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-guidelines-daks-l2.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**حزمة المهارات:** `authoring-who-smart-guidelines` ·
**الدليل الإرشادي:** [تأليف حزمة التكيف الرقمي (DAK) لإرشادات منظمة الصحة العالمية SMART](../../guides/who-smart-dak.html)

تعد **حزمة التكيف الرقمي (Digital Adaptation Kit - DAK)** التمثيل من *المستوى L2*
(المقروء آليًا، ولكنه محايد تجاه التنفيذ) لإرشادات منظمة الصحة العالمية. يتولى folio-assistant
تأليف مخرجات المستوى L2:

- **عمليات الأعمال** — مسارات عمل BPMN 2.0 (`bpmn-authoring`)
- **منطق اتخاذ القرار** — جداول قرارات DMN (`dmn-authoring`)
- **قواميس البيانات / عناصر البيانات الأساسية** — Excel / جداول مهيكلة
- **المصطلحات** — أنظمة الرموز ومجموعات القيم (`terminology-management`)
- **شخصيات المستخدمين، والسيناريوهات، والمؤشرات، والمتطلبات**

مخططات المهارات ذات الصلة:
[`l2-dak-authoring`]({{ '/reference/skills/l2-dak-authoring.html' | relative_url }})،
[`bpmn-authoring`]({{ '/reference/skills/bpmn-authoring.html' | relative_url }})،
[`dmn-authoring`]({{ '/reference/skills/dmn-authoring.html' | relative_url }})،
[`terminology-management`]({{ '/reference/skills/terminology-management.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-guidelines-daks-l2">
  <img src="{{ '/ar/assets/img/workflows/l2-dak-authoring.svg' | relative_url }}"
       alt="مخطط مسارات BPMN لتأليف DAK من المستوى L2: بوابة متوازية توزع شخصيات المستخدمين وعمليات BPMN ومنطق قرارات DMN وقاموس البيانات والمؤشرات عبر مسار محلل الأعمال جنبًا إلى جنب مع ارتباطات أخصائي المصطلحات، ثم يتحكم التحقق من جانب خبير الموضوع السريري (SME) في تجميع الـ DAK.">
</div>

[مصدر BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l2-dak-authoring.bpmn) · [ملف SVG بالحجم الكامل]({{ '/assets/img/workflows/l2-dak-authoring.svg' | relative_url }})
{: .bpmn-source }

---

## أدلة تطبيق إرشادات منظمة الصحة العالمية SMART (المستوى L3)
{: #who-smart-implementation-guides-l3 data-fa-label="sec:content-types-who-smart-implementation-guides-l3" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/l3-fhir-pipeline.bpmn){: .fa-node-edit title="Edit fhir-harness/collab/processes/content/l3-fhir-pipeline.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="who-smart-implementation-guides-l3.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="who-smart-implementation-guides-l3.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/who-smart-implementation-guides-l3.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**حزمة المهارات:** `authoring-who-smart-guidelines` ·
**الدليل الإرشادي:** [تأليف دليل تطبيق (IG) لإرشادات منظمة الصحة العالمية SMART](../../guides/who-smart-ig.html)

تحوّل طبقة *المستوى L3* حزمة DAK من المستوى L2 إلى **دليل تطبيق FHIR** قابل للحوسبة:

- **موارد FHIR** تُؤلف باستخدام **FSH** (اختزال FHIR / FHIR Shorthand) وتُترجم بواسطة
  **SUSHI** (`l3-fhir-authoring`)
- **التحقق** مقابل ملفات تعريف FHIR (`fhir-validation`)
- **النشر** باستخدام **HL7 FHIR IG Publisher** (`ig-publication`)
- بوابات **مراقبة الجودة** (`quality-control`)

مخططات المهارات ذات الصلة:
[`l3-fhir-authoring`]({{ '/reference/skills/l3-fhir-authoring.html' | relative_url }})،
[`fhir-validation`]({{ '/reference/skills/fhir-validation.html' | relative_url }})،
[`ig-publication`]({{ '/reference/skills/ig-publication.html' | relative_url }})،
[`quality-control`]({{ '/reference/skills/quality-control.html' | relative_url }}).

<div class="bpmn-figure" id="figure-who-smart-implementation-guides-l3">
  <img src="{{ '/ar/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }}"
       alt="مخطط مسارات BPMN لخط أنابيب المستوى L3: تعيين L2 إلى L3، وتأليف FSH، والترجمة عبر SUSHI، والتحقق مقابل ملفات التعريف مع حلقة عودة إلى FSH عند الفشل، وبوابات مراقبة الجودة التي تسجل النتائج كـ beans، وبناء IG Publisher، ونشر موقع دليل التطبيق (IG).">
</div>

[مصدر BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/l3-fhir-pipeline.bpmn) · [ملف SVG بالحجم الكامل]({{ '/assets/img/workflows/l3-fhir-pipeline.svg' | relative_url }})
{: .bpmn-source }

---
