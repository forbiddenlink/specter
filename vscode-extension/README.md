# Specter VS Code Extension

Give your codebase a voice - right in VS Code.

## Features

- **Status Bar Health Score**: See your codebase health at a glance
- **Morning Briefing**: Get your daily development briefing
- **Codebase Scan**: Run a full Specter scan from VS Code

## Requirements

- [Specter CLI](https://github.com/forbiddenlink/specter) must be installed: `npm install -g @purplegumdropz/specter`
- A `.specter` file in your workspace root (the extension activates when this is present)

## Commands

| Command | Description |
|---------|-------------|
| `Specter: Show Health` | Display detailed health information |
| `Specter: Morning Briefing` | Get your morning development briefing |
| `Specter: Scan Codebase` | Run a full codebase scan |

## Status Bar

The status bar shows your current health score:
- Green background: Health >= 75
- Yellow background: Health 50-74
- Red background: Health < 50

Click the status bar item to show detailed health information.

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch for changes
npm run watch

# Package for distribution
npx vsce package
```

## Extension Settings

This extension does not contribute any settings yet.

## Known Issues

- Requires Specter CLI to be installed globally
- Health check may be slow on large codebases

## Release Notes

### 0.1.0

Initial release:
- Status bar health indicator
- Basic command palette integration
- Output channel for command results
