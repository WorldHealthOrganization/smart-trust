---
doc_id: 9789241509510-eng
doc_title: "9789241509510_eng"
section_id: page-068
section_title: "Page 68"
pages: 68-68
pdf_page: 68
source_pdf: 9789241509510_eng.pdf
source_sha256: 26aa12fbae4eafb2
text_source: embedded
granularity: page
---
58
Use application programming interface (API) to facilitate systems interoperability
To promote integration with national systems such as DHIS2, some projects have begun to use API, 
which is a set of tools and protocols that facilitates links between a system and third-party software. 
The API can be viewed as the technological synapse or interface between the system and the project-
specific software, and it includes the protocol and necessary codes for retrieving and exchanging data 
with another system (see http://www.3scale.net/wp-content/uploads/2012/06/What-is-an-API-1.0.pdf). 
The use of standard APIs 
proved critical for the national 
mTrac system in Uganda. This 
monitoring and surveillance 
system facilitates the flow of 
the HMIS reports and tracks 
indicators relating to health 
service delivery. When the MOH, 
UNICEF and WHO first launched 
mTrac, they encountered 
challenges with DHIS2 
interoperability due to the lack 
of a centrally managed database 
of health-care facilities. 
The facility data used within both mTrac and DHIS2 over the first two years diverged significantly 
due to minor spelling changes in the names of facilities, as well as changes in the level of services 
provided. The lack of a common unique identification number compounded this problem. In Uganda, 
this made it impossible to match and exchange with certainty up to 40% of the data between these 
two systems. To overcome this obstacle, the Ugandan MOH advised that DHIS2 should serve as the 
temporary master facility registry and the reference health-care facility library for all other digital 
health applications. Subsequently, the OpenHIE Facility Registry Database API was adopted and 
integrated into both mTrac and DHIS2. This allowed other government-approved systems to sync 
with the centrally managed health-care facility registry and ensured they were reporting against the 
same health-care facility. (See https://facility-registry-api.readthedocs.org/en/latest/api_specifications.
html for an example of the codes and protocol used.)
 
4DOMAIN 10: ADAPTABILITY
Lessons from 
the field
Foster a culture of documentation 
Technology development is an iterative process requiring documentation of key steps from 
launch to testing to maintaining the identified product. This process is critical for updating the 
applications as well as facilitating their adaptability to and replication in new contexts. Routine 
and thorough documentation should be encouraged such that all inputs and changes are 
noted, and project teams should establish a systematic process for housing and maintaining 
these records. Wikis and web-based hosting services can be used to document these inputs 
and enforce their persistence. Wikis consist of websites or databases that can manage internal 
documentation information and allow users to contribute content housed within one common 
source. Wikis can be used internally or made accessible to the public. Online data hosting 
repositories, such as GitHub (https://github.com/), have similar functions in central storage of 
instructions across a community of users. However, GitHub also logs software code versioning 
and tracks troubleshooting efforts across different collaborators so they can document their 
processes and organize tasks in a way that allows them to be accessible for future use.  
Tips and 
considerations
Example of the mTRAC API codes used for integration with the central health 
facility registry system
