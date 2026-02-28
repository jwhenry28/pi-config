---
name: executing-plans
description: Use when partner provides a complete implementation plan to execute in controlled batches with review checkpoints - loads plan, reviews critically, executes tasks in batches, reports for review between batches
---

# Executing Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for architect review.

**Announce at start:** "I'm using the executing-plans skill to implement this plan."

## The Process

### Step 1: Create a new branch
1. If you are on the `main` branch, create a new branch. IF YOU ARE NOT ON `main`, SKIP THIS STEP.
2. NEVER start the plan off the `main` branch.

#### Examples:
starting from `main` branch:
```
$ git rev-parse --abbrev-ref HEAD
main

# on main branch, so you should check out a new branch:
$ git checkout -b claude/hitboxing
```

starting from non-main branch:
```
$ git rev-parse --abbrev-ref HEAD
jwh/hitboxing

# NOT on main branch, so nothing else to do
```

### Step 2: Load and Review Plan
1. Each plan consists of an overview file, a todo.md tracking file, and one file per "task" or "stage".
2. Read overview file and todo.md, as well as the number of tasks you will complete (default to the next three). DO NOT READ OTHER TASK FILES
3. Review critically - identify any questions or concerns about the plan
4. If concerns: Raise them with your human partner before starting
5. If no concerns: Create TodoWrite (ideally one item per task) and proceed

### Step 3: Execute Batch
**Default: First 3 tasks**

For each task:
1. Mark as in_progress in TodoWrite
2. Follow each step exactly (plan has bite-sized steps)
3. **APPLY CLEAN CODE REQUIREMENTS** (see Clean Code Style section below):
   - Use early returns (no nested if/else)
   - Name boolean conditions with descriptive variables
   - Follow stepdown principle (functions in call order)
4. **VERIFY CLEAN CODE COMPLIANCE** - review your code for violations:
   - Any `if/else` blocks? → Refactor to early return
   - Any complex conditions in `if` statements? → Extract to named boolean
   - Any helpers above their callers? → Reorder
5. Run verifications as specified
6. Mark as completed in TodoWrite

### Step 4: Update Progress and Report
When batch complete:
1. **Update todo.md** to check off completed tasks (change `- [ ]` to `- [x]`)
2. Show what was implemented
3. Show verification output
4. Say: "Ready for feedback."

### Step 5: Continue
Based on feedback:
- Apply any requested changes if needed
- Execute next batch
- Repeat until complete

### Step 6: Complete Development

After all tasks complete and verified:
1. **RUN ALL UNIT TESTS** to ensure no regressions:
   ```bash
   dotnet test
   ```
2. **If tests fail:**
   - Attempt to fix the failing tests
   - If you cannot fix them, return control to orchestrator with details
   - DO NOT mark work as complete if tests are failing
3. **If tests pass:**
   - Announce: "I've completed the assigned work. All tests passing."
   - **DO NOT commit changes** - human reviewer will perform commits
   - Wait for further direction

**MANDATORY:** You MUST run `dotnet test` before announcing completion. Skipping tests = incomplete work.

## When to Stop and Ask for Help

**STOP executing immediately when:**
- Hit a blocker mid-batch (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- You don't understand an instruction
- Verification fails repeatedly

**Ask for clarification rather than guessing.**

## When to Revisit Earlier Steps

**Return to Review (Step 1) when:**
- Partner updates the plan based on your feedback
- Fundamental approach needs rethinking

**Don't force through blockers** - stop and ask.

## What NOT to Do

**NEVER:**
- Commit changes (human reviewer handles all commits)
- Push to remote
- Run git add/commit/push commands
- Start work on the main branch (always create a feature branch first)

## Clean Code Style

**MANDATORY:** These are NOT suggestions. Every line of code you write MUST follow these requirements.

**Violating these requirements = incomplete task** - you must refactor before marking complete.

### Early Returns

Reduce nesting by inverting conditions and returning early:

```csharp
// ❌ BAD: Nested if/else
if (someCondition)
{
    doSomeWork();
    doSomeAdditionalWork();
    doSomeWorkAgain();
}

return;

// ✅ GOOD: Early return
if (!someCondition)
    return;

doSomeWork();
doSomeAdditionalWork();
doSomeWorkAgain();

return;
```

**Why:** Reduces cognitive burden and context required as reader progresses through code.

### Named Boolean Conditions

Extract complex conditions into descriptive variables:

```csharp
// ❌ BAD: Inline condition
if (distance < strikingThreshold)
{
    strikeTarget();
}

// ✅ GOOD: Descriptive variable
bool withinStrikingDistance = distance < strikingThreshold;
if (withinStrikingDistance)
{
    strikeTarget();
}
```

**Why:** Makes condition purpose clear without comments.

### Stepdown Principle

Organize functions from high-level to low-level (top-down reading):

- Public functions before private helpers
- Functions defined in the order they're called
- General logic before specific implementation details

**Why:** Creates newspaper-style narrative flow, revealing overall logic before details.

### Common Violations - STOP and Fix

| Violation | Why It's Wrong | Fix |
|-----------|----------------|-----|
| `if (condition) { work(); } else { return; }` | Nested if/else | Invert: `if (!condition) return; work();` |
| `if (distance < threshold)` | Unnamed boolean | Add: `bool withinRange = distance < threshold;` |
| Helper defined before caller | Violates stepdown | Move helper below caller |

**If you wrote any of these patterns, refactor NOW before marking task complete.**

## Remember
- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- **ALWAYS run `dotnet test` at the end** - even if plan doesn't mention it
- Reference skills when plan says to
- **Update todo.md after each batch** - check off completed tasks automatically
- Between batches: just report and wait
- Stop when blocked, don't guess
- **Human reviewer performs all git commits** - you just implement and verify
