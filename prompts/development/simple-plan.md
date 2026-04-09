In the previous step, we made a design specification document for the
requested feature. You can find the location of that document in the
memory store — use the workflow ID from the "Workflow:" line at the top
of this message as the memory domain, and retrieve the key "design-doc".

Read the design document. Then create a **todo.md** file in the same
directory as the design document. This is the only artifact you need to
produce — no overview file, no per-task files, no plan directory.

The todo.md should contain a checklist of implementation tasks derived
from the design document:

```markdown
# Task Tracking

- [ ] Task 1: Brief description
- [ ] Task 2: Brief description
- [ ] Task 3: Brief description
```

Guidelines for writing tasks:
- Each task should be a coherent unit of work (e.g. "Add handler for X",
  "Write tests for Y", "Update config for Z")
- Order tasks by dependency — earlier tasks should not depend on later ones
- Keep descriptions concise but specific enough that an engineer can
  understand the scope without reading the design doc line by line
- Include test tasks — don't bundle "implement and test" into one item

After creating the todo.md, save the following to the memory store:
- "plan" — the path to the directory containing the design doc and todo.md
- "plan-todo" — the path to the todo.md file
