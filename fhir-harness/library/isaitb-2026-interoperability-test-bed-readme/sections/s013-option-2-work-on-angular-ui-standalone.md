---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s013-option-2-work-on-angular-ui-standalone
section_title: "Option 2: Work on Angular UI standalone"
file: "README.md"
lines: 163-177
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
### Option 2: Work on Angular UI standalone 

Using this approach you build and serve the Angular app using Angular CLI. In this scenario the Play application
is only used through its REST API which the Angular app proxies and uses. To use this approach:
- Only once from ``gitb-ui/ui`` issue  ``npm run build``. This is needed to put in place static resources used by the Angular app
  (most notably tinymce styles).
- From ``gitb-ui/ui`` issue ``npm start``. This reloads the app upon detected changes.
- Access the application at http://localhost:4200 (this will be automatically opened for you).  

**When to use this approach:** This approach is the most efficient as it allows use of the lightweight CLI server
and provides automatic refresh for build changes. The problem with this approach is that it cannot cover
cases where you need to test interactions with the Play application (e.g. when EU Login is used for authentication).
Having said this however, you can still use this after you have authenticated using the Play application given that
authentication cookies are shared.
