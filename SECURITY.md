# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Use [GitHub Security Advisories](https://github.com/forbiddenlink/specter/security/advisories/new) to report privately
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Regular updates on progress
- Credit in release notes (unless you prefer anonymity)

## Security Measures

Specter implements several security measures:

### Command Injection Prevention
- All shell commands use `spawnSync` with argument arrays
- User input is never interpolated into shell strings
- See `src/compare.ts` for the secure `gitCommand()` pattern

### Dependency Security
- Dependabot enabled for automatic security updates
- `npm audit` runs in CI pipeline
- CodeQL analysis on every PR

### Code Review
- All changes require PR review
- Security-sensitive changes get extra scrutiny
- Biome security rules enforced

## Known Security Considerations

### Git Operations
Specter executes git commands on user repositories. While we sanitize inputs, users should:
- Only run Specter on trusted codebases
- Review the commands Specter runs (use `--verbose` flag)

### MCP Server
When running as an MCP server, Specter exposes tools to AI assistants. The tools are read-only and do not modify code.

## Security Updates

Security fixes are released as patch versions. We recommend:
- Keeping Specter updated to the latest version
- Subscribing to GitHub releases for notifications
