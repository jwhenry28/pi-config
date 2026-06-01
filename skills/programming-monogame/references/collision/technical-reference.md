---
id: technical-reference
sidebar_label: Technical Reference
title: Collision Technical Reference
description: Architecture, query flow, layer lifecycle, and performance design for the MonoGame.Extended 6.0 collision system.
---

:::tip[Up to date]
This page is **up to date** for MonoGame.Extended `@mgeversion@`. If you find outdated information, [please open an issue](https://github.com/monogame-extended/monogame-extended.github.io/issues).
:::

This document covers the technical architecture of the 6.0 collision system: how the low level geometry layer relates to the actor/world layer, how collision queries flow through broadphase and narrowphase, how layer membership and rebuild timing work, and where the current performance and result shape boundaries are.

Use this page when you want design rationale and lifecycle details rather than setup instructions.

For other entry points, use:

- [Collision Overview](./collision.md) for the main API roles
- [Collision Quick Start](./quick-start.md) for step-by-step setup
- [Migration Guide](./migration.md) for upgrading from 5.5.1
- [2D Geometry](./2d-geometry.md) for low level shape and `Collision2D` reference details

## System Architecture Overview

The collision system is divided into two layers:

- a low level geometry layer built around explicit bounding volume types and `Collision2D`
- an actor/world layer built around `ICollisionActor`, `CollisionShape2D`, `Layer`, and `CollisionWorld2D`

This separation lets low level shape math remain explicit and allocation conscious while the higher level world API handles actor queries, broadphase organization, and layer filtering.

### Low Level Geometry Layer

The low level layer lives in the `MonoGame.Extended` namespace and is responsible for shape representation and shape-to-shape math.

The core pieces are:

- bounding volume types such as `BoundingBox2D`, `BoundingCircle2D`, `OrientedBoundingBox2D`, `BoundingCapsule2D`, and `BoundingPolygon2D`
- `Collision2D` as a lower level library of collision helpers and shape pair routines
- `CollisionResult2D` as the shared result type for overlap state and resolution data

This layer does not know anything about actors, worlds, layers, or frame timing. Its job is to answer geometry questions such as:

- do these two shapes overlap?
- does one shape contain another?
- if a supported pair overlaps, what normal, penetration depth, and minimum translation vector describe that overlap?

### Actor/World Layer

The actor/world layer builds on top of the geometry layer for gameplay collision management.

The core pieces are:

- `ICollisionActor` as the actor contract
- `CollisionShape2D` as the actor facing wrapper over the supported bounding volume types
- `Layer` as the combination of a broadphase structure plus layer level lifecycle flags
- `CollisionWorld2D` as the query oriented world API

This layer is responsible for:

- storing actors in named layers
- resolving actor membership per world
- querying a broadphase before narrowphase work
- applying explicit layer pair rules
- returning collision data in query oriented forms such as `CollisionEvent2D` and `CollisionPair2D`

### Type Responsibilities

`CollisionShape2D` bridges the two layers. It belongs to the actor/world side of the API surface, but it is built directly on the low level shape types.

Its responsibilities are:

- wrapping one supported shape kind without using the old `IShapeF` abstraction
- caching an axis aligned `BoundingBox` for broadphase queries
- dispatching `Intersects(...)` and `TryGetCollision(...)` calls to the appropriate low level shape pair

`Layer` is intentionally small. It does not own actor identity or query policy. It groups:

- one `ICollisionBroadphase2D` implementation
- one `IsDynamic` flag that controls whether the broadphase rebuilds during reset

`CollisionWorld2D` owns the highest level orchestration in this system, but it is still intentionally narrow in scope. It owns:

- the registered layer collection
- actor-to-layer membership within that world
- the enabled layer pair rule set
- candidate, collision, and pair query APIs

It does not own:

- actor movement
- game loop timing
- physics integration
- automatic frame stepping

## Query Pipeline

The actor/world collision path is query oriented. `CollisionWorld2D` does not push collisions into actors. Instead, callers ask the world for candidates, collisions, or colliding pairs.

At a high level, the query pipeline is:

1. resolve the actor or layer membership involved in the query
2. use a broadphase query to collect candidate actors by overlapping axis aligned bounds
3. apply explicit layer pair filtering
4. run narrowphase shape tests on the remaining candidates
5. return query results in a receiver relative or pair relative form

### Broadphase Input: `CollisionShape2D.BoundingBox`

Every `CollisionShape2D` stores a cached axis aligned `BoundingBox`.

That cached box is used as the broadphase input regardless of the underlying shape kind:

- box
- circle
- oriented box
- capsule
- polygon

This keeps the broadphase API simple and uniform. Layer broadphases only need axis aligned bounds, while the exact shape kind is deferred to narrowphase.

### Candidate Queries by Bounds

The lowest level query entry point in `CollisionWorld2D` is:

```cs
IEnumerable<ICollisionActor> QueryCandidates(BoundingBox2D bounds, string layerName = null)
```

This asks one resolved layer broadphase for actors whose broadphase bounds overlap the supplied axis aligned query box.

At this stage:

- no narrowphase shape test has happened yet
- no actor relative result data has been computed yet
- no layer pair rule check is needed because the caller already chose the target layer directly

### Candidate Queries by Actor

Actor based candidate queries add world membership and layer rule filtering:

```cs
IEnumerable<ICollisionActor> QueryCandidates(ICollisionActor actor, string otherLayerName)
```

The flow is:

1. resolve the actor's current layer through world owned membership
2. resolve the target layer by name
3. check whether collision is enabled for that layer pair
4. if the pair is disabled, return no candidates
5. if the pair is enabled, query the target layer broadphase using `actor.Shape.BoundingBox`

This means broadphase work is already reduced by two independent mechanisms:

- spatial broadphase bounds
- explicit layer pair filtering

### Narrowphase: `Intersects(...)` vs `TryGetCollision(...)`

Once candidates are available, the world moves into narrowphase.

There are two important narrowphase APIs on `CollisionShape2D`:

- `Intersects(...)` answers the yes/no overlap question
- `TryGetCollision(...)` answers the overlap question only for supported result producing shape pairs and returns `CollisionResult2D`

`CollisionWorld2D.QueryCollisions(...)` and `CollisionWorld2D.QueryCollisionPairs(...)` use `TryGetCollision(...)`, not `Intersects(...)`, because they need result data rather than a boolean only.

That has an important consequence:

- a candidate pair can overlap at the `Intersects(...)` level
- but still produce no world collision result if that shape pair does not currently support `CollisionResult2D`

That support boundary is part of the current preview design and is discussed again later in this document.

### Receiver Relative Actor Queries

`QueryCollisions(actor, otherLayerName)` returns `CollisionEvent2D` values.

Each returned `CollisionEvent2D.Result` is relative to the queried actor, not to the candidate actor.

In other words:

- `collision.Other` is the candidate actor
- `collision.Result.MinimumTranslationVector` moves the queried actor out of `collision.Other`

This receiver relative convention makes actor-by-actor response code straightforward, because the caller can immediately apply the returned minimum translation vector to the actor they queried.

### Pair Queries

`QueryCollisionPairs(firstLayerName, secondLayerName)` works at the layer pair level instead of the actor level.

Its flow is:

1. resolve the two layers
2. check whether the layer pair is enabled
3. iterate actors in the first layer
4. broadphase query the second layer with each actor's cached bounding box
5. run `TryGetCollision(...)` on each candidate pair
6. suppress duplicates through an unordered actor pair key
7. return `CollisionPair2D` results

Each `CollisionPair2D` contains:

- `First`
- `Second`
- `FirstResult`, which moves `First` out of `Second`
- `SecondResult`, derived by inverting `FirstResult`

That means pair queries still preserve directional result data even though the layer rule itself is symmetric.

### Why Duplicate Suppression Exists

Broadphase implementations can legally return the same candidate relationship more than once across different buckets or traversal paths, especially when large actors span multiple cells.

For same layer queries there is a second duplication risk: the pair `(A, B)` and the pair `(B, A)` should not both be emitted as separate unordered collision pairs.

`CollisionWorld2D.QueryCollisionPairs(...)` suppresses both forms of duplication through an unordered actor pair key, while still returning a directional result relative to the `First` actor in the emitted pair.

## World Owned Layer Membership

In the final 6.0 preview design, layer membership belongs to `CollisionWorld2D`, not to `ICollisionActor`.

That means the actor contract is intentionally small:

- `int Id`
- `CollisionShape2D Shape`

The actor does not declare which layer it belongs to. Instead, layer membership is established when the actor is inserted into a specific collision world.

### Why Membership Was Moved Into the World

The older actor owned design had a structural problem: layer membership is not intrinsic actor data. It is a placement decision made by a particular world.

Moving membership into `CollisionWorld2D` solves several problems:

- the actor contract no longer mixes shape data with world placement state
- the same actor can participate in more than one world without carrying one shared layer value
- relayering becomes an explicit world operation instead of a mutation on the actor
- one world, not the actor, becomes the single source of truth for membership

### Membership Is Per World

Each `CollisionWorld2D` owns its own actor-to-layer mapping.

That means:

- one actor can exist in multiple worlds
- the same actor can belong to different layers in different worlds
- within one world, the actor can exist only once

This is a world scoped membership model, not a global actor scoped one.

### Insert, Remove, and Reassign

The membership API is intentionally explicit:

- `Insert(actor)` adds the actor to the default layer
- `Insert(actor, "layerName")` adds the actor to a specific registered layer
- `Remove(actor)` removes the actor from its current layer in that world
- `MoveToLayer(actor, "layerName")` changes the actor's layer within that world

One important behavior change from the older design is that `Insert(...)` is not a reassignment API.

If an actor is already present in a world:

- inserting it again into the same world throws
- callers must use `MoveToLayer(...)` if the goal is to change membership

That design makes "add membership" and "change membership" separate operations instead of overloading insertion with replacement semantics.

### Membership Inspection

Because `ICollisionActor` no longer exposes layer state directly, membership inspection happens through the world:

- `Contains(...)`
- `TryGetLayerName(...)`
- `GetLayerName(...)`

These APIs answer a world specific question:

"What is this actor's membership in this collision world?"

That distinction matters because the same actor may not even be present in another world, or may be present there under a different layer assignment.

## Layer Rules and Filtering

Layer filtering in 6.0 preview is explicit and world owned.

`CollisionWorld2D` stores:

- a named layer collection
- a set of enabled layer pair rules

Queries only consider collisions for layer pairs that are enabled in that world.

### Named Layers

Each world contains a dictionary of named `Layer` instances.

The default layer name is:

```cs
CollisionWorld2D.DefaultLayerName
```

which currently resolves to `"default"`.

Actors are inserted into:

- the default layer through `Insert(actor)`
- a named layer through `Insert(actor, "layerName")`

### Default Rule Behavior

`CollisionWorld2D` still provides a small amount of convenience behavior when layers are registered:

- when the default layer is set, self collision is enabled for it
- when a non default layer is added, self collision is enabled for that new layer
- when a non default layer is added and a default layer already exists, collision between the default layer and that new layer is enabled

No other cross layer rules are added automatically.

That means explicit rule management is still required for:

- non default to non default layer pairs
- disabling default/self behavior that the caller does not want

### Explicit Rule APIs

The public rule management APIs are:

- `EnableCollisionBetweenLayers(...)`
- `DisableCollisionBetweenLayers(...)`
- `IsCollisionEnabledBetweenLayers(...)`

These APIs operate on layer names, but the world internally resolves those names to actual `Layer` instances before checking or changing the rule set.

### Symmetric Rule Behavior

Layer pair rules are symmetric.

In practice that means:

- enabling collision for layer A and layer B also enables it for B and A
- disabling collision for layer A and layer B also disables it for B and A
- self collision is just the special case where both entries in the pair are the same layer

Internally, the world stores layer pair rules in an unordered `LayerPair` key so `(A, B)` and `(B, A)` are treated as the same rule.

This symmetry is important because:

- rule storage is simpler
- callers do not need to think about directional rule duplication
- actor and pair queries can still return directional collision results without requiring directional rule records

### Filtering Happens Before Narrowphase

The rule set is not just documentation. It actively gates work during queries.

For actor based candidate queries:

- the world resolves the actor's current layer
- resolves the target layer
- checks whether the pair is enabled
- returns no candidates immediately if the pair is disabled

For pair queries:

- the world resolves the two layers
- checks whether the pair is enabled
- yields no results at all if the pair is disabled

This means layer filtering reduces work before narrowphase shape tests begin.

### How This Differs from the Older Model

Compared to the older collision API, the 6.0 preview model is more explicit in two ways:

- membership is no longer read from the actor
- layer pair behavior is no longer treated as a mostly implicit side effect of actor state and world setup

The result is a collision world whose grouping and filtering behavior can be inspected and changed directly from one place.

## Broadphase Lifecycle

The collision world stores actors in broadphase structures, but it does not own the timing of actor movement or shape updates.

That means broadphase state is not automatically rebuilt on every frame step. Synchronization is explicit.

### Why `CollisionWorld2D` Has No `Update()`

`CollisionWorld2D` is intentionally a query oriented service, not a simulation driver.

Its responsibilities are:

- storing actors in named layers
- applying layer pair rules
- querying broadphase structures
- producing narrowphase collision results

It does not own:

- when gameplay objects move
- when shapes are updated
- whether one frame contains one movement pass or several
- when the caller intends to run collision queries

If the world owned a generic `Update()` method, it would need to guess when actor movement for the current step was "finished." That guess would be wrong for many real game loops, especially those that:

- move actors in multiple phases
- run multiple collision passes in one frame
- update only a subset of actors before querying
- use different timing for gameplay, AI, and editor/sandbox queries

The 6.0 design keeps that decision with the caller instead.

### `RebuildDynamicLayers()`

`CollisionWorld2D.RebuildDynamicLayers()` is the explicit world level synchronization point.

Its job is simple:

- iterate every registered layer
- call `Layer.Reset()` on each one

This convenience API exists so callers do not need to write the per layer loop themselves, while still keeping the world query oriented rather than frame driven.

### `Layer.Reset()`

`Layer.Reset()` is intentionally small.

Its behavior is:

- if `Layer.IsDynamic` is `true`, call `Space.Reset()`
- if `Layer.IsDynamic` is `false`, do nothing

That means `RebuildDynamicLayers()` is really a world level dispatch over layer local reset rules.

### Why Rebuild Timing Is Explicit

Broadphase rebuilds are driven by state changes and query timing, not by the mere existence of a game loop tick.

The intended flow is:

1. move or otherwise update relevant actors
2. update those actors' `CollisionShape2D` values
3. call `RebuildDynamicLayers()`
4. run the queries that need updated broadphase state

This explicit timing has two important benefits:

- no hidden rebuild work happens at an unexpected time
- the caller decides exactly which queries should see the post movement state

### When Rebuilds Are Needed

You do not rebuild because "a frame happened." You rebuild because the broadphase state for one or more dynamic layers may now be stale relative to the actors stored in them.

Typical reasons to rebuild are:

- actors in dynamic layers moved
- actors in dynamic layers changed shape
- queries are about to run and should see those changes

Typical reasons to skip a rebuild are:

- nothing in any dynamic layer moved or changed shape
- no collision queries are about to run that depend on updated broadphase state
- only static layers are involved and their contents have not changed

### What Can Go Stale

`CollisionShape2D` itself is actor owned data. When an actor updates its shape, that new shape value exists immediately on the actor.

What can become stale is the broadphase index stored inside the layer's `ICollisionBroadphase2D`.

If the actor moved after insertion and the broadphase has not been rebuilt yet:

- the actor's current `Shape` may be correct
- but the broadphase may still be indexing it under old bounds

That can affect:

- candidate discovery
- collision queries that depend on broadphase pruning
- pair queries that rely on layer broadphase state

The explicit rebuild step is what resynchronizes the broadphase with the actors' current shapes for dynamic layers.

## Dynamic vs Static Layers

`Layer.IsDynamic` controls whether a layer participates in broadphase rebuilds during `Layer.Reset()` and therefore during `CollisionWorld2D.RebuildDynamicLayers()`.

### Dynamic Layers

A dynamic layer is a layer with:

```cs
IsDynamic = true
```

This is the default.

Use dynamic layers when actors in that layer can move or change shape after insertion.

Typical dynamic examples:

- players
- enemies
- projectiles
- moving triggers
- moving hazards

The tradeoff is:

- higher rebuild cost
- correct broadphase synchronization for moving contents

### Static or Non Dynamic Layers

A non dynamic layer is a layer with:

```cs
IsDynamic = false
```

Use non dynamic layers when the contents are effectively fixed after insertion.

Typical static examples:

- wall layers
- tile collision layers
- fixed obstacle layers
- other map geometry that does not move during gameplay

The tradeoff is:

- lower rebuild cost because `Reset()` does no broadphase rebuild work
- correctness depends on the actors in that layer truly staying fixed

### Why This Matters for Performance

Broadphase rebuild work is not free. The more often a layer changes, the more often its broadphase may need to be reconstructed or reindexed.

Separating moving and fixed contents into different layers lets the caller avoid rebuild work for the layers that do not need it.

That is why a common pattern is:

- dynamic gameplay actors in one or more dynamic layers
- walls and map geometry in one or more non dynamic layers

### Stale Query Risk

The main risk with `IsDynamic = false` is not that the layer becomes slower. The risk is that the broadphase becomes wrong for the actual actor positions if something in that layer moves anyway.

If an actor in a non-dynamic layer changes position or shape after insertion:

- its actor owned `CollisionShape2D` can still be updated
- but the layer broadphase will not be rebuilt during `RebuildDynamicLayers()`

That means future queries can use stale broadphase placement for that actor.

So the rule is simple:

- use `IsDynamic = false` only when the layer contents really stay fixed after insertion
- if the contents can move, keep the layer dynamic

## Shape Support and Result Limitations

One of the most important current preview boundaries is that overlap detection support is broader than result producing collision support.

In practice:

- `CollisionShape2D.Intersects(...)` answers "do these shapes overlap?"
- `CollisionShape2D.TryGetCollision(...)` answers that question only for shape pairs that also have a current `CollisionResult2D` implementation

`CollisionWorld2D.QueryCollisions(...)` and `CollisionWorld2D.QueryCollisionPairs(...)` depend on `TryGetCollision(...)`, not on `Intersects(...)`.

That means a shape pair can:

- be valid for broadphase candidate discovery
- return `true` from `Intersects(...)`
- still produce no world collision event or pair result because the pair does not yet support `CollisionResult2D`

### Why the Support Boundary Exists

`CollisionShape2D` does not invent new narrowphase or resolution algorithms on its own.

Its `TryGetCollision(...)` implementation is only a dispatcher over shape pair routines that already exist in the low level geometry layer and already know how to produce:

- overlap state
- contact normal
- penetration depth
- minimum translation vector

So the current support boundary reflects the lower level `TryGetCollision(...)` coverage that exists today, not an arbitrary restriction imposed by the world API.

### Current `Intersects(...)` Coverage

At the time of writing, `Intersects(...)` supports overlap checks for these shape families:

- box with box, circle, oriented box, capsule, and polygon
- circle with box, circle, oriented box, capsule, and polygon
- oriented box with box, circle, oriented box, capsule, and polygon
- capsule with box, circle, oriented box, capsule, and polygon
- polygon with box, circle, oriented box, capsule, and polygon

This means the overlap only surface is close to a full matrix across the currently supported shape kinds.

### Current `TryGetCollision(...)` Coverage

At the time of writing, result producing support is narrower:

- box with box, circle, oriented box, and polygon
- circle with box, circle, capsule, and oriented box
- oriented box with box, circle, oriented box, and polygon
- capsule with circle only
- polygon with box, oriented box, and polygon

Some important implications are:

- capsule overlap checks are broader than capsule result producing checks
- polygon overlap checks include circle and capsule, but polygon result producing queries currently do not
- world query APIs will only emit results for the supported subset above

### Choosing Shapes for World Collision Response

If you only need overlap detection, `Intersects(...)` may be enough even when `TryGetCollision(...)` is unsupported.

If you need response oriented data such as:

- a minimum translation vector
- penetration depth
- a separating normal

then choose shape pairs that are currently supported by `TryGetCollision(...)`.

This matters most when designing gameplay actors that will use:

- `CollisionWorld2D.QueryCollisions(...)`
- `CollisionWorld2D.QueryCollisionPairs(...)`

Those world APIs are best thought of as "result producing collision queries," not as generic overlap queries for every supported `Intersects(...)` pair.

### `None` and Invalid Gameplay Assumptions

The default `CollisionShape2D` value represents a `None` shape.

For both `Intersects(...)` and `TryGetCollision(...)`:

- `None` never collides
- result queries return `CollisionResult2D.None`

This is useful as a safe default, but gameplay code should not rely on it as a substitute for explicit shape setup.

### Practical Guidance

For the current preview, a good rule of thumb is:

- use `Intersects(...)` when you need overlap only probes
- use supported box, circle, oriented box, and polygon pairings when you need world level response data
- treat capsule heavy response workflows as a narrower supported path for now

If you are designing a collision heavy feature and need both broad shape flexibility and consistent `CollisionResult2D` output, check the actual `TryGetCollision(...)` support matrix first instead of assuming it matches `Intersects(...)`.

## Performance Notes

The collision system is designed to keep narrowphase work behind broadphase pruning and explicit layer filtering. In practice, performance usually depends more on candidate quality and rebuild frequency than on raw actor count.

The main performance levers are:

- how many false positives broadphase returns
- how often dynamic layers are rebuilt
- how well layers partition unrelated actors and queries

### `SpatialHash` Cell Size Tradeoffs

`SpatialHash` is sensitive to cell size.

If the cells are too large:

- many unrelated actors fall into the same buckets
- candidate queries return more false positives
- narrowphase work increases

If the cells are too small:

- large actors span many buckets
- insertion and reset work touches more cells
- duplicate candidate relationships become more common

There is no single universally correct cell size, but a practical default is to choose a size near the typical footprint of the moving actors you expect to query most often.

### When Different Per Layer Settings Make Sense

Each `Layer` owns its own broadphase, so different layers can use different `SpatialHash` sizes or even different broadphase implementations.

Start with the same or similar `SpatialHash` sizes across one world, then diverge only when layers have genuinely different workloads, for example:

- small, dense projectiles in one layer
- large, sparse hazards in another
- static map geometry using a non dynamic layer with a different broadphase layout

This should be a measured choice, not the default story.

### Rebuild Cost Is a Real Cost

`RebuildDynamicLayers()` is convenient, but it still performs real work.

For dynamic layers, rebuild cost depends on:

- how many actors the layer contains
- how many buckets or tree nodes those actors occupy
- which broadphase implementation the layer uses

That is why the recommended lifecycle is:

- rebuild after relevant movement or shape changes
- rebuild before queries that need fresh broadphase state
- skip rebuilds when nothing changed or when no relevant queries will run

You do not gain anything by rebuilding merely because a frame advanced.

### Candidate Count Matters More Than Actor Count

A world with many actors can still perform well if:

- spatial partitioning keeps candidate sets small
- layers prevent irrelevant cross group queries
- rebuilds happen only when needed

A much smaller world can perform worse if:

- all actors share oversized broadphase regions
- dynamic layers rebuild constantly without need
- broadphase returns large candidate sets that all fall through to narrowphase

So the most useful performance question is usually not "how many actors do I have?" but "how many candidates am I making the system test per query?"

## Extension Points and Current Boundaries

The 6.0 preview collision system is intentionally narrow in scope, but it leaves a few important extension points open.

### Main Extension Points

- Broadphase storage is swappable per layer through `ICollisionBroadphase2D`, so layers can use implementations such as `SpatialHash` or `QuadTreeSpace`.
- Result producing shape support can expand over time because `CollisionShape2D.TryGetCollision(...)` is a dispatcher over lower level shape pair implementations.
- The same actor can participate in multiple `CollisionWorld2D` instances, which makes separate gameplay, debug, editor, or sandbox worlds a valid composition tool.

These extension points change storage, coverage, or composition without changing the query oriented actor/world model.

### Current Boundaries

`CollisionWorld2D` is not:

- a physics engine
- a rigid body solver
- a frame step orchestrator
- an automatic transform-to-shape synchronizer

It also keeps a few behavioral boundaries intentionally strict:

- membership is one layer per actor per world
- relayering is done through `MoveToLayer(...)`, not a second insert
- collision work is query driven rather than callback driven

Those boundaries are part of the design, not missing convenience features.

## What's Next

- [Collision Overview](./collision.md) for the user facing architecture summary
- [Collision Quick Start](./quick-start.md) for setup and rebuild usage
- [Migration Guide](./migration.md) for 5.5.1 to 6.0 mappings
- [2D Geometry](./2d-geometry.md) for low level shape APIs
