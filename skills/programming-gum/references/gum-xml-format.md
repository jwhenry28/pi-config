# Gum XML Format Reference

## Overview

Gum is a UI framework that uses XML to define user interface elements. While Gum Tool is a WYSIWYG editor, all components are saved as XML files that can be created and edited manually. This document describes the XML format used by Gum.

## File Types and Extensions

- **`.gumx`** - GumProjectSave - Main project file that references all screens, components, behaviors, and standard elements
- **`.gusx`** - ScreenSave - Screen definitions (top-level UI containers)
- **`.gucx`** - ComponentSave - Reusable component definitions
- **`.gutx`** - StandardElementSave - Standard element type definitions (primitives)
- **`.behx`** - BehaviorSave - Behavior/interface definitions that enforce requirements on components

## Standard Elements (Primitives)

Standard elements are the basic building blocks:

- **Container** - Groups objects for movement, alignment, positioning, and size
- **Sprite** - Displays images (PNG files or portions of images)
- **Text** - Displays text with alignment, wrapping, and formatting
- **NineSlice** - Stretchable image divided into 9 sections to prevent distortion
- **Polygon** - Shapes defined by ordered points (lines, shapes, collision)
- **ColoredRectangle** - Solid colored rectangle
- **Rectangle** - Rectangle outline
- **Circle** - Circle shape (Skia)
- **Arc** - Curved lines with variable thickness (Skia)
- **RoundedRectangle** - Rectangle with rounded corners (Skia)

## XML Structure Patterns

### Project File (GumProjectSave - .gumx)

```xml
<?xml version="1.0" encoding="utf-8"?>
<GumProjectSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Version>1</Version>
  <DefaultCanvasWidth>800</DefaultCanvasWidth>
  <DefaultCanvasHeight>600</DefaultCanvasHeight>
  
  <!-- Screen references -->
  <ScreenReference>
    <Name>MainScreen</Name>
    <ElementType>Screen</ElementType>
    <LinkType>ReferenceOriginal</LinkType>
  </ScreenReference>
  
  <!-- Component references -->
  <ComponentReference>
    <Name>Controls/ButtonStandard</Name>
    <ElementType>Component</ElementType>
    <LinkType>ReferenceOriginal</LinkType>
  </ComponentReference>
  
  <!-- Standard element references -->
  <StandardElementReference>
    <Name>Sprite</Name>
    <ElementType>Standard</ElementType>
    <LinkType>ReferenceOriginal</LinkType>
  </StandardElementReference>
  
  <!-- Behavior references -->
  <BehaviorReference>
    <Name>ButtonBehavior</Name>
  </BehaviorReference>
</GumProjectSave>
```

### Screen (ScreenSave - .gusx)

```xml
<?xml version="1.0" encoding="utf-8"?>
<ScreenSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>MainScreen</Name>
  
  <!-- Default state with variables -->
  <State>
    <Name>Default</Name>
    <Variable>
      <Type>string</Type>
      <Name>ButtonStandardInstance.ButtonDisplayText</Name>
      <Value xsi:type="xsd:string">Hello World</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ContainerInstance.Width</Name>
      <Value xsi:type="xsd:float">300</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <!-- Instance definitions -->
  <Instance>
    <Name>ButtonStandardInstance</Name>
    <BaseType>Controls/ButtonStandard</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>ContainerInstance</Name>
    <BaseType>Container</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ScreenSave>
```

### Component (ComponentSave - .gucx)

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>Controls/ButtonStandard</Name>
  <BaseType>Container</BaseType>
  
  <!-- Default state -->
  <State>
    <Name>Default</Name>
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">32</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>TextInstance.Text</Name>
      <Value xsi:type="xsd:string">Click Me</Value>
      <ExposedAsName>ButtonDisplayText</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <!-- Additional state categories -->
  <Category>
    <Name>ButtonCategory</Name>
    <State>
      <Name>Enabled</Name>
      <Variable>
        <Type>bool</Type>
        <Name>FocusedIndicator.Visible</Name>
        <Value xsi:type="xsd:boolean">false</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    <State>
      <Name>Disabled</Name>
      <Variable>
        <Type>ColorCategory</Type>
        <Name>Background.ColorCategoryState</Name>
        <Value xsi:type="xsd:string">DarkGray</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <!-- Child instances -->
  <Instance>
    <Name>Background</Name>
    <BaseType>NineSlice</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>TextInstance</Name>
    <BaseType>Text</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <!-- Behaviors this component implements -->
  <Behaviors>
    <ElementBehaviorReference>
      <BehaviorName>ButtonBehavior</BehaviorName>
    </ElementBehaviorReference>
  </Behaviors>
</ComponentSave>
```

### Standard Element (StandardElementSave - .gutx)

```xml
<?xml version="1.0" encoding="utf-8"?>
<StandardElementSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>Sprite</Name>
  
  <State>
    <Name>Default</Name>
    
    <!-- Define all available properties -->
    <Variable>
      <Type>int</Type>
      <Name>Alpha</Name>
      <Value xsi:type="xsd:int">255</Value>
      <Category>Rendering</Category>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <Variable>
      <IsFile>true</IsFile>
      <Type>string</Type>
      <Name>SourceFile</Name>
      <Value xsi:type="xsd:string"></Value>
      <Category>Source</Category>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">100</Value>
      <Category>Dimensions</Category>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Variable lists for arrays -->
    <VariableList xsi:type="VariableListSaveOfString">
      <Type>string</Type>
      <Name>AnimationFrames</Name>
      <Category>Animation</Category>
      <Value />
    </VariableList>
  </State>
  
  <!-- Predefined state categories (e.g., color presets) -->
  <Category>
    <Name>ColorCategory</Name>
    <State>
      <Name>White</Name>
      <Variable>
        <Type>int</Type>
        <Name>Red</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Green</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Blue</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <Behaviors />
</StandardElementSave>
```

### Behavior (BehaviorSave - .behx)

```xml
<?xml version="1.0" encoding="utf-8"?>
<BehaviorSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>ButtonBehavior</Name>
  
  <!-- Required states that components must implement -->
  <Category>
    <Name>ButtonCategory</Name>
    <State>
      <Name>Enabled</Name>
    </State>
    <State>
      <Name>Disabled</Name>
    </State>
    <State>
      <Name>Highlighted</Name>
    </State>
    <State>
      <Name>Pushed</Name>
    </State>
  </Category>
  
  <!-- Required instances (name and base type only) -->
  <RequiredInstances />
  
  <!-- Default component implementation -->
  <DefaultImplementation>Controls/ButtonStandard</DefaultImplementation>
  
  <RequiredVariables />
  <RequiredAnimations />
</BehaviorSave>
```

## Variable Structure

Variables define properties on elements. Each variable has:

### Basic Variable Fields

- **`Type`** - Data type (string, float, int, bool, etc.)
- **`Name`** - Property name or `InstanceName.PropertyName` for child properties
- **`Value`** - The value with `xsi:type` attribute matching the type
- **`SetsValue`** - Boolean indicating if this variable sets a value
- **`Category`** (optional) - Grouping category in the editor
- **`IsFile`** (optional) - Boolean for file path values
- **`ExposedAsName`** (optional) - Exposes this variable with a different name

### Variable Types

Common variable types:

**Primitives:**
- `string`
- `float`
- `int`
- `bool`
- `float?` (nullable float)

**Enums:**
- `DimensionUnitType` - Width/Height units (Absolute=0, RelativeToContainer=2, RelativeToChildren=3, PercentageOfSourceFile=3)
- `PositionUnitType` - X/Y positioning units (PixelsFromLeft=0, PixelsFromCenterX=6, PixelsFromCenterY=7, etc.)
- `HorizontalAlignment` - Text/element horizontal alignment (Left=0, Center=1, Right=2)
- `VerticalAlignment` - Text/element vertical alignment (Top=0, Center=1, Bottom=2)
- `ChildrenLayout` - Container layout mode (Regular=0, TopToBottomStack=1, LeftToRightStack=2)
- `Blend` - Blend mode for rendering
- `TextureAddress` - Texture addressing mode

**Custom Types:**
- `State` - Reference to a state name
- `ColorCategory` - Reference to a color category state
- Category names (e.g., `ButtonCategory`, `StyleCategory`)

### Variable Naming Conventions

- **Element properties:** `Width`, `Height`, `X`, `Y`, `Visible`
- **Child properties:** `InstanceName.PropertyName` (e.g., `TextInstance.Text`)
- **State references:** Uses category type (e.g., `ButtonCategoryState`, `ColorCategoryState`)

## States and Categories

### Default State

Every element has a `Default` state that contains base property values.

### State Categories

Categories group related states:

```xml
<Category>
  <Name>ButtonCategory</Name>
  <State>
    <Name>Enabled</Name>
    <!-- Variables that change in this state -->
  </State>
  <State>
    <Name>Disabled</Name>
    <!-- Variables that change in this state -->
  </State>
</Category>
```

### State Variables

States only include variables that **change from the default**. Variables not listed in a state remain at their default value.

## Instances

Instances are child elements:

```xml
<Instance>
  <Name>TextInstance</Name>
  <BaseType>Text</BaseType>
  <DefinedByBase>false</DefinedByBase>
</Instance>
```

- **`Name`** - Unique identifier for this instance
- **`BaseType`** - Type (standard element name or component path like `Controls/ButtonStandard`)
- **`DefinedByBase`** - Whether this instance comes from the base type

### Parent-Child Relationships

Set parent via variable:

```xml
<Variable>
  <Type>string</Type>
  <Name>ChildInstance.Parent</Name>
  <Value xsi:type="xsd:string">ParentInstance</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

## Behaviors

### Component Behaviors

Components can implement behaviors:

```xml
<Behaviors>
  <ElementBehaviorReference>
    <BehaviorName>ButtonBehavior</BehaviorName>
  </ElementBehaviorReference>
</Behaviors>
```

### Behavior Requirements

Behaviors define:
- Required state categories and states
- Required instances (name and base type only)
- Default implementation

Components using a behavior must:
- Include all required states and categories
- Include all required instances with matching name and base type
- Can add additional states, categories, and instances

## Common Property Patterns

### Dimensions

```xml
<Variable>
  <Type>float</Type>
  <Name>Width</Name>
  <Value xsi:type="xsd:float">128</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>DimensionUnitType</Type>
  <Name>WidthUnits</Name>
  <Value xsi:type="xsd:int">0</Value>  <!-- 0 = Absolute -->
  <SetsValue>true</SetsValue>
</Variable>
```

### Position

```xml
<Variable>
  <Type>float</Type>
  <Name>X</Name>
  <Value xsi:type="xsd:float">10</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>PositionUnitType</Type>
  <Name>XUnits</Name>
  <Value xsi:type="xsd:int">0</Value>  <!-- 0 = PixelsFromLeft -->
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>HorizontalAlignment</Type>
  <Name>XOrigin</Name>
  <Value xsi:type="xsd:int">0</Value>  <!-- 0 = Left -->
  <SetsValue>true</SetsValue>
</Variable>
```

### Color (RGB)

```xml
<Variable>
  <Type>int</Type>
  <Name>Red</Name>
  <Value xsi:type="xsd:int">255</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>int</Type>
  <Name>Green</Name>
  <Value xsi:type="xsd:int">255</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>int</Type>
  <Name>Blue</Name>
  <Value xsi:type="xsd:int">255</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>int</Type>
  <Name>Alpha</Name>
  <Value xsi:type="xsd:int">255</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

### Text

```xml
<Variable>
  <Type>string</Type>
  <Name>Text</Name>
  <Value xsi:type="xsd:string">Hello World</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>HorizontalAlignment</Type>
  <Name>HorizontalAlignment</Name>
  <Value xsi:type="xsd:int">1</Value>  <!-- 1 = Center -->
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>VerticalAlignment</Type>
  <Name>VerticalAlignment</Name>
  <Value xsi:type="xsd:int">1</Value>  <!-- 1 = Center -->
  <SetsValue>true</SetsValue>
</Variable>
```

### Sprite Source

```xml
<Variable>
  <IsFile>true</IsFile>
  <Type>string</Type>
  <Name>SourceFile</Name>
  <Value xsi:type="xsd:string">Textures/button.png</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

### Container Layout

```xml
<Variable>
  <Type>ChildrenLayout</Type>
  <Name>ChildrenLayout</Name>
  <Value xsi:type="xsd:int">1</Value>  <!-- 1 = TopToBottomStack -->
  <SetsValue>true</SetsValue>
</Variable>
```

## Exposed Variables

Variables can be exposed with custom names:

```xml
<Variable>
  <Type>string</Type>
  <Name>TextInstance.Text</Name>
  <Value xsi:type="xsd:string">Click Me</Value>
  <ExposedAsName>ButtonDisplayText</ExposedAsName>
  <SetsValue>true</SetsValue>
</Variable>
```

This allows parent elements to set `ButtonDisplayText` instead of `TextInstance.Text`.

## File Organization

Typical Gum project structure:

```
GumProject/
├── GumProject.gumx              # Main project file
├── Screens/
│   ├── MainScreen.gusx
│   └── MenuScreen.gusx
├── Components/
│   └── Controls/
│       ├── ButtonStandard.gucx
│       └── TextBox.gucx
├── Standards/
│   ├── Sprite.gutx
│   ├── Text.gutx
│   └── Container.gutx
└── Behaviors/
    ├── ButtonBehavior.behx
    └── TextBoxBehavior.behx
```

## Key Concepts

### Hierarchy
- **Project** contains **Screens**, **Components**, **Behaviors**, and **Standard Elements**
- **Screens** are top-level UI containers
- **Components** are reusable UI elements
- **Standard Elements** are primitives
- Elements contain **Instances** (children)

### States
- **Default state** contains base values
- **Categories** group related states (e.g., ButtonCategory with Enabled/Disabled)
- **State variables** only list what changes from default
- States can reference other categories via category state variables

### Variables
- Format: `InstanceName.PropertyName` for child properties
- `xsi:type` must match the variable type
- `SetsValue` indicates if the variable is set
- `ExposedAsName` creates an alias

### Behaviors
- Define requirements (like interfaces in code)
- Components implementing behaviors must include required states/categories
- Behaviors only require name and base type for instances
- Components have flexibility in how they implement requirements
