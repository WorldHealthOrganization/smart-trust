---
doc_id: isaitb-2026-interoperability-test-bed-readme
doc_title: "Interoperability Test Bed"
section_id: s012-option-1-work-on-angular-ui-through-play-applica
section_title: "Option 1: Work on Angular UI through Play application"
file: "README.md"
lines: 147-162
source_sha256: 0ecf193f1fed8fce
granularity: heading
---
### Option 1: Work on Angular UI through Play application

Using this approach you build the Angular app using Angular CLI but access it through the Play application. To do this:
1. From ``gitb-ui/ui`` issue ``npm run build``. This will build the app and copy it under the Play application's ``assets``
   folder. To rebuild automatically for any changes use ``npm run build:dev``.
2. Access the application by first going to the Play application's welcome page at http://localhost:9000. Once you click
   any of the login options the Angular app will be launched.
3. Once any part of the Angular app is rebuilt you will need to refresh the browser page to see
   changes.     

**When to use this approach:** Using this approach mirrors exactly how the application will run in production. In addition,
you may need to use this approach to effectively test aspects that require interaction with the Play application. These 
include:
- Testing with EU Login enabled (as EU Login's callback returns to the Play application).
- Testing the different login options (e.g. register, demos, confirm role assignment).
