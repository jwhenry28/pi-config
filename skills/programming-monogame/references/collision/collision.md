---
id: collision
sidebar_label: Collision
title: Collision
description: Actor/world collision management and low level 2D collision queries for MonoGame.Extended.
---

:::tip[Up to date]
This page is **up to date** for MonoGame.Extended `@mgeversion@`. If you find outdated information, [please open an issue](https://github.com/monogame-extended/monogame-extended.github.io/issues).
:::

The MonoGame.Extended collision system in 6.0 is split into two layers:

- a low level geometry layer built around explicit bounding volumes and `Collision2D`
- an actor/world layer built around `ICollisionActor`, `CollisionShape2D`, and `CollisionWorld2D`

This separation lets you choose the level of abstraction that fits your game. If you want to manage actors, layers, and broadphase queries, start with `CollisionWorld2D`. If you only need shape tests, containment checks, or allocation free geometry routines, use the bounding volume types and `Collision2D` directly.

## Where to Start

For most gameplay collision systems, start with the actor/world layer:

- `ICollisionActor` defines the objects that participate in world queries
- `CollisionShape2D` wraps the actor's collision shape without using `IShapeF`
- `CollisionWorld2D` stores actors in named layers, owns layer membership, and provides candidate, collision, and pair queries
- `CollisionResult2D` returns overlap state, collision normal, penetration depth, and minimum translation vector

If you are moving from MonoGame.Extended 5.5.1, read the [Migration Guide](./migration.md) after this page. If you want the step-by-step setup path for a new project, go to [Collision Quick Start](./quick-start.md). If you want the architecture, query flow, and performance rationale behind the system design, go to the [Collision Technical Reference](./technical-reference.md).

## Collision Architecture

### Low Level Geometry Layer

The low level layer lives in the `MonoGame.Extended` namespace and is centered on explicit geometric types such as:

- `BoundingBox2D`
- `BoundingCircle2D`
- `BoundingCapsule2D`
- `OrientedBoundingBox2D`
- `BoundingPolygon2D`
- `Line2D`
- `LineSegment2D`
- `Ray2D`

These types provide:

- `Intersects(...)` boolean overlap tests
- `Contains(...)` containment queries
- transformation and translation helpers
- direct access to lower level `Collision2D` routines when needed

For the full geometry reference, see [2D Geometry](./2d-geometry.md).

### Actor/World Collision Layer

The actor/world layer builds on top of those geometric primitives for gameplay collision management.

In this layer:

- actors implement `ICollisionActor`
- actor shapes are exposed as `CollisionShape2D`
- broadphase uses `CollisionShape2D.BoundingBox`
- narrowphase uses `CollisionShape2D.Intersects(...)` or `CollisionShape2D.TryGetCollision(...)`
- collision filtering uses explicit named layer rules

This is the recommended layer for character controllers, triggers, hazards, projectiles, and other gameplay objects that need world queries or collision resolution data.

## Recommended API: `CollisionWorld2D`

`CollisionWorld2D` is the primary query oriented collision API in 6.0. It stores actors in named layers, uses broadphase queries to reduce candidate checks, and exposes collision results relative to the actor being queried.

Typical flow:

1. Implement `ICollisionActor`.
2. Expose a `CollisionShape2D` for the actor.
3. Create one or more `Layer` instances.
4. Register those layers with `CollisionWorld2D`.
5. Enable the layer pairs that should collide.
6. Insert actors into the default or named layers.
7. Query collisions, inspect membership, or move actors between layers during gameplay as needed.

The result of a narrowphase collision query is a `CollisionResult2D`. Its `MinimumTranslationVector` moves the receiving shape out of the other shape, which makes it suitable for simple overlap resolution.

```csharp
foreach (CollisionEvent2D collision in world.QueryCollisions(playerActor, "walls"))
{
    playerPosition += collision.Result.MinimumTranslationVector;
}
```

For a full walkthrough, see [Collision Quick Start](./quick-start.md).

### Why There Is No `Update()`

`CollisionWorld2D` deliberately does not have an `Update()` method.

That design keeps responsibilities separate:

- your game code owns actor movement, state changes, and frame timing
- `CollisionWorld2D` owns broadphase storage, layer rules, and collision queries

This avoids hidden rebuild work and avoids guessing when actor movement for the current step is "done." Instead, the world exposes `RebuildDynamicLayers()` as an explicit synchronization point after you finish updating actor shapes and before you run the next set of queries.

## Shapes and Result Queries

`CollisionShape2D` is a wrapper for the actor/world layer. It can represent the currently supported collision shapes including:

- `BoundingBox2D`
- `BoundingCircle2D`
- `OrientedBoundingBox2D`
- `BoundingCapsule2D`
- `BoundingPolygon2D`

There are two main query styles:

- `Intersects(...)` when you only need to know whether two shapes overlap
- `TryGetCollision(...)` when you also need collision result data

:::warning
`CollisionShape2D.Intersects(...)` supports more shape pairs than `CollisionShape2D.TryGetCollision(...)`. If you need a `CollisionResult2D`, make sure the specific shape pair you are using supports result returning queries in the current preview.
:::

## Layers and Filtering

The 6.0 collision system uses explicit named layer rules instead of the older implicit behavior.

That means:

- layers must be registered in the collision world
- collisions only occur for layer pairs that are enabled
- self collision is controlled explicitly per layer pair
- broadphase candidates can be filtered out before narrowphase work runs

This makes collision behavior easier to inspect and easier to disable for unrelated groups of actors.

### World Owned Membership

In 6.0 preview, layer membership belongs to `CollisionWorld2D`, not to `ICollisionActor`.

That means:

- `Insert(actor)` places the actor into the default layer
- `Insert(actor, "layerName")` places the actor into a specific registered layer
- inserting the same actor into the same world twice is an error
- `MoveToLayer(actor, "layerName")` is the explicit way to change membership
- `Contains(...)`, `TryGetLayerName(...)`, and `GetLayerName(...)` let you inspect world specific membership

This keeps layer placement tied to the world that owns it and allows the same actor to participate in more than one collision world when needed.

### Broadphase Sizing

Each `Layer` owns its own broadphase structure. When you use `SpatialHash`, that means different layers can use different cell sizes.

This is allowed, but it has tradeoffs:

- it does not usually change collision correctness
- it can change candidate counts and query cost significantly
- it makes tuning harder because each layer may behave differently under load

As a default recommendation, start with the same `SpatialHash` size for all layers in one `CollisionWorld2D`, or at least keep them similar. This gives you a more predictable baseline and makes it easier to reason about performance across layer pairs.

Use different sizes only when you have a clear reason, such as:

- one layer has much smaller or denser actors than another
- one layer is measured to perform better with a different cell size
- you are deliberately tuning separate workloads after profiling

If layers collide with each other frequently, similar broadphase settings are usually easier for consumers to understand and maintain.

### Dynamic vs Static Layers

Layers also control whether their broadphase is rebuilt during synchronization.

- `Layer.IsDynamic = true` means the layer participates in rebuilds during `Layer.Reset()` or `CollisionWorld2D.RebuildDynamicLayers()`
- `Layer.IsDynamic = false` means the layer skips that rebuild work

Use dynamic layers for moving actors and static layers for fixed world geometry or other layers whose contents do not move after insertion.

## Migration From 5.5.1

If you are coming from MonoGame.Extended 5.5.1, the most important changes are:

- `IShapeF` is no longer the collision system abstraction
- `ICollisionActor` now exposes `CollisionShape2D Shape`
- `ICollisionActor` no longer uses callback based collision methods
- `CollisionWorld2D` is the new primary actor/world API
- low level collision code now uses explicit bounding volume types
- collision filtering now uses explicit layer pair rules

For detailed before/after mappings and upgrade examples, see [Migrating from 5.5.1](./migration.md).

## What to Read Next

- [Collision Quick Start](./quick-start.md) for the main 6.0 setup path
- [Migrating from 5.5.1](./migration.md) if you are upgrading existing code
- [Collision Technical Reference](./technical-reference.md) for architecture, lifecycle, and performance details
- [2D Geometry](./2d-geometry.md) for the low level shape and `Collision2D` reference
