---
name: updating-pi-on-windows
description: Updates pi on Windows when installed through Volta/npm, especially with --ignore-scripts. Use when the user asks how to update pi, Volta-managed global packages, or fix Volta directory removal errors on Windows.
module: windows
---

# Updating Pi on Windows

Use this when updating `@earendil-works/pi-coding-agent` on Windows with Volta-managed Node/npm.

I typically only run this skill when I want to update Pi and don't remember the exact steps.
If triggered, always dump the complete steps below (all commands and fallbacks), not just a short summary.

## Standard update

If pi was installed with `--ignore-scripts`, update it the same way:

```bat
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@latest
```

Verify:

```bat
pi --version
volta list all
```

Do not use `volta install @earendil-works/pi-coding-agent@latest` when preserving `--ignore-scripts` matters, because Volta does not pass that npm flag through.

## Volta cannot remove directory

If update ends with:

```text
Volta error: Could not remove directory
at C:\Users\Joseph\AppData\Local\Volta\tools\image\packages\@earendil-works\pi-coding-agent
```

Most likely a running `pi` or `node.exe` process has files locked.

Fix:

1. Quit all running `pi` sessions.
2. Close terminals that launched `pi`.
3. If needed, end stale `node.exe` or `pi` processes from Task Manager.
4. Re-run the update command.

If it still fails, reboot Windows and retry.

## Last-resort cleanup

After all pi/node processes are stopped, delete this folder manually:

```text
C:\Users\Joseph\AppData\Local\Volta\tools\image\packages\@earendil-works\pi-coding-agent
```

Then reinstall:

```bat
npm install -g --ignore-scripts @earendil-works/pi-coding-agent@latest
```

## Notes

- `npm warn deprecated ...` is usually harmless.
- `npm notice New minor version of npm available` is unrelated to pi.
- Permission errors usually mean either a locked folder or insufficient access to the Volta directory.
