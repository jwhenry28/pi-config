# Gum Concepts and Capabilities

This document summarizes key concepts from the Gum documentation.

## Element Types

### Standard Elements (Primitives)

Standard elements are the basic building blocks of Gum UIs. They include:

- **Container** - Groups objects to simplify movement, alignment, positioning, and size. Usually invisible but can draw outlines for visualization.
- **Sprite** - Displays images (PNG files or portions of images)
- **Text** - Displays text with horizontal/vertical alignment, text wrapping, font support, scaling, and BBCode-style inline formatting
- **NineSlice** - Stretchable images that prevent distortion by dividing into 9 sections
- **Polygon** - Shapes defined by ordered points, used for lines, shapes, and collision
- **ColoredRectangle** - Solid colored rectangle
- **Rectangle** - Rectangle outline
- **Circle** (Skia) - Circle shape requiring Skia plugin
- **Arc** (Skia) - Curved lines with variable thickness, can create wedges
- **RoundedRectangle** (Skia) - Rectangle with rounded corners requiring Skia plugin

### Components

Components are reusable collections of instances that can contain:
- Standard elements
- Other components
- Custom layouts and behaviors

Examples: Button, HealthBar, Slider, Menu, Label

Components can be:
- Small and reusable (Label)
- Large and complex (settings menu with dozens of options)

Component instances can be added to:
- Other Components
- Screens

### Screens

Screens are top-level UI containers. They represent complete UI layouts like:
- Main menu
- Game HUD
- Settings screen
- Pause menu

### Behaviors

Behaviors define requirements for components, similar to interfaces in code. They specify:
- Required state categories and states
- Required instances (name and base type)
- Optional default implementation

**Purpose:**
- Standardize state, category, and instance names
- Simplify component creation
- Reduce spelling and implementation mistakes
- Most commonly used with Gum Forms

**Behavior Rules:**
- Components using a behavior MUST include all required states and categories
- Required states/categories are automatically added when behavior is assigned
- Required states/categories cannot be removed or renamed while behavior is in use
- States don't need to assign values - they only need to exist
- Behaviors only define minimums - components can have additional states/categories
- Removing states/categories from behavior doesn't remove them from components

**Instance Requirements:**
- Behaviors can require specific instances with name and base type
- All other properties can be set to any value
- Components must manually add missing required instances (not automatic)

## States and Categories

### States

States are collections of variables representing element configurations. Every element has a **Default** state that cannot be removed.

All other states must be created within **categories**. Categories group related states that can be applied independently.

Use cases:

- **UI Element Appearance:** Enabled, Disabled, Highlighted, Pushed
- **Animation Positions:** OffScreen, OnScreen
- **Interpolation States:** AmmoFull, AmmoEmpty, Start, End
- **Game Status:** NotJoined, PlayerJoined
- **Responsive Design:** MobileLayout, TabletLayout, DesktopLayout, UltraWideLayout

**Default State:**
- Every element automatically includes a Default state
- Cannot be removed
- Automatically selected
- Base values for all properties

### Categories

Categories group related states:

```
ButtonCategory
├── Enabled
├── Disabled
├── Highlighted
└── Pushed
```

**Category Rules:**
- All non-Default states must be created within categories
- Categories organize related states
- Multiple categories can exist per element and be set independently
- When a variable is set in one state of a category, ALL states in that category explicitly set that variable (inheriting from Default if not changed)
- Variables cannot be removed from individual states - must remove from entire category

**Multiple State Categories:**
An element can have multiple independent state categories that combine at runtime. For example, a button might have:
- **ButtonStateCategory**: Enabled, Disabled, Highlighted, Pushed
- **IconCategory**: A, B, X, Y, LeftStick, RightStick

These can be set independently (e.g., Highlighted + X) allowing complex state combinations without exponential state definitions.

## Properties

### General Properties

Properties shared by all Standard Elements and Components include:
- Position (X, Y, XUnits, YUnits, XOrigin, YOrigin)
- Dimensions (Width, Height, WidthUnits, HeightUnits)
- Visibility (Visible)
- Parent (Parent)
- State (State)

### Element-Specific Properties

Each standard element has its own set of properties:

**Sprite:**
- SourceFile, Texture coordinates
- Color tint (Red, Green, Blue, Alpha)
- FlipHorizontal, FlipVertical
- Rotation
- Animation properties

**Text:**
- Text content
- HorizontalAlignment, VerticalAlignment
- Font, FontSize
- Text wrapping
- Color properties

**NineSlice:**
- SourceFile
- Texture addressing
- Can use single file or 9 separate files with specific suffixes

**Container:**
- ChildrenLayout (Regular, TopToBottomStack, LeftToRightStack)

## Text Features

Text elements support:

- **Horizontal and Vertical alignment**
- **Text wrapping** - Based on Width when WidthUnits is not RelativeToChildren
- **Fonts:**
  - Installed system fonts
  - Custom fonts using Bitmap Font Generator
- **Scaling** - Independent of source font
- **BBCode-style inline formatting**

## NineSlice Features

NineSlice prevents distortion when stretching by:

1. Dividing texture into 9 sections (3x3 grid, each section 1/3 width and height)
2. Scaling each section differently
3. Corners stay original size
4. Edges stretch in one direction
5. Center stretches in both directions

**Texture Options:**
- Single file (divided automatically into 9 sections)
- 9 separate files with specific suffixes:
  - Image_TopLeft.png
  - Image_TopCenter.png
  - Image_TopRight.png
  - Image_Left.png
  - Image_Center.png
  - Image_Right.png
  - Image_BottomLeft.png
  - Image_BottomCenter.png
  - Image_BottomRight.png

## Container Layout

Containers can arrange children with ChildrenLayout:

- **Regular (0)** - Manual positioning, no automatic layout
- **TopToBottomStack (1)** - Vertical stack, children arranged top to bottom
- **LeftToRightStack (2)** - Horizontal stack, children arranged left to right
- **AutoGridHorizontal (3)** - Automatic grid flowing left-to-right, then wrapping to next row
- **AutoGridVertical (4)** - Automatic grid flowing top-to-bottom, then wrapping to next column

### Auto-Grid Layout

Auto-grid layouts automatically arrange children in a grid pattern:
- Set `AutoGridHorizontalCells` to define number of columns (for AutoGridHorizontal)
- Set `AutoGridVerticalCells` to define number of rows (for AutoGridVertical)
- Children are automatically positioned without manual X/Y coordinates
- Useful for inventory grids, icon panels, and other grid-based UIs

## Skia Standard Elements

Skia elements provide advanced vector graphics but have platform limitations.

**Features:**
- Advanced vector graphics
- Shapes: Arc, ColoredCircle, RoundedRectangle
- Vector file formats: SVG, Lottie
- Has Dropshadow, Is Filled, Use Gradient properties

**Enabling Skia:**
1. Plugins → Add Skia Standard Elements
2. Elements appear in standard elements list
3. Add to Screens and Components like any other element

**Platform Considerations:**
- Not all runtimes support Skia standard elements
- May limit which platforms can run your Gum project
- Check platform support before using

### Arc Properties

- Curved lines with variable thickness
- Can create wedges with large thickness
- Thickness remains constant when dimensions change
- Dimensions define bounding rectangle
- SweepAngle defines arc coverage

## XML Storage

All Gum elements are stored as XML:
- Screens: .gusx
- Components: .gucx  
- Standard Elements: .gutx
- Behaviors: .behx
- Project: .gumx

This allows:
- Manual editing without Gum Tool
- Version control friendly
- Programmatic generation
- Text-based diffing

## Variable System

Variables define element properties with:
- Type (string, float, int, bool, enums, custom types)
- Name (property or InstanceName.PropertyName for children)
- Value (typed with xsi:type)
- SetsValue flag
- Optional Category for organization
- Optional ExposedAsName for custom naming

**State Variables:**
- Only include properties that differ from Default state
- Keeps files small and focused
- Unlisted properties use Default state values

## Instance Hierarchy

Elements contain instances (children):
- Instance has Name, BaseType, DefinedByBase
- BaseType can be standard element or component path
- Parent-child relationships via Parent property
- Instances can be nested multiple levels

## Exposed Variables

Components can expose internal variables with custom names:
- Original: `TextInstance.Text`
- Exposed as: `ButtonDisplayText`
- Allows cleaner external API
- Hides internal structure
