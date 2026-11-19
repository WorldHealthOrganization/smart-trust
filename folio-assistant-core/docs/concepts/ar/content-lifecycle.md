---
layout: default
title: "دورة حياة المحتوى"
lang: ar
nav_exclude: true
translation_status: unverified
translation_source: concepts/content-lifecycle.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# دورة حياة المحتوى
{: .no_toc }

## دورة حياة المحتوى
{: #the-content-lifecycle data-fa-label="sec:content-types-the-content-lifecycle" }

[✎ Edit](https://github.com/litlfred/folio-assistant/edit/main/processes/content-lifecycle.bpmn){: .fa-node-edit title="Edit folio-assistant-core/collab/processes/content/content-lifecycle.bpmn" } <span class="fa-qa-badges"><button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-block" data-qa-family="block" data-qa-key="the-content-lifecycle.block" data-qa-label="Content QA" data-qa-noun="block" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.block.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Content QA: loading the verdict…" aria-label="Content QA: loading the verdict…"><span class="fa-qa-tag">QA</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button> <span class="fa-qa-badge fa-qa-unswept fa-qa-fam-translation" title="Translation QA: not swept — no sidecar for this block" aria-label="Translation QA: not swept — no sidecar for this block"><span class="fa-qa-tag">TR</span></span> <button type="button" class="fa-qa-badge fa-qa-pending fa-qa-fam-kg" data-qa-family="kg" data-qa-key="the-content-lifecycle.kg" data-qa-label="Knowledge-graph QA" data-qa-noun="diagram" data-qa-src="{{ '/assets/qa/content-types/the-content-lifecycle.kg.json' | relative_url }}" data-qa-index="{{ '/assets/qa/content-types/qa-index.json' | relative_url }}" aria-expanded="false" aria-busy="true" title="Knowledge-graph QA: loading the verdict…" aria-label="Knowledge-graph QA: loading the verdict…"><span class="fa-qa-tag">KG</span><span class="fa-qa-glyph" aria-hidden="true">…</span></button></span>

يمر كل نوع محتوى بدورة الحياة نفسها، والتي توفرها حزمة المهارات
الشاملة **`content-lifecycle`**:

<div class="bpmn-figure" id="figure-the-content-lifecycle">
  <img src="{{ '/ar/assets/img/workflows/content-lifecycle.svg' | relative_url }}"
       alt="مخطط مسارات BPMN لدورة folio واحدة: يخطط مدير البرنامج، وتُزرع الخطة كـ beans، وتعمل عمليات التحرير والتحقق من التفاعل البشري الحاسوبي (HCI) لكل تغيير مقترح، ويتبع ذلك اختبار تكاملي ومسح لضمان الجودة، ثم المسودة-المراجعة-النشر؛ وتُفرز الملاحظات وتُسجل كـ beans، ثم إما أن تتكرر الدورة أو يُحال الـ folio إلى التقاعد.">
</div>

[مصدر BPMN 2.0](https://github.com/litlfred/folio-assistant/blob/main/processes/content-lifecycle.bpmn) · [ملف SVG بالحجم الكامل]({{ '/assets/img/workflows/content-lifecycle.svg' | relative_url }})
{: .bpmn-source }

| المرحلة | المهارة | ما يجري |
|-------|-------|--------------|
| plan (تخطيط) | `content-plan` | تحديد نطاق العمل، وتحديد المخرجات والجهات الفاعلة |
| author (تأليف) | `content-author` | إنشاء مخرجات مهيكلة من المادة المصدر |
| validate (تحقق) | `content-validate` | التحقق مقابل المخطط + القيود |
| review (مراجعة) | `content-review` | مراجعة بشرية / خبير موضوعي (SME) مقابل المعايير |
| test (اختبار) | `content-test` | ضمان جودة مؤتمت، بناء سليم، نجاح البراهين/أدوات التحقق |
| publish (نشر) | `content-publish` | تصيير الشكل المنشور وتوزيعه |
| feedback (ملاحظات) | `content-feedback` | التقاط ملاحظات المراجعين وتوجيهها |
| retire (إحالة للتقاعد) | `content-retire` | إيقاف استخدام مخرج أو أرشفته |

مراحل دورة الحياة هي نفسها بغض النظر عن نوع المحتوى — ما يختلف هو
مهارات *التأليف* و*المخرجات* التي ينتجها كل نوع. للاطلاع على القائمة الكاملة
للمهارات والأدوار التي تديرها، راجع **[المهارات والأدوار]({{ '/docs/cat-harness/concepts/ar/skills.html' | relative_url }})**.

أمران تخفيهما أسماء المراحل الثمانية، ولا يخفيهما المخطط: لا تمثل المرحلتان `author`
و`validate` مرحلتين متتاليتين بل هما *حلقة تكرارية* — فكل تغيير مقترح يمر عبر
بوابة التحقق من التفاعل البشري الحاسوبي (HCI)، ويرى المحرر النتائج قبل
تثبيت أي شيء — وتتم مرحلة `review` مرتين، مرة لكل تغيير ومرة على
المسودة المجمعة ككل. ويتوسع كلاهما في مخططاتهما الخاصة على صفحة
**[مسار عمل النشر]({{ '/folio-assistant-core/process/ar/publication-workflow.html' | relative_url }})**.

---
