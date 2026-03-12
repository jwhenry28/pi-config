# Practical Gum XML Examples

This document provides complete, working examples of common Gum UI elements.

## File Organization Example

**CRITICAL:** This shows the required directory structure. Save files in the correct locations!

```
GumProject/
├── GumProject.gumx                          # Project file
├── Components/
│   ├── SimpleButton.gucx                    # Referenced as "SimpleButton"
│   ├── SimpleUI.gucx                        # Referenced as "SimpleUI"
│   └── Controls/
│       └── ButtonStandard.gucx              # Referenced as "Controls/ButtonStandard"
└── Screens/
    └── MainScreen.gusx                      # Referenced as "MainScreen"
```

In GumProject.gumx:
```xml
<ComponentReference>
  <Name>SimpleButton</Name>                  <!-- No path prefix -->
  <ElementType>Component</ElementType>
  <LinkType>ReferenceOriginal</LinkType>
</ComponentReference>
<ComponentReference>
  <Name>Controls/ButtonStandard</Name>       <!-- WITH path prefix -->
  <ElementType>Component</ElementType>
  <LinkType>ReferenceOriginal</LinkType>
</ComponentReference>
```

## Simple Button Component (Correct Pattern)

**File: `GumProject/Components/SimpleButton.gucx`**

A basic button demonstrating all essential patterns:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>SimpleButton</Name>
  <BaseType>Container</BaseType>
  
  <State>
    <Name>Default</Name>
    
    <!-- Button dimensions -->
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">80</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Background fills the button using PercentageOfParent -->
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.WidthUnits</Name>
      <Value xsi:type="xsd:int">1</Value>  <!-- PercentageOfParent -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Background.Width</Name>
      <Value xsi:type="xsd:float">100</Value>  <!-- 100% -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.HeightUnits</Name>
      <Value xsi:type="xsd:int">1</Value>  <!-- PercentageOfParent -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Background.Height</Name>
      <Value xsi:type="xsd:float">100</Value>  <!-- 100% -->
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Background color exposed for customization -->
    <Variable>
      <Type>int</Type>
      <Name>Background.Red</Name>
      <Value xsi:type="xsd:int">80</Value>
      <ExposedAsName>BackgroundRed</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Green</Name>
      <Value xsi:type="xsd:int">80</Value>
      <ExposedAsName>BackgroundGreen</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Blue</Name>
      <Value xsi:type="xsd:int">80</Value>
      <ExposedAsName>BackgroundBlue</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Text with font configuration -->
    <Variable>
      <Type>string</Type>
      <Name>ButtonText.Text</Name>
      <Value xsi:type="xsd:string">Click Me</Value>
      <ExposedAsName>Text</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <IsFont>true</IsFont>  <!-- REQUIRED for font selection -->
      <Type>string</Type>
      <Name>ButtonText.Font</Name>
      <Value xsi:type="xsd:string">Arial</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ButtonText.FontSize</Name>
      <Value xsi:type="xsd:int">18</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Center text in button -->
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>ButtonText.XUnits</Name>
      <Value xsi:type="xsd:int">6</Value>  <!-- PixelsFromCenterX -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>ButtonText.XOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>  <!-- Center -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>ButtonText.YUnits</Name>
      <Value xsi:type="xsd:int">7</Value>  <!-- PixelsFromCenterY -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>ButtonText.YOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>  <!-- Center -->
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Text color -->
    <Variable>
      <Type>int</Type>
      <Name>ButtonText.Red</Name>
      <Value xsi:type="xsd:int">255</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ButtonText.Green</Name>
      <Value xsi:type="xsd:int">255</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ButtonText.Blue</Name>
      <Value xsi:type="xsd:int">255</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Standard state variable -->
    <Variable>
      <Type>State</Type>
      <Name>State</Name>
      <Value xsi:type="xsd:string">Default</Value>
      <Category>States and Visibility</Category>
      <SetsValue>false</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>Background</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>ButtonText</Name>
    <BaseType>Text</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns Demonstrated:**
- ✅ PercentageOfParent (100%) for fill sizing
- ✅ Exposed properties (BackgroundRed, BackgroundGreen, BackgroundBlue, Text)
- ✅ Font configuration with `IsFont=true`
- ✅ Standard State variable
- ✅ Centered text using XUnits=6, YUnits=7 with Center origin

## Using SimpleButton in a Component (With StackPanel)

**File: `GumProject/Components/SimpleUI.gucx`**

This shows proper usage of existing components and button instances:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>SimpleUI</Name>
  <BaseType>Container</BaseType>
  
  <State>
    <Name>Default</Name>
    
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">256</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">256</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Target square (colored rectangle) -->
    <Variable>
      <Type>float</Type>
      <Name>Target.Width</Name>
      <Value xsi:type="xsd:float">96</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Target.Height</Name>
      <Value xsi:type="xsd:float">96</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>Target.XUnits</Name>
      <Value xsi:type="xsd:int">6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>Target.XOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>Target.YUnits</Name>
      <Value xsi:type="xsd:int">7</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>Target.YOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Target.Y</Name>
      <Value xsi:type="xsd:float">-20</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Target.Red</Name>
      <Value xsi:type="xsd:int">145</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Target.Green</Name>
      <Value xsi:type="xsd:int">153</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Target.Blue</Name>
      <Value xsi:type="xsd:int">186</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Use Controls/StackPanel for button layout -->
    <Variable>
      <Type>ChildrenLayout</Type>
      <Name>ButtonStack.ChildrenLayout</Name>
      <Value xsi:type="xsd:int">2</Value>  <!-- LeftToRightStack -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ButtonStack.StackSpacing</Name>
      <Value xsi:type="xsd:float">5</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ButtonStack.WidthUnits</Name>
      <Value xsi:type="xsd:int">4</Value>  <!-- RelativeToChildren -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ButtonStack.HeightUnits</Name>
      <Value xsi:type="xsd:int">4</Value>  <!-- RelativeToChildren -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>ButtonStack.XUnits</Name>
      <Value xsi:type="xsd:int">6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>ButtonStack.XOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>ButtonStack.YUnits</Name>
      <Value xsi:type="xsd:int">5</Value>  <!-- PixelsFromBottom -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>ButtonStack.YOrigin</Name>
      <Value xsi:type="xsd:int">2</Value>  <!-- Bottom -->
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ButtonStack.Y</Name>
      <Value xsi:type="xsd:float">-20</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Left button -->
    <Variable>
      <Type>string</Type>
      <Name>LeftButton.Parent</Name>
      <Value xsi:type="xsd:string">ButtonStack</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>LeftButton.Text</Name>
      <Value xsi:type="xsd:string">&lt;</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>LeftButton.Width</Name>
      <Value xsi:type="xsd:float">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>LeftButton.BackgroundRed</Name>
      <Value xsi:type="xsd:int">60</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>LeftButton.BackgroundGreen</Name>
      <Value xsi:type="xsd:int">120</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>LeftButton.BackgroundBlue</Name>
      <Value xsi:type="xsd:int">200</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Fire button -->
    <Variable>
      <Type>string</Type>
      <Name>FireButton.Parent</Name>
      <Value xsi:type="xsd:string">ButtonStack</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>FireButton.Text</Name>
      <Value xsi:type="xsd:string">FIRE</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>FireButton.Width</Name>
      <Value xsi:type="xsd:float">80</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>FireButton.BackgroundRed</Name>
      <Value xsi:type="xsd:int">200</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>FireButton.BackgroundGreen</Name>
      <Value xsi:type="xsd:int">60</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>FireButton.BackgroundBlue</Name>
      <Value xsi:type="xsd:int">60</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Right button -->
    <Variable>
      <Type>string</Type>
      <Name>RightButton.Parent</Name>
      <Value xsi:type="xsd:string">ButtonStack</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>RightButton.Text</Name>
      <Value xsi:type="xsd:string">&gt;</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>RightButton.Width</Name>
      <Value xsi:type="xsd:float">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>RightButton.BackgroundRed</Name>
      <Value xsi:type="xsd:int">60</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>RightButton.BackgroundGreen</Name>
      <Value xsi:type="xsd:int">120</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>RightButton.BackgroundBlue</Name>
      <Value xsi:type="xsd:int">200</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Standard state variable -->
    <Variable>
      <Type>State</Type>
      <Name>State</Name>
      <Value xsi:type="xsd:string">Default</Value>
      <Category>States and Visibility</Category>
      <SetsValue>false</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>Target</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>ButtonStack</Name>
    <BaseType>Controls/StackPanel</BaseType>  <!-- Use existing component -->
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>LeftButton</Name>
    <BaseType>SimpleButton</BaseType>  <!-- Our custom button -->
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>FireButton</Name>
    <BaseType>SimpleButton</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>RightButton</Name>
    <BaseType>SimpleButton</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns Demonstrated:**
- ✅ Using `Controls/StackPanel` instead of raw Container
- ✅ RelativeToChildren sizing for auto-fit container
- ✅ Customizing button colors via exposed properties
- ✅ Proper parent-child relationships
- ✅ Positioning from bottom with YUnits=5, YOrigin=2

## Health Bar Component

A health bar with background, fill, and text:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>HealthBar</Name>
  <BaseType>Container</BaseType>
  
  <State>
    <Name>Default</Name>
    
    <!-- Bar dimensions -->
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">200</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">30</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Background (dark gray) fills entire bar -->
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Red</Name>
      <Value xsi:type="xsd:int">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Green</Name>
      <Value xsi:type="xsd:int">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Blue</Name>
      <Value xsi:type="xsd:int">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Fill (green) starts at 100% -->
    <Variable>
      <Type>float</Type>
      <Name>Fill.Width</Name>
      <Value xsi:type="xsd:float">0</Value>
      <ExposedAsName>HealthPercentage</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Fill.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Fill.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Fill.Red</Name>
      <Value xsi:type="xsd:int">50</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Fill.Green</Name>
      <Value xsi:type="xsd:int">200</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Fill.Blue</Name>
      <Value xsi:type="xsd:int">50</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Text centered -->
    <Variable>
      <Type>string</Type>
      <Name>HealthText.Text</Name>
      <Value xsi:type="xsd:string">100 / 100</Value>
      <ExposedAsName>HealthDisplay</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>HealthText.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>HealthText.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>HealthText.HorizontalAlignment</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>HealthText.VerticalAlignment</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>HealthText.Red</Name>
      <Value xsi:type="xsd:int">255</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>HealthText.Green</Name>
      <Value xsi:type="xsd:int">255</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>HealthText.Blue</Name>
      <Value xsi:type="xsd:int">255</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>Background</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>Fill</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>HealthText</Name>
    <BaseType>Text</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

## Vertical Menu Component

A menu with stacked items:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>VerticalMenu</Name>
  <BaseType>Container</BaseType>
  
  <State>
    <Name>Default</Name>
    
    <!-- Menu container with auto height -->
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">200</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>HeightUnits</Name>
      <Value xsi:type="xsd:int">3</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Vertical stack layout -->
    <Variable>
      <Type>ChildrenLayout</Type>
      <Name>ChildrenLayout</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Behaviors />
</ComponentSave>
```

## Dialog Box Component

A centered dialog with title and content area:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>DialogBox</Name>
  <BaseType>Container</BaseType>
  
  <State>
    <Name>Default</Name>
    
    <!-- Dialog dimensions -->
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">400</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">300</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Center the dialog -->
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>XUnits</Name>
      <Value xsi:type="xsd:int">6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>XOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>YUnits</Name>
      <Value xsi:type="xsd:int">7</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>YOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Background fills dialog -->
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Red</Name>
      <Value xsi:type="xsd:int">30</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Green</Name>
      <Value xsi:type="xsd:int">30</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.Blue</Name>
      <Value xsi:type="xsd:int">30</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Title bar -->
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>TitleBar.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>TitleBar.Height</Name>
      <Value xsi:type="xsd:float">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>TitleBar.Red</Name>
      <Value xsi:type="xsd:int">60</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>TitleBar.Green</Name>
      <Value xsi:type="xsd:int">60</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>TitleBar.Blue</Name>
      <Value xsi:type="xsd:int">60</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Title text -->
    <Variable>
      <Type>string</Type>
      <Name>TitleText.Text</Name>
      <Value xsi:type="xsd:string">Dialog Title</Value>
      <ExposedAsName>Title</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>TitleText.Parent</Name>
      <Value xsi:type="xsd:string">TitleBar</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>TitleText.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>TitleText.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>TitleText.HorizontalAlignment</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>TitleText.VerticalAlignment</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Content container -->
    <Variable>
      <Type>float</Type>
      <Name>ContentArea.Y</Name>
      <Value xsi:type="xsd:float">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ContentArea.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ContentArea.Height</Name>
      <Value xsi:type="xsd:float">-40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ContentArea.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>Background</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>TitleBar</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>TitleText</Name>
    <BaseType>Text</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>ContentArea</Name>
    <BaseType>Container</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

## Sprite with Texture Region

Display a specific region from a sprite sheet:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>CharacterIcon</Name>
  <BaseType>Container</BaseType>
  
  <State>
    <Name>Default</Name>
    
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">64</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">64</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Icon sprite with custom texture coordinates -->
    <Variable>
      <IsFile>true</IsFile>
      <Type>string</Type>
      <Name>Icon.SourceFile</Name>
      <Value xsi:type="xsd:string">Textures/character_sheet.png</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Icon.TextureLeft</Name>
      <Value xsi:type="xsd:int">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Icon.TextureTop</Name>
      <Value xsi:type="xsd:int">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Icon.TextureWidth</Name>
      <Value xsi:type="xsd:int">64</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Icon.TextureHeight</Name>
      <Value xsi:type="xsd:int">64</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>TextureAddress</Type>
      <Name>Icon.TextureAddress</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Icon.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Icon.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>Icon</Name>
    <BaseType>Sprite</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

## Button with States (Behavior Pattern)

Button component with ButtonCategory states:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>StatefulButton</Name>
  <BaseType>Container</BaseType>
  
  <State>
    <Name>Default</Name>
    
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">120</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">40</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Background fills button -->
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>Background.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Text centered -->
    <Variable>
      <Type>string</Type>
      <Name>ButtonText.Text</Name>
      <Value xsi:type="xsd:string">Button</Value>
      <ExposedAsName>Text</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ButtonText.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ButtonText.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>ButtonText.HorizontalAlignment</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>ButtonText.VerticalAlignment</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- ButtonCategory state variable (required by behavior) -->
    <Variable>
      <Type>ButtonCategory</Type>
      <Name>ButtonCategoryState</Name>
      <SetsValue>false</SetsValue>
    </Variable>
  </State>
  
  <!-- Button states -->
  <Category>
    <Name>ButtonCategory</Name>
    
    <State>
      <Name>Enabled</Name>
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">50</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">100</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">200</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Disabled</Name>
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">70</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">70</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">70</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>ButtonText.Red</Name>
        <Value xsi:type="xsd:int">130</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>ButtonText.Green</Name>
        <Value xsi:type="xsd:int">130</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>ButtonText.Blue</Name>
        <Value xsi:type="xsd:int">130</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Highlighted</Name>
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">70</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">120</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">220</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Pushed</Name>
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">30</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">80</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">180</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <Instance>
    <Name>Background</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>ButtonText</Name>
    <BaseType>Text</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors>
    <ElementBehaviorReference>
      <BehaviorName>ButtonBehavior</BehaviorName>
    </ElementBehaviorReference>
  </Behaviors>
</ComponentSave>
```

## Screen with Component Instances

A simple screen that uses components:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ScreenSave xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Name>MainMenu</Name>
  
  <State>
    <Name>Default</Name>
    
    <!-- Title text at top -->
    <Variable>
      <Type>string</Type>
      <Name>TitleText.Text</Name>
      <Value xsi:type="xsd:string">Main Menu</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>TitleText.Y</Name>
      <Value xsi:type="xsd:float">50</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>TitleText.XUnits</Name>
      <Value xsi:type="xsd:int">6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>TitleText.XOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Menu container centered -->
    <Variable>
      <Type>string</Type>
      <Name>PlayButton.Parent</Name>
      <Value xsi:type="xsd:string">MenuContainer</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>PlayButton.Text</Name>
      <Value xsi:type="xsd:string">Play</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <Variable>
      <Type>string</Type>
      <Name>OptionsButton.Parent</Name>
      <Value xsi:type="xsd:string">MenuContainer</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>OptionsButton.Text</Name>
      <Value xsi:type="xsd:string">Options</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <Variable>
      <Type>string</Type>
      <Name>QuitButton.Parent</Name>
      <Value xsi:type="xsd:string">MenuContainer</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>QuitButton.Text</Name>
      <Value xsi:type="xsd:string">Quit</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Menu container centered, vertical stack -->
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>MenuContainer.XUnits</Name>
      <Value xsi:type="xsd:int">6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>MenuContainer.XOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>MenuContainer.YUnits</Name>
      <Value xsi:type="xsd:int">7</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>MenuContainer.YOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>ChildrenLayout</Type>
      <Name>MenuContainer.ChildrenLayout</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>MenuContainer.HeightUnits</Name>
      <Value xsi:type="xsd:int">3</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>TitleText</Name>
    <BaseType>Text</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>MenuContainer</Name>
    <BaseType>Container</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>PlayButton</Name>
    <BaseType>SimpleButton</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>OptionsButton</Name>
    <BaseType>SimpleButton</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Instance>
    <Name>QuitButton</Name>
    <BaseType>SimpleButton</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ScreenSave>
```

These examples demonstrate common patterns for creating UI elements in Gum's XML format. They can be used as templates and modified for specific needs.

---

# Real-World Examples from Hytale UI

The following examples are from an actual Hytale-style inventory system, demonstrating advanced patterns and techniques.

## Item Slot with Multiple State Categories

A complex inventory slot showing multiple independent state categories:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name>Hytale/ItemSlot</Name>
  <BaseType>Container</BaseType>
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
      <Value xsi:type="xsd:float">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- State category variables for independent state management -->
    <Variable>
      <Type>HasItem</Type>
      <Name>HasItemState</Name>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HasDamage</Type>
      <Name>HasDamageState</Name>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HasQuantity</Type>
      <Name>HasQuantityState</Name>
      <SetsValue>false</SetsValue>
    </Variable>
    <Variable>
      <Type>IsOnHotbar</Type>
      <Name>IsOnHotbarState</Name>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Exposed variables for clean external API -->
    <Variable>
      <Type>RarityCategory</Type>
      <Name>ItemRarityBackgroundInstance.RarityCategoryState</Name>
      <Value xsi:type="xsd:string">None</Value>
      <ExposedAsName>Rarity</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ItemIconInstance.IconLeft</Name>
      <ExposedAsName>IconLeft</ExposedAsName>
      <SetsValue>false</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ItemIconInstance.IconTop</Name>
      <ExposedAsName>IconTop</ExposedAsName>
      <SetsValue>false</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>QuantityTextUnit.Text</Name>
      <Value xsi:type="xsd:string">1</Value>
      <ExposedAsName>Quantity</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>bool</Type>
      <Name>HighlightIndicator.Visible</Name>
      <Value xsi:type="xsd:boolean">false</Value>
      <ExposedAsName>Selected</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Quantity text positioned at bottom-right -->
    <Variable>
      <Type>float</Type>
      <Name>QuantityTextUnit.X</Name>
      <Value xsi:type="xsd:float">-6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>QuantityTextUnit.XOrigin</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>QuantityTextUnit.XUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>QuantityTextUnit.Y</Name>
      <Value xsi:type="xsd:float">-6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>VerticalAlignment</Type>
      <Name>QuantityTextUnit.YOrigin</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>QuantityTextUnit.YUnits</Name>
      <Value xsi:type="xsd:int">5</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <!-- Independent state categories -->
  <Category>
    <Name>HasItem</Name>
    <State>
      <Name>True</Name>
      <Variable>
        <Type>bool</Type>
        <Name>ItemIconInstance.Visible</Name>
        <Value xsi:type="xsd:boolean">true</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    <State>
      <Name>False</Name>
      <Variable>
        <Type>bool</Type>
        <Name>ItemIconInstance.Visible</Name>
        <Value xsi:type="xsd:boolean">false</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <Category>
    <Name>HasDamage</Name>
    <State>
      <Name>True</Name>
      <Variable>
        <Type>bool</Type>
        <Name>DurabilityIndicatorInstance.Visible</Name>
        <Value xsi:type="xsd:boolean">true</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    <State>
      <Name>False</Name>
      <Variable>
        <Type>bool</Type>
        <Name>DurabilityIndicatorInstance.Visible</Name>
        <Value xsi:type="xsd:boolean">false</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <Category>
    <Name>HasQuantity</Name>
    <State>
      <Name>True</Name>
      <Variable>
        <Type>bool</Type>
        <Name>QuantityTextUnit.Visible</Name>
        <Value xsi:type="xsd:boolean">true</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    <State>
      <Name>False</Name>
      <Variable>
        <Type>bool</Type>
        <Name>QuantityTextUnit.Visible</Name>
        <Value xsi:type="xsd:boolean">false</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <Category>
    <Name>IsOnHotbar</Name>
    <State>
      <Name>True</Name>
      <Variable>
        <Type>bool</Type>
        <Name>SlotNumberInstance.Visible</Name>
        <Value xsi:type="xsd:boolean">true</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    <State>
      <Name>False</Name>
      <Variable>
        <Type>bool</Type>
        <Name>SlotNumberInstance.Visible</Name>
        <Value xsi:type="xsd:boolean">false</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <Instance>
    <Name>ItemRarityBackgroundInstance</Name>
    <BaseType>Hytale/Pieces/ItemRarityBackground</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>ItemIconInstance</Name>
    <BaseType>Hytale/Pieces/ItemIcon</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>SlotNumberInstance</Name>
    <BaseType>Hytale/Pieces/SlotNumber</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>DurabilityIndicatorInstance</Name>
    <BaseType>Hytale/Pieces/DurabilityIndicator</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>QuantityTextUnit</Name>
    <BaseType>Text</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>HighlightIndicator</Name>
    <BaseType>NineSlice</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns:**
- **Multiple State Categories**: HasItem, HasDamage, HasQuantity, IsOnHotbar can all be set independently
- **ExposedAsName**: Clean API (`Rarity`, `IconLeft`, `Selected`) hides internal complexity
- **Composition**: Builds complex slot from smaller piece components

## Durability Bar with Percentage Width

A durability indicator using percentage-based width:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name>Hytale/Pieces/DurabilityIndicator</Name>
  <BaseType>Container</BaseType>
  <State>
    <Name>Default</Name>
    
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">100</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Background bar (black) at 100% width -->
    <Variable>
      <Type>int</Type>
      <Name>BackgroundBar.Red</Name>
      <Value xsi:type="xsd:int">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>BackgroundBar.Green</Name>
      <Value xsi:type="xsd:int">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>BackgroundBar.Blue</Name>
      <Value xsi:type="xsd:int">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>BackgroundBar.Width</Name>
      <Value xsi:type="xsd:float">100</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>BackgroundBar.WidthUnits</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>BackgroundBar.Height</Name>
      <Value xsi:type="xsd:float">100</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>BackgroundBar.HeightUnits</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Foreground bar (green-blue) with variable width exposed -->
    <Variable>
      <Type>int</Type>
      <Name>ForegroundBar.Red</Name>
      <Value xsi:type="xsd:int">42</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ForegroundBar.Green</Name>
      <Value xsi:type="xsd:int">142</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ForegroundBar.Blue</Name>
      <Value xsi:type="xsd:int">68</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ForegroundBar.Width</Name>
      <Value xsi:type="xsd:float">75</Value>
      <ExposedAsName>DurabilityRatio</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ForegroundBar.WidthUnits</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ForegroundBar.Height</Name>
      <Value xsi:type="xsd:float">100</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ForegroundBar.HeightUnits</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>BackgroundBar</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>ForegroundBar</Name>
    <BaseType>ColoredRectangle</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns:**
- **PercentageOfParent (1)**: Both bars use percentage units for responsive sizing
- **Exposed Width**: `DurabilityRatio` allows external control of bar fill (0-100)
- **Overlapping Bars**: Foreground drawn over background for fill effect

## Item Rarity Background with Color States

Color-tinted sprite showing different item rarities:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name>Hytale/Pieces/ItemRarityBackground</Name>
  <BaseType>Container</BaseType>
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
      <Value xsi:type="xsd:float">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Sprite from sprite sheet -->
    <Variable>
      <IsFile>true</IsFile>
      <Type>string</Type>
      <Name>Background.SourceFile</Name>
      <Value xsi:type="xsd:string">Components\Hytale\hytale-sprites.png</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.TextureLeft</Name>
      <Value xsi:type="xsd:int">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.TextureTop</Name>
      <Value xsi:type="xsd:int">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.TextureWidth</Name>
      <Value xsi:type="xsd:int">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>Background.TextureHeight</Name>
      <Value xsi:type="xsd:int">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- State category for rarity -->
    <Variable>
      <Type>RarityCategory</Type>
      <Name>RarityCategoryState</Name>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Category>
    <Name>RarityCategory</Name>
    
    <State>
      <Name>None</Name>
      <!-- White tint (no modification) -->
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Common</Name>
      <!-- Brown tint -->
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">137</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">182</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">236</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <!-- Can also change texture coordinates per state if needed -->
      <Variable>
        <Type>int</Type>
        <Name>Background.TextureLeft</Name>
        <Value xsi:type="xsd:int">384</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Uncommon</Name>
      <!-- Green tint -->
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">217</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">209</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.TextureLeft</Name>
        <Value xsi:type="xsd:int">384</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Rare</Name>
      <!-- Blue tint -->
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">119</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">138</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.TextureLeft</Name>
        <Value xsi:type="xsd:int">384</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Epic</Name>
      <!-- Purple tint -->
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">211</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">148</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.TextureLeft</Name>
        <Value xsi:type="xsd:int">384</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
    
    <State>
      <Name>Legendary</Name>
      <!-- Gold tint -->
      <Variable>
        <Type>int</Type>
        <Name>Background.Red</Name>
        <Value xsi:type="xsd:int">255</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Green</Name>
        <Value xsi:type="xsd:int">236</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.Blue</Name>
        <Value xsi:type="xsd:int">126</Value>
        <SetsValue>true</SetsValue>
      </Variable>
      <Variable>
        <Type>int</Type>
        <Name>Background.TextureLeft</Name>
        <Value xsi:type="xsd:int">384</Value>
        <SetsValue>true</SetsValue>
      </Variable>
    </State>
  </Category>
  
  <Instance>
    <Name>Background</Name>
    <BaseType>NineSlice</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns:**
- **Color Tinting**: Same texture with different RGB values creates visual variety
- **State-Based Texture Coords**: Can change both color AND texture region per state
- **Rarity System**: Common game pattern for item quality visualization

## Hotbar with Horizontal Stack and Spacing

A horizontal hotbar using LeftToRightStack layout:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name>Hytale/Hotbar</Name>
  <BaseType>Container</BaseType>
  <State>
    <Name>Default</Name>
    
    <!-- Size to children (RelativeToChildren = 4) -->
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>WidthUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>HeightUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Inner container with horizontal stack -->
    <Variable>
      <Type>ChildrenLayout</Type>
      <Name>InnerStackPanel.ChildrenLayout</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>InnerStackPanel.StackSpacing</Name>
      <Value xsi:type="xsd:float">7</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>InnerStackPanel.Width</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>InnerStackPanel.WidthUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>InnerStackPanel.Height</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>InnerStackPanel.HeightUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- All slots parented to stack panel -->
    <Variable>
      <Type>string</Type>
      <Name>ItemSlotInstance1.Parent</Name>
      <Value xsi:type="xsd:string">InnerStackPanel</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>ItemSlotInstance1.HotbarSlotNumber</Name>
      <Value xsi:type="xsd:string">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>ItemSlotInstance2.Parent</Name>
      <Value xsi:type="xsd:string">InnerStackPanel</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>ItemSlotInstance2.HotbarSlotNumber</Name>
      <Value xsi:type="xsd:string">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <!-- ... repeat for slots 3-9 ... -->
  </State>
  
  <Instance>
    <Name>InnerStackPanel</Name>
    <BaseType>Controls/StackPanel</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>ItemSlotInstance1</Name>
    <BaseType>Hytale/ItemSlot</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>ItemSlotInstance2</Name>
    <BaseType>Hytale/ItemSlot</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <!-- ... repeat instances for slots 3-9 ... -->
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns:**
- **LeftToRightStack (2)**: Horizontal layout with automatic positioning
- **StackSpacing**: 7 pixels between each slot
- **RelativeToChildren (4)**: Container sizes to fit all children
- **Custom StackPanel**: Uses a StackPanel component with behavior

## Inventory Panel with Auto-Grid Layout

A 9x5 grid of item slots using AutoGridHorizontal:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name>Hytale/InventoryPanel</Name>
  <BaseType>Container</BaseType>
  <State>
    <Name>Default</Name>
    
    <!-- Outer container -->
    <Variable>
      <Type>ChildrenLayout</Type>
      <Name>ChildrenLayout</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Width</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>WidthUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>Height</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>HeightUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Auto-grid configuration for 9x5 layout -->
    <Variable>
      <Type>int</Type>
      <Name>ItemStackPanel.AutoGridHorizontalCells</Name>
      <Value xsi:type="xsd:int">9</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>ItemStackPanel.AutoGridVerticalCells</Name>
      <Value xsi:type="xsd:int">5</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>ChildrenLayout</Type>
      <Name>ItemStackPanel.ChildrenLayout</Name>
      <Value xsi:type="xsd:int">3</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>string</Type>
      <Name>ItemStackPanel.Parent</Name>
      <Value xsi:type="xsd:string">MainContainer</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ItemStackPanel.Width</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ItemStackPanel.WidthUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>ItemStackPanel.Height</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>ItemStackPanel.HeightUnits</Name>
      <Value xsi:type="xsd:int">4</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>HorizontalAlignment</Type>
      <Name>ItemStackPanel.XOrigin</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>PositionUnitType</Type>
      <Name>ItemStackPanel.XUnits</Name>
      <Value xsi:type="xsd:int">6</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- All 45 item slots parented to grid -->
    <Variable>
      <Type>string</Type>
      <Name>ItemSlotInstance1.Parent</Name>
      <Value xsi:type="xsd:string">ItemStackPanel</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <!-- ... repeat for slots 2-45 ... -->
  </State>
  
  <Instance>
    <Name>MainContainer</Name>
    <BaseType>Container</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>ItemStackPanel</Name>
    <BaseType>Controls/StackPanel</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <Instance>
    <Name>ItemSlotInstance1</Name>
    <BaseType>Hytale/ItemSlot</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  <!-- ... repeat instances for slots 2-45 ... -->
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns:**
- **AutoGridHorizontal (3)**: Automatic grid layout that flows left-to-right, then wraps
- **AutoGridHorizontalCells/VerticalCells**: Define grid dimensions (9 columns, 5 rows)
- **Automatic Positioning**: No need to manually position 45 item slots
- **Nested Containers**: MainContainer → ItemStackPanel → ItemSlots for proper layering

## Item Icon with Exposed Texture Coordinates

Simple sprite wrapper exposing texture coordinates:

```xml
<?xml version="1.0" encoding="utf-8"?>
<ComponentSave xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Name>Hytale/Pieces/ItemIcon</Name>
  <BaseType>Container</BaseType>
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
      <Value xsi:type="xsd:float">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Sprite filling container -->
    <Variable>
      <IsFile>true</IsFile>
      <Type>string</Type>
      <Name>SpriteInstance.SourceFile</Name>
      <Value xsi:type="xsd:string">Components\Hytale\hytale-sprites.png</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>TextureAddress</Type>
      <Name>SpriteInstance.TextureAddress</Name>
      <Value xsi:type="xsd:int">1</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Expose texture coordinates for external control -->
    <Variable>
      <Type>int</Type>
      <Name>SpriteInstance.TextureLeft</Name>
      <Value xsi:type="xsd:int">0</Value>
      <ExposedAsName>IconLeft</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>SpriteInstance.TextureTop</Name>
      <Value xsi:type="xsd:int">128</Value>
      <ExposedAsName>IconTop</ExposedAsName>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>SpriteInstance.TextureWidth</Name>
      <Value xsi:type="xsd:int">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>int</Type>
      <Name>SpriteInstance.TextureHeight</Name>
      <Value xsi:type="xsd:int">128</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    
    <!-- Fill container -->
    <Variable>
      <Type>float</Type>
      <Name>SpriteInstance.Width</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>SpriteInstance.WidthUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>float</Type>
      <Name>SpriteInstance.Height</Name>
      <Value xsi:type="xsd:float">0</Value>
      <SetsValue>true</SetsValue>
    </Variable>
    <Variable>
      <Type>DimensionUnitType</Type>
      <Name>SpriteInstance.HeightUnits</Name>
      <Value xsi:type="xsd:int">2</Value>
      <SetsValue>true</SetsValue>
    </Variable>
  </State>
  
  <Instance>
    <Name>SpriteInstance</Name>
    <BaseType>Sprite</BaseType>
    <DefinedByBase>false</DefinedByBase>
  </Instance>
  
  <Behaviors />
</ComponentSave>
```

**Key Patterns:**
- **Wrapper Component**: Encapsulates sprite with clean API
- **ExposedAsName**: `IconLeft` and `IconTop` instead of `SpriteInstance.TextureLeft/Top`
- **TextureAddress = 1 (Custom)**: Enables custom texture coordinate control
- **Shared Sprite Sheet**: Multiple components can reference same sprite sheet file

---

These real-world examples demonstrate advanced Gum patterns used in production-quality UI systems.
