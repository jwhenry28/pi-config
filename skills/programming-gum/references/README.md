# Gum XML Reference Materials

This directory contains reference documentation for working with Gum's XML format.

## Files Overview

### ⚠️ common-pitfalls.md [START HERE]
Critical reference for avoiding common mistakes when creating Gum UI manually:
- File organization requirements (CRITICAL)
- Component vs Screen decision guide
- Missing required elements (xsi:type, SetsValue, IsFont, State variable)
- Text/font configuration patterns
- Sizing and layout issues
- Property exposure best practices
- State and category patterns
- Positioning and alignment
- Parent-child relationship debugging
- Quick checklist before creating components

**Use this when:** You're new to manual Gum XML creation, or your components aren't loading/working correctly. This document consolidates all lessons learned from real-world errors.

### gum-xml-format.md
Comprehensive technical reference for the Gum XML format covering:
- File types and extensions (.gumx, .gusx, .gucx, .gutx, .behx)
- Complete XML structure patterns for all file types
- Variable structure and types
- States and categories
- Instances and parent-child relationships
- Behaviors
- Common property patterns
- File organization
- Key concepts and design patterns

**Use this when:** You need to understand the XML structure or look up specific XML patterns.

### element-properties-quick-reference.md
Quick lookup table for element properties including:
- Common properties (all elements)
- Element-specific properties (Container, Sprite, Text, NineSlice, etc.)
- Enum value reference (DimensionUnitType, PositionUnitType, etc.)
- Variable XML patterns
- Common code patterns (centering, filling parent, sizing to children)

**Use this when:** You need to quickly find what properties an element has or what values an enum takes.

### gum-concepts.md
High-level overview of Gum concepts from the official documentation:
- Element types (Standard Elements, Components, Screens, Behaviors)
- States and categories
- Properties overview
- Text features
- NineSlice functionality
- Container layout modes
- Skia standard elements
- Variable system
- Instance hierarchy
- Exposed variables

**Use this when:** You need to understand Gum's conceptual model or how features work.

### practical-examples.md
Complete, working XML examples for common UI elements:
- Simple button component
- Health bar component
- Vertical menu component
- Dialog box component
- Sprite with texture region
- Button with states (behavior pattern)
- Screen with component instances

**Use this when:** You need a starting template or want to see how patterns are implemented in practice.

### gum-code-spriteruntime.md
Runtime API for SpriteRuntime objects including:
- Creating SpriteRuntime instances in code
- Assigning textures by file name or Texture2D reference
- Dynamically swapping images at runtime (game events, state changes)
- Sprite sheet sub-regions via TextureAddress
- Animating through sprite sheet frames
- RenderTargetTextureSource for render-to-texture
- File loading behavior and texture caching

**Use this when:** You need to dynamically change a sprite's image at runtime, work with sprite sheets in code, or create SpriteRuntime instances programmatically.

## Quick Start

1. **Creating Gum UI manually?** ⚠️ Read `common-pitfalls.md` FIRST to avoid critical errors
2. **New to Gum concepts?** Start with `gum-concepts.md` to understand the overall system
3. **Building a component?** Check `practical-examples.md` for correct templates
4. **Need property values?** Use `element-properties-quick-reference.md`
5. **Deep dive on XML?** Read `gum-xml-format.md`
6. **Dynamically changing sprites?** Read `gum-code-spriteruntime.md` for runtime texture swaps
7. **Debugging issues?** Return to `common-pitfalls.md` for troubleshooting

## Key Concepts Summary

### File Types
- **GumProjectSave (.gumx)** - Main project file
- **ScreenSave (.gusx)** - Top-level UI containers
- **ComponentSave (.gucx)** - Reusable UI components
- **StandardElementSave (.gutx)** - Primitive element definitions
- **BehaviorSave (.behx)** - Interface/requirement definitions

### Element Hierarchy
```
Project
├── Screens (top-level UIs)
├── Components (reusable elements)
│   └── Instances (children)
├── Standard Elements (primitives)
└── Behaviors (requirements/interfaces)
```

### Core Patterns
- **States** - Collections of variable values for different configurations
- **Categories** - Groups of related states (ButtonCategory: Enabled, Disabled, Highlighted, Pushed)
- **Instances** - Child elements with Name and BaseType
- **Variables** - Property definitions with Type, Name, Value, SetsValue
- **Exposed Variables** - Internal properties renamed for external use

### Common Standard Elements
- **Container** - Group and layout children
- **Sprite** - Display images
- **Text** - Display text with formatting
- **NineSlice** - Stretchable images
- **ColoredRectangle** - Solid colored rectangle
- **Polygon** - Shape from points

## MonoGame Integration

While these references focus on the XML format, Gum is typically used with MonoGame through:
- **MonoGameGum** - Runtime library for loading and rendering Gum files
- **GumRuntime** - Core runtime without platform dependencies

The XML files are loaded at runtime and converted into renderable UI elements.

## Notes on XML Schema

All Gum XML files use:
```xml
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
xmlns:xsd="http://www.w3.org/2001/XMLSchema"
```

And require `xsi:type` attributes on values to match the variable type:
- `xsi:type="xsd:string"` for string values
- `xsi:type="xsd:float"` for float values
- `xsi:type="xsd:int"` for int values
- `xsi:type="xsd:boolean"` for bool values
