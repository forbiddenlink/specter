# Publishing Guide

## GitHub Actions Marketplace

The GitHub Action (`action.yml`) is ready for marketplace. To publish:

### 1. Create a GitHub Release

```bash
# Make sure everything is pushed
git push origin main

# Create and push a version tag
git tag -a v1.0.0 -m "v1.0.0 - Initial marketplace release"
git push origin v1.0.0
```

### 2. Publish to Marketplace

1. Go to https://github.com/forbiddenlink/specter/releases/new
2. Select the tag `v1.0.0`
3. Title: "v1.0.0 - Give Your Codebase a Voice"
4. Check **"Publish this Action to the GitHub Marketplace"**
5. Fill in the marketplace categories:
   - Primary: "Code quality"
   - Secondary: "Code review"
6. Click "Publish release"

### Action Features

- Health score, risk level, review time estimates
- PR comment with analysis
- 12 personality modes
- `fail-on-high-risk` option for CI/CD

---

## specter-roast (npm)

The standalone roast tool lives in `packages/specter-roast/`.

### 1. Build

```bash
cd packages/specter-roast
npm install
npm run build
```

### 2. Publish to npm

```bash
# Login if needed
npm login

# Publish
npm publish --access public
```

### Usage After Publishing

```bash
npx specter-roast          # Basic roast
npx specter-roast --savage  # Maximum brutality
npx specter-roast --mild    # Be gentle
npx specter-roast --json    # JSON output
```

---

## specter-mcp (main package)

The main Specter tool is already configured in `package.json`.

```bash
# From repo root
npm run build
npm publish --access public
```

---

## Versioning

Follow semver:
- `v1.0.0` - Initial release
- `v1.0.1` - Bug fixes
- `v1.1.0` - New features (backwards compatible)
- `v2.0.0` - Breaking changes
