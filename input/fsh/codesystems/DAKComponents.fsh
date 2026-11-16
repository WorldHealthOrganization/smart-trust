CodeSystem: DAKComponents
Title: "DAK components"
Description: "The ten components of a WHO SMART Guidelines Digital Adaptation Kit (DAK), as smart-base's DAK document kind lists them (smart-base document-kinds/dak.json). A Trust Domain's use cases point at these components. Move to smart-base once its DAK logical model publishes a code system for them."
* ^experimental = true
* ^caseSensitive = true
* ^status = #draft
* #health-interventions-and-recommendations "Health Interventions & Recommendations" "Relevant health interventions and recommendations from the WHO guideline and guidance. To inform DAK scope."
* #generic-personas "Generic Personas" "Roles, responsibilities, and essential interventions performed by targeted personas. Example for human centered design."
* #user-scenarios "User Scenarios" "Brief narrative description of how the targeted personas may engage with the digital system. Example for human centered design."
* #generic-business-processes-and-workflows "Business Processes & Workflows" "Generic workflows representing clinical and non-clinical processes. To inform when data is collected and used & required features."
* #core-data-elements "Core Data Elements" "Data elements, used for clinical decision-making, indicators, and other data needs. To inform data collection forms and L3 interoperability requirements."
* #decision-support-logic "Decision Support Logic" "Decision tables representing counselling and treatment algorithms, and any other logic used to determine workflow paths or clinical actions."
* #scheduling-logic "Scheduling Logic" "Decision tables representing scheduling logic according to care plans. Previously combined with decision support logic. Not yet a field of its own in WHO's DAK logical model."
* #programme-indicators "Indicators & Monitoring" "Indicators for reporting & monitoring with numerator, denominator of data elements. Linking person centered data to aggregate."
* #functional-and-non-functional-requirements "Functional & Non-functional Requirements" "A non-exhaustive list of key functions and non-functional requirements for a digital tracking and decision support system. To inform system features."
* #test-scenarios "Test Scenarios" "Test data and scenarios to check a system against the other nine components. A test harness to run them."

ValueSet: DAKComponents
Title: "DAK components"
Description: "All DAK components."
* ^experimental = true
* ^status = #draft
* include codes from system DAKComponents
