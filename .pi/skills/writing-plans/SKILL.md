---
name: writing-plans
description: Use when design is complete and you need detailed implementation tasks for engineers with zero codebase context - creates comprehensive implementation plans with exact file paths, complete code examples, and verification steps assuming engineer has minimal domain knowledge
module: development
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

## Input

**The skill takes ONE required argument: the path to the design document.**

Example: `/write-plan plans/feature-name/design.md`

**CRITICAL FIRST STEP:** Read the design document at the provided path. This document contains:

- Feature requirements
- Design decisions
- Architecture approach
- What needs to be built

**DO NOT proceed** until you've read and understood the design document.

**Output location:** Write plan files into the same directory as the design document (e.g., `plans/<feature-name>/`).

## MANDATORY Workflow - Follow These Steps IN ORDER

**Step 0: Read the design document**

The argument provided to this skill is the path to the design document. Read it first.

```bash
# Example: if argument is plans/user-auth/design.md
# Use the Read tool to read this file before proceeding
```

**Step 1: Identify the plan directory**

The plan directory is the same directory as the design document (e.g., `plans/<feature-name>/`).

**Step 2: Write overview.md**
Create `plans/<feature-name>/overview.md` with plan header, architecture, task list (see "Overview File Structure" below)

**Step 3: Write todo.md**
Create `plans/<feature-name>/todo.md` with checkboxes for each task:

```markdown
# Task Tracking

- [ ] Task 1: Brief description of task 1
- [ ] Task 2: Brief description of task 2
- [ ] Task 3: Brief description of task 3
```

**Important:** Tasks are marked complete by the engineer executing the plan, ONLY after human reviewer approval.

**Step 4: Write each task to separate file**
For each task, create `plans/<feature-name>/taskN-<descriptive-name>.md`

**File naming:** Use descriptive task names in lowercase with hyphens:

- `task1-registration-validation.md`
- `task2-registration-endpoint.md`
- `task3-jwt-token-generation.md`

**NEVER create a single file like `plans/<feature-name>.md` - this violates the structure requirement.**

**ALWAYS create todo.md to track task completion - this is required for execution workflow.**

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**

- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Overview File Structure

**The `overview.md` file MUST contain:**

```markdown
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

## Tasks

1. [task1-<name>.md](./task1-<name>.md) - Brief description
2. [task2-<name>.md](./task2-<name>.md) - Brief description
3. [task3-<name>.md](./task3-<name>.md) - Brief description

---
```

## Task File Structure

**Each task file (`taskN-<name>.md`) contains:**

````markdown
# Task N: [Component Name]

**Files:**

- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

**Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```
````

**Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

**Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

**Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```

```

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
- DRY, YAGNI, TDD, frequent commits

## Red Flags - STOP and Fix Structure

If you're about to do any of these, you're violating the file structure requirement:

- Creating file `plans/<feature-name>.md` (single file)
- Skipping the directory structure
- Writing multiple tasks into one markdown file
- Thinking "I'll create one file for simplicity"
- Forgetting to create `todo.md` with task checkboxes

**All of these mean: Stop. Create directory structure with separate task files and todo.md.**

## Common Mistakes

| Mistake | Why It's Wrong | Fix |
|---------|----------------|-----|
| Saving entire plan to single `.md` file | Wastes context during execution - engineers load full plan for each task | Create directory with separate task files |
| "I followed the skill structure" while using single file | The skill explicitly requires directory with separate files per task | Re-read MANDATORY workflow section, create directory |
| Combining tasks in one file "for convenience" | Defeats purpose of reducing context usage | One task per file, always |
| "Single file worked before" | The skill was updated to require directory structure | Use new structure, not old approach |

## Execution Handoff

After saving the plan, offer execution choice:

**"Plan complete and saved to `plans/<feature-name>/`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?"**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Stay in this session
- Fresh subagent per task + code review

**If Parallel Session chosen:**
- Guide them to open new session in worktree
- **REQUIRED SUB-SKILL:** New session uses superpowers:executing-plans
```
