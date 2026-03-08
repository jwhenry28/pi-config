---
name: knowing-clean-code
description: Use when writing or reviewing code - covers stepdown rule, meaningful naming, and managing complexity through function extraction
module: development
---

# Clean Code Principles

## The Stepdown Rule

Order functions by call hierarchy: callers above callees. Reading the file should flow like a narrative from high-level to low-level.

```typescript
// ✅ GOOD: Top-down reading order
function processOrder(order: Order) {
  const validated = validateOrder(order);
  const priced = applyPricing(validated);
  return submitOrder(priced);
}

function validateOrder(order: Order) { /* ... */ }
function applyPricing(order: Order) { /* ... */ }
function submitOrder(order: Order) { /* ... */ }
```

```typescript
// ❌ BAD: Helper defined before caller; reader encounters details before context
function validateOrder(order: Order) { /* ... */ }

function processOrder(order: Order) {
  const validated = validateOrder(order);
  // ...
}
```

## Meaningful Names

Every variable and function name should describe what the entity **is** (variables) or **does** (functions). If you need a comment to explain what a variable holds, rename it.

```typescript
// ❌ BAD
const d = new Date() - startTime;
const list = users.filter(u => u.a);

// ✅ GOOD
const elapsedMs = new Date() - startTime;
const activeUsers = users.filter(user => user.isActive);
```

- **Booleans:** prefix with `is`, `has`, `should`, `can` — e.g. `isValid`, `hasPermission`
- **Functions:** use verb phrases — e.g. `fetchUserProfile`, `calculateTotal`, `parseResponse`
- **Avoid abbreviations** unless universally understood (`id`, `url`, `html` are fine)

## Flatten Nesting

Multiple levels of indentation signal a function doing too much. Extract inner blocks into named helpers.

```typescript
// ❌ BAD: 3+ levels of nesting
function processUsers(users: User[]) {
  for (const user of users) {
    if (user.isActive) {
      for (const order of user.orders) {
        if (order.status === "pending") {
          // 4 levels deep — hard to follow
        }
      }
    }
  }
}

// ✅ GOOD: Flat, readable
function processUsers(users: User[]) {
  const activeUsers = users.filter(user => user.isActive);
  activeUsers.forEach(processPendingOrders);
}

function processPendingOrders(user: User) {
  const pending = user.orders.filter(order => order.status === "pending");
  pending.forEach(fulfillOrder);
}

function fulfillOrder(order: Order) { /* ... */ }
```

**Rule of thumb:** if a block inside `if`/`for`/`switch` is more than a few lines, extract it. Aim for **≤2 levels of indentation** per function.
