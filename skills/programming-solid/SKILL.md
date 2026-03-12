---
name: programming-solid
description: Use when designing classes, refactoring code, or adding features to existing object-oriented systems - applies SOLID principles to create maintainable, extensible designs that resist rot and ease future modifications
module: development
---

# SOLID Principles

## Overview

**Core Principle:** Five object-oriented design principles that make code easier to understand, maintain, and extend. Created by Robert C. Martin ("Uncle Bob").

**SOLID is not YAGNI's opposite.** SOLID guides how to structure code you're writing NOW. YAGNI says don't write code for imagined futures. Use both together.

## The Five Principles

| Principle | Acronym | Core Rule |
|-----------|---------|-----------|
| Single Responsibility | **S** | One class = one reason to change |
| Open-Closed | **O** | Open for extension, closed for modification |
| Liskov Substitution | **L** | Subtypes must be substitutable for base types |
| Interface Segregation | **I** | No client forced to depend on unused methods |
| Dependency Inversion | **D** | Depend on abstractions, not concretions |

## When to Apply SOLID

**Apply to:**
- Class design and creation
- Refactoring existing code
- Adding features to OOP systems
- Code reviews

**Especially critical when:**
- Time pressure tempts shortcuts ("I'll just add it here")
- Classes are growing beyond one purpose
- Modifying code breaks unrelated features
- You're copying logic instead of reusing it

## S: Single Responsibility Principle (SRP)

**Rule:** Each class should have exactly one reason to change.

**Test:** Ask "What would cause this class to change?" If you get multiple answers, split the class.

### ❌ SRP Violation

```typescript
// Request: "Add a report generator"
class UserReport {
  collectData(userId: string): UserData {
    // Database queries
  }

  calculateStatistics(data: UserData): Stats {
    // Computation logic
  }

  formatAsJSON(stats: Stats): string {
    // JSON serialization
  }

  sendEmail(json: string): void {
    // SMTP email sending
  }
}
```

**Problems:**
- Database schema change → modify this class
- Stats formula change → modify this class
- JSON format change → modify this class
- Email provider change → modify this class

**Four reasons to change = SRP violation**

### ✅ SRP Compliant

```typescript
class UserDataCollector {
  collectData(userId: string): UserData { }
}

class UserStatsCalculator {
  calculateStatistics(data: UserData): Stats { }
}

class JSONFormatter {
  format(stats: Stats): string { }
}

class EmailSender {
  send(content: string): void { }
}
```

**Each class has ONE reason to change:**
- Data source change → UserDataCollector
- Stats formula → UserStatsCalculator
- Output format → JSONFormatter
- Email provider → EmailSender

## O: Open-Closed Principle (OCP)

**Rule:** Classes should be open for extension but closed for modification.

**Test:** Can you add new behavior without changing existing code?

### ❌ OCP Violation

```typescript
class AreaCalculator {
  calculateTotal(shapes: any[]): number {
    let total = 0;
    for (const shape of shapes) {
      if (shape.type === 'square') {
        total += shape.side * shape.side;
      } else if (shape.type === 'circle') {
        total += Math.PI * shape.radius ** 2;
      } else if (shape.type === 'triangle') {
        total += 0.5 * shape.base * shape.height;
      }
      // Adding pentagon requires modifying this
    }
    return total;
  }
}
```

**Problem:** Every new shape requires modifying AreaCalculator.

### ✅ OCP Compliant

```typescript
interface Shape {
  calculateArea(): number;
}

class Square implements Shape {
  calculateArea(): number {
    return this.side * this.side;
  }
}

class Circle implements Shape {
  calculateArea(): number {
    return Math.PI * this.radius ** 2;
  }
}

class AreaCalculator {
  calculateTotal(shapes: Shape[]): number {
    return shapes.reduce((sum, shape) => sum + shape.calculateArea(), 0);
  }
}

// Add Pentagon without touching AreaCalculator
class Pentagon implements Shape {
  calculateArea(): number { /* ... */ }
}
```

## L: Liskov Substitution Principle (LSP)

**Rule:** Subtypes must be substitutable for their base types without breaking correctness.

**Test:** Can you replace parent with child without the program knowing?

### ❌ LSP Violation

```typescript
class Rectangle {
  setWidth(w: number): void { this.width = w; }
  setHeight(h: number): void { this.height = h; }
  getArea(): number { return this.width * this.height; }
}

class Square extends Rectangle {
  setWidth(w: number): void {
    this.width = w;
    this.height = w; // Violates parent contract
  }

  setHeight(h: number): void {
    this.width = h;
    this.height = h; // Violates parent contract
  }
}

// Breaks when Square used as Rectangle
function test(rect: Rectangle) {
  rect.setWidth(5);
  rect.setHeight(4);
  console.assert(rect.getArea() === 20); // Fails for Square (25 not 20)
}
```

**Problem:** Square changes behavior of setWidth/setHeight unexpectedly.

### ✅ LSP Compliant

```typescript
interface Shape {
  getArea(): number;
}

class Rectangle implements Shape {
  constructor(private width: number, private height: number) {}
  getArea(): number { return this.width * this.height; }
}

class Square implements Shape {
  constructor(private side: number) {}
  getArea(): number { return this.side * this.side; }
}

// No inheritance = no LSP violation
```

## I: Interface Segregation Principle (ISP)

**Rule:** No client should be forced to depend on methods it doesn't use.

**Test:** Does implementing this interface require empty/unsupported methods?

### ❌ ISP Violation

```typescript
interface Animal {
  walk(): void;
  fly(): void;
  swim(): void;
}

class Dog implements Animal {
  walk(): void { /* walks */ }
  fly(): void { throw new Error("Dogs can't fly"); }
  swim(): void { /* swims */ }
}

class Bird implements Animal {
  walk(): void { /* walks */ }
  fly(): void { /* flies */ }
  swim(): void { throw new Error("Not all birds swim"); }
}
```

**Problem:** Every implementer has methods that don't make sense.

### ✅ ISP Compliant

```typescript
interface Walkable {
  walk(): void;
}

interface Flyable {
  fly(): void;
}

interface Swimmable {
  swim(): void;
}

class Dog implements Walkable, Swimmable {
  walk(): void { /* walks */ }
  swim(): void { /* swims */ }
}

class Duck implements Walkable, Flyable, Swimmable {
  walk(): void { /* walks */ }
  fly(): void { /* flies */ }
  swim(): void { /* swims */ }
}
```

## D: Dependency Inversion Principle (DIP)

**Rule:** High-level modules should not depend on low-level modules. Both should depend on abstractions.

**Test:** Can you swap implementations without changing the high-level code?

### ❌ DIP Violation

```typescript
class MySQLDatabase {
  connect(): void { /* MySQL connection */ }
  query(sql: string): any { /* MySQL query */ }
}

class UserService {
  private db: MySQLDatabase;

  constructor() {
    this.db = new MySQLDatabase(); // Tightly coupled
  }

  getUser(id: string): User {
    return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

// Switching to PostgreSQL requires rewriting UserService
```

**Problem:** UserService cannot work with PostgreSQL without modification.

### ✅ DIP Compliant

```typescript
interface Database {
  connect(): void;
  query(sql: string): any;
}

class MySQLDatabase implements Database {
  connect(): void { /* MySQL */ }
  query(sql: string): any { /* MySQL */ }
}

class PostgreSQLDatabase implements Database {
  connect(): void { /* PostgreSQL */ }
  query(sql: string): any { /* PostgreSQL */ }
}

class UserService {
  constructor(private db: Database) {} // Depends on abstraction

  getUser(id: string): User {
    return this.db.query(`SELECT * FROM users WHERE id = ${id}`);
  }
}

// Swap databases without touching UserService
const service = new UserService(new PostgreSQLDatabase());
```

## Red Flags - STOP and Refactor

These indicate SOLID violations:

**SRP violations:**
- "This class also handles..."
- Class name with "And" or "Manager" (UserAndEmailManager)
- Changing unrelated features breaks this class

**OCP violations:**
- "Adding X requires modifying Y"
- Long if/else or switch on types
- "I need to remember to update this when..."

**LSP violations:**
- Child throws UnsupportedOperationException
- Child requires special-case handling
- Subclass weakens preconditions or strengthens postconditions

**ISP violations:**
- Empty method implementations
- NotImplementedException
- "I don't need this method but interface requires it"

**DIP violations:**
- `new ConcreteClass()` in constructors
- Cannot test without real database/API/filesystem
- "To switch X I need to modify Y"

## SOLID vs YAGNI

**Common confusion:** "SOLID says use interfaces, YAGNI says don't over-engineer. Which wins?"

**Answer:** Use both together.

| Scenario | SOLID says | YAGNI says | Do this |
|----------|------------|------------|---------|
| One implementation now | Use interface for DIP | Don't add interface yet | If switching is likely (DB, API) → interface. If internal logic → concrete class |
| Class doing 2+ things | Split into separate classes (SRP) | Only if those things change independently | Split if they have different reasons to change |
| Adding new type | Extend via polymorphism (OCP) | Don't build extensibility for imagined types | If 2+ types exist NOW → use polymorphism. If 1 type → wait for second |

**SOLID guides structure of code you're writing NOW. YAGNI prevents writing code for imagined futures.**

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Splitting this class is over-engineering" | If it has multiple responsibilities, splitting is correct engineering |
| "I need it working fast, I'll refactor later" | Violating SRP now makes refactoring HARDER later |
| "It's just one more method" | One more responsibility = one more reason to change |
| "The class is still small" | Size doesn't matter. Responsibilities do. |
| "Using interfaces is premature abstraction" | DIP isn't premature if you're already coding for multiple implementations |
| "SOLID is for big projects" | SOLID prevents projects from becoming big messes |

## SOLID Checklist

Before committing code, verify:

**Single Responsibility:**
- [ ] Each class has exactly one reason to change
- [ ] Class name describes ONE responsibility (not "Manager" or "Handler")

**Open-Closed:**
- [ ] Adding new types doesn't require modifying existing classes
- [ ] Using polymorphism instead of type-checking conditionals

**Liskov Substitution:**
- [ ] Subclasses don't throw UnsupportedOperationException
- [ ] Subclasses honor parent contracts (same return types, behaviors)

**Interface Segregation:**
- [ ] No empty method implementations
- [ ] Interfaces focused on single client needs

**Dependency Inversion:**
- [ ] High-level code depends on abstractions (interfaces)
- [ ] Can swap implementations without modifying high-level code

## Real-World Impact

**With SOLID:**
- Easier to test (DIP enables mocking)
- Safer to modify (SRP limits blast radius)
- Simpler to extend (OCP enables new features without edits)
- Clearer contracts (LSP and ISP make interfaces predictable)

**Without SOLID:**
- God classes that do everything (SRP violation)
- Fragile code where changes break unrelated features (OCP violation)
- Surprising subclass behaviors (LSP violation)
- Interfaces nobody can fully implement (ISP violation)
- Impossible to test without real database/API (DIP violation)

## References

- Robert C. Martin's original SOLID articles
- Clean Architecture by Robert C. Martin
- DigitalOcean SOLID guide: https://www.digitalocean.com/community/conceptual-articles/s-o-l-i-d-the-first-five-principles-of-object-oriented-design
