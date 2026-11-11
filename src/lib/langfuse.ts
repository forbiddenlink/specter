import { LangfuseSpanProcessor } from '@langfuse/otel'
import { setLangfuseTracerProvider } from '@langfuse/tracing'
import { AlwaysOnSampler, NodeTracerProvider } from '@opentelemetry/sdk-trace-node'

/**
 * Langfuse (SDK v6, OpenTelemetry-based) for LLM observability
 * Traces paranormal data analysis, pattern detection, and AI investigations
 *
 * Uses an isolated tracer provider so Langfuse never registers a global OTEL provider.
 */

let langfuseProcessor: LangfuseSpanProcessor | null = null

export function isLangfuseConfigured(): boolean {
  return !!(process.env['LANGFUSE_PUBLIC_KEY'] && process.env['LANGFUSE_SECRET_KEY'])
}

export function getLangfuse(): LangfuseSpanProcessor | null {
  if (!isLangfuseConfigured()) return null

  if (!langfuseProcessor) {
    langfuseProcessor = new LangfuseSpanProcessor({
      publicKey: process.env['LANGFUSE_PUBLIC_KEY']!,
      secretKey: process.env['LANGFUSE_SECRET_KEY']!,
      baseUrl:
        process.env['LANGFUSE_BASE_URL'] ||
        process.env['LANGFUSE_HOST'] ||
        'https://cloud.langfuse.com',
      environment: process.env['NODE_ENV'],
      release: process.env['VERCEL_GIT_COMMIT_SHA'],
      exportMode: 'immediate',
    })
    setLangfuseTracerProvider(
      new NodeTracerProvider({
        sampler: new AlwaysOnSampler(),
        spanProcessors: [langfuseProcessor],
      })
    )
  }

  return langfuseProcessor
}

export async function flushLangfuse(): Promise<void> {
  const processor = getLangfuse()
  if (processor) await processor.forceFlush()
}
