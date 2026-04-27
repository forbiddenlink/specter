/**
 * Claude AI Client for Specter
 *
 * Provides AI-powered code reasoning capabilities using the Anthropic API.
 */

import Anthropic from '@anthropic-ai/sdk'

/**
 * Check if AI features are enabled by verifying the API key is set
 */
export function isAIEnabled(): boolean {
  return Boolean(process.env['ANTHROPIC_API_KEY'])
}

/**
 * Reason about code using Claude AI
 *
 * @param prompt - The question or task to perform
 * @param context - Code or context to reason about
 * @returns AI-generated analysis or fallback message if API key not set
 */
export async function reasonAboutCode(prompt: string, context: string): Promise<string> {
  if (!isAIEnabled()) {
    return 'AI features are not available. Set ANTHROPIC_API_KEY environment variable to enable.'
  }

  try {
    const client = new Anthropic()

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `${prompt}\n\nContext:\n${context}`,
        },
      ],
    })

    // Extract text content from the response
    const textContent = message.content.find((block) => block.type === 'text')
    if (textContent && textContent.type === 'text') {
      return textContent.text
    }

    return 'No response generated.'
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return 'Invalid API key. Please check your ANTHROPIC_API_KEY environment variable.'
      }
      if (error.status === 429) {
        return 'Rate limit exceeded. Please try again later.'
      }
      return `API error: ${error.message}`
    }

    if (error instanceof Error) {
      return `Error: ${error.message}`
    }

    return 'An unexpected error occurred while processing your request.'
  }
}
