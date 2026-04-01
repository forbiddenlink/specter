/**
 * OpenTelemetry Tracing Configuration for Specter
 *
 * Provides distributed tracing for codebase analysis operations
 * with manual spans for graph queries, AST analysis, and git operations.
 */

import { NodeSDK, node } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { trace, Span, SpanStatusCode, context, SpanKind } from '@opentelemetry/api';

// Service name for all traces
export const SERVICE_NAME = 'specter';

// Get the tracer for creating spans
const tracer = trace.getTracer(SERVICE_NAME, '1.0.0');

// ============================================================
// SDK Initialization
// ============================================================

let sdkInstance: NodeSDK | null = null;

/**
 * Initialize the OpenTelemetry SDK
 */
export function initTelemetry(): void {
  const isOtelEnabled = process.env['OTEL_ENABLED'] === 'true';
  const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];

  // Use OTLP exporter if endpoint is configured, otherwise console
  const traceExporter = endpoint
    ? new OTLPTraceExporter({ url: endpoint })
    : new node.ConsoleSpanExporter();

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env['OTEL_SERVICE_NAME'] || SERVICE_NAME,
      'service.version': process.env['npm_package_version'] || '1.0.0',
      'deployment.environment': process.env['NODE_ENV'] || 'development',
    }),
    traceExporter,
    instrumentations: isOtelEnabled
      ? [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
          }),
        ]
      : [],
  });

  sdk.start();
  sdkInstance = sdk;

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => console.log('Telemetry shut down'))
      .catch((error) => console.log('Error shutting down telemetry', error))
      .finally(() => process.exit(0));
  });
}

/**
 * Shutdown the SDK
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdkInstance) {
    await sdkInstance.shutdown();
    sdkInstance = null;
  }
}

// ============================================================
// Span Helpers
// ============================================================

/**
 * Wrap an async function with tracing
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const span = tracer.startSpan(name, {
    kind: SpanKind.INTERNAL,
    attributes,
  });

  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    if (error instanceof Error) {
      span.recordException(error);
    }
    throw error;
  } finally {
    span.end();
  }
}

// ============================================================
// Graph Operation Spans
// ============================================================

/**
 * Start a graph query span
 */
export function startGraphQuerySpan(
  queryType: string,
  database?: string
): Span {
  return tracer.startSpan('graph.query', {
    kind: SpanKind.CLIENT,
    attributes: {
      'graph.query_type': queryType,
      'graph.database': database || 'neo4j',
    },
  });
}

/**
 * Start a graph write span
 */
export function startGraphWriteSpan(
  operation: string,
  nodeCount?: number
): Span {
  return tracer.startSpan('graph.write', {
    kind: SpanKind.CLIENT,
    attributes: {
      'graph.operation': operation,
      'graph.node_count': nodeCount,
    },
  });
}

/**
 * Start a graph build span (full graph construction)
 */
export function startGraphBuildSpan(
  projectPath: string,
  fileCount: number
): Span {
  return tracer.startSpan('graph.build', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'graph.project_path': projectPath,
      'graph.file_count': fileCount,
    },
  });
}

// ============================================================
// AST Analysis Spans
// ============================================================

/**
 * Start an AST parse span
 */
export function startASTParseSpan(
  filePath: string,
  language: string,
  parentSpan?: Span
): Span {
  const ctx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();

  return tracer.startSpan(
    'ast.parse',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'ast.file_path': filePath,
        'ast.language': language,
      },
    },
    ctx
  );
}

/**
 * Start an AST analysis span
 */
export function startASTAnalysisSpan(
  analysisType: string,
  fileCount: number,
  parentSpan?: Span
): Span {
  const ctx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();

  return tracer.startSpan(
    'ast.analyze',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'ast.analysis_type': analysisType,
        'ast.file_count': fileCount,
      },
    },
    ctx
  );
}

/**
 * Start a complexity calculation span
 */
export function startComplexitySpan(
  filePath: string,
  parentSpan?: Span
): Span {
  const ctx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();

  return tracer.startSpan(
    'ast.complexity',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'complexity.file_path': filePath,
      },
    },
    ctx
  );
}

// ============================================================
// Git Operation Spans
// ============================================================

/**
 * Start a git history analysis span
 */
export function startGitHistorySpan(
  operation: string,
  commitCount?: number
): Span {
  return tracer.startSpan('git.history', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'git.operation': operation,
      'git.commit_count': commitCount,
    },
  });
}

/**
 * Start a git blame span
 */
export function startGitBlameSpan(
  filePath: string,
  parentSpan?: Span
): Span {
  const ctx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();

  return tracer.startSpan(
    'git.blame',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'git.file_path': filePath,
      },
    },
    ctx
  );
}

/**
 * Start a git diff span
 */
export function startGitDiffSpan(
  fromRef: string,
  toRef: string,
  parentSpan?: Span
): Span {
  const ctx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();

  return tracer.startSpan(
    'git.diff',
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'git.from_ref': fromRef,
        'git.to_ref': toRef,
      },
    },
    ctx
  );
}

// ============================================================
// Command Execution Spans
// ============================================================

/**
 * Start a CLI command span
 */
export function startCommandSpan(
  command: string,
  args: string[]
): Span {
  return tracer.startSpan('command.execute', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'command.name': command,
      'command.args': args.join(' '),
    },
  });
}

/**
 * Start a scan command span
 */
export function startScanSpan(
  projectPath: string,
  options: { includeTests?: boolean; maxDepth?: number }
): Span {
  return tracer.startSpan('command.scan', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'scan.project_path': projectPath,
      'scan.include_tests': options.includeTests ?? false,
      'scan.max_depth': options.maxDepth,
    },
  });
}

// ============================================================
// AI Operation Spans
// ============================================================

/**
 * Start an AI query span
 */
export function startAIQuerySpan(
  queryType: string,
  model: string,
  parentSpan?: Span
): Span {
  const ctx = parentSpan ? trace.setSpan(context.active(), parentSpan) : context.active();

  return tracer.startSpan(
    'ai.query',
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'ai.query_type': queryType,
        'ai.model': model,
      },
    },
    ctx
  );
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * End a span with result attributes
 */
export function endSpanWithResult(
  span: Span,
  result: {
    success: boolean;
    durationMs?: number;
    recordCount?: number;
    error?: Error | string;
  }
): void {
  span.setAttribute('result.success', result.success);

  if (result.durationMs !== undefined) {
    span.setAttribute('result.duration_ms', result.durationMs);
  }
  if (result.recordCount !== undefined) {
    span.setAttribute('result.record_count', result.recordCount);
  }

  if (!result.success) {
    const errorMessage = result.error instanceof Error ? result.error.message : result.error;
    span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
    if (result.error instanceof Error) {
      span.recordException(result.error);
    }
  } else {
    span.setStatus({ code: SpanStatusCode.OK });
  }

  span.end();
}

/**
 * Get the current active span
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Run a function within a span context
 */
export function runWithSpan<T>(span: Span, fn: () => T): T {
  return context.with(trace.setSpan(context.active(), span), fn);
}

export default { initTelemetry, shutdownTelemetry };
