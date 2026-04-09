Review the uncommitted code changes against the implementation plan.

Retrieve the plan directory from the memory store — use the workflow ID
from the "Workflow:" line at the top of this message as the memory domain,
and retrieve the key "plan". Read whatever documentation exists in that
directory (design doc, overview.md, todo.md, task files) to understand
what was built and what was intended.

Then review all uncommitted changes (use `git diff`) against four criteria.

**Important:** Multiple workflows often run simultaneously, so `git diff` may
include changes unrelated to this workflow's plan. Ignore any changes in files
or areas that are clearly outside the scope of this plan — they belong to
another workflow. Focus your review only on files and code that are relevant
to the plan you retrieved.

## 1. Correctness

Does the code actually do what the plan asked it to? Look for:
- Missing features or steps from the plan
- Logic errors or incorrect implementations
- Edge cases the plan specified but the code doesn't handle

## 2. Style (Clean Code)

Does the code comply with the knowing-clean-code skill? Look for:
- Nested if/else blocks that should use early returns
- Complex inline conditions that should be extracted to named booleans
- Violations of the stepdown principle (helpers above callers)

## 3. Test Infrastructure

Do test files use the shared test helpers in `pkg/testutils/`? Look for:
- Tests that define their own mock structs for DB, AWS, WhatsApp, LLM, or embedding instead of using `pkg/testutils/` (e.g. `testutils.NewMockServices()`, `testutils/db.MockStore`, `testutils.MockMessenger`)
- Tests that build `services.Services` by hand instead of calling `MockServices.ToServices()`
- Duplicated test setup that already exists in `pkg/testutils/`

## 4. Design (DRY and YAGNI)

Does the code comply with knowing-dry and knowing-yagni? Look for:
- Duplicated logic that should be extracted
- Unnecessary abstractions or features not specified in the plan
- Over-engineering beyond what's needed

## Output

Present your findings organized by category (Correctness, Style, Test Infrastructure, Design).
For each violation found:
- Quote the specific code
- Explain the issue
- Propose a concrete fix

If you find no violations in a category, say so explicitly.

After presenting all findings, ask the user which violations they want
you to fix. Do NOT make any changes until the user responds.
