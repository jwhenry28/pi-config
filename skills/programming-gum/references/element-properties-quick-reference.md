# Gum Element Properties Quick Reference

## Common Properties (All Elements)

All standard elements and components share these base properties:

| Property | Type | Description | Common Values |
|----------|------|-------------|---------------|
| `X` | float | X position | |
| `Y` | float | Y position | |
| `XUnits` | PositionUnitType | X positioning mode | 0=PixelsFromLeft, 6=PixelsFromCenterX |
| `YUnits` | PositionUnitType | Y positioning mode | 1=PixelsFromTop, 7=PixelsFromCenterY |
| `XOrigin` | HorizontalAlignment | X anchor point | 0=Left, 1=Center, 2=Right |
| `YOrigin` | VerticalAlignment | Y anchor point | 0=Top, 1=Center, 2=Bottom |
| `Width` | float | Width value | |
| `Height` | float | Height value | |
| `WidthUnits` | DimensionUnitType | Width sizing mode | 0=Absolute, 2=RelativeToContainer, 3=RelativeToChildren |
| `HeightUnits` | DimensionUnitType | Height sizing mode | 0=Absolute, 2=RelativeToContainer, 3=RelativeToChildren |
| `Visible` | bool | Visibility | true/false |
| `Parent` | string | Parent instance name | "" = root |

## Container

Group and layout elements.

| Property | Type | Description | Values |
|----------|------|-------------|--------|
| `ChildrenLayout` | ChildrenLayout | Layout mode | 0=Regular, 1=TopToBottomStack, 2=LeftToRightStack |

## Sprite

Display images.

| Property | Type | Description | Notes |
|----------|------|-------------|-------|
| `SourceFile` | string | Image file path | Use IsFile=true |
| `TextureLeft` | int | Source texture left offset | For sprite sheets |
| `TextureTop` | int | Source texture top offset | For sprite sheets |
| `TextureWidth` | int | Source texture width | 0 = use full texture |
| `TextureHeight` | int | Source texture height | 0 = use full texture |
| `TextureAddress` | TextureAddress | Texture addressing | 0=EntireTexture |
| `Red` | int | Red tint | 0-255 |
| `Green` | int | Green tint | 0-255 |
| `Blue` | int | Blue tint | 0-255 |
| `Alpha` | int | Opacity | 0-255 |
| `FlipHorizontal` | bool | Flip horizontally | true/false |
| `FlipVertical` | bool | Flip vertically | true/false |
| `Rotation` | float | Rotation in degrees | |
| `Animate` | bool | Enable animation | true/false |
| `Blend` | Blend | Blend mode | 0=Normal |

## Text

Display text.

| Property | Type | Description | Common Values |
|----------|------|-------------|---------------|
| `Text` | string | Text content | |
| `HorizontalAlignment` | HorizontalAlignment | Horizontal alignment | 0=Left, 1=Center, 2=Right |
| `VerticalAlignment` | VerticalAlignment | Vertical alignment | 0=Top, 1=Center, 2=Bottom |
| `Red` | int | Text color red | 0-255 |
| `Green` | int | Text color green | 0-255 |
| `Blue` | int | Text color blue | 0-255 |
| `Alpha` | int | Text opacity | 0-255 |
| `Font` | string | Font name | System or custom font |
| `FontSize` | int | Font size | |
| `OutlineThickness` | int | Outline thickness | |

## NineSlice

Stretchable images without distortion.

| Property | Type | Description | Notes |
|----------|------|-------------|-------|
| `SourceFile` | string | Image file path | Use IsFile=true |
| `TextureLeft` | int | Source texture left offset | |
| `TextureTop` | int | Source texture top offset | |
| `TextureWidth` | int | Source texture width | |
| `TextureHeight` | int | Source texture height | |
| `TextureAddress` | TextureAddress | Portion of texture to use | 0=EntireTexture |
| `Red` | int | Red tint | 0-255 |
| `Green` | int | Green tint | 0-255 |
| `Blue` | int | Blue tint | 0-255 |
| `Alpha` | int | Opacity | 0-255 |

## ColoredRectangle

Solid colored rectangle.

| Property | Type | Description | Range |
|----------|------|-------------|-------|
| `Red` | int | Red component | 0-255 |
| `Green` | int | Green component | 0-255 |
| `Blue` | int | Blue component | 0-255 |
| `Alpha` | int | Opacity | 0-255 |

## Polygon

Shape defined by points.

| Property | Type | Description |
|----------|------|-------------|
| `Points` | VariableList | List of point coordinates |

## Arc (Skia)

Curved line or wedge.

| Property | Type | Description | Notes |
|----------|------|-------------|-------|
| `StartAngle` | float | Start angle in degrees | |
| `SweepAngle` | float | Sweep angle in degrees | |
| `Thickness` | float | Line thickness | Large values create wedges |
| `Red` | int | Color red | 0-255 |
| `Green` | int | Color green | 0-255 |
| `Blue` | int | Color blue | 0-255 |
| `Alpha` | int | Opacity | 0-255 |

## RoundedRectangle (Skia)

Rectangle with rounded corners.

| Property | Type | Description | Range |
|----------|------|-------------|-------|
| `CornerRadius` | float | Radius of corners | |
| `Red` | int | Color red | 0-255 |
| `Green` | int | Color green | 0-255 |
| `Blue` | int | Color blue | 0-255 |
| `Alpha` | int | Opacity | 0-255 |
| `IsFilled` | bool | Fill shape | true/false |

## Enum Reference

### DimensionUnitType
- `0` - Absolute (pixels)
- `1` - PercentageOfParent (percentage of parent, 100 = 100%)
- `2` - RelativeToParent (pixels relative to parent, 0 = same as parent)
- `3` - PercentageOfSourceFile (percentage of texture file)
- `4` - RelativeToChildren (sum of children's dimensions plus padding)
- `5` - PercentageOfOtherDimension (e.g., width as % of height)
- `6` - MaintainFileAspectRatio (maintain source file aspect ratio)
- `7` - Ratio (distributed among siblings)
- `8` - AbsoluteMultipliedByFontScale (scaled by device font scale)
- `9` - ScreenPixel (affected by camera zoom)

### PositionUnitType
- `0` - PixelsFromLeft
- `1` - PixelsFromTop
- `5` - PixelsFromBottom
- `6` - PixelsFromCenterX
- `7` - PixelsFromCenterY

### HorizontalAlignment
- `0` - Left
- `1` - Center
- `2` - Right

### VerticalAlignment
- `0` - Top
- `1` - Center
- `2` - Bottom

### ChildrenLayout
- `0` - Regular (manual positioning)
- `1` - TopToBottomStack (vertical stack)
- `2` - LeftToRightStack (horizontal stack)
- `3` - AutoGridHorizontal (automatic horizontal grid)
- `4` - AutoGridVertical (automatic vertical grid)

### TextureAddress
- `0` - EntireTexture
- `1` - Custom (use TextureLeft/Top/Width/Height)

### Blend
- `0` - Normal
- (Other blend modes available)

## Variable XML Pattern

```xml
<Variable>
  <Type>TYPE_HERE</Type>
  <Name>PROPERTY_NAME</Name>
  <Value xsi:type="xsd:TYPE">VALUE_HERE</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

### XSD Type Mapping

| Type | xsd:type |
|------|----------|
| string | xsd:string |
| float | xsd:float |
| int | xsd:int |
| bool | xsd:boolean |

## Common Patterns

### Center an element

```xml
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
```

### Fill parent

```xml
<Variable>
  <Type>DimensionUnitType</Type>
  <Name>WidthUnits</Name>
  <Value xsi:type="xsd:int">2</Value>
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
  <Name>HeightUnits</Name>
  <Value xsi:type="xsd:int">2</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>float</Type>
  <Name>Height</Name>
  <Value xsi:type="xsd:float">0</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

### Size to children

```xml
<Variable>
  <Type>DimensionUnitType</Type>
  <Name>WidthUnits</Name>
  <Value xsi:type="xsd:int">3</Value>
  <SetsValue>true</SetsValue>
</Variable>
<Variable>
  <Type>DimensionUnitType</Type>
  <Name>HeightUnits</Name>
  <Value xsi:type="xsd:int">3</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

### Vertical stack layout

```xml
<Variable>
  <Type>ChildrenLayout</Type>
  <Name>ChildrenLayout</Name>
  <Value xsi:type="xsd:int">1</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

### Set parent

```xml
<Variable>
  <Type>string</Type>
  <Name>ChildInstance.Parent</Name>
  <Value xsi:type="xsd:string">ParentInstance</Value>
  <SetsValue>true</SetsValue>
</Variable>
```

### Expose a property

```xml
<Variable>
  <Type>string</Type>
  <Name>TextInstance.Text</Name>
  <Value xsi:type="xsd:string">Default Text</Value>
  <ExposedAsName>DisplayText</ExposedAsName>
  <SetsValue>true</SetsValue>
</Variable>
```
