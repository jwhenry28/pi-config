---
id: quick-start
sidebar_label: Quick Start
title: Collision Quick Start
description: Get actor/world collision queries running with CollisionWorld2D in MonoGame.Extended 6.0 preview.
---

:::tip[Up to date]
This page is **up to date** for MonoGame.Extended `@mgeversion@`. If you find outdated information, [please open an issue](https://github.com/monogame-extended/monogame-extended.github.io/issues).
:::

This guide shows the main 6.0 collision workflow built around `ICollisionActor`, `CollisionShape2D`, `Layer`, and `CollisionWorld2D`.

Use this path when you want:

- explicit collision queries
- named collision layers
- access to `CollisionResult2D`
- a collision system built on the new bounding volume APIs instead of `IShapeF`

## Prerequisites

- A MonoGame project with MonoGame.Extended installed
- Basic familiarity with `Game.Update`
- A gameplay object you want to test against the collision world

## Step 1: Add Namespaces

```cs
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Input;
using MonoGame.Extended;
using MonoGame.Extended.Collisions;
using MonoGame.Extended.Collisions.Layers;
```

## Step 2: Implement `ICollisionActor`

Each actor needs:

- a stable `Id`
- a `CollisionShape2D`

`CollisionWorld2D` is query-oriented, so collision resolution happens in your game code rather than through actor callbacks.

```cs
public sealed class PlayerActor : ICollisionActor
{
    private readonly Vector2 _size;

    public int Id { get; }

    public Vector2 Position { get; private set; }

    public CollisionShape2D Shape { get; private set; }

    public PlayerActor(int id, Vector2 position, Vector2 size)
    {
        Id = id;
        Position = position;
        _size = size;
        UpdateShape();
    }

    public void Move(Vector2 delta)
    {
        Position += delta;
        UpdateShape();
    }
    private void UpdateShape()
    {
        BoundingBox2D bounds = BoundingBox2D.CreateFromPositionAndSize(Position, _size);
        Shape = new CollisionShape2D(bounds);
    }
}
```

For a wall actor, the same pattern works:

```cs
public sealed class WallActor : ICollisionActor
{
    public int Id { get; }
    public CollisionShape2D Shape { get; }

    public WallActor(int id, BoundingBox2D bounds)
    {
        Id = id;
        Shape = new CollisionShape2D(bounds);
    }

}
```

## Step 3: Create the Collision World and Layers

`CollisionWorld2D` stores actors in named `Layer` instances. Each layer wraps a broadphase structure such as `SpatialHash`.

```cs
private CollisionWorld2D _collisionWorld;
private PlayerActor _player;
private WallActor _wall;

protected override void Initialize()
{
    base.Initialize();

    Layer defaultLayer = new Layer(new SpatialHash(new SizeF(64f, 64f)));
    Layer wallLayer = new Layer(new SpatialHash(new SizeF(64f, 64f)));

    _collisionWorld = new CollisionWorld2D(defaultLayer);
    _collisionWorld.AddLayer("walls", wallLayer);

    _player = new PlayerActor(1, new Vector2(40f, 40f), new Vector2(32f, 32f));
    _wall = new WallActor(
        2,
        BoundingBox2D.CreateFromPositionAndSize(new Vector2(96f, 40f), new Vector2(64f, 64f)));

    _collisionWorld.Insert(_player);
    _collisionWorld.Insert(_wall, "walls");
}
```

By default:

- `Insert(actor)` uses the default layer named `default`
- `Insert(actor, "layerName")` places the actor into a specific registered layer
- inserting the same actor into the same world twice throws instead of reassigning it
- new non default layers enable self collision automatically
- new non default layers also enable collision with the current default layer automatically

If you need to inspect or change that behavior, use:

- `Contains(...)`
- `TryGetLayerName(...)`
- `GetLayerName(...)`
- `MoveToLayer(...)`
- `EnableCollisionBetweenLayers(...)`
- `DisableCollisionBetweenLayers(...)`
- `IsCollisionEnabledBetweenLayers(...)`

:::tip
Start with the same `SpatialHash` cell size for all layers in one collision world unless you have a measured reason to tune them differently. Different sizes are allowed, but they can lead to uneven candidate counts and make performance tuning harder to reason about.
:::

## Step 4: Query Collisions

Call `QueryCollisions(...)` when you want collision results relative to one actor.

```cs
foreach (CollisionEvent2D collision in _collisionWorld.QueryCollisions(_player, "walls"))
{
    _player.Move(collision.Result.MinimumTranslationVector);
}
```

`collision.Result.MinimumTranslationVector` moves the queried actor out of the other actor. In this example, it moves `_player` out of the wall.

If you only need overlap state, use `Intersects(...)` on the shapes directly instead of a result returning query.

## Step 5: Inspect or Change Layer Membership

Because `CollisionWorld2D` owns layer membership, inspection and reassignment happen through the world.

For example:

```cs
if (_collisionWorld.TryGetLayerName(_player, out string currentLayer))
{
    if (currentLayer != "walls")
    {
        _collisionWorld.MoveToLayer(_player, "walls");
    }
}
```

Use `MoveToLayer(...)` when you want to reassign an actor that is already in the world. Do not call `Insert(...)` a second time for that purpose.

## Step 6: Rebuild Dynamic Layers After Movement

`CollisionWorld2D` does not have an `Update` method. That is intentional: the world is a query oriented service, not a game loop owner. Your game code decides when actor movement for the current step is complete, and then explicitly calls `RebuildDynamicLayers()` before running queries that need updated broadphase state.

If your actors move, update their `Shape` values and then call `RebuildDynamicLayers()` before querying again.

For example:

```cs
protected override void Update(GameTime gameTime)
{
    Vector2 movement = Vector2.Zero;

    if (Keyboard.GetState().IsKeyDown(Keys.Right))
    {
        movement.X += 2f;
    }

    if (Keyboard.GetState().IsKeyDown(Keys.Left))
    {
        movement.X -= 2f;
    }

    if (Keyboard.GetState().IsKeyDown(Keys.Down))
    {
        movement.Y += 2f;
    }

    if (Keyboard.GetState().IsKeyDown(Keys.Up))
    {
        movement.Y -= 2f;
    }

    _player.Move(movement);

    _collisionWorld.RebuildDynamicLayers();

    foreach (CollisionEvent2D collision in _collisionWorld.QueryCollisions(_player, "walls"))
    {
        _player.Move(collision.Result.MinimumTranslationVector);
    }

    base.Update(gameTime);
}
```

`RebuildDynamicLayers()` is a convenience method that calls `Layer.Reset()` on every registered layer. Each `Layer` rebuilds its broadphase only when `Layer.IsDynamic` is `true`, which is the default.

This design keeps timing explicit. `CollisionWorld2D` does not try to guess when your frame's movement, layer changes, or shape updates are finished, which avoids hidden rebuild work and lets you control when queries see synchronized state.

You do not need to rebuild every frame just because a frame happened.

- rebuild after relevant actors in dynamic layers have moved or changed shape
- rebuild before collision queries that need to see that updated broadphase state
- skip the rebuild when nothing moved, or when you are not about to run queries that depend on the changed actors

In other words, rebuilding is driven by state changes and query timing, not by the mere existence of a game loop tick.

### Dynamic vs Non Dynamic Layers

`Layer.IsDynamic` controls whether that layer's broadphase is rebuilt during `Reset()` or `RebuildDynamicLayers()`.

- dynamic layer: use this when actors in the layer can move after insertion
- non dynamic layer: use this when actors are effectively static after insertion

Practical examples:

- player, enemy, projectile, and moving trigger layers are usually dynamic
- wall, tile collision, and fixed obstacle layers are often non dynamic

Why this matters:

- dynamic layers cost rebuild work, but keep broadphase queries aligned with moving actors
- non dynamic layers skip rebuild work, which is cheaper, but only makes sense when the actors in that layer are not changing position or shape

For example, a static wall layer can opt out of rebuild work:

```cs
Layer wallLayer = new Layer(new SpatialHash(new SizeF(64f, 64f)))
{
    IsDynamic = false
};
```

If you later move an actor in a non dynamic layer, the broadphase will not automatically resync for that layer during `RebuildDynamicLayers()`, so queries can become stale. Use `IsDynamic = false` only for layers whose contents stay fixed after insertion.

## Querying Pairs

If you want all colliding pairs between two layers, use `QueryCollisionPairs(...)`:

```cs
foreach (CollisionPair2D pair in _collisionWorld.QueryCollisionPairs(
    CollisionWorld2D.DefaultLayerName,
    "walls"))
{
    CollisionResult2D playerResult = pair.FirstResult;
    CollisionResult2D wallResult = pair.SecondResult;
}
```

This is useful when you want one pass over all collisions in a layer pair instead of querying actor by actor.

## Choosing Shapes

`CollisionShape2D` can wrap:

- `BoundingBox2D`
- `BoundingCircle2D`
- `OrientedBoundingBox2D`
- `BoundingCapsule2D`
- `BoundingPolygon2D`

For many gameplay collision systems, `BoundingBox2D` is the simplest place to start.

:::warning
`CollisionShape2D.Intersects(...)` supports more shape pairs than `CollisionShape2D.TryGetCollision(...)`. If you need `CollisionResult2D`, verify that your shape pair supports result returning queries in the current preview.
:::

## What's Next

- [Collision Overview](./collision.md) for the architecture and API roles
- [Migrating from 5.5.1](./migration.md) if you are upgrading from the old `IShapeF`-based system
- [Collision Technical Reference](./technical-reference.md) for the deeper rationale behind world ownership, rebuild timing, and performance tradeoffs
- [2D Geometry](./2d-geometry.md) for the low level bounding volume and `Collision2D` reference
