import { Octokit } from '@octokit/rest';
import type { KnowledgeGraph } from './graph/types.js';
import { applyPersonality, type PersonalityMode } from './personality/index.js';

interface FileAnalysis {
  filename: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  additions: number;
  deletions: number;
  suggestions: string[];
}

interface ReviewOptions {
  token: string;
  owner: string;
  repo: string;
  pullNumber: number;
  mode?: PersonalityMode;
  postInlineComments?: boolean;
}

interface ReviewResult {
  reviewId: number;
  commentsPosted: number;
  riskLevel: string;
}

export async function reviewPullRequest(
  _rootDir: string,
  _graph: KnowledgeGraph,
  options: ReviewOptions
): Promise<ReviewResult> {
  const { owner, repo, pullNumber, token, mode = 'default', postInlineComments = false } = options;

  const octokit = new Octokit({ auth: token });

  console.log(`\n🔍 Reviewing PR #${pullNumber} in ${owner}/${repo}...\n`);

  // Get PR files
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
  });

  console.log(`📝 Analyzing ${files.length} changed files...\n`);

  // Analyze each file
  const analyses: FileAnalysis[] = [];

  for (const file of files) {
    const risk = calculateFileRisk(file, analyses);

    const suggestions: string[] = [];

    // Check for large changes
    if (file.additions + file.deletions > 500) {
      suggestions.push('Consider breaking this into smaller PRs');
    }

    // Check for critical paths
    if (file.filename.includes('auth') || file.filename.includes('payment')) {
      suggestions.push('Extra security review recommended for critical path');
    }

    // Check for missing tests
    if (!file.filename.includes('test') && !file.filename.includes('spec')) {
      const hasTest = files.some(
        (f) =>
          f.filename.includes(file.filename.replace('.ts', '.test.ts')) ||
          f.filename.includes(file.filename.replace('.ts', '.spec.ts'))
      );
      if (!hasTest && file.additions > 50) {
        suggestions.push('Consider adding tests for this change');
      }
    }

    analyses.push({
      filename: file.filename,
      risk,
      additions: file.additions,
      deletions: file.deletions,
      suggestions,
    });
  }

  // Generate review body
  const reviewBody = generateReviewBody(analyses, mode);

  // Post review
  const { data: review } = await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    body: reviewBody,
    event: 'COMMENT',
  });

  console.log('✅ Review posted successfully!\n');

  let commentsPosted = 0;

  // Post inline comments for high-risk files
  if (postInlineComments) {
    const highRiskFiles = analyses.filter((a) => a.risk === 'high' || a.risk === 'critical');

    if (highRiskFiles.length > 0) {
      console.log(`💬 Posting inline comments for ${highRiskFiles.length} high-risk files...\n`);

      for (const fileAnalysis of highRiskFiles) {
        const posted = await postInlineCommentsForFile(
          octokit,
          owner,
          repo,
          pullNumber,
          fileAnalysis,
          mode
        );
        if (posted) commentsPosted++;
      }
    }
  }

  const overallRisk = calculateOverallRisk(analyses);

  return {
    reviewId: review.id,
    commentsPosted,
    riskLevel: overallRisk,
  };
}

function calculateFileRisk(
  file: { filename: string; additions: number; deletions: number },
  _analyses: FileAnalysis[]
): 'low' | 'medium' | 'high' | 'critical' {
  let riskScore = 0;

  // Check critical paths
  if (
    file.filename.includes('auth') ||
    file.filename.includes('payment') ||
    file.filename.includes('security')
  ) {
    riskScore += 3;
  }

  // Check config files
  if (
    file.filename.includes('package.json') ||
    file.filename.includes('tsconfig.json') ||
    file.filename.includes('.env')
  ) {
    riskScore += 2;
  }

  // Check size
  if (file.additions + file.deletions > 500) {
    riskScore += 3;
  } else if (file.additions + file.deletions > 200) {
    riskScore += 2;
  } else if (file.additions + file.deletions > 50) {
    riskScore += 1;
  }

  // Check if it's a test file (lower risk)
  if (file.filename.includes('test') || file.filename.includes('spec')) {
    riskScore = Math.max(0, riskScore - 1);
  }

  if (riskScore >= 6) return 'critical';
  if (riskScore >= 4) return 'high';
  if (riskScore >= 2) return 'medium';
  return 'low';
}

function generateReviewBody(analyses: FileAnalysis[], personality: PersonalityMode): string {
  const totalAdditions = analyses.reduce((sum, a) => sum + a.additions, 0);
  const totalDeletions = analyses.reduce((sum, a) => sum + a.deletions, 0);

  const riskCounts = {
    critical: analyses.filter((a) => a.risk === 'critical').length,
    high: analyses.filter((a) => a.risk === 'high').length,
    medium: analyses.filter((a) => a.risk === 'medium').length,
    low: analyses.filter((a) => a.risk === 'low').length,
  };

  const overallRisk = calculateOverallRisk(analyses);

  let body = `## 🔮 Specter PR Review\n\n`;

  // Add personality-based opening
  if (personality === 'roast') {
    const opening = applyPersonality("Buckle up buttercup, I've got opinions...", personality);
    body += `${opening}\n\n`;
  } else if (personality === 'noir') {
    const opening = applyPersonality(
      'In this city of code, every PR tells a story...',
      personality
    );
    body += `${opening}\n\n`;
  } else if (personality === 'dramatic') {
    const opening = applyPersonality(
      'Behold! A pull request emerges from the depths!',
      personality
    );
    body += `${opening}\n\n`;
  }

  body += `### 📊 Change Summary\n\n`;
  body += `- **Files Changed**: ${analyses.length}\n`;
  body += `- **Lines Added**: +${totalAdditions}\n`;
  body += `- **Lines Removed**: -${totalDeletions}\n`;
  body += `- **Overall Risk**: ${getRiskEmoji(overallRisk)} **${overallRisk.toUpperCase()}**\n\n`;

  body += `### 🎯 Risk Breakdown\n\n`;
  if (riskCounts.critical > 0) {
    body += `- 🔴 **Critical Risk**: ${riskCounts.critical} file(s)\n`;
  }
  if (riskCounts.high > 0) {
    body += `- 🟠 **High Risk**: ${riskCounts.high} file(s)\n`;
  }
  if (riskCounts.medium > 0) {
    body += `- 🟡 **Medium Risk**: ${riskCounts.medium} file(s)\n`;
  }
  if (riskCounts.low > 0) {
    body += `- 🟢 **Low Risk**: ${riskCounts.low} file(s)\n`;
  }

  // High-risk files section
  const highRiskFiles = analyses.filter((a) => a.risk === 'critical' || a.risk === 'high');

  if (highRiskFiles.length > 0) {
    body += `\n### ⚠️ Files Requiring Extra Attention\n\n`;

    for (const file of highRiskFiles) {
      body += `#### ${getRiskEmoji(file.risk)} \`${file.filename}\`\n\n`;
      body += `- Risk Level: **${file.risk.toUpperCase()}**\n`;
      body += `- Changes: +${file.additions}/-${file.deletions}\n`;

      if (file.suggestions.length > 0) {
        body += `- Suggestions:\n`;
        for (const suggestion of file.suggestions) {
          body += `  - ${suggestion}\n`;
        }
      }
      body += `\n`;
    }
  }

  // All suggestions section
  const allSuggestions = analyses.flatMap((a) => a.suggestions);
  if (allSuggestions.length > 0) {
    body += `\n### 💡 Suggestions\n\n`;
    const uniqueSuggestions = [...new Set(allSuggestions)];
    for (const suggestion of uniqueSuggestions) {
      body += `- ${suggestion}\n`;
    }
  }

  // Add personality-based closing
  body += `\n---\n\n`;
  if (personality === 'roast') {
    body += applyPersonality(`Not bad for a human. I've seen worse.`, personality);
  } else if (personality === 'noir') {
    body += applyPersonality(`The case of this PR... remains open for now.`, personality);
  } else if (personality === 'dramatic') {
    body += applyPersonality(`Thus concludes our epic review!`, personality);
  } else {
    body += `*Generated with ❤️ by Specter*`;
  }

  return body;
}

function calculateOverallRisk(analyses: FileAnalysis[]): 'low' | 'medium' | 'high' | 'critical' {
  const risks = analyses.map((a) => a.risk);

  if (risks.some((r) => r === 'critical')) return 'critical';
  if (risks.filter((r) => r === 'high').length >= 2) return 'high';
  if (risks.some((r) => r === 'high')) return 'high';
  if (risks.filter((r) => r === 'medium').length >= 3) return 'medium';
  if (risks.some((r) => r === 'medium')) return 'medium';
  return 'low';
}

function getRiskEmoji(risk: string): string {
  switch (risk) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

async function postInlineCommentsForFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  fileAnalysis: FileAnalysis,
  personality: PersonalityMode
): Promise<boolean> {
  let commentBody = `### ${getRiskEmoji(fileAnalysis.risk)} High Risk File\n\n`;
  commentBody += `This file has been flagged as **${fileAnalysis.risk.toUpperCase()}** risk:\n\n`;
  commentBody += `- Changes: +${fileAnalysis.additions}/-${fileAnalysis.deletions}\n`;

  if (fileAnalysis.suggestions.length > 0) {
    commentBody += `\n**Recommendations:**\n`;
    for (const suggestion of fileAnalysis.suggestions) {
      commentBody += `- ${suggestion}\n`;
    }
  }

  // Add personality flavor
  if (personality === 'roast') {
    commentBody +=
      `\n` +
      applyPersonality(`This file is giving me anxiety. Please be gentle with it.`, personality);
  } else if (personality === 'noir') {
    commentBody +=
      `\n` +
      applyPersonality(`Something about this file doesn't sit right. Trust your gut.`, personality);
  }

  try {
    await octokit.pulls.createReviewComment({
      owner,
      repo,
      pull_number: prNumber,
      body: commentBody,
      commit_id: (await octokit.pulls.get({ owner, repo, pull_number: prNumber })).data.head.sha,
      path: fileAnalysis.filename,
      position: 1, // First line of the diff
    });

    console.log(`  ✓ Comment posted for ${fileAnalysis.filename}`);
    return true;
  } catch (error) {
    console.error(`  ✗ Failed to post comment for ${fileAnalysis.filename}:`, error);
    return false;
  }
}
