# Contributing to Specter

Thank you for your interest in contributing to Specter! This document provides guidelines and information for contributors.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/forbiddenlink/specter.git
cd specter

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Code Style

We use [Biome](https://biomejs.dev/) for linting and formatting:

```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

## Testing

We use [Vitest](https://vitest.dev/) for testing:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test -- --watch
```

### Writing Tests

- Place tests in `tests/` mirroring the `src/` structure
- Use descriptive test names
- Mock external dependencies (git, file system)
- See existing tests for patterns:
  - `tests/analyzers/git.test.ts` - mocking simple-git
  - `tests/graph/persistence.test.ts` - file I/O testing

## Security

Security is a priority. Please:

- **Never** use string interpolation in shell commands
- Use `spawnSync` with argument arrays instead of `execSync` with strings
- Validate and sanitize all user input
- Run `npm audit` before submitting PRs

See our [Security Policy](SECURITY.md) for reporting vulnerabilities.

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear, descriptive commits
3. Ensure all tests pass and linting is clean
4. Update documentation if needed
5. Submit a PR with a clear description

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new analysis command
fix: resolve memory leak in graph builder
docs: update installation instructions
test: add tests for risk scorer
refactor: extract command handlers
```

## Project Structure

```
specter/
├── src/
│   ├── cli.ts           # CLI entry point
│   ├── commands/        # Command handlers (being refactored)
│   ├── analyzers/       # Code analysis modules
│   ├── graph/           # Knowledge graph
│   ├── risk/            # Risk scoring
│   └── tools/           # MCP tools
├── tests/               # Test files
├── packages/            # Sub-packages
└── vscode-extension/    # VS Code extension
```

## Questions?

Open an issue or discussion if you have questions!
