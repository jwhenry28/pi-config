---
name: aseprite-plugins
description: Use when creating, packaging, installing, or debugging Aseprite plugins/extensions with Lua scripts, package.json manifests, menu commands, preferences, or plugin lifecycle hooks.
module: aseprite
---

# Aseprite Plugins

Aseprite plugins are extensions packaged from a folder containing `package.json` and one or more Lua scripts contributed via `contributes.scripts`.

## When to Use

- Creating an Aseprite `.aseprite-extension`
- Writing Lua scripts that load as plugins
- Adding menu commands, submenus, or separators
- Persisting plugin settings with `plugin.preferences`
- Debugging `init(plugin)` / `exit(plugin)` lifecycle behavior

## Minimal Plugin Structure

```text
my-plugin/
├── package.json
└── main.lua
```

`package.json`:

```json
{
  "name": "my-plugin",
  "displayName": "My Plugin",
  "description": "Adds custom Aseprite commands",
  "version": "0.1.0",
  "author": {
    "name": "FirstName LastName",
    "email": "my@email.com",
    "url": "https://example.com/"
  },
  "contributors": [],
  "publisher": "myname",
  "license": "CC-BY-4.0",
  "categories": ["Scripts"],
  "contributes": {
    "scripts": [
      { "path": "./main.lua" }
    ]
  }
}
```

`main.lua`:

```lua
function init(plugin)
  if plugin.preferences.count == nil then
    plugin.preferences.count = 0
  end

  plugin:newCommand{
    id="MyPluginCommand",
    title="My Plugin Command",
    group="cel_popup_properties",
    onclick=function()
      plugin.preferences.count = plugin.preferences.count + 1
    end,
    onenabled=function()
      return app.sprite ~= nil
    end,
    onchecked=function()
      return false
    end
  }
end

function exit(plugin)
  print("MyPluginCommand was called " .. plugin.preferences.count .. " times")
end
```

## Lifecycle

| Function | Purpose |
| --- | --- |
| `init(plugin)` | Called when Aseprite initializes the plugin. Register commands and menu groups here. |
| `exit(plugin)` | Called when Aseprite closes/unloads the plugin. Do cleanup or final logging here. |

## Plugin Object

| Field | Purpose |
| --- | --- |
| `plugin.name` | Extension name from the manifest. |
| `plugin.displayName` | Display name from the manifest. |
| `plugin.version` | Version from the manifest. |
| `plugin.path` | Installed extension path. |
| `plugin.preferences` | Lua table automatically saved/restored between sessions. |

Use `plugin.preferences` for plugin-specific settings, counters, and toggles. Initialize defaults defensively in `init(plugin)` when fields are `nil`.

## Menu Commands

Register user-executable commands with `plugin:newCommand`:

```lua
plugin:newCommand{
  id="CommandName",
  title="User Friendly Command Name",
  group="group_id",
  onclick=function()
    -- run command
  end,
  onenabled=function()
    return true
  end,
  onchecked=function()
    return false
  end
}
```

| Property | Purpose |
| --- | --- |
| `id` | Stable command identifier. |
| `title` | User-visible menu label. |
| `group` | Menu group where the command appears. |
| `onclick` | Runs when clicked or invoked by keyboard shortcut. |
| `onenabled` | Optional; return `true` if command is currently enabled. Defaults to enabled. |
| `onchecked` | Optional; return `true` to show the command as checked. Defaults to unchecked. |

Menu group IDs come from Aseprite's `data/gui.xml` `<menus>` definitions. Use an existing group such as `cel_popup_properties`, or create a plugin submenu.

## Submenus and Separators

Create a submenu group:

```lua
plugin:newMenuGroup{
  id="my_plugin_group",
  title="My Plugin",
  group="file_export"
}
```

Add commands to that submenu by using `group="my_plugin_group"` in `plugin:newCommand`.

Create a separator:

```lua
plugin:newMenuSeparator{
  group="my_plugin_group"
}
```

## Packaging and Installation

1. Put `package.json` and Lua scripts in the plugin folder.
2. Compress the folder contents into a `.zip`.
3. Rename the archive from `.zip` to `.aseprite-extension`.
4. Install by double-clicking the extension on Windows/macOS, or use **Edit > Preferences > Extensions > Add Extension**.

## Checklist

- [ ] `package.json` has `name`, `displayName`, `version`, `publisher`, `categories`, and `contributes.scripts`.
- [ ] Script paths in `contributes.scripts` match actual files.
- [ ] Lua script defines `init(plugin)`.
- [ ] Commands use stable, unique `id` values.
- [ ] `onenabled` handles missing sprite/document state when needed.
- [ ] Preferences are initialized when `nil` before use.
- [ ] Extension archive is renamed to `.aseprite-extension`.
