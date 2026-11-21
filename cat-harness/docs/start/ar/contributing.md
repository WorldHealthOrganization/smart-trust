---
layout: default
title: المساهمة
lang: ar
nav_exclude: true
translation_status: unverified
translation_source: start/contributing.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# المساهمة
{: .no_toc }

1. TOC
{:toc}

---

## إعداد التطوير

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
bun test          # اختبارات الوحدة
bun run cat lint      # eslint
bun run cat test:e2e      # e2e (test:e2e)
```

## خطة العمل باستخدام `beans`

يستخدم هذا المشروع [`beans`](https://github.com/hmans/beans) بوصفه الآلية الوحيدة
لقوائم المهام وخطة العمل (مهارة `todo-manager`). **لا** تُنشئ مخزن مهام منفصلًا.

```sh
cat-harness-tools/scripts/install-beans.sh && export PATH="$HOME/.local/bin:$PATH"
beans list
beans create "<العنوان>"
bun run cat beans:claim <id>      # احجزه قبل أن تبدأ العمل
```

`beans ≠ sidecars`: لا تستخدم `beans create` مطلقًا لطوابير المهام المجمعة المولدة آليًا (QA وwitness وwatcher) — فتلك تظل كملفات JSON مجمعة.

## إرشادات الوكلاء

يُعدّ `AGENTS.md` نقطة الدخول العامة للوكلاء (تتم قراءته تلقائيًا بواسطة Claude Code
وGemini CLI وAntigravity وCursor وCopilot)، أما `CLAUDE.md` و`GEMINI.md` فهما مجرد ملفات
نائبة مقتضبة تشير إليه. القواعد موجودة في المهارات: لتغيير سلوك الوكلاء عدّل المهارة،
لا `AGENTS.md`.

## التوثيق

- توجد المستندات النثرية في `docs/` (موقع Jekyll هذا).
- **مرجع مخططات المهارات** مُولَّد آليًا — إياك وتعديل
  `docs/reference/skills/*.md` يدويًا. عدّل مخططات JSON Schemas الموجودة تحت
  `schemas/skills/<skill>/` ثم أعد التوليد:

  ```sh
  bun run cat-harness-tools/scripts/gen-schema-docs.ts
  ```

- **تعليمات المهارات** (`docs/reference/skill-instructions/*.md`) مُولَّدة
  آليًا أيضًا — إياك وتعديلها يدويًا. عدّل نصوص المهارات تحت
  `skills/` أو `sdlc/skills/` أو `work-plan/skills/` ثم أعد التوليد:

  ```sh
  bun run cat-harness-tools/scripts/gen-skill-docs.ts
  ```

- يُولَّد **مرجع واجهة برمجة تطبيقات TypeScript** (`/api/`) بواسطة TypeDoc في CI.
- يتم بناء الموقع ونشره على صفحات GitHub (GitHub Pages) بواسطة
  `.github/workflows/docs-site.yml` عند كل دفع (push) إلى `main` يمس التوثيق أو
  المخططات أو الشفرة المصدرية.

المعاينة محليًا:

```sh
cd docs
bundle install
bundle exec jekyll serve
```

## شحن التغيير

افتح طلب السحب (PR) عند أول إيداع (commit) وادفع زيادات صغيرة
(`skills/conduct/conduct-core/continual-progress.md`)؛ ثم أوصل الفرع إلى حالة نظيفة وخضراء
ومدفوعة باستخدام `sdlc/skills/sdlc-core/prepare-merge.md`. حافظ على **فصل الصياغة الرسمية لإطار العمل
عن المحتوى** — فالمحتوى ينتمي إلى مستودعه الخاص، وأي محتوى
في هذه المستندات هو توضيحي فقط.
