---
id: migration
sidebar_label: Migration Guide
title: Migrating from MonoGame.Extended 5.5.1 Collision APIs
description: A step-by-step guide for migrating from the legacy IShapeF-based collision system to the MonoGame.Extended 6.0 preview collision APIs.
---

:::tip[Up to date]
This page is **up to date** for MonoGame.Extended `@mgeversion@`. If you find outdated information, [please open an issue](https://github.com/monogame-extended/monogame-extended.github.io/issues).
:::

The MonoGame.Extended 6.0 collision system replaces the older `IShapeF`-based actor pipeline with explicit bounding volumes, `CollisionShape2D`, `CollisionResult2D`, and `CollisionWorld2D`.

If your 5.5.1 code used `ICollisionActor`, `IShapeF`, `Shape.Intersects(...)`, or `CollisionComponent` as the center of your collision workflow, this guide shows what changed and how to update your code.

## What Changed and Why

The 5.5.1 collision system stored actor bounds as `IShapeF` and used runtime type dispatch to figure out which shape specific collision logic to run. That design made the collision hot path depend on interface based storage and a legacy shared shape abstraction.

In 6.0 preview, the collision system moves to:

- explicit bounding volume types such as `BoundingBox2D` and `BoundingCircle2D`
- `CollisionShape2D` as the non boxing actor/world shape wrapper
- `CollisionResult2D` for overlap state and resolution data
- `CollisionWorld2D` as the primary query oriented actor/world API
- explicit named layer pair rules instead of the older implicit collision model

This makes the chosen collision shape visible in the API surface, reduces hidden dispatch in the actor/world path, and gives callers direct access to minimum translation vector data where supported.

## Step 1: Replace `IShapeF Bounds` with `CollisionShape2D Shape`

In 5.5.1, `ICollisionActor` exposed:

```cs
public interface ICollisionActor
{
    string LayerName { get; }
    IShapeF Bounds { get; }
}
```

In 6.0 preview, `ICollisionActor` exposes:

```cs
public interface ICollisionActor
{
    int Id { get; }
    CollisionShape2D Shape { get; }
}
```

**Before:**

```cs
public sealed class PlayerActor : ICollisionActor
{
    public string LayerName => "players";

    public RectangleF Bounds { get; private set; }

    IShapeF ICollisionActor.Bounds => Bounds;
}
```

**After:**

```cs
public sealed class PlayerActor : ICollisionActor
{
    private Vector2 _position;
    private readonly Vector2 _size;

    public int Id { get; }

    public CollisionShape2D Shape { get; private set; }

    public PlayerActor(int id, Vector2 position, Vector2 size)
    {
        Id = id;
        _position = position;
        _size = size;
        UpdateShape();
    }

    private void UpdateShape()
    {
        BoundingBox2D bounds = BoundingBox2D.CreateFromPositionAndSize(_position, _size);
        Shape = new CollisionShape2D(bounds);
    }
}
```

The important change is that the actor now exposes a concrete `CollisionShape2D` instead of a shape through `IShapeF`.

Layer membership is also no longer stored on the actor. `CollisionWorld2D` owns layer assignment when the actor is inserted.

## Step 2: Replace Old Collision Shapes with Bounding Volumes

The new collision system is built around explicit bounding volume types.

### Rectangle

**Before:**

```cs
RectangleF oldBounds = new RectangleF(position, size);
```

**After:**

```cs
BoundingBox2D newBounds = BoundingBox2D.CreateFromPositionAndSize(position, size);
CollisionShape2D shape = new CollisionShape2D(newBounds);
```

### Circle

**Before:**

```cs
CircleF oldCircle = new CircleF(center, radius);
```

**After:**

```cs
BoundingCircle2D newCircle = new BoundingCircle2D(center, radius);
CollisionShape2D shape = new CollisionShape2D(newCircle);
```

### Oriented Rectangle

**Before:**

```cs
OrientedRectangle oldBounds = new OrientedRectangle(center, halfExtents, rotation);
```

**After:**

```cs
OrientedBoundingBox2D newBounds = OrientedBoundingBox2D.CreateFromRotation(center, rotation, halfExtents);
CollisionShape2D shape = new CollisionShape2D(newBounds);
```

### Ellipse

`EllipseF` does not have a direct collision-system replacement in the new actor/world API.

Choose an explicit substitute based on the behavior you need:

- `BoundingCircle2D` for a circular approximation
- `BoundingBox2D` for an axis aligned enclosure
- `OrientedBoundingBox2D` for a rotated box approximation
- `BoundingPolygon2D` for a convex polygon approximation

## Step 3: Replace `Shape.Intersects(IShapeF, IShapeF)`

The old shared interface dispatch path has been removed.

**Before:**

```cs
bool intersects = actor.Bounds.Intersects(other.Bounds);
```

**After, actor/world path:**

```cs
bool intersects = actor.Shape.Intersects(other.Shape);
```

**After, low-level geometry path:**

```cs
bool intersects = box.Intersects(circle);
```

or

```cs
bool intersects = Collision2D.IntersectsCircleAabb(
    circle.Center,
    circle.Radius,
    box.Min,
    box.Max);
```

Use `CollisionShape2D.Intersects(...)` when you are working in the actor/world collision layer. Use the bounding volume types or `Collision2D` directly when you are working in the low-level geometry layer.

## Step 4: Replace Penetration Vector Only Logic with `CollisionResult2D`

In 5.5.1, collision code often relied on a boolean overlap test plus the older callback penetration vector.

In 6.0 preview, supported shape pairs can return a `CollisionResult2D` with:

- `Intersects`
- `Normal`
- `PenetrationDepth`
- `MinimumTranslationVector`

**Before:**

```cs
if (actor.Bounds.Intersects(other.Bounds))
{
    Vector2 penetration = GetPenetrationFromLegacyFlow();
    position -= penetration;
}
```

**After:**

```cs
if (actor.Shape.TryGetCollision(other.Shape, out CollisionResult2D result))
{
    position += result.MinimumTranslationVector;
}
```

This is the main upgrade if your collision response needs more than a yes/no answer.

:::warning
`CollisionShape2D.Intersects(...)` supports more shape pairs than `CollisionShape2D.TryGetCollision(...)`. Some shape combinations can be queried for overlap but do not currently produce `CollisionResult2D` values in the preview.
:::

## Step 5: Replace `CollisionComponent` with `CollisionWorld2D`

`CollisionComponent` has been removed. `CollisionWorld2D` is the actor/world collision API in 6.0 preview.

Use `CollisionWorld2D` when you want:

- actor-by-actor collision queries
- layer pair collision queries
- explicit access to `CollisionEvent2D` and `CollisionPair2D`
- direct use of `CollisionResult2D`

### World Query Example

**Before, component-centric flow:**

```cs
private readonly CollisionComponent _collisionComponent;

protected override void Update(GameTime gameTime)
{
    UpdateActors(gameTime);
    _collisionComponent.Update(gameTime);
    base.Update(gameTime);
}
```

**After, query-oriented flow:**

```cs
private CollisionWorld2D _collisionWorld;

protected override void Update(GameTime gameTime)
{
    UpdateActors(gameTime);

    _collisionWorld.RebuildDynamicLayers();

    foreach (CollisionEvent2D collision in _collisionWorld.QueryCollisions(playerActor, "walls"))
        playerPosition += collision.Result.MinimumTranslationVector;

    base.Update(gameTime);
}
```

One important difference is that `CollisionWorld2D` does not have its own `Update` method. Your game code updates actor state, refreshes shapes, calls `RebuildDynamicLayers()`, and then performs queries.

This is intentional. `CollisionWorld2D` is designed as a query oriented service rather than a frame step owner, so it does not guess when actor movement is finished for the current step.

## Step 6: Update Layer Rules

Layer behavior changed in an important way.

In 5.5.1:

- the default layer collided with itself and with all other layers
- non default layers collided with themselves automatically
- the system was centered on implicit stored layer tuples

In 6.0 preview:

- layer rules are represented explicitly as enabled or disabled layer pairs
- collisions only happen for layer pairs that are enabled
- you can inspect and change rules through dedicated APIs

Use these methods on `CollisionWorld2D`:

- `EnableCollisionBetweenLayers(...)`
- `DisableCollisionBetweenLayers(...)`
- `IsCollisionEnabledBetweenLayers(...)`

**Before:**

```cs
collisionComponent.Add("walls", wallLayer);
collisionComponent.AddCollisionBetweenLayer("players", "walls");
```

**After:**

```cs
collisionWorld.AddLayer("walls", wallLayer);
collisionWorld.EnableCollisionBetweenLayers("players", "walls");
```

If your old collision setup relied on actor-owned `LayerName` values, move that responsibility to world insertion:

```cs
collisionWorld.Insert(playerActor, "players");
collisionWorld.Insert(wallActor, "walls");
```

If you need to inspect or change layer membership later, do that through the world:

```cs
if (collisionWorld.TryGetLayerName(playerActor, out string layerName) && layerName != "players")
    collisionWorld.MoveToLayer(playerActor, "players");
```

`Insert(...)` is now an add operation, not a reassignment operation. If the actor is already present in that world, inserting it again throws instead of silently moving it.

If your old collision setup relied on the default layer's implicit behavior, verify that the new explicit rule set matches what you intended.

## Common API Mappings

| Old API | New API |
|---------|---------|
| `ICollisionActor.LayerName` | world owned layer assignment through `CollisionWorld2D.Insert(...)` |
| mutate `ICollisionActor.LayerName` to change membership | `CollisionWorld2D.MoveToLayer(...)` |
| inspect actor layer through actor state | `CollisionWorld2D.TryGetLayerName(...)` or `CollisionWorld2D.GetLayerName(...)` |
| `ICollisionActor.Bounds` | `ICollisionActor.Shape` |
| `IShapeF` | explicit bounding volume types plus `CollisionShape2D` where needed |
| `RectangleF` as actor collision bounds | `BoundingBox2D` |
| `CircleF` as actor collision bounds | `BoundingCircle2D` |
| `OrientedRectangle` as actor collision bounds | `OrientedBoundingBox2D` |
| `Shape.Intersects(IShapeF, IShapeF)` | `CollisionShape2D.Intersects(...)`, bounding volume `Intersects(...)`, or `Collision2D` |
| `CollisionComponent.Update(...)` as the main world collision path | `CollisionWorld2D` queries plus explicit layer resets |
| `ICollisionActor.OnCollision(...)` callback handling | explicit collision handling in your own game code |
| callback penetration-only response | `CollisionResult2D` where supported |

## Before and After: Minimal Example

**Before (5.5.1 style):**

```cs
public sealed class BoxActor : ICollisionActor
{
    public string LayerName => "actors";

    public RectangleF Bounds { get; private set; }

    IShapeF ICollisionActor.Bounds => Bounds;
}
```

**After (6.0 preview style):**

```cs
public sealed class BoxActor : ICollisionActor
{
    private Vector2 _position;
    private readonly Vector2 _size;

    public int Id { get; }

    public CollisionShape2D Shape { get; private set; }

    public BoxActor(int id, Vector2 position, Vector2 size)
    {
        Id = id;
        _position = position;
        _size = size;
        UpdateShape();
    }


    private void UpdateShape()
    {
        Shape = new CollisionShape2D(
            BoundingBox2D.CreateFromPositionAndSize(_position, _size));
    }
}
```

## What to Read Next

- [Collision Overview](./collision.md) for the 6.0 architecture and API roles
- [Collision Quick Start](./quick-start.md) for the main `CollisionWorld2D` setup path
- [Collision Technical Reference](./technical-reference.md) for the architectural rationale behind the new query oriented design
- [2D Geometry](./2d-geometry.md) for the low level bounding volume and `Collision2D` reference
