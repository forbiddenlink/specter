/**
 * Famous Repos - Pre-computed health profiles of famous open-source projects
 *
 * Provides comparison data so users can see how their codebase stacks up
 * against well-known open-source projects.
 */

import chalk from 'chalk';
import gradient from 'gradient-string';

export interface FamousRepoProfile {
  name: string;
  url: string;
  description: string;
  fileCount: number;
  totalLines: number;
  avgComplexity: number;
  healthScore: number; // 0-100
  languagePrimary: string;
  stars: string; // e.g. "220k"
  lastUpdated: string; // e.g. "2025"
}

/**
 * Pre-computed health profiles of famous open-source projects.
 * Values are realistic approximations based on public repository data.
 */
export const FAMOUS_REPOS: Record<string, FamousRepoProfile> = {
  react: {
    name: 'React',
    url: 'https://github.com/facebook/react',
    description: 'A JavaScript library for building user interfaces',
    fileCount: 2850,
    totalLines: 485000,
    avgComplexity: 6.2,
    healthScore: 69,
    languagePrimary: 'JavaScript',
    stars: '230k',
    lastUpdated: '2025',
  },
  vue: {
    name: 'Vue.js',
    url: 'https://github.com/vuejs/core',
    description: 'The progressive JavaScript framework',
    fileCount: 620,
    totalLines: 142000,
    avgComplexity: 5.1,
    healthScore: 75,
    languagePrimary: 'TypeScript',
    stars: '48k',
    lastUpdated: '2025',
  },
  angular: {
    name: 'Angular',
    url: 'https://github.com/angular/angular',
    description: 'One framework for mobile and desktop web apps',
    fileCount: 5200,
    totalLines: 890000,
    avgComplexity: 7.8,
    healthScore: 61,
    languagePrimary: 'TypeScript',
    stars: '97k',
    lastUpdated: '2025',
  },
  svelte: {
    name: 'Svelte',
    url: 'https://github.com/sveltejs/svelte',
    description: 'Cybernetically enhanced web apps',
    fileCount: 480,
    totalLines: 98000,
    avgComplexity: 4.3,
    healthScore: 79,
    languagePrimary: 'TypeScript',
    stars: '81k',
    lastUpdated: '2025',
  },
  express: {
    name: 'Express',
    url: 'https://github.com/expressjs/express',
    description: 'Fast, unopinionated web framework for Node.js',
    fileCount: 186,
    totalLines: 18500,
    avgComplexity: 3.8,
    healthScore: 81,
    languagePrimary: 'JavaScript',
    stars: '66k',
    lastUpdated: '2025',
  },
  fastify: {
    name: 'Fastify',
    url: 'https://github.com/fastify/fastify',
    description: 'Fast and low overhead web framework for Node.js',
    fileCount: 340,
    totalLines: 52000,
    avgComplexity: 4.6,
    healthScore: 77,
    languagePrimary: 'JavaScript',
    stars: '33k',
    lastUpdated: '2025',
  },
  nestjs: {
    name: 'Nest.js',
    url: 'https://github.com/nestjs/nest',
    description: 'A progressive Node.js framework for enterprise apps',
    fileCount: 1250,
    totalLines: 165000,
    avgComplexity: 5.5,
    healthScore: 73,
    languagePrimary: 'TypeScript',
    stars: '69k',
    lastUpdated: '2025',
  },
  nextjs: {
    name: 'Next.js',
    url: 'https://github.com/vercel/next.js',
    description: 'The React framework for production',
    fileCount: 4800,
    totalLines: 720000,
    avgComplexity: 7.2,
    healthScore: 64,
    languagePrimary: 'TypeScript',
    stars: '130k',
    lastUpdated: '2025',
  },
  vite: {
    name: 'Vite',
    url: 'https://github.com/vitejs/vite',
    description: 'Next generation frontend tooling',
    fileCount: 520,
    totalLines: 85000,
    avgComplexity: 4.9,
    healthScore: 76,
    languagePrimary: 'TypeScript',
    stars: '71k',
    lastUpdated: '2025',
  },
  lodash: {
    name: 'Lodash',
    url: 'https://github.com/lodash/lodash',
    description: 'A modern JavaScript utility library',
    fileCount: 640,
    totalLines: 56000,
    avgComplexity: 3.2,
    healthScore: 84,
    languagePrimary: 'JavaScript',
    stars: '60k',
    lastUpdated: '2025',
  },
  axios: {
    name: 'Axios',
    url: 'https://github.com/axios/axios',
    description: 'Promise-based HTTP client for the browser and Node.js',
    fileCount: 120,
    totalLines: 14000,
    avgComplexity: 4.1,
    healthScore: 80,
    languagePrimary: 'JavaScript',
    stars: '106k',
    lastUpdated: '2025',
  },
  typescript: {
    name: 'TypeScript Compiler',
    url: 'https://github.com/microsoft/TypeScript',
    description: 'TypeScript is a superset of JavaScript that compiles to clean JS',
    fileCount: 3200,
    totalLines: 1450000,
    avgComplexity: 12.4,
    healthScore: 38,
    languagePrimary: 'TypeScript',
    stars: '102k',
    lastUpdated: '2025',
  },
  webpack: {
    name: 'Webpack',
    url: 'https://github.com/webpack/webpack',
    description: 'A bundler for JavaScript and friends',
    fileCount: 1100,
    totalLines: 245000,
    avgComplexity: 8.5,
    healthScore: 58,
    languagePrimary: 'JavaScript',
    stars: '65k',
    lastUpdated: '2025',
  },
  esbuild: {
    name: 'esbuild',
    url: 'https://github.com/evanw/esbuild',
    description: 'An extremely fast bundler for the web',
    fileCount: 210,
    totalLines: 95000,
    avgComplexity: 5.8,
    healthScore: 71,
    languagePrimary: 'Go',
    stars: '39k',
    lastUpdated: '2025',
  },
};

/**
 * Find the most similar famous repo based on health score, average complexity,
 * and file count. Uses normalized Euclidean distance.
 */
export function findClosestMatch(
  healthScore: number,
  avgComplexity: number,
  fileCount: number
): FamousRepoProfile {
  const repos = Object.values(FAMOUS_REPOS);

  // Normalization ranges (derived from min/max of famous repos data)
  const healthMin = 38;
  const healthMax = 84;
  const complexityMin = 3.2;
  const complexityMax = 12.4;
  const fileMin = 120;
  const fileMax = 5200;

  function normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return (value - min) / (max - min);
  }

  const userHealth = normalize(healthScore, healthMin, healthMax);
  const userComplexity = normalize(avgComplexity, complexityMin, complexityMax);
  const userFiles = normalize(fileCount, fileMin, fileMax);

  // Weights: health score matters most, then complexity, then file count
  const wHealth = 0.5;
  const wComplexity = 0.3;
  const wFiles = 0.2;

  let bestMatch: FamousRepoProfile | undefined = repos[0];
  let bestDistance = Infinity;

  for (const repo of repos) {
    const repoHealth = normalize(repo.healthScore, healthMin, healthMax);
    const repoComplexity = normalize(repo.avgComplexity, complexityMin, complexityMax);
    const repoFiles = normalize(repo.fileCount, fileMin, fileMax);

    const distance = Math.sqrt(
      wHealth * (userHealth - repoHealth) ** 2 +
        wComplexity * (userComplexity - repoComplexity) ** 2 +
        wFiles * (userFiles - repoFiles) ** 2
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = repo;
    }
  }

  if (!bestMatch) {
    throw new Error('No matching repo found');
  }
  return bestMatch;
}

interface UserStats {
  fileCount: number;
  totalLines: number;
  avgComplexity: number;
  healthScore: number;
  projectName: string;
}

/**
 * Generate a fun, colorful comparison between a user's codebase and
 * the matched famous repo, including a leaderboard.
 */
export function formatFamousComparison(
  userStats: UserStats,
  matchedRepo: FamousRepoProfile,
  allRepos: Record<string, FamousRepoProfile>
): string {
  const specterGradient = gradient(['#9b59b6', '#6c5ce7', '#a29bfe']);
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(specterGradient('  ================================================================'));
  lines.push(specterGradient('       FAME CHECK - How Does Your Codebase Stack Up?'));
  lines.push(specterGradient('  ================================================================'));
  lines.push('');

  // Match announcement
  lines.push(
    chalk.bold.white('  Your closest match: ') +
      chalk.bold.cyan(matchedRepo.name) +
      chalk.dim(` (${matchedRepo.stars} stars)`)
  );
  lines.push(chalk.dim(`  ${matchedRepo.url}`));
  lines.push('');

  // Side-by-side comparison
  lines.push(specterGradient('  ---- Comparison ------------------------------------------------'));
  lines.push('');

  const labelWidth = 22;
  const colWidth = 20;

  const header =
    chalk.dim(`  ${'Metric'.padEnd(labelWidth)}`) +
    chalk.bold.yellow(userStats.projectName.padEnd(colWidth)) +
    chalk.bold.cyan(matchedRepo.name.padEnd(colWidth));
  lines.push(header);
  lines.push(chalk.dim(`  ${'-'.repeat(labelWidth + colWidth * 2)}`));

  // Comparison rows
  const rows: Array<{ label: string; userVal: string; repoVal: string }> = [
    {
      label: 'Files',
      userVal: userStats.fileCount.toLocaleString(),
      repoVal: matchedRepo.fileCount.toLocaleString(),
    },
    {
      label: 'Total Lines',
      userVal: userStats.totalLines.toLocaleString(),
      repoVal: matchedRepo.totalLines.toLocaleString(),
    },
    {
      label: 'Avg Complexity',
      userVal: userStats.avgComplexity.toFixed(2),
      repoVal: matchedRepo.avgComplexity.toFixed(2),
    },
    {
      label: 'Health Score',
      userVal: `${userStats.healthScore}/100`,
      repoVal: `${matchedRepo.healthScore}/100`,
    },
  ];

  for (const row of rows) {
    lines.push(
      chalk.dim(`  ${row.label.padEnd(labelWidth)}`) +
        chalk.white(row.userVal.padEnd(colWidth)) +
        chalk.white(row.repoVal.padEnd(colWidth))
    );
  }

  lines.push('');

  // Witty comparison line
  const wittyLine = generateWittyComparison(userStats, matchedRepo);
  lines.push(chalk.italic.magenta(`  "${wittyLine}"`));
  lines.push('');

  // Leaderboard
  lines.push(
    specterGradient('  ---- Leaderboard (by Health Score) ------------------------------')
  );
  lines.push('');

  // Sort all repos + user by health score
  const leaderboard: Array<{ name: string; healthScore: number; isUser: boolean }> = Object.values(
    allRepos
  ).map((r) => ({
    name: r.name,
    healthScore: r.healthScore,
    isUser: false,
  }));

  leaderboard.push({
    name: userStats.projectName,
    healthScore: userStats.healthScore,
    isUser: true,
  });

  leaderboard.sort((a, b) => b.healthScore - a.healthScore);

  for (let i = 0; i < leaderboard.length; i++) {
    const entry = leaderboard[i];
    if (!entry) continue;
    const rank = `  ${String(i + 1).padStart(2)}.`;
    const name = entry.name.padEnd(24);
    const score = `${entry.healthScore}/100`;

    if (entry.isUser) {
      lines.push(chalk.bold.yellow(`${rank} ${name} ${score}  <-- YOU ARE HERE`));
    } else {
      const scoreColor =
        entry.healthScore >= 75 ? chalk.green : entry.healthScore >= 60 ? chalk.yellow : chalk.red;
      lines.push(`${chalk.dim(rank)} ${chalk.white(name)}${scoreColor(score)}`);
    }
  }

  lines.push('');

  // Footer with rank summary
  const userRank = leaderboard.findIndex((e) => e.isUser) + 1;
  const total = leaderboard.length;

  if (userRank === 1) {
    lines.push(chalk.bold.green('  You outrank every famous repo on the list. Legendary.'));
  } else if (userRank <= 3) {
    lines.push(
      chalk.bold.green(`  Top ${userRank} out of ${total}! Your codebase is in elite company.`)
    );
  } else if (userRank <= Math.ceil(total / 2)) {
    lines.push(chalk.bold.yellow(`  Rank ${userRank} of ${total}. Upper half -- not bad at all.`));
  } else if (userRank < total) {
    lines.push(
      chalk.bold.yellow(
        `  Rank ${userRank} of ${total}. Room to climb, but you're in good company.`
      )
    );
  } else {
    lines.push(
      chalk.bold.red(
        `  Rank ${userRank} of ${total}. Even the TypeScript compiler beat you. Time to refactor.`
      )
    );
  }

  lines.push('');
  lines.push(specterGradient('  ================================================================'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a witty one-liner comparing the user's codebase to the matched repo.
 */
function generateWittyComparison(userStats: UserStats, matchedRepo: FamousRepoProfile): string {
  const complexityRatio = userStats.avgComplexity / matchedRepo.avgComplexity;
  const sizeRatio = userStats.fileCount / matchedRepo.fileCount;
  const healthDiff = userStats.healthScore - matchedRepo.healthScore;

  // Higher complexity than match
  if (complexityRatio > 1.5 && sizeRatio < 0.5) {
    return `Your codebase has the complexity of ${matchedRepo.name} but the file count of a weekend project.`;
  }

  // Much healthier than match
  if (healthDiff > 20) {
    return `Healthier than ${matchedRepo.name} by ${healthDiff} points -- their maintainers would be jealous.`;
  }

  // Much less healthy
  if (healthDiff < -20) {
    return `${matchedRepo.name} has ${Math.abs(healthDiff)} points on you. Maybe borrow some of their CI config?`;
  }

  // Tiny but complex
  if (sizeRatio < 0.1 && complexityRatio > 1.0) {
    return `Somehow you packed ${matchedRepo.name}-level complexity into a fraction of the files. Impressive... or terrifying.`;
  }

  // Larger than match
  if (sizeRatio > 2.0) {
    return `You have ${sizeRatio.toFixed(1)}x the files of ${matchedRepo.name}. That's either ambition or scope creep.`;
  }

  // Very similar
  if (Math.abs(healthDiff) <= 5 && Math.abs(complexityRatio - 1) < 0.2) {
    return `You and ${matchedRepo.name} are practically twins. Same energy, same complexity, same vibe.`;
  }

  // Default
  return `Your codebase walks in ${matchedRepo.name}'s footsteps -- similar health, similar battle scars.`;
}
