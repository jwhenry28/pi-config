# Common Pitfalls and Solutions

This document lists the most common mistakes when creating Gum UI XML files manually, with solutions.

## File Organization Errors

### ❌ CRITICAL: Gum Project Files Not Copied to Output Directory

**Problem:** Runtime exception when running the game:
```
System.Exception: Could not find main project file 
/bin/Debug/net9.0/Content/GumProject/GumProject.gumx
```

**Cause:** The Gum project files exist in your source tree but aren't being copied to the build output directory.

**Solution:** Add an ItemGroup to your `.csproj` file to copy Gum project files:

```xml
<ItemGroup>
  <None Update="Content/GumProject/**/*.*">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
  </None>
</ItemGroup>
```

**Important:** Use forward slashes (`/`) for cross-platform compatibility, even on Windows.

**Wrong (Windows-only):**
```xml
<None Update="Content\GumProject\**\*.*">    <!-- Backslashes break on Linux/Mac -->
```

**Right (Cross-platform):**
```xml
<None Update="Content/GumProject/**/*.*">     <!-- Forward slashes work everywhere -->
```

### ❌ CRITICAL: ShapeRenderer Not Initialized

**Problem:** Runtime exception or missing shapes when using Gum shapes:
```
System.InvalidOperationException: ShapeRenderer not initialized
```

**Cause:** When using `Gum.Shapes.MonoGame` (Apos.Shapes integration), the ShapeRenderer must be initialized after Gum.

**Solution:** Initialize ShapeRenderer after GumService:

```csharp
protected override void Initialize()
{
    // Initialize Gum first
    GumService.Default.Initialize(this, "GumProject/GumProject.gumx");
    
    // Then initialize ShapeRenderer (required for shapes)
    ShapeRenderer.Self.Initialize();
    
    base.Initialize();
}
```

**Note:** `ShapeRenderer` is in the `MonoGameAndGum.Renderables` namespace.

### ❌ CRITICAL: Files in Wrong Directory

**Problem:**
```
GumProject/
├── GumProject.gumx
├── MyComponent.gucx        ❌ WRONG - in root
└── MyScreen.gusx           ❌ WRONG - in root
```

**Solution:**
```
GumProject/
├── GumProject.gumx
├── Components/
│   └── MyComponent.gucx    ✅ Correct location
└── Screens/
    └── MyScreen.gusx       ✅ Correct location
```

Gum Tool will **not find** files placed in the project root!

### ❌ Wrong Component Path in Project File

**Problem:**
```xml
<!-- File is at: GumProject/Components/Controls/Button.gucx -->
<ComponentReference>
  <Name>Button</Name>        ❌ Missing path prefix
  <ElementType>Component</ElementType>
  <LinkType>ReferenceOriginal</LinkType>
</ComponentReference>
```

**Solution:**
```xml
<ComponentReference>
  <Name>Controls/Button</Name>    ✅ Include directory path
  <ElementType>Component</ElementType>
  <LinkType>ReferenceOriginal</LinkType>
</ComponentReference>
```

## Component vs Screen Confusion

### ❌ Using Screen for Reusable UI Element

**Problem:** Creating a `.gusx` (Screen) file for a button or widget.

**Solution:** Use `.gucx` (Component) for reusable elements. Screens are for top-level application screens only.

**When to use Component:**
- Buttons, panels, widgets, controls
- Anything that will be instantiated multiple times
- Elements used within other components

**When to use Screen:**
- Main menu, game HUD, settings screen
- Top-level full-screen UIs
- Single-instance root containers

## Missing Required Elements

### ❌ Missing xsi:type Attribute

**Problem:**
```xml
<Variable>
  <Type>float</Type>
  <Name>Width</Name>
  <Value>128</Value>        ❌ Missing xsi:type
  <SetsValue>true</SetsValue>
</Variable>
```

**Solution:**
```xml
<Variable>
  <Type>float</Type>
  <Name>Width</Name>
  <Value xsi:type="xsd:float">128</Value>    ✅ Has xsi:type
  <SetsValue>true</SetsValue>
</Variable>
```

**Type mappings:**
- `float` → `xsi:type="xsd:float"`
- `int` → `xsi:type="xsd:int"`
- `string` → `xsi:type="xsd:string"`
- `bool` → `xsi:type="xsd:boolean"`

### ❌ Missing SetsValue

**Problem:**
```xml
<Variable>
  <Type>float</Type>
  <Name>Width</Name>
  <Value xsi:type="xsd:float">128</Value>
  <!-- Missing SetsValue -->
</Variable>
```

**Solution:**
```xml
<Variable>
  <Type>float</Type>
  <Name>Width</Name>
  <Value xsi:type="xsd:float">128</Value>
  <SetsValue>true</SetsValue>    ✅ Always include when setting a value
</Variable>
```

**Rule:** If a `<Value>` is present, `<SetsValue>true</SetsValue>` must also be present.

### ❌ Missing IsFont Marker

**Problem:**
```xml
<Variable>
  <Type>string</Type>
  <Name>TextInstance.Font</Name>
  <Value xsi:type="xsd:string">Arial</Value>    ❌ Missing IsFont marker
  <SetsValue>true</SetsValue>
</Variable>
```

**Solution:**
```xml
<Variable>
  <IsFont>true</IsFont>    ✅ Required for font properties
  <Type>string</Type>
  <Name>TextInstance.Font</Name>
  <Value xsi:type="xsd:string">Arial</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

Always include `<IsFont>true</IsFont>` when setting font names.

### ❌ Missing Standard State Variable

**Problem:** Component without state management variable.

**Solution:** Always include:
```xml
<Variable>
  <Type>State</Type>
  <Name>State</Name>
  <Value xsi:type="xsd:string">Default</Value>
  <Category>States and Visibility</Category>
  <SetsValue>false</SetsValue>
</Variable>
```

This is standard in all components and enables state management.

## Text Configuration Issues

### ❌ Incomplete Text/Font Setup

**Problem:**
```xml
<Variable>
  <Type>string</Type>
  <Name>Label.Text</Name>
  <Value xsi:type="xsd:string">Hello</Value>
  <SetsValue>true</SetsValue>
</Variable>
<!-- Missing font configuration -->
```

**Solution - Complete Text Setup:**
```xml
<!-- Text content -->
<Variable>
  <Type>string</Type>
  <Name>Label.Text</Name>
  <Value xsi:type="xsd:string">Hello</Value>
  <SetsValue>true</SetsValue>
</Variable>

<!-- Font configuration -->
<Variable>
  <IsFont>true</IsFont>
  <Type>string</Type>
  <Name>Label.Font</Name>
  <Value xsi:type="xsd:string">Arial</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>int</Type>
  <Name>Label.FontSize</Name>
  <Value xsi:type="xsd:int">18</Value>
  <SetsValue>true</SetsValue>
</Variable>

<!-- Optional: bold/italic -->
<Variable>
  <Type>bool</Type>
  <Name>Label.IsBold</Name>
  <Value xsi:type="xsd:boolean">false</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

## Sizing and Layout Issues

### ❌ Confusing PercentageOfParent vs RelativeToParent

**Problem:** Using wrong unit type for "fill parent" behavior.

**Solutions:**

**Option 1 - PercentageOfParent (Recommended):**
```xml
<Variable>
  <Type>DimensionUnitType</Type>
  <Name>WidthUnits</Name>
  <Value xsi:type="xsd:int">1</Value>    <!-- PercentageOfParent -->
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>float</Type>
  <Name>Width</Name>
  <Value xsi:type="xsd:float">100</Value>    <!-- 100% of parent -->
  <SetsValue>true</SetsValue>
</Variable>
```

**Option 2 - RelativeToParent:**
```xml
<Variable>
  <Type>DimensionUnitType</Type>
  <Name>WidthUnits</Name>
  <Value xsi:type="xsd:int">2</Value>    <!-- RelativeToParent -->
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>float</Type>
  <Name>Width</Name>
  <Value xsi:type="xsd:float">0</Value>    <!-- 0 offset = same as parent -->
  <SetsValue>true</SetsValue>
</Variable>
```

**Recommendation:** Use PercentageOfParent (100%) - it's clearer and more explicit.

### ❌ Not Using Existing Components

**Problem:** Creating complex layouts with raw Container elements:
```xml
<Instance>
  <Name>MyContainer</Name>
  <BaseType>Container</BaseType>    ❌ Using raw Container
  <DefinedByBase>false</DefinedByBase>
</Instance>
<!-- Then manually setting ChildrenLayout, StackSpacing, etc. -->
```

**Solution:** Use existing components:
```xml
<Instance>
  <Name>MyStackPanel</Name>
  <BaseType>Controls/StackPanel</BaseType>    ✅ Use existing component
  <DefinedByBase>false</DefinedByBase>
</Instance>
```

**Common useful components:**
- `Controls/StackPanel` - Vertical/horizontal stacking
- `Controls/ButtonStandard` - Styled button with states
- `Controls/Panel` - Bordered container
- `Controls/ScrollViewer` - Scrollable area
- `Controls/TextBox` - Text input

## Property Exposure Issues

### ❌ Not Exposing Customizable Properties

**Problem:**
```xml
<!-- Internal properties hard-coded -->
<Variable>
  <Type>int</Type>
  <Name>Background.Red</Name>
  <Value xsi:type="xsd:int">100</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

External users cannot customize the color!

**Solution:**
```xml
<Variable>
  <Type>int</Type>
  <Name>Background.Red</Name>
  <Value xsi:type="xsd:int">100</Value>
  <ExposedAsName>BackgroundRed</ExposedAsName>    ✅ Exposed for external use
  <SetsValue>true</SetsValue>
</Variable>
```

Now external components can set `MyComponent.BackgroundRed` directly.

## State and Category Errors

### ❌ States Without Categories

**Problem:**
```xml
<State>
  <Name>Disabled</Name>    ❌ State outside Default must be in Category
  <!-- Variables -->
</State>
```

**Solution:**
```xml
<Category>
  <Name>ButtonCategory</Name>
  <State>
    <Name>Disabled</Name>    ✅ Inside Category
    <!-- Variables -->
  </State>
</Category>
```

Only the `Default` state can exist outside a Category.

### ❌ Missing State Category Variable

**Problem:** Component has Category but no variable to track current state.

**Solution:**
```xml
<!-- In Default state -->
<Variable>
  <Type>ButtonCategory</Type>    <!-- Matches Category name -->
  <Name>ButtonCategoryState</Name>
  <SetsValue>false</SetsValue>    <!-- Don't set a default value -->
</Variable>

<!-- Then define the Category -->
<Category>
  <Name>ButtonCategory</Name>
  <!-- States here -->
</Category>
```

## Positioning and Alignment Confusion

### ❌ Not Understanding Origin vs Position Units

**Problem:** Element not positioned correctly because origin and units don't match.

**Solution for centering:**
```xml
<!-- Horizontal centering -->
<Variable>
  <Type>PositionUnitType</Type>
  <Name>XUnits</Name>
  <Value xsi:type="xsd:int">6</Value>    <!-- PixelsFromCenterX -->
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>HorizontalAlignment</Type>
  <Name>XOrigin</Name>
  <Value xsi:type="xsd:int">1</Value>    <!-- Center -->
  <SetsValue>true</SetsValue>
</Variable>

<!-- Vertical centering -->
<Variable>
  <Type>PositionUnitType</Type>
  <Name>YUnits</Name>
  <Value xsi:type="xsd:int">7</Value>    <!-- PixelsFromCenterY -->
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>VerticalAlignment</Type>
  <Name>YOrigin</Name>
  <Value xsi:type="xsd:int">1</Value>    <!-- Center -->
  <SetsValue>true</SetsValue>
</Variable>
```

**Quick reference:**
- Center horizontally: `XUnits=6, XOrigin=1`
- Center vertically: `YUnits=7, YOrigin=1`
- Top-left: `XUnits=0, XOrigin=0, YUnits=0, YOrigin=0`
- Bottom-right: `XUnits=4, XOrigin=2, YUnits=5, YOrigin=2`

## Parent-Child Relationship Errors

### ❌ Child Not Appearing

**Problem:** Child instance created but not visible.

**Possible causes and solutions:**

1. **Missing Parent Assignment:**
```xml
<Variable>
  <Type>string</Type>
  <Name>ChildInstance.Parent</Name>
  <Value xsi:type="xsd:string">ParentInstance</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

2. **Child positioned off-screen:**
```xml
<!-- Check X, Y values -->
<Variable>
  <Type>float</Type>
  <Name>ChildInstance.X</Name>
  <Value xsi:type="xsd:float">0</Value>    <!-- Start at 0 -->
  <SetsValue>true</SetsValue>
</Variable>
```

3. **Child invisible:**
```xml
<Variable>
  <Type>bool</Type>
  <Name>ChildInstance.Visible</Name>
  <Value xsi:type="xsd:boolean">true</Value>    <!-- Ensure visible -->
  <SetsValue>true</SetsValue>
</Variable>
```

4. **Child behind parent (z-order):**
   - Instances are rendered in the order they appear in the file
   - Move child instance declaration after parent

## Generated Code Editing

### ❌ Editing .Generated.cs Files

**Problem:** Modifying code in `YourComponent.Generated.cs` files:
```csharp
// In MyComponent.Generated.cs - ❌ WRONG
public partial class MyComponent 
{
    // Your custom code here - THIS WILL BE LOST!
}
```

**Why this fails:** Gum Tool regenerates ALL `.Generated.cs` files every time you make changes in the GUI. Any code you write in these files will be **completely overwritten** on the next save.

**Solution:** Use the custom code file (`YourComponent.cs`) for all custom code:
```csharp
// In MyComponent.cs - ✅ CORRECT
public partial class MyComponent 
{
    // Custom properties
    public int SelectedIndex { get; set; }
    
    // Event handlers
    public event EventHandler? Click;
    
    partial void CustomInitialize()
    {
        // Wire up events, initialize state
        this.Visual.Click += (_, _) => Click?.Invoke(this, EventArgs.Empty);
    }
    
    // Custom methods
    public void Select() { /* ... */ }
}
```

**File structure reminder:**
- `MyComponent.cs` - ✅ **Safe to edit** - Your custom code goes here
- `MyComponent.Generated.cs` - ❌ **Never edit** - Auto-generated by Gum Tool

**When to modify XML vs C#:**
- Modify `.gucx` XML for: structure, layout, visual properties, exposed variables
- Modify `.cs` custom code file for: event handlers, business logic, game integration, additional properties

## Quick Checklist

Before creating a Gum component, verify:

- ✅ File in correct directory (`Components/` or `Screens/`)
- ✅ Component/Screen name matches filename
- ✅ All `<Value>` tags have matching `xsi:type`
- ✅ All variables with values have `<SetsValue>true</SetsValue>`
- ✅ Text elements have `<IsFont>true</IsFont>` on font property
- ✅ Text elements have FontSize configured
- ✅ Standard State variable included
- ✅ Properties exposed via `ExposedAsName` where appropriate
- ✅ Parent-child relationships set via `.Parent` variables
- ✅ Using existing components instead of raw elements where possible
- ✅ Position units and origins match intended behavior

Before running your game, verify:

- ✅ `.csproj` has ItemGroup to copy `Content/GumProject/**/*.*` to output directory
- ✅ Use forward slashes (`/`) in the path for cross-platform compatibility

## Getting Help

If components still don't load:
1. Check file is in `Components/` or `Screens/` directory
2. Verify component name in project file matches subdirectory path
3. Check XML syntax (closing tags, namespaces)
4. Compare against working examples in `references/practical-examples.md`
5. Validate all enum values against `element-properties-quick-reference.md`

If you get "Could not find main project file" at runtime:
1. Check `.csproj` has ItemGroup copying `Content/GumProject/**/*.*` to output
2. Verify forward slashes are used in the path (not backslashes)
3. Check that `GumProject.gumx` exists in your source `Content/GumProject/` directory
4. Verify files are being copied to `bin/Debug/net*/Content/GumProject/` after build
