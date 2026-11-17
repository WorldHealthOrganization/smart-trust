---
doc_id: 9789241511766-eng
doc_title: "9789241511766-eng"
section_id: page-067
section_title: "Page 67"
pages: 67-67
pdf_page: 67
source_pdf: 9789241511766-eng.pdf
source_sha256: 934bdf1193c16ee5
text_source: embedded
granularity: page
---
57
Stability
In this section we discuss how to monitor the stability of technical systems.
Monitoring of system stability is semi-concurrent with functionality monitoring, but it brings additional monitoring 
requirements post-implementation. Unstable systems will perform unreliably, crash or stop unexpectedly, slow down when 
overloaded or otherwise perform erratically. Poor stability may result in improper delivery of the intervention. For example, 
the system may frequently fail to deliver vaccination reminder SMS messages or unreliable performance may make users 
hesitant to use the digital health intervention as intended. A key characteristic of stability monitoring is that it can be 
largely automated after initial testing and during launch.
What to monitor: Digital health applications or systems that rely on physical (non-cloud-based) servers 
for a portion of their operation may find that server outages are a primary source of instability. During 
pre-launch monitoring of stability, the cause of these outages should be identified to the furthest extent 
possible (e.g. power failure or data overload) and efforts made to minimize the risk of future outages. 
■
■
What is the failure rate of SMS messages from the server side?
■
■
If there is a UI to the system, how often are there unexpected application closes, crashes or forced quits?
■
■
How responsive is the digital health system under both normal and anticipated peak conditions for data loads?
How to monitor: Server logs can be used to identify the events that lead up to a server outage. When 
possible, as soon as an outage is detected this should trigger automatic alerts to server support teams, to 
increase the likelihood of diagnosing the problems that led to the outage. SMS client servers record success 
and failure statuses for all messages sent, so it is possible to monitor the failure rate and to set a cut-off point 
for when this rate is deemed unacceptable for the project.
Who will monitor: In many cases, the technical development team – the people who develop and 
maintain the system or server – will be responsible for collecting server logs or application crash reports 
and for diagnosing and reporting on the causes of outages and instability. The project manager should sit 
with this individual or team to understand the source of these problems and if there is anything that can be 
done to prevent repeat outages in the future that cannot be done from the technology development team’s side. Additional 
work may be required by the technology development team to reduce the likelihood of a similar crash in the future, such as 
optimizing the application so that it runs more efficiently.
When to monitor: As with functionality monitoring, a first round of stability monitoring should be 
conducted well in advance of intervention launch. Unlike functionality monitoring, however, it may be 
difficult to get a full picture of system stability during the testing phase. For example, if the project has 500 
system users, there may never be an opportunity to test form submissions, or other similar measures in the 
volume that will occur once the project goes live and has been running and accumulating these events over the course of 
months or years. Setting up systems for continuous stability monitoring is critical for the duration of the intervention, and is 
part of continued stability monitoring under the umbrella of fidelity monitoring in later stages of programme maturity. 
How to use monitoring findings: Despite extensive pre-testing and other precautionary measures, issues 
will inevitably arise. Having automated systems in place to monitor stability is feasible at various maturity 
stages, particularly at the server level. As the intervention moves towards later stages of maturity, these 
systems will need to become more sophisticated. To decrease downtime, alert messages to server managers 
should be triggered when systems go down or automated code can be set up to manage server usage before failure occurs. 
Data on system downtime should be reviewed to look for patterns of instability that can be used to resolve the problems.
How to monitor differently by maturity stage: Stability monitoring is most important during the 
pre-launch phase of a project, but it remains a high priority throughout implementation for interventions 
in early and later stages of maturity. For interventions in later stages of maturity, automated systems can 
be developed to track system stability and immediately inform project managers and supervisors of any 
instability detected. Investing resources in robust, automated stability-monitoring features should reduce the amount 
C H A P T E R 3 : M O N I T O R I N G D I G I T A L H E A L T H I N T E R V E N T I O N S
