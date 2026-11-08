import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMock = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status?: number
  }
  class Anthropic {
    static APIError = APIError
    messages = { create: createMock }
  }
  return { default: Anthropic }
})

import { reasonAboutCode } from '../../src/ai/claude-client.js'

describe('reasonAboutCode', () => {
  beforeEach(() => {
    createMock.mockReset()
    createMock.mockResolvedValue({ content: [{ type: 'text', text: 'answer' }] })
    process.env['ANTHROPIC_API_KEY'] = 'test-key'
  })

  it('puts the context first in <context> tags and the prompt last', async () => {
    const result = await reasonAboutCode('What does this do?', 'const x = 1')

    expect(result).toBe('answer')
    const content = createMock.mock.calls[0]?.[0].messages[0].content as string
    expect(content.startsWith('<context>')).toBe(true)
    expect(content).toBe('<context>\nconst x = 1\n</context>\n\nWhat does this do?')
    expect(content.endsWith('What does this do?')).toBe(true)
  })
})
