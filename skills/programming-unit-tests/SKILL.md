---
name: programming-unit-tests
description: Use when writing or reviewing unit tests, fixing flaky tests, improving test coverage, or deciding what to test - provides FIRST principles, AAA pattern, mocking guidelines, and behavior-focused testing to create fast, reliable, maintainable test suites
module: development
---

# Unit Testing Best Practices

## Overview

Effective unit tests detect bugs early, enable safe refactoring, and serve as executable documentation. Follow FIRST principles and focus on testing behavior, not implementation.

## When to Use

**Write unit tests when:**
- Implementing any new feature or fix
- Code has public interface worth testing
- Testing modules (independent concepts), not implementation details
- You can test behavior through public API

**Don't test:**
- Pure implementation details (private methods existing only to support public method)
- Framework code (trust MonoGame, ASP.NET, etc.)
- Trivial getters/setters with no logic

## FIRST Principles

| Principle | Meaning | Example |
|-----------|---------|---------|
| **Fast** | Milliseconds per test | Avoid I/O, use in-memory objects |
| **Isolated** | No dependencies between tests | Each test sets up own state |
| **Repeatable** | Same result every run | Mock `DateTime.Now`, `Random` |
| **Self-Validating** | Pass/fail automatic | Use assertions, not manual checks |
| **Timely** | Written during development | Ideally TDD - test first |

## AAA Pattern (Arrange-Act-Assert)

Structure every test in three clear sections:

```csharp
[Fact]
public void TakeDamage_ReducesHealth()
{
    // Arrange - set up test data
    var creature = new Creature { Health = 100, MaxHealth = 100 };

    // Act - execute the behavior being tested
    creature.TakeDamage(30);

    // Assert - verify expected outcome
    Assert.Equal(70, creature.Health);
}
```

**Keep sections visually distinct** - blank line between each section.

## Test Naming

Use descriptive names: `MethodName_Scenario_ExpectedBehavior`

```csharp
// ✅ Good - clear what's being tested
Add_EmptyString_ReturnsZero()
TakeDamage_WhenHealthBecomesZero_SetsIsDeadTrue()
Heal_AtFullHealth_DoesNotExceedMaxHealth()

// ❌ Bad - vague, unclear
TestAdd()
TestCreature()
HealthTest1()
```

## Mocking Guidelines

**Decision tree for mocking:**

```
Should I mock this dependency?

External System? (database, network, files, hardware)
  → YES - Mock it (slow, requires setup, fragile)

Nondeterministic? (DateTime.Now, Random, Thread.Sleep)
  → YES - Mock it (unrepeatable results)

Business Logic? (domain models, in-memory structures)
  → NO - Use real objects (fast, tests actual behavior)
```

**Examples:**

```csharp
// ✅ Good - mock external/nondeterministic
Mock<IFileSystem> mockFs = new Mock<IFileSystem>();
Mock<ITimeProvider> mockTime = new Mock<ITimeProvider>();

// ✅ Good - use real business logic
var world = new World();  // In-memory, fast, tests real behavior
var creature = new Creature { Health = 100 };
```

**Why avoid over-mocking:**
- Tests become brittle (coupled to implementation)
- More code for less value (412 lines vs 263 lines in baseline)
- Tests break on refactoring even when behavior unchanged
- Miss integration bugs between real objects

## Focus on Behavior, Not Implementation

Test **what** the code does, not **how** it does it:

```csharp
// ❌ Bad - tests implementation (method calls)
mockWorld.Verify(w => w.AddEntity(It.IsAny<Flora>()), Times.Once);
mockWorld.Verify(w => w.NotifyObservers(It.IsAny<Event>()), Times.Once);

// ✅ Good - tests behavior (observable outcome)
Assert.Contains(world.GetEntities<Flora>(), f => f.Position == expectedPos);
Assert.True(observer.ReceivedNotification);
```

**Benefits:**
- Survives refactoring (only breaks if behavior changes)
- Clearer intent (shows what matters to users)
- Simpler tests (less mock setup)

## One Test, One Behavior

Each test should verify one specific outcome:

```csharp
// ✅ Good - focused tests
[Fact] public void TakeDamage_ReducesHealth() { ... }
[Fact] public void TakeDamage_WhenLethal_SetsIsDeadTrue() { ... }
[Fact] public void TakeDamage_CannotReduceBelowZero() { ... }

// ❌ Bad - tests multiple things
[Fact]
public void TakeDamage_WorksCorrectly()
{
    // Tests reduction, death, clamping all together
    // Which assertion failed? What broke?
}
```

**Why:** Failing test immediately identifies exact broken behavior.

## Cover All Scenarios

Test happy path, edge cases, and error conditions:

```csharp
// Happy path
Heal_IncreasesHealth()

// Edge cases
Heal_AtFullHealth_DoesNotExceedMaxHealth()
Heal_DeadCreature_DoesNotRevive()
Heal_ZeroAmount_NoChange()

// Boundaries
Heal_ExactlyToMaxHealth()
TakeDamage_ExactlyToZero()

// Error conditions
AddEntity_NullArgument_ThrowsException()
```

**Don't skip edge cases** - baseline testing found critical bugs in edge cases (collection modification during iteration, self-disposing timers).

## Avoid Logic in Tests

Keep tests simple - no `if`, `for`, `switch` statements:

```csharp
// ❌ Bad - logic makes tests complex and error-prone
[Fact]
public void ProcessItems_HandlesAllTypes()
{
    var items = GetTestItems();
    foreach (var item in items) {
        if (item.Type == "Special") {
            Assert.True(item.Processed);
        } else {
            Assert.False(item.Processed);
        }
    }
}

// ✅ Good - separate focused tests or use [Theory]
[Theory]
[InlineData("Special", true)]
[InlineData("Normal", false)]
public void ProcessItems_SetsProcessedFlag(string type, bool expected)
{
    var item = new Item { Type = type };
    processor.Process(item);
    Assert.Equal(expected, item.Processed);
}
```

**Why:** Tests can have bugs too. Keep them simple and obvious.

## Available Test Utilities

Project provides test doubles in `genesis.Tests/testutils/` to avoid MonoGame dependencies (GraphicsDevice, Content pipeline):

| Test Utility | Purpose | Usage |
|--------------|---------|-------|
| **TestRandom** | Deterministic random values | Configure sequences with `SetNextSequence()`, `SetNextFloatSequence()`, `SetRandomPositionSequence()`, `SetRandomDirectionSequence()`. Throws if exhausted. |
| **TestMouseState** | Mock mouse input | Set `X`, `Y`, `LeftButton` properties directly. Implements `IMouseState`. |
| **TestMouseStateProvider** | Control mouse state | Use `SetMouseState()` to update returned state. Implements `IMouseStateProvider`. |
| **TestSpriteManager** | Sprites without assets | Use `RegisterRegion(name, width, height)` to register test sprites. Returns default 16×16 for unregistered names. |
| **TestTileManager** | Tile maps without loading | Constructor sets dimensions. Methods are no-ops for testing. |
| **TestTextureRegion** | Textures without GPU | Constructor takes `(width, height)` or `Rectangle`. No actual rendering. |

**When to use:** Replace external/hardware dependencies (graphics, input devices, file I/O). Use real objects for business logic (entities, world, managers without I/O).

## Test Organization

Organize tests by module/feature, not by method:

```csharp
// ✅ Good - cohesive organization
genesis.Tests/
  entities/
    Creature/
      HealthTests.cs        // All health-related tests
      MovementTests.cs      // All movement-related tests
    Flora/
      GrowthTests.cs

// ❌ Bad - scattered files
genesis.Tests/
  TakeDamageTest.cs
  HealTest.cs
  IsDeadTest.cs
  TakeDamageMoreTests.cs    // Fragment proliferation
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Mocking business logic | Use real objects for domain models |
| Testing implementation details | Test public interface behavior |
| Complex test logic | Use `[Theory]` or separate simple tests |
| Vague test names | Use `MethodName_Scenario_Expected` |
| Testing private methods | Test through public API |
| One giant test | One behavior per test |
| Skipping edge cases | Test boundaries, nulls, empty, errors |
| File proliferation | Group related tests cohesively |

## Quick Reference

**Before writing tests, ask:**
1. What is the unit? (Module, not class. Skip implementation details.)
2. What behaviors need testing? (Public interface outcomes)
3. What can go wrong? (Edge cases, boundaries, errors)
4. What needs mocking? (External/nondeterministic only)
5. How will I know it works? (Arrange-Act-Assert)

**During testing:**
- One behavior per test
- AAA pattern with visual separation
- Descriptive names
- No logic in tests
- Real objects > mocks for business logic

**Test quality indicators:**
- Fast (milliseconds)
- Clear failure messages
- Survives refactoring
- Tests behavior not implementation
- Readable by others

## Real-World Impact

From baseline testing:
- Comprehensive edge case tests found **2 critical bugs** (collection modification exceptions)
- Over-mocking approach: **60% test failure rate**, 412 lines, added Moq dependency
- Real objects approach: **100% pass rate**, 263 lines, no extra dependencies
- Focused tests immediately identified exact failure location

**Bottom line:** Manual testing "works" until edge cases hit production. Comprehensive automated tests catch bugs before deployment.
