# specter

`@purplegumdropz/specter` - a local code-intelligence CLI (npm-published) that builds a
knowledge graph from source + git history and exposes it as CLI commands and MCP tools.
72 commands, 14 MCP tools, 19 "personality" modes. Ships as a Copilot CLI plugin
(`plugin/`) and a VS Code extension (`vscode-extension/`), plus a standalone
`packages/specter-roast` sub-package (`npx @purplegumdropz/specter-roast`).

## Stack

- TypeScript (strict, `NodeNext` module resolution), compiled with `tsc` (no bundler).
- Node >=20. Package manager: pnpm (`packageManager: pnpm@10.34.5`, pnpm-lock.yaml present).
- Vitest 4 (jsdom + React Testing Library for dashboard UI), Biome 2 for lint/format, Husky +
  lint-staged for pre-commit, Typedoc for API docs.
- Fastify (dashboard server), `@modelcontextprotocol/sdk` (MCP server), `@anthropic-ai/sdk`,
  `@ai-sdk/google` (AI-assisted commands), `simple-git`, `ts-morph` (AST analysis), OpenTelemetry
  + Langfuse (optional tracing).

## Commands

```bash
pnpm build          # tsc && copy dashboard static assets into dist/
pnpm dev             # tsc --watch
pnpm test            # vitest (watch)
pnpm test:run        # vitest run
pnpm test:coverage   # vitest run --coverage
pnpm lint            # biome check .        (alias: pnpm biome:check)
pnpm lint:fix        # biome check --write . (alias: pnpm biome:fix)
pnpm format          # biome format --write .
pnpm docs            # typedoc
pnpm scan            # node dist/cli.js scan      (build the knowledge graph)
pnpm dashboard       # node dist/cli.js dashboard  (serve the local dashboard)
```

CI (`.github/workflows/ci.yml`) runs `pnpm install --frozen-lockfile`, `pnpm run lint`,
`pnpm run test:coverage`, `pnpm run build` on Node 22.

## Layout

- `src/cli.ts` - CLI entry (`bin: specter`); `src/index.ts` - MCP server entry (`bin: specter-mcp`).
- `src/commands/{core,ai,analysis,fun,git,visualization,workflow}/` - the 72 CLI commands,
  grouped by category.
- `src/graph/` - knowledge graph builder, persistence, and schema.
- `src/mcp/` - MCP server (tools, resources, prompts).
- `src/analyzers/`, `src/risk/`, `src/history/` - complexity/risk scoring and git-history mining.
- `src/personality/` - the personality-mode system.
- `src/dashboard/` - local web dashboard (static assets copied into `dist/dashboard/` on build).
- `src/ai/`, `src/lib/` - AI client wrappers (Anthropic/Google), logger, telemetry, Langfuse.
- `packages/specter-roast/` - separate npm-published sub-package.
- `plugin/` - the Copilot CLI plugin manifest (`plugin.json`, `hooks.json`, `mcp-config.json`)
  plus its own `agents/`, `hooks/`, `skills/` (Specter's product surface, not this repo's dev
  tooling).
- `vscode-extension/` - separate VS Code extension package.
- `specter.config.example.json` - example project config (complexity thresholds, risk weights,
  dashboard port, git-mining limits); actual config is `specter.config.json` (gitignored).

## Conventions

- Strict TypeScript: `noUncheckedIndexedAccess` and `noPropertyAccessFromIndexSignature` are on,
  so env/index access must go through bracket notation (`process.env['KEY']`), which the
  codebase already does consistently.
- Biome for both lint and format; lint-staged runs `biome check --write` on `*.{ts,tsx,js,jsx}`
  and `biome format --write` on `*.json` at commit time via Husky.
- `pnpm.overrides` in package.json pins many transitive deps for security; when
  Dependabot regenerates `pnpm-lock.yaml` it can drop this block, which then breaks
  `pnpm install --frozen-lockfile` in CI (documented in the CI workflow comments).

## Testing

Vitest with jsdom + `@testing-library/react` for dashboard components, MSW for mocking. Path
alias `@` -> `./src` (set in `vitest.config.ts`; `tsconfig.json` has no `paths` field).

## Env vars

- `ANTHROPIC_API_KEY` - enables Claude-backed AI commands (checked, not required to run).
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_HOST` - optional Langfuse tracing.
- `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` - optional OpenTelemetry.
- `NODE_ENV`, `VERCEL_GIT_COMMIT_SHA` - used for telemetry/Langfuse environment tagging.

## Gotchas

- `dist/` is the build output for both the CLI and MCP server; run `pnpm build` after source
  changes before testing the published binaries (`dist/cli.js`, `dist/index.js`).
- `.specter/` (in consumer repos) holds Specter's own graph cache; this repo's own `.specter/`
  (if present) is local tool state, not source.
