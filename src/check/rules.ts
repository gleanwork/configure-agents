import { parse as parseYaml } from 'yaml';
import {
  AGENTS_REQUIRED_SECTIONS,
  CLAUDE_POINTER_DIRECTIVE,
  SKILLS_BLOCK_END,
  SKILLS_BLOCK_START,
  SKILL_REQUIRED_FRONTMATTER,
  SKILL_REQUIRED_SECTIONS,
} from '../baseline/spec.js';
import type { Violation } from '../types/index.js';

function extractHeadings(markdown: string): Array<string> {
  const headings: Array<string> = [];

  for (const line of markdown.split('\n')) {
    const match = /^#{1,6}\s+(.*)$/.exec(line.trim());

    if (match) {
      headings.push(match[1].trim().toLowerCase());
    }
  }

  return headings;
}

function hasSection(markdown: string, section: string): boolean {
  const needle = section.toLowerCase();

  return extractHeadings(markdown).some((heading) => heading.includes(needle));
}

type FrontmatterResult =
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'ok'; data: Record<string, unknown> };

function parseFrontmatter(markdown: string): FrontmatterResult {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);

  if (!match) {
    return { kind: 'missing' };
  }

  try {
    const data = parseYaml(match[1]);

    return data && typeof data === 'object'
      ? { kind: 'ok', data: data as Record<string, unknown> }
      : { kind: 'invalid' };
  } catch {
    return { kind: 'invalid' };
  }
}

export function checkSkill(file: string, content: string): Array<Violation> {
  const violations: Array<Violation> = [];

  const frontmatter = parseFrontmatter(content);

  if (frontmatter.kind === 'missing') {
    violations.push({ file, message: 'missing YAML frontmatter (--- block)' });
  } else if (frontmatter.kind === 'invalid') {
    violations.push({ file, message: 'frontmatter is not valid YAML' });
  } else {
    for (const key of SKILL_REQUIRED_FRONTMATTER) {
      const value = frontmatter.data[key];

      if (typeof value !== 'string' || value.trim().length === 0) {
        violations.push({
          file,
          message: `frontmatter is missing a non-empty ${key}`,
        });
      }
    }
  }

  for (const section of SKILL_REQUIRED_SECTIONS) {
    if (!hasSection(content, section)) {
      violations.push({
        file,
        message: `missing required section: ${section}`,
      });
    }
  }

  return violations;
}

export function checkAgents(file: string, content: string): Array<Violation> {
  const violations: Array<Violation> = [];

  for (const section of AGENTS_REQUIRED_SECTIONS) {
    if (!hasSection(content, section)) {
      violations.push({
        file,
        message: `missing required section: ${section}`,
      });
    }
  }

  return violations;
}

export function checkClaude(file: string, content: string): Array<Violation> {
  return content.includes(CLAUDE_POINTER_DIRECTIVE)
    ? []
    : [
        {
          file,
          message: `must import AGENTS.md via \`${CLAUDE_POINTER_DIRECTIVE}\``,
        },
      ];
}

export function checkReadme(file: string, content: string): Array<Violation> {
  const hasBlock =
    content.includes(SKILLS_BLOCK_START) && content.includes(SKILLS_BLOCK_END);

  return hasBlock
    ? []
    : [
        {
          file,
          message:
            'missing the skills-install block (run configure-agents init)',
        },
      ];
}
