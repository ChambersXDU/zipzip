# zipzip

A minimal compress / extract tool that works right from the Explorer context menu — no need to leave the editor.

## Features

- **Compress folder** → Right-click a folder → `zipzip: Compress to .zip`
- **Extract archive** → Right-click a `.zip` / `.tar` / `.tgz` / `.tar.gz` file → `zipzip: Extract to folder`
- Auto-handles name collisions: appends `-1`, `-2`, etc. if the target already exists

## Supported Formats

| Operation | Formats |
|-----------|---------|
| Compress  | `.zip` |
| Extract   | `.zip`, `.tar`, `.tgz`, `.tar.gz` |

## Build

```bash
npx vsce package
```

## Usage

1. Right-click a folder or archive in the VS Code Explorer
2. Select the corresponding menu item

## License

MIT
