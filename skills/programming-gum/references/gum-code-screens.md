# Gum Code: Drawing Screens

Quick reference for displaying Gum screens in MonoGame via code.

## Initialization

Initialize Gum in your Game's `Initialize` method using `GumService.Default`:

```csharp
protected override void Initialize()
{
    GumService.Default.Initialize(this, "GumProject/GumProject.gumx");
    // ...
}
```

**Note:** Some code examples may show `GumUI.Initialize()` - `GumUI` is typically a convenience property in your game class:
```csharp
// In your Game class
private GumService GumUI => GumService.Default;  // Convenience property
```

Always use `GumService.Default` as the canonical entry point.

## Showing a Screen (Generated Code - Type Safe)

Use code-generated screen classes for type-safe access:

```csharp
var screen = new TitleScreen();
screen.AddToRoot();
```

Access instances directly via generated properties:

```csharp
screen.ButtonStandardInstance.Click += (_, _) =>
    screen.ButtonStandardInstance.Text = "Clicked!";
```

## Showing a Screen (Without Code Generation)

For runtime-loaded screens without generated code:

```csharp
var screen = ObjectFinder.Self.GumProjectSave.Screens[0].ToGraphicalUiElement();
screen.AddToRoot();
```

## Required Update/Draw Calls

```csharp
protected override void Update(GameTime gameTime)
{
    GumService.Default.Update(gameTime);
    base.Update(gameTime);
}

protected override void Draw(GameTime gameTime)
{
    GumService.Default.Draw();
    base.Draw(gameTime);
}
```

## Key Methods

| Method | Purpose |
|--------|---------|
| `GumService.Default.Initialize(game, gumxPath)` | Initialize Gum runtime with project file |
| `new ScreenName()` | Instantiate generated screen class |
| `screen.AddToRoot()` | Add screen to render root (enables draw + input) |
| `GumService.Default.Update(gameTime)` | Process input and animations |
| `GumService.Default.Draw()` | Render the UI |

## Generated Code Files

Gum generates two files per screen/component:
- `ScreenName.cs` - Custom code file (write your code here)
- `ScreenName.Generated.cs` - Auto-generated (do not edit)

Add event handlers in the `CustomInitialize()` partial method within the custom code file.
