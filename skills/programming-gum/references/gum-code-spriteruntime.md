# Gum Code: SpriteRuntime

Quick reference for creating, configuring, and dynamically manipulating SpriteRuntime instances at runtime.

## Creating a SpriteRuntime

Instantiate a SpriteRuntime and add it to a parent container:

```csharp
var sprite = new SpriteRuntime();
sprite.SourceFileName = "BearTexture.png";
container.Children.Add(sprite);
```

> **Important:** Image files must have `Copy to Output Directory` set to `Copy always` or `Copy if newer` in Visual Studio. Otherwise you'll get: `System.IO.IOException 'Could not get the stream for the file'`

## Assigning Textures

There are two ways to set a SpriteRuntime's texture:

### By File Name (SourceFileName)

Loads from disk, relative to the Content folder (or wherever `RelativeDirectory` points):

```csharp
sprite.SourceFileName = "BearTexture.png";
```

### By Texture2D Reference (Texture)

Assign a Texture2D directly if your game manages its own textures:

```csharp
// MyTexture is a valid Texture2D
sprite.Texture = MyTexture;
```

> **Note:** Assigning `SourceFileName` also sets the `Texture` property internally once the file loads.

## Dynamically Changing a Sprite's Image

Swap a sprite's image at runtime by reassigning either property:

```csharp
// Change image based on game event
void OnPlayerPickedUpItem(string itemTexturePath)
{
    itemIconSprite.SourceFileName = itemTexturePath;
}

// Or swap with a Texture2D reference
void OnSeasonChanged(Texture2D newSeasonTexture)
{
    backgroundSprite.Texture = newSeasonTexture;
}
```

## Texture Address (Sprite Sheets)

By default, a SpriteRuntime displays the entire texture. Set `TextureAddress` to `Custom` to display a sub-region:

```csharp
sprite.TextureAddress = Gum.Managers.TextureAddress.Custom;
sprite.TextureLeft = 0;
sprite.TextureTop = 0;
sprite.TextureWidth = 32;
sprite.TextureHeight = 32;
```

### TextureAddress Values

| Value | Description |
|-------|-------------|
| `Gum.Managers.TextureAddress.EntireTexture` | Display full texture (default) |
| `Gum.Managers.TextureAddress.Custom` | Use TextureLeft/Top/Width/Height to define sub-region |
| `Gum.Managers.TextureAddress.DimensionsBased` | TextureWidth/TextureHeight are applied based on dimensions |

### Texture Coordinate Properties

All values are in pixels. Only applied when `TextureAddress` is `Custom` (or `DimensionsBased` for Width/Height):

| Property | Description |
|----------|-------------|
| `TextureLeft` | Left edge of the source rectangle |
| `TextureTop` | Top edge of the source rectangle |
| `TextureWidth` | Width of the source rectangle |
| `TextureHeight` | Height of the source rectangle |

### Dynamically Changing Sprite Sheet Region

Change which frame/icon is displayed from a sprite sheet:

```csharp
// Switch to a different 32x32 tile on the sprite sheet
void ShowFrame(int column, int row)
{
    sprite.TextureLeft = column * 32;
    sprite.TextureTop = row * 32;
}
```

## RenderTargetTextureSource

A SpriteRuntime can display a texture produced by a ContainerRuntime that renders to a render target. This allows render targets to be scaled, rotated, and positioned using Gum layout.

### Requirements

1. A ContainerRuntime with `IsRenderTarget = true`
2. A SpriteRuntime with `RenderTargetTextureSource` set to that container

```csharp
SpriteRuntime sprite;

protected override void Initialize()
{
    GumService.Default.Initialize(this, "GumProject/GumProject.gumx");

    // Create an invisible container that renders to a texture
    var container = new ContainerRuntime();
    container.AddToRoot();
    container.IsRenderTarget = true;
    container.Dock(Dock.SizeToChildren);
    container.Visible = false;

    // Add children to the container
    var listBox = new ListBox();
    container.AddChild(listBox);
    for (int i = 0; i < 20; i++)
        listBox.Items.Add($"Item {i}");

    // Display the container's render target on a sprite
    sprite = new SpriteRuntime();
    sprite.AddToRoot();
    sprite.Anchor(Anchor.Center);
    sprite.RenderTargetTextureSource = container;

    base.Initialize();
}
```

> **Note:** Containers with `IsRenderTarget = true` perform layout and rendering even when invisible, so SpriteRuntime instances can reference the resulting texture. However, invisible controls on the render target do not receive input events.

## File Loading Behavior

### Relative Directory

Files are loaded relative to `ToolsUtilities.FileManager.RelativeDirectory`, which defaults to the Content folder. If you call `GumService.Default.Initialize` with a `.gumx` file, it's set to the directory containing that file.

### Texture Caching

Gum caches loaded textures by default — assigning the same file to multiple sprites only loads it once:

```csharp
sprite1.SourceFileName = "MyFile.png"; // Loads from disk
sprite2.SourceFileName = "MyFile.png"; // Uses cached Texture2D
```

To force reload (e.g., if a texture file changed):

```csharp
LoaderManager.Self.CacheTextures = false;  // Clears cache, disposes textures
LoaderManager.Self.CacheTextures = true;
sprite.SourceFileName = "MyFile.png";      // Loads fresh from disk
```

> **Warning:** Setting `CacheTextures = false` disposes all cached textures. Any runtime objects still referencing those textures will throw exceptions when drawn.

## Accessing SpriteRuntime from Generated Components

When a Gum component contains a Sprite instance, the generated code provides typed access:

```csharp
partial class ItemSlot
{
    partial void CustomInitialize()
    {
        // Access the generated SpriteRuntime child
        // (exact property name matches the instance name in Gum)
        ItemIconInstance.SourceFileName = "icons/sword.png";

        // Or change texture coordinates for sprite sheet icons
        ItemIconInstance.TextureAddress = Gum.Managers.TextureAddress.Custom;
        ItemIconInstance.TextureLeft = 64;
        ItemIconInstance.TextureTop = 0;
        ItemIconInstance.TextureWidth = 32;
        ItemIconInstance.TextureHeight = 32;
    }
}
```

## Common Patterns

### Swap Image on Game Event

```csharp
// In a component's custom code file
void UpdateCreatureSprite(string creatureType)
{
    CreatureSpriteInstance.SourceFileName = $"creatures/{creatureType}.png";
}
```

### Animate Through Sprite Sheet Frames

```csharp
int currentFrame = 0;
int totalFrames = 8;
int frameWidth = 32;
double frameTimer = 0;
double frameDuration = 0.1; // seconds per frame

void UpdateAnimation(GameTime gameTime)
{
    frameTimer += gameTime.ElapsedGameTime.TotalSeconds;
    if (frameTimer >= frameDuration)
    {
        frameTimer -= frameDuration;
        currentFrame = (currentFrame + 1) % totalFrames;
        sprite.TextureLeft = currentFrame * frameWidth;
    }
}
```

### Toggle Visibility Based on State

```csharp
// Show/hide a sprite based on game state
void SetHasItem(bool hasItem)
{
    ItemIconInstance.Visible = hasItem;
}
```
