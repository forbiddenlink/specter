# specter-roast

Get a brutally honest roast of your codebase. No setup required.

```bash
npx specter-roast
```

## What It Analyzes

- **File sizes** - Finds your code novels
- **TODOs & FIXMEs** - The procrastination index
- **console.logs** - Debug remnants you forgot about
- **TypeScript `any`** - Type safety violations
- **Suspicious file names** - `helpers.ts`, `utils.js`, `misc.ts`
- **Deep nesting** - Callback hell detection
- **Long functions** - Single responsibility violations
- **Empty files** - Ghost files that serve no purpose
- **Potential duplicates** - Copy-paste programming

## Usage

```bash
# Basic roast
npx specter-roast

# Roast a specific directory
npx specter-roast ./src

# Be gentle
npx specter-roast --mild

# Maximum brutality
npx specter-roast --savage

# JSON output for CI/CD
npx specter-roast --json
```

## Example Output

```
  🔥 CODEBASE ROAST 🔥

  Oh, you want feedback? Alright, let's see what we're working with...

  📊 The Stats:
  You have 42 files. That's 42 opportunities for bugs. Congratulations.
  15,000 lines of code. That's a lot of places to hide mistakes.

  💣 Biggest Offenders:
  • src/cli.ts (2300 lines)
    That's not a file, that's a novel.

  📝 The Procrastination Index:
  23 TODOs and FIXMEs. They're not reminders, they're monuments to procrastination.
  They'll keep waiting.

  🎤 *drops mic*
```

## Want More?

This is a mini-tool from [Specter](https://github.com/forbiddenlink/specter) - a full codebase intelligence toolkit with 51 commands.

```bash
npm install -g specter-mcp
specter scan
specter health
specter tinder    # Swipe right on good code
specter horoscope # Today's coding fortune
```

## License

MIT
