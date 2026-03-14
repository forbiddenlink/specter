/**
 * ANSI Parsing and Content Configuration for PNG Export
 *
 * Handles ANSI escape code processing, text segment creation,
 * and content type detection for terminal-to-PNG rendering.
 */

// =============================================================================
// Types
// =============================================================================

export interface TextSegment {
  text: string;
  color: string;
  bold: boolean;
  italic: boolean;
  dim: boolean;
}

export interface ParsedLine {
  segments: TextSegment[];
}

export interface ContentConfig {
  type: 'wrapped' | 'achievements' | 'dna' | 'generic';
  emoji: string;
  title: string;
  subtitle: string;
  gradient: [string, string];
}

export interface AnsiParserState {
  currentColor: string;
  bold: boolean;
  italic: boolean;
  dim: boolean;
}

// =============================================================================
// Color Mappings
// =============================================================================

// ANSI color code to hex color mapping (dark theme)
const ansiColorsDark: Record<string, string> = {
  // Standard colors
  '30': '#4a4a4a', // black
  '31': '#ff6b6b', // red
  '32': '#6bcb77', // green
  '33': '#ffd93d', // yellow
  '34': '#6b8cff', // blue
  '35': '#cc6bff', // magenta
  '36': '#6bffff', // cyan
  '37': '#e0e0e0', // white

  // Bright colors
  '90': '#666666', // bright black (gray)
  '91': '#ff8a8a', // bright red
  '92': '#8fe69b', // bright green
  '93': '#ffe566', // bright yellow
  '94': '#8fa8ff', // bright blue
  '95': '#d98aff', // bright magenta
  '96': '#8affff', // bright cyan
  '97': '#ffffff', // bright white
};

// Light theme color overrides
const ansiColorsLight: Record<string, string> = {
  '30': '#000000', // black
  '31': '#cc0000', // red
  '32': '#006600', // green
  '33': '#cc8800', // yellow
  '34': '#0000cc', // blue
  '35': '#880088', // magenta
  '36': '#008888', // cyan
  '37': '#333333', // white (dark for contrast)
  '90': '#555555', // bright black
  '91': '#ff0000', // bright red
  '92': '#00aa00', // bright green
  '93': '#ffaa00', // bright yellow
  '94': '#0066ff', // bright blue
  '95': '#aa00aa', // bright magenta
  '96': '#00aaaa', // bright cyan
  '97': '#000000', // bright white (black for contrast)
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Adjust color for dim effect (reduce brightness by 40%)
 */
export function adjustColorForDim(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const dimR = Math.floor(r * 0.6);
  const dimG = Math.floor(g * 0.6);
  const dimB = Math.floor(b * 0.6);

  return `#${dimR.toString(16).padStart(2, '0')}${dimG.toString(16).padStart(2, '0')}${dimB.toString(16).padStart(2, '0')}`;
}

/**
 * Strip ANSI codes from text (for measuring)
 */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Create a text segment with the current parser state
 */
export function createTextSegment(text: string, state: AnsiParserState): TextSegment {
  return {
    text,
    color: state.dim ? adjustColorForDim(state.currentColor) : state.currentColor,
    bold: state.bold,
    italic: state.italic,
    dim: state.dim,
  };
}

// =============================================================================
// Parser Setup
// =============================================================================

/**
 * Initialize ANSI parser state for a given theme
 */
export function setupAnsiParser(theme: 'dark' | 'light'): {
  colorMap: Record<string, string>;
  defaultColor: string;
  initialState: AnsiParserState;
} {
  const colorMap = theme === 'dark' ? ansiColorsDark : ansiColorsLight;
  const defaultColor = theme === 'dark' ? '#e0e0e0' : '#333333';

  return {
    colorMap,
    defaultColor,
    initialState: {
      currentColor: defaultColor,
      bold: false,
      italic: false,
      dim: false,
    },
  };
}

/**
 * Process an ANSI escape code and update parser state
 */
function processAnsiCode(
  code: number,
  state: AnsiParserState,
  colorMap: Record<string, string>,
  defaultColor: string
): void {
  if (code === 0) {
    // Reset all attributes
    state.currentColor = defaultColor;
    state.bold = false;
    state.italic = false;
    state.dim = false;
  } else if (code === 1) {
    state.bold = true;
  } else if (code === 2) {
    state.dim = true;
  } else if (code === 3) {
    state.italic = true;
  } else if (code === 22) {
    state.bold = false;
    state.dim = false;
  } else if (code === 23) {
    state.italic = false;
  } else if (colorMap[code.toString()]) {
    state.currentColor = colorMap[code.toString()] ?? defaultColor;
  } else if (code >= 30 && code <= 37) {
    state.currentColor = colorMap[code.toString()] ?? defaultColor;
  } else if (code >= 90 && code <= 97) {
    state.currentColor = colorMap[code.toString()] ?? defaultColor;
  }
}

// =============================================================================
// Main Parsing Function
// =============================================================================

/**
 * Parse ANSI escape codes from text into styled segments
 */
export function parseAnsiCodes(text: string, theme: 'dark' | 'light'): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const { colorMap, defaultColor, initialState } = setupAnsiParser(theme);
  const rawLines = text.split('\n');

  for (const rawLine of rawLines) {
    const segments: TextSegment[] = [];
    const state: AnsiParserState = { ...initialState };

    // ANSI escape code regex
    const ansiRegex = /\x1b\[([0-9;]+)m/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = ansiRegex.exec(rawLine);

    while (match !== null) {
      // Add text before this escape code
      if (match.index > lastIndex) {
        const textBefore = rawLine.substring(lastIndex, match.index);
        if (textBefore) {
          segments.push(createTextSegment(textBefore, state));
        }
      }

      // Parse the escape code
      const matchGroup = match[1];
      if (matchGroup) {
        const codes = matchGroup.split(';').map(Number);
        for (const code of codes) {
          processAnsiCode(code, state, colorMap, defaultColor);
        }
      }

      lastIndex = ansiRegex.lastIndex;
      match = ansiRegex.exec(rawLine);
    }

    // Add remaining text after last escape code
    if (lastIndex < rawLine.length) {
      const remaining = rawLine.substring(lastIndex);
      if (remaining) {
        segments.push(createTextSegment(remaining, state));
      }
    }

    // If no segments, add empty line placeholder
    if (segments.length === 0) {
      segments.push({
        text: '',
        color: defaultColor,
        bold: false,
        italic: false,
        dim: false,
      });
    }

    lines.push({ segments });
  }

  return lines;
}

// =============================================================================
// Content Configuration
// =============================================================================

/**
 * Detect content type and return full configuration
 * Unifies detectContentType + getHeaderInfo into single function
 */
export function getContentConfig(content: string): ContentConfig {
  // Detect content type
  let type: ContentConfig['type'] = 'generic';

  if (content.includes('WRAPPED') || content.includes('#SpecterWrapped')) {
    type = 'wrapped';
  } else if (content.includes('ACHIEVEMENTS') || content.includes('UNLOCKED')) {
    type = 'achievements';
  } else if (
    content.includes('DNA PROFILE') ||
    content.includes('DOUBLE HELIX') ||
    content.includes('Sequence:')
  ) {
    type = 'dna';
  }

  // Return config based on type
  switch (type) {
    case 'wrapped':
      return {
        type,
        emoji: '\u{1F3B5}', // musical note
        title: 'Specter Wrapped',
        subtitle: 'Your Year in Code',
        gradient: ['#1a1a2e', '#16213e'],
      };
    case 'achievements':
      return {
        type,
        emoji: '\u{1F3C6}', // trophy
        title: 'Specter Achievements',
        subtitle: 'Your Coding Badges',
        gradient: ['#1a1a2e', '#2d132c'],
      };
    case 'dna':
      return {
        type,
        emoji: '\u{1F9EC}', // dna
        title: 'Codebase DNA',
        subtitle: 'Your Unique Fingerprint',
        gradient: ['#1a1a2e', '#0a3d62'],
      };
    default:
      return {
        type: 'generic',
        emoji: '\u{1F47B}', // ghost
        title: 'Specter',
        subtitle: 'Code Intelligence',
        gradient: ['#1a1a2e', '#1a1a2e'],
      };
  }
}
