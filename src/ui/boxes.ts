/**
 * Box Drawing Utilities
 *
 * Create beautiful terminal boxes, panels, and tables
 * for structured output display.
 */

import chalk from 'chalk';
import { colors } from './colors.js';

/**
 * Options for customizing box appearance
 */
export interface BoxOptions {
  /** Title to display at top of box */
  title?: string;
  /** Title alignment within the box */
  titleAlign?: 'left' | 'center' | 'right';
  /** Padding inside the box (default: 1) */
  padding?: number;
  /** Border style (default: 'single') */
  borderStyle?: 'single' | 'double' | 'rounded' | 'heavy';
  /** Border color function */
  borderColor?: (s: string) => string;
  /** Fixed width (auto-calculates if not provided) */
  width?: number;
}

/**
 * Options for table rendering
 */
export interface TableOptions {
  /** Column headers */
  headers?: string[];
  /** Column alignments */
  align?: ('left' | 'right' | 'center')[];
  /** Minimum column widths */
  minWidths?: number[];
  /** Add border around table */
  border?: boolean;
  /** Border style for bordered tables */
  borderStyle?: 'single' | 'double' | 'rounded';
}

/**
 * Border character sets for different styles
 */
const borderChars = {
  single: {
    tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518',
    h: '\u2500', v: '\u2502',
    lt: '\u251C', rt: '\u2524', mt: '\u252C', mb: '\u2534', cross: '\u253C',
  },
  double: {
    tl: '\u2554', tr: '\u2557', bl: '\u255A', br: '\u255D',
    h: '\u2550', v: '\u2551',
    lt: '\u2560', rt: '\u2563', mt: '\u2566', mb: '\u2569', cross: '\u256C',
  },
  rounded: {
    tl: '\u256D', tr: '\u256E', bl: '\u2570', br: '\u256F',
    h: '\u2500', v: '\u2502',
    lt: '\u251C', rt: '\u2524', mt: '\u252C', mb: '\u2534', cross: '\u253C',
  },
  heavy: {
    tl: '\u250F', tr: '\u2513', bl: '\u2517', br: '\u251B',
    h: '\u2501', v: '\u2503',
    lt: '\u2523', rt: '\u252B', mt: '\u2533', mb: '\u253B', cross: '\u254B',
  },
};

/**
 * Strip ANSI escape codes to get actual string length
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Get the visible length of a string (excluding ANSI codes)
 */
function visibleLength(str: string): number {
  return stripAnsi(str).length;
}

/**
 * Pad a string to a specific visible width
 */
function padToWidth(str: string, width: number, align: 'left' | 'right' | 'center' = 'left'): string {
  const visible = visibleLength(str);
  const padding = Math.max(0, width - visible);

  switch (align) {
    case 'right':
      return ' '.repeat(padding) + str;
    case 'center': {
      const leftPad = Math.floor(padding / 2);
      const rightPad = padding - leftPad;
      return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
    }
    default:
      return str + ' '.repeat(padding);
  }
}

/**
 * Create a box around content
 *
 * @param content - String or array of strings to put in the box
 * @param options - Box customization options
 * @returns Formatted box string
 */
export function box(content: string | string[], options: BoxOptions = {}): string {
  const {
    title,
    titleAlign = 'left',
    padding = 1,
    borderStyle = 'single',
    borderColor = colors.border,
    width,
  } = options;

  const chars = borderChars[borderStyle];
  const lines = Array.isArray(content) ? content : content.split('\n');

  // Calculate content width
  const maxLineWidth = Math.max(...lines.map(visibleLength), title ? visibleLength(title) : 0);
  const innerWidth = width ? width - 2 : maxLineWidth + padding * 2;

  const result: string[] = [];

  // Top border with optional title
  if (title) {
    const titleStr = ` ${title} `;
    const titlePadded = padToWidth(titleStr, innerWidth, titleAlign);
    result.push(borderColor(chars.tl + chars.h.repeat(innerWidth) + chars.tr));
    result.push(borderColor(chars.v) + colors.header(titlePadded) + borderColor(chars.v));
    result.push(borderColor(chars.lt + chars.h.repeat(innerWidth) + chars.rt));
  } else {
    result.push(borderColor(chars.tl + chars.h.repeat(innerWidth) + chars.tr));
  }

  // Content lines
  const horizontalPadding = ' '.repeat(padding);
  for (const line of lines) {
    const paddedContent = horizontalPadding + padToWidth(line, innerWidth - padding * 2) + horizontalPadding;
    result.push(borderColor(chars.v) + paddedContent + borderColor(chars.v));
  }

  // Bottom border
  result.push(borderColor(chars.bl + chars.h.repeat(innerWidth) + chars.br));

  return result.join('\n');
}

/**
 * Create a header box (simple title box)
 *
 * @param title - Title text
 * @param options - Box options (excluding title)
 * @returns Formatted header box string
 */
export function headerBox(title: string, options: Omit<BoxOptions, 'title'> = {}): string {
  const {
    titleAlign = 'center',
    borderStyle = 'double',
    borderColor = colors.border,
    width,
  } = options;

  const chars = borderChars[borderStyle];
  const titleWidth = visibleLength(title);
  const innerWidth = width ? width - 2 : titleWidth + 4;

  const paddedTitle = padToWidth(` ${title} `, innerWidth, titleAlign);

  return [
    borderColor(chars.tl + chars.h.repeat(innerWidth) + chars.tr),
    borderColor(chars.v) + colors.header(paddedTitle) + borderColor(chars.v),
    borderColor(chars.bl + chars.h.repeat(innerWidth) + chars.br),
  ].join('\n');
}

/**
 * Create a section with title and content
 *
 * @param title - Section title
 * @param content - Section content
 * @returns Formatted section string
 */
export function section(title: string, content: string | string[]): string {
  const lines = Array.isArray(content) ? content : content.split('\n');
  const result: string[] = [];

  result.push(colors.header(title));
  result.push(colors.muted('\u2500'.repeat(visibleLength(title))));
  result.push(...lines);

  return result.join('\n');
}

/**
 * Create a horizontal divider
 *
 * @param width - Divider width (default: 40)
 * @param char - Character to use (default: '\u2500')
 * @param color - Color function (default: muted)
 * @returns Divider string
 */
export function divider(width: number = 40, char: string = '\u2500', color = colors.muted): string {
  return color(char.repeat(width));
}

/**
 * Format a key-value pair with aligned columns
 *
 * @param key - Label/key
 * @param value - Value to display
 * @param keyWidth - Fixed width for key column (default: 16)
 * @param separator - Separator between key and value (default: ':')
 * @returns Formatted key-value string
 */
export function keyValue(
  key: string,
  value: string | number,
  keyWidth: number = 16,
  separator: string = ':'
): string {
  const paddedKey = padToWidth(key, keyWidth);
  return `${colors.muted(paddedKey)}${separator} ${colors.primary(String(value))}`;
}

/**
 * Format multiple key-value pairs
 *
 * @param pairs - Object or array of [key, value] pairs
 * @param keyWidth - Fixed width for key column
 * @returns Formatted multi-line key-value string
 */
export function keyValueList(
  pairs: Record<string, string | number> | Array<[string, string | number]>,
  keyWidth?: number
): string {
  const entries = Array.isArray(pairs) ? pairs : Object.entries(pairs);

  // Auto-calculate key width if not provided
  const width = keyWidth ?? Math.max(...entries.map(([k]) => visibleLength(k))) + 2;

  return entries.map(([k, v]) => keyValue(k, v, width)).join('\n');
}

/**
 * Create a formatted table
 *
 * @param rows - Array of row arrays
 * @param options - Table options
 * @returns Formatted table string
 */
export function table(
  rows: (string | number)[][],
  options: TableOptions = {}
): string {
  const {
    headers,
    align = [],
    minWidths = [],
    border = false,
    borderStyle = 'single',
  } = options;

  if (rows.length === 0 && !headers) return '';

  // Convert all values to strings
  const stringRows = rows.map(row => row.map(cell => String(cell)));
  const allRows = headers ? [headers, ...stringRows] : stringRows;

  // Calculate column widths
  const colCount = Math.max(...allRows.map(r => r.length));
  const colWidths: number[] = [];

  for (let col = 0; col < colCount; col++) {
    const maxWidth = Math.max(
      ...allRows.map(row => visibleLength(row[col] || '')),
      minWidths[col] || 0
    );
    colWidths.push(maxWidth);
  }

  // Format each row
  const formatRow = (row: string[], isHeader = false): string => {
    const cells = row.map((cell, i) => {
      const cellAlign = align[i] || 'left';
      const padded = padToWidth(cell || '', colWidths[i], cellAlign);
      return isHeader ? colors.header(padded) : padded;
    });

    if (border) {
      const chars = borderChars[borderStyle];
      return chars.v + ' ' + cells.join(' ' + chars.v + ' ') + ' ' + chars.v;
    }

    return cells.join('  ');
  };

  const result: string[] = [];

  if (border) {
    const chars = borderChars[borderStyle];
    const topBorder = chars.tl + colWidths.map(w => chars.h.repeat(w + 2)).join(chars.mt) + chars.tr;
    result.push(topBorder);
  }

  if (headers) {
    result.push(formatRow(headers, true));

    if (border) {
      const chars = borderChars[borderStyle];
      const separator = chars.lt + colWidths.map(w => chars.h.repeat(w + 2)).join(chars.cross) + chars.rt;
      result.push(separator);
    } else {
      result.push(colWidths.map(w => '\u2500'.repeat(w)).join('  '));
    }
  }

  for (const row of stringRows) {
    result.push(formatRow(row));
  }

  if (border) {
    const chars = borderChars[borderStyle];
    const bottomBorder = chars.bl + colWidths.map(w => chars.h.repeat(w + 2)).join(chars.mb) + chars.br;
    result.push(bottomBorder);
  }

  return result.join('\n');
}

/**
 * Create a panel with multiple sections
 *
 * @param sections - Array of { title, content } objects
 * @param options - Box options for the outer panel
 * @returns Formatted panel string
 */
export function panel(
  sections: Array<{ title: string; content: string | string[] }>,
  options: BoxOptions = {}
): string {
  const allContent: string[] = [];

  sections.forEach((sec, index) => {
    if (index > 0) {
      allContent.push(''); // Empty line between sections
    }
    const sectionContent = Array.isArray(sec.content) ? sec.content : sec.content.split('\n');
    allContent.push(colors.accent(`\u25B6 ${sec.title}`));
    allContent.push(...sectionContent.map(line => `  ${line}`));
  });

  return box(allContent, { ...options, borderStyle: options.borderStyle || 'rounded' });
}

/**
 * Create an indented block
 *
 * @param content - Content to indent
 * @param level - Indentation level (default: 1)
 * @param indent - Indent string (default: '  ')
 * @returns Indented content
 */
export function indent(content: string | string[], level: number = 1, indentStr: string = '  '): string {
  const lines = Array.isArray(content) ? content : content.split('\n');
  const prefix = indentStr.repeat(level);
  return lines.map(line => prefix + line).join('\n');
}

/**
 * Create a bullet list
 *
 * @param items - List items
 * @param bullet - Bullet character (default: '\u2022')
 * @param color - Optional color function for bullets
 * @returns Formatted bullet list
 */
export function bulletList(
  items: string[],
  bullet: string = '\u2022',
  color?: (s: string) => string
): string {
  const coloredBullet = color ? color(bullet) : bullet;
  return items.map(item => `${coloredBullet} ${item}`).join('\n');
}

/**
 * Create a numbered list
 *
 * @param items - List items
 * @param startAt - Starting number (default: 1)
 * @returns Formatted numbered list
 */
export function numberedList(items: string[], startAt: number = 1): string {
  const maxNum = startAt + items.length - 1;
  const numWidth = String(maxNum).length;

  return items
    .map((item, i) => {
      const num = String(startAt + i).padStart(numWidth);
      return `${colors.muted(num + '.')} ${item}`;
    })
    .join('\n');
}

/**
 * Create a tree structure display
 *
 * @param items - Array of { label, children? } objects
 * @param prefix - Current prefix (for recursion)
 * @returns Formatted tree string
 */
export function tree(
  items: Array<{ label: string; children?: Array<{ label: string; children?: unknown[] }> }>,
  prefix: string = ''
): string {
  const result: string[] = [];

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const connector = isLast ? '\u2514\u2500' : '\u251C\u2500';
    const childPrefix = isLast ? '  ' : '\u2502 ';

    result.push(prefix + colors.muted(connector) + ' ' + item.label);

    if (item.children && item.children.length > 0) {
      result.push(tree(item.children as typeof items, prefix + childPrefix));
    }
  });

  return result.join('\n');
}

/**
 * Wrap text to a maximum width
 *
 * @param text - Text to wrap
 * @param maxWidth - Maximum line width
 * @returns Wrapped text
 */
export function wrapText(text: string, maxWidth: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}
