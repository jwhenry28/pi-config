---
name: programming-xunit
description: Use when writing or debugging C# unit tests with xUnit framework - covers test attributes ([Fact], [Theory]), assertions, test organization, and common patterns for .NET testing
module: monogame
---

# xUnit Testing Fundamentals

## Overview

xUnit is a modern unit testing framework for .NET. Tests are plain classes with methods marked by attributes. No base class inheritance required.

## When to Use

**Use xUnit when:**
- Writing unit tests for C# / .NET code
- Setting up new test projects in .NET Core
- Testing invariant conditions or multiple input scenarios

**Use [Fact] for:** Single test scenarios (invariant conditions)
**Use [Theory] for:** Multiple inputs testing the same logic

## Quick Reference

| Scenario | Pattern |
|----------|---------|
| Single test case | `[Fact]` attribute |
| Multiple similar inputs | `[Theory]` with `[InlineData]` |
| Test setup for all tests | Constructor injection |
| Shared expensive setup | `IClassFixture<T>` |
| Test equality | `Assert.Equal(expected, actual)` |
| Test boolean | `Assert.True(condition)` or `Assert.False(condition)` |
| Test exceptions | `Assert.Throws<TException>(() => method())` |
| Test async exceptions | `await Assert.ThrowsAsync<TException>(async () => await method())` |
| Test nulls | `Assert.Null(value)` or `Assert.NotNull(value)` |
| Async test | `async Task` return type, await all async calls |

## Project Setup

```bash
# Create test project
dotnet new xunit -o MyProject.Tests

# Add reference to project under test
dotnet add MyProject.Tests reference MyProject

# Run tests
dotnet test
```

## Core Patterns

### Fact - Single Test Case

```csharp
[Fact]
public void IsPrime_WithTwo_ReturnsTrue()
{
    var result = PrimeChecker.IsPrime(2);
    Assert.True(result);
}
```

### Theory - Multiple Inputs

```csharp
[Theory]
[InlineData(-1, false)]
[InlineData(0, false)]
[InlineData(1, false)]
[InlineData(2, true)]
[InlineData(17, true)]
public void IsPrime_VariousInputs_ReturnsExpected(int input, bool expected)
{
    var result = PrimeChecker.IsPrime(input);
    Assert.Equal(expected, result);
}
```

**Use Theory when:** Testing 2+ similar cases with different inputs. Reduces duplication.

### Test Setup (Constructor)

```csharp
public class CalculatorTests
{
    private readonly Calculator _calculator;

    public CalculatorTests()
    {
        _calculator = new Calculator();
    }

    [Fact]
    public void Add_TwoNumbers_ReturnsSum()
    {
        var result = _calculator.Add(2, 3);
        Assert.Equal(5, result);
    }
}
```

xUnit creates a new instance for each test method. Constructor runs before every test.

### Arrange-Act-Assert (AAA) Pattern

```csharp
[Fact]
public void Divide_ByZero_ThrowsException()
{
    // Arrange
    var calculator = new Calculator();

    // Act & Assert
    Assert.Throws<DivideByZeroException>(() => calculator.Divide(10, 0));
}
```

**Commenting AAA sections:** Optional for clarity in complex tests. Omit in simple tests.

### Async Tests

```csharp
[Fact]
public async Task GetUserAsync_ValidId_ReturnsUser()
{
    var result = await _service.GetUserAsync(1);
    Assert.NotNull(result);
}

[Theory]
[InlineData(0)]
[InlineData(-1)]
public async Task GetUserAsync_InvalidId_ThrowsException(int invalidId)
{
    await Assert.ThrowsAsync<ArgumentException>(() =>
        _service.GetUserAsync(invalidId));
}
```

**Key points:**
- Test method returns `async Task` (not `async void`)
- Always `await` async method calls
- Use `Assert.ThrowsAsync<T>()` for async exceptions

## Common Assertions

```csharp
// Equality
Assert.Equal(expected, actual);
Assert.NotEqual(notExpected, actual);

// Boolean conditions
Assert.True(condition);
Assert.False(condition);

// Nulls
Assert.Null(value);
Assert.NotNull(value);

// Exceptions
Assert.Throws<ArgumentNullException>(() => method(null));

// Collections
Assert.Empty(collection);
Assert.NotEmpty(collection);
Assert.Contains(item, collection);

// Strings
Assert.StartsWith("prefix", actual);
Assert.EndsWith("suffix", actual);
Assert.Contains("substring", actual);
```

## Naming Conventions

**Test class:** `[ClassUnderTest]Tests` or `[ClassUnderTest]_[Method]Should`

**Test method:** `[Method]_[Scenario]_[ExpectedResult]`

Examples:
- `IsPrime_WithNegative_ReturnsFalse`
- `Add_TwoPositives_ReturnsSum`
- `Divide_ByZero_ThrowsException`

## Advanced: Shared Setup with IClassFixture

```csharp
// Expensive setup (database, file system, etc.)
public class DatabaseFixture : IDisposable
{
    public DatabaseConnection Db { get; }

    public DatabaseFixture()
    {
        Db = new DatabaseConnection("test-db");
        Db.Initialize();
    }

    public void Dispose()
    {
        Db.Cleanup();
    }
}

// Test class
public class UserRepositoryTests : IClassFixture<DatabaseFixture>
{
    private readonly DatabaseConnection _db;

    public UserRepositoryTests(DatabaseFixture fixture)
    {
        _db = fixture.Db;
    }

    [Fact]
    public void GetUser_ExistingId_ReturnsUser()
    {
        var user = _db.GetUser(1);
        Assert.NotNull(user);
    }
}
```

**Use IClassFixture when:** Setup is expensive (I/O, network) and can be shared safely across tests.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Multiple [Fact] tests with similar logic | Use [Theory] with [InlineData] |
| Testing multiple scenarios in one test | Split into separate test methods |
| Catching exceptions manually | Use `Assert.Throws<T>()` |
| Forgetting to assert | Every test needs at least one assertion |
| Not following naming conventions | Use descriptive names: Method_Scenario_Result |
| Shared mutable state between tests | Use constructor or IClassFixture properly |
| Using `async void` for tests | Use `async Task` return type |
| Not awaiting async calls | Always `await` async method calls |

## Running Tests

```bash
# Run all tests
dotnet test

# Run specific test class
dotnet test --filter "FullyQualifiedName~ClassName"

# Run with verbose output
dotnet test --verbosity normal

# Run and collect coverage
dotnet test --collect:"XPlat Code Coverage"
```

## Real-World Impact

- **Theory over Facts:** Reduces 10 nearly-identical test methods to 1 Theory with 10 InlineData lines
- **Proper naming:** Makes test failures immediately understandable in CI/CD output
- **IClassFixture:** Reduces test suite time from minutes to seconds when setup is expensive
