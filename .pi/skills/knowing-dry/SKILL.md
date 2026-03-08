---
name: knowing-dry
description: Use when writing new code, reviewing for duplication, or refactoring repeated patterns - applies Rule of Three, extract patterns, and knows when NOT to DRY
module: development
---

# DRY Refactoring

## Process

1. **Identify** — Exact copies, similar patterns, parallel hierarchies, naming patterns (`data1`/`data2`, `handleXClick`)
2. **Analyze** — Coupling, cohesion, frequency (Rule of Three: 3+ occurrences), volatility
3. **Refactor** — Choose technique below, extract incrementally, test after each step

## Rule of Three

Wait for 3+ occurrences before abstracting. Fewer than 3 → leave it alone.

## Techniques

| Technique | When to Use |
| --- | --- |
| **Extract Function** | Same logic in multiple places |
| **Extract Variable** | Repeated expression |
| **Parameterize** | Code differs only in values |
| **Extract Class** | Related functions scattered across files |
| **Polymorphism** | Repeated switch/if-else on type |
| **Strategy Pattern** | Duplicated algorithm selection |
| **Pull Up Method** | Identical methods in subclasses |
| **Configuration over code** | Data structures can eliminate conditionals |
| **Template Method** | Base defines skeleton, subclasses vary steps |

## Detection Smells

Numbered variables (`data1`, `data2`), parallel function names (`handleXClick`, `handleYClick`), near-identical code differing only in constants, repeated validation/error handling, parallel class structures, large switches in multiple places, repeated null checks, magic numbers.

## When NOT to DRY

- **Coincidental similarity** — Different domains that happen to look alike (will diverge)
- **Premature abstraction** — Pattern isn't clear yet; early abstraction guesses wrong
- **Single use** — Appears 1–2 times, unlikely to grow
- **Test clarity** — Readable test setup beats DRY
- **Over-engineering** — Don't abstract every 2–3 line similarity

## Best Practices

- Refactor after green tests, one refactoring at a time
- Name for intent, not implementation
- Commit frequently
- Consider performance implications
