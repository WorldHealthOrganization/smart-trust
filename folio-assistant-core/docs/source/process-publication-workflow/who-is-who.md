The roles in the lanes, and the actor definition each one maps to. Roles
**inherit** (`viewer` → `reviewer` → `author` → `admin`). What an actor may
**do** is not a property of its role: it is an ODRL rule in `policies/`, and
before every task the BPMN executor checks that the actor is authenticated,
eligible for the lane's role, permitted by policy and allowed to touch the
content ([`task-authorization`](../../skills/process/process-core/task-authorization.md)).
