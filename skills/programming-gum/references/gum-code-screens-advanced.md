# Gum Code: Screen Management

Advanced patterns for multiple screens and MonoGame integration.

## Screen Switching

Clear the root and add a new screen to switch:

```csharp
// In Screen1.cs
partial void CustomInitialize()
{
    ButtonStandardInstance.Click += (_, _) =>
    {
        GumService.Default.Root.Children.Clear();
        var screen = new Screen2();
        screen.AddToRoot();
    };
}
```

| Action | Code |
|--------|------|
| Clear current screen | `GumService.Default.Root.Children.Clear()` |
| Show no screen | Just clear, don't add new |
| Add screen | `screen.AddToRoot()` |

## MonoGame Update Integration

Implement `IUpdateScreen` to receive per-frame updates:

```csharp
// Screen implements the interface
partial class HotbarScreen : IUpdateScreen
{
    partial void CustomInitialize()
    {
        // Setup event handlers...
    }

    public void Update(GameTime gameTime)
    {
        HotbarInstance.HandleKeyboardInput();
    }
}
```

Wire up in Game1.Update:

```csharp
protected override void Update(GameTime gameTime)
{
    GumService.Default.Update(gameTime);

    // Update screens that implement IUpdateScreen
    foreach (var item in GumService.Default.Root.Children)
    {
        if (item is InteractiveGue interactive)
        {
            (interactive.FormsControlAsObject as IUpdateScreen)?.Update(gameTime);
        }
    }

    base.Update(gameTime);
}
```

**Note:** `InteractiveGue` is in the `Gum.Wireframe` namespace. Add `using Gum.Wireframe;` to your Game1.cs.

## Accessing Services in Screens

Inject services via your game's service container:

```csharp
partial class HotbarScreen : IUpdateScreen
{
    InventoryService _inventoryService;

    partial void CustomInitialize()
    {
        // Retrieve service from MonoGame service container
        _inventoryService = Game1.ServiceContainer.GetService<InventoryService>();
        
        // Use service data to populate UI
        SetupRandomHotbar();
    }
}
```

## Cross-Screen Communication

Use events on screens to communicate with game code:

```csharp
partial void CustomInitialize()
{
    HotbarInstance.SelectedIndexChanged += (_, _) =>
    {
        var itemDef = _inventoryService.HotbarInventory(HotbarInstance.SelectedIndex);
        StatusInfo.Text = $"Selected: {itemDef.Name}";
    };
}
```
