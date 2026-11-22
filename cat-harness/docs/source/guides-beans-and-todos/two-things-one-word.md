The two have different owners, lifecycles and failure modes.

| | **Work item** | **Todo** |
|---|---|---|
| Owner | An agent session | A person |
| Purpose | Process state for work in flight | A reminder of intent |
| Store | `beans/`, committed and shared | Not yet defined |
| Created by | An agent, after an exact-title check | The person, whenever they like |
| Closed by | The agent that did the work, with a summary | The person, on their own judgement |
| Visible to | Every sibling session | The person, primarily |
| Failure mode | Duplicated, or closed by the wrong session | Forgotten |

**The failure modes are what make the split worth keeping.** A duplicated work item
starves the work plan of signal, and an unguarded re-run can duplicate most of
it. A forgotten todo
inconveniences one person. Machinery sized for the first is ceremony on the
second, and machinery sized for the second is nowhere near enough for the
first.
