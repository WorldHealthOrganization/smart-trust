---
# folio-assistant-yscf
$schema: bean/1.0.0
title: 'PROVENANCE REFUSAL: yl-3.pdf (ML resource optimization for hybrid ETL) is not admissible as evidence'
status: completed
type: task
priority: normal
created_at: 2026-09-23T22:30:19Z
updated_at: 2026-09-24T00:17:04Z
parent: folio-assistant-slw1
---

Owner attached `yl-3.pdf` on 2026-09-23 with no instruction, then chose *"verify
provenance first, then report"* over ingesting it. This is that report. **Nothing
was filed**; the PDF is not in `uploads/` and no library entry exists.

The document: "Machine Learning–Based Resource Optimization for Hybrid ETL
Pipelines Across Multi-Cloud Platforms", attributed to Anjali Sharma (Stanford),
Wei Chen (MIT), Carlos Rodríguez (ETH Zürich), Priya Nair (University of
Washington) and Kenji Tanaka (University of Tokyo). 10 pages, A4.

## The decisive finding, and it is checkable rather than a judgement

**A ten-page paper whose stated contribution is an optimization algorithm
contains one `=` character and no equations.**

Measured over the extracted text:

| symbol | count |
|---|---|
| `=` | **1** |
| `∑` | 0 |
| `λ`, `π`, `θ` | 0 |
| `argmax` / `argmin` | 0 |
| `←` | 0 |
| `α`, `β`, `γ` | 2, 2, 3 |

The abstract promises *"an Enhanced Flower Pollination Algorithm integrated with
Q-learning"*, *"deep reinforcement learning (DRL) with a multi-agent
architecture"* and *"the multi-objective optimization challenge of balancing
cost, performance, and reliability."* There is **no objective function, no
reward definition, no pseudocode and no algorithm listing**. Table 2, captioned
"Key Components of the Hybrid Optimization Algorithm", is a prose table of
component names and hyperparameters (“100 trees, Gini impurity, max depth
15”).

An optimization method that is never written down cannot be implemented,
checked, or cited for a mechanism. That is not a style complaint — it means
there is no claim here an agent could ground anything on.

## Provenance, separately

| checked | result |
|---|---|
| DOI, venue, submission/acceptance dates | **none anywhere in the document** |
| exact title, web search | **no hit** |
| the five authors together, web search | **no hit**; individually the names resolve to unrelated people in unrelated fields |
| PDF metadata | Author `ola`; Creator and Producer `Microsoft® Word 2016`; created and modified 2026-02-07 11:48:24 UTC, one minute apart |
| filename as supplied | `yl-3` |

Five authors, five different elite institutions, no shared lab, no corresponding
address, no contact. Compare arXiv:2607.14456v1, ingested the same day: seven
authors, ONE employer, a named venue (SCALE @ ICML 2026, PMLR 306), a
corresponding email, and a GenAI usage disclosure.

## What is NOT wrong with it, stated because it matters

Being fair to the document is part of the check, and two signals point the other
way:

1. **The references appear to be real.** Spot-checked — Arul (2021) in the
   *International Journal of Engineering and Computer Science*, Carvalho et al.
   (2018) in *Future Generation Computer Systems*, Haase et al.
   (arXiv:2203.10289), Kathiravelu et al. (arXiv:1804.08985). This is **not** the
   fabricated-citation pattern.
2. **The experimental setup is specific.** CloudSimPlus with custom ETL modules,
   three named providers, VM classes from 2 vCPU/4 GB to 64/256, TPC-DI modified
   for multi-cloud, three named baselines (Cost-First, Performance-First,
   Round-Robin), five named metrics.

So this is not obviously machine-generated slop. It is something more specific:
a document with a plausible surface and **no formal core**, whose headline
results — 34.7 % cost reduction, 41.2 % completion-time improvement, 28.9 %
utilization — come from a simulation of an algorithm it does not specify,
against *"real-world ETL traces from anonymized enterprise data integration
platforms processing approximately 2.4 billion rows daily"* that name no source.

## The recommendation

**Do not file it in any `library/` as evidence.** An entry in `library/` reads as
admitted — that is what `evidence:` on a methodology node means — and nothing
here can back a methodology node, because there is no method stated to adopt.

Three things it could still legitimately be, if the owner wants one:

1. **A negative exemplar.** This repository has no worked example of a source
   that FAILS admission, and the check that caught it (“count the equations
   against the claimed contribution”) is a good one that nothing currently
   writes down. That would be a skill, not a library entry.
2. **A pointer.** Its reference list is a usable reading list on multi-cloud
   workflow scheduling, and several entries are real papers with DOIs. The
   references are worth more than the document.
3. **Nothing.** Perfectly reasonable. It was attached without an instruction and
   may not have been meant for ingestion at all.

## The references, carried out — owner's ruling, 2026-09-23

*"Keep the references, discard the paper."* So the 43 citations below are
recorded here and **the document is not filed anywhere.**

**READ WHAT THESE ARE BEFORE USING ONE.** They are a reading list on multi-cloud
workflow scheduling, transcribed out of a document that FAILED admission. That
provenance does not transfer:

- **Four were spot-checked** and resolve to real work — Arul (2021), Carvalho
  et al. (2018) in *Future Generation Computer Systems*, Haase et al.
  (arXiv:2203.10289), Kathiravelu et al. (arXiv:1804.08985).
- **The other 39 are UNCHECKED.** Nobody has confirmed they exist, and a
  citation list being mostly real is not the same as every entry being real.
- **Nothing here is endorsed.** A citation in a document says the author cited
  it, not that it is good, relevant, or says what the citing document claimed.
  The citing document's own claims could not be checked at all.

So this is a list of things to LOOK UP, and the first step for any of them is
`literature-search`, which resolves a source rather than trusting a reference
string. A bean rather than a `library/` entry, deliberately: `library/` means
held and admitted, and none of these is either.

```text
- Arul, K. (2021). Optimizing data pipelines in cloud-based big data ecosystems: A comparative study of modern ETL tools. International Journal of Engineering and Computer Science, 10(4), 45-62.
- Baer, S., Bakakeu, J., Meyes, R., & Meisen, T. (2019). Multi-agent reinforcement learning for job shop scheduling in flexible manufacturing systems. Proceedings of the Second International Conference on Artificial Intelligence for Industries, 22-25.
- Carvalho, J., Trinta, F., Vieira, D., & Cortes, O. (2018). Evolutionary solutions for resources management in multiple clouds: Stateof-the-art and future directions. Future Generation Computer Systems, 88, 284-296.
- Carvalho, J., Vieira, D., & Trinta, F. (2018). Dynamic selecting approach for multi-cloud providers. In Cloud Computing and Services Science (pp. 37-51). Springer.
- Chen, Z., Lin, K., Lin, B., Chen, X., Zheng, X., & Rong, C. (2020). Adaptive resource allocation and consolidation for scientific workflow scheduling in multi-cloud environments. IEEE Access, 8, 90531-90544.
- Farid, M., Latip, R., Hussin, M., & Hamid, N. (2020). Scheduling scientific workflow using multi-objective algorithm with fuzzy resource utilization in multi-cloud environment. IEEE Access, 8, 144345-144362.
- George, J. (2022). Optimizing hybrid and multi-cloud architectures for real-time data streaming and analytics: Strategies for scalability and integration. World Journal of Advanced Engineering Technology and Sciences, 7(1), 305-318.
- Grzegorowski, M., Zdravevski, E., Janusz, A., Lameski, P., Apanowicz, C., & Slezak, D. (2021). Cost optimization for big data workloads based on dynamic scheduling and cluster-size tuning. Big Data Research, 25, 100203.
- Guerrero, C., Lera, I., & Juiz, C. (2018). Resource optimization of container orchestration: A case study in multi-cloud microservices-based applications. Journal of Supercomputing, 74(7), 2956-2983.
- Haase, C., Röseler, T., & Seidel, M. (2022). METL: A modern ETL pipeline with a dynamic mapping matrix. arXiv preprint arXiv:2203.10289.
- Kakarla, R., & Sannareddy, S. B. (2024). AI-driven DevOps automation for CI/CD pipeline optimization. The Eastasouth Journal of Information System and Computer Science, 2(01), 70-78.
- Kang, S., Veeravalli, B., & Aung, K. (2018). Dynamic scheduling strategy with efficient node availability prediction for handling divisible loads in multi-cloud systems. Journal of Parallel and Distributed Computing, 113, 1-16.
- Kathiravelu, P., Sharma, A., Galhardas, H., Van Roy, P., & Veiga, L. (2018). On-demand big data integration: A hybrid ETL approach for reproducible scientific research. arXiv preprint arXiv:1804.08985.
- Kaur, R., Anand, D., Kaur, U., & Verma, S. (2024). Integrative resource management in multi-cloud computing: A DRL based approach for multi-objective optimization. EAI Endorsed Transactions on Smart Cities, 8(2), 1-12.
- Keshavarzi, A., Haghighat, A. T., & Bohlouli, M. (2020). Enhanced time-aware QoS prediction in multi-cloud: A hybrid k-medoids and lazy learning approach (QoPC). Computing, 102(4), 923-949.
- Khan, M. (2020). Optimized hybrid service brokering for multi-cloud architectures. Journal of Supercomputing, 76(1), 666-687.
- Kritikos, K., Zeginis, C., Iranzo, J., Gonzalez, R., Seybold, D., Griesinger, F., & Domaschk, J. (2019). Multi-cloud provisioning of business processes. Journal of Cloud Computing: Advances, Systems and Applications, 8(1), 1-26.
- Kumar, R. (2021). Multi-cloud and hybrid cloud strategies – Balancing flexibility, cost, and security. International Journal for Multidisciplinary Research, 3(2), 1-9.
- Li, C., Zhang, J., & Tang, H. (2019). Replica-aware task scheduling and load-balanced cache placement for delay reduction in multi-cloud environment. Journal of Supercomputing, 75(5), 2805-2836.
- Li, J., Lin, Y., Jia, X., & Ren, K. (2019). Multiple-replica integrity auditing schemes for cloud data storage. Concurrency and Computation: Practice and Experience, 31(21), e4805.
- Lijin, P. (2018). Resource allocation in multi-cloud based on usage logs. International Journal of Scientific Research in Computer Science, Engineering and Information Technology, 3(5), 239-245. Tayal C. Designing Hybrid ETL Pipelines for Multi-Cloud Integration. IJETCSIT [Internet]. 2023 Dec. 30 [cited 2026 Jan. 29];4(4):129-34. Available from: https://www.ijetcsit.org/index.php/ijetcsit/article/view/468
- Mamidala, J. V., Attipalli, A., Enokkaren, S. J., Bitkuri, V., Kendyala, R., & Kurma, J. (2024). A survey on hybrid and multi-cloud environments: Integration strategies, challenges, and future directions. International Journal of Humanities and Information Technology, 7(3), 1-18.
- Masdari, M., & Zangakani, M. (2019). Efficient task and workflow scheduling in inter-cloud environments: Challenges and opportunities. Journal of Supercomputing, 75(2), 499-535.
- Mishra, S., Mishra, S., Alsayat, A., Jhanjhi, N., Humayun, M., Sahoo, K., & Luhach, A. (2020). Energy-aware task allocation for multi-cloud networks. IEEE Access, 8, 178577-178588.
- Mohammadi, S., Pedram, H., & Karimi, A. (2018). Integer linear programming-based cost optimization for scheduling scientific workflows in multi-cloud environments. Journal of Supercomputing, 74(10), 4717-4745.
- Kakarla, R., & Sannareddy, S. B. (2024). Ai-Driven Devops Automation for Ci/Cd Pipeline Optimization. The Eastasouth Journal of Information System and Computer Science, 2(01), 70–78. https://doi.org/10.58812/esiscs.v2i01.849
- Panda, S. K., & Jana, P. K. (2015). Efficient task scheduling algorithms for heterogeneous multi-cloud environment. Journal of Supercomputing, 71(4), 1505-1533.
- Panda, S. K., & Jana, P. K. (2017). SLA-based task scheduling algorithms for heterogeneous multi-cloud environment. Journal of Supercomputing, 73(6), 2730-2762.
- Panda, S., Gupta, I., & Jana, P. (2019). Task scheduling algorithms for multi-cloud systems: Allocation-aware approach. International Journal of Networking and Virtual Organisations, 21(3), 241-259.
- Paraiso, F., Merle, P., & Seinturier, L. (2016). SoCloud: A service-oriented component-based PaaS for managing portability, provisioning, elasticity, and high availability across multiple clouds. Computing, 98(5), 539-565.
- Petcu, D. (2014). Consuming resources and services from multiple clouds. Journal of Grid Computing, 12(2), 321-345.
- Qi, Q., Wang, J., Ma, Z., Sun, H., Cao, Y., Zhang, L., & Liao, J. (2019). Knowledge-driven service offloading decision for vehicular edge computing: A deep reinforcement learning approach. IEEE Transactions on Vehicular Technology, 68(5), 4192-4203.
- Rashida, S., Sabaei, M., Ebadzadeh, M., & Rahmani, A. (2020). A memetic grouping genetic algorithm for cost-efficient VM placement in multi-cloud environment. Cluster Computing, 23(2), 797-836.
- Singu, S. K. (2021). Real-time data integration: Tools, techniques, and best practices. ESP Journal of Engineering & Technology Advancements, 1(1), 158-172.
- Souri, A., Rahmani, A., & Rezaei, N. (2020). A hybrid formal verification approach for QoS-aware multi-cloud service composition. Cluster Computing, 23(4), 2453-2470.
- Subramanian, T., & Savarimuthu, N. (2016). Application-based brokering algorithm for optimal resource provisioning in multiple heterogeneous clouds. Vietnam Journal of Computer Science, 3(1), 57-70.
- Tayal, C. (2023). Designing Hybrid ETL Pipelines for Multi-Cloud Integration. International Journal of Emerging Trends in Computer Science and Information Technology, 4(4), 129-134.
- Thirumalaiselvan, C., & Venkatachalam, V. (2019). A strategic performance of virtual task scheduling in multi-cloud environment. Cluster Computing, 22(6), 14069-14080.
- Ugala, M. (2024). Cost-optimized ETL modernization: Transitioning traditional workloads to cloud-native IDMC/IICS + AWS. Journal of Information Systems Engineering and Management, 9(1), 1-15.
- Wang, Y., Liu, H., Zheng, W., Xia, Y., Li, Y., Chen, P., Guo, K., & Xie, H. (2019). Multi-objective workflow scheduling with deep-Q-network-based multi-agent reinforcement learning. IEEE Access, 7, 39974-39982.
- Zdravevski, E., Lameski, P., Dimitrievski, A., Grzegorowski, M., & Apanowicz, C. (2019). Cluster-size optimization within a cloud-based ETL framework for big data. Proceedings of the 2019 IEEE International Conference on Big Data, 3754-3763.
- Zhang, L., Wang, Q., Sun, H., & Liao, J. (2019). Multi-task deep reinforcement learning for scalable parallel task scheduling. Proceedings of the 2019 IEEE International Conference on Big Data, 2992-3001.
- Zhan, W., Luo, C., Wang, J., Wang, C., Min, G., Duan, H., & Zhu, Q. (2020). Deep-reinforcement-learning-based offloading scheduling for vehicular edge computing. IEEE Internet of Things Journal, 7(6), 5449-5465.
```

## Done when

- [x] provenance verified and reported
- [x] owner ruled: references kept here, paper discarded
- [ ] nothing further — close when the owner has read it
