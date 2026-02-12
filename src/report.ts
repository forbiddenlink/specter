/**
 * Report - Comprehensive Codebase Analysis Report
 *
 * Generates a full codebase health report combining all Specter analyses
 * into a shareable markdown document. Great for team presentations,
 * stakeholder updates, and audits.
 */

import type { KnowledgeGraph } from './graph/types.js';
import { getGraphStats } from './graph/builder.js';
import { generateComplexityReport, getComplexityEmoji } from './analyzers/complexity.js';
import { analyzeKnowledgeDistribution } from './analyzers/knowledge.js';
import { detectDrift, type DriftResult } from './drift.js';
import { detectCycles, type CyclesResult } from './cycles.js';
import { analyzeHotspots, type HotspotsResult } from './hotspots.js';
import { analyzeBusFactor, type BusFactorResult } from './bus-factor.js';
import { projectTrajectory, type TrajectoryResult } from './trajectory.js';
import { analyzeVelocity, type VelocityResult } from './velocity.js';
import { analyzeZones, type ZoneMap } from './zones.js';

// Types
export interface ReportOptions {
  includeHealth: boolean;
  includeRisks: boolean;
  includeDora: boolean;
  includeHotspots: boolean;
  includeBusFactor: boolean;
  includeTrajectory: boolean;
  format: 'markdown' | 'json';
  quick?: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string;
}

export interface ReportResult {
  content: string;
  sections: string[];
  generatedAt: Date;
  outputPath?: string;
  data?: ReportData;
}

export interface ReportData {
  health: {
    score: number;
    grade: string;
    avgComplexity: number;
    hotspotCount: number;
  };
  risks: {
    driftScore: number;
    cycleCount: number;
    violationCount: number;
  };
  busFactor: {
    overall: number;
    riskLevel: string;
    criticalAreas: number;
  };
  trajectory: {
    trend: string;
    rateOfChange: number;
    projectedOneMonth: number;
  };
  hotspots: {
    criticalCount: number;
    highCount: number;
    totalDebtHours: number;
  };
  velocity: {
    trend: string;
    weeklyChange: number;
    projectedDebt: number;
  };
  summary: {
    fileCount: number;
    totalLines: number;
    nodeCount: number;
    edgeCount: number;
  };
}

/**
 * Generate a comprehensive report
 */
export async function generateReport(
  rootDir: string,
  graph: KnowledgeGraph,
  options: ReportOptions
): Promise<ReportResult> {
  const generatedAt = new Date();
  const sections: ReportSection[] = [];
  const stats = getGraphStats(graph);
  const complexityReport = generateComplexityReport(graph);

  // Calculate health score
  const healthScore = Math.max(0, 100 - complexityReport.averageComplexity * 5);
  const healthGrade = getGrade(healthScore);

  // Gather all analysis data
  const analysisData: {
    drift?: DriftResult;
    cycles?: CyclesResult;
    hotspots?: HotspotsResult;
    busFactor?: BusFactorResult;
    trajectory?: TrajectoryResult;
    velocity?: VelocityResult;
    zones?: ZoneMap;
  } = {};

  // Run analyses in parallel where possible
  const analyses: Promise<void>[] = [];

  if (options.includeRisks) {
    analyses.push(
      detectDrift(rootDir, graph).then((r) => {
        analysisData.drift = r;
      })
    );
    // detectCycles is synchronous
    analysisData.cycles = detectCycles(graph);
  }

  if (options.includeHotspots) {
    analyses.push(
      analyzeHotspots(rootDir, graph, { since: '3 months ago', top: 20 }).then((r) => {
        analysisData.hotspots = r;
      })
    );
  }

  if (options.includeBusFactor) {
    analyses.push(
      analyzeBusFactor(graph).then((r) => {
        analysisData.busFactor = r;
      })
    );
  }

  if (options.includeTrajectory) {
    analyses.push(
      projectTrajectory(rootDir, graph).then((r) => {
        analysisData.trajectory = r;
      }),
      analyzeVelocity(rootDir, graph).then((r) => {
        analysisData.velocity = r;
      })
    );
  }

  // Zone analysis is lightweight - always include for recommendations
  analyses.push(
    Promise.resolve().then(() => {
      analysisData.zones = analyzeZones(graph);
    })
  );

  await Promise.all(analyses);

  // Build report data for JSON format
  const reportData: ReportData = {
    health: {
      score: Math.round(healthScore),
      grade: healthGrade,
      avgComplexity: Math.round(complexityReport.averageComplexity * 10) / 10,
      hotspotCount: complexityReport.hotspots.length,
    },
    risks: {
      driftScore: analysisData.drift?.score ?? 100,
      cycleCount: analysisData.cycles?.cycles?.length ?? 0,
      violationCount: analysisData.drift?.violations.length ?? 0,
    },
    busFactor: {
      overall: analysisData.busFactor?.overallBusFactor ?? 0,
      riskLevel: analysisData.busFactor?.riskLevel ?? 'unknown',
      criticalAreas: analysisData.busFactor?.risks.filter((r) => r.criticality === 'critical').length ?? 0,
    },
    trajectory: {
      trend: analysisData.trajectory?.trend ?? 'unknown',
      rateOfChange: analysisData.trajectory?.rateOfChange ?? 0,
      projectedOneMonth: analysisData.trajectory?.projections.oneMonth.projectedHealth ?? healthScore,
    },
    hotspots: {
      criticalCount: analysisData.hotspots?.summary.criticalCount ?? 0,
      highCount: analysisData.hotspots?.summary.highCount ?? 0,
      totalDebtHours: analysisData.hotspots?.summary.totalDebtHours ?? 0,
    },
    velocity: {
      trend: analysisData.velocity?.trend ?? 'unknown',
      weeklyChange: analysisData.velocity?.overallVelocity ?? 0,
      projectedDebt: analysisData.velocity?.projectedDebtIn30Days ?? 0,
    },
    summary: {
      fileCount: stats.fileCount,
      totalLines: stats.totalLines,
      nodeCount: stats.nodeCount,
      edgeCount: stats.edgeCount,
    },
  };

  // JSON format
  if (options.format === 'json') {
    return {
      content: JSON.stringify(reportData, null, 2),
      sections: Object.keys(reportData),
      generatedAt,
      data: reportData,
    };
  }

  // Markdown format - build sections
  const projectName = rootDir.split('/').pop() || 'Codebase';

  // Header
  sections.push({
    id: 'header',
    title: '',
    content: buildHeader(projectName, generatedAt),
  });

  // Executive Summary
  sections.push({
    id: 'executive-summary',
    title: 'Executive Summary',
    content: buildExecutiveSummary(
      healthScore,
      healthGrade,
      analysisData,
      stats
    ),
  });

  if (options.quick) {
    // Quick mode - just header and summary
    const content = sections.map((s) => s.content).join('\n\n');
    return {
      content,
      sections: sections.map((s) => s.id),
      generatedAt,
      data: reportData,
    };
  }

  // Health Overview
  if (options.includeHealth) {
    sections.push({
      id: 'health-overview',
      title: 'Health Overview',
      content: buildHealthOverview(complexityReport, stats, healthScore, healthGrade),
    });
  }

  // Top Risks
  if (options.includeRisks && (analysisData.drift || analysisData.cycles)) {
    sections.push({
      id: 'top-risks',
      title: 'Top Risks',
      content: buildRisksSection(
        analysisData.drift,
        analysisData.cycles,
        analysisData.hotspots
      ),
    });
  }

  // Team Dynamics / Bus Factor
  if (options.includeBusFactor && analysisData.busFactor) {
    sections.push({
      id: 'team-dynamics',
      title: 'Team Dynamics',
      content: buildTeamDynamicsSection(analysisData.busFactor),
    });
  }

  // DORA-like Metrics (Velocity)
  if (options.includeDora && analysisData.velocity) {
    sections.push({
      id: 'development-metrics',
      title: 'Development Metrics',
      content: buildMetricsSection(analysisData.velocity, analysisData.trajectory),
    });
  }

  // Hotspots
  if (options.includeHotspots && analysisData.hotspots) {
    sections.push({
      id: 'hotspots',
      title: 'Hotspots',
      content: buildHotspotsSection(analysisData.hotspots),
    });
  }

  // Trajectory
  if (options.includeTrajectory && analysisData.trajectory) {
    sections.push({
      id: 'trajectory',
      title: 'Health Trajectory',
      content: buildTrajectorySection(analysisData.trajectory),
    });
  }

  // Recommendations
  sections.push({
    id: 'recommendations',
    title: 'Recommendations',
    content: buildRecommendationsSection(analysisData, healthScore),
  });

  // Appendix
  sections.push({
    id: 'appendix',
    title: 'Appendix',
    content: buildAppendixSection(graph, stats, complexityReport),
  });

  // Footer
  sections.push({
    id: 'footer',
    title: '',
    content: buildFooter(),
  });

  const content = sections.map((s) => s.content).join('\n\n');

  return {
    content,
    sections: sections.map((s) => s.id),
    generatedAt,
    data: reportData,
  };
}

/**
 * Get letter grade from score
 */
function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get emoji for score
 */
function getScoreEmoji(score: number): string {
  if (score >= 80) return ':green_circle:';
  if (score >= 60) return ':yellow_circle:';
  return ':red_circle:';
}

/**
 * Build header section
 */
function buildHeader(projectName: string, generatedAt: Date): string {
  const dateStr = generatedAt.toISOString().split('T')[0];
  return `# Codebase Health Report

**Project:** ${projectName}
**Generated by:** Specter
**Date:** ${dateStr}

---`;
}

/**
 * Build executive summary
 */
function buildExecutiveSummary(
  healthScore: number,
  grade: string,
  data: Record<string, unknown>,
  stats: ReturnType<typeof getGraphStats>
): string {
  const trajectory = data.trajectory as TrajectoryResult | undefined;
  const busFactor = data.busFactor as BusFactorResult | undefined;
  const drift = data.drift as DriftResult | undefined;

  const trendEmoji = trajectory?.trend === 'improving' ? ':arrow_upper_right:' :
    trajectory?.trend === 'declining' ? ':arrow_lower_right:' :
    trajectory?.trend === 'critical' ? ':arrow_double_down:' : ':arrow_right:';

  const riskEmoji = busFactor?.riskLevel === 'healthy' ? ':green_circle:' :
    busFactor?.riskLevel === 'concerning' ? ':yellow_circle:' :
    busFactor?.riskLevel === 'dangerous' ? ':orange_circle:' : ':red_circle:';

  const lines: string[] = [
    '## Executive Summary',
    '',
    '| Metric | Value | Status |',
    '|--------|-------|--------|',
    `| **Overall Health** | ${Math.round(healthScore)}/100 (Grade ${grade}) | ${getScoreEmoji(healthScore)} |`,
  ];

  if (drift) {
    lines.push(`| **Architecture Drift** | ${drift.score}/100 | ${getScoreEmoji(drift.score)} |`);
  }

  if (busFactor) {
    lines.push(`| **Bus Factor** | ${busFactor.overallBusFactor.toFixed(1)} | ${riskEmoji} ${busFactor.riskLevel} |`);
  }

  if (trajectory) {
    lines.push(`| **Trajectory** | ${trajectory.trend} | ${trendEmoji} |`);
  }

  lines.push('');
  lines.push(`> **${stats.fileCount}** files | **${stats.totalLines.toLocaleString()}** lines | **${stats.nodeCount}** symbols`);

  return lines.join('\n');
}

/**
 * Build health overview section
 */
function buildHealthOverview(
  report: ReturnType<typeof generateComplexityReport>,
  stats: ReturnType<typeof getGraphStats>,
  healthScore: number,
  grade: string
): string {
  const totalFunctions = report.distribution.low + report.distribution.medium +
    report.distribution.high + report.distribution.veryHigh;

  const lines: string[] = [
    '## Health Overview',
    '',
    '### Health Score',
    '',
    `**${Math.round(healthScore)}/100** (Grade ${grade})`,
    '',
    '```',
    `${'#'.repeat(Math.round(healthScore / 2))}${'_'.repeat(50 - Math.round(healthScore / 2))} ${healthScore}%`,
    '```',
    '',
    '### Complexity Distribution',
    '',
    '| Level | Count | Percentage |',
    '|-------|-------|------------|',
    `| :green_circle: Low (1-5) | ${report.distribution.low} | ${totalFunctions > 0 ? Math.round((report.distribution.low / totalFunctions) * 100) : 0}% |`,
    `| :yellow_circle: Medium (6-10) | ${report.distribution.medium} | ${totalFunctions > 0 ? Math.round((report.distribution.medium / totalFunctions) * 100) : 0}% |`,
    `| :orange_circle: High (11-20) | ${report.distribution.high} | ${totalFunctions > 0 ? Math.round((report.distribution.high / totalFunctions) * 100) : 0}% |`,
    `| :red_circle: Critical (21+) | ${report.distribution.veryHigh} | ${totalFunctions > 0 ? Math.round((report.distribution.veryHigh / totalFunctions) * 100) : 0}% |`,
    '',
    '### Key Metrics',
    '',
    `- **Average Complexity:** ${report.averageComplexity.toFixed(1)}`,
    `- **Max Complexity:** ${report.maxComplexity}`,
    `- **Hotspots:** ${report.hotspots.length}`,
    '',
    '### Languages',
    '',
  ];

  const langs = Object.entries(stats.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  for (const [lang, count] of langs) {
    const pct = Math.round((count / stats.fileCount) * 100);
    lines.push(`- **${lang}:** ${count} files (${pct}%)`);
  }

  return lines.join('\n');
}

/**
 * Build risks section
 */
function buildRisksSection(
  drift?: DriftResult,
  cycles?: CyclesResult,
  hotspots?: HotspotsResult
): string {
  const lines: string[] = [
    '## Top Risks',
    '',
  ];

  if (drift && drift.violations.length > 0) {
    lines.push('### Architecture Drift');
    lines.push('');
    lines.push(`**Score:** ${drift.score}/100`);
    lines.push('');
    lines.push('| Severity | Type | File | Issue |');
    lines.push('|----------|------|------|-------|');

    const topViolations = drift.violations.slice(0, 10);
    for (const v of topViolations) {
      const severityEmoji = v.severity === 'high' ? ':red_circle:' :
        v.severity === 'medium' ? ':yellow_circle:' : ':green_circle:';
      const shortFile = v.file.length > 40 ? '...' + v.file.slice(-37) : v.file;
      lines.push(`| ${severityEmoji} ${v.severity} | ${v.type} | \`${shortFile}\` | ${v.message} |`);
    }

    if (drift.violations.length > 10) {
      lines.push('');
      lines.push(`*...and ${drift.violations.length - 10} more violations*`);
    }
    lines.push('');
  }

  if (cycles && cycles.cycles && cycles.cycles.length > 0) {
    lines.push('### Circular Dependencies');
    lines.push('');
    lines.push(`**${cycles.cycles.length}** circular dependency chains detected.`);
    lines.push('');

    const topCycles = cycles.cycles.slice(0, 5);
    for (const cycle of topCycles) {
      const cycleStr = cycle.files.map(f => `\`${f.split('/').pop()}\``).join(' -> ');
      lines.push(`- ${cycleStr}`);
    }

    if (cycles.cycles.length > 5) {
      lines.push(`- *...and ${cycles.cycles.length - 5} more cycles*`);
    }
    lines.push('');
  }

  if (hotspots && hotspots.quadrants.highComplexityHighChurn.length > 0) {
    lines.push('### Danger Zone Files');
    lines.push('');
    lines.push('*High complexity AND frequently changed - highest refactoring priority.*');
    lines.push('');

    const dangerFiles = hotspots.quadrants.highComplexityHighChurn.slice(0, 5);
    for (const h of dangerFiles) {
      lines.push(`- \`${h.file}\` - Score: ${h.hotspotScore}/100`);
    }
    lines.push('');
  }

  if (lines.length === 3) {
    lines.push(':white_check_mark: No significant risks detected.');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build team dynamics section
 */
function buildTeamDynamicsSection(busFactor: BusFactorResult): string {
  const lines: string[] = [
    '## Team Dynamics',
    '',
    '### Bus Factor Analysis',
    '',
    `**Overall Bus Factor:** ${busFactor.overallBusFactor.toFixed(1)}`,
    '',
    `**Risk Level:** ${busFactor.riskLevel.toUpperCase()}`,
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Files with single owner | ${busFactor.summary.soloOwnedFiles} |`,
    `| Lines at risk | ${busFactor.summary.soloOwnedLines.toLocaleString()} |`,
    `| Percentage at risk | ${busFactor.summary.percentageAtRisk}% |`,
    '',
  ];

  const criticalRisks = busFactor.risks.filter((r) => r.criticality === 'critical');
  if (criticalRisks.length > 0) {
    lines.push('### Critical Knowledge Silos');
    lines.push('');
    lines.push('| Area | Bus Factor | Owner | Lines |');
    lines.push('|------|------------|-------|-------|');

    for (const risk of criticalRisks.slice(0, 5)) {
      lines.push(`| \`${risk.area}\` | ${risk.busFactor} | ${risk.soleOwner || '-'} | ${risk.linesOfCode.toLocaleString()} |`);
    }
    lines.push('');
  }

  if (busFactor.recommendations.length > 0) {
    lines.push('### Recommendations');
    lines.push('');
    for (const rec of busFactor.recommendations) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build metrics section (DORA-like)
 */
function buildMetricsSection(
  velocity?: VelocityResult,
  trajectory?: TrajectoryResult
): string {
  const lines: string[] = [
    '## Development Metrics',
    '',
  ];

  if (velocity) {
    const trendEmoji = velocity.trend === 'improving' ? ':green_circle:' :
      velocity.trend === 'stable' ? ':yellow_circle:' :
      velocity.trend === 'degrading' ? ':orange_circle:' : ':red_circle:';

    lines.push('### Complexity Velocity');
    lines.push('');
    lines.push(`**Trend:** ${trendEmoji} ${velocity.trend.toUpperCase()}`);
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Weekly change | ${velocity.overallVelocity >= 0 ? '+' : ''}${velocity.overallVelocity} complexity/week |`);
    lines.push(`| Total complexity | ${velocity.currentMetrics.totalComplexity} |`);
    lines.push(`| 30-day projection | ${velocity.projectedDebtIn30Days} |`);
    lines.push(`| Snapshot count | ${velocity.snapshotCount} |`);
    lines.push(`| Time span | ${velocity.timeSpanDays} days |`);
    lines.push('');

    if (velocity.fastestGrowing.length > 0) {
      lines.push('#### Fastest Growing (Needs Attention)');
      lines.push('');
      for (const f of velocity.fastestGrowing.slice(0, 3)) {
        const shortPath = f.path.length > 50 ? '...' + f.path.slice(-47) : f.path;
        lines.push(`- \`${shortPath}\` (+${f.velocityPerWeek}/week)`);
      }
      lines.push('');
    }
  }

  if (trajectory && trajectory.snapshotCount >= 2) {
    lines.push('### Health Projections');
    lines.push('');
    lines.push('| Timeframe | Projected Health | Change | Confidence |');
    lines.push('|-----------|-----------------|--------|------------|');

    const proj1W = trajectory.projections.oneWeek;
    const proj1M = trajectory.projections.oneMonth;
    const proj3M = trajectory.projections.threeMonths;

    const delta1W = proj1W.projectedHealth - trajectory.currentHealth;
    const delta1M = proj1M.projectedHealth - trajectory.currentHealth;
    const delta3M = proj3M.projectedHealth - trajectory.currentHealth;

    lines.push(`| 1 week | ${proj1W.projectedHealth}/100 | ${delta1W >= 0 ? '+' : ''}${delta1W} | ${proj1W.confidence}% |`);
    lines.push(`| 1 month | ${proj1M.projectedHealth}/100 | ${delta1M >= 0 ? '+' : ''}${delta1M} | ${proj1M.confidence}% |`);
    lines.push(`| 3 months | ${proj3M.projectedHealth}/100 | ${delta3M >= 0 ? '+' : ''}${delta3M} | ${proj3M.confidence}% |`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build hotspots section
 */
function buildHotspotsSection(hotspots: HotspotsResult): string {
  const lines: string[] = [
    '## Hotspots',
    '',
    `*Analysis period: ${hotspots.timeRange.since.toLocaleDateString()} to ${hotspots.timeRange.until.toLocaleDateString()} (${hotspots.timeRange.weeks} weeks)*`,
    '',
    '### Summary',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Critical hotspots | ${hotspots.summary.criticalCount} |`,
    `| High-risk hotspots | ${hotspots.summary.highCount} |`,
    `| Estimated refactoring debt | ~${hotspots.summary.totalDebtHours} hours |`,
    '',
    '### Quadrant Analysis',
    '',
    '| Quadrant | Files | Description |',
    '|----------|-------|-------------|',
    `| :red_circle: Danger Zone | ${hotspots.quadrants.highComplexityHighChurn.length} | High complexity + High churn |`,
    `| :orange_circle: Legacy Debt | ${hotspots.quadrants.highComplexityLowChurn.length} | High complexity + Low churn |`,
    `| :yellow_circle: Active Dev | ${hotspots.quadrants.lowComplexityHighChurn.length} | Low complexity + High churn |`,
    `| :green_circle: Healthy | ${hotspots.quadrants.lowComplexityLowChurn.length} | Low complexity + Low churn |`,
    '',
  ];

  if (hotspots.hotspots.length > 0) {
    lines.push('### Top 10 Hotspots');
    lines.push('');
    lines.push('| Priority | File | Score | Complexity | Churn |');
    lines.push('|----------|------|-------|------------|-------|');

    for (const h of hotspots.hotspots.slice(0, 10)) {
      const priorityEmoji = h.priority === 'critical' ? ':red_circle:' :
        h.priority === 'high' ? ':orange_circle:' :
        h.priority === 'medium' ? ':yellow_circle:' : ':green_circle:';
      const shortFile = h.file.length > 40 ? '...' + h.file.slice(-37) : h.file;
      lines.push(`| ${priorityEmoji} ${h.priority} | \`${shortFile}\` | ${h.hotspotScore}/100 | ${h.complexity}% | ${h.churn}% |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build trajectory section
 */
function buildTrajectorySection(trajectory: TrajectoryResult): string {
  const lines: string[] = [
    '## Health Trajectory',
    '',
  ];

  if (trajectory.snapshotCount < 2) {
    lines.push('*Insufficient data for trajectory analysis. Run `specter scan` regularly to build history.*');
    return lines.join('\n');
  }

  const trendEmoji = trajectory.trend === 'improving' ? ':arrow_upper_right:' :
    trajectory.trend === 'stable' ? ':arrow_right:' :
    trajectory.trend === 'declining' ? ':arrow_lower_right:' : ':arrow_double_down:';

  lines.push(`**Current Health:** ${trajectory.currentHealth}/100`);
  lines.push('');
  lines.push(`**Trend:** ${trendEmoji} ${trajectory.trend.toUpperCase()}`);
  lines.push('');
  lines.push(`**Rate of Change:** ${trajectory.rateOfChange >= 0 ? '+' : ''}${trajectory.rateOfChange} points/week`);
  lines.push('');

  if (trajectory.healthHistory.length > 1) {
    // Simple ASCII sparkline for markdown
    const sparkChars = ['\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'];
    const min = Math.min(...trajectory.healthHistory);
    const max = Math.max(...trajectory.healthHistory);
    const range = max - min || 1;

    const sparkline = trajectory.healthHistory
      .map((v) => {
        const idx = Math.round(((v - min) / range) * (sparkChars.length - 1));
        return sparkChars[idx];
      })
      .join('');

    lines.push('**History:** ' + sparkline);
    lines.push('');
  }

  if (trajectory.riskFactors.length > 0) {
    lines.push('### Risk Factors');
    lines.push('');
    for (const risk of trajectory.riskFactors) {
      lines.push(`- :warning: ${risk}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build recommendations section
 */
function buildRecommendationsSection(
  data: Record<string, unknown>,
  healthScore: number
): string {
  const lines: string[] = [
    '## Recommendations',
    '',
    '### Prioritized Action Items',
    '',
  ];

  const recommendations: { priority: number; text: string }[] = [];

  // Health-based recommendations
  if (healthScore < 50) {
    recommendations.push({
      priority: 1,
      text: ':red_circle: **CRITICAL:** Health score below 50 - schedule immediate refactoring sprint',
    });
  } else if (healthScore < 70) {
    recommendations.push({
      priority: 2,
      text: ':yellow_circle: **HIGH:** Allocate 20% of sprint time to technical debt reduction',
    });
  }

  // Drift recommendations
  const drift = data.drift as DriftResult | undefined;
  if (drift && drift.score < 60) {
    recommendations.push({
      priority: 2,
      text: ':orange_circle: **HIGH:** Address architectural drift - review layer boundaries',
    });
  }

  // Bus factor recommendations
  const busFactor = data.busFactor as BusFactorResult | undefined;
  if (busFactor) {
    if (busFactor.riskLevel === 'critical' || busFactor.riskLevel === 'dangerous') {
      recommendations.push({
        priority: 1,
        text: ':red_circle: **CRITICAL:** Knowledge silos detected - implement mandatory pair programming',
      });
    }
    const criticalAreas = busFactor.risks.filter((r) => r.criticality === 'critical');
    if (criticalAreas.length > 0) {
      const topArea = criticalAreas[0];
      if (topArea.soleOwner) {
        recommendations.push({
          priority: 2,
          text: `:yellow_circle: **HIGH:** Schedule knowledge transfer with ${topArea.soleOwner} for \`${topArea.area}\``,
        });
      }
    }
  }

  // Hotspot recommendations
  const hotspots = data.hotspots as HotspotsResult | undefined;
  if (hotspots && hotspots.summary.criticalCount > 0) {
    recommendations.push({
      priority: 2,
      text: `:orange_circle: **HIGH:** ${hotspots.summary.criticalCount} critical hotspot(s) need refactoring attention`,
    });
  }

  // Velocity recommendations
  const velocity = data.velocity as VelocityResult | undefined;
  if (velocity && velocity.trend === 'critical') {
    recommendations.push({
      priority: 1,
      text: ':red_circle: **CRITICAL:** Complexity growing rapidly - pause feature work for cleanup',
    });
  } else if (velocity && velocity.trend === 'degrading') {
    recommendations.push({
      priority: 3,
      text: ':yellow_circle: **MEDIUM:** Complexity trending upward - consider complexity gates in CI',
    });
  }

  // Trajectory recommendations
  const trajectory = data.trajectory as TrajectoryResult | undefined;
  if (trajectory) {
    if (trajectory.trend === 'improving') {
      recommendations.push({
        priority: 4,
        text: ':green_circle: **LOW:** Health improving - document and share successful practices',
      });
    }
    if (trajectory.snapshotCount < 3) {
      recommendations.push({
        priority: 4,
        text: ':blue_circle: **INFO:** Run `specter scan` regularly to improve trajectory accuracy',
      });
    }
  }

  // Cycles recommendations
  const cycles = data.cycles as CyclesResult | undefined;
  if (cycles && cycles.cycles && cycles.cycles.length > 3) {
    recommendations.push({
      priority: 2,
      text: `:orange_circle: **HIGH:** ${cycles.cycles.length} circular dependencies detected - break dependency cycles`,
    });
  }

  // Sort by priority and add to lines
  recommendations.sort((a, b) => a.priority - b.priority);

  if (recommendations.length === 0) {
    lines.push(':white_check_mark: No immediate action items. Keep up the great work!');
  } else {
    let currentPriority = 0;
    for (const rec of recommendations) {
      if (rec.priority !== currentPriority) {
        currentPriority = rec.priority;
      }
      lines.push(`${recommendations.indexOf(rec) + 1}. ${rec.text}`);
    }
  }

  lines.push('');

  // Quick wins
  lines.push('### Quick Wins');
  lines.push('');
  lines.push('- Run `specter hotspots` to see complexity x churn analysis');
  lines.push('- Run `specter bus-factor` for detailed knowledge risk breakdown');
  lines.push('- Run `specter drift` to see architectural violations');
  lines.push('- Run `specter trajectory` for health projections');
  lines.push('');

  return lines.join('\n');
}

/**
 * Build appendix section
 */
function buildAppendixSection(
  graph: KnowledgeGraph,
  stats: ReturnType<typeof getGraphStats>,
  report: ReturnType<typeof generateComplexityReport>
): string {
  const lines: string[] = [
    '## Appendix',
    '',
    '### Codebase Statistics',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Files | ${stats.fileCount} |`,
    `| Total Lines | ${stats.totalLines.toLocaleString()} |`,
    `| Symbols (nodes) | ${stats.nodeCount} |`,
    `| Relationships (edges) | ${stats.edgeCount} |`,
    `| Average Complexity | ${report.averageComplexity.toFixed(2)} |`,
    `| Max Complexity | ${report.maxComplexity} |`,
    `| Scan Duration | ${graph.metadata.scanDurationMs}ms |`,
    '',
  ];

  // Language breakdown
  lines.push('### Language Breakdown');
  lines.push('');
  lines.push('| Language | Files | Percentage |');
  lines.push('|----------|-------|------------|');

  const langs = Object.entries(stats.languages).sort((a, b) => b[1] - a[1]);
  for (const [lang, count] of langs) {
    const pct = Math.round((count / stats.fileCount) * 100);
    lines.push(`| ${lang} | ${count} | ${pct}% |`);
  }
  lines.push('');

  // Top complex files
  if (report.hotspots.length > 0) {
    lines.push('### Complexity Hotspots (Top 15)');
    lines.push('');
    lines.push('| File | Function | Complexity |');
    lines.push('|------|----------|------------|');

    for (const h of report.hotspots.slice(0, 15)) {
      const emoji = getComplexityEmoji(h.complexity);
      const shortPath = h.filePath.length > 35 ? '...' + h.filePath.slice(-32) : h.filePath;
      lines.push(`| \`${shortPath}\` | ${h.name} | ${emoji} ${h.complexity} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Build footer
 */
function buildFooter(): string {
  return `---

*Report generated by [Specter](https://github.com/specter) - Give your codebase a voice.*`;
}

/**
 * Format report summary for CLI output
 */
export function formatReportSummary(result: ReportResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('+-------------------------------------------------------+');
  lines.push('|  SPECTER REPORT GENERATED                              |');
  lines.push('+-------------------------------------------------------+');
  lines.push('');
  lines.push(`  Generated at: ${result.generatedAt.toISOString()}`);
  lines.push(`  Sections: ${result.sections.join(', ')}`);
  lines.push(`  Content length: ${result.content.length.toLocaleString()} characters`);
  lines.push('');

  if (result.data) {
    lines.push('  KEY METRICS:');
    lines.push(`    Health Score: ${result.data.health.score}/100 (Grade ${result.data.health.grade})`);
    lines.push(`    Bus Factor: ${result.data.busFactor.overall.toFixed(1)} (${result.data.busFactor.riskLevel})`);
    lines.push(`    Trajectory: ${result.data.trajectory.trend}`);
    lines.push(`    Critical Hotspots: ${result.data.hotspots.criticalCount}`);
    lines.push('');
  }

  if (result.outputPath) {
    lines.push(`  Saved to: ${result.outputPath}`);
    lines.push('');
  }

  return lines.join('\n');
}
