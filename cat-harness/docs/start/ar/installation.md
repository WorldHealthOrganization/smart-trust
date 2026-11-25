---
layout: default
title: التثبيت
lang: ar
nav_exclude: true
translation_status: unverified
translation_source: start/installation.md
available_locales: ["ar", "zh", "en", "fr", "ru", "es"]
---

# التثبيت
{: .no_toc }

1. TOC
{:toc}

---

> ما يجب تشغيله **قبل أن تدفع (push)** هو
> [`platform-gates`]({{ '/reference/skill-instructions/platform-gates.html' | relative_url }})؛
> فاجتياز `bun test` ليس هو اجتياز البوابات. وإذا كنت تضع folio-assistant
> فوق مستودع موجود بالفعل، فاقرأ
> [`repo-conversion`]({{ '/reference/skill-instructions/repo-conversion.html' | relative_url }}) أولاً.

## المتطلبات الأساسية

يعمل folio-assistant على [Bun](https://bun.sh) ويتصل بوكيل نموذج لغوي كبير (LLM) عبر
MCP. والمنصة نفسها لا تحتاج إلا إلى Bun؛ أما أنواع المحتوى الفردية فتتطلب
مجموعات أدوات أثقل (LaTeX وLean وFHIR IG Publisher) التي يتم التحقق منها في
وقت التشغيل ويمكن تثبيتها عند الطلب.

| المتطلب | مطلوب لـ | التثبيت (Linux/macOS) | التثبيت (Windows) |
|-------------|-----------|---------|---------|
| **Bun ≥ 1.0** | إطار العمل (دائمًا) | `curl -fsSL https://bun.sh/install \| bash` | `winget install Oven-sh.Bun` |
| Git + git-lfs | مستودعات المحتوى | `apt install git git-lfs` | `winget install Git.Git GitHub.GitLFS` |
| LaTeX (`latexmk`، و`texlive`) | تصيير الأوراق العلمية | `apt install texlive-full latexmk biber` | `winget install MiKTeX.MiKTeX` |
| Lean 4 (عبر `elan`) | الصياغة الرياضية الرسمية للأوراق | `curl …/elan-init.sh \| sh -s -- -y` | راجع [إصدارات elan](https://github.com/leanprover/elan/releases) |
| Java 21 + IG Publisher + SUSHI | أدلة تطبيق WHO SMART (المستوى L3) | راجع [دليل WHO SMART IG](https://litlfred.github.io/folio-assistant/smart-base/guides/who-smart-ig.html) | `winget install EclipseAdoptium.Temurin.21.JDK`، ثم الدليل |
| `pandoc`، و`ripgrep` | التحويلات، والبحث | `apt install pandoc ripgrep` | `winget install JohnMacFarlane.Pandoc BurntSushi.ripgrep.MSVC` |

Bun هو المطلوب فقط. كل صف آخر يخص نوع محتوى معين ويتم فحصه في
وقت التشغيل، لذا لا تثبّت أي شيء آخر حتى يطلبه `check-deps`.


## الاستنساخ والتثبيت

```sh
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
bun install
```

### على Windows، يوجد برنامج نصي

من جهاز مجرد لا يحتوي إلا على عميل git، يقوم هذا البرنامج بتثبيت Bun (عبر winget حيثما
يتوفر)، ويحدّث `PATH`، ويشغل `bun install`، ثم يسلّم المهمة إلى
فاحص القدرات:

```powershell
git clone https://github.com/litlfred/folio-assistant.git
cd folio-assistant
.\cat-harness-tools\scripts\bootstrap.ps1 -CheckOnly   # report only, installs nothing
.\cat-harness-tools\scripts\bootstrap.ps1              # do it
```

وهو يثبت Bun ولا شيء غيره — وتبقى أدوات LaTeX وLean وJava وIG Publisher
لكل نوع محتوى، ويُبلغ عنها `check-deps` مع تلميحات التثبيت.

البرامج النصية للمنصة مكتوبة بلغة bash. وعلى نظام Windows، تعمل هذه البرامج تحت **Git Bash**،
الذي يقوم [Git for Windows](https://git-scm.com/download/win) بتثبيته، لذا فإن `git`
هو المتطلب الإضافي الوحيد. وكل برنامج نصي يشغله المستخدم يدويًا أو يربطه في
تكوين ما، يوجد ملف `.bat` بجانبه — مثل `cat-harness-tools\scripts\install-beans.bat`،
و`cat-harness-tools\scripts\start-folio-assistant.bat`، و`cat-harness-tools\scripts\git-hooks\install.bat`،
و`cat-harness-tools\scripts\session-start-coord-sweep.bat` وما إلى ذلك — حيث يعثر على Git Bash
(ولا يستخدم أبدًا مشغّل WSL الموجود في `System32`) ويشغّل البرنامج النصي الشقيق `.sh` بنفس
المعاملات. استخدم هذه الملفات من `cmd.exe` أو PowerShell أو Task Scheduler أو
عنصر تكوين MCP:

```bat
cat-harness-tools\scripts\install-beans.bat
cat-harness-tools\scripts\upload-to-uploads.bat https://example.org/guideline.pdf
```

أي شيء يحتاجه ملف `.sh` — مثل `bun` و`curl` و`gh` و`elan` — يجب أن يكون موجودًا في
`PATH` الخاص بنظام Windows، نظرًا لأن Git Bash يرثه من برنامج الاستدعاء. والبرامج النصية التي
لا معنى لها إلا على بيئة استضافة Linux (`deploy/`، و`install-tex.sh`، و`setup-sage.sh`،
و`setup-singular.sh`) لا تحتوي على مغلّف عن قصد. وتوجد القائمة في
`cat-harness-tools/scripts/gen-bat-wrappers.sh`؛ ويقوم `bun run cat bat:sync` بإعادة إنشاء المغلّفات،
بينما يتسبب `bun run cat bat:sync:check` في إفشال CI إذا كان أي منها مفقودًا أو قديمًا.

### على Linux/macOS، يوجد أيضًا برنامج نصي

يقوم `cat-harness-tools/scripts/start-folio-assistant.sh` بتثبيت Bun إذا كان مفقودًا ثم
يبدأ تشغيل الخادم، كما أن
`cat-harness-tools/adapters/mcp-server/install.sh` هو برنامج تثبيت أكثر شمولاً يغطي TeX
Live أيضًا.

## فحص بيئتك

يُبلغ فاحص `--check-deps` عن القدرات الموجودة ويقدم
تلميح تثبيت لأي شيء مفقود:

```sh
bun run cat-harness-tools/src/index.ts --check-deps
# or via the npm script
bun run cat check-deps
```

## تشغيل الخادم

إن folio-assistant هو خادم MCP. وهو يدعم وسيطي نقل:

```sh
# stdio transport — what LLM harnesses (Claude Code, etc.) launch
bun run cat-harness-tools/src/index.ts --stdio

# HTTP transport — for a long-running shared instance / the web UI
bun run cat-harness-tools/src/index.ts --http

# point it at the content repo you are authoring (defaults to ../.. )
bun run cat-harness-tools/src/index.ts --stdio --repo /path/to/your/content-repo
```

توجد برامج نصية للملاءمة في `package.json`:

```sh
bun run cat start          # default (stdio)
bun run cat start:http     # HTTP transport
bun run test           # unit tests (bun test)
bun run cat test:e2e       # Playwright end-to-end tests
bun run cat lint           # eslint
```

## التكوين لـ folio الخاص بك

انسخ نموذج التكوين إلى مستودع **المحتوى** الخاص بك (وليس إلى
folio-assistant) واضبطه وفقًا لنوع المحتوى لديك:

```sh
# The DESTINATION is named for your instance -- `my-folio.config.json`, not a
# fixed word. The example file keeps its own name: that is what it is called.
cp cat-harness/docs/reference/harness.config.example.json /path/to/your/content-repo/<your-name>.config.json
```

```json
{
  "contentType": "document",
  "adapter": "document",
  "adapterModule": "./folio-assistant/adapters/document/index.ts",
  "feedbackDir": ".folio-feedback",
  "skills": ".claude/skills/local"
}
```

يحدد `contentType` كلاً من المحول و*ملف تعريف* نوع الكتلة. استخدم
`"paper"` (و`adapters/paper/index.ts`) لـ folio يحتوي على رياضيات مدعومة
بـ Lean — حيث يوسع محول paper محول document، وبالتالي يوفر جميع
أدوات document أيضًا. يكتب `folio_init` هذا الملف نيابة عنك؛ راجع
[بدء folio جديد](https://github.com/litlfred/folio-assistant#start-a-new-folio).

---

## توصيل إطار LLM

يعرض folio-assistant أدواته عبر MCP، لذا يمكن لأي إطار عمل وكيل يدعم MCP
تشغيله. فيما يلي تكوينات للأطر الشائعة. في كل الحالات، يشغّل الوكيل
الخادم عبر **stdio**.

### Claude Code

أضف folio-assistant كخادم MCP. يوجد التكوين على نطاق المشروع في ملف `.mcp.json`
في جذر مستودع المحتوى الخاص بك:

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

أو سجّله من واجهة سطر الأوامر (CLI):

```sh
claude mcp add folio-assistant -- bun run /path/to/folio-assistant/cat-harness-tools/src/index.ts --stdio --repo .
```

يقرأ Claude Code أيضًا `AGENTS.md` / `CLAUDE.md` بشكل أصيل ويلتزم
بخطاف `SessionStart` في `.claude/settings.json` — بحيث يعمل ممهّد
خطة العمل تلقائيًا عند بدء الجلسة.

### Antigravity

يقرأ Antigravity ملف `AGENTS.md` بشكل أصيل ويدعم خوادم MCP وخطاف
دورة الحياة `SessionStart`. أضف الخادم إلى تكوين MCP الخاص به (تنسيق JSON
مشترك مع Gemini CLI):

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

قم بربط ممهّد بدء الجلسة بخطاف `SessionStart` في Antigravity حتى تُمهَّد كل
جلسة بخطة العمل — وجّه أمر الخطاف إلى البرنامج النصي
المشترك `cat-harness-tools/scripts/session-start-coord-sweep.sh` (وهو البرنامج النصي نفسه الذي يستخدمه
كل إطار؛ ويختلف فقط تنسيق تكوين الخطاف باختلاف الأداة).

### Gemini CLI

يقرأ Gemini CLI ملف `AGENTS.md` / `GEMINI.md` بشكل أصيل. سجّل خادم MCP في
إعداداته وأعد استخدام البرنامج النصي نفسه لـ `SessionStart`:

```json
{
  "mcpServers": {
    "folio-assistant": {
      "command": "bun",
      "args": ["run", "/path/to/folio-assistant/cat-harness-tools/src/index.ts", "--stdio", "--repo", "."]
    }
  }
}
```

### أي عميل MCP آخر

وجّه عميلك إلى أمر stdio أعلاه، أو شغّل وسيط نقل HTTP
(`bun run cat start:http`) واتصل عبر HTTP. يتيح خادم MCP أداة
`work_plan_prime` التي يمكن لأي وكيل متصل بـ MCP استدعاؤها للحصول على تمهيد
مباشر ومتطابق لخطة العمل، بغض النظر عن إطار العمل المستخدم.

> **لماذا يعمل هذا عبر الأطر المختلفة.** نقطة الدخول هي `AGENTS.md` (وهو
> معيار لوكلاء Linux Foundation يُقرأ بشكل أصيل بواسطة Claude Code وGemini CLI
> وAntigravity وCursor وCopilot وغيرها)، ويحيل إلى المهارات حيث يكمن الانضباط؛ ويتم إظهار الحالة المباشرة كخطاف
> `SessionStart` لكل إطار عبر برنامج نصي مشترك، وكأداة MCP المسماة
> `work_plan_prime`. راجع صفحة [البنية الهندسية](../../concepts/ar/architecture.html).
