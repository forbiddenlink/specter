import { describe, expect, it, vi } from 'vitest'

vi.mock('../../src/mcp/core.js', () => ({
  executeTool: vi.fn(),
  getGraph: vi.fn(),
}))

vi.mock('../../src/tools/get-impact-analysis.js', () => ({
  execute: vi.fn(),
}))

import { registerTools } from '../../src/mcp/tools.js'
import * as getImpactAnalysis from '../../src/tools/get-impact-analysis.js'

interface RegisteredTool {
  name: string
  handler: (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }> }>
}

describe('MCP impact analysis', () => {
  it('returns structured evidence that an agent can use to explain risk', async () => {
    const tools: RegisteredTool[] = []
    const server = {
      tool: (
        name: string,
        _description: string,
        _schema: unknown,
        handler: RegisteredTool['handler']
      ) => tools.push({ name, handler }),
    }
    vi.mocked(getImpactAnalysis.execute).mockReturnValue({
      filePath: 'src/auth.ts',
      found: true,
      riskScore: 82,
      riskLevel: 'high',
      directDependents: ['src/app.ts'],
      indirectDependents: ['src/page.tsx'],
      historicalCoChangers: ['src/auth.test.ts'],
      hiddenDependencies: ['src/session.ts'],
      complexity: 22,
      factors: { dependencyScore: 50, couplingScore: 75, complexityScore: 90, churnScore: 60 },
      recommendations: ['Add focused tests before changing this file.'],
      summary: 'High impact.',
    })

    registerTools(server as never)
    const impactTool = tools.find((tool) => tool.name === 'get_impact_analysis')

    const result = await impactTool!.handler({ filePath: 'src/auth.ts' })

    expect(JSON.parse(result.content[0]!.text)).toMatchObject({
      riskScore: 82,
      directDependents: ['src/app.ts'],
      hiddenDependencies: ['src/session.ts'],
      recommendations: ['Add focused tests before changing this file.'],
    })
  })
})
