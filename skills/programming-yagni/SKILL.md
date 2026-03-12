---
name: programming-yagni
description: Use when implementing features or fixing bugs, especially when tempted to add configurability, abstraction layers, or "future-proof" infrastructure - implements "You Aren't Gonna Need It" principle to prevent over-engineering and speculative code
module: development
---

# YAGNI: You Aren't Gonna Need It

## Overview

**Core Principle:** Implement only what is needed NOW for current requirements. Never add functionality based on speculation about future needs.

**Foundation:** YAGNI is one of the core principles of Extreme Programming (XP), formulated by Ron Jeffries. It's closely related to avoiding premature optimization and keeping code simple.

## When to Apply YAGNI

Apply YAGNI to ALL implementation work:
- Feature development
- Bug fixes
- Refactoring
- API design
- Component creation

**Especially critical when:**
- Adding "flexibility" or "configurability" without current use cases
- Building abstractions for "future extensibility"
- Implementing features because "we'll probably need this"
- Adding parameters or options that aren't currently used
- Creating plugin architectures without multiple concrete plugins

## Red Flags - STOP and Simplify

These phrases indicate YAGNI violations:

- "We'll probably need..."
- "What if we want to..."
- "This makes it more flexible for..."
- "I'll add this parameter just in case..."
- "While I'm here, I should also..."
- "Let me future-proof this by..."
- "I'll build it properly with..."
- "This is more enterprise/production-ready"
- "Good engineers think ahead"

**All of these mean: Remove speculative code. Implement only current requirements.**

## The YAGNI Decision Tree

```
Is this feature/code required for CURRENT functionality?
  YES → Implement it
  NO → Is it needed to fix a bug that's happening NOW?
    YES → Implement the minimal fix
    NO → DON'T implement it
```

## Core Pattern

### ❌ YAGNI Violation

```typescript
// Request: "Add a function to mark todo as complete"

interface TodoAction {
  type: 'complete' | 'uncomplete' | 'archive' | 'delete';
  timestamp: Date;
  userId?: string;
}

class TodoManager {
  private history: TodoAction[] = [];
  private listeners: ((todo: Todo) => void)[] = [];

  markComplete(id: string, userId?: string): void {
    const action: TodoAction = {
      type: 'complete',
      timestamp: new Date(),
      userId
    };
    this.history.push(action);

    const todo = this.findTodo(id);
    todo.completed = true;

    this.notifyListeners(todo);
  }

  // +30 more lines for undo, history, listeners...
}
```

**Problems:**
- History tracking not requested
- Undo functionality speculative
- Event listeners for future features
- User ID tracking not needed
- Action types for features that don't exist

### ✅ YAGNI Compliant

```typescript
// Request: "Add a function to mark todo as complete"

function markComplete(id: string): void {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.completed = true;
  }
}
```

**Why this is better:**
- Solves the stated requirement
- Easy to understand and test
- When undo IS needed, you'll know the real requirements
- Refactoring to add features later is straightforward

## Common YAGNI Violations

| Violation | Example | YAGNI Alternative |
|-----------|---------|-------------------|
| **Premature abstraction** | Interface for single implementation | Concrete class; extract interface when second implementation arrives |
| **Speculative parameters** | `save(data, format?, compression?, encryption?)` | `save(data)` - add parameters when actually needed |
| **Plugin architecture** | Factory + registry for one plugin | Direct implementation; refactor to plugins when multiple arrive |
| **Configuration overkill** | 20 config options for simple feature | Hard-code sensible defaults; extract to config when variation needed |
| **Future-proofing** | Abstract base classes for potential subclasses | Single concrete class; extract base when second subclass appears |

## When to Add Flexibility

Add abstraction/flexibility ONLY when:

1. **You have 2+ concrete implementations NOW**
   - Two payment providers → create interface
   - One payment provider → no interface yet

2. **You're at a system boundary**
   - External API might change → abstract it
   - Internal code you control → keep it concrete

3. **Variation is required by current features**
   - User can choose theme NOW → make it configurable
   - Future themes mentioned → hard-code current theme

4. **Cost of change is genuinely high**
   - Database schema that's expensive to migrate
   - Public API with backward compatibility requirements
   - Even then: minimal design for known requirements

## Refactoring When You Do Need It

YAGNI doesn't mean never refactor. It means refactor WHEN you need it:

```typescript
// Start: One implementation
function processStripeWebhook(data: any) {
  const amount = data.amount / 100;
  return { success: true, amount };
}

// Later: Second provider arrives → NOW refactor
interface PaymentProvider {
  processWebhook(data: any): PaymentResult;
}

class StripeProvider implements PaymentProvider {
  processWebhook(data: any): PaymentResult {
    const amount = data.amount / 100;
    return { success: true, amount };
  }
}

class PayPalProvider implements PaymentProvider {
  processWebhook(data: any): PaymentResult {
    // PayPal-specific logic
  }
}
```

**Why this works:**
- You know BOTH provider's requirements when you design the interface
- The abstraction fits actual use cases, not imagined ones
- You avoid guessing at what future providers might need

## YAGNI and Testing

YAGNI applies to test code too:

### ❌ Speculative test infrastructure
```typescript
class TodoTestBuilder {
  private todo: Partial<Todo> = {};

  withId(id: string): this { this.todo.id = id; return this; }
  withText(text: string): this { this.todo.text = text; return this; }
  withCompleted(completed: boolean): this { /* ... */ }
  withCreatedAt(date: Date): this { /* ... */ }
  withTags(tags: string[]): this { /* ... */ }
  // +10 more builder methods

  build(): Todo { /* ... */ }
}
```

### ✅ YAGNI test approach
```typescript
// Simple factory for actual test needs
function createTodo(overrides?: Partial<Todo>): Todo {
  return {
    id: '1',
    text: 'Test todo',
    completed: false,
    ...overrides
  };
}
```

Add builder pattern when tests become hard to maintain with simple factories.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "It's easier to add now than later" | Wrong. You don't know future requirements. Design will be wrong. |
| "I'm already in this code" | Irrelevant. Adding unnecessary code makes it harder to maintain. |
| "This is best practice" | Practices apply when appropriate. Premature abstraction is anti-pattern. |
| "It's more professional/enterprise" | Unnecessary complexity is unprofessional. Simple code is professional. |
| "It'll save time in the long run" | Studies show 65% of speculative features never get used (see References). |
| "Good architecture plans ahead" | Good architecture responds to actual needs, not imagined ones. |
| "The abstraction is elegant" | Elegance serves no one if it solves imaginary problems. |
| "It's only a few extra lines" | Those lines add complexity, test surface, and maintenance burden. |

## Sunk Cost and YAGNI

**Scenario:** You spent hours building an abstraction layer, then realize it's not needed.

**Sunk cost fallacy:** "I already built it, might as well keep it"

**YAGNI response:** Delete it. The time is already spent. Keeping bad code to justify past work makes the codebase worse. Good engineers recognize when to simplify, even if it means discarding work.

## YAGNI Checklist

Before adding any code, ask:

- [ ] Is this required for CURRENT functionality?
- [ ] Does this solve a problem happening NOW?
- [ ] Am I adding this because "we might need it"?
- [ ] Do I have 2+ concrete use cases for this abstraction?
- [ ] Am I future-proofing against imagined requirements?

If you answer "might need" or "future-proofing" → Remove the speculative code.

## Real-World Impact

**With YAGNI:**
- Faster development (solving actual problems, not imagined ones)
- Simpler codebase (less code to maintain, understand, test)
- Better designs (based on real requirements, not speculation)
- Easier refactoring (less code to change)

**Without YAGNI:**
- Bloated codebase (features that never get used)
- Harder to modify (complexity from speculative code)
- Wrong abstractions (designed for imagined scenarios)
- Wasted effort (65% of anticipated features never materialize)

## References

- Martin Fowler's YAGNI article: https://martinfowler.com/bliki/Yagni.html
- Study showing 64% of features rarely/never used: Standish Group CHAOS Report
- Ron Jeffries on YAGNI in XP: http://ronjeffries.com/xprog/articles/practices/pracnotneed/
