---
name: knowing-yagni
description: Use when implementing changes - enforces strict scope discipline, prevents feature creep, unsolicited improvements, and over-engineering
---

# Knowing YAGNI (You Aren't Gonna Need It)

## Core Principle

```
If the user didn't explicitly ask for it → ASK before doing it.
```

**The Test**: Can you point to the exact words in the user's request that ask for this change?

- ✅ YES → Proceed
- ❌ NO → Ask the user before proceeding

## Scope Classification

Before implementing, classify every potential change:

| Category | Definition | Action |
| --- | --- | --- |
| **In Scope** | Explicitly requested by user | ✅ Implement |
| **Unclear** | Implied but not explicit | ⚠️ Ask first |
| **Out of Scope** | Not mentioned at all | ❌ Don't implement |

## Common Violations

| Violation | Example | Do Instead |
| --- | --- | --- |
| **Adding features** | Fix a bug → also add logging | Ask: "Should I also add logging?" |
| **Refactoring adjacent code** | Update one function → refactor whole file | Ask: "Should I refactor surrounding code?" |
| **Adding validation** | Add form field → add comprehensive validation | Ask: "What validation rules do you want?" |
| **Creating abstractions** | One implementation → reusable utility | Ask: "Should I make this reusable?" |
| **Documentation** | Write code → add extensive comments | Ask: "Should I add documentation?" |
| **Testing** | Build feature → write comprehensive tests | Ask: "Should I write tests for this?" |
| **Error handling** | Implement happy path → add try-catch everywhere | Ask: "What error handling do you want?" |
| **Optimization** | Implement feature → optimize for performance | Ask: "Should I optimize this?" |

## Non-Negotiable Rules

1. **User words are the contract.** The user's exact words define the scope—nothing else.
2. **No mind reading.** Don't assume intent beyond their words.
3. **Ask before improving.** Every unsolicited "improvement" requires explicit approval—including better names, algorithms, error handling, validation, organization, comments, tests, or optimizations.
4. **One feature at a time.** Implement exactly what was requested, no bundling.
5. **Resist rationalization.** "It's just small", "It'll save time later", "It's best practice", "They'll want this"—all require asking first.

## Anti-Patterns

### The "While I'm Here" Fallacy

Editing a file doesn't justify fixing/improving nearby code. Finish the requested change, then ask about other opportunities separately.

### The "Future-Proofing" Trap

Don't build generic/reusable/flexible for unknown future needs. Build exactly what's needed now. Refactor when future needs are actual.

### The "Best Practice" Excuse

Best practices are context-dependent. The user defines requirements. Ask: "Best practices suggest X. Should I include that?"

### The "Obvious Improvement" Mirage

"Obvious" is subjective. State the improvement, ask if it should be included.

## When YAGNI Doesn't Apply

You CAN act without asking for:

1. **Critical bugs** that would break the requested change (e.g., syntax errors)
2. **Security vulnerabilities** being introduced (e.g., unsanitized input)
3. **Data loss prevention** (e.g., warn about irreversible deletes)

Even then, mention what you did and why.

## Workflow

1. **Parse**: Extract ONLY what was explicitly requested, word-by-word
2. **Classify**: Mark every potential change as in-scope, unclear, or out-of-scope
3. **Ask**: Question any unclear or out-of-scope changes before implementing
4. **Implement**: Write only the code needed for requested changes using existing patterns
5. **Report**: List changes made (matching request 1:1) and opportunities identified but not implemented

## Output Format

```markdown
## Changes Made
[List only what was explicitly requested]

## Opportunities Identified (Not Implemented)
[List potential improvements noticed but skipped]

Would you like me to address any of these opportunities?
```
