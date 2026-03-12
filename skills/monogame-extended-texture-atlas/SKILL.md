---
name: monogame-extended-texture-atlas
description: Use when creating Texture2DAtlas JSON files for MonoGame.Extended, working with sprite sheets, or getting "atlas not found" errors - provides the exact MonoGame.Extended JSON schema which differs from TexturePacker and other atlas formats
module: monogame
---

# MonoGame.Extended Texture2DAtlas JSON

## Overview

MonoGame.Extended requires a specific JSON schema for Texture2DAtlas files. Using wrong formats (TexturePacker, Aseprite, generic atlas) will fail to load.

## Required Schema

```json
{
  "textures": [
    {
      "filename": "sprites/spritesheet.png",
      "frames": {
        "sprite_name": {
          "frame": {"x": 0, "y": 0, "w": 32, "h": 32}
        }
      }
    }
  ],
  "meta": {
    "dataformat": "monogame-extended",
    "version": "1.2"
  }
}
```

## Quick Reference

| Field | Required | Type | Example | Purpose |
|-------|----------|------|---------|---------|
| `textures` | ✅ | array | `[{...}]` | List of sprite sheets |
| `filename` | ✅ | string | `"sprites/sheet.png"` | Path to PNG from Content root |
| `frames` | ✅ | object | `{"name": {...}}` | Sprite definitions (NOT array) |
| `frame` | ✅ | object | `{"x":0,"y":0,"w":16,"h":16}` | Rectangle coordinates |
| `meta` | ✅ | object | `{"dataformat":"monogame-extended"}` | Format identifier |
| `dataformat` | ✅ | string | `"monogame-extended"` | Must be exact string |
| `size` | ❌ | object | `{"w":32,"h":32}` | Original size before trimming |
| `offset` | ❌ | object | `{"x":4,"y":2}` | Trimmed pixels from top-left |
| `pivot` | ❌ | object | `{"x":0.5,"y":1}` | Origin point (0.5,1 = bottom-center) |
| `rotated` | ❌ | number | `90` | Degrees rotated in atlas |

## Complete Example

```json
{
  "textures": [{
    "filename": "sprites/characters.png",
    "frames": {
      "hero_idle": {
        "frame": {"x": 0, "y": 0, "w": 32, "h": 32},
        "pivot": {"x": 0.5, "y": 1}
      },
      "hero_walk": {
        "frame": {"x": 32, "y": 0, "w": 32, "h": 32},
        "pivot": {"x": 0.5, "y": 1}
      },
      "enemy_rotated": {
        "frame": {"x": 0, "y": 32, "w": 48, "h": 24},
        "size": {"w": 24, "h": 48},
        "offset": {"x": 2, "y": 4},
        "rotated": 90
      }
    }
  }],
  "meta": {
    "dataformat": "monogame-extended",
    "version": "1.2"
  }
}
```

## Common Mistakes

### ❌ Wrong Structure
```json
// WRONG: "regions" array
{"texture": "...", "regions": [...]}

// WRONG: "name" and "path"
{"textures": [{"name": "...", "path": "..."}]}

// WRONG: TexturePacker format
{"meta": {"app": "TexturePacker"}, "frames": {...}}
```

### ❌ Wrong Field Names
```json
// WRONG: width/height
{"frame": {"x": 0, "y": 0, "width": 32, "height": 32}}

// CORRECT: w/h
{"frame": {"x": 0, "y": 0, "w": 32, "h": 32}}
```

### ❌ Filename Conflicts

**Problem**: MonoGame content pipeline operates on paths without extensions. If you have `sprites.png` and name your JSON `sprites.json`, the pipeline will conflict.

**Solutions**:
1. **Different directories**: `Content/sprites/sheet.png` + `Content/atlas/sheet.json`
2. **Different base names**: `sprites.png` + `sprites-atlas.json`

**Note**: The JSON filename does NOT need to match the PNG filename. The `filename` field inside the JSON specifies the PNG path.

## Loading in Code

```csharp
// In Game1.cs or similar
var atlas = Content.Load<Texture2DAtlas>("atlas/sprites");

// Get specific sprite region
var heroSprite = atlas.GetRegion("hero_idle");

// Draw sprite
spriteBatch.Draw(heroSprite, position, Color.White);
```

## Tool Integration

**TexturePacker**: Use MonoGame.Extended export format. TexturePacker can generate this JSON automatically.

**Manual Creation**: Copy the schema above and fill in sprite coordinates from your image editor.
