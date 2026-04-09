In the previous steps, we made a design document and a todo checklist for
the requested feature. You can find their locations in the memory store —
use the workflow ID from the "Workflow:" line at the top of this message
as the memory domain, and retrieve the keys "design-doc" and "plan-todo".

Read both files. The design document is your specification — it describes
what to build and the design decisions that were made. The todo.md is your
task list.

Execute the next **3 unchecked tasks** from the todo list (or fewer if
less than 3 remain). For each task:
1. Read the design document for context on what's needed
2. Implement the task
3. Mark it complete in todo.md (change `- [ ]` to `- [x]`)

After completing the batch, stop. Do not continue to the next batch —
the workflow will re-enter this step automatically if tasks remain.

Use the design document as your primary reference for requirements, edge
cases, and architecture decisions. If anything is ambiguous, make a
reasonable choice consistent with the design and move on.
