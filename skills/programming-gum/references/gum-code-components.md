# Gum Code: Working with Components

Quick reference for component interaction, collections, and state management.

## Accessing Child Components

Access children via the generated property (type-safe):

```csharp
// Access a named child instance directly
ItemSlot slot = HotbarInstance.ItemSlotInstance;

// Access children of a container
foreach (ItemSlot child in InnerStackPanel.Children)
{
    child.Click += HandleItemSlotClicked;
}
```

## Component Collections Pattern

Create a collection component with indexed access:

```csharp
partial class Hotbar
{
    // Typed accessor for children
    public ItemSlot Slot(int i) => (ItemSlot)InnerStackPanel.Children[i];

    partial void CustomInitialize()
    {
        foreach (ItemSlot child in InnerStackPanel.Children)
        {
            child.Click += HandleItemSlotClicked;
        }
    }

    private void HandleItemSlotClicked(object sender, EventArgs e)
    {
        ItemSlot itemSlot = (ItemSlot)sender;
        int index = InnerStackPanel.Children.IndexOf(itemSlot);
        // Handle click...
    }
}
```

## Forwarding Click Events

Components can expose their own Click event by forwarding from the underlying visual:

```csharp
partial class ItemSlot
{
    public event EventHandler Click;

    partial void CustomInitialize()
    {
        this.Visual.Click += (_, args) => Click?.Invoke(this, args);
    }
}
```

## State Management

Toggle states by assigning state properties (enums auto-generated from Gum states):

```csharp
// States defined in Gum become enum properties
this.HasItemState = HasItem.False;
this.HasDamageState = HasDamage.True;
this.Rarity = ItemRarityBackground.RarityCategory.Legendary;
```

## Setting Generated Properties

Access exposed variables as typed properties:

```csharp
// Text, colors, positioning
slot.Quantity = "64";
slot.IconLeft = 32;
slot.IconTop = 64;

// Access child instances and their properties
DurabilityIndicatorInstance.ForegroundBar.Color = Color.Red;
```

## Keyboard Input in Components

Access the Gum keyboard service for input handling:

```csharp
public void HandleKeyboardInput()
{
    var keyboard = GumService.Default.Keyboard;
    
    if (keyboard.KeyPushed(Keys.D1))
        SelectedIndex = 0;
    if (keyboard.KeyPushed(Keys.D2))
        SelectedIndex = 1;
    // ...
}
```
