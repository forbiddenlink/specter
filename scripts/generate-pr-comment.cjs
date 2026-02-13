#!/usr/bin/env node

/**
 * Generate PR Comment - Creates a markdown comment for GitHub PRs
 *
 * Combines Specter analysis results into a nicely formatted PR comment
 * that includes health scores, risk analysis, and recommendations.
 */

const fs = require('node:fs');
const _path = require('node:path');

// Parse command line arguments
function parseArgs() {
  const args = {
    healthScore: 0,
    riskLevel: 'low',
    reviewMinutes: 5,
    precommitFile: null,
    predictFile: null,
    reportFile: null,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const next = process.argv[i + 1];

    switch (arg) {
      case '--health-score':
        args.healthScore = parseInt(next, 10) || 0;
        i++;
        break;
      case '--risk-level':
        args.riskLevel = next || 'low';
        i++;
        break;
      case '--review-minutes':
        args.reviewMinutes = parseInt(next, 10) || 5;
        i++;
        break;
      case '--precommit-file':
        args.precommitFile = next;
        i++;
        break;
      case '--predict-file':
        args.predictFile = next;
        i++;
        break;
      case '--report-file':
        args.reportFile = next;
        i++;
        break;
    }
  }

  return args;
}

// Read file safely
function readFileSafe(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (_e) {
    // Ignore errors
  }
  return '';
}

// Parse JSON safely
function parseJsonSafe(content) {
  try {
    return JSON.parse(content);
  } catch (_e) {
    return {};
  }
}

// Get health emoji based on score
function getHealthEmoji(score) {
  if (score >= 80) return ':green_circle:';
  if (score >= 60) return ':yellow_circle:';
  if (score >= 40) return ':orange_circle:';
  return ':red_circle:';
}

// Get risk emoji
function getRiskEmoji(level) {
  switch (level.toLowerCase()) {
    case 'low':
      return ':green_circle:';
    case 'medium':
      return ':yellow_circle:';
    case 'high':
      return ':orange_circle:';
    case 'critical':
      return ':red_circle:';
    default:
      return ':white_circle:';
  }
}

// Parse precommit output for file risks
function parsePrecommitOutput(content) {
  const files = [];

  if (!content) return files;

  const lines = content.split('\n');
  let currentRisk = null;

  for (const line of lines) {
    if (line.includes('HIGH RISK')) {
      currentRisk = 'high';
    } else if (line.includes('MEDIUM RISK')) {
      currentRisk = 'medium';
    } else if (line.includes('LOW RISK')) {
      currentRisk = 'low';
    } else if ((currentRisk && line.trim().startsWith('src/')) || line.trim().match(/^\S+\.\w+$/)) {
      const filePath = line.trim();
      if (filePath && !filePath.startsWith('─') && !filePath.startsWith('━')) {
        // Check for reasons on next line
        files.push({
          path: filePath,
          risk: currentRisk,
        });
      }
    }
  }

  return files;
}

// Parse predict output for recommendations
function parsePredictOutput(content) {
  const recommendations = [];
  const warnings = [];

  if (!content) return { recommendations, warnings };

  const lines = content.split('\n');
  let inRecommendations = false;
  let inWarnings = false;

  for (const line of lines) {
    if (line.includes('RECOMMENDATIONS')) {
      inRecommendations = true;
      inWarnings = false;
      continue;
    }
    if (line.includes('WARNINGS')) {
      inWarnings = true;
      inRecommendations = false;
      continue;
    }
    if (line.startsWith('━') || line.startsWith('┏')) {
      inRecommendations = false;
      inWarnings = false;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
      const text = trimmed.replace(/^[•-]\s*/, '');
      if (text && inRecommendations) {
        recommendations.push(text);
      } else if (text && inWarnings) {
        warnings.push(text);
      }
    }
  }

  return { recommendations, warnings };
}

// Get changed files count from predict output
function getChangedFilesCount(content) {
  if (!content) return 0;

  const match = content.match(/Files changed:\s*(\d+)/i);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Count file entries
  const fileMatches = content.match(/(?:✏️|🆕|🗑️|📝)\s+\S+/g);
  return fileMatches ? fileMatches.length : 0;
}

// Generate the markdown comment
function generateComment(args) {
  const precommitContent = readFileSafe(args.precommitFile);
  const predictContent = readFileSafe(args.predictFile);
  const reportContent = readFileSafe(args.reportFile);
  const report = parseJsonSafe(reportContent);

  const fileRisks = parsePrecommitOutput(precommitContent);
  const { recommendations, warnings } = parsePredictOutput(predictContent);
  const changedFiles = getChangedFilesCount(predictContent);

  const healthEmoji = getHealthEmoji(args.healthScore);
  const riskEmoji = getRiskEmoji(args.riskLevel);

  const lines = [];

  // Hidden marker for finding existing comment
  lines.push('<!-- specter-analysis -->');
  lines.push('');

  // Header
  lines.push('## :ghost: Specter Analysis');
  lines.push('');

  // Summary table
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Health Score | ${args.healthScore}/100 ${healthEmoji} |`);
  lines.push(
    `| PR Risk | ${args.riskLevel.charAt(0).toUpperCase() + args.riskLevel.slice(1)} ${riskEmoji} |`
  );
  lines.push(`| Files Changed | ${changedFiles || fileRisks.length || '-'} |`);
  lines.push(`| Est. Review Time | ~${args.reviewMinutes} min |`);
  lines.push('');

  // Risk summary
  const highRiskFiles = fileRisks.filter((f) => f.risk === 'high');
  const mediumRiskFiles = fileRisks.filter((f) => f.risk === 'medium');

  if (highRiskFiles.length > 0 || mediumRiskFiles.length > 0) {
    lines.push('### Risk Summary');
    lines.push('');

    for (const file of highRiskFiles.slice(0, 5)) {
      lines.push(`- :red_circle: \`${file.path}\` - High risk`);
    }
    for (const file of mediumRiskFiles.slice(0, 5)) {
      lines.push(`- :yellow_circle: \`${file.path}\` - Medium risk`);
    }

    if (highRiskFiles.length > 5 || mediumRiskFiles.length > 5) {
      const remaining =
        Math.max(0, highRiskFiles.length - 5) + Math.max(0, mediumRiskFiles.length - 5);
      lines.push(`- *...and ${remaining} more files*`);
    }
    lines.push('');
  }

  // Warnings
  if (warnings.length > 0) {
    lines.push('### :warning: Warnings');
    lines.push('');
    for (const warning of warnings.slice(0, 5)) {
      lines.push(`- ${warning}`);
    }
    lines.push('');
  }

  // Recommendations
  if (recommendations.length > 0) {
    lines.push('### :bulb: Recommendations');
    lines.push('');
    for (const rec of recommendations.slice(0, 5)) {
      lines.push(`- ${rec}`);
    }
    lines.push('');
  }

  // Additional report data if available
  if (report.busFactor && report.busFactor.criticalAreas > 0) {
    lines.push('### :busts_in_silhouette: Team Impact');
    lines.push('');
    lines.push(`- Bus Factor: ${report.busFactor.overall?.toFixed(1) || '-'}`);
    lines.push(`- Knowledge silos affected: ${report.busFactor.criticalAreas}`);
    lines.push('');
  }

  // Complexity trend if available
  if (report.trajectory && report.trajectory.trend !== 'unknown') {
    const trendEmoji =
      report.trajectory.trend === 'improving'
        ? ':arrow_upper_right:'
        : report.trajectory.trend === 'declining'
          ? ':arrow_lower_right:'
          : ':arrow_right:';
    lines.push('### :chart_with_upwards_trend: Health Trend');
    lines.push('');
    lines.push(`- Trend: ${report.trajectory.trend} ${trendEmoji}`);
    if (report.trajectory.projectedOneMonth) {
      lines.push(`- 1-month projection: ${report.trajectory.projectedOneMonth}/100`);
    }
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(
    '*Generated by [Specter](https://github.com/forbiddenlink/specter) - Give your codebase a voice*'
  );

  return lines.join('\n');
}

// Main
function main() {
  const args = parseArgs();
  const comment = generateComment(args);
  console.log(comment);
}

main();
