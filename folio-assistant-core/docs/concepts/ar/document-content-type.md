---
layout: default
title: "المستندات وإرشادات السياسات"
lang: ar
nav_exclude: true
translation_status: unverified
translation_source: concepts/document-content-type.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# المستندات وإرشادات السياسات
{: .no_toc }

## المستندات وإرشادات السياسات
{: #documents-policy-guidance }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/authoring-a-document.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/authoring-a-document.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="documents-policy-guidance.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/documents-policy-guidance.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

**حزمة المهارات:** `folio-document-adapter` ·
**المحول:** `document` ·
**الدليل الإرشادي:** [كتابة مستند](../../guides/writing-a-document.html)

نثر مهيكل: إرشادات السياسات الصحية (دليل إرشادي من المستوى L1، على سبيل المثال)، أو معيار،
أو تقرير، أو كتيب، أو فصل من كتاب. كل ما تمثله الورقة البحثية، باستثناء الطبقة
الرسمية — وبالتالي باستثناء سلسلتي الأدوات اللتين تخدمانها.

- **نموذج المصدر** — شجرة *الكتل* المصنفة نفسها كما في الورقة البحثية، وتقتصر على
  الأنواع التي يكون محتواها نثرًا بدلاً من ادعاء رسمي: `prose`، و`example`،
  و`remark`، و`algorithm`، و`simulator`، و`equation`، و`diagram`،
  و`table`.
- **التصيير** — تقوم أداة `document_render_md` بتجميع الـ folio في ملف Markdown
  واحد؛ بينما تنقله أداتا `document_render_html` و`document_render_pdf` عبر
  pandoc. يستخدم مسار إنشاء PDF محرك HTML (مثل weasyprint أو prince أو wkhtmltopdf)
  و**لا** يلجأ أبدًا إلى `latexmk` كحل بديل، بحيث تظل عبارة "لا يلزم تثبيت TeX" صحيحة
  بدلاً من أن تصبح صحيحة حتى يقوم شخص ما بتثبيت TeX.
- **فرض القيود** — ترفض أداة `content_profile_check` أي نوع رياضي، أو حقل `lean`
  أو ملف مجاور بامتداد `.lean`، وتعمل عند كل استدعاء لـ `content_validate`.

مخططات المهارات ذات الصلة:
[`document-authoring`]({{ '/reference/skills/document-authoring.html' | relative_url }})،
[`document-structure`]({{ '/reference/skills/document-structure.html' | relative_url }})،
[`normative-statements`]({{ '/reference/skills/normative-statements.html' | relative_url }})،
[`document-publishing`]({{ '/reference/skills/document-publishing.html' | relative_url }}).

<div class="bpmn-figure" id="figure-documents-policy-guidance">
  <img src="{{ '/ar/assets/img/workflows/authoring-a-document.svg' | relative_url }}"
       alt="مخطط مسارات BPMN لتأليف المستندات: يخطط المؤلف، وتُزرع الخطة كـ beans، وينشئ الوكيل هيكل الـ folio ويؤلف الكتل، ويتحقق خط أنابيب البناء من ملف التعريف المعلن قبل التحقق والتصيير إلى Markdown وHTML وPDF، بينما يتحكم المراجع في بوابة النشر.">
</div>

[مصدر BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/authoring-a-document.bpmn) · [ملف SVG بالحجم الكامل]({{ '/assets/img/workflows/authoring-a-document.svg' | relative_url }})
{: .bpmn-source }

### حمل العبارات المعيارية
{: #carrying-a-normative-statement data-fa-label="sec:content-types-carrying-a-normative-statement" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/content/docs/content-types/carrying-a-normative-statement.md){: .fa-node-edit title="Edit content/docs/content-types/carrying-a-normative-statement.md" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="carrying-a-normative-statement.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/carrying-a-normative-statement.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span></span>

التوصية أو المتطلب أو القاعدة هي الكتلة التي يستشهد بها القراء
ويتتبعها المنفذون. وهي تتطلب تسمية، وهوية مستقرة، ومكانًا في
مخطط التبعيات — كل ما تمتلكه كتلة `theorem` — إلا أنها بالتأكيد ليست
مبرهنة، لأنه لا يوجد ما يثبتها ببرهان.

لا يوجد **نوع كتلة `recommendation` من الدرجة الأولى**. في الوقت الحالي، الحامل لها هو
كتلة `prose` ذات تسمية وعنوان؛ وتوضح مهارة
[`normative-statements`]({{ '/reference/skill-instructions/normative-statements.html' | relative_url }})
هذا العرف وحدوده. وكانت الإرشادات السابقة في
`document-intake` قد ربطت توصيات الأدلة الإرشادية بكتلة `definition` — وهو ما
يسبق إنشاء نوع المحتوى هذا ويعد غير صحيح بالنسبة لـ folio المستند، حيث
تكون `definition` نوعًا رياضيًا يتطلب وجود حقل `lean`.

---
