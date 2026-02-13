/**
 * Ask - Natural Language Codebase Q&A with Personality
 *
 * The "wow moment" feature - ask questions about your codebase
 * in natural language and get personality-driven answers.
 */

import { type SimpleGit, simpleGit } from 'simple-git';
import type { GraphNode, KnowledgeGraph, NodeType } from './graph/types.js';
import type { PersonalityMode } from './personality/types.js';

export interface AskResult {
  question: string;
  questionType: QuestionType;
  answer: string;
  relevantFiles: RelevantFile[];
  confidence: number;
  personality: PersonalityMode;
}

export interface RelevantFile {
  path: string;
  name: string;
  type: NodeType | 'directory';
  relevance: string;
  line?: number;
}

type QuestionType =
  | 'what-does' // "What does X do?"
  | 'where-is' // "Where is X handled?"
  | 'who-wrote' // "Who wrote X?"
  | 'why-exists' // "Why does X exist?"
  | 'how-works' // "How does X work?"
  | 'list' // "List all X" / "Show me X"
  | 'general'; // Fallback

/**
 * Question pattern matchers
 */
const QUESTION_PATTERNS: Array<{ pattern: RegExp; type: QuestionType }> = [
  { pattern: /^what\s+(does|is|are)\s+/i, type: 'what-does' },
  { pattern: /^where\s+(is|are|do|does|can\s+i\s+find)\s+/i, type: 'where-is' },
  { pattern: /^who\s+(wrote|created|made|owns|maintains)\s+/i, type: 'who-wrote' },
  { pattern: /^why\s+(does|is|was|do|are)\s+/i, type: 'why-exists' },
  { pattern: /^how\s+(does|do|is|are|can)\s+/i, type: 'how-works' },
  { pattern: /^(list|show|find|get)\s+(all\s+|me\s+)?/i, type: 'list' },
  { pattern: /^(tell\s+me\s+about|explain|describe)\s+/i, type: 'what-does' },
];

/** Template interface for personality-driven responses */
interface PersonalityTemplate {
  intro: (type: QuestionType, subject: string) => string;
  notFound: (subject: string) => string;
  found: (subject: string, count: number) => string;
  closing: () => string;
}

/**
 * Personality response templates
 */
const PERSONALITY_TEMPLATES: Record<PersonalityMode, PersonalityTemplate> = {
  default: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `Let me tell you about ${subject}...`;
        case 'where-is':
          return `Looking for ${subject}...`;
        case 'who-wrote':
          return `Let me check the git history for ${subject}...`;
        case 'why-exists':
          return `Here's what I know about why ${subject} exists...`;
        case 'how-works':
          return `Let me explain how ${subject} works...`;
        case 'list':
          return `Here's what I found for ${subject}...`;
        default:
          return `Here's what I know about ${subject}...`;
      }
    },
    notFound: (subject) => `I couldn't find anything matching "${subject}" in the codebase.`,
    found: (subject, count) =>
      `Found ${count} relevant ${count === 1 ? 'item' : 'items'} for "${subject}".`,
    closing: () => 'Feel free to ask more questions about the codebase.',
  },

  noir: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `*lights cigarette* ${subject}? That's where the action is, kid...`;
        case 'where-is':
          return `You're looking for ${subject}? *flips through files* I know this town...`;
        case 'who-wrote':
          return `*checks the records* Someone left their fingerprints on ${subject}...`;
        case 'why-exists':
          return `Why does ${subject} exist? *stares out rain-streaked window* Every file has a story...`;
        case 'how-works':
          return `How does ${subject} work? *exhales slowly* Let me take you through the dark alleys...`;
        case 'list':
          return `*spreads files across desk* Here's what I dug up on ${subject}...`;
        default:
          return `*adjusts fedora* ${subject}, eh? I've seen things...`;
      }
    },
    notFound: (subject) =>
      `*stubs out cigarette* ${subject}? That trail's gone cold, kid. No traces in this codebase.`,
    found: (subject, count) =>
      `*slides ${count} ${count === 1 ? 'file' : 'files'} across the desk* Here's what I found on "${subject}". The truth is in there.`,
    closing: () => 'The case continues... *disappears into the shadows*',
  },

  roast: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `Oh, you don't know what ${subject} does? Interesting that you work here...`;
        case 'where-is':
          return `Looking for ${subject}? Have you tried... reading the file names?`;
        case 'who-wrote':
          return `Who wrote ${subject}? Let's find out who to blame...`;
        case 'why-exists':
          return `Why does ${subject} exist? Great question. Sometimes I wonder too...`;
        case 'how-works':
          return `How does ${subject} work? *deep breath* Let me dumb this down...`;
        case 'list':
          return `You want me to list ${subject}? Fine, let me do your job for you...`;
        default:
          return `${subject}? Really? Okay, let me hold your hand through this...`;
      }
    },
    notFound: (subject) =>
      `"${subject}" doesn't exist. Kind of like your understanding of this codebase, apparently.`,
    found: (subject, count) =>
      `Found ${count} ${count === 1 ? 'thing' : 'things'} for "${subject}". Even a monkey could have searched for this.`,
    closing: () => "You're welcome. Try not to break anything.",
  },

  mentor: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `Great question! Let me explain ${subject} and why it matters...`;
        case 'where-is':
          return `Let me help you find ${subject}. Understanding file organization is key...`;
        case 'who-wrote':
          return `Good to know the history! Let's see who contributed to ${subject}...`;
        case 'why-exists':
          return `Understanding *why* code exists is crucial. Here's the story of ${subject}...`;
        case 'how-works':
          return `Let's walk through how ${subject} works step by step...`;
        case 'list':
          return `Let me show you what we have for ${subject}. This will be educational...`;
        default:
          return `Let me share what I know about ${subject}...`;
      }
    },
    notFound: (subject) =>
      `I couldn't find "${subject}" in the codebase. This might be a learning opportunity - perhaps it uses a different name?`,
    found: (subject, count) =>
      `Found ${count} relevant ${count === 1 ? 'area' : 'areas'} for "${subject}". Let me explain each...`,
    closing: () => 'I hope this helps you understand the codebase better!',
  },

  cheerleader: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `Ooh, ${subject}! That's a great part of the codebase! Let me tell you...`;
        case 'where-is':
          return `Let's find ${subject} together! This is going to be fun!`;
        case 'who-wrote':
          return `Let's celebrate the awesome people who worked on ${subject}!`;
        case 'why-exists':
          return `${subject} is here for a great reason! Let me share...`;
        case 'how-works':
          return `${subject} is so cool! Here's how the magic happens...`;
        case 'list':
          return `You want to see ${subject}? I love showing off the codebase!`;
        default:
          return `${subject}! Yes! Let me tell you all about it!`;
      }
    },
    notFound: (subject) =>
      `Hmm, I couldn't find "${subject}" but that's okay! Maybe we can find something similar?`,
    found: (subject, count) =>
      `Yay! Found ${count} awesome ${count === 1 ? 'result' : 'results'} for "${subject}"!`,
    closing: () => "Keep exploring! You're doing great!",
  },

  critic: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `${subject}. Let me give you the unvarnished truth...`;
        case 'where-is':
          return `${subject} is located in the following areas. Pay attention...`;
        case 'who-wrote':
          return `The responsible parties for ${subject}:`;
        case 'why-exists':
          return `${subject} exists for these reasons, questionable as they may be...`;
        case 'how-works':
          return `Here's how ${subject} works. Note the inefficiencies...`;
        case 'list':
          return `Here's the list for ${subject}. Make of it what you will...`;
        default:
          return `Regarding ${subject}:`;
      }
    },
    notFound: (subject) => `"${subject}" was not found. Perhaps the naming conventions need work.`,
    found: (subject, count) =>
      `Located ${count} ${count === 1 ? 'item' : 'items'} for "${subject}".`,
    closing: () => 'Review this information carefully.',
  },

  historian: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `The tale of ${subject} begins thus...`;
        case 'where-is':
          return `Through the ages, ${subject} has resided in these locations...`;
        case 'who-wrote':
          return `The chroniclers who shaped ${subject}:`;
        case 'why-exists':
          return `The origins of ${subject} trace back to...`;
        case 'how-works':
          return `The mechanics of ${subject}, evolved over many commits...`;
        case 'list':
          return `From the archives, here are the records of ${subject}...`;
        default:
          return `Let me consult the historical records on ${subject}...`;
      }
    },
    notFound: (subject) =>
      `"${subject}" appears nowhere in the historical record. Perhaps it was refactored away?`,
    found: (subject, count) =>
      `The archives reveal ${count} ${count === 1 ? 'artifact' : 'artifacts'} related to "${subject}".`,
    closing: () => 'And so the history is recorded.',
  },

  minimalist: {
    intro: () => '',
    notFound: (subject) => `Not found: ${subject}`,
    found: (_, count) => `${count} results:`,
    closing: () => '',
  },

  therapist: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `I sense you're curious about ${subject}. Let's explore that together...`;
        case 'where-is':
          return `You're searching for ${subject}. What draws you to it?`;
        case 'who-wrote':
          return `Understanding authorship can help us process ${subject}...`;
        case 'why-exists':
          return `You're asking about the *purpose* of ${subject}. That's deep...`;
        case 'how-works':
          return `Let's gently unpack how ${subject} functions...`;
        case 'list':
          return `I hear you want to see ${subject}. Let's take it one step at a time...`;
        default:
          return `Tell me more about what draws you to ${subject}...`;
      }
    },
    notFound: (subject) => `"${subject}" isn't present here. How does that make you feel?`,
    found: (subject, count) =>
      `I found ${count} ${count === 1 ? 'connection' : 'connections'} to "${subject}". Let's process this together.`,
    closing: () => "Take your time absorbing this. I'm here when you need me.",
  },

  dramatic: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `*thunder rumbles* Behold! The legend of ${subject} unfolds...`;
        case 'where-is':
          return `*dramatic pause* The sacred location of ${subject} shall be revealed!`;
        case 'who-wrote':
          return `*orchestra swells* The heroes who forged ${subject}:`;
        case 'why-exists':
          return `*narrator voice* In the beginning, there was ${subject}...`;
        case 'how-works':
          return `*epic music* Witness the inner workings of ${subject}!`;
        case 'list':
          return `*curtain rises* Presenting... the complete compendium of ${subject}!`;
        default:
          return `*spotlight illuminates* ${subject} steps into the light...`;
      }
    },
    notFound: (subject) =>
      `*tragic music* Alas! "${subject}" exists not in this realm... The search was in vain!`,
    found: (subject, count) =>
      `*triumphant fanfare* ${count} ${count === 1 ? 'treasure' : 'treasures'} discovered for "${subject}"!`,
    closing: () => '*The curtain falls, but the code lives on...*',
  },

  ghost: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `*static* ...${subject}... I remember when it was written...`;
        case 'where-is':
          return `*whispers* ${subject}... it haunts these directories...`;
        case 'who-wrote':
          return `*echoes* The spirits who created ${subject}...`;
        case 'why-exists':
          return `*distant voice* ${subject}... it was born from necessity...`;
        case 'how-works':
          return `*fading in and out* ...the mechanisms of ${subject}...`;
        case 'list':
          return `*static* ...these are the remnants of ${subject}...`;
        default:
          return `*static* ...${subject}... I sense its presence...`;
      }
    },
    notFound: (subject) =>
      `*silence* ...${subject} has passed beyond... deleted, perhaps... *static*`,
    found: (subject, count) =>
      `*whispers* ...${count} ${count === 1 ? 'trace' : 'traces'} of "${subject}" remain...`,
    closing: () => '*fading* ...remember me... *static*',
  },

  executive: {
    intro: (type, subject) => {
      switch (type) {
        case 'what-does':
          return `From a strategic perspective, ${subject} delivers the following value...`;
        case 'where-is':
          return `${subject} is positioned within the architecture as follows...`;
        case 'who-wrote':
          return `Key stakeholders and contributors for ${subject}:`;
        case 'why-exists':
          return `The business case for ${subject}:`;
        case 'how-works':
          return `Let me outline the operational mechanics of ${subject}...`;
        case 'list':
          return `Portfolio overview for ${subject}:`;
        default:
          return `Strategic analysis of ${subject}:`;
      }
    },
    notFound: (subject) =>
      `"${subject}" is not present in the current technical portfolio. This may represent a gap or opportunity.`,
    found: (subject, count) =>
      `Identified ${count} ${count === 1 ? 'asset' : 'assets'} related to "${subject}".`,
    closing: () => 'Recommend reviewing these findings in the next planning cycle.',
  },
};

/**
 * Detect the type of question being asked
 */
function detectQuestionType(question: string): QuestionType {
  for (const { pattern, type } of QUESTION_PATTERNS) {
    if (pattern.test(question)) {
      return type;
    }
  }
  return 'general';
}

/**
 * Extract the subject from a question
 */
function extractSubject(question: string, type: QuestionType): string {
  let subject = question;

  // Remove question words based on type
  const removals: Record<QuestionType, RegExp[]> = {
    'what-does': [/^what\s+(does|is|are)\s+/i, /\?$/],
    'where-is': [
      /^where\s+(is|are|do|does|can\s+i\s+find)\s+/i,
      /\s+(handled|located|defined|stored).*$/i,
      /\?$/,
    ],
    'who-wrote': [/^who\s+(wrote|created|made|owns|maintains)\s+/i, /\?$/],
    'why-exists': [/^why\s+(does|is|was|do|are)\s+/i, /\s+(exist|there).*$/i, /\?$/],
    'how-works': [/^how\s+(does|do|is|are|can)\s+/i, /\s+work.*$/i, /\?$/],
    list: [/^(list|show|find|get)\s+(all\s+|me\s+)?/i, /\?$/],
    general: [/^(tell\s+me\s+about|explain|describe)\s+/i, /\?$/],
  };

  for (const pattern of removals[type] || []) {
    subject = subject.replace(pattern, '');
  }

  // Clean up common words
  subject = subject.replace(/^(the|a|an|my|our|this)\s+/i, '');
  subject = subject.replace(/\s+(code|file|function|class|module|system|feature)$/i, '');

  return subject.trim().toLowerCase();
}

/**
 * Search for relevant nodes in the graph
 */
function searchGraph(subject: string, graph: KnowledgeGraph): GraphNode[] {
  const keywords = subject.split(/\s+/).filter((w) => w.length > 1);
  const results: Array<{ node: GraphNode; score: number }> = [];

  for (const node of Object.values(graph.nodes)) {
    let score = 0;
    const nameLower = node.name.toLowerCase();
    const pathLower = node.filePath.toLowerCase();

    for (const keyword of keywords) {
      // Exact name match
      if (nameLower === keyword) {
        score += 100;
      }
      // Name contains keyword
      else if (nameLower.includes(keyword)) {
        score += 50;
      }
      // Path contains keyword
      else if (pathLower.includes(keyword)) {
        score += 25;
      }
    }

    // Bonus for exported symbols
    if (node.exported && score > 0) {
      score += 10;
    }

    // Bonus for files (entry points)
    if (node.type === 'file' && score > 0) {
      score += 5;
    }

    if (score > 0) {
      results.push({ node, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, 10).map((r) => r.node);
}

/**
 * Find directories that match the subject
 */
function findDirectories(subject: string, graph: KnowledgeGraph): string[] {
  const dirs = new Set<string>();
  const keywords = subject.split(/\s+/).filter((w) => w.length > 1);

  for (const node of Object.values(graph.nodes)) {
    if (node.type === 'file') {
      const dirPath = node.filePath.split('/').slice(0, -1).join('/');
      for (const keyword of keywords) {
        if (dirPath.toLowerCase().includes(keyword)) {
          dirs.add(dirPath);
        }
      }
    }
  }

  return Array.from(dirs);
}

/**
 * Get git history for files
 */
async function getGitAuthors(
  rootDir: string,
  filePaths: string[]
): Promise<Map<string, { author: string; commits: number }>> {
  const authors = new Map<string, { author: string; commits: number }>();
  const git: SimpleGit = simpleGit(rootDir);

  for (const filePath of filePaths.slice(0, 5)) {
    try {
      const log = await git.log({ file: filePath, maxCount: 20 });
      if (log.total > 0) {
        const authorCounts = new Map<string, number>();
        for (const commit of log.all) {
          authorCounts.set(commit.author_name, (authorCounts.get(commit.author_name) || 0) + 1);
        }
        const topAuthor = [...authorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (topAuthor) {
          authors.set(filePath, { author: topAuthor[0], commits: topAuthor[1] });
        }
      }
    } catch {
      // Skip files with git errors
    }
  }

  return authors;
}

/**
 * Generate description of what a file/symbol does
 */
function describeNode(node: GraphNode, graph: KnowledgeGraph): string {
  const descriptions: string[] = [];

  switch (node.type) {
    case 'file': {
      const lineCount = (node as { lineCount?: number }).lineCount;
      const exports = graph.edges.filter(
        (e) => e.source === node.id && e.type === 'exports'
      ).length;
      const imports = graph.edges.filter(
        (e) => e.source === node.id && e.type === 'imports'
      ).length;

      descriptions.push(`File with ${lineCount || '?'} lines of code.`);
      if (exports > 0) descriptions.push(`Exports ${exports} symbols.`);
      if (imports > 0) descriptions.push(`Imports from ${imports} modules.`);

      // Check for common patterns
      const nameLower = node.name.toLowerCase();
      if (nameLower.includes('test') || nameLower.includes('spec')) {
        descriptions.push('This is a test file.');
      } else if (nameLower.includes('index')) {
        descriptions.push('Entry point/barrel file.');
      } else if (nameLower.includes('types')) {
        descriptions.push('Type definitions.');
      }
      break;
    }

    case 'function': {
      const funcNode = node as { parameters?: string[]; returnType?: string; isAsync?: boolean };
      const params = funcNode.parameters?.length || 0;
      if (funcNode.isAsync) descriptions.push('Async function');
      else descriptions.push('Function');
      descriptions.push(`with ${params} parameter${params === 1 ? '' : 's'}.`);
      if (funcNode.returnType) descriptions.push(`Returns ${funcNode.returnType}.`);
      break;
    }

    case 'class': {
      const classNode = node as { extends?: string; memberCount?: number };
      descriptions.push('Class definition');
      if (classNode.extends) descriptions.push(`extending ${classNode.extends}.`);
      if (classNode.memberCount) descriptions.push(`Has ${classNode.memberCount} members.`);
      break;
    }

    case 'interface':
    case 'type':
      descriptions.push(`TypeScript ${node.type} definition.`);
      break;

    case 'enum':
      descriptions.push('Enumeration type.');
      break;

    case 'variable':
      descriptions.push('Variable/constant.');
      if (node.exported) descriptions.push('Exported.');
      break;
  }

  // Add documentation if available
  if (node.documentation) {
    descriptions.push(node.documentation.slice(0, 100));
  }

  return descriptions.join(' ');
}

/**
 * Generate flow description for how-works questions
 */
function describeFlow(nodes: GraphNode[], graph: KnowledgeGraph): string[] {
  const flows: string[] = [];

  for (const node of nodes.slice(0, 3)) {
    // Find what this node imports
    const imports = graph.edges
      .filter((e) => e.source === node.id && e.type === 'imports')
      .map((e) => graph.nodes[e.target]?.name)
      .filter(Boolean);

    // Find what imports this node
    const importedBy = graph.edges
      .filter((e) => e.target === node.id && e.type === 'imports')
      .map((e) => graph.nodes[e.source]?.name)
      .filter(Boolean);

    if (imports.length > 0 || importedBy.length > 0) {
      let flow = `${node.name}`;
      if (imports.length > 0) {
        flow += ` depends on [${imports.slice(0, 3).join(', ')}${imports.length > 3 ? '...' : ''}]`;
      }
      if (importedBy.length > 0) {
        flow += ` and is used by [${importedBy.slice(0, 3).join(', ')}${importedBy.length > 3 ? '...' : ''}]`;
      }
      flows.push(flow);
    }
  }

  return flows;
}

/**
 * Ask a question about the codebase
 */
/**
 * Generate answer based on question type and search results
 */
function generateAnswer(
  questionType: QuestionType,
  subject: string,
  nodes: GraphNode[],
  directories: string[],
  relevantFiles: RelevantFile[],
  templates: PersonalityTemplate,
  graph: KnowledgeGraph,
  rootDir: string
): Promise<string> {
  return (async () => {
    const parts: string[] = [];

    if (nodes.length === 0 && directories.length === 0) {
      return templates.notFound(subject);
    }

    const intro = templates.intro(questionType, subject);
    if (intro) parts.push(intro);

    switch (questionType) {
      case 'what-does':
      case 'general': {
        parts.push(templates.found(subject, nodes.length + directories.length));
        for (const node of nodes.slice(0, 3)) {
          parts.push(`\n${node.name}: ${describeNode(node, graph)}`);
        }
        break;
      }

      case 'where-is': {
        parts.push(templates.found(subject, relevantFiles.length));
        if (directories.length > 0) {
          parts.push(
            `\nMain location${directories.length > 1 ? 's' : ''}: ${directories.slice(0, 2).join(', ')}`
          );
        }
        for (const node of nodes.slice(0, 3)) {
          parts.push(`\n- ${node.filePath}${node.lineStart > 1 ? `:${node.lineStart}` : ''}`);
        }
        break;
      }

      case 'who-wrote': {
        const filePaths = nodes.map((n) => n.filePath).slice(0, 5);
        const authors = await getGitAuthors(rootDir, filePaths);

        if (authors.size > 0) {
          parts.push(templates.found(subject, authors.size));
          for (const [path, info] of authors.entries()) {
            const fileName = path.split('/').pop();
            parts.push(`\n${fileName}: ${info.author} (${info.commits} commits)`);
          }
        } else {
          parts.push('\nNo git history available for these files.');
        }
        break;
      }

      case 'why-exists': {
        parts.push(templates.found(subject, nodes.length));
        for (const node of nodes.slice(0, 2)) {
          const description = describeNode(node, graph);
          parts.push(`\n${node.name}: ${description}`);
          const usedBy = graph.edges.filter(
            (e) => e.target === node.id && e.type === 'imports'
          ).length;
          if (usedBy > 0) {
            parts.push(`  Used by ${usedBy} other file${usedBy > 1 ? 's' : ''}.`);
          }
        }
        break;
      }

      case 'how-works': {
        parts.push(templates.found(subject, nodes.length));
        const flows = describeFlow(nodes, graph);
        if (flows.length > 0) {
          parts.push('\nData/Control Flow:');
          for (const flow of flows) {
            parts.push(`  ${flow}`);
          }
        }
        for (const node of nodes.slice(0, 2)) {
          parts.push(`\n${node.name}: ${describeNode(node, graph)}`);
        }
        break;
      }

      case 'list': {
        parts.push(templates.found(subject, relevantFiles.length));
        for (const file of relevantFiles.slice(0, 8)) {
          parts.push(`\n- ${file.name} (${file.type}): ${file.path}`);
        }
        break;
      }
    }

    const closing = templates.closing();
    if (closing) parts.push(`\n\n${closing}`);

    return parts.join('');
  })();
}

/**
 * Build relevant files list from search results
 */
function buildRelevantFilesList(nodes: GraphNode[], directories: string[]): RelevantFile[] {
  const relevantFiles: RelevantFile[] = [];
  const seenPaths = new Set<string>();

  for (const dir of directories.slice(0, 2)) {
    if (!seenPaths.has(dir)) {
      seenPaths.add(dir);
      relevantFiles.push({
        path: dir,
        name: dir.split('/').pop() || dir,
        type: 'directory',
        relevance: 'Directory matches search',
      });
    }
  }

  for (const node of nodes) {
    if (!seenPaths.has(node.filePath)) {
      seenPaths.add(node.filePath);
      relevantFiles.push({
        path: node.filePath,
        name: node.name,
        type: node.type,
        relevance:
          node.type === 'file'
            ? 'File matches search'
            : `${node.type} in ${node.filePath.split('/').pop()}`,
        line: node.lineStart > 1 ? node.lineStart : undefined,
      });
    }
  }

  return relevantFiles;
}

/**
 * Calculate confidence score for answer
 */
function calculateAnswerConfidence(
  nodes: GraphNode[],
  directories: string[],
  subject: string
): number {
  let confidence = 0;
  if (nodes.length > 0) {
    confidence = Math.min(95, 40 + nodes.length * 10);
    const firstNode = nodes[0];
    if (firstNode && firstNode.name.toLowerCase() === subject) {
      confidence = Math.min(95, confidence + 20);
    }
  } else if (directories.length > 0) {
    confidence = 30 + directories.length * 10;
  }
  return confidence;
}

/**
 * Ask a question about the codebase
 */

/**
 * Ask a question about the codebase
 */
export async function askCodebase(
  question: string,
  rootDir: string,
  graph: KnowledgeGraph,
  options: { personality?: PersonalityMode } = {}
): Promise<AskResult> {
  const personality = options.personality || 'default';
  const templates = PERSONALITY_TEMPLATES[personality] || PERSONALITY_TEMPLATES.default;

  const questionType = detectQuestionType(question);
  const subject = extractSubject(question, questionType);

  const nodes = searchGraph(subject, graph);
  const directories = findDirectories(subject, graph);

  const relevantFiles = buildRelevantFilesList(nodes, directories);
  const confidence = calculateAnswerConfidence(nodes, directories, subject);
  const answer = await generateAnswer(
    questionType,
    subject,
    nodes,
    directories,
    relevantFiles,
    templates,
    graph,
    rootDir
  );

  return {
    question,
    questionType,
    answer,
    relevantFiles: relevantFiles.slice(0, 5),
    confidence,
    personality,
  };
}

/**
 * Format ask result for display
 */
export function formatAsk(result: AskResult): string {
  const lines: string[] = [];

  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  💬 ASK SPECTER                                   ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  // Question
  lines.push(`Q: ${result.question}`);
  lines.push('');

  // Answer (wrap long lines)
  lines.push('A:');
  const answerLines = result.answer.split('\n');
  for (const line of answerLines) {
    if (line.length > 60) {
      // Word wrap
      const words = line.split(' ');
      let currentLine = '';
      for (const word of words) {
        if (`${currentLine} ${word}`.length > 60) {
          if (currentLine) lines.push(`   ${currentLine}`);
          currentLine = word;
        } else {
          currentLine = currentLine ? `${currentLine} ${word}` : word;
        }
      }
      if (currentLine) lines.push(`   ${currentLine}`);
    } else {
      lines.push(`   ${line}`);
    }
  }
  lines.push('');

  // Relevant files
  if (result.relevantFiles.length > 0) {
    lines.push('📁 Relevant Files:');
    for (const file of result.relevantFiles) {
      const icon =
        file.type === 'directory'
          ? '📂'
          : file.type === 'file'
            ? '📄'
            : file.type === 'function'
              ? '🔣'
              : file.type === 'class'
                ? '📦'
                : file.type === 'interface' || file.type === 'type'
                  ? '📋'
                  : '•';
      const location = file.line ? `${file.path}:${file.line}` : file.path;
      lines.push(`   ${icon} ${location}`);
      lines.push(`      ${file.relevance}`);
    }
    lines.push('');
  }

  // Confidence
  const confidenceBar = createConfidenceBar(result.confidence);
  lines.push(`Confidence: ${confidenceBar} ${result.confidence}%`);

  lines.push('');
  lines.push('━'.repeat(51));

  return lines.join('\n');
}

/**
 * Create a visual confidence bar
 */
function createConfidenceBar(confidence: number): string {
  const barWidth = 10;
  const filled = Math.round((confidence / 100) * barWidth);
  const empty = barWidth - filled;

  const fillChar = confidence >= 70 ? '█' : confidence >= 40 ? '▓' : '░';
  return `[${fillChar.repeat(filled)}${'·'.repeat(empty)}]`;
}
